# Roof Calculator Backend

Node.js + Express API for the static ERP calculator frontend. PostgreSQL is expected to be hosted by Neon, and Prisma reads the database URL from `backend/.env`.

## Local Neon Setup

```powershell
cd E:\Desktop\duplicate\backend
copy .env.example .env
```

Edit `backend\.env` manually and set your Neon connection string. Do not put the real value in `.env.example`, source code, logs, screenshots, issues, or chat messages.

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST.neon.tech/DB?sslmode=require"
JWT_SECRET="replace-with-a-long-random-secret"
JWT_EXPIRES_IN="8h"
PORT=3001
CORS_ORIGIN="http://127.0.0.1:5173,http://localhost:5173"
```

Neon connection notes:

- Keep `sslmode=require`.
- If Neon gives you `channel_binding=require`, keep it in the URL.
- For local migrations, prefer the direct non-pooler Neon URL.
- A pooled URL with `-pooler` in the host is fine for normal API runtime if Neon provides it.
- `backend/.env` and `backend/node_modules/` are ignored by git.

Install and prepare Prisma:

```powershell
npm install
npx prisma validate
npx prisma generate
npx prisma migrate dev --name init
```

Create or reset the initial administrator account:

```powershell
npm run admin:create -- --username=admin --password="ChangeThisPassword123" --displayName="Administrator"
```

You can also set `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_DISPLAYNAME` in the shell instead of passing flags. The password is stored with bcrypt; the real password and `JWT_SECRET` must stay out of git.

Start the local API:

```powershell
npm run dev
```

Production-style local run:

```powershell
npm start
```

## API

The current frontend `apiClient.js` calls these order endpoints:

```text
GET  /api/health
POST /api/auth/login
GET  /api/orders
GET  /api/orders/:id
POST /api/orders
PUT  /api/orders/:id
DELETE /api/orders/:id
```

All order endpoints require `Authorization: Bearer <token>`. `GET /api/health` and `POST /api/auth/login` are public.

`GET /api/orders?page=1&pageSize=100` returns a bounded page and a `pagination` object containing `page`, `pageSize`, `total`, and `totalPages`. `pageSize` is capped at 100. A request without pagination parameters keeps the legacy all-orders response for rolling-deployment compatibility; the current frontend always uses paginated synchronization.

Response shapes:

```json
{ "ok": true, "service": "roof-calculator-api" }
```

```json
{ "orders": [] }
```

```json
{ "order": { "id": "...", "orderNo": "..." } }
```

`POST /api/orders` generates the server `id`, `orderNo`, `createdAt`, and `updatedAt`. It stores the frontend id, or an explicit `clientOrderId`, as `clientOrderId` for idempotent create retries. `PUT /api/orders/:id` updates an existing server order while preserving `orderNo` and `clientOrderId`.

## Manual curl Tests

Run these after `npm run dev`:

```powershell
curl.exe http://127.0.0.1:3001/api/health
$login = curl.exe -s -X POST http://127.0.0.1:3001/api/auth/login `
  -H "Content-Type: application/json" `
  -d "{\"username\":\"admin\",\"password\":\"ChangeThisPassword123\"}" | ConvertFrom-Json
$token = $login.token
curl.exe http://127.0.0.1:3001/api/orders -H "Authorization: Bearer $token"
curl.exe -X POST http://127.0.0.1:3001/api/orders `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $token" `
  -d "{\"orderDate\":\"2026-05-30\",\"customerName\":\"Neon Test Customer\",\"totals\":{\"areaTotal\":1,\"mainAmount\":10,\"accessoryAmount\":0,\"steelAmount\":0,\"otherTileAmount\":0},\"items\":{\"mainRows\":[],\"accessories\":[],\"steels\":[],\"otherTiles\":[]}}"
curl.exe http://127.0.0.1:3001/api/orders -H "Authorization: Bearer $token"
```

## Confirm Neon Writes

Open the Neon SQL Editor and run:

```sql
select "orderNo", "orderDate", "customerName", "createdAt"
from "orders"
order by "createdAt" desc
limit 10;
```

If the test order includes a delivery address and coordinates, also run:

```sql
select o."orderNo", o."customerName", m."sourceAddress", m."lng", m."lat"
from "orders" o
left join "map_location_caches" m on m."id" = o."mapLocationCacheId"
order by o."createdAt" desc
limit 10;
```

The write is confirmed when `POST /api/orders` returns `{ "order": ... }`, the next `GET /api/orders` includes the same order, and the Neon SQL Editor shows the row in `orders`.

## Frontend Local API Test

When the backend is running on port `3001`, set the API base before using the page:

```js
window.ERP_API_BASE_URL = "http://127.0.0.1:3001/api";
window.ERP_ADMIN_USERNAME = "admin";
```

Save one order, refresh the page, and confirm the order is still loaded from the API. Then stop the backend and confirm the frontend still uses the existing localStorage fallback.
