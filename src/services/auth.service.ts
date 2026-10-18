import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/app-error.js";
import { uploadFileToMinio, deleteFileFromMinio } from "./minio.service.js";
import type { Role, Prisma } from "@prisma/client";
import type {
  RegisterInput,
  LoginInput,
  ForgetPasswordInput,
  ResetPasswordInput,
  ChangePasswordInput,
  UpdateProfileInput,
  AdminUpdateUserInput,
} from "../validators/auth.validator.js";

const publicUser = (user: {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  createdAt: user.createdAt,
});

const createToken = (userId: string) => {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  });
};

export const register = async (input: RegisterInput) => {
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (existingUser) {
    throw new AppError(409, "Email is already registered");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
    },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
    },
  });

  return {
    user,
    token: createToken(user.id),
  };
};

export const login = async (input: LoginInput) => {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new AppError(401, "Invalid email or password");
  }

  return {
    user: publicUser(user),
    token: createToken(user.id),
  };
};

export const forgetPassword = async (input: ForgetPasswordInput) => {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user) {
    throw new AppError(404, "User not found");
  }

  const createOTP = Math.floor(1000 + Math.random() * 9000);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      otp: createOTP,
      otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  return {
    id: user.id,
    email: user.email,
    otp: createOTP,
  };
};

export const resetPassword = async (input: ResetPasswordInput) => {
  const user = await prisma.user.findUnique({
    where: { id: input.id },
  });

  if (!user) {
    throw new AppError(404, "User not found");
  }

  if (!user.otp || !user.otpExpiresAt) {
    throw new AppError(400, "You have to request for a reset password first");
  }

  if (user.otp !== input.otp) {
    throw new AppError(400, "Invalid OTP");
  }
  if (user.otpExpiresAt < new Date()) {
    throw new AppError(400, "OTP has expired");
  }

  const passwordHash = await bcrypt.hash(input.newPassword, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      otp: null,
      otpExpiresAt: null,
    },
  });

  return {
    success: true,
    message: "Password reset successfully",
  };
};

export const changePassword = async (
  userId: string,
  input: ChangePasswordInput,
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError(404, "User not found");
  }

  if (
    !user.passwordHash ||
    !(await bcrypt.compare(input.oldPassword, user.passwordHash))
  ) {
    throw new AppError(401, "Invalid old password");
  }

  const passwordHash = await bcrypt.hash(input.newPassword, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
    },
  });

  return {
    success: true,
    message: "Password changed successfully",
  };
};

export const updateProfile = async (
  userId: string,
  input: UpdateProfileInput,
  file?: Express.Multer.File,
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError(404, "User not found");
  }

  let avatarUrl = input.avatarUrl;

  // If new avatar file uploaded, clean up old avatar and upload new one
  if (file) {
    if (user.avatarUrl) {
      await deleteFileFromMinio(user.avatarUrl);
    }
    avatarUrl = await uploadFileToMinio(file, "avatars");
  }

  const updateData: Prisma.UserUpdateInput = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.phoneNumber !== undefined) updateData.phoneNumber = input.phoneNumber;
  if (input.address !== undefined) updateData.address = input.address;
  if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phoneNumber: true,
      avatarUrl: true,
      address: true,
      isEmailVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return updatedUser;
};

export const getProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phoneNumber: true,
      avatarUrl: true,
      isEmailVerified: true,
      emailVerifiedAt: true,
      lastLoginAt: true,
      loginAttempts: true,
      lockedUntil: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new AppError(404, "User not found");
  }

  return {
    success: true,
    message: "Profile fetched successfully",
    data: {
      user,
    },
  };
};

// Admin side

export interface UserQueryFilters {
  page?: string | number;
  limit?: string | number;
  role?: string;
  searchTerm?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export const getAllUsers = async (filters: UserQueryFilters = {}) => {
  const where: Prisma.UserWhereInput = {};

  if (filters.role) {
    const roleUpper = filters.role.toUpperCase();
    if (["USER", "ADMIN", "SUPER_ADMIN"].includes(roleUpper)) {
      where.role = roleUpper as Role;
    }
  }

  if (filters.searchTerm) {
    const term = String(filters.searchTerm).trim();
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
      { phoneNumber: { contains: term, mode: "insensitive" } },
    ];
  }

  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(filters.limit) || 10));
  const skip = (page - 1) * limit;

  const allowedSortFields = ["createdAt", "name", "email", "role"];
  const sortBy = allowedSortFields.includes(String(filters.sortBy))
    ? String(filters.sortBy)
    : "createdAt";
  const sortOrder: Prisma.SortOrder =
    filters.sortOrder?.toLowerCase() === "asc" ? "asc" : "desc";

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phoneNumber: true,
        avatarUrl: true,
        address: true,
        isEmailVerified: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        loginAttempts: true,
        lockedUntil: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    users,
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

export const getUserById = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phoneNumber: true,
      avatarUrl: true,
      address: true,
      isEmailVerified: true,
      emailVerifiedAt: true,
      lastLoginAt: true,
      loginAttempts: true,
      lockedUntil: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          bookings: true,
          reviews: true,
        },
      },
    },
  });

  if (!user) {
    throw new AppError(404, "User not found");
  }

  return user;
};

export const updateUserById = async (
  userId: string,
  input: AdminUpdateUserInput,
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError(404, "User not found");
  }

  // If email is changing, verify uniqueness
  if (input.email && input.email !== user.email) {
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existing) {
      throw new AppError(409, "Email is already in use by another user");
    }
  }

  const updateData: Prisma.UserUpdateInput = {};

  if (input.name !== undefined) updateData.name = input.name;
  if (input.email !== undefined) updateData.email = input.email;
  if (input.role !== undefined) updateData.role = input.role as Role;
  if (input.phoneNumber !== undefined) updateData.phoneNumber = input.phoneNumber;
  if (input.avatarUrl !== undefined) updateData.avatarUrl = input.avatarUrl;
  if (input.address !== undefined) updateData.address = input.address;
  if (input.isEmailVerified !== undefined) {
    updateData.isEmailVerified = input.isEmailVerified;
    if (input.isEmailVerified && !user.emailVerifiedAt) {
      updateData.emailVerifiedAt = new Date();
    }
  }

  if (input.unlockAccount) {
    updateData.lockedUntil = null;
    updateData.loginAttempts = 0;
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phoneNumber: true,
      avatarUrl: true,
      address: true,
      isEmailVerified: true,
      emailVerifiedAt: true,
      lastLoginAt: true,
      loginAttempts: true,
      lockedUntil: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return updatedUser;
};

export const deleteUserById = async (userId: string, currentAdminId?: string) => {
  if (currentAdminId && currentAdminId === userId) {
    throw new AppError(400, "You cannot delete your own admin account");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError(404, "User not found");
  }

  // Clean up avatar image from MinIO if present
  if (user.avatarUrl) {
    await deleteFileFromMinio(user.avatarUrl);
  }

  await prisma.user.delete({
    where: { id: user.id },
  });

  return { id: user.id };
};
