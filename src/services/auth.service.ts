import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/app-error.js";
import type {
  RegisterInput,
  LoginInput,
  ForgetPasswordInput,
  ResetPasswordInput,
  ChangePasswordInput,
  UpdateProfileInput,
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

export const updateProfile = async (userId: string, input: UpdateProfileInput) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError(404, "User not found");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: input,
  });

  return {
    success: true,
    message: "Profile updated successfully",
  };
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
