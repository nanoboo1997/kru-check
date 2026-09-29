/* ============================================================
 * Kru Check — hash router
 * ใช้ hash (#/...) เพื่อให้ทำงานได้บน static hosting ทุกแบบ
 * และปุ่ม Back ของเบราว์เซอร์ทำงานสมเหตุสมผล
 * ============================================================ */

export class Router {
  /**
   * @param {Array<{path:string, page:Function, guard?:Function, shell?:boolean}>} routes
   * path รองรับ :param เช่น 'classrooms/:id'
   */
  constructor(routes) {
    this.routes = routes;
    this.onRoute = null;
    window.addEventListener('hashchange', () => this.render());
  }

  navigate(path) {
    const target = '#/' + path.replace(/^\/+/, '');
    if (location.hash === target) this.render();
    else location.hash = target;
  }

  current() {
    const raw = (location.hash || '#/').replace(/^#\/?/, '');
    const [pathPart, queryPart] = raw.split('?');
    const segments = pathPart.split('/').filter(Boolean);
    return { segments, query: new URLSearchParams(queryPart || '') };
  }

  match(segments) {
    for (const r of this.routes) {
      const parts = r.path.split('/').filter(Boolean);
      if (parts.length !== segments.length) continue;
      const params = {};
      let ok = true;
      for (let i = 0; i < parts.length; i++) {
        if (parts[i].startsWith(':')) params[parts[i].slice(1)] = decodeURIComponent(segments[i]);
        else if (parts[i] !== segments[i]) { ok = false; break; }
      }
      if (ok) return { route: r, params };
    }
    return null;
  }

  async render() {
    const { segments, query } = this.current();
    const found = this.match(segments);
    const route = found?.route;
    const params = found?.params ?? {};
    if (this.onRoute) await this.onRoute({ route, params, query, segments });
  }

  start() {
    if (!location.hash) location.hash = '#/';
    this.render();
  }
}
