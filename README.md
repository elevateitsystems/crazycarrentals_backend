# Crazy Car Rentals Backend

API for the Crazy Car Rentals service. Customers can search cars, estimate a rental, and book. Admins manage cars, drivers, users, and bookings.

Built with Node.js, Express 5, TypeScript, Prisma, and PostgreSQL. Passwords are hashed with bcrypt. Requests are validated with Zod. Authentication uses JWT. Car images are stored in MinIO.

## Prerequisites

- Node.js 18 or newer
- Yarn
- PostgreSQL
- MinIO

## Setup

```bash
yarn install
```

Create a `.env` file in the project root:

```env
NODE_ENV=development
PORT=4001

DATABASE_URL="postgresql://postgres:postgres@localhost:5432/crazycarrentals_DB?schema=public"

JWT_SECRET=replace-with-a-secret-at-least-32-characters
JWT_EXPIRES_IN=1d

STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET_NAME=crazycarrentals
MINIO_PUBLIC_URL=http://localhost:9000
```

`JWT_SECRET` must be at least 32 characters. `DATABASE_URL` is required.

Apply the database migrations, then start the API:

```bash
yarn db:migrate
yarn dev
```

The API listens on `http://localhost:4001` by default. `GET /` serves `public/index.html`. API routes are under `/api`.

## Scripts

| Command | Purpose |
|---------|---------|
| `yarn dev` | Run the TypeScript source with reload |
| `yarn build` | Compile to `dist/` |
| `yarn start` | Run the compiled server |
| `yarn db:migrate` | Create and apply a Prisma migration |

`yarn start` serves the last build. Run `yarn build` after source changes before starting it.

## Project structure

```
src/
├── app.ts                 # Express app, JSON body, public files, /api
├── server.ts              # Process entry, database and MinIO startup
├── config/                # Environment, Prisma, MinIO
├── routes/                # HTTP routes
├── controllers/           # Request handlers
├── services/              # Booking, car, driver, auth, and dashboard logic
├── validators/            # Zod schemas
├── middlewares/           # Auth, admin check, upload, validation, errors
└── utils/
prisma/
└── schema.prisma          # PostgreSQL models
public/                    # Page shown at /
```

## Auth

Protected routes expect:

```
Authorization: Bearer <token>
```

Roles are `USER`, `ADMIN`, and `SUPER_ADMIN`. Admin routes accept `ADMIN` or `SUPER_ADMIN`.

## Booking flow

1. Pick a car, dates, extras, and renter contact.
2. The driver shown on the booking is the driver assigned to that car. The renter does not enter a licence. A car with no assigned driver cannot be booked.
3. **Pay now** saves the booking as `PENDING`, holds the car for about 30 minutes, and returns a Stripe `clientSecret`. The website confirms the card with Stripe.js. The booking becomes `CONFIRMED` only after Stripe reports `payment_intent.succeeded`. Pay now includes a 9% discount. The price is charged in AUD.
4. **Pay at desk** confirms the booking immediately. The payment stays `PENDING_AT_DESK` until an admin collects it.
5. A confirmed booking becomes `COMPLETED` after its return date and time, or when an admin marks it complete. `isActive` is true only while the status is `CONFIRMED`.

Booking statuses: `PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED`.

Payment options: `PAY_NOW`, `PAY_AT_DESK`.

Price is the daily rate times the rental days, plus extras per day, plus a shuttle fee when selected. GST is included in the price.

## API

### Health and home

| Method | Path | Access |
|--------|------|--------|
| `GET` | `/` | Public status page |
| `GET` | `/api/health` | Public |

### Auth — `/api/auth`

| Method | Path | Access |
|--------|------|--------|
| `POST` | `/register` | Public |
| `POST` | `/login` | Public |
| `POST` | `/forget-password` | Public |
| `POST` | `/reset-password` | Public |
| `POST` | `/change-password` | Logged in |
| `PATCH` | `/profile` | Logged in. Optional avatar upload |
| `GET` | `/me` | Logged in |
| `GET` | `/users` | Admin |
| `GET` | `/user/:id` | Admin |
| `PATCH` | `/user/update/:id` | Admin |
| `DELETE` | `/user/delete/:id` | Admin |

### Cars — `/api/cars`

| Method | Path | Access |
|--------|------|--------|
| `GET` | `/` | Public |
| `GET` | `/search` | Public |
| `POST` | `/search` | Public |
| `GET` | `/:id` | Public |
| `POST` | `/add-new-car` | Admin. Multipart images |
| `PATCH` | `/update-car/:id` | Admin. Multipart images |
| `PATCH` | `/:id/assign-driver` | Admin. Body `{ "driverId" }` or `null` |
| `DELETE` | `/delete-car/:id` | Admin |

Search accepts `carType`, `transmission`, `fuelType`, `brand`, `searchTerm`, `minPrice`, `maxPrice`, `pickupDate`, `returnDate`, `pickupLocation`, `returnLocation`, `age`, `page`, and `limit`.

### Drivers — `/api/drivers`

All driver routes require an admin token.

| Method | Path |
|--------|------|
| `POST` | `/add` |
| `GET` | `/all` |
| `GET` | `/:id` |
| `PATCH` | `/update/:id` |
| `DELETE` | `/delete/:id` |

### Uploads — `/api/upload`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/image` | Upload one image. Field name `image` |
| `POST` | `/images` | Upload several images. Field name `images` |

Responses include the public MinIO URL.

### Bookings — `/api/bookings`

| Method | Path | Access |
|--------|------|--------|
| `GET` | `/extras` | Public |
| `POST` | `/estimate` | Public |
| `POST` | `/` | Public. Logged-in user is attached when a token is sent |
| `GET` | `/my-bookings` | Logged in |
| `GET` | `/my-bookings/:id` | Booking id or reference. Guest may pass `?email=` |
| `POST` | `/:id/confirm-payment` | Activates a pay-now booking after Stripe has succeeded. Empty body is allowed |
| `POST` | `/:id/cancel` | Empty body is allowed. Optional `{ "reason" }` |

`:id` accepts the booking id or the booking reference.

### Admin bookings — `/api/bookings/admin`

Requires an admin token.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/summary` | Booking and payment counts |
| `GET` | `/all` | Short booking rows. Supports `page`, `limit`, `status`, `paymentOption`, `paymentStatus`, `searchTerm`, `pickupFrom`, `pickupTo`, `sortBy`, `sortOrder` |
| `GET` | `/:id` | Full booking |
| `POST` | `/confirm/:id` | Activate a pending pay-now booking |
| `POST` | `/complete/:id` | Mark a confirmed booking completed |
| `POST` | `/collect-payment/:id` | Mark a pay-at-desk payment collected |
| `POST` | `/cancel/:id` | Cancel a booking |

### Payments — `/api/payments`

| Method | Path | Access |
|--------|------|--------|
| `GET` | `/config` | Public. Returns the Stripe publishable key |
| `POST` | `/webhook` | Stripe only. Handles `payment_intent.succeeded` and `payment_intent.payment_failed` |

A pay-now create response includes `clientSecret`. Use that with the publishable key in Stripe.js. Do not send card numbers to this API.

### Dashboard — `/api/admin`

| Method | Path | Access |
|--------|------|--------|
| `GET` | `/dashboard` | Admin |

Returns collected revenue, booking counts by status, car totals, customer count, and driver count.

### Extras — `/api/admin/extras`

Admin manages the add-ons shown by `GET /api/bookings/extras`. All of these routes require an admin token. Only active extras appear in the booking flow. A price change applies to new estimates and bookings.

| Method | Path | Body |
|--------|------|------|
| `POST` | `/add` | `{ "name": "Child Seat", "pricePerDay": 8 }` |
| `GET` | `/all` |  |
| `GET` | `/:id` |  |
| `PATCH` | `/update/:id` | Any of `name`, `pricePerDay`, `isActive` |
| `DELETE` | `/delete/:id` |  |

Deleting an extra that is already on a booking hides it from new bookings and keeps it on the old booking. An extra that has never been booked is removed. Set `isActive` to `true` to show a hidden extra again. Changing `pricePerDay` changes that extra's line on older bookings too. The booking total saved at checkout stays the same.

## Data

Prisma models in `prisma/schema.prisma`:

| Model | Role |
|-------|------|
| `User` | Account, role, and profile |
| `Car` | Fleet vehicle, price, images, and assigned driver |
| `DriverInfo` | Licence details shown on a booking |
| `Bookings` | Rental, dates, price, and status |
| `Payment` | Pay now or pay at desk |
| `ExtraService` | Optional add-ons. `isActive` controls the booking list |
| `AirportShuttle` | Shuttle selection on a booking |
| `BookingPersonDetails` | Renter contact stored with the booking |
| `CarAvailability` | Booked or maintenance windows |
| `Review` | Car rating and comment |
