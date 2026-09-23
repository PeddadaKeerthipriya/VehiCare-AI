import { Vehicle } from "./types";

export type FuelType =
  | "Petrol"
  | "Diesel"
  | "Electric"
  | "CNG"
  | "Hybrid"
  | "Not set";

export interface VehicleFuelConfig {
  fuelType: FuelType;
  monthlyBudget: number; // In ₹ (INR)
  monthlyDistanceKm: number; // In km
  mileage: number; // In km/L (or km/kWh for EV)
  fuelPrice: number; // In ₹/L (or ₹/kWh for EV)
}

export interface FuelCalculationResult {
  fuelUsed: number | null; // Distance ÷ Mileage
  estimatedCost: number | null; // Fuel Used × Fuel Price
  remainingBudget: number | null; // Monthly Budget - Estimated Cost
  budgetUsedPercent: number | null;
  isOverBudget: boolean;
  isCalculable: boolean;
}

const STORAGE_PREFIX = "vehicare_fuel_config_";

/**
 * Infer default fuel type based on vehicle make, model, or type.
 */
export function inferDefaultFuelType(vehicle: Vehicle): FuelType {
  const make = (vehicle.make || "").toLowerCase();
  const model = (vehicle.model || "").toLowerCase();

  if (
    make === "tesla" ||
    model.includes("ev") ||
    model.includes("electric") ||
    (make.includes("tata") && (model.includes("nexon ev") || model.includes("tiago ev") || model.includes("punch ev")))
  ) {
    return "Electric";
  }

  if (model.includes("hybrid") || model.includes("strong hybrid")) {
    return "Hybrid";
  }

  if (model.includes("cng")) {
    return "CNG";
  }

  if (model.includes("diesel")) {
    return "Diesel";
  }

  // Standard internal combustion fallback
  return "Petrol";
}

/**
 * Get default fuel configuration for a vehicle depending on vehicle type (Car vs Bike).
 */
export function getDefaultFuelConfig(vehicle: Vehicle): VehicleFuelConfig {
  const inferredType = inferDefaultFuelType(vehicle);
  const isBike = vehicle.vehicle_type === "Bike";

  if (inferredType === "Electric") {
    return {
      fuelType: "Electric",
      monthlyBudget: isBike ? 1000 : 3000,
      monthlyDistanceKm: isBike ? 300 : 600,
      mileage: isBike ? 30 : 6.5, // km/kWh
      fuelPrice: 10, // ₹/kWh average
    };
  }

  if (isBike) {
    return {
      fuelType: inferredType,
      monthlyBudget: 2500,
      monthlyDistanceKm: 450,
      mileage: 45, // 45 km/L typical for motorcycle/scooter
      fuelPrice: 104, // ₹/L
    };
  }

  // Default Car (Petrol/Diesel)
  return {
    fuelType: inferredType,
    monthlyBudget: 5000,
    monthlyDistanceKm: 500,
    mileage: 16, // 16 km/L typical car
    fuelPrice: 104, // ₹/L
  };
}

/**
 * Retrieve fuel config for a vehicle from localStorage, falling back to sensible defaults.
 */
export function getVehicleFuelConfig(vehicle: Vehicle): VehicleFuelConfig {
  if (typeof window === "undefined" || !vehicle?.id) {
    return getDefaultFuelConfig(vehicle);
  }

  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${vehicle.id}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed.monthlyBudget === "number" &&
        typeof parsed.monthlyDistanceKm === "number" &&
        typeof parsed.mileage === "number" &&
        typeof parsed.fuelPrice === "number"
      ) {
        return {
          fuelType: parsed.fuelType || inferDefaultFuelType(vehicle),
          monthlyBudget: Math.max(0, parsed.monthlyBudget),
          monthlyDistanceKm: Math.max(0, parsed.monthlyDistanceKm),
          mileage: Math.max(0, parsed.mileage),
          fuelPrice: Math.max(0, parsed.fuelPrice),
        };
      }
    }
  } catch (err) {
    console.warn(`[FuelCalculator] Failed to load config for vehicle ${vehicle.id}:`, err);
  }

  return getDefaultFuelConfig(vehicle);
}

/**
 * Persist fuel config for a specific vehicle into localStorage.
 */
export function saveVehicleFuelConfig(vehicleId: string, config: VehicleFuelConfig): void {
  if (typeof window === "undefined" || !vehicleId) return;

  try {
    localStorage.setItem(`${STORAGE_PREFIX}${vehicleId}`, JSON.stringify(config));
  } catch (err) {
    console.error(`[FuelCalculator] Failed to save config for vehicle ${vehicleId}:`, err);
  }
}

/**
 * Preferred calculation:
 * Fuel Used = Distance ÷ Mileage
 * Estimated Fuel Cost = Fuel Used × Fuel Price
 * Remaining Budget = Monthly Budget - Estimated Fuel Cost
 *
 * Guarantees zero division by zero, no NaN, no Infinity.
 */
export function calculateFuelBudget(config?: VehicleFuelConfig | null): FuelCalculationResult {
  if (!config) {
    return {
      fuelUsed: null,
      estimatedCost: null,
      remainingBudget: null,
      budgetUsedPercent: null,
      isOverBudget: false,
      isCalculable: false,
    };
  }

  const { monthlyBudget, monthlyDistanceKm, mileage, fuelPrice } = config;

  // Safe checks: mileage must be strictly greater than 0, distance >= 0, fuelPrice >= 0
  if (
    typeof mileage !== "number" ||
    isNaN(mileage) ||
    mileage <= 0 ||
    typeof monthlyDistanceKm !== "number" ||
    isNaN(monthlyDistanceKm) ||
    monthlyDistanceKm < 0 ||
    typeof fuelPrice !== "number" ||
    isNaN(fuelPrice) ||
    fuelPrice < 0
  ) {
    return {
      fuelUsed: null,
      estimatedCost: null,
      remainingBudget: null,
      budgetUsedPercent: null,
      isOverBudget: false,
      isCalculable: false,
    };
  }

  // 1. Fuel Used = Distance ÷ Mileage
  const fuelUsed = monthlyDistanceKm / mileage;

  // 2. Estimated Fuel Cost = Fuel Used × Fuel Price
  const estimatedCost = fuelUsed * fuelPrice;

  // 3. Remaining Budget
  const remainingBudget = monthlyBudget - estimatedCost;

  // 4. Budget Used Percent
  const budgetUsedPercent =
    monthlyBudget > 0 ? Math.min(100, Math.max(0, (estimatedCost / monthlyBudget) * 100)) : 100;

  const isOverBudget = remainingBudget < 0;

  return {
    fuelUsed: Number(fuelUsed.toFixed(1)),
    estimatedCost: Math.round(estimatedCost),
    remainingBudget: Math.round(remainingBudget),
    budgetUsedPercent: Number(budgetUsedPercent.toFixed(1)),
    isOverBudget,
    isCalculable: true,
  };
}

/**
 * Format currency amount safely in INR.
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return "N/A";
  }

  const sign = amount < 0 ? "-" : "";
  const absAmount = Math.abs(amount);

  return `${sign}₹${absAmount.toLocaleString("en-IN")}`;
}
