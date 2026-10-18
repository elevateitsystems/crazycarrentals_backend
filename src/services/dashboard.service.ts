import { prisma } from "../config/prisma.js";
import { completeElapsedBookings } from "./booking.service.js";

const money = (value: number | null | undefined) => Number((value ?? 0).toFixed(2));

export const getAdminDashboard = async () => {
  await completeElapsedBookings();

  const [
    collected,
    bookings,
    pending,
    confirmed,
    completed,
    cancelled,
    cars,
    availableCars,
    users,
    drivers,
  ] = await Promise.all([
    prisma.payment.aggregate({
      where: { status: "COMPLETED" },
      _sum: { amount: true },
    }),
    prisma.bookings.count(),
    prisma.bookings.count({ where: { status: "PENDING" } }),
    prisma.bookings.count({ where: { status: "CONFIRMED" } }),
    prisma.bookings.count({ where: { status: "COMPLETED" } }),
    prisma.bookings.count({ where: { status: "CANCELLED" } }),
    prisma.car.count(),
    prisma.car.count({ where: { isAvailable: true } }),
    prisma.user.count({ where: { role: "USER" } }),
    prisma.driverInfo.count(),
  ]);

  return {
    revenue: {
      collected: money(collected._sum.amount),
    },
    bookings: {
      total: bookings,
      pending,
      confirmed,
      completed,
      cancelled,
    },
    cars: {
      total: cars,
      available: availableCars,
    },
    users: {
      total: users,
    },
    drivers: {
      total: drivers,
    },
  };
};
