# NOVA Music

Local-first Windows music player. Electron shell, Web Audio engine (9-band EQ, analyser), tag and cover-art scanner (music-metadata), dynamic artwork-based theming.

## Run in development
    npm install
    npm start

## Build the Windows installer
    npm install
    npm run dist
Output in `dist/`: `NOVA-Music-Setup.exe` (installer) and `NOVA-Music.exe` (portable).

## Layout
- `electron/` main process: window, IPC, library scanner (`scanner.js`), local media server (`server.js`)
- `src/` renderer parts (`1-head.html` CSS, `2-body.html` markup, `3*-*.js` data/art, engine + theme, views, events); `npm run build:renderer` assembles them into `app/index.html`
- `test/run.js` end-to-end test (needs playwright-core and a sample library in /tmp/music)
- User data (settings, library, cover cache, window bounds) lives in `%APPDATA%\nova-music`
