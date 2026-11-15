export const PAY_NOW_DISCOUNT_PERCENT = 9;
export const STANDARD_COVER_LABEL =
  "Includes Standard cover: reduce excess $6,600.00";
export const PROTECTION_UPGRADE_NOTE =
  "You will be able to upgrade your protection after selecting the vehicle";
export const TERMS_ACKNOWLEDGEMENT =
  "I acknowledge that I have read, understood and agree to the TasDrive Rentals Terms and Conditions";
export const COMPANY_ABN = "31 793 813 481";

export const reservationTimeSlots = () => {
  const slots: string[] = [];
  for (let minutes = 8 * 60; minutes <= 20 * 60; minutes += 15) {
    const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
    const mins = String(minutes % 60).padStart(2, "0");
    slots.push(`${hours}:${mins}`);
  }
  return slots;
};

type PublicCar = {
  brand: string;
  model: string;
  totalSeat: number;
  doors: number;
  suitcases?: number | null;
  transmission: string;
  mileage: string;
  unlimitedMileage?: boolean | null;
  airConditioning?: boolean | null;
  minimumDriverAge?: number | null;
  soldOut?: boolean | null;
};

const transmissionLabel = (transmission: string) => {
  if (transmission === "AUTOMATIC") return "Automatic";
  if (transmission === "MANUAL") return "Manual";
  return transmission;
};

export const publicCarFields = (car: PublicCar, dateSoldOut = false) => ({
  displayName: `${car.brand} ${car.model} or similar`,
  soldOut: Boolean(car.soldOut) || dateSoldOut,
  payNowDiscountPercent: PAY_NOW_DISCOUNT_PERCENT,
  payNowLabel: `Save ${PAY_NOW_DISCOUNT_PERCENT}% when you Pay Now`,
  publicDetails: {
    seats: car.totalSeat,
    doors: car.doors,
    suitcases: car.suitcases ?? 2,
    transmission: transmissionLabel(car.transmission),
    mileage: car.unlimitedMileage === false ? car.mileage : "Unlimited Mileage",
    airConditioning: car.airConditioning !== false,
    minimumDriverAge: car.minimumDriverAge ?? 21,
    includedCover: STANDARD_COVER_LABEL,
    protectionNote: PROTECTION_UPGRADE_NOTE,
  },
});
