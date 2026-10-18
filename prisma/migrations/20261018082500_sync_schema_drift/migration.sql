-- AlterTable
ALTER TABLE "Bookings" ADD COLUMN     "basePrice" DOUBLE PRECISION,
ADD COLUMN     "bookingReference" TEXT,
ADD COLUMN     "discount" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "driverInfoId" TEXT,
ADD COLUMN     "extrasPrice" DOUBLE PRECISION,
ADD COLUMN     "rentalDays" INTEGER;

-- AlterTable
ALTER TABLE "DriverInfo" ALTER COLUMN "name" DROP NOT NULL,
ALTER COLUMN "phoneNumber" DROP NOT NULL,
ALTER COLUMN "email" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "billingPostcode" TEXT,
ADD COLUMN     "billingState" TEXT,
ADD COLUMN     "billingStreet" TEXT,
ADD COLUMN     "billingSuburb" TEXT,
ADD COLUMN     "cardBrand" TEXT,
ADD COLUMN     "cardLast4" TEXT,
ADD COLUMN     "transactionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Bookings_bookingReference_key" ON "Bookings"("bookingReference");

-- AddForeignKey
ALTER TABLE "Bookings" ADD CONSTRAINT "Bookings_driverInfoId_fkey" FOREIGN KEY ("driverInfoId") REFERENCES "DriverInfo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
