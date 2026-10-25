# ProxiSpeak — starter prototype

> **Important:** This is a proposed learning prototype based only on the project name and the general web-development objectives in the assignment letter. The letter does not specify the exact product features or technology stack. Confirm mandatory features with your Infotact mentor before treating this prototype as the final assignment.

## Included in this starter

- Responsive React + Vite interface
- Sample nearby-audio cards and category/search filters
- Browser location permission request
- Microphone recording using `MediaRecorder` where supported
- Upload audio files and play locally
- Add and remove locally-created posts
- Basic localStorage metadata persistence
- Illustrative map UI (not real map tiles)

## Requirements

- Node.js 20+ recommended
- npm
- Git

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`).

## Production build

```bash
npm run build
npm run preview
```

## Browser notes

- Microphone and geolocation APIs generally require `localhost` or HTTPS.
- Allow microphone/location permissions when prompted.
- Sample cards are illustrative; they do not contain real audio.
- Audio blobs are held in memory, so created audio will not survive a page reload.
- Location is not sent to a server by this prototype.
- The map is illustrative, not a real geospatial map.

## Known limitations — not production ready

- No backend, authentication, database, cloud audio storage, moderation, or access control.
- No real map provider or server-side proximity query.
- `localStorage` is not a database and is unsuitable for multi-user production use.
- Do not upload sensitive or private recordings.
- The exact production features and stack must be agreed with the project mentor.

## Suggested first Git commits

```bash
git init
git add .
git commit -m "chore: scaffold ProxiSpeak React prototype"
git add README.md
git commit -m "docs: document setup and prototype limitations"
```

Only commit work you have actually run and reviewed. Keep `.env` files and secrets out of Git.
