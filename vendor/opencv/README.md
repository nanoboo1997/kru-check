# Vendored OpenCV.js/WASM runtime

- OpenCV version: 4.4.0
- Browser package: `@opencv.js/wasm@4.4.0`
- Package source: https://github.com/opencv-js/wasm
- OpenCV source: https://github.com/opencv/opencv/tree/4.4.0
- `opencv.js` SHA-256: `9a6550acbbe451177cf4027b776ece27df1d80c0747cd33ae46ea127a8b7e798`
- `opencv.wasm` SHA-256: `10fbe6382b199e057b966e68073d205430625d228eed6d5e16d5bc1a3bfa481d`
- Wrapper package license: MIT (declared in `package.json`)
- OpenCV license: 3-clause BSD (`OPENCV-LICENSE`)

The smaller JavaScript loader and separate WASM binary avoid the very long
startup time of the official single-file documentation build. Both files are
stored locally, so Kru Check OMR does not need a CDN or Internet connection.
