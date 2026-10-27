# Frostify

A Netflix-style web player for your Plex Media Server, built with SvelteKit + Svelte 5.

## Develop

Tooling comes from the Nix flake dev shell:

```sh
nix develop            # node 22 + npm
npm install
npm run dev            # http://localhost:5173
```

Or one-shot: `nix develop -c npm run dev`.

## Build

```sh
nix develop -c npm run build   # static SPA in ./build
```

Serve `build/` from any static host, falling back to `index.html` for unknown paths
(e.g. nginx `try_files $uri /index.html;`).

## How it works

- **Sign-in**: Plex PIN flow (popup to app.plex.tv, polling plex.tv for the token); falls back to a redirect if popups are blocked.
- **Servers**: lists servers from your account, probes every connection in parallel and uses the best one that answers (LAN → remote → relay). When hosted over https, only `*.plex.direct` https connections are usable.
- **Playback**: direct play for browser-friendly files (mp4/h264/aac, webm), otherwise HLS through the Plex transcoder via hls.js. Progress is reported to Plex so Continue Watching stays in sync.
- **Player keys**: Space/K play·pause, ←/→ (J/L) ±10s, ↑/↓ volume, F fullscreen, M mute, Esc back.
