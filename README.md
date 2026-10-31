# SY Delusha · Guest app

A phone web app for friends and family aboard SY Delusha. No app store, no build step.

## Who does what

| Person | How they get in | What they can do |
|---|---|---|
| **Guest** | Personal invite link (or QR code) from a host | See today's plan, weather, the voyage map, menus; share photos; fill in preferences; read the safety briefing; ask for laundry or report cabin issues |
| **Host** (Nizar, Deana, Lutfi, Sharif) | Email and password | Everything guests can, plus: create trips, add guests and cabins, publish the day's plan, edit the route and tender points, send alerts, post menus, share the yacht's position, manage logins |
| **Crew** (chef, chief stewardess) | Email and password | See and handle requests, read guest preferences, post menus |

First sign-in for hosts and crew: a host adds their email under **Host → Hosts and crew logins**, then they tap **"First time? Set your password"** on the sign-in screen.

## Features

- **Today**: day and status, live weather and sea temperature (Open-Meteo), "next up" card, schedule, walking directions to the tender.
- **Itinerary editing (hosts)**: add a stop by searching its name (OpenStreetMap), dropping a pin on the map, or using GPS — no coordinates needed.
- **Voyage**: offline Mediterranean chart with routing around land, live position from a host phone, itinerary, port guides, logbook.
- **Photos**: full-quality uploads (photos up to 2560 px, videos up to 50 MB) shared with everyone on the trip; uploads wait and send by themselves when signal returns; favourites; save to phone; Saloon TV slideshow; keepsake poster.
- **Dining**: daily menus with automatic allergy checks; notes to the chef.
- **Aboard**: Wi-Fi QR code, crew, water toys, notifications, requests.
- **Preferences** (3 steps): food and drink → cabin (pillow, temperature, seasickness, health, specific requests) → safety briefing.
- **Requests**: laundry, ironing, dry cleaning and cabin issues (with photo and urgent flag) go to the crew; the chief stew can mark "Tell the captain".
- **Alerts**: push notifications (on iPhone, the app must be added to the home screen first).

## Technical

- Static site: `index.html`, `styles.css`, `js/` (ES modules), `sw.js` (offline + notifications).
- Backend: Supabase project `delusha-voyage` (Frankfurt). Schema and security rules in `supabase/migrations/`; server functions in `supabase/functions/` (`guest-session`, `staff-account`, `notify`).
- Every table has row-level security: guests only see their own trip and their own requests; only hosts can read invite links, send alerts or change the trip.
- `coastline-data.js` + `router-worker.js`: offline coastline and sea routing (unchanged from v1).

## Run locally

```bash
npm start
```

Then open http://localhost:3030.

## Tests

```bash
npm test
```

Uses Playwright and a local stand-in for Supabase (`tests/supabase-mock.js`), so it never touches real data.

## Deploy

Any static host works (Vercel config included). Point `voyage.sydelusha.com` at it. Push notifications and the camera need HTTPS.
