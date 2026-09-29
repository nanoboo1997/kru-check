import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm',
};

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function removeProfile(path) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await rm(path, { recursive: true, force: true });
      return;
    } catch (error) {
      if (error.code !== 'ENOTEMPTY' || attempt === 4) throw error;
      await sleep(100 * (attempt + 1));
    }
  }
}

const server = createServer(async (request, response) => {
  try {
    const relative = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html';
    const path = normalize(join(ROOT, relative));
    if (!path.startsWith(ROOT)) throw new Error('outside root');
    await stat(path);
    response.setHeader('Content-Type', MIME[extname(path)] || 'application/octet-stream');
    response.end(await readFile(path));
  } catch {
    response.statusCode = 404;
    response.end('not found');
  }
});

async function waitForDebugger(child) {
  return new Promise((resolve, reject) => {
    let stderr = '';
    const timer = setTimeout(() => reject(new Error(`Chrome DevTools timeout: ${stderr}`)), 20000);
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      const match = stderr.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//);
      if (match) {
        clearTimeout(timer);
        resolve(Number(match[1]));
      }
    });
    child.once('error', reject);
    child.once('exit', (code) => reject(new Error(`Chrome exited before DevTools was ready (${code}): ${stderr}`)));
  });
}

async function pageWebSocket(port) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json()).catch(() => []);
    const page = pages.find((item) => item.type === 'page');
    if (page) return page.webSocketDebuggerUrl;
    await sleep(250);
  }
  throw new Error('Chrome parity tab was not found');
}

async function evaluateUntilComplete(webSocketUrl, url) {
  const socket = new WebSocket(webSocketUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let sequence = 0;
  const pending = new Map();
  const exceptions = [];
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
    if (message.method === 'Runtime.exceptionThrown') {
      const detail = message.params.exceptionDetails;
      const text = detail.exception?.description || detail.text;
      exceptions.push(text);
      console.error(`[browser exception] ${text}`);
    }
    if (message.method === 'Log.entryAdded') console.error(`[browser log] ${message.params.entry.text}`);
    if (message.method === 'Network.loadingFailed') console.error(`[network failed] ${message.params.errorText}`);
    if (message.method === 'Network.responseReceived' && message.params.response.url.includes('opencv')) {
      console.error(`[opencv response] ${message.params.response.status} ${message.params.response.mimeType} ${message.params.response.url}`);
    }
  });
  const command = (method, params = {}) => new Promise((resolve) => {
    const id = ++sequence;
    pending.set(id, resolve);
    socket.send(JSON.stringify({ id, method, params }));
  });
  await command('Runtime.enable');
  await command('Log.enable');
  await command('Network.enable');
  await command('Page.enable');
  await command('Page.navigate', { url });
  const deadline = Date.now() + 8 * 60 * 1000;
  let lastProgress = null;
  while (Date.now() < deadline) {
    const message = await command('Runtime.evaluate', {
      expression: 'window.__PARITY_RESULT__ || null',
      returnByValue: true,
      awaitPromise: true,
    });
    const value = message.result?.result?.value;
    if (value) {
      socket.close();
      return value;
    }
    const progressMessage = await command('Runtime.evaluate', {
      expression: `JSON.stringify({progress:window.__PARITY_PROGRESS__||'starting',
        cvType:typeof window.cv,calledRun:Boolean(window.cv&&window.cv.calledRun),
        hasMat:Boolean(window.cv&&window.cv.Mat),scripts:[...document.scripts].map(s=>s.src)})`,
      returnByValue: true,
    });
    const progress = progressMessage.result?.result?.value;
    if (progress && progress !== lastProgress) {
      console.error(`[parity] ${progress}`);
      lastProgress = progress;
    }
    await sleep(1000);
  }
  socket.close();
  throw new Error(`Browser parity timed out. Exceptions: ${exceptions.join(' | ')}`);
}

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const profile = await mkdtemp(join(tmpdir(), 'kru-check-parity-'));
const page = process.env.KRU_BROWSER_PAGE || 'tests/parity.html';
const url = `http://127.0.0.1:${port}/${page}`;
const child = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });
try {
  const debuggerPort = await waitForDebugger(child);
  const webSocketUrl = await pageWebSocket(debuggerPort);
  const result = await evaluateUntilComplete(webSocketUrl, url);
  console.log(JSON.stringify(result, null, 2));
  if (result.fatal || result.falseConfidentBrowserAutoGrade > 0) process.exitCode = 1;
} finally {
  child.kill('SIGTERM');
  server.close();
  if (child.exitCode === null && child.signalCode === null) {
    await new Promise((resolve) => child.once('exit', resolve));
  }
  await removeProfile(profile);
}
