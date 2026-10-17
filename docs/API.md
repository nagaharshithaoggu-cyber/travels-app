# Traverse Elite API

The development server is `http://localhost:4000`. All request/response bodies are JSON. `GET /api/health` is public. Authenticated endpoints accept `Authorization: Bearer <JWT>`. The token has a 12-hour lifetime. Admin routes additionally enforce the `ADMIN` role on the server.

## Authentication

### `POST /api/auth/register`

Request: `{ "name": "Alex Morgan", "email": "alex@example.test", "phone": "+1 555 555 0100", "password": "at-least-10-chars" }`. Supply at least one of email or phone.

Returns `201 { "user": { "id", "name", "email", "role" }, "token": "..." }`. Duplicate email returns `409`; invalid input returns `400`.

### `POST /api/auth/login`

Request: `{ "identifier": "alex@example.test", "password": "..." }` (or use `email` for older clients). `identifier` may be the registered email or phone number. Returns `{ "user": ..., "token": "..." }`. Invalid credentials return `401`.

`GET /api/auth/me` returns the caller’s account. `PATCH /api/auth/profile` accepts `{ "name": "...", "phone": "..." }`.

### Password reset

`POST /api/auth/forgot-password` accepts `{ "email": "..." }` and returns a non-enumerating response after attempting email delivery. SMTP must be configured or the endpoint returns `503 EMAIL_NOT_CONFIGURED`. Mail delivery failures are logged without account details or reset tokens. `POST /api/auth/reset-password` accepts `{ "token": "...", "password": "at-least-10-chars" }`. Reset tokens are single-use and expire after 30 minutes.

## Search

The UI uses independent typed search routes and records:

- `GET /api/trains/search?origin=Hyderabad&destination=Vijayawada&date=YYYY-MM-DD&passengers=1` supports `travelClass`, `operator`, `maxFareMinor`, `maxDurationMin`, departure-hour bounds, and `sort`.
- `GET /api/buses/search?...` supports the common options plus `busType` and `amenity`.
- `GET /api/flights/search?...` supports the common options plus `stops` and optional `returnDate`.
- `GET /api/trains/:id`, `GET /api/buses/:id`, and `GET /api/flights/:id` return type-specific details.
- `GET /api/locations/search?q=...` returns place candidates; `GET /api/locations/reverse?lat=...&lon=...` returns a readable place name. Both use the configured Nominatim-compatible geocoder.
- `GET /api/locations/nearby?lat=...&lon=...&radius=3000` returns nearby food courts, restaurants, cafes, pharmacies, and medical shops sorted by calculated distance. Radius is 500–10,000 metres. With `GOOGLE_PLACES_API_KEY` set, the server uses Google Places API (New) and returns provider-published ratings, review counts, current opening status/hours, Maps links, and photos where available. The key stays server-side; photo requests are proxied through the rate-limited, non-caching `GET /api/locations/photo?name=...` route. Enable Places API (New) and billing in Google Cloud before configuring the key, and follow Google's display/attribution requirements; Google results are presented in the attributed list and are not overlaid on the OpenStreetMap map. Without that key, the API uses `NEARBY_API_URL` as its primary Overpass endpoint, then tries public Overpass mirrors if a request fails. OSM returns mapped details such as HTTPS image tags and published opening-hours strings, and does not provide dependable ratings, review counts, current opening status, or medicine stock. Provider failures return an error instead of a successful empty result. The OSM response includes its snapshot timestamp when available. Location search uses the configured Nominatim-compatible geocoder, so the UI can offer manual search when browser location permission is unavailable. Follow each provider's usage policy.

Dates use `YYYY-MM-DD` in these typed search routes. Origin and destination must differ; results must match the selected transport type, route, date, and passenger count. No-match searches return an empty `offers` array. Demo fixtures are not verified live transport schedules.

### `GET /api/offers`

Required query: `type=TRAIN|BUS|FLIGHT`, `origin`, `destination`, `date` (ISO 8601 timestamp). Optional: `passengers` (1–9, default 1), `sort=price|departure|duration`.

Returns `{ "offers": [...], "mode": "DEMO", "currency": "INR" }`. Offer `priceMinor` is integer paise. All seeded offers have `demo: true`. `GET /api/offers/:id` returns a single offer. In `APP_MODE=live`, search currently returns `503 LIVE_PROVIDER_UNAVAILABLE` until an authorized adapter exists.

## Bookings

`POST /api/bookings` requires an authenticated user and an `Idempotency-Key` header (8–120 characters). Request:

```json
{
  "offerId": "offer-id",
  "passengerName": "Alex Morgan",
  "passengerEmail": "alex@example.test",
  "passengerPhone": "+1 555 555 0100",
  "seatCode": "S1",
  "passengers": [{ "name": "Alex Morgan", "age": 30 }]
}
```

Returns a pending demo booking and an initiated payment. Inventory is decremented transactionally and a selected seat cannot be claimed by another active booking. Repeated requests with the same user/key replay the existing booking. `409` indicates a conflict or inventory change.

- `GET /api/bookings` lists the current user’s bookings (20 per page; optional `page`).
- `GET /api/bookings/:reference` returns only the owner’s booking (admins may view all).
- `POST /api/bookings/:reference/demo-payment` is a server-side **demo-only** simulation; it verifies a test payment and confirms the booking. No card information is accepted.
- `POST /api/bookings/:reference/gift` accepts `{ "giftChoice": "welcome"|"trail"|"celebration" }` for the authenticated owner of a confirmed, paid demo booking before departure. It saves the demo choice in the nullable `Booking.giftChoice` field. It does not create or fulfil a real product order; live fulfilment is unavailable until an authorized provider is integrated.
- `POST /api/bookings/:reference/cancel` cancels an eligible booking before departure. In demo mode, a verified payment becomes `DEMO_REFUNDED`; no money is transferred.

## Admin and reviews

- `GET /api/admin/stats` returns totals, verified demo payment amount, recent booking summaries and status counts.
- `GET /api/admin/users?page=1` lists redacted account fields.
- `PATCH /api/admin/users/:id/role` accepts `{ "role": "USER"|"ADMIN" }`.
- `GET /api/admin/providers` returns configured provider records and the app mode.
- `GET /api/admin/offers?page=1` lists demo and provider offers (50 per page).
- `POST /api/admin/offers` creates a demo listing with transport type, provider/code, route, ISO departure/arrival, duration, paise fare, class, capacity, availability, stops and amenities. Arrival/departure and capacity are validated. It is disabled in live mode.
- `PATCH /api/admin/offers/:id` updates demo fare (`priceMinor`), available places, and/or class. Available places cannot exceed capacity. It is disabled in live mode.
- `POST /api/reviews` accepts `{ "rating": 1..5, "comment": "..." }`.

There is no OpenAPI-generated client or live transport supplier implementation yet. Transport fares, schedules, seat inventory, and availability are demo fixtures; ratings and transport reviews are not connected to offer records. All failures use `{ "error": "...", "code": "..." }`; request validation failures additionally include `{ "details": [{ "path": "...", "message": "..." }] }`.
