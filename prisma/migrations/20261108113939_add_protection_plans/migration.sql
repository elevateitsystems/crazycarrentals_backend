-- AlterTable
ALTER TABLE "Bookings" ADD COLUMN     "protectionPrice" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "Protection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pricePerDay" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Protection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_BookingsToProtection" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BookingsToProtection_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_BookingsToProtection_B_index" ON "_BookingsToProtection"("B");

-- AddForeignKey
ALTER TABLE "_BookingsToProtection" ADD CONSTRAINT "_BookingsToProtection_A_fkey" FOREIGN KEY ("A") REFERENCES "Bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BookingsToProtection" ADD CONSTRAINT "_BookingsToProtection_B_fkey" FOREIGN KEY ("B") REFERENCES "Protection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
