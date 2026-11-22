# Frontend implementation checklist

This checklist is for the TasDrive website developer only. It covers every frontend change required for the updated backend API.

## API configuration

Base API URL:

```text
https://backend.tasdriverentals.com.au
```

Do not hard-code a Stripe publishable key. Always retrieve it from:

```text
GET /api/payments/config
```

Use `data.publishableKey` to initialize Stripe.js.

## 1. Remove the old airport transfer copy

Replace all frontend occurrences of:

- `Complimentary Airport Transfers`
- `Airport Shuttle`
- `shuttle fee`
- A fixed `$30` airport-transfer label

Do not calculate or duplicate the airport-transfer price in frontend code.

Fetch the current transfer configuration from:

```text
GET /api/bookings/extras
```

Use:

- `data.airportShuttle.name`
- `data.airportShuttle.price`
- `data.airportShuttle.description`

For the current API configuration, display:

- Name: `Launceston Airport Transfers`
- Price: use the API-provided price

Send `airportShuttle: true` when the customer selects the transfer.
Use these estimate response fields:

- `pricing.airportShuttlePrice`
- `pricing.summary`
- `pricing.totalPrice`

Do not calculate the hire total in the frontend.

## 2. Update reservation times

Fetch time lists from:

```text
GET /api/bookings/extras
```

Use:

- `data.pickupTimeSlots` for pickup times
- `data.returnTimeSlots` for return times
- `data.timeSlots` only if the frontend must maintain backward compatibility

Requirements:

- Pickup: `08:00` through `22:00`, every 15 minutes
- Return: `00:00` through `23:45`, every 15 minutes
- Preserve the API values in `HH:mm` format
- Do not convert values to 12-hour format before sending them to the API
- Send `pickupTime` and `returnTime` in estimate and create requests
- Remove the old hard-coded `08:00`–`20:00` pickup and return lists

Example frontend grouping:

```js
const pickupTimes = data.pickupTimeSlots;
const returnTimes = data.returnTimeSlots;
```

## 3. Move search results to a dedicated experience

When the customer submits the reservation form:

- Navigate to the vehicle search/fleet route
- Pass the selected values in the route or state
- Do not render the fleet below the reservation form
- The fleet should be easy to view on both desktop and mobile

Use the search endpoint:

```text
GET /api/cars/search
```

Supported query parameters include:

- `pickupDate`
- `returnDate`
- `pickupTime`
- `returnTime`
- `pickupLocation`
- `returnLocation`
- `carType`
- `transmission`
- `fuelType`
- `brand`
- `searchTerm`
- `minPrice`
- `maxPrice`
- `age`
- `page`
- `limit`

Example:

```text
/api/cars/search?pickupDate=2026-12-23&returnDate=2026-12-27&pickupTime=10:00&returnTime=10:00&pickupLocation=Launceston&age=21
```

Sold-out vehicles must remain visible. Display `Sold out` and disable **Book Now**.

## 4. Vehicle data presentation

For vehicle cards and search results, use:

- `displayName`
- `pricePerDay`
- `basePricePerDay`
- `images`
- `soldOut`
- `publicDetails`
- `payNowLabel`

Do not append “or similar” to `displayName`; it is already included.

For a vehicle details view, use only `publicDetails`:

- `seats`
- `doors`
- `suitcases`
- `transmission`
- `mileage`
- `airConditioning`
- `minimumDriverAge`
- `includedCover`
- `protectionNote`

Do not show admin-only values such as plate, year, colour, raw mileage number, or safety ratings on the public details view.

For `publicDetails.mileage`:

- When the API returns `Unlimited Mileage`, display it as-is
- Otherwise display the returned mileage value

## 5. Commercial vehicle mileage

Commercial vehicles must use the API-provided `unlimitedMileage` and `mileage` values:

- If `unlimitedMileage === true`, display `Unlimited Mileage`
- If `unlimitedMileage === false`, display the vehicle's actual `mileage`

Do not hard-code unlimited mileage for trucks, vans, utes, or other commercial vehicles.

This frontend behaviour applies to both cards and vehicle detail pages.

## 6. Extra descriptions

Display `extra.description` beneath `extra.name` for every extra service.

Example rendering:

```jsx
<div>
  <h3>{extra.name}</h3>
  {extra.description && <p>{extra.description}</p>}
  <span>${extra.pricePerDay} per day</span>
</div>
```

Do not combine descriptions into the extra title. The API uses `name` as the short title and `description` as the explanatory text.

Protection plans are included in `extras`, but their full card data is in `protections`.

Render protection information from `protections`:

- `name`
- `pricePerDay`
- `included`
- `excluded`
- `excessLabel`
- `excessOver25`
- `excessUnder25`
- `bondCredit`
- `bondDebit`

## 7. Availability and driver assignment

Call estimates with each selected vehicle, dates, and times.

If `isAvailable === false`:

- Stop the booking flow
- Show `unavailableReason`
- Do not allow **Continue**, **Pay Now**, or **Pay at Desk**

A normal booking will be unavailable when:

- The vehicle is sold out
- The vehicle is unavailable
- It has no assigned driver
- It conflicts with an existing booking or Pay Now hold

When a vehicle has no assigned driver, display the API's reason rather than inventing frontend text:

```text
This car does not have an assigned driver
```

Do not remove this vehicle-check from the frontend. The backend will verify it again during booking creation.

## 8. Estimate flow

Call:

```text
POST /api/bookings/estimate
```

again whenever:

- The vehicle changes
- Pickup or return dates change
- Pickup or return times change
- Any extra changes
- Any protection changes
- Airport transfer changes
- Payment option changes between `PAY_NOW` and `PAY_AT_DESK`

Example request:

```json
{
  "carId": "CAR_ID",
  "pickupDate": "2026-12-23",
  "pickupTime": "10:00",
  "returnDate": "2026-12-27",
  "returnTime": "10:00",
  "extraServiceIds": ["PROTECTION_ID", "EXTRA_ID"],
  "airportShuttle": true,
  "paymentOption": "PAY_NOW"
}
```

From the response:

- Render `pricing.summary`
- Display `pricing.totalPrice` as the amount due
- Use `pricing.payNowTotal` and `pricing.payAtDeskTotal` for payment option totals
- Use `pricing.dailyRates` to display date-specific vehicle rates
- Do not multiply `dailyCarRate` by `rentalDays`
- Do not manually calculate the 9% discount

The backend applies 9% only to the vehicle charge. Protection, extras, and airport transfer remain at full price.

## 9. Checkout validation

Before creating a booking:

- Require all renter details
- Require `acceptedTerms: true`
- Require a valid email and phone number
- Require a pickup location and return location
- Require pickup and return times
- Stop if the estimate reported `isAvailable: false`
- Stop if the latest estimate is stale after the customer changes dates or selections

The Terms and Security Deposit content remains static. No CMS or editable API integration is required.

Use the exact static terms acknowledgement returned by:

```text
GET /api/bookings/extras
```

from `data.terms.acknowledgement`.

## 10. Create booking

Send:

```text
POST /api/bookings
```

Request example:

```json
{
  "carId": "CAR_ID",
  "pickupDate": "2026-12-23",
  "pickupTime": "10:00",
  "pickupLocation": "Launceston",
  "returnDate": "2026-12-27",
  "returnTime": "10:00",
  "returnLocation": "Launceston",
  "extraServiceIds": ["PROTECTION_ID", "EXTRA_ID"],
  "airportShuttle": true,
  "acceptedTerms": true,
  "bookingPersonDetails": {
    "firstName": "John",
    "lastName": "Smith",
    "email": "john@example.com",
    "phoneNumber": "0412345678"
  },
  "payment": {
    "paymentOption": "PAY_NOW",
    "paymentMethod": "Credit Card"
  }
}
```

Never send:

- Card number
- CVV
- Expiry data
- Unencrypted billing credentials

## 11. Stripe Pay Now flow

1. Create the booking.
2. Read `data.clientSecret` from the create response.
3. Retrieve the publishable key with `GET /api/payments/config`.
4. Initialize Stripe.js with `data.publishableKey`.
5. Confirm the card using Stripe.js.
6. Call:

```text
POST /api/bookings/:id/confirm-payment
```

with:

```json
{
  "email": "customer@example.com",
  "stripePaymentIntentId": "PI_ID"
}
```

The booking must not display a confirmed state solely because Stripe.js returned success. Show confirmed only after the backend response confirms activation.

For `PAY_AT_DESK`:

- Do not initialize Stripe card confirmation
- Display the booking as confirmed immediately
- Payment is collected at the desk

## 12. Booking lookup and cancellation

Use the booking ID or reference in:

```text
GET /api/bookings/my-bookings/:id
```

For guest lookup, send:

```text
?email=customer@example.com
```

Cancel with:

```text
POST /api/bookings/:id/cancel
```

An optional body may contain:

```json
{
  "reason": "Plans changed"
}
```

The frontend should handle the API's cancellation, refund, and already-completed responses.

## 13. Error handling

For API failures:

- `400`: validation or booking conflict
- `401`: authentication required
- `403`: permission or email verification failure
- `404`: booking or vehicle not found
- `409`: duplicate record
- `500`: unexpected server failure

Display `response.message` to the customer where appropriate. Do not expose stack traces or server secrets.

## 14. Final frontend QA checklist

- Pickup options begin at 08:00 and end at 22:00
- Return options cover 00:00 through 23:45
- Search results open in the fleet/search view, not below the reservation form
- “Complimentary Airport Transfers” is removed
- “Airport Shuttle” and “shuttle fee” are removed
- The airport transfer name and price come from the API
- Extra descriptions are visible
- Commercial vehicle mileage is not shown as unlimited when false
- Sold-out vehicles remain visible and cannot be booked
- Vehicles without assigned drivers cannot proceed to booking
- A fresh estimate runs after every pricing or date change
- Frontend totals match `pricing.totalPrice`
- Pay Now uses Stripe.js and backend confirmation
- Pay at Desk does not use Stripe confirmation
- Terms acknowledgement is ticked and `acceptedTerms: true` is sent
- Static Terms and Security Deposit content remains unchanged
- The publishable key is fetched from the API, not hard-coded
