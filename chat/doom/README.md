# /chat/doom

Freedoom, played multiplayer over WebRTC from the rheophile chat page.

This is a **build artifact**, deployed here so GitHub Pages can serve it. The source and how it is
built live at https://github.com/rheophile10/doom-wasm (a fork of Cloudflare's `doom-wasm`).

- `websockets-doom.{js,wasm}` — Chocolate Doom compiled to WebAssembly.
- `index.html`, `bridge.js`, `touch.js`, `default.cfg` — the game page, the WebSocket→postMessage
  bridge the chat relay talks to, touch controls, and key bindings.
- `freedoom2.wad` — Freedoom Phase 2 game data.

## Licences

Chocolate Doom and the WebAssembly port are under the **GNU General Public License v2** — see
`CHOCOLATE-DOOM-COPYING.md`. Freedoom's assets are under a BSD-style licence — see
`FREEDOOM-COPYING.txt`. Both licence files are included alongside the artifacts.
