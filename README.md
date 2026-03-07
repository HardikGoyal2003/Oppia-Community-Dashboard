# Oppia Leads Dashboard

## Local Firestore Emulator

`npm run dev` starts both:
- Firestore emulator (`127.0.0.1:8080`)
- Next.js dev server

The emulator UI is available at `http://127.0.0.1:4000`.

## Scripts

- `npm run dev`: emulator + Next dev (recommended)
- `npm run dev:next`: Next dev only (real Firebase)
- `npm run firebase:emulators`: Firestore emulator only

## Production

- `npm run build` and `npm run start` do not enable emulator mode.
- Production uses real Firebase from environment variables.
