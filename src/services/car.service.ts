import type { Request } from "express";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/app-error.js";
import { uploadFilesToMinio, deleteFileFromMinio } from "./minio.service.js";
import { formatPublicDriverInfo } from "./driver.service.js";
import {
  CarType,
  TransmissionType,
  FuelType,
  type Prisma,
} from "@prisma/client";

const parseArray = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [value];
  }
  return [];
};

export const addNewCar = async (req: Request) => {
  // Normalize body keys to strip any accidental tabs or whitespace
  const rawBody: Record<string, any> = {};
  for (const [key, value] of Object.entries(req.body || {})) {
    rawBody[key.trim()] = value;
  }

  const {
    brand,
    model,
    year,
    color,
    plate,
    pricePerDay,
    totalSeat,
    doors,
    mileage,
    fuelType,
    transmission,
    carType,
    images,
    videoUrl,
    features,
    safetyRatings,
    description,
  } = rawBody;

  const requiredFields = [
    { field: "brand", val: brand },
    { field: "model", val: model },
    { field: "year", val: year },
    { field: "color", val: color },
    { field: "plate", val: plate },
    { field: "pricePerDay", val: pricePerDay },
    { field: "totalSeat", val: totalSeat },
    { field: "doors", val: doors },
    { field: "mileage", val: mileage },
    { field: "fuelType", val: fuelType },
    { field: "transmission", val: transmission },
    { field: "carType", val: carType },
    { field: "description", val: description },
  ];

  const missing = requiredFields
    .filter(
      (f) =>
        f.val === undefined ||
        f.val === null ||
        (typeof f.val === "string" && f.val.trim() === ""),
    )
    .map((f) => f.field);

  if (missing.length > 0) {
    throw new AppError(
      400,
      `Missing required car fields: ${missing.join(", ")}`,
    );
  }

  const existingCar = await prisma.car.findUnique({
    where: { plate },
  });

  if (existingCar) {
    throw new AppError(400, "Car with this plate already exists");
  }

  // Handle image files uploaded via Multer
  const files =
    (req.files as Express.Multer.File[]) || (req.file ? [req.file] : []);

  // Upload to MinIO and get public URLs
  const uploadedImageUrls = await uploadFilesToMinio(files, "cars");

  // Also include any image URLs passed directly in the body
  const bodyImages = parseArray(images);
  const allImages = [...uploadedImageUrls, ...bodyImages];

  const parsedYear = Number(year);
  const parsedPricePerDay = Number(pricePerDay);
  const parsedTotalSeat = Number(totalSeat);
  const parsedDoors = Number(doors);

  if (
    Number.isNaN(parsedYear) ||
    Number.isNaN(parsedPricePerDay) ||
    Number.isNaN(parsedTotalSeat) ||
    Number.isNaN(parsedDoors)
  ) {
    throw new AppError(
      400,
      "Year, pricePerDay, totalSeat, and doors must be valid numbers",
    );
  }

  const car = await prisma.car.create({
    data: {
      brand: String(brand).trim(),
      model: String(model).trim(),
      year: parsedYear,
      color: String(color).trim(),
      plate: String(plate).trim(),
      pricePerDay: parsedPricePerDay,
      totalSeat: parsedTotalSeat,
      doors: parsedDoors,
      mileage: String(mileage).trim(),
      fuelType: fuelType as FuelType,
      transmission: transmission as TransmissionType,
      carType: carType as CarType,
      images: allImages,
      videoUrl: videoUrl ? String(videoUrl).trim() : null,
      features: parseArray(features),
      safetyRatings: parseArray(safetyRatings),
      description: String(description).trim(),
    },
  });

  return car;
};

export interface CarQueryFilters {
  page?: string | number;
  limit?: string | number;
  carType?: string;
  vehicleType?: string;
  transmission?: string;
  minPrice?: string | number;
  maxPrice?: string | number;
  pricePerDay?: string | number;
  fuelType?: string;
  brand?: string;
  searchTerm?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  // Location, Date, Time & Driver Age filters (all optional)
  pickupLocation?: string;
  pickupDate?: string;
  pickupTime?: string;
  returnLocation?: string;
  returnDate?: string;
  returnTime?: string;
  age?: string | number;
}

export const getAllCars = async (filters: CarQueryFilters = {}) => {
  const where: Prisma.CarWhereInput = {
    isAvailable: true,
  };

  const andConditions: Prisma.CarWhereInput[] = [];

  // 1. Filter by vehicle/car type
  const targetCarType = filters.carType || filters.vehicleType;
  if (targetCarType) {
    const matchedType = Object.values(CarType).find(
      (type) => type.toLowerCase() === targetCarType.toLowerCase(),
    );
    if (matchedType) {
      where.carType = matchedType;
    }
  }

  // 2. Filter by transmission (MANUAL, AUTOMATIC)
  if (filters.transmission) {
    const matchedTransmission = Object.values(TransmissionType).find(
      (t) => t.toLowerCase() === filters.transmission?.toLowerCase(),
    );
    if (matchedTransmission) {
      where.transmission = matchedTransmission;
    }
  }

  // 3. Filter by pricePerDay (supports minPrice, maxPrice, or max pricePerDay budget)
  if (
    filters.minPrice !== undefined ||
    filters.maxPrice !== undefined ||
    filters.pricePerDay !== undefined
  ) {
    const priceFilter: Prisma.FloatFilter = {};

    if (filters.minPrice !== undefined && !Number.isNaN(Number(filters.minPrice))) {
      priceFilter.gte = Number(filters.minPrice);
    }

    if (filters.maxPrice !== undefined && !Number.isNaN(Number(filters.maxPrice))) {
      priceFilter.lte = Number(filters.maxPrice);
    } else if (
      filters.pricePerDay !== undefined &&
      !Number.isNaN(Number(filters.pricePerDay))
    ) {
      priceFilter.lte = Number(filters.pricePerDay);
    }

    if (Object.keys(priceFilter).length > 0) {
      where.pricePerDay = priceFilter;
    }
  }

  // 4. Filter by pickup location (checks carAvailabilities or cars without location restriction)
  if (filters.pickupLocation) {
    const loc = String(filters.pickupLocation).trim();
    andConditions.push({
      OR: [
        {
          carAvailabilities: {
            some: {
              pickupLocation: { contains: loc, mode: "insensitive" },
              status: "AVAILABLE",
            },
          },
        },
        {
          carAvailabilities: { none: {} },
        },
      ],
    });
  }

  // 5. Filter by return location if provided
  if (filters.returnLocation) {
    const retLoc = String(filters.returnLocation).trim();
    andConditions.push({
      OR: [
        {
          carAvailabilities: {
            some: {
              returnLocation: { contains: retLoc, mode: "insensitive" },
              status: "AVAILABLE",
            },
          },
        },
        {
          carAvailabilities: { none: {} },
        },
      ],
    });
  }

  // 6. Filter by pickupDate and returnDate (ensures car has no overlapping bookings)
  if (filters.pickupDate || filters.returnDate) {
    const pDate = filters.pickupDate ? new Date(filters.pickupDate) : null;
    const rDate = filters.returnDate
      ? new Date(filters.returnDate)
      : pDate;

    if (pDate && !Number.isNaN(pDate.getTime()) && rDate && !Number.isNaN(rDate.getTime())) {
      andConditions.push({
        bookings: {
          none: {
            pickupDate: { lte: rDate },
            returnDate: { gte: pDate },
            OR: [
              { status: "CONFIRMED" },
              {
                status: "PENDING",
                OR: [
                  { holdExpiresAt: null },
                  { holdExpiresAt: { gt: new Date() } },
                ],
              },
            ],
          },
        },
      });

      andConditions.push({
        carAvailabilities: {
          none: {
            status: "MAINTENANCE",
            pickupDate: { lte: rDate },
            returnDate: { gte: pDate },
          },
        },
      });
    }
  }

  // 7. Filter by driver age (car is eligible if self-drive/no driver assigned OR driver age requirement is met)
  if (filters.age !== undefined && filters.age !== null && filters.age !== "") {
    const renterAge = Number(filters.age);
    if (!Number.isNaN(renterAge)) {
      andConditions.push({
        OR: [
          { driverInfoId: null },
          { driverInfo: { age: { lte: renterAge } } },
        ],
      });
    }
  }

  // 8. Optional brand filter
  if (filters.brand) {
    where.brand = { contains: String(filters.brand).trim(), mode: "insensitive" };
  }

  // 9. Optional fuelType filter
  if (filters.fuelType) {
    const matchedFuel = Object.values(FuelType).find(
      (f) => f.toLowerCase() === filters.fuelType?.toLowerCase(),
    );
    if (matchedFuel) {
      where.fuelType = matchedFuel;
    }
  }

  // 10. Optional search term (matches brand, model, or description)
  if (filters.searchTerm) {
    const term = String(filters.searchTerm).trim();
    andConditions.push({
      OR: [
        { brand: { contains: term, mode: "insensitive" } },
        { model: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
      ],
    });
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  // Pagination parameters
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(filters.limit) || 10));
  const skip = (page - 1) * limit;

  // Sorting
  const allowedSortFields = ["createdAt", "pricePerDay", "year", "brand", "model"];
  const sortBy = allowedSortFields.includes(String(filters.sortBy))
    ? String(filters.sortBy)
    : "createdAt";
  const sortOrder: Prisma.SortOrder =
    filters.sortOrder?.toLowerCase() === "asc" ? "asc" : "desc";

  const [cars, total] = await Promise.all([
    prisma.car.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        driverInfo: true,
        carAvailabilities: {
          where: { status: "AVAILABLE" },
          take: 5,
        },
      },
    }),
    prisma.car.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    cars: cars.map((car) => ({
      ...car,
      driverInfo: formatPublicDriverInfo(car.driverInfo),
    })),
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

export const searchCars = async (filters: CarQueryFilters = {}) => {
  const result = await getAllCars(filters);

  return {
    ...result,
    searchCriteria: {
      pickupLocation: filters.pickupLocation || null,
      pickupDate: filters.pickupDate || null,
      pickupTime: filters.pickupTime || null,
      returnLocation: filters.returnLocation || null,
      returnDate: filters.returnDate || null,
      returnTime: filters.returnTime || null,
      age:
        filters.age !== undefined && filters.age !== null && filters.age !== ""
          ? Number(filters.age)
          : null,
    },
  };
};

export const getCarById = async (id: string) => {
  const now = new Date();
  const car = await prisma.car.findUnique({
    where: { id },
    include: {
      reviews: true,
      carAvailabilities: true,
      driverInfo: true,
      bookings: {
        where: {
          OR: [
            { status: "CONFIRMED" },
            {
              status: "PENDING",
              OR: [{ holdExpiresAt: null }, { holdExpiresAt: { gt: now } }],
            },
          ],
        },
        select: {
          status: true,
          pickupDate: true,
          pickupTime: true,
          returnDate: true,
          returnTime: true,
          pickupLocation: true,
          returnLocation: true,
        },
        orderBy: { pickupDate: "asc" },
      },
    },
  });

  if (!car) {
    throw new AppError(404, "Car not found");
  }

  const { bookings, ...carData } = car;

  return {
    ...carData,
    driverInfo: formatPublicDriverInfo(car.driverInfo),
    bookedDates: bookings.map((booking) => ({
      status: booking.status,
      pickupDate: booking.pickupDate,
      pickupTime: booking.pickupTime,
      pickupLocation: booking.pickupLocation,
      returnDate: booking.returnDate,
      returnTime: booking.returnTime,
      returnLocation: booking.returnLocation,
    })),
  };
};


export const updateCarById = async (id: string, req: Request) => {
  const existingCar = await prisma.car.findUnique({
    where: { id },
  });

  if (!existingCar) {
    throw new AppError(404, "Car not found");
  }

  // Normalize body keys to strip any accidental tabs or whitespace
  const rawBody: Record<string, any> = {};
  for (const [key, value] of Object.entries(req.body || {})) {
    rawBody[key.trim()] = value;
  }

  const {
    brand,
    model,
    year,
    color,
    plate,
    pricePerDay,
    totalSeat,
    doors,
    mileage,
    fuelType,
    transmission,
    carType,
    images,
    videoUrl,
    features,
    safetyRatings,
    description,
  } = rawBody;

  // Check plate uniqueness if changing
  if (plate && plate !== existingCar.plate) {
    const duplicate = await prisma.car.findUnique({
      where: { plate },
    });
    if (duplicate) {
      throw new AppError(400, "Car with this plate already exists");
    }
  }

  // Handle image updates: remove previous images from MinIO if new ones are uploaded/provided
  const files =
    (req.files as Express.Multer.File[]) || (req.file ? [req.file] : []);
  const newUploadedUrls = await uploadFilesToMinio(files, "cars");

  let updatedImages: string[] | undefined = undefined;

  if (newUploadedUrls.length > 0 || images !== undefined) {
    if (newUploadedUrls.length > 0 && images === undefined) {
      // User uploaded new image file(s): replace existing images completely
      updatedImages = newUploadedUrls;
    } else {
      // User passed images list in body + any new uploaded files
      const baseImages = images !== undefined ? parseArray(images) : [];
      updatedImages = [...baseImages, ...newUploadedUrls];
    }

    // Delete previous images from MinIO that are not in the new image list
    if (existingCar.images && existingCar.images.length > 0) {
      const imagesToDelete = existingCar.images.filter(
        (oldImg) => !updatedImages?.includes(oldImg),
      );

      if (imagesToDelete.length > 0) {
        await Promise.all(
          imagesToDelete.map((oldImg) => deleteFileFromMinio(oldImg)),
        );
      }
    }
  }

  const updateData: Record<string, any> = {};

  if (brand !== undefined) updateData.brand = String(brand).trim();
  if (model !== undefined) updateData.model = String(model).trim();
  if (year !== undefined && !Number.isNaN(Number(year))) updateData.year = Number(year);
  if (color !== undefined) updateData.color = String(color).trim();
  if (plate !== undefined) updateData.plate = String(plate).trim();
  if (pricePerDay !== undefined && !Number.isNaN(Number(pricePerDay)))
    updateData.pricePerDay = Number(pricePerDay);
  if (totalSeat !== undefined && !Number.isNaN(Number(totalSeat)))
    updateData.totalSeat = Number(totalSeat);
  if (doors !== undefined && !Number.isNaN(Number(doors)))
    updateData.doors = Number(doors);
  if (mileage !== undefined) updateData.mileage = String(mileage).trim();
  if (fuelType !== undefined) updateData.fuelType = fuelType as FuelType;
  if (transmission !== undefined)
    updateData.transmission = transmission as TransmissionType;
  if (carType !== undefined) updateData.carType = carType as CarType;
  if (updatedImages !== undefined) updateData.images = updatedImages;
  if (videoUrl !== undefined)
    updateData.videoUrl = videoUrl ? String(videoUrl).trim() : null;
  if (features !== undefined) updateData.features = parseArray(features);
  if (safetyRatings !== undefined)
    updateData.safetyRatings = parseArray(safetyRatings);
  if (description !== undefined) updateData.description = String(description).trim();

  const car = await prisma.car.update({
    where: { id },
    data: updateData,
  });

  return car;
};

export const deleteCarById = async (id: string) => {
  const car = await prisma.car.findUnique({
    where: { id },
  });

  if (!car) {
    throw new AppError(404, "Car not found");
  }

  // Delete images from MinIO
  if (car.images && car.images.length > 0) {
    await Promise.all(car.images.map((img) => deleteFileFromMinio(img)));
  }

  await prisma.car.delete({
    where: { id },
  });

  return car;
};