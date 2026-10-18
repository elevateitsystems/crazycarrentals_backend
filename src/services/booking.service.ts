import bcrypt from "bcryptjs";
import type { BookingStatus, Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { formatPublicDriverInfo } from "./driver.service.js";

export interface EstimateBookingInput {
  carId: string;
  pickupDate: string;
  pickupTime?: string;
  returnDate: string;
  returnTime?: string;
  extraServiceIds?: string[];
  airportShuttle?: boolean;
  paymentOption?: "PAY_NOW" | "PAY_AT_DESK";
}

export interface CreateBookingInput {
  carId: string;
  pickupDate: string;
  pickupTime: string;
  pickupLocation: string;
  returnDate: string;
  returnTime: string;
  returnLocation: string;
  extraServiceIds?: string[];
  bookingPersonDetails: {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
  };
  airportShuttle?: boolean;
  payment: {
    paymentOption: "PAY_NOW" | "PAY_AT_DESK";
    paymentMethod?: string;
    cardDetails?: {
      cardNumber?: string;
      cardLast4?: string;
      cardBrand?: string;
      nameOnCard?: string;
    };
    stripePaymentIntentId?: string;
    billingAddress?: {
      street?: string;
      suburb?: string;
      state?: string;
      postcode?: string;
    };
  };
}

const DEFAULT_EXTRAS = [
  { name: "Additional Driver", pricePerDay: 12 },
  { name: "Child Seat", pricePerDay: 8 },
  { name: "GPS Navigation", pricePerDay: 10 },
  { name: "Roadside Assistance Plus", pricePerDay: 6 },
  { name: "Toll Pass", pricePerDay: 5 },
  { name: "Portable Wi-Fi", pricePerDay: 9 },
];

const AIRPORT_SHUTTLE_FLAT_FEE = 30;
const PAY_NOW_DISCOUNT_PERCENT = 5;
const PAYMENT_HOLD_MINUTES = 30;

type Db = Prisma.TransactionClient | typeof prisma;

const releaseExpiredHolds = async (db: Db, carId: string) => {
  const expired = await db.bookings.findMany({
    where: {
      carId,
      status: "PENDING",
      holdExpiresAt: { lt: new Date() },
    },
    select: { id: true, pickupDate: true, returnDate: true },
  });

  if (expired.length === 0) return;

  const ids = expired.map((booking) => booking.id);
  await db.bookings.updateMany({
    where: { id: { in: ids } },
    data: { status: "CANCELLED" },
  });
  await db.payment.updateMany({
    where: { bookingId: { in: ids }, status: "PENDING" },
    data: { status: "EXPIRED" },
  });

  for (const booking of expired) {
    await db.carAvailability.deleteMany({
      where: {
        carId,
        pickupDate: booking.pickupDate,
        returnDate: booking.returnDate,
        status: "BOOKED",
      },
    });
  }
};

const buildOrderSummary = (booking: {
  rentalDays?: number | null;
  basePrice?: number | null;
  discount?: number | null;
  car?: { pricePerDay?: number | null } | null;
  extraServices?: Array<{ name: string; pricePerDay: number }>;
  airportShuttles?: Array<{ shuttleService: boolean; price: number }>;
}) => {
  const days = booking.rentalDays ?? 1;
  const rate = booking.car?.pricePerDay;
  const lines: Array<{ label: string; amount: number }> = [];

  if (booking.basePrice != null) {
    lines.push({
      label:
        rate != null
          ? `${days} ${days === 1 ? "day" : "days"} × $${rate}`
          : "Vehicle",
      amount: booking.basePrice,
    });
  }

  for (const extra of booking.extraServices ?? []) {
    lines.push({
      label: extra.name,
      amount: Number((extra.pricePerDay * days).toFixed(2)),
    });
  }

  for (const shuttle of booking.airportShuttles ?? []) {
    if (shuttle.shuttleService) {
      lines.push({ label: "Airport Shuttle", amount: shuttle.price });
    }
  }

  if (booking.discount) {
    lines.push({ label: "Pay Now Discount", amount: -booking.discount });
  }

  return lines;
};

const activeBookingFilter = (now = new Date()): Prisma.BookingsWhereInput => ({
  OR: [
    { status: "CONFIRMED" },
    {
      status: "PENDING",
      OR: [{ holdExpiresAt: null }, { holdExpiresAt: { gt: now } }],
    },
  ],
});

const presentBooking = (booking: {
  status: string;
  bookingDriverDetails?: unknown;
  driverInfo?: Parameters<typeof formatPublicDriverInfo>[0];
  rentalDays?: number | null;
  basePrice?: number | null;
  discount?: number | null;
  car?: {
    pricePerDay?: number | null;
    driverInfo?: Parameters<typeof formatPublicDriverInfo>[0];
  } | null;
  extraServices?: Array<{ name: string; pricePerDay: number }>;
  airportShuttles?: Array<{ shuttleService: boolean; price: number }>;
  payments?: Array<{ paymentOption?: string; status?: string }>;
  [key: string]: unknown;
}) => {
  const { bookingDriverDetails: _renterLicence, driverInfo: assignedDriver, car, ...rest } = booking;
  const driverInfo = formatPublicDriverInfo(assignedDriver ?? car?.driverInfo);

  return {
    ...rest,
    driverInfo,
    car: car
      ? {
          ...car,
          driverInfo: formatPublicDriverInfo(car.driverInfo ?? assignedDriver),
        }
      : car,
    isActive: booking.status === "CONFIRMED",
    summary: buildOrderSummary(booking),
    gstIncluded: true,
  };
};

// Helper to calculate days between dates
export const calculateRentalDays = (
  pickupDateStr: string,
  returnDateStr: string,
  pickupTime = "10:00",
  returnTime = "10:00"
): number => {
  const pDate = new Date(`${pickupDateStr.split("T")[0]}T${pickupTime.includes(":") ? pickupTime : "10:00"}:00Z`);
  const rDate = new Date(`${returnDateStr.split("T")[0]}T${returnTime.includes(":") ? returnTime : "10:00"}:00Z`);

  if (Number.isNaN(pDate.getTime()) || Number.isNaN(rDate.getTime())) {
    return 1;
  }

  const diffMs = rDate.getTime() - pDate.getTime();
  if (diffMs <= 0) {
    return 1;
  }

  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, days);
};

// 1. Get available extra services (seeds defaults if empty)
export const getAvailableExtras = async () => {
  let extras = await prisma.extraService.findMany({
    orderBy: { pricePerDay: "desc" },
  });

  if (extras.length === 0) {
    for (const item of DEFAULT_EXTRAS) {
      await prisma.extraService.create({ data: item });
    }
    extras = await prisma.extraService.findMany({
      orderBy: { pricePerDay: "desc" },
    });
  }

  return {
    extras,
    airportShuttle: {
      name: "Airport Shuttle",
      price: AIRPORT_SHUTTLE_FLAT_FEE,
      type: "FLAT_FEE",
      description: "Convenient airport shuttle transfer",
    },
    discounts: {
      payNowDiscountPercent: PAY_NOW_DISCOUNT_PERCENT,
      description: "Save 5% instantly when you Pay Now",
    },
  };
};

// 2. Estimate booking price & check vehicle availability
export const estimateBookingPrice = async (input: EstimateBookingInput) => {
  const car = await prisma.car.findUnique({
    where: { id: input.carId },
    include: { driverInfo: true },
  });

  if (!car) {
    throw new Error("Car not found");
  }

  const pDate = new Date(input.pickupDate);
  const rDate = new Date(input.returnDate);

  if (Number.isNaN(pDate.getTime()) || Number.isNaN(rDate.getTime())) {
    throw new Error("Invalid pickup or return date");
  }

  if (rDate < pDate) {
    throw new Error("Return date cannot be earlier than pickup date");
  }

  const rentalDays = calculateRentalDays(
    input.pickupDate,
    input.returnDate,
    input.pickupTime,
    input.returnTime
  );

  await releaseExpiredHolds(prisma, input.carId);
  await completeElapsedBookings();

  // Active bookings and unexpired Pay Now holds block the dates.
  const conflictingBookings = await prisma.bookings.findMany({
    where: {
      carId: input.carId,
      pickupDate: { lte: rDate },
      returnDate: { gte: pDate },
      ...activeBookingFilter(),
    },
  });

  const isAvailable =
    car.isAvailable && Boolean(car.driverInfo) && conflictingBookings.length === 0;

  // Selected extras breakdown
  let selectedExtrasBreakdown: Array<{
    id: string;
    name: string;
    pricePerDay: number;
    days: number;
    total: number;
  }> = [];

  let extrasTotal = 0;
  if (input.extraServiceIds && input.extraServiceIds.length > 0) {
    const extras = await prisma.extraService.findMany({
      where: { id: { in: input.extraServiceIds } },
    });
    if (extras.length !== new Set(input.extraServiceIds).size) {
      throw new Error("One or more selected extras are invalid");
    }

    selectedExtrasBreakdown = extras.map((e) => {
      const total = Number((e.pricePerDay * rentalDays).toFixed(2));
      extrasTotal += total;
      return {
        id: e.id,
        name: e.name,
        pricePerDay: e.pricePerDay,
        days: rentalDays,
        total,
      };
    });
  }

  const shuttlePrice = input.airportShuttle ? AIRPORT_SHUTTLE_FLAT_FEE : 0;
  const baseCarPrice = Number((car.pricePerDay * rentalDays).toFixed(2));
  const subtotal = Number((baseCarPrice + extrasTotal + shuttlePrice).toFixed(2));

  const isPayNow = input.paymentOption === "PAY_NOW" || !input.paymentOption;
  const payNowDiscount = Number(((subtotal * PAY_NOW_DISCOUNT_PERCENT) / 100).toFixed(2));
  const discount = isPayNow ? payNowDiscount : 0;
  const payNowTotal = Number((subtotal - payNowDiscount).toFixed(2));
  const payAtDeskTotal = subtotal;
  const totalPrice = isPayNow ? payNowTotal : payAtDeskTotal;

  const summary = [
    {
      label: `${rentalDays} ${rentalDays === 1 ? "day" : "days"} × $${car.pricePerDay}`,
      amount: baseCarPrice,
    },
    ...selectedExtrasBreakdown.map((extra) => ({
      label: extra.name,
      amount: extra.total,
    })),
    ...(shuttlePrice > 0
      ? [{ label: "Airport Shuttle", amount: shuttlePrice }]
      : []),
    ...(discount > 0 ? [{ label: "Pay Now Discount", amount: -discount }] : []),
  ];

  return {
    car: {
      id: car.id,
      brand: car.brand,
      model: car.model,
      year: car.year,
      carType: car.carType,
      transmission: car.transmission,
      fuelType: car.fuelType,
      totalSeat: car.totalSeat,
      pricePerDay: car.pricePerDay,
      images: car.images,
    },
    driverInfo: formatPublicDriverInfo(car.driverInfo),
    isAvailable,
    unavailableReason: isAvailable
      ? null
      : !car.driverInfo
        ? "This car does not have an assigned driver"
        : conflictingBookings.length > 0
          ? "This car is already booked for the selected dates"
          : "This car is not available",
    rentalDetails: {
      pickupDate: pDate.toISOString(),
      pickupTime: input.pickupTime || "10:00",
      returnDate: rDate.toISOString(),
      returnTime: input.returnTime || "10:00",
      rentalDays,
    },
    pricing: {
      dailyCarRate: car.pricePerDay,
      rentalDays,
      baseCarPrice,
      selectedExtras: selectedExtrasBreakdown,
      extrasTotal: Number(extrasTotal.toFixed(2)),
      airportShuttlePrice: shuttlePrice,
      subtotal,
      discount,
      discountPercentage: isPayNow ? PAY_NOW_DISCOUNT_PERCENT : 0,
      totalPrice,
      payNowTotal,
      payAtDeskTotal,
      paymentOption: input.paymentOption || "PAY_NOW",
      gstIncluded: true,
      summary,
      freeCancellationHours: 24,
    },
  };
};

// 3. Create Booking (atomic full transaction)
export const createBooking = async (input: CreateBookingInput, authenticatedUserId?: string) => {
  const pDate = new Date(input.pickupDate);
  const rDate = new Date(input.returnDate);

  if (Number.isNaN(pDate.getTime()) || Number.isNaN(rDate.getTime())) {
    throw new Error("Invalid pickup or return date");
  }

  if (rDate < pDate) {
    throw new Error("Return date cannot be earlier than pickup date");
  }

  const rentalDays = calculateRentalDays(
    input.pickupDate,
    input.returnDate,
    input.pickupTime,
    input.returnTime
  );

  return await prisma.$transaction(async (tx) => {
    await releaseExpiredHolds(tx, input.carId);
    await completeElapsedBookings();

    const car = await tx.car.findUnique({
      where: { id: input.carId },
      include: { driverInfo: true },
    });

    if (!car) {
      throw new Error("Selected car does not exist");
    }

    if (!car.isAvailable) {
      throw new Error("Selected car is currently not available for rent");
    }

    if (!car.driverInfo) {
      throw new Error("This car does not have an assigned driver");
    }

    const assignedDriver = car.driverInfo;

    // 2. Check overlap
    const conflict = await tx.bookings.findFirst({
      where: {
        carId: input.carId,
        pickupDate: { lte: rDate },
        returnDate: { gte: pDate },
        ...activeBookingFilter(),
      },
    });

    if (conflict) {
      throw new Error(
        "Car is already booked for the selected date range. Please choose different dates or another vehicle."
      );
    }

    // 3. Resolve user (authenticated user OR lookup/auto-create customer)
    let bookingUserId = authenticatedUserId;

    if (!bookingUserId) {
      const normalizedEmail = input.bookingPersonDetails.email.trim().toLowerCase();
      const existingUser = await tx.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (existingUser) {
        bookingUserId = existingUser.id;
      } else {
        const tempPassword = `Guest@${Math.random().toString(36).substring(2, 8)}!`;
        const passwordHash = await bcrypt.hash(tempPassword, 10);

        const newUser = await tx.user.create({
          data: {
            email: normalizedEmail,
            name: `${input.bookingPersonDetails.firstName} ${input.bookingPersonDetails.lastName}`.trim(),
            phoneNumber: input.bookingPersonDetails.phoneNumber,
            passwordHash,
            role: "USER",
          },
        });
        bookingUserId = newUser.id;
      }
    }

    // 4. Calculate prices
    let extrasTotal = 0;
    let extras: Array<{ id: string; name: string; pricePerDay: number }> = [];

    if (input.extraServiceIds && input.extraServiceIds.length > 0) {
      extras = await tx.extraService.findMany({
        where: { id: { in: input.extraServiceIds } },
      });
      if (extras.length !== new Set(input.extraServiceIds).size) {
        throw new Error("One or more selected extras are invalid");
      }
      for (const extra of extras) {
        extrasTotal += extra.pricePerDay * rentalDays;
      }
    }

    const shuttlePrice = input.airportShuttle ? AIRPORT_SHUTTLE_FLAT_FEE : 0;
    const baseCarPrice = Number((car.pricePerDay * rentalDays).toFixed(2));
    const subtotal = Number((baseCarPrice + extrasTotal + shuttlePrice).toFixed(2));

    const isPayNow = input.payment.paymentOption === "PAY_NOW";
    const discount = isPayNow
      ? Number(((subtotal * PAY_NOW_DISCOUNT_PERCENT) / 100).toFixed(2))
      : 0;

    const totalPrice = Number((subtotal - discount).toFixed(2));

    // 5. Generate human-readable booking reference
    const timestampPart = Date.now().toString().slice(-4);
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    const bookingReference = `CCR-${timestampPart}-${randomPart}`;

    const booking = await tx.bookings.create({
      data: {
        bookingReference,
        carId: car.id,
        userId: bookingUserId,
        driverInfoId: assignedDriver.id,
        pickupDate: pDate,
        pickupTime: input.pickupTime,
        pickupLocation: input.pickupLocation,
        returnDate: rDate,
        returnTime: input.returnTime,
        returnLocation: input.returnLocation,
        rentalDays,
        basePrice: baseCarPrice,
        extrasPrice: Number(extrasTotal.toFixed(2)),
        discount,
        totalPrice,
        status: isPayNow ? "PENDING" : "CONFIRMED",
        holdExpiresAt: isPayNow
          ? new Date(Date.now() + PAYMENT_HOLD_MINUTES * 60 * 1000)
          : null,
        extraServices: {
          connect: extras.map((e) => ({ id: e.id })),
        },
      },
    });

    await tx.bookingPersonDetails.create({
      data: {
        bookingId: booking.id,
        firstName: input.bookingPersonDetails.firstName,
        lastName: input.bookingPersonDetails.lastName,
        email: input.bookingPersonDetails.email.trim().toLowerCase(),
        phoneNumber: input.bookingPersonDetails.phoneNumber,
      },
    });

    // 9. Airport Shuttle
    if (input.airportShuttle) {
      await tx.airportShuttle.create({
        data: {
          bookingId: booking.id,
          shuttleService: true,
          price: AIRPORT_SHUTTLE_FLAT_FEE,
        },
      });
    }

    const rawCard = input.payment.cardDetails?.cardNumber?.replace(/\s+/g, "");
    const cardLast4 =
      input.payment.cardDetails?.cardLast4 ??
      (rawCard && rawCard.length >= 4 ? rawCard.slice(-4) : null);

    await tx.payment.create({
      data: {
        bookingId: booking.id,
        paymentOption: input.payment.paymentOption,
        paymentMethod: input.payment.paymentMethod || "Credit Card",
        status: isPayNow ? "PENDING" : "PENDING_AT_DESK",
        amount: totalPrice,
        transactionId: isPayNow ? null : `desk_${Date.now()}`,
        stripePaymentIntentId: input.payment.stripePaymentIntentId ?? null,
        cardLast4,
        cardBrand: input.payment.cardDetails?.cardBrand ?? null,
        billingStreet: input.payment.billingAddress?.street || null,
        billingSuburb: input.payment.billingAddress?.suburb || null,
        billingState: input.payment.billingAddress?.state || null,
        billingPostcode: input.payment.billingAddress?.postcode || null,
      },
    });

    // 11. Create Car Availability record to reflect reservation
    await tx.carAvailability.create({
      data: {
        carId: car.id,
        pickupDate: pDate,
        pickupTime: input.pickupTime,
        pickupLocation: input.pickupLocation,
        returnDate: rDate,
        returnTime: input.returnTime,
        returnLocation: input.returnLocation,
        status: "BOOKED",
      },
    });

    // Return complete booking with populated relations
    const created = await tx.bookings.findUnique({
      where: { id: booking.id },
      include: {
        car: { include: { driverInfo: true } },
        driverInfo: true,
        bookingPersonDetails: true,
        airportShuttles: true,
        extraServices: true,
        payments: true,
      },
    });

    if (!created) {
      throw new Error("Failed to create booking");
    }

    return presentBooking(created);
  });
};

// 4. Get User's bookings
export const getUserBookings = async (
  userId: string,
  query: { page?: number | string; limit?: number | string; status?: string }
) => {
  await completeElapsedBookings();

  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 10));
  const skip = (page - 1) * limit;

  const where: any = { userId };
  if (query.status) {
    where.status = query.status.toUpperCase();
  }

  const [bookings, total] = await Promise.all([
    prisma.bookings.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        car: {
          select: {
            id: true,
            brand: true,
            model: true,
            year: true,
            color: true,
            plate: true,
            carType: true,
            transmission: true,
            fuelType: true,
            images: true,
            pricePerDay: true,
            driverInfo: true,
          },
        },
        payments: true,
        bookingPersonDetails: true,
        airportShuttles: true,
        extraServices: true,
        driverInfo: true,
      },
    }),
    prisma.bookings.count({ where }),
  ]);

  return {
    bookings: bookings.map(presentBooking),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  };
};

// 5. Get Booking by ID or Reference
export const getBookingDetails = async (
  idOrRef: string,
  userId?: string,
  email?: string
) => {
  await completeElapsedBookings();

  const booking = await prisma.bookings.findFirst({
    where: {
      OR: [{ id: idOrRef }, { bookingReference: idOrRef }],
    },
    include: {
      car: { include: { driverInfo: true } },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      driverInfo: true,
      bookingPersonDetails: true,
      airportShuttles: true,
      extraServices: true,
      payments: true,
    },
  });

  if (!booking) {
    throw new Error("Booking not found");
  }

  // Security check: if userId provided, must match; if guest email provided, check person details email
  if (userId && booking.userId !== userId) {
    // If user is not the owner, check if user is admin
    const requestingUser = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (requestingUser?.role !== "ADMIN" && requestingUser?.role !== "SUPER_ADMIN") {
      throw new Error("You do not have permission to view this booking");
    }
  } else if (!userId && email) {
    const isMatchingEmail =
      booking.user?.email.toLowerCase() === email.toLowerCase() ||
      booking.bookingPersonDetails.some(
        (p) => p.email.toLowerCase() === email.toLowerCase()
      );
    if (!isMatchingEmail) {
      throw new Error("Booking email verification failed");
    }
  }

  return presentBooking(booking);
};

// 6. Activate a Pay Now booking after payment succeeds
export const confirmBookingPayment = async (
  idOrRef: string,
  userId?: string,
  email?: string,
  stripePaymentIntentId?: string,
) => {
  const booking = await prisma.bookings.findFirst({
    where: {
      OR: [{ id: idOrRef }, { bookingReference: idOrRef }],
    },
    include: {
      payments: true,
      bookingPersonDetails: true,
      user: { select: { email: true } },
    },
  });

  if (!booking) {
    throw new Error("Booking not found");
  }

  if (userId && booking.userId !== userId) {
    const requestingUser = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (requestingUser?.role !== "ADMIN" && requestingUser?.role !== "SUPER_ADMIN") {
      throw new Error("You do not have permission to confirm this booking");
    }
  } else if (!userId) {
    if (!email) {
      throw new Error("Email is required to confirm this booking");
    }
    const matches =
      booking.user?.email.toLowerCase() === email.toLowerCase() ||
      booking.bookingPersonDetails.some(
        (person) => person.email.toLowerCase() === email.toLowerCase(),
      );
    if (!matches) {
      throw new Error("Booking email verification failed");
    }
  }

  if (booking.status === "CANCELLED") {
    throw new Error("This booking has been cancelled");
  }

  if (booking.status === "CONFIRMED" || booking.status === "COMPLETED") {
    return getBookingDetails(booking.id, userId, email);
  }

  const payment = booking.payments[0];

  if (booking.holdExpiresAt && booking.holdExpiresAt < new Date()) {
    await prisma.$transaction(async (tx) => {
      await tx.bookings.update({
        where: { id: booking.id },
        data: { status: "CANCELLED" },
      });
      if (payment?.status === "PENDING") {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: "EXPIRED" },
        });
      }
      await tx.carAvailability.deleteMany({
        where: {
          carId: booking.carId,
          pickupDate: booking.pickupDate,
          returnDate: booking.returnDate,
          status: "BOOKED",
        },
      });
    });
    throw new Error("Payment window expired. Please start the booking again.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.bookings.update({
      where: { id: booking.id },
      data: { status: "CONFIRMED", holdExpiresAt: null },
    });

    if (payment) {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "COMPLETED",
          transactionId: payment.transactionId ?? `txn_${Date.now()}`,
          stripePaymentIntentId:
            stripePaymentIntentId ?? payment.stripePaymentIntentId,
        },
      });
    }
  });

  return getBookingDetails(booking.id, userId, email);
};

// 7. Cancel booking (free cancellation up to 24 hrs before pickup)
export const cancelBooking = async (
  idOrRef: string,
  userId?: string,
  reason?: string
) => {
  const booking = await prisma.bookings.findFirst({
    where: {
      OR: [{ id: idOrRef }, { bookingReference: idOrRef }],
    },
    include: { payments: true },
  });

  if (!booking) {
    throw new Error("Booking not found");
  }

  if (userId && booking.userId !== userId) {
    const requestingUser = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (requestingUser?.role !== "ADMIN" && requestingUser?.role !== "SUPER_ADMIN") {
      throw new Error("You do not have permission to cancel this booking");
    }
  }

  if (booking.status === "CANCELLED") {
    throw new Error("This booking has already been cancelled");
  }

  if (booking.status === "COMPLETED") {
    throw new Error("A completed booking cannot be cancelled");
  }

  // Check 24hr cancellation policy
  const now = Date.now();
  const pickupTimeMs = new Date(booking.pickupDate).getTime();
  const hoursUntilPickup = (pickupTimeMs - now) / (1000 * 60 * 60);

  // If cancelling less than 24h, we still allow but flag
  const isFreeCancellation = hoursUntilPickup >= 24;

  return await prisma.$transaction(async (tx) => {
    // Update booking status
    const updatedBooking = await tx.bookings.update({
      where: { id: booking.id },
      data: { status: "CANCELLED" },
      include: {
        car: { include: { driverInfo: true } },
        payments: true,
        bookingPersonDetails: true,
        driverInfo: true,
        extraServices: true,
        airportShuttles: true,
      },
    });

    // Update payment record
    if (booking.payments.length > 0) {
      for (const p of booking.payments) {
        await tx.payment.update({
          where: { id: p.id },
          data: {
            status: p.status === "COMPLETED" ? "REFUNDED" : "CANCELLED",
          },
        });
      }
    }

    // Release car availability if booked
    await tx.carAvailability.deleteMany({
      where: {
        carId: booking.carId,
        pickupDate: booking.pickupDate,
        returnDate: booking.returnDate,
        status: "BOOKED",
      },
    });

    return {
      booking: presentBooking(updatedBooking),
      cancellation: {
        cancelledAt: new Date().toISOString(),
        isFreeCancellation,
        hoursUntilPickup: Number(hoursUntilPickup.toFixed(1)),
        refundStatus:
          booking.payments.some((p) => p.status === "COMPLETED")
            ? "Full refund will be processed within 3-5 business days"
            : "No charge occurred",
        reason: reason || "Customer requested cancellation",
      },
    };
  });
};

const adminBookingListSelect = {
  id: true,
  bookingReference: true,
  status: true,
  pickupDate: true,
  pickupTime: true,
  pickupLocation: true,
  returnDate: true,
  returnTime: true,
  rentalDays: true,
  totalPrice: true,
  createdAt: true,
  car: {
    select: {
      id: true,
      brand: true,
      model: true,
      plate: true,
      images: true,
    },
  },
  user: {
    select: {
      name: true,
      email: true,
      phoneNumber: true,
    },
  },
  bookingPersonDetails: {
    select: {
      firstName: true,
      lastName: true,
      email: true,
      phoneNumber: true,
    },
    take: 1,
  },
  payments: {
    select: {
      paymentOption: true,
      paymentMethod: true,
      status: true,
      amount: true,
    },
    take: 1,
  },
} satisfies Prisma.BookingsSelect;

const bookingStatuses = new Set<BookingStatus>([
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
]);

const returnMoment = (booking: { returnDate: Date; returnTime: string }) => {
  const date = booking.returnDate.toISOString().slice(0, 10);
  const time = booking.returnTime.includes(":") ? booking.returnTime : "10:00";
  return new Date(`${date}T${time}:00Z`);
};

const releaseBookedWindow = async (
  db: Db,
  booking: { carId: string; pickupDate: Date; returnDate: Date },
) => {
  await db.carAvailability.deleteMany({
    where: {
      carId: booking.carId,
      pickupDate: booking.pickupDate,
      returnDate: booking.returnDate,
      status: "BOOKED",
    },
  });
};

export const completeElapsedBookings = async () => {
  const candidates = await prisma.bookings.findMany({
    where: {
      status: "CONFIRMED",
      returnDate: { lte: new Date() },
    },
    select: {
      id: true,
      carId: true,
      pickupDate: true,
      returnDate: true,
      returnTime: true,
    },
  });

  const due = candidates.filter((booking) => returnMoment(booking) <= new Date());
  if (due.length === 0) return;

  await prisma.bookings.updateMany({
    where: { id: { in: due.map((booking) => booking.id) } },
    data: { status: "COMPLETED" },
  });

  for (const booking of due) {
    await releaseBookedWindow(prisma, booking);
  }
};

export const completeBooking = async (idOrRef: string) => {
  await completeElapsedBookings();

  const booking = await prisma.bookings.findFirst({
    where: {
      OR: [{ id: idOrRef }, { bookingReference: idOrRef }],
    },
  });

  if (!booking) {
    throw new Error("Booking not found");
  }

  if (booking.status === "COMPLETED") {
    return getBookingDetails(booking.id);
  }

  if (booking.status !== "CONFIRMED") {
    throw new Error("Only an active booking can be completed");
  }

  await prisma.$transaction(async (tx) => {
    await tx.bookings.update({
      where: { id: booking.id },
      data: { status: "COMPLETED" },
    });
    await releaseBookedWindow(tx, booking);
  });

  return getBookingDetails(booking.id);
};

export const getAdminBookingSummary = async () => {
  await completeElapsedBookings();

  const [
    total,
    pending,
    confirmed,
    completed,
    cancelled,
    payNow,
    payAtDesk,
    awaitingDeskPayment,
    collected,
  ] = await Promise.all([
    prisma.bookings.count(),
    prisma.bookings.count({ where: { status: "PENDING" } }),
    prisma.bookings.count({ where: { status: "CONFIRMED" } }),
    prisma.bookings.count({ where: { status: "COMPLETED" } }),
    prisma.bookings.count({ where: { status: "CANCELLED" } }),
    prisma.bookings.count({
      where: { payments: { some: { paymentOption: "PAY_NOW" } } },
    }),
    prisma.bookings.count({
      where: { payments: { some: { paymentOption: "PAY_AT_DESK" } } },
    }),
    prisma.bookings.count({
      where: {
        status: { in: ["CONFIRMED", "COMPLETED"] },
        payments: {
          some: { paymentOption: "PAY_AT_DESK", status: "PENDING_AT_DESK" },
        },
      },
    }),
    prisma.payment.aggregate({
      where: { status: "COMPLETED" },
      _sum: { amount: true },
    }),
  ]);

  return {
    total,
    pending,
    confirmed,
    completed,
    cancelled,
    payNow,
    payAtDesk,
    awaitingDeskPayment,
    collectedRevenue: collected._sum.amount ?? 0,
  };
};

export const getAllBookingsForAdmin = async (query: {
  page?: unknown;
  limit?: unknown;
  status?: unknown;
  paymentOption?: unknown;
  paymentStatus?: unknown;
  searchTerm?: unknown;
  pickupFrom?: unknown;
  pickupTo?: unknown;
  sortBy?: unknown;
  sortOrder?: unknown;
} = {}) => {
  await completeElapsedBookings();

  const where: Prisma.BookingsWhereInput = {};
  const and: Prisma.BookingsWhereInput[] = [];

  const status = String(query.status ?? "").toUpperCase();
  if (bookingStatuses.has(status as BookingStatus)) {
    where.status = status as BookingStatus;
  }

  const paymentOption = String(query.paymentOption ?? "").toUpperCase();
  if (paymentOption === "PAY_NOW" || paymentOption === "PAY_AT_DESK") {
    and.push({ payments: { some: { paymentOption } } });
  }

  const paymentStatus = String(query.paymentStatus ?? "").trim();
  if (paymentStatus) {
    and.push({ payments: { some: { status: paymentStatus } } });
  }

  const pickupFrom = query.pickupFrom ? new Date(String(query.pickupFrom)) : null;
  const pickupTo = query.pickupTo ? new Date(String(query.pickupTo)) : null;
  if (
    (pickupFrom && !Number.isNaN(pickupFrom.getTime())) ||
    (pickupTo && !Number.isNaN(pickupTo.getTime()))
  ) {
    where.pickupDate = {
      ...(pickupFrom && !Number.isNaN(pickupFrom.getTime()) ? { gte: pickupFrom } : {}),
      ...(pickupTo && !Number.isNaN(pickupTo.getTime()) ? { lte: pickupTo } : {}),
    };
  }

  const term = String(query.searchTerm ?? "").trim();
  if (term) {
    and.push({
      OR: [
        { bookingReference: { contains: term, mode: "insensitive" } },
        { pickupLocation: { contains: term, mode: "insensitive" } },
        { returnLocation: { contains: term, mode: "insensitive" } },
        {
          user: {
            OR: [
              { name: { contains: term, mode: "insensitive" } },
              { email: { contains: term, mode: "insensitive" } },
            ],
          },
        },
        {
          bookingPersonDetails: {
            some: {
              OR: [
                { firstName: { contains: term, mode: "insensitive" } },
                { lastName: { contains: term, mode: "insensitive" } },
                { email: { contains: term, mode: "insensitive" } },
                { phoneNumber: { contains: term, mode: "insensitive" } },
              ],
            },
          },
        },
        {
          car: {
            OR: [
              { brand: { contains: term, mode: "insensitive" } },
              { model: { contains: term, mode: "insensitive" } },
              { plate: { contains: term, mode: "insensitive" } },
            ],
          },
        },
      ],
    });
  }

  if (and.length > 0) where.AND = and;

  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
  const skip = (page - 1) * limit;
  const sortBy = ["createdAt", "pickupDate", "totalPrice"].includes(String(query.sortBy))
    ? String(query.sortBy)
    : "createdAt";
  const sortOrder: Prisma.SortOrder =
    String(query.sortOrder).toLowerCase() === "asc" ? "asc" : "desc";

  const [bookings, total] = await Promise.all([
    prisma.bookings.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      select: adminBookingListSelect,
    }),
    prisma.bookings.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    bookings: bookings.map((booking) => {
      const person = booking.bookingPersonDetails[0];
      const payment = booking.payments[0] ?? null;
      const customerName = person
        ? `${person.firstName} ${person.lastName}`.trim()
        : booking.user.name;

      return {
        id: booking.id,
        bookingReference: booking.bookingReference,
        status: booking.status,
        isActive: booking.status === "CONFIRMED",
        pickupDate: booking.pickupDate,
        pickupTime: booking.pickupTime,
        pickupLocation: booking.pickupLocation,
        returnDate: booking.returnDate,
        returnTime: booking.returnTime,
        rentalDays: booking.rentalDays,
        totalPrice: booking.totalPrice,
        createdAt: booking.createdAt,
        customer: {
          name: customerName,
          email: person?.email ?? booking.user.email,
          phoneNumber: person?.phoneNumber ?? booking.user.phoneNumber,
        },
        car: {
          id: booking.car.id,
          brand: booking.car.brand,
          model: booking.car.model,
          plate: booking.car.plate,
          image: booking.car.images[0] ?? null,
        },
        payment: payment
          ? {
              paymentOption: payment.paymentOption,
              paymentMethod: payment.paymentMethod,
              status: payment.status,
              amount: payment.amount,
            }
          : null,
      };
    }),
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
};

export const collectDeskPayment = async (idOrRef: string) => {
  const booking = await prisma.bookings.findFirst({
    where: {
      OR: [{ id: idOrRef }, { bookingReference: idOrRef }],
    },
    include: { payments: true },
  });

  if (!booking) {
    throw new Error("Booking not found");
  }

  if (booking.status === "CANCELLED") {
    throw new Error("Cannot collect payment for a cancelled booking");
  }

  if (booking.status !== "CONFIRMED" && booking.status !== "COMPLETED") {
    throw new Error("Booking is not active yet");
  }

  const payment =
    booking.payments.find((item) => item.paymentOption === "PAY_AT_DESK") ?? null;

  if (!payment) {
    throw new Error("This booking is not a pay at desk booking");
  }

  if (payment.status !== "COMPLETED") {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "COMPLETED",
        transactionId: payment.transactionId ?? `desk_${Date.now()}`,
      },
    });
  }

  return getBookingDetails(booking.id);
};
