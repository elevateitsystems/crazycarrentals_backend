import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/app-error.js";
import type { SetCarDailyRatesInput } from "../validators/car-rate.validator.js";

const MAX_RANGE_DAYS = 366;

export type VehicleDayRate = {
  date: string;
  price: number;
};

const roundMoney = (value: number) => Number(value.toFixed(2));

export const parseDateOnly = (value: string) => {
  const datePart = value.split("T")[0] ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    throw new AppError(400, "Date must be YYYY-MM-DD");
  }

  const date = new Date(`${datePart}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== datePart
  ) {
    throw new AppError(400, `${datePart} is not a valid date`);
  }

  return date;
};

const BUSINESS_TIME_ZONE = "Australia/Hobart";

const formatDateOnly = (date: Date) => date.toISOString().slice(0, 10);

export const displayRateDate = (value?: unknown) => {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw === "string" && raw.trim()) {
    const datePart = raw.trim().split("T")[0] ?? "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      const date = new Date(`${datePart}T00:00:00.000Z`);
      if (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === datePart
      ) {
        return date;
      }
    }
  }

  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
  });
  return new Date(`${today}T00:00:00.000Z`);
};

export const applyDisplayedDailyPrice = async <
  T extends { id: string; pricePerDay: number },
>(
  cars: T[],
  onDate: Date,
) => {
  if (cars.length === 0) return [];

  const saved = await prisma.carDailyRate.findMany({
    where: { carId: { in: cars.map((car) => car.id) }, date: onDate },
    select: { carId: true, price: true },
  });
  const customPrices = new Map(saved.map((rate) => [rate.carId, rate.price]));

  return cars.map((car) => ({
    ...car,
    basePricePerDay: car.pricePerDay,
    pricePerDay: customPrices.get(car.id) ?? car.pricePerDay,
  }));
};

const addUtcDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const eachDate = (from: Date, to: Date) => {
  const dates: Date[] = [];
  for (let cursor = from; cursor <= to; cursor = addUtcDays(cursor, 1)) {
    dates.push(cursor);
    if (dates.length > MAX_RANGE_DAYS) {
      throw new AppError(400, `A rate range cannot be longer than ${MAX_RANGE_DAYS} days`);
    }
  }
  return dates;
};

export const rentalChargeDates = (pickupDate: string, rentalDays: number) => {
  const start = parseDateOnly(pickupDate);
  return Array.from({ length: rentalDays }, (_, index) =>
    addUtcDays(start, index),
  );
};

const requireCar = async (carId: string) => {
  const car = await prisma.car.findUnique({
    where: { id: carId },
    select: { id: true, pricePerDay: true },
  });

  if (!car) {
    throw new AppError(404, "Car not found");
  }

  return car;
};

const toDay = (
  date: Date,
  basePrice: number,
  customPrices: Map<string, number>,
) => {
  const key = formatDateOnly(date);
  const custom = customPrices.get(key);
  return {
    date: key,
    price: custom ?? basePrice,
    isCustom: custom !== undefined,
  };
};

export const getCarDailyRates = async (
  carId: string,
  fromValue: string,
  toValue: string,
) => {
  const car = await requireCar(carId);
  const from = parseDateOnly(fromValue);
  const to = parseDateOnly(toValue);
  if (from > to) {
    throw new AppError(400, "The end date cannot be earlier than the start date");
  }

  const dates = eachDate(from, to);
  const saved = await prisma.carDailyRate.findMany({
    where: { carId, date: { gte: from, lte: to } },
    select: { date: true, price: true },
  });
  const customPrices = new Map(
    saved.map((rate) => [formatDateOnly(rate.date), rate.price]),
  );

  return {
    carId,
    basePricePerDay: car.pricePerDay,
    from: formatDateOnly(from),
    to: formatDateOnly(to),
    days: dates.map((date) => toDay(date, car.pricePerDay, customPrices)),
  };
};

export const setCarDailyRates = async (
  carId: string,
  input: SetCarDailyRatesInput,
) => {
  const car = await requireCar(carId);
  const prices = new Map<string, number | null>();

  for (const range of input.ranges) {
    for (const date of eachDate(parseDateOnly(range.from), parseDateOnly(range.to))) {
      prices.set(formatDateOnly(date), roundMoney(range.price));
    }
  }

  for (const rate of input.rates) {
    prices.set(rate.date, rate.price === null ? null : roundMoney(rate.price));
  }

  if (prices.size > MAX_RANGE_DAYS) {
    throw new AppError(
      400,
      `Set at most ${MAX_RANGE_DAYS} dates in one request`,
    );
  }

  const toSave = [...prices.entries()].filter(
    (entry): entry is [string, number] => entry[1] !== null,
  );
  const toClear = [...prices.entries()]
    .filter((entry) => entry[1] === null)
    .map(([date]) => parseDateOnly(date));

  await prisma.$transaction([
    ...toSave.map(([date, price]) =>
      prisma.carDailyRate.upsert({
        where: { carId_date: { carId, date: parseDateOnly(date) } },
        create: { carId, date: parseDateOnly(date), price },
        update: { price },
      }),
    ),
    ...(toClear.length > 0
      ? [
          prisma.carDailyRate.deleteMany({
            where: { carId, date: { in: toClear } },
          }),
        ]
      : []),
  ]);

  const savedDates = [...prices.keys()].sort();
  return getCarDailyRates(car.id, savedDates[0], savedDates[savedDates.length - 1]);
};

export const quoteVehicleStay = async (
  carId: string,
  basePricePerDay: number,
  pickupDate: string,
  rentalDays: number,
) => {
  const dates = rentalChargeDates(pickupDate, rentalDays);
  const saved = await prisma.carDailyRate.findMany({
    where: {
      carId,
      date: { gte: dates[0], lte: dates[dates.length - 1] },
    },
    select: { date: true, price: true },
  });
  const customPrices = new Map(
    saved.map((rate) => [formatDateOnly(rate.date), rate.price]),
  );
  const days = dates.map((date) => {
    const priced = toDay(date, basePricePerDay, customPrices);
    return { date: priced.date, price: priced.price };
  });
  const total = roundMoney(days.reduce((sum, day) => sum + day.price, 0));

  return { days, total, lines: groupVehicleRateLines(days) };
};

export const groupVehicleRateLines = (days: VehicleDayRate[]) => {
  const groups: Array<{ days: number; price: number }> = [];

  for (const day of days) {
    const current = groups[groups.length - 1];
    if (current && current.price === day.price) {
      current.days += 1;
    } else {
      groups.push({ days: 1, price: day.price });
    }
  }

  return groups.map((group) => ({
    label: `${group.days} ${group.days === 1 ? "day" : "days"} × $${group.price}`,
    amount: roundMoney(group.days * group.price),
  }));
};

export const readVehicleDailyRates = (value: unknown): VehicleDayRate[] | null => {
  if (!Array.isArray(value)) return null;

  const days = value.flatMap((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      typeof (item as { date?: unknown }).date !== "string" ||
      typeof (item as { price?: unknown }).price !== "number"
    ) {
      return [];
    }

    return [
      {
        date: (item as { date: string }).date,
        price: (item as { price: number }).price,
      },
    ];
  });

  return days.length === value.length && days.length > 0 ? days : null;
};
