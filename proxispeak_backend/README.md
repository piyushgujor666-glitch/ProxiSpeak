# ProxiSpeak API (proposed backend starter)

This is a learning API scaffold using Express and PostgreSQL. The assignment letter names the ProxiSpeak project and general web-development deliverables, but does not specify this exact stack or the exact required features. Confirm the stack/features with the mentor.

## Prerequisites
- Node.js 20+
- PostgreSQL 15+ (or a compatible hosted PostgreSQL service)

## Setup
1. Create a database named `proxispeak` in PostgreSQL.
2. Run `sql/schema.sql` against that database.
3. Copy `.env.example` to `.env`.
4. Replace `YOUR_PASSWORD` in `DATABASE_URL` with your local PostgreSQL password.
5. Install dependencies and start the API:

```bash
npm install
npm run dev
```

API base URL: `http://localhost:5000`

## Endpoints
- `GET /api/health` — API/database status
- `GET /api/posts` — list posts; optional `q`, `category`, `lat`, `lng`, `radiusKm`
- `POST /api/posts` — create metadata record; expects JSON with `title`, `category`, `audioUrl`, optional `description`, `durationSeconds`, `latitude`, `longitude`

Example request:
```json
{
  "title": "Campus rain",
  "description": "Rain falling near the library",
  "category": "Ambience",
  "audioUrl": "https://example.com/audio/clip.webm",
  "durationSeconds": 24,
  "latitude": 13.0827,
  "longitude": 80.2707
}
```

## Important limitations
- This starter does not upload/store audio files; `audioUrl` must point to an existing audio file. Integrate an approved object-storage provider before real audio uploads.
- No authentication, authorization, rate limiting, moderation, or ownership checks yet. Do not expose it publicly as production-ready.
- Location is optional and exact coordinates are sensitive. Request consent, avoid collecting them unnecessarily, and provide deletion/retention controls before production.
- Proximity filtering uses a Haversine calculation in SQL for a starter dataset. For larger geospatial datasets, consider PostGIS.
