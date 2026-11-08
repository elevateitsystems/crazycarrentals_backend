import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/app-error.js";
import type {
  CreateProtectionInput,
  UpdateProtectionInput,
} from "../validators/protection.validator.js";

const protectionInclude = {
  _count: {
    select: { bookings: true },
  },
} as const;

const roundMoney = (value: number) => Number(value.toFixed(2));

const toAdminProtection = (protection: {
  id: string;
  name: string;
  pricePerDay: number;
  isActive: boolean;
  isPopular: boolean;
  included: string[];
  excluded: string[];
  excessLabel: string;
  excessOver25: string;
  excessUnder25: string;
  bondCredit: number;
  bondDebit: number;
  createdAt: Date;
  updatedAt: Date;
  _count: { bookings: number };
}) => ({
  id: protection.id,
  name: protection.name,
  pricePerDay: protection.pricePerDay,
  isActive: protection.isActive,
  isPopular: protection.isPopular,
  included: protection.included,
  excluded: protection.excluded,
  excessLabel: protection.excessLabel,
  excessOver25: protection.excessOver25,
  excessUnder25: protection.excessUnder25,
  bondCredit: protection.bondCredit,
  bondDebit: protection.bondDebit,
  bookingsCount: protection._count.bookings,
  createdAt: protection.createdAt,
  updatedAt: protection.updatedAt,
});

const assertUniqueName = async (name: string, ignoreId?: string) => {
  const existing = await prisma.protection.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(ignoreId ? { id: { not: ignoreId } } : {}),
    },
    select: { id: true },
  });

  if (existing) {
    throw new AppError(409, "A protection with this name already exists");
  }
};

export const createProtection = async (input: CreateProtectionInput) => {
  await assertUniqueName(input.name);

  const protection = await prisma.protection.create({
    data: {
      name: input.name,
      pricePerDay: roundMoney(input.pricePerDay),
      isPopular: input.isPopular,
      included: input.included,
      excluded: input.excluded,
      ...(input.excessLabel !== undefined
        ? { excessLabel: input.excessLabel }
        : {}),
      ...(input.excessOver25 !== undefined
        ? { excessOver25: input.excessOver25 }
        : {}),
      ...(input.excessUnder25 !== undefined
        ? { excessUnder25: input.excessUnder25 }
        : {}),
      ...(input.bondCredit !== undefined
        ? { bondCredit: roundMoney(input.bondCredit) }
        : {}),
      ...(input.bondDebit !== undefined
        ? { bondDebit: roundMoney(input.bondDebit) }
        : {}),
    },
    include: protectionInclude,
  });

  return toAdminProtection(protection);
};

export const getAllProtections = async () => {
  const protections = await prisma.protection.findMany({
    include: protectionInclude,
    orderBy: [{ isActive: "desc" }, { pricePerDay: "asc" }],
  });

  return protections.map(toAdminProtection);
};

export const getProtectionById = async (id: string) => {
  const protection = await prisma.protection.findUnique({
    where: { id },
    include: protectionInclude,
  });

  if (!protection) {
    throw new AppError(404, "Protection not found");
  }

  return toAdminProtection(protection);
};

export const updateProtection = async (
  id: string,
  input: UpdateProtectionInput,
) => {
  const existing = await prisma.protection.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    throw new AppError(404, "Protection not found");
  }

  if (input.name) {
    await assertUniqueName(input.name, id);
  }

  const protection = await prisma.protection.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.pricePerDay !== undefined
        ? { pricePerDay: roundMoney(input.pricePerDay) }
        : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.isPopular !== undefined ? { isPopular: input.isPopular } : {}),
      ...(input.included !== undefined ? { included: input.included } : {}),
      ...(input.excluded !== undefined ? { excluded: input.excluded } : {}),
      ...(input.excessLabel !== undefined
        ? { excessLabel: input.excessLabel }
        : {}),
      ...(input.excessOver25 !== undefined
        ? { excessOver25: input.excessOver25 }
        : {}),
      ...(input.excessUnder25 !== undefined
        ? { excessUnder25: input.excessUnder25 }
        : {}),
      ...(input.bondCredit !== undefined
        ? { bondCredit: roundMoney(input.bondCredit) }
        : {}),
      ...(input.bondDebit !== undefined
        ? { bondDebit: roundMoney(input.bondDebit) }
        : {}),
    },
    include: protectionInclude,
  });

  return toAdminProtection(protection);
};

export const deleteProtection = async (id: string) => {
  const protection = await prisma.protection.findUnique({
    where: { id },
    include: protectionInclude,
  });

  if (!protection) {
    throw new AppError(404, "Protection not found");
  }

  if (protection._count.bookings > 0) {
    const hidden = await prisma.protection.update({
      where: { id },
      data: { isActive: false },
      include: protectionInclude,
    });

    return {
      removed: false,
      protection: toAdminProtection(hidden),
    };
  }

  await prisma.protection.delete({ where: { id } });

  return {
    removed: true,
    protection: {
      id: protection.id,
      name: protection.name,
    },
  };
};
