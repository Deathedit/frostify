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

## Docker

The image is a static build served by unprivileged nginx on port 8080.

```sh
docker compose up -d          # http://localhost:8080
```

`docker-compose.yml` pulls `ghcr.io/OWNER/frostify:latest` (set OWNER to your GitHub user), or
switch it to `build: .` to build locally. Plain Docker: `docker build -t frostify . && docker run -p 8080:8080 frostify`.

Put it behind your usual reverse proxy for HTTPS. Note that an **https** page can only reach Plex
servers over https, i.e. their `*.plex.direct` addresses (Remote Access or "Secure connections"
enabled in Plex). Over plain http the app can also use LAN `http://` addresses.

## CI

`.github/workflows/ci.yml` runs on every push and PR:

- **check**: `npm ci`, `npm run check`, `npm run build`, and uploads `build/` as an artifact.
- **image** (pushes to `main`, `v*` tags, manual runs): builds `linux/amd64` + `linux/arm64` and
  pushes to `ghcr.io/<owner>/<repo>` tagged `latest` (main), `1.2.3` / `1.2` (tags) and `sha-xxxxxxx`.

No secrets needed; it uses the built-in `GITHUB_TOKEN`. After the first push, the package
appears under your GitHub profile → Packages (private by default; make it public there to pull
without logging in).

## How it works

- **Sign-in**: Plex PIN flow (popup to app.plex.tv, polling plex.tv for the token); falls back to a redirect if popups are blocked.
- **Servers**: lists servers from your account, probes every connection in parallel and uses the best one that answers (LAN → remote → relay). When hosted over https, only `*.plex.direct` https connections are usable.
- **Playback**: direct play for browser-friendly files (mp4/h264/aac, webm), otherwise HLS through the Plex transcoder via hls.js. Progress is reported to Plex so Continue Watching stays in sync.
- **Player keys**: Space/K play·pause, ←/→ (J/L) ±10s, ↑/↓ volume, F fullscreen, M mute, Esc back.
