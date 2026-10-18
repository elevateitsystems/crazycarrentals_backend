import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma.js";

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
  driverInfo?: {
    name?: string;
    phoneNumber?: string;
    email?: string;
    dateOfBirth?: string;
    age?: number;
    licenseState?: string;
    licenseNumber?: string;
    licenseExpiry?: string;
  };
  payment: {
    paymentOption: "PAY_NOW" | "PAY_AT_DESK";
    paymentMethod?: string;
    cardDetails?: {
      cardNumber?: string;
      nameOnCard?: string;
      expiryDate?: string;
      cvv?: string;
    };
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

  // Check existing conflicting bookings
  const conflictingBookings = await prisma.bookings.findMany({
    where: {
      carId: input.carId,
      status: { in: ["CONFIRMED", "PENDING"] },
      pickupDate: { lte: rDate },
      returnDate: { gte: pDate },
    },
  });

  const isAvailable = car.isAvailable && conflictingBookings.length === 0;

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
  const discount = isPayNow
    ? Number(((subtotal * PAY_NOW_DISCOUNT_PERCENT) / 100).toFixed(2))
    : 0;

  const totalPrice = Number((subtotal - discount).toFixed(2));

  return {
    car: {
      id: car.id,
      brand: car.brand,
      model: car.model,
      year: car.year,
      carType: car.carType,
      transmission: car.transmission,
      totalSeat: car.totalSeat,
      pricePerDay: car.pricePerDay,
      images: car.images,
    },
    isAvailable,
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
      paymentOption: input.paymentOption || "PAY_NOW",
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
    // 1. Verify car
    const car = await tx.car.findUnique({
      where: { id: input.carId },
    });

    if (!car) {
      throw new Error("Selected car does not exist");
    }

    if (!car.isAvailable) {
      throw new Error("Selected car is currently not available for rent");
    }

    // 2. Check overlap
    const conflict = await tx.bookings.findFirst({
      where: {
        carId: input.carId,
        status: { in: ["CONFIRMED", "PENDING"] },
        pickupDate: { lte: rDate },
        returnDate: { gte: pDate },
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

    // 6. Create Driver Info
    const dob = new Date(input.driverInfo.dateOfBirth);
    const licenceExpiry = new Date(input.driverInfo.licenseExpiry);

    const driverRecord = await tx.driverInfo.create({
      data: {
        name:
          input.driverInfo.name ||
          `${input.bookingPersonDetails.firstName} ${input.bookingPersonDetails.lastName}`.trim(),
        phoneNumber:
          input.driverInfo.phoneNumber || input.bookingPersonDetails.phoneNumber,
        email:
          input.driverInfo.email ||
          input.bookingPersonDetails.email.trim().toLowerCase(),
        dateOfBirth: !Number.isNaN(dob.getTime()) ? dob : new Date("1995-01-01"),
        age: Number(input.driverInfo.age) || 25,
        licenseState: input.driverInfo.licenseState,
        licenseNumber: input.driverInfo.licenseNumber,
        licenseExpiry: !Number.isNaN(licenceExpiry.getTime())
          ? licenceExpiry
          : new Date("2028-01-01"),
      },
    });

    // 7. Create Booking
    const booking = await tx.bookings.create({
      data: {
        bookingReference,
        carId: car.id,
        userId: bookingUserId,
        driverInfoId: driverRecord.id,
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
        status: "CONFIRMED",
        extraServices: {
          connect: extras.map((e) => ({ id: e.id })),
        },
      },
    });

    // 8. Create Booking Person Details
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

    // 10. Create Payment
    const cardLast4 = input.payment.cardDetails?.cardNumber
      ? input.payment.cardDetails.cardNumber.replace(/\s+/g, "").slice(-4)
      : "4642";

    const paymentTxnId = `txn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    await tx.payment.create({
      data: {
        bookingId: booking.id,
        paymentOption: input.payment.paymentOption,
        paymentMethod: input.payment.paymentMethod || "Credit Card",
        status: isPayNow ? "COMPLETED" : "PENDING_AT_DESK",
        amount: totalPrice,
        transactionId: paymentTxnId,
        cardLast4,
        cardBrand: "Visa",
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
    return tx.bookings.findUnique({
      where: { id: booking.id },
      include: {
        car: true,
        driverInfo: true,
        bookingPersonDetails: true,
        airportShuttles: true,
        extraServices: true,
        payments: true,
      },
    });
  });
};

// 4. Get User's bookings
export const getUserBookings = async (
  userId: string,
  query: { page?: number | string; limit?: number | string; status?: string }
) => {
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
    bookings,
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
  const booking = await prisma.bookings.findFirst({
    where: {
      OR: [{ id: idOrRef }, { bookingReference: idOrRef }],
    },
    include: {
      car: true,
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

  return booking;
};

// 6. Cancel booking (free cancellation up to 24 hrs before pickup)
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
        car: true,
        payments: true,
        bookingPersonDetails: true,
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
      booking: updatedBooking,
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
