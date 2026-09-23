import {
  calculateFuelBudget,
  getDefaultFuelConfig,
  inferDefaultFuelType,
  formatCurrency,
  VehicleFuelConfig,
} from "./fuelCalculator";
import { Vehicle } from "./types";

describe("Fuel Calculator Unit Tests", () => {
  describe("inferDefaultFuelType", () => {
    test("detects Electric for EV makes/models", () => {
      const evCar: Vehicle = {
        id: "1",
        user_id: "u1",
        make: "Tesla",
        model: "Model 3",
        year: 2023,
        vin: "TSLA123",
        odometer_km: 12000,
        vehicle_type: "Car",
      };
      expect(inferDefaultFuelType(evCar)).toBe("Electric");

      const nexonEv: Vehicle = {
        id: "2",
        user_id: "u1",
        make: "Tata",
        model: "Nexon EV",
        year: 2023,
        vin: "TAT123",
        odometer_km: 8000,
        vehicle_type: "Car",
      };
      expect(inferDefaultFuelType(nexonEv)).toBe("Electric");
    });

    test("detects Hybrid models", () => {
      const hybrid: Vehicle = {
        id: "3",
        user_id: "u1",
        make: "Toyota",
        model: "Hyryder Strong Hybrid",
        year: 2024,
        vin: "TOY123",
        odometer_km: 5000,
        vehicle_type: "Car",
      };
      expect(inferDefaultFuelType(hybrid)).toBe("Hybrid");
    });

    test("defaults standard ICE vehicles to Petrol", () => {
      const car: Vehicle = {
        id: "4",
        user_id: "u1",
        make: "Honda",
        model: "City",
        year: 2022,
        vin: "HON123",
        odometer_km: 30000,
        vehicle_type: "Car",
      };
      expect(inferDefaultFuelType(car)).toBe("Petrol");
    });
  });

  describe("getDefaultFuelConfig", () => {
    test("provides bike-appropriate defaults", () => {
      const bike: Vehicle = {
        id: "b1",
        user_id: "u1",
        make: "Royal Enfield",
        model: "Classic 350",
        year: 2023,
        vin: "RE123",
        odometer_km: 4000,
        vehicle_type: "Bike",
      };
      const config = getDefaultFuelConfig(bike);
      expect(config.mileage).toBe(45);
      expect(config.monthlyBudget).toBe(2500);
      expect(config.fuelType).toBe("Petrol");
    });

    test("provides car-appropriate defaults", () => {
      const car: Vehicle = {
        id: "c1",
        user_id: "u1",
        make: "Hyundai",
        model: "Creta",
        year: 2022,
        vin: "HYU123",
        odometer_km: 22000,
        vehicle_type: "Car",
      };
      const config = getDefaultFuelConfig(car);
      expect(config.mileage).toBe(16);
      expect(config.monthlyBudget).toBe(5000);
    });
  });

  describe("calculateFuelBudget - Formula & Edge Cases", () => {
    test("calculates Fuel Used, Estimated Cost, and Remaining Budget correctly", () => {
      // Example from prompt:
      // Distance = 500 km, Mileage = 20 km/L, Fuel Price = ₹105/L, Budget = ₹4000
      // Fuel Used = 500 ÷ 20 = 25 L
      // Estimated Cost = 25 × ₹105 = ₹2,625
      // Remaining = 4000 - 2625 = ₹1,375
      const config: VehicleFuelConfig = {
        fuelType: "Petrol",
        monthlyBudget: 4000,
        monthlyDistanceKm: 500,
        mileage: 20,
        fuelPrice: 105,
      };

      const result = calculateFuelBudget(config);

      expect(result.isCalculable).toBe(true);
      expect(result.fuelUsed).toBe(25);
      expect(result.estimatedCost).toBe(2625);
      expect(result.remainingBudget).toBe(1375);
      expect(result.isOverBudget).toBe(false);
      expect(result.budgetUsedPercent).toBe(65.6);
    });

    test("handles over-budget conditions gracefully", () => {
      const config: VehicleFuelConfig = {
        fuelType: "Petrol",
        monthlyBudget: 2000,
        monthlyDistanceKm: 600,
        mileage: 15,
        fuelPrice: 100,
      };

      // Fuel Used = 600 / 15 = 40 L
      // Estimated Cost = 40 * 100 = ₹4000
      // Remaining = 2000 - 4000 = -₹2000
      const result = calculateFuelBudget(config);
      expect(result.isCalculable).toBe(true);
      expect(result.fuelUsed).toBe(40);
      expect(result.estimatedCost).toBe(4000);
      expect(result.remainingBudget).toBe(-2000);
      expect(result.isOverBudget).toBe(true);
      expect(result.budgetUsedPercent).toBe(100);
    });

    test("safely prevents division by zero when mileage is 0 or negative", () => {
      const zeroMileage: VehicleFuelConfig = {
        fuelType: "Petrol",
        monthlyBudget: 4000,
        monthlyDistanceKm: 500,
        mileage: 0,
        fuelPrice: 105,
      };
      const res1 = calculateFuelBudget(zeroMileage);
      expect(res1.isCalculable).toBe(false);
      expect(res1.fuelUsed).toBeNull();
      expect(res1.estimatedCost).toBeNull();

      const negMileage: VehicleFuelConfig = {
        fuelType: "Petrol",
        monthlyBudget: 4000,
        monthlyDistanceKm: 500,
        mileage: -10,
        fuelPrice: 105,
      };
      const res2 = calculateFuelBudget(negMileage);
      expect(res2.isCalculable).toBe(false);
      expect(res2.fuelUsed).toBeNull();
    });

    test("safely handles null / undefined config", () => {
      const res = calculateFuelBudget(null);
      expect(res.isCalculable).toBe(false);
      expect(res.fuelUsed).toBeNull();
    });
  });

  describe("formatCurrency", () => {
    test("formats valid positive amount in INR", () => {
      expect(formatCurrency(2625)).toBe("₹2,625");
      expect(formatCurrency(100000)).toBe("₹1,00,000");
    });

    test("formats negative amount with minus sign", () => {
      expect(formatCurrency(-1375)).toBe("-₹1,375");
    });

    test("returns N/A for null/undefined/NaN", () => {
      expect(formatCurrency(null)).toBe("N/A");
      expect(formatCurrency(undefined)).toBe("N/A");
      expect(formatCurrency(NaN)).toBe("N/A");
    });
  });
});
