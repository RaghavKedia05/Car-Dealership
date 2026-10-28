# API reference

The API is served from the same origin as the built frontend under `/api`. JSON is used for request and response bodies. Protected endpoints require `Authorization: Bearer <access-token>`. Access tokens expire after eight hours.

## Authentication

Customers and administrators use the same login endpoint and page. The API returns the assigned role, and the frontend routes the signed-in account accordingly. Public registration can create customer accounts only and requires email verification.

### `POST /api/auth/register`

Public. Request:

```json
{ "name": "Taylor Driver", "email": "taylor@example.com", "password": "a-unique-password-12" }
```

Starts registration by emailing a six-digit code. Returns `202` with a message; the account is not created and cannot sign in until the code is verified. Codes expire after 10 minutes, allow five attempts, and can be resent after one minute. Requires `RESEND_API_KEY` and `PASSWORD_RESET_FROM`. Returns `400` for invalid input, `409` if the email already has an account, and `503` if email delivery is not configured.

### `POST /api/auth/register/verify`

Public and rate limited. Request: `{ "email": "taylor@example.com", "code": "123456" }`. A valid code creates a customer account and returns `201` with `{ "token": "...", "user": { "id", "name", "email", "role" } }`, signing the customer in. Invalid, expired, or already used codes return `400`; five incorrect attempts lock the code.

### `POST /api/auth/login`

Public. Request: `{ "email": "taylor@example.com", "password": "a-unique-password-12" }`.

Returns `200` with `{ "token": "...", "user": { "id", "name", "email", "role" } }`. Invalid credentials return a generic `401`; authentication routes are rate limited.

### `GET /api/auth/me`

Authenticated. Returns the current public user object. Missing, invalid, or expired tokens return `401`.

### `POST /api/auth/logout`

Authenticated. Revokes the current token immediately and returns `204`. The client must sign in again to obtain a new token.

### `POST /api/auth/forgot-password`

Public and rate limited. Request: `{ "email": "taylor@example.com" }`. Always returns the same generic response so the endpoint does not reveal whether an email has an account. When Resend is configured on the API host, an account with that address receives a single-use reset link that expires after 30 minutes. Configure `RESEND_API_KEY`, `PASSWORD_RESET_FROM` (a verified sender), and `APP_ORIGIN` (the exact HTTPS frontend origin).

### `POST /api/auth/reset-password`

Public and rate limited. Request: `{ "token": "...", "password": "a-new-unique-password-12" }`. Consumes a valid, unexpired reset token, changes the password, and invalidates existing access tokens. Invalid or expired links return `400`.

## Customer account

All account routes require a customer access token.

- `GET /api/account` returns the signed-in customer's public profile.
- `PUT /api/account` accepts `{ "name": "Taylor Driver", "phone": "+1 555 0100", "deliveryAddress": "..." }` and saves contact and delivery details. Email is read-only.
- `GET /api/account/orders` returns paid purchase history and outstanding checkout reservations for that customer, including vehicle, amount, status, purchase time, delivery details, and payment reference when available.
- `POST /api/account/password` accepts `{ "currentPassword": "...", "newPassword": "..." }`, verifies the current password, changes it, and signs the customer into a new session while invalidating older tokens.

## Inventory

Authenticated customers can see listed vehicles only; administrators can also see unlisted records. Vehicle JSON fields include `id`, `make`, `model`, `category`, `price` (INR), `quantity`, `createdAt`, `updatedAt`, `status` (`listed` or `unlisted`), and optional nullable fields: `variant`, `description`, `imageUrl`, `bodyType`, `year`, `fuelType`, `transmission`, `seatingCapacity`, `mileageKmpl`, `electricRangeKm`, `engineCapacityCc`, `groundClearanceMm`, and `safetyFeatures`. Unknown specifications are not inferred. `imageUrl` accepts HTTPS links only; image upload and persistent image storage are not included.

### `GET /api/vehicles` and `GET /api/vehicles/search`

List catalog entries. Both routes support optional text filters `make`, `model`, `category`; optional `minPrice` and `maxPrice`; and pagination/sorting:

| Query | Default | Validation |
| --- | --- | --- |
| `page` | `1` | Positive integer |
| `pageSize` | `12` | Integer from 1 to 100 |
| `sortBy` | `createdAt` | `make`, `model`, `category`, `price`, or `createdAt` |
| `sortOrder` | `desc` | `asc` or `desc` |

Example: `/api/vehicles/search?make=Volvo&minPrice=25000&maxPrice=60000&page=1&pageSize=9&sortBy=price&sortOrder=asc`.

Returns `{ "vehicles": [...], "pagination": { "page", "pageSize", "total", "totalPages" } }`. Invalid filters, ranges, or pagination return `400`.

### `GET /api/public/vehicles` and `GET /api/public/vehicles/{id}`

Public, no account required. These routes expose listed vehicles only. The list accepts the regular catalogue filters plus `keyword` (searches make, model, variant, and description), `fuelType`, `transmission`, `minSeats`, and `sortBy=year`. The detail route returns `404` for missing or unlisted vehicles.

### `GET /api/vehicles/{id}`

Authenticated. Customers receive `404` for unlisted vehicles; administrators can read all inventory.

### `POST /api/vehicles` — administrator

Request:

```json
{ "make": "Volvo", "model": "XC60", "category": "SUV", "price": 3990061.66, "quantity": 3, "fuelType": "hybrid", "seatingCapacity": 5 }
```

Returns `201` with the created vehicle. Prices are INR, finite, and positive; quantity must be an integer from 0 through 1,000,000. Specifications are optional. Fuel type is `petrol`, `diesel`, `electric`, `hybrid`, `cng`, or `lpg`; transmission is `automatic` or `manual`.

### `PUT /api/vehicles/{id}` — administrator

Accepts the same complete vehicle fields as creation and returns the updated vehicle. Supports `variant`, `description`, `imageUrl`, and listing `status`. Returns `404` if missing and `400` for invalid input.

### `DELETE /api/vehicles/{id}` — administrator

Returns `204` on deletion, `404` if missing, or `409` if purchase or checkout history references the vehicle.

### `POST /api/vehicles/{id}/checkout`

Authenticated customer. Request buyer, delivery, and payment arrangement details: `{ "customerName": "Taylor Driver", "email": "taylor@example.com", "phone": "+1 555 0100", "deliveryAddress": "...", "paymentMethod": "dealership" }`. `paymentMethod` is `dealership` or `callback`. The server reads the current listed vehicle price, reserves one unit for up to 24 hours, and returns `201` with the pending order and updated vehicle. This records an order request only; it does not charge the customer or mark the order paid. Returns `409` if unavailable.

### `POST /api/checkout/{id}/cancel`

Authenticated owner of the checkout. Releases the reserved unit if the checkout is still pending. Returns `204`.

### `POST /api/vehicles/{id}/purchase` (retired)

Returns `410`. Submit an order through the checkout flow; direct stock decrement is disabled.

### `POST /api/vehicles/{id}/restock` — administrator

Request: `{ "quantity": 5 }`. The quantity must be a positive integer. Returns `{ "vehicle": ... }`, `404` if missing, or `400` if invalid or if the maximum inventory quantity would be exceeded.

## Customer enquiries

### `POST /api/enquiries`

Public with optional bearer authentication. Submits a general enquiry or one linked to a publicly listed vehicle:

```json
{
  "submissionKey": "cb7d8922-90ca-4caf-9588-58c91cdd225f",
  "customerName": "Alex Customer",
  "email": "alex@example.com",
  "phone": "+91 98765 43210",
  "subject": "Vehicle availability",
  "message": "Please let me know if this vehicle is available for a test drive.",
  "vehicleId": null
}
```

Returns `201` with the enquiry ID and initial status. `submissionKey` is a client-generated UUID used to prevent duplicate submissions. Duplicate keys return `409`; invalid requests return `400`; the selected vehicle must still be publicly listed. Authenticated submissions are associated with the account.

## Administrator dashboard

All administrator routes require an administrator token.

- `GET /api/admin/dashboard` returns database-backed inventory and enquiry metrics, grouped inventory, and recent records.
- `GET /api/admin/orders` returns up to 50 pending vehicle order requests with customer contact and delivery details.
- `PATCH /api/admin/orders/{id}` accepts `{ "status": "paid" }` only after the dealership receives payment, or `{ "status": "cancelled" }` to release the stock reservation. Paid orders are added to the customer's purchase history.
- `GET /api/admin/enquiries` accepts `status`, `search`, `page`, and `pageSize` filters and returns paginated enquiries.
- `GET /api/admin/enquiries/{id}` reads one enquiry.
- `PATCH /api/admin/enquiries/{id}` accepts `{ "status": "contacted" }`; supported states are `new`, `contacted`, `in_progress`, and `resolved`.

## Health

### `GET /healthz`

Checks API/database availability and returns `{ "status": "ok" }`.

## AI Car Finder

### `POST /api/ai/car-finder`

Authenticated. Request: `{ "query": "Family SUV under ₹20 lakh with at least five seats" }`. The query must contain 3–2,000 characters. Returns interpreted criteria, applied hard filters, available exact matches, and (when no exact result exists) alternatives that each relax one hard filter. The response identifies whether deterministic or configured provider parsing was used. Criteria are validated on the server; the model does not generate SQL. Unknown specification values are never invented.

Contradictory price requirements return `needsClarification: true` with a question and no recommendations. This route is rate limited.

### `POST /api/ai/car-finder/compare`

Authenticated. Request: `{ "vehicle_ids": ["<uuid>", "<uuid>"], "original_query": "family car" }`. Accepts two to three distinct current vehicle IDs and an optional original query (up to 2,000 characters). Returns current records, a comparison row for each recorded specification, missing values as `null`, and a concise comparison summary. Returns `404` if any ID is missing. This route is rate limited.

Deterministic parsing is the default and sends no query to a third party. To enable optional OpenAI-compatible interpretation, configure server-side `AI_PROVIDER=openai-compatible`, `AI_API_KEY`, and `AI_MODEL`; `AI_BASE_URL` optionally overrides the default API endpoint. When enabled, the user's search text is sent to that provider. Provider failures are logged and fall back to the deterministic parser with a warning in the response.

Migration 004 converts earlier USD inventory prices and purchase snapshots into INR using the documented 2026-10-25 USD/INR rate snapshot. Conversion is one-time and rounds to two decimal places.

## Common errors

- `400`: malformed JSON or request validation failure.
- `401`: authentication is missing, invalid, or expired.
- `403`: authenticated user lacks administrator privileges.
- `404`: requested API route or resource does not exist.
- `409`: email conflict, insufficient stock, or a vehicle with purchase history.
- `410`: retired direct-purchase endpoint; use the vehicle order checkout.
- `429`: authentication or AI Car Finder rate limit exceeded.
- `500`: generic internal error; stack traces are not sent to clients.

The static OpenAPI 3.0 contract is in [`openapi.yaml`](./openapi.yaml). Swagger UI is not bundled.
