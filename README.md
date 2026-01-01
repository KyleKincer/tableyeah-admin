# TableYeah Admin

Admin app for managing events, guests, reservations, waitlist, and service
operations for TableYeah.

## Tech Stack

- Expo (React Native)
- TypeScript
- Expo Router

## Requirements

- Node.js 18+ (or latest LTS)
- npm
- Expo CLI (via `npx`)

## Setup

```bash
npm install
```

## Environment Variables

Copy the example file and fill in the values:

```bash
cp .env.example .env
```

## Run

```bash
npx expo start
```

Follow the CLI prompts to open on iOS, Android, or web.

## Scripts

```bash
npm run lint
```

## Project Structure

- `app/` - routes and screens (Expo Router)
- `components/` - reusable UI components
- `lib/` - API, hooks, types, realtime, state
- `constants/` - theme and constants

## Notes

- Keep `.env` local; commit `.env.example` only.
