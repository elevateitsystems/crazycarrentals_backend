# Frontend handoff

Base URL: `https://backend.tasdriverentals.com.au`

Admin calls send `Authorization: Bearer <token>`.

The website does not connect to Booking.com or any other booking site. Customers book and pay on this site only.

Use the fields below. Do not calculate the hire total in the browser.

## Fleet and rent a car

`GET /api/cars`

`GET /api/cars/search?pickupDate=2026-12-23&returnDate=2026-12-27&pickupTime=10:00&returnTime=10:00`

`GET /api/cars/:id?pickupDate=2026-12-23&returnDate=2026-12-27`

Show the vehicle name from `displayName`. It is already `Brand Model or similar`. Do not append "or similar" again.

On **Book Now**, show `payNowLabel`: `Save 9% when you Pay Now`.

On **View details**, show only `publicDetails`:

| Field | Use |
| --- | --- |
| `seats` | `5 people` |
| `doors` | `4 doors` |
| `suitcases` | `4 suitcases` |
| `transmission` | `Automatic` or `Manual` |
| `mileage` | `Unlimited Mileage`, or the stored mileage when it is not unlimited |
| `airConditioning` | `Air-condition` when true |
| `minimumDriverAge` | `Minimum Driving Age 21 years old` |
| `includedCover` | `Includes Standard cover: reduce excess $6,600.00` |
| `protectionNote` | `You will be able to upgrade your protection after selecting the vehicle` |

Do not show year, colour, plate, the raw mileage number, safety rating, or description on that public details view. Those fields are still in the response for the admin form.

`soldOut: true` means show **Sold out** and disable booking.

- With pickup and return dates, `soldOut` is set automatically when that vehicle is already booked for those dates, or while a Pay Now hold is open. When the booking is completed or cancelled, those dates open again. Do not add a manual sold-out step for a normal booking.
- Without dates, `soldOut` is only the admin switch for closing the whole vehicle.

A search still returns a sold-out vehicle. Do not remove it from the list.

Vehicle categories the admin can save include `SUVs`, `SEVEN_SEATER` (`7-seater` is accepted), and `HYBRID` as a fuel type.

## Reservation times

`GET /api/bookings/extras` returns `pickupTimeSlots`, `returnTimeSlots`, and the legacy `timeSlots` field.

Use `pickupTimeSlots` for pickup: from `08:00` to `22:00`, every 15 minutes.

Use `returnTimeSlots` for return: from `00:00` to `23:45`, every 15 minutes, to support after-hours returns.

`timeSlots` remains available for backward compatibility and contains the pickup list.

Send the chosen value as `pickupTime` and `returnTime`.

## Extras

Each extra has a short `name` and a `description` of up to 1000 characters. Show the description under the name. The name is only the title.

Protection plans are also in `extras`, with an empty `description`. The full protection card is in `protections`.

Standard Cover stays free in the page. The paid plans the current page matches by name are `Medium Protection` and `Platinum Premium`.

## Price

Call `POST /api/bookings/estimate` again whenever the dates, extras, protection, shuttle, or Pay Now / Pay at Desk choice changes.

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

`extraServiceIds` holds the protection id and the extra ids together.

For airport transfers, read `data.airportShuttle.name` and `data.airportShuttle.price` from `GET /api/bookings/extras`. Do not retain the old `Complimentary Airport Transfers`, `Airport Shuttle`, or fixed-$30 text.

Render the sidebar from `pricing.summary` and the amount due from `pricing.totalPrice`.

Do not multiply `dailyCarRate` or `pricePerDay` by `rentalDays`. Days can have different calendar rates. `pricing.dailyRates` is the price of each selected date, and `pricing.baseCarPrice` is their sum.

The 9% discount applies to the vehicle total only. Protection, extras, and the configured airport transfer stay at full price. `pricing.discount` is that vehicle discount. `pricing.payNowTotal` and `pricing.payAtDeskTotal` are both returned. Pay at Desk has no discount.

If `isAvailable` is false, stop and show `unavailableReason`.

## Checkout

Footer ABN, from `GET /api/bookings/extras`:

`data.company.abn` is `31 793 813 481`.

Terms checkbox, using this exact sentence from `data.terms.acknowledgement`:

`I acknowledge that I have read, understood and agree to the TasDrive Rentals Terms and Conditions`

The box must be ticked before Pay Now or Pay at Desk. Send `acceptedTerms: true` on `POST /api/bookings`.

Facebook and Instagram are not returned by the API. Link the footer icons to the business pages in the website.

## Create the booking

`POST /api/bookings`

Same dates, car, and `extraServiceIds` as the estimate, plus the renter and payment choice.

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

Do not send the card number or CVV to this API.

Pay at Desk uses `"paymentOption": "PAY_AT_DESK"`. The booking is confirmed immediately. There is no card step.

Pay Now returns `clientSecret`. The booking stays unpaid until the card succeeds.

1. `GET /api/payments/config` returns `data.publishableKey`. Use that key with Stripe.js. Do not hard-code a publishable key in the site.
2. Confirm the card with `clientSecret`.
3. `POST /api/bookings/BOOKING_ID/confirm-payment` with the renter email and the PaymentIntent id.

The amount charged is the booking `totalPrice`, in AUD.

## Admin calendar rates

These are separate from adding or editing a car. The car's `pricePerDay` is the normal daily rate.

`PUT /api/cars/CAR_ID/daily-rates`

```json
{
  "ranges": [
    { "from": "2026-12-24", "to": "2026-12-26", "price": 150 }
  ],
  "rates": [
    { "date": "2026-12-11", "price": 97 },
    { "date": "2026-12-13", "price": null }
  ]
}
```

A range sets every day from `from` through `to`. A single `rates` entry overrides one day. `null` clears that day back to the normal rate.

`GET /api/cars/CAR_ID/daily-rates?from=2026-12-01&to=2026-12-31` returns `basePricePerDay` and `days`. Each day has `date`, `price`, and `isCustom`.

To close a vehicle with no booking, update the car with `soldOut` true. Set it to false to open the vehicle again. Confirmed bookings do not need this field.

New car fields the admin form can save: `suitcases`, `airConditioning`, `minimumDriverAge`, `unlimitedMileage`, `carType` (`SEVEN_SEATER` or `7-seater`), `fuelType` (`HYBRID`).

Extra admin body:

```json
{
  "name": "Child seat",
  "description": "Rear-facing or forward-facing seat for infants and children.",
  "pricePerDay": 10
}
```

`PATCH /api/admin/extras/update/:id` accepts `description` as well.
