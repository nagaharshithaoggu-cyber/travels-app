# TRAVERSE ELITE

A responsive travel discovery and booking demo built with React, Vite, TypeScript, Express, Prisma and SQLite. Demo transport listings, bookings, and simulated payments are marked as such throughout the UI and API. **No live train, bus, flight, ticketing, or payment provider is connected.**

## Requirements

- Node.js 20 or later
- npm (on Windows PowerShell, use `npm.cmd` if PowerShell blocks `npm.ps1`)

## Windows PowerShell setup

```powershell
npm.cmd install
Copy-Item .env.example .env
# Edit .env and replace JWT_SECRET with a unique random string of at least 32 characters.
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run dev
```

Open the frontend at <http://localhost:5173>. The API health endpoint is <http://localhost:4000/api/health>. To build the frontend and compiled API, run `npm.cmd run build`; run tests with `npm.cmd test`.

If Prisma reports that the SQLite database does not exist during migration, the migration command creates it. The development database is `prisma/dev.db`. Do not commit `.env` or database files.

## Demo accounts

- Traveler: `traveler@traverse.test` / `TraverseDemo!2026`
- Administrator: `admin@traverse.test` / `TraverseAdmin!2026`

The seed command creates or updates these local demo accounts. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` before seeding to choose the bootstrap admin credentials. Do not use the example passwords outside a local demo.

## What works

- Responsive landing page, destinations, separate train/bus/flight searches, demo results, filters and sorting.
- Browser geolocation (only after user action), interactive OpenStreetMap map selection, place search/reverse geocoding, and nearby mapped transport stops, food places and pharmacies. Precise location is sent only for the requested lookup and is not saved as history; nearby map coverage is not real-time service status.
- Registration and login by email or mobile number with bcrypt password hashing, signed bearer tokens, rate-limited auth, profile edits, and a single-use password-reset token flow.
- Demo booking reservation with server-side inventory decrement, idempotency keys, unique seat assignment, booking ownership checks, server-triggered simulated payment verification, and eligible cancellation/refund state.
- Confirmed demo-booking hamper previews with a saved, owner-authorized selection; no products are sold or fulfilled.
- Personal bookings and printable demo confirmations/receipts.
- Admin-only statistics, user/role management, demo itinerary creation and editable demo fare/availability, and provider status overview.
- Validated JSON API, centralized errors, Helmet security headers, CORS origin configuration, and a relational Prisma schema with audit and booking records.
- Demo fixtures for trains, buses and flights. Database fare fields use integer paise (minor units); journey times are stored as UTC timestamps and rendered in the browser’s local time zone.

## API overview

The API is proxied by Vite at `/api` in development. See [docs/API.md](./docs/API.md) for request and response details.

| Area | Routes |
| --- | --- |
| Health | `GET /api/health` |
| Account | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `PATCH /api/auth/profile`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password` |
| Travel | `GET /api/destinations`, `GET /api/offers`, `GET /api/offers/:id`, `GET /api/trains/search`, `GET /api/buses/search`, `GET /api/flights/search`, `GET /api/locations/search`, `GET /api/locations/reverse`, `GET /api/locations/nearby`, `GET /api/locations/photo` |
| Bookings | `POST /api/bookings`, `GET /api/bookings`, `GET /api/bookings/:reference`, `POST /api/bookings/:reference/demo-payment`, `POST /api/bookings/:reference/gift`, `POST /api/bookings/:reference/cancel` |
| Reviews | `POST /api/reviews` |
| Admin | `GET /api/admin/stats`, `GET /api/admin/users`, `PATCH /api/admin/users/:id/role`, `GET /api/admin/providers`, `GET /api/admin/offers`, `POST /api/admin/offers`, `PATCH /api/admin/offers/:id` |

All private endpoints require `Authorization: Bearer <token>`. Booking creation requires an `Idempotency-Key` header. API errors use JSON `{ "error": "...", "code": "..." }`; validation errors also include a `details` list.

## Database and migrations

The checked-in Prisma schema is configured for SQLite for a quick local start (`DATABASE_URL="file:./dev.db"`). To use PostgreSQL in a deployment, change the Prisma datasource provider to `postgresql`, set `DATABASE_URL` to the private connection string, regenerate the client, and create/apply migrations for that database. The SQLite migration history is not a PostgreSQL migration; validate and create provider-specific migrations before production. Keep credentials in the deployment secret manager.

Commands:

```powershell
npm.cmd run db:generate
npm.cmd run db:migrate -- --name describe_change
npm.cmd run db:deploy
npm.cmd run db:seed
```

`db:deploy` applies checked-in migrations, including the additive nullable gift-choice field; existing bookings and other data are retained.

## Production deployment outline

Use a supported PostgreSQL service, configure secrets (including a unique `JWT_SECRET`, SMTP and provider settings) in the deployment secret manager, and run reviewed provider-specific migrations with `npm run db:deploy` from a controlled deployment job. Build with `npm ci` followed by `npm run build`; run the API with `npm start` using Node.js 20+. Host the generated `dist/` assets on a TLS-enabled static host/CDN and proxy `/api` to the API service with the correct `CLIENT_ORIGIN`. Run `npm run db:seed:prod` only for a deliberate bootstrap, after setting a strong `ADMIN_EMAIL` and `ADMIN_PASSWORD`; remove demo credentials and records before opening the service to users. Configure provider/payment adapters only after completing the production readiness items below. `npm run preview` is a local build preview, not a production server.

## Provider and payment integrations

`server/provider.ts` is the search boundary. Demo mode is the only implemented provider; it reads seeded records from the local database. Set `APP_MODE=live` to disable demo search/booking, but this does **not** connect a live supplier: search returns an explicit unavailable response and booking refuses to confirm. The optional provider key variables in `.env.example` are placeholders and are not consumed by an integration.

Place search and reverse geocoding use the Nominatim-compatible service at `GEOCODING_API_URL` (default OpenStreetMap Nominatim). Nearby mapped stops and amenities use `NEARBY_API_URL` (default OpenStreetMap Overpass); follow the selected service's usage policy and configure a suitable hosted service for production scale. OpenStreetMap does not reliably provide venue ratings, review counts, pharmacy stock, or medicine availability. See the transport-specific routes and location response shapes in [docs/API.md](./docs/API.md).

Before enabling live service, implement and verify authorized train/bus/flight adapters, signed payment webhooks/provider verification, provider revalidation and booking confirmation, cancellation/refund handling, monitoring, privacy review, and provider-specific tests. Never treat a browser response as proof of payment or reservation. The demo payment endpoint is restricted to demo mode.

Password reset tokens are hashed in storage and expire in 30 minutes. Password reset requires SMTP settings (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`); without them, the API returns `EMAIL_NOT_CONFIGURED` and never logs or returns reset tokens. Auth uses bearer tokens stored client-side for this demo; production should use an appropriately configured secure, HTTP-only cookie/session strategy and CSRF protection where needed.

## Limitations

- Search fixtures cover a small set of future route/date combinations; transport schedules, fares, operators, and availability are fictional demonstration data, not current availability or real fares.
- Transport-provider ratings and reviews, nearby-business ratings, medicine inventory, live operating status, and real hamper fulfilment are not connected. Nearby data is an OpenStreetMap snapshot, not a live operational feed; gift choices are stored only as demo booking selections.
- Round-trip search, provider-specific station/airport autocomplete, live seat maps, real inventory locks across multiple providers, actual ticket issuance, refunds, customer email, and production payment integration are not connected.
- The admin UI provides summary/provider visibility, user-role controls and editable demo fare/availability. Full route/station, coupon, destination and support-content management is not implemented.
- The database contains foundational provider, station, coupon, passenger, payment, refund, review, notification and audit models; operational screens/workflows for all these records are not complete.
- Do not deploy the demo credentials, local token storage, in-memory auth rate limiter, or SQLite configuration as-is for a production booking service.
