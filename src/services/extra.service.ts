import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/app-error.js";
import type {
  CreateExtraInput,
  UpdateExtraInput,
} from "../validators/extra.validator.js";

const extraInclude = {
  _count: {
    select: { bookings: true },
  },
} as const;

const roundMoney = (value: number) => Number(value.toFixed(2));

const toAdminExtra = (extra: {
  id: string;
  name: string;
  pricePerDay: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count: { bookings: number };
}) => ({
  id: extra.id,
  name: extra.name,
  pricePerDay: extra.pricePerDay,
  isActive: extra.isActive,
  bookingsCount: extra._count.bookings,
  createdAt: extra.createdAt,
  updatedAt: extra.updatedAt,
});

const assertUniqueName = async (name: string, ignoreId?: string) => {
  const existing = await prisma.extraService.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(ignoreId ? { id: { not: ignoreId } } : {}),
    },
    select: { id: true },
  });

  if (existing) {
    throw new AppError(409, "An extra with this name already exists");
  }
};

export const createExtra = async (input: CreateExtraInput) => {
  await assertUniqueName(input.name);

  const extra = await prisma.extraService.create({
    data: {
      name: input.name,
      pricePerDay: roundMoney(input.pricePerDay),
    },
    include: extraInclude,
  });

  return toAdminExtra(extra);
};

export const getAllExtras = async () => {
  const extras = await prisma.extraService.findMany({
    include: extraInclude,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  return extras.map(toAdminExtra);
};

export const getExtraById = async (id: string) => {
  const extra = await prisma.extraService.findUnique({
    where: { id },
    include: extraInclude,
  });

  if (!extra) {
    throw new AppError(404, "Extra not found");
  }

  return toAdminExtra(extra);
};

export const updateExtra = async (id: string, input: UpdateExtraInput) => {
  const existing = await prisma.extraService.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    throw new AppError(404, "Extra not found");
  }

  if (input.name) {
    await assertUniqueName(input.name, id);
  }

  const extra = await prisma.extraService.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.pricePerDay !== undefined
        ? { pricePerDay: roundMoney(input.pricePerDay) }
        : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    include: extraInclude,
  });

  return toAdminExtra(extra);
};

export const deleteExtra = async (id: string) => {
  const extra = await prisma.extraService.findUnique({
    where: { id },
    include: extraInclude,
  });

  if (!extra) {
    throw new AppError(404, "Extra not found");
  }

  if (extra._count.bookings > 0) {
    const hidden = await prisma.extraService.update({
      where: { id },
      data: { isActive: false },
      include: extraInclude,
    });

    return {
      removed: false,
      extra: toAdminExtra(hidden),
    };
  }

  await prisma.extraService.delete({ where: { id } });

  return {
    removed: true,
    extra: {
      id: extra.id,
      name: extra.name,
    },
  };
};
