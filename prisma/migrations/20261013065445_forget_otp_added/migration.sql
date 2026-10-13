-- AlterTable
ALTER TABLE "User" ADD COLUMN     "otp" INTEGER,
ADD COLUMN     "otpExpiresAt" TIMESTAMP(3);
