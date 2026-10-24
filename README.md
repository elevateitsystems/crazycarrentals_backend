# Crazy Car Rentals Backend

Backend API for a car rental service, built with Node.js, Express, and MongoDB. This application supports both customer and admin functionalities, including booking management, user authentication, and vehicle management.

## 🏗️ Architecture

- **Framework**: Express.js
- **Database**: MongoDB
- **Authentication**: JSON Web Tokens (JWT) with bcrypt for password hashing
- **Validation**: Zod for schema validation
- **CORS**: Cross-Origin Resource Sharing enabled for frontend integration

## 📂 Project Structure

```
src/
├── app.ts                    # Express application setup and middleware registration
├── server.ts                 # Server entry point and database connection
├── config.ts                 # Environment variable management
├── routes/                   # API route definitions
│   ├── index.ts              # Main router combining all feature routes
│   ├── auth.routes.ts        # User authentication routes
│   ├── vehicle.routes.ts     # Vehicle management routes
│   ├── booking.routes.ts     # Booking management routes
│   ├── admin.routes.ts       # Admin-specific routes
│   ├── public.routes.ts      # Public access routes (stats, popular)
│   ├── notification.routes.ts# Notification routes
│   ├── faq.routes.ts         # FAQ management routes
│   └── review.routes.ts      # Review management routes
├── controllers/              # Request handlers
│   ├── auth.controller.ts
│   ├── vehicle.controller.ts
│   ├── booking.controller.ts
│   ├── admin.controller.ts
│   ├── public.controller.ts
│   ├── notification.controller.ts
│   ├── faq.controller.ts
│   └── review.controller.ts
├── services/                 # Business logic
├── models/                   # Mongoose schemas and models
├── middlewares/              # Custom middleware (auth, validation, error handling)
└── utils/                    # Utility functions
```

## 🚀 API Documentation

### 📋 Prerequisites

- **Node.js**: 18.x or higher
- **MongoDB**: Running instance (local or cloud like MongoDB Atlas)
- **npm**: Or yarn/pnpm

### 📦 Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd crazycarrentals_Backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```env
   PORT=5000
   DATABASE_URL=mongodb://localhost:27017/carrental_db
   JWT_SECRET=your_secret_key
   JWT_ACCESS_TOKEN_EXPIRES_IN=1h
   ```

4. Start the server:
   ```bash
   npm start
   ```

### 🌐 Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `DATABASE_URL` | MongoDB connection string | `mongodb://localhost:27017/carrental_db` |
| `JWT_SECRET` | Secret key for JWT signing | `your-secret-key` |
| `JWT_ACCESS_TOKEN_EXPIRES_IN` | Access token expiry duration | `1h` (1 hour) |

### 🗄️ Database Models

The application uses Mongoose schemas defined in the `src/models/` directory.

| Model | Fields | Relationships |
|-------|--------|---------------|
| `User` | `name`, `email`, `password`, `role`, `phone` | Has many `Booking`s |
| `Vehicle` | `make`, `model`, `year`, `plateNumber`, `pricePerDay`, `image`, `isAvailable` | Many-to-many with `Booking` via `BookingItem` |
| `Booking` | `userId`, `totalPrice`, `status`, `pickupDate`, `returnDate` | Belongs to `User`, has many `BookingItem`s |
| `BookingItem` | `vehicle`, `quantity`, `price` | Belongs to `Booking`, references `Vehicle` |
| `Notification` | `user`, `title`, `message`, `type`, `isRead` | Belongs to `User` |
| `FAQ` | `question`, `answer`, `isActive` | None |
| `Review` | `user`, `vehicle`, `rating`, `comment` | Belongs to `User`, references `Vehicle` |

## 📚 API Endpoints

### Authentication (`/api/auth`)

| Method | Endpoint | Description | Public/Protected |
|--------|----------|-------------|------------------|
| `POST` | `/register` | Register a new user | Public |
| `POST` | `/login` | Login user | Public |
| `POST` | `/logout` | Logout user | Protected |
| `GET` | `/me` | Get current user profile | Protected |
| `PUT` | `/me` | Update current user profile | Protected |
| `PUT` | `/change-password` | Change password | Protected |
| `POST` | `/forgot-password` | Request password reset | Public |
| `POST` | `/reset-password` | Reset password with token | Public |

### Vehicles (`/api/vehicles`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `GET` | `/` | List all vehicles | Public |
| `GET` | `/:id` | Get vehicle by ID | Public |
| `GET` | `/available` | Get available vehicles | Public |
| `GET` | `/brands` | Get unique vehicle brands | Public |
| `GET` | `/popular` | Get popular vehicles | Public |
| `POST` | `/` | Create vehicle (admin) | Admin |
| `PUT` | `/:id` | Update vehicle (admin) | Admin |
| `DELETE` | `/:id` | Delete vehicle (admin) | Admin |
| `POST` | `/:id/toggle-status` | Toggle availability (admin) | Admin |
| `POST` | `/:id/upload-image` | Upload vehicle image | Admin |

### Bookings (`/api/booking`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `GET` | `/extras` | Get available extras | Public |
| `POST` | `/estimate` | Estimate booking cost | Public |
| `POST` | `/` | Create booking | Public |
| `GET` | `/my-bookings` | Get current user's bookings | Protected |
| `GET` | `/my-bookings/:id` | Get booking by ID | Protected |
| `POST` | `/:id/confirm-payment` | Confirm payment | Protected |
| `POST` | `/:id/cancel` | Cancel booking | Protected |

### Admin (`/api/admin`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `GET` | `/dashboard` | Get admin dashboard stats | Admin |

#### Users

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `GET` | `/users` | List all users | Admin |
| `GET` | `/users/:id` | Get user by ID | Admin |
| `POST` | `/users` | Create user | Admin |
| `PUT` | `/users/:id` | Update user | Admin |
| `DELETE` | `/users/:id` | Delete user | Admin |
| `PUT` | `/users/:id/role` | Change user role | Admin |

#### Bookings

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `GET` | `/bookings` | List all bookings | Admin |
| `GET` | `/bookings/:id` | Get booking by ID | Admin |
| `PUT` | `/bookings/:id` | Update booking (admin) | Admin |
| `PUT` | `/bookings/:id/status` | Update booking status (admin) | Admin |

#### Vehicles

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `GET` | `/vehicles` | List all vehicles | Admin |
| `GET` | `/vehicles/:id` | Get vehicle by ID | Admin |
| `POST` | `/vehicles` | Create vehicle | Admin |
| `PUT` | `/vehicles/:id` | Update vehicle | Admin |
| `DELETE` | `/vehicles/:



cloudflared tunnel --url http://103.79.216.235:4001