# SY Delusha · Guest Voyage & Companion App — Product Requirements Document (PRD) & Technical Sheet

> **Document Version:** `v1.2` (Apple.com Design System + Official Delusha Branding & Beauty Shots)  
> **Target Vessel:** **SY Delusha** · 43.0m (141 ft) Pedigree Sailing Superyacht  
> **Workspace Path:** `C:\Users\Nizar\.gemini\antigravity\scratch\delusha-guest-voyage`  
> **Production Target:** `https://voyage.sydelusha.com` (**$0/month** operating cost)

---

## Part I — Product Requirements Document (PRD)

### 1. Executive Summary & Product Vision
Throughout the Mediterranean cruising season, different charter and owner guest groups embark aboard **SY Delusha** (43m sailing yacht). Traditionally, guest trip information (daily schedules, anchorages, tender pick-up locations, Wi-Fi passwords) is communicated verbally or via scattered messages, while trip photos and videos become compressed over WhatsApp or siloed across individual iPhones and Android devices.

The **SY Delusha · Guest Voyage & Companion App** solves these problems in a single, zero-friction, offline-first Progressive Web App (PWA) crafted with an **Apple.com editorial aesthetic**:
1. **Live Onboard Companion:** Gives guests instant clarity on where the yacht is anchored today, weather and sea temperatures, the day’s schedule, interactive passage routes, curated Mediterranean port mini-guides, one-tap walking directions to the tender pick-up pier, crew bios, water toys, and Starlink Wi-Fi.
2. **Private Shared Photo & Video Hub:** Enables every guest and crew member on a specific voyage to upload full-HD photos and video clips that automatically group by port/day, pin onto the interactive voyage chart, play on the Saloon TV in ambient slideshow mode, and queue offline when anchored in remote coves without signal.
3. **Permanent Voyage Keepsake:** Generates a high-resolution, printable **1200×1600 End-of-Trip Souvenir Poster** featuring the official Delusha logo, custom Mercator route map, nautical miles sailed, peak sailing speed, and Captain’s logbook highlights.

---

### 2. User Personas & Core Use Cases

| Persona | Primary Devices | Key Goals & Jobs-to-Be-Done |
| :--- | :--- | :--- |
| **Embarking Guest** | iPhone / Android Mobile Safari & Chrome | Scan a single QR code in the saloon on Day 1 without downloading an app store binary or creating an account; join onboard Starlink Wi-Fi in one tap; learn crew names and water toys available. |
| **Guest Ashore** | iPhone / Android on Cellular or Offline | Check what time dinner or tender transfer is scheduled; read local history/highlights of the current island; tap **"📍 Walk to Tender Pick-Up"** to navigate back to the exact stone quay where Delusha’s tender waits. |
| **Guest / Crew Photographer** | iPhone / iPad / Android Camera Roll | Upload sailing and anchorage photos/videos at full HD quality without WhatsApp compression; vote `★` on favorite shots; download all voyage highlights in one tap at the end of the charter. |
| **Saloon Display / iPad** | Saloon Smart TV / Dedicated iPad | Run **Saloon TV Slideshow Mode** during evening cocktails or dinner, cycling through the voyage’s best photos, video clips, and live route map. |
| **Owner / Captain (Admin)** | iPad / MacBook / iPhone (`PIN: 1943`) | Create isolated **Voyage Passes** per guest group; update the morning "Today Aboard" briefing card; log daily nautical miles and peak speed under sail; drop live GPS coordinates for the tender pick-up pin in one tap. |

---

### 3. Multi-Voyage Privacy & "Voyage Pass" Architecture
* **Strict Trip Isolation:** Each charter or guest trip is assigned a unique **Voyage Code** (e.g., `DELUSHA-JULY-2026`, `DELUSHA-AUG-2026`). Guests scanning `?voyage=CODE` only see the itinerary, logbook stamps, and photo/video gallery belonging to their specific voyage.
* **Zero-Friction Onboarding:** Scanning the Saloon QR code automatically switches the active voyage pass and persists it locally—zero passwords, emails, or app-store friction.
* **Owner Master Archive:** Entering the Captain/Owner PIN (`1943` or `0000`) unlocks the master dropdown to switch between any past, current, or upcoming charter across the season.

---

### 4. Functional Requirements by Module

#### 4.1 Global Navigation Bar & Theme System (`index.html`)
* **Official Delusha Vector Branding:** Displays the official **Delusha `|D` Monogram** inside a rounded Apple icon crest alongside the vector **`D E L U S H A` Wordmark** and `43m Yacht` pill badge.
* **Active Voyage Pass Pill:** Shows a live green status indicator and the active pass code (`DELUSHA-JULY-2026`), opening the Saloon QR Pass & Trip Switcher modal on tap.
* **Apple Appearance Toggle (`Light` / `Dark`):** Defaults to **Apple.com Light Mode** (`#f5f5f7` canvas, `#ffffff` Bento cards) and toggles instantaneously to **Apple Pro Dark Mode** (`#000000` OLED canvas, `#1c1c1e` cards), re-rendering the Mercator chart palette in real time.

#### 4.2 Tab 1: Today & Voyage Map (`index.html`, `app.js`)
* **"Today Aboard" Morning Briefing Card:**
  * Displays active voyage dates, current anchorage/port headline, weather & wind summary, **Air Temp** chip, **Sea Water Temp** chip, and a primary **"📍 Walk to Tender Pick-Up"** CTA button.
  * Chronological daily schedule timeline (`HH:MM` tabular monospace timestamps + activity descriptions).
* **Interactive Apple Maps-Styled Mercator Voyage Chart:**
  * Powered by the offline Mediterranean water-routing Web Worker (`router-worker.js` + `coastline-data.js`), automatically routing around land masses, islands, the Bay of Kotor, and the Corinth Canal.
  * Visualizes **Completed Sailed Legs** (solid `#0071e3` Apple Blue track with white casing), **Planned Upcoming Legs** (dashed `#5856d6` Apple Indigo track), **Leg Distance Pills** (`nm`), and **Geotagged Photo/Video Pins** (`★` / `▶`).
  * Supports mouse drag, scroll-wheel zoom around cursor, single-finger pan, two-finger pinch-to-zoom, `+` / `−` / `FIT` floating frosted-glass controls, and live device geolocation (`📍 MY GPS`).
* **Voyage Totals Bento Strip:**
  * 4-column summary displaying **Total Route (`nm`)**, **Sailed So Far (`nm`)**, **Peak Sail Speed (`kn`)**, and **Stops Count**.
* **Interactive Itinerary & Port Spotlight Modal:**
  * Lists every stop in sequence with status badges (`Sailed`, `Anchored Today`, `Planned`), leg distance, and estimated passage duration at cruising speed.
  * Tapping any stop (in the list or directly on the chart canvas) centers the chart on that port and opens the **Port Spotlight Modal** containing curated maritime history, local atmosphere, ashore highlights, exact tender landing description, GPS coordinates, and a one-tap Google/Apple Maps walking directions link.
* **Captain’s Daily Logbook Stamps:**
  * Cards recording each day’s passage route, nautical miles sailed, peak boat speed under sail (`kn`), wind conditions, and Captain’s note (intentionally streamlined with no wine log).

#### 4.3 Tab 2: Shared Photos & Videos Hub (`index.html`, `app.js`)
* **Pre-Loaded Real SY Delusha Photography:** Seeded with high-resolution sailing, deck, and interior photography from `Delusha Beauty Shots/`.
* **Smart Client-Side Media Optimization:**
  * **Photos:** Resized via HTML5 Canvas to `1600px` max dimension and encoded at `0.84` JPEG quality (`~0.8–1.5 MB` HD), preserving crisp visual quality while preventing mobile memory or upload bottlenecks.
  * **Videos:** Extracts video metadata duration (`▶ 0:24`) and stores full clips locally in **IndexedDB** (`delusha_voyage_media_db`).
* **Offline Upload Queue & Auto-Sync:**
  * Displays real-time Starlink connection & sync status. Uploads performed offline in remote coves are badged `⏳ Queued Offline` and automatically marked `✓ Synced HD` when the browser fires the `online` event.
* **Filter Pills & Favorite Voting (`★`):**
  * Filter by `All Media`, `⭐ Best of the Voyage`, `▶ Videos`, or individual itinerary stops (`📍 Porto Montenegro`, `📍 Dubrovnik`, `📍 Korčula`).
  * One-tap **`⭐ Download All Highlights`** sequentially downloads all top-voted photos/videos to the guest’s device.
* **📺 Saloon TV Full-Screen Ambient Slideshow:**
  * Dedicated `tvOS`-inspired full-screen overlay that cycles every `4.5s` through all voyage media plus a live-rendered route overview slide, complete with `Prev`, `Pause/Play`, and `Next` controls.
* **🖼️ 1200×1600 End-of-Trip Souvenir Poster Generator:**
  * Renders a high-resolution, print-ready `1200×1600` PNG poster on an HTML5 Canvas featuring the official vector **Delusha (`|D` + `DELUSHA`)** logo, custom Mercator route chart, 4 Bento summary cards, port chain, and Captain’s logbook highlights.

#### 4.4 Tab 3: Meet the Crew (`index.html`, `voyage-data.js`)
* **6 Onboard Crew Profiles:** Captain, Chief Officer, Executive Chef, Chief Stewardess, Chief Engineer, and Deckhand & Watersports Lead.
* Displays vector monogram portrait avatars, role badge, full name, nationality flag, languages spoken, and personal maritime bio.

#### 4.5 Tab 4: The Yacht, Water Toys & Life Aboard (`index.html`, `voyage-data.js`)
* **Starlink Wi-Fi Instant Card:** One-tap `Copy` buttons for SSID (`SY_Delusha_Starlink`) and Password (`SailsUp2026!`) plus an auto-generated **Wi-Fi QR Code** (`WIFI:T:WPA;S:...`) so guests can point their iPhone/Android camera to join Wi-Fi immediately.
* **Water Toys & Tender Locker (8 Cards):** 6.2m Custom 150 HP Rib Tender, 2× Seabob F5S, Lift3 eFoil, 4× Teak Paddleboards, Wakeboard & Water-Skis, NautiBuoy Floating Sea Lounge, Snorkeling/Dive Locker, and Offshore Fishing Gear.
* **About SY Delusha (43m) & Real Beauty Shots Gallery:**
  * Displays the official stacked **Delusha** vector logo, vessel summary, **11 saveable high-resolution photographs** of SY Delusha under sail, at anchor, on deck, and inside the panoramic deckhouse saloon, plus 8 principal technical specifications.
* **Cabin & Life Aboard Etiquette Guide:** 4 cards covering barefoot/soft deck-shoe care for Burmese teak decks, marine vacuum heads, lifejacket safety, and spray-sunscreen care.

#### 4.6 Owner / Captain Admin Console (`index.html`, `app.js`)
* Unlocked via PIN `1943` (or `0000`).
* **Master Voyage Switcher & New Voyage Creator:** Switch between archived charters or generate a new Voyage Pass with an instant printable Saloon QR code.
* **"Today Aboard" Briefing Editor:** Live-edit current anchorage, weather, air/sea temperatures, and `HH:MM | Activity` schedule lines.
* **Daily Logbook Stamp Creator:** Add new daily passage stamps (`Day`, `Route`, `Distance nm`, `Peak Speed kn`, `Wind`, `Note`).
* **Itinerary Stop Editor & One-Tap Tender GPS Pin:** Add any of the **66 Mediterranean preset ports** to the route, reorder/remove stops, edit tender pier names, or tap **`📍 Drop My GPS as Tender Pin`** while standing on the jetty to capture exact device GPS coordinates.
* **Crew Roster Toggles & Cloud Sync Hooks:** Toggle which crew members are currently onboard and configure optional Supabase + Google Drive endpoints.

---

## Part II — Technical Architecture & Engineering Sheet

### 1. Workspace File Inventory

| File / Directory | Size | Technical Responsibility |
| :--- | :---: | :--- |
| `index.html` | `35.1 KB` | Semantic HTML5 single-page application shell, inline official Delusha vector logos, 4 guest tab views, Captain Admin view, 5 modal sheets, and SVG navigation icons. |
| `styles.css` | `34.2 KB` | Apple.com Design System CSS variables (`light` default & `dark` Pro mode), `saturate(180%) blur(20px)` glassmorphism, `24px` Bento cards, `980px` pill buttons, and responsive split-screen media queries. |
| `app.js` | `91.4 KB` | Core application controller: Mercator projection math, multi-touch chart pan/pinch gestures, Web Worker bridge, IndexedDB media store, client JPEG optimizer, custom QR matrix renderer, Souvenir Poster `Path2D` renderer, and Admin state machine. |
| `voyage-data.js` | `56.8 KB` | Static dataset of **66 Mediterranean ports** (with curated atmosphere, history, highlights, and tender GPS coordinates), SY Delusha specifications, 11 real photography paths, 8 water toys, 6 crew profiles, and 2 pre-seeded voyages. |
| `coastline-data.js` | `346.0 KB` | Delta-encoded Mediterranean coastline polygon rings (`self.MED_COASTLINE_DELTA`) used for both 60fps HTML5 Canvas land rendering and land-collision avoidance. |
| `router-worker.js` | `21.3 KB` | Dedicated background Web Worker executing multi-resolution grid water routing, point-in-polygon land masks, Corinth Canal & Boka Kotorska narrow-strait corridors, and line-of-sight path smoothing. |
| `delusha-logo.svg` | `4.3 KB` | Official stacked **Delusha (`|D` + `DELUSHA`)** vector logo extracted from the master CorelDRAW/Illustrator brand files. |
| `icon.svg`, `icon-192.png`, `icon-512.png` | `455 KB` | Official Delusha `|D` Monogram PWA app icons for iOS Safari `Add to Home Screen` and Android Chrome installation. |
| `Delusha Beauty Shots/` | `~3.8 MB` | 11 high-resolution photographs (`IMG-20250617-WA0008.jpg` – `WA0018.jpg`) of SY Delusha under sail, at anchor, on deck, and inside the saloon. |
| `manifest.webmanifest` & `sw.js` | `2.0 KB` | W3C Web App Manifest (`display: standalone`) and Cache-First Service Worker (`delusha-voyage-v4`). |
| `vercel.json` & `package.json` | `0.4 KB` | Zero-build static deployment configuration and `no-cache` headers for `/sw.js`. |

---

### 2. Core Engineering Subsystems

1. **Spherical Mercator Projection & 60 FPS Coastline Culling:**
   * All delta-encoded rings in `self.MED_COASTLINE_DELTA` are decoded once at boot into `Float32Array` Mercator coordinates with precomputed bounding boxes (`minX, maxX, minMY, maxMY, span`).
   * On each animation frame, off-screen rings and sub-pixel islands (`ring.span < view.degPerPx * 0.55`) are culled before a single batched `ctx.fill('evenodd')` draw call.
2. **Two-Tier Client Persistence (`localStorage` + `IndexedDB`):**
   * Lightweight trip metadata is stored in `localStorage` (`delusha_guest_voyage_state_v3`), while large guest-uploaded HD JPEG and video blobs are stored in `IndexedDB` (`delusha_voyage_media_db` / `uploaded_media`), avoiding the 5 MB `localStorage` quota limit.
3. **Apple.com Design System Tokens:**
   * **Light Mode (Default):** `#f5f5f7` canvas, `#ffffff` Bento cards, `#1d1d1f` primary typography, `#6e6e73` secondary grays, `#0071e3` Apple Blue accents, and `rgba(255, 255, 255, 0.78)` translucent blurred headers.
   * **Pro Dark Mode:** `#000000` OLED canvas, `#1c1c1e` cards, `#f5f5f7` primary text, and `#0a84ff` accents.
