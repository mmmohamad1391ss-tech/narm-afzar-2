# NOVA Music — project status

## Current state
v1.0.0 built. Installer and portable EXE produced and smoke-tested (Electron on Linux with real audio files; packaged Windows build launched under wine).

## Completed
- Frameless window, custom title bar (min/max/close), size and position remembered
- Folder import (native picker or drop a folder), recursive scan, per-folder libraries; removing a folder never touches files
- Tags + embedded cover art via music-metadata; folder cover.jpg fallback; painted default art when none
- Playback: MP3, WAV, FLAC, M4A/AAC, OGG (HTML audio into a Web Audio chain), seek, queue with drag reorder, shuffle, repeat, media keys
- Audio Studio: 9-band EQ + presets, bass, treble, preamp, balance, loudness (applied to real audio)
- Visualizer ring + spectrum from the real analyser
- Visual Theme Engine: extraction, color safety, Auto/Manual/Hybrid, lock, saved themes, per-song themes, accessibility toggles
- Per-song editing: title, artist, album and a custom cover (choose or drop an image; optional apply to whole album). Saved in state.json, files untouched
- Playlists, favorites, recently played, search (Ctrl+F), keyboard shortcuts
- Persistence in %APPDATA%\nova-music (state.json, library.json, art/, window.json)

## Not done / known limits
- WMA: files are listed but cannot play (Chromium has no WMA decoder). Fix: ffmpeg transcode fallback
- Crossfade and gapless: not implemented (settings removed from UI)
- Installer is unsigned: Windows SmartScreen will warn until a code-signing certificate is added
- Storage is JSON files, not SQLite
- Not yet tested on a real Windows machine with a large library

## Android
Not started. Plan: Capacitor shell around this UI + native Kotlin plugin (MediaStore scan, ExoPlayer/Media3 playback). Cannot be built in the authoring sandbox (no Android SDK access); needs Android Studio or CI.

## Next recommended task
Test on Windows with the real library; then ffmpeg-based WMA/ALAC fallback, crossfade, Mica backdrop.

## Build
    npm install && npm run dist
