import type { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/app-error.js";
import type {
  CreateDriverInput,
  UpdateDriverInput,
} from "../validators/driver.validator.js";

const driverInclude = {
  cars: {
    select: {
      id: true,
      brand: true,
      model: true,
      year: true,
      plate: true,
    },
  },
  _count: {
    select: {
      bookings: true,
      cars: true,
    },
  },
} satisfies Prisma.DriverInfoInclude;

type DriverRecord = Prisma.DriverInfoGetPayload<{
  include: typeof driverInclude;
}>;

type PublicDriverSource = {
  dateOfBirth: Date;
  age: number;
  licenseState: string;
  licenseNumber: string;
  licenseExpiry: Date;
} | null | undefined;

const formatDateOnly = (date: Date) => date.toISOString().slice(0, 10);

export const formatPublicDriverInfo = (driver: PublicDriverSource) => {
  if (!driver) return null;

  return {
    dateOfBirth: formatDateOnly(driver.dateOfBirth),
    age: `${driver.age}+`,
    licenseState: driver.licenseState,
    licenseNumber: driver.licenseNumber,
    licenseExpiry: formatDateOnly(driver.licenseExpiry),
  };
};

const toAdminDriver = (driver: DriverRecord) => ({
  id: driver.id,
  name: driver.name,
  phoneNumber: driver.phoneNumber,
  email: driver.email,
  dateOfBirth: formatDateOnly(driver.dateOfBirth),
  age: driver.age,
  licenseNumber: driver.licenseNumber,
  licenseState: driver.licenseState,
  licenseExpiry: formatDateOnly(driver.licenseExpiry),
  createdAt: driver.createdAt,
  updatedAt: driver.updatedAt,
  cars: driver.cars,
  bookingsCount: driver._count.bookings,
});

const parseDateOnly = (value: string, field: string) => {
  const datePart = value.split("T")[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    throw new AppError(400, `${field} must be YYYY-MM-DD`);
  }

  const date = new Date(`${datePart}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== datePart
  ) {
    throw new AppError(400, `${field} is not a valid date`);
  }

  return date;
};

const parseDriverAge = (value: number | string) => {
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 18 || value > 100) {
      throw new AppError(400, "Age must be a whole number between 18 and 100");
    }
    return value;
  }

  const match = value.trim().match(/^(\d{2,3})\+?$/);
  if (!match) {
    throw new AppError(400, 'Age must look like 25 or "25+"');
  }

  const parsed = Number(match[1]);
  if (parsed < 18 || parsed > 100) {
    throw new AppError(400, "Age must be between 18 and 100");
  }

  return parsed;
};

const assertLicenseDates = (dateOfBirth: Date, licenseExpiry: Date) => {
  if (licenseExpiry < dateOfBirth) {
    throw new AppError(400, "License expiry cannot be earlier than date of birth");
  }
};

const assertLicenseAvailable = async (
  licenseNumber: string,
  excludeId?: string,
) => {
  const existing = await prisma.driverInfo.findFirst({
    where: {
      licenseNumber,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  });

  if (existing) {
    throw new AppError(409, "A driver with this license number already exists");
  }
};

export const createDriver = async (input: CreateDriverInput) => {
  const dateOfBirth = parseDateOnly(input.dateOfBirth, "dateOfBirth");
  const licenseExpiry = parseDateOnly(input.licenseExpiry, "licenseExpiry");
  assertLicenseDates(dateOfBirth, licenseExpiry);
  await assertLicenseAvailable(input.licenseNumber);

  const driver = await prisma.driverInfo.create({
    data: {
      name: input.name,
      phoneNumber: input.phoneNumber,
      email: input.email,
      dateOfBirth,
      age: parseDriverAge(input.age),
      licenseNumber: input.licenseNumber,
      licenseState: input.licenseState.trim().toUpperCase(),
      licenseExpiry,
    },
    include: driverInclude,
  });

  return toAdminDriver(driver);
};

export const getAllDrivers = async (query: {
  page?: unknown;
  limit?: unknown;
  searchTerm?: unknown;
} = {}) => {
  const where: Prisma.DriverInfoWhereInput = {};

  if (query.searchTerm !== undefined && query.searchTerm !== null) {
    const term = String(query.searchTerm).trim();
    if (term) {
      where.OR = [
        { name: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
        { phoneNumber: { contains: term, mode: "insensitive" } },
        { licenseNumber: { contains: term, mode: "insensitive" } },
        { licenseState: { contains: term, mode: "insensitive" } },
      ];
    }
  }

  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
  const skip = (page - 1) * limit;

  const [drivers, total] = await Promise.all([
    prisma.driverInfo.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: driverInclude,
    }),
    prisma.driverInfo.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    drivers: drivers.map(toAdminDriver),
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

export const getDriverById = async (id: string) => {
  const driver = await prisma.driverInfo.findUnique({
    where: { id },
    include: driverInclude,
  });

  if (!driver) {
    throw new AppError(404, "Driver not found");
  }

  return toAdminDriver(driver);
};

export const updateDriver = async (id: string, input: UpdateDriverInput) => {
  const existing = await prisma.driverInfo.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new AppError(404, "Driver not found");
  }

  const data: Prisma.DriverInfoUpdateInput = {};

  if (input.name !== undefined) data.name = input.name;
  if (input.phoneNumber !== undefined) data.phoneNumber = input.phoneNumber;
  if (input.email !== undefined) data.email = input.email;
  if (input.licenseState !== undefined) {
    data.licenseState = input.licenseState.trim().toUpperCase();
  }
  if (input.licenseNumber !== undefined) {
    await assertLicenseAvailable(input.licenseNumber, id);
    data.licenseNumber = input.licenseNumber;
  }
  if (input.age !== undefined) data.age = parseDriverAge(input.age);
  if (input.dateOfBirth !== undefined) {
    data.dateOfBirth = parseDateOnly(input.dateOfBirth, "dateOfBirth");
  }
  if (input.licenseExpiry !== undefined) {
    data.licenseExpiry = parseDateOnly(input.licenseExpiry, "licenseExpiry");
  }

  if (Object.keys(data).length === 0) {
    throw new AppError(400, "No fields to update");
  }

  const dateOfBirth =
    data.dateOfBirth instanceof Date ? data.dateOfBirth : existing.dateOfBirth;
  const licenseExpiry =
    data.licenseExpiry instanceof Date
      ? data.licenseExpiry
      : existing.licenseExpiry;
  assertLicenseDates(dateOfBirth, licenseExpiry);

  const driver = await prisma.driverInfo.update({
    where: { id },
    data,
    include: driverInclude,
  });

  return toAdminDriver(driver);
};

export const deleteDriver = async (id: string) => {
  const driver = await prisma.driverInfo.findUnique({
    where: { id },
    include: driverInclude,
  });

  if (!driver) {
    throw new AppError(404, "Driver not found");
  }

  if (driver._count.bookings > 0) {
    throw new AppError(
      409,
      "This driver is linked to existing bookings and cannot be removed",
    );
  }

  const unassignedCarIds = driver.cars.map((car) => car.id);

  await prisma.$transaction([
    prisma.car.updateMany({
      where: { driverInfoId: driver.id },
      data: { driverInfoId: null },
    }),
    prisma.driverInfo.delete({
      where: { id: driver.id },
    }),
  ]);

  return {
    id: driver.id,
    unassignedCarIds,
  };
};

export const assignDriverToCar = async (
  carId: string,
  driverId: string | null,
) => {
  const car = await prisma.car.findUnique({
    where: { id: carId },
  });

  if (!car) {
    throw new AppError(404, "Car not found");
  }

  if (driverId) {
    const driver = await prisma.driverInfo.findUnique({
      where: { id: driverId },
    });

    if (!driver) {
      throw new AppError(404, "Driver not found");
    }
  }

  const updated = await prisma.car.update({
    where: { id: carId },
    data: { driverInfoId: driverId },
    include: {
      driverInfo: {
        include: driverInclude,
      },
    },
  });

  return {
    id: updated.id,
    brand: updated.brand,
    model: updated.model,
    plate: updated.plate,
    driverInfoId: updated.driverInfoId,
    driver: updated.driverInfo ? toAdminDriver(updated.driverInfo) : null,
    driverInfo: formatPublicDriverInfo(updated.driverInfo),
  };
};
