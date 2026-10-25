# API reference

The API is served from the same origin as the built frontend under `/api`. JSON is used for request and response bodies. Protected endpoints require `Authorization: Bearer <access-token>`. Access tokens expire after eight hours.

## Authentication

### `POST /api/auth/register`

Public. Request:

```json
{ "name": "Taylor Driver", "email": "taylor@example.com", "password": "a-unique-password-12" }
```

Returns `201` with `{ "user": { "id", "name", "email", "role" } }`. Public registration always creates a `user` role. Returns `400` for invalid input and `409` for a duplicate email.

### `POST /api/auth/login`

Public. Request: `{ "email": "taylor@example.com", "password": "a-unique-password-12" }`.

Returns `200` with `{ "token": "...", "user": { "id", "name", "email", "role" } }`. Invalid credentials return a generic `401`; authentication routes are rate limited.

### `GET /api/auth/me`

Authenticated. Returns the current public user object. Missing, invalid, or expired tokens return `401`.

## Inventory

Every inventory endpoint requires authentication unless stated otherwise. Vehicle JSON fields include `id`, `make`, `model`, `category`, `price` (INR), `quantity`, `createdAt`, `updatedAt`, and optional nullable specifications: `bodyType`, `year`, `fuelType`, `transmission`, `seatingCapacity`, `mileageKmpl`, `electricRangeKm`, `engineCapacityCc`, `groundClearanceMm`, and `safetyFeatures`. Unknown specifications are `null`, not inferred.

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

### `GET /api/vehicles/{id}`

Returns `{ "vehicle": ... }` or `404` if missing.

### `POST /api/vehicles` — administrator

Request:

```json
{ "make": "Volvo", "model": "XC60", "category": "SUV", "price": 3990061.66, "quantity": 3, "fuelType": "hybrid", "seatingCapacity": 5 }
```

Returns `201` with the created vehicle. Prices are INR, finite, and positive; quantity must be an integer from 0 through 1,000,000. Specifications are optional. Fuel type is `petrol`, `diesel`, `electric`, `hybrid`, `cng`, or `lpg`; transmission is `automatic` or `manual`.

### `PUT /api/vehicles/{id}` — administrator

Accepts the same complete vehicle fields as creation and returns the updated vehicle. Returns `404` if missing and `400` for invalid input.

### `DELETE /api/vehicles/{id}` — administrator

Returns `204` on deletion, `404` if missing, or `409` if historical purchases reference the vehicle.

### `POST /api/vehicles/{id}/purchase`

Authenticated user. Purchases one unit. Returns:

```json
{
  "vehicle": { "id": "...", "quantity": 2 },
  "purchase": {
    "id": "...", "vehicleId": "...", "quantity": 1,
    "unitPrice": 3990061.66, "totalAmount": 3990061.66
  }
}
```

The stock decrement and historical price snapshot are committed atomically. Returns `404` for a missing vehicle or `409` when stock is exhausted. A failed operation does not create a purchase record.

### `POST /api/vehicles/{id}/restock` — administrator

Request: `{ "quantity": 5 }`. The quantity must be a positive integer. Returns `{ "vehicle": ... }`, `404` if missing, or `400` if invalid or if the maximum inventory quantity would be exceeded.

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
- `429`: authentication or AI Car Finder rate limit exceeded.
- `500`: generic internal error; stack traces are not sent to clients.

The static OpenAPI 3.0 contract is in [`openapi.yaml`](./openapi.yaml). Swagger UI is not bundled.
