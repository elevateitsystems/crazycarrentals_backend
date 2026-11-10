-- AlterTable
ALTER TABLE "Bookings" ADD COLUMN "vehicleDailyRates" JSONB;

-- CreateTable
CREATE TABLE "CarDailyRate" (
    "id" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarDailyRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CarDailyRate_carId_date_idx" ON "CarDailyRate"("carId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "CarDailyRate_carId_date_key" ON "CarDailyRate"("carId", "date");

-- AddForeignKey
ALTER TABLE "CarDailyRate" ADD CONSTRAINT "CarDailyRate_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE CASCADE ON UPDATE CASCADE;
