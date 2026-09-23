"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Fuel,
  Zap,
  Car,
  Bike,
  SlidersHorizontal,
  AlertCircle,
  CheckCircle2,
  X,
} from "lucide-react";
import { Vehicle } from "@/lib/types";
import {
  FuelType,
  VehicleFuelConfig,
  getVehicleFuelConfig,
  saveVehicleFuelConfig,
  calculateFuelBudget,
  formatCurrency,
} from "@/lib/fuelCalculator";

import { cn } from "@/lib/utils";

interface DashboardFuelCardProps {
  selectedVehicle: Vehicle | null;
  onBudgetUpdate?: (newSpend: number | null) => void;
  className?: string;
}

export function DashboardFuelCard({
  selectedVehicle,
  onBudgetUpdate,
  className,
}: DashboardFuelCardProps) {
  const [config, setConfig] = useState<VehicleFuelConfig | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Form edit states
  const [editFuelType, setEditFuelType] = useState<FuelType>("Petrol");
  const [editBudget, setEditBudget] = useState<string>("4000");
  const [editDistance, setEditDistance] = useState<string>("500");
  const [editMileage, setEditMileage] = useState<string>("20");
  const [editPrice, setEditPrice] = useState<string>("105");

  // Re-load configuration whenever the selected vehicle changes
  useEffect(() => {
    if (!selectedVehicle) {
      setConfig(null);
      if (onBudgetUpdate) onBudgetUpdate(null);
      return;
    }

    const currentConfig = getVehicleFuelConfig(selectedVehicle);
    setConfig(currentConfig);

    setEditFuelType(currentConfig.fuelType);
    setEditBudget(String(currentConfig.monthlyBudget));
    setEditDistance(String(currentConfig.monthlyDistanceKm));
    setEditMileage(String(currentConfig.mileage));
    setEditPrice(String(currentConfig.fuelPrice));

    const result = calculateFuelBudget(currentConfig);
    if (onBudgetUpdate) {
      onBudgetUpdate(result.estimatedCost);
    }
  }, [selectedVehicle, onBudgetUpdate]);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle) return;

    const parsedBudget = parseFloat(editBudget);
    const parsedDistance = parseFloat(editDistance);
    const parsedMileage = parseFloat(editMileage);
    const parsedPrice = parseFloat(editPrice);

    const updatedConfig: VehicleFuelConfig = {
      fuelType: editFuelType,
      monthlyBudget: isNaN(parsedBudget) ? 0 : Math.max(0, parsedBudget),
      monthlyDistanceKm: isNaN(parsedDistance) ? 0 : Math.max(0, parsedDistance),
      mileage: isNaN(parsedMileage) ? 0 : Math.max(0, parsedMileage),
      fuelPrice: isNaN(parsedPrice) ? 0 : Math.max(0, parsedPrice),
    };

    saveVehicleFuelConfig(selectedVehicle.id, updatedConfig);
    setConfig(updatedConfig);
    setIsEditModalOpen(false);

    const result = calculateFuelBudget(updatedConfig);
    if (onBudgetUpdate) {
      onBudgetUpdate(result.estimatedCost);
    }
  };

  if (!selectedVehicle) {
    return (
      <Card className="border-border bg-card shadow-sm rounded-2xl">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-base sm:text-lg text-foreground flex items-center gap-2">
            <Fuel className="h-4 w-4 text-[#66C56A]" />
            Track Your Fuel Budget
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 text-center">
          <div className="flex justify-center mb-2">
            <div className="p-3 rounded-full bg-secondary text-muted-foreground border border-border">
              <Car className="h-5 w-5" />
            </div>
          </div>
          <p className="text-sm font-medium text-foreground">No Vehicle Selected</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add or select a vehicle to track your fuel budget and consumption.
          </p>
        </CardContent>
      </Card>
    );
  }

  const isBike = selectedVehicle.vehicle_type === "Bike";
  const isEV = config?.fuelType === "Electric";
  const result = calculateFuelBudget(config);

  const mileageUnit = isEV ? "km/kWh" : "km/L";
  const volumeUnit = isEV ? "kWh" : "L";

  return (
    <>
      <Card id="fuel-budget" className={cn("border-border bg-card shadow-sm rounded-2xl flex flex-col justify-between", className)}>
        <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between shrink-0">
          <div>
            <CardTitle className="text-base sm:text-lg text-foreground flex items-center gap-2">
              {isEV ? (
                <Zap className="h-4 w-4 text-[#66C56A]" />
              ) : (
                <Fuel className="h-4 w-4 text-[#66C56A]" />
              )}
              Track Your Fuel Budget
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
            </p>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsEditModalOpen(true)}
            className="h-8 rounded-xl border-border bg-secondary text-xs text-foreground hover:bg-muted hover:text-foreground hover:border-primary/40 transition-colors flex items-center gap-1.5 px-2.5"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-[#66C56A]" />
            <span className="hidden min-[400px]:inline">Update Budget</span>
          </Button>
        </CardHeader>

        <CardContent className="space-y-4 pt-4 flex-1 flex flex-col justify-between">
          {/* Top Info Banner: Vehicle Type & Fuel Type */}
          <div className="flex items-center justify-between rounded-xl bg-secondary border border-border p-2.5 px-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-card text-[#66C56A] border border-[#2E7D32]/30 shrink-0">
                {isBike ? <Bike className="h-4 w-4" /> : <Car className="h-4 w-4" />}
              </div>
              <div>
                <span className="text-[10px] font-semibold uppercase text-muted-foreground block leading-tight">
                  {isBike ? "Motorcycle / Scooter" : "Car / Passenger Vehicle"}
                </span>
                <span className="text-xs font-bold text-foreground">
                  {selectedVehicle.nickname || `${selectedVehicle.make} ${selectedVehicle.model}`}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 rounded-lg bg-card px-2.5 py-1 border border-border">
              <span className="text-[11px] text-muted-foreground">Fuel:</span>
              <span className="text-xs font-bold text-[#66C56A]">
                {config?.fuelType || "Not set"}
              </span>
            </div>
          </div>

          {/* Budget vs Spend Hero Cards */}
          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="rounded-xl bg-secondary/80 border border-border p-2.5">
              <span className="block text-[10px] font-medium text-muted-foreground truncate">
                Monthly Budget
              </span>
              <span className="mt-1 block text-sm sm:text-base font-bold text-foreground truncate">
                {formatCurrency(config?.monthlyBudget)}
              </span>
            </div>

            <div className="rounded-xl bg-secondary/80 border border-border p-2.5">
              <span className="block text-[10px] font-medium text-muted-foreground truncate">
                Estimated Spend
              </span>
              <span className="mt-1 block text-sm sm:text-base font-bold text-[#66C56A] truncate">
                {result.isCalculable ? formatCurrency(result.estimatedCost) : "N/A"}
              </span>
            </div>

            <div
              className={`rounded-xl border p-2.5 ${
                result.isOverBudget
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400"
                  : "bg-secondary/80 border-border text-emerald-600 dark:text-[#9BE39A]"
              }`}
            >
              <span className="block text-[10px] font-medium text-muted-foreground truncate">
                Remaining
              </span>
              <span className="mt-1 block text-sm sm:text-base font-bold truncate">
                {result.isCalculable ? formatCurrency(result.remainingBudget) : "N/A"}
              </span>
            </div>
          </div>

          {/* Progress Bar of Budget Utilization */}
          {result.isCalculable && result.budgetUsedPercent !== null && (
            <div className="space-y-1.5 pt-0.5">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Budget Utilized</span>
                <span className="font-semibold text-foreground">
                  {result.budgetUsedPercent}%
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-secondary border border-border overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    result.isOverBudget
                      ? "bg-rose-500"
                      : result.budgetUsedPercent > 80
                      ? "bg-[#D9A441]"
                      : "bg-[#66C56A]"
                  }`}
                  style={{ width: `${Math.min(100, result.budgetUsedPercent)}%` }}
                />
              </div>
            </div>
          )}

          {/* Detailed Fuel Breakdown Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs border-t border-border pt-3">
            <div className="flex items-center justify-between rounded-lg bg-secondary/50 px-2.5 py-1.5 border border-border/60">
              <span className="text-muted-foreground">Distance</span>
              <span className="font-semibold text-foreground">
                {config ? `${config.monthlyDistanceKm.toLocaleString()} km` : "N/A"}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-secondary/50 px-2.5 py-1.5 border border-border/60">
              <span className="text-muted-foreground">Mileage</span>
              <span className="font-semibold text-foreground">
                {config && config.mileage > 0
                  ? `${config.mileage} ${mileageUnit}`
                  : "N/A"}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-secondary/50 px-2.5 py-1.5 border border-border/60">
              <span className="text-muted-foreground">Fuel Price</span>
              <span className="font-semibold text-foreground">
                {config && config.fuelPrice > 0
                  ? `₹${config.fuelPrice}/${volumeUnit}`
                  : "N/A"}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-secondary/50 px-2.5 py-1.5 border border-border/60">
              <span className="text-muted-foreground">Est. Fuel Used</span>
              <span className="font-semibold text-[#66C56A]">
                {result.isCalculable && result.fuelUsed !== null
                  ? `${result.fuelUsed} ${volumeUnit}`
                  : "N/A"}
              </span>
            </div>
          </div>

          {/* Safe Alert if Mileage <= 0 or not calculable */}
          {!result.isCalculable && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>
                Mileage must be greater than 0 to calculate fuel usage. Click &quot;Update Budget&quot; to configure.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ========================================================================
          UPDATE BUDGET MODAL
          ======================================================================== */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-secondary text-[#66C56A] border border-[#2E7D32]/30">
                  <Fuel className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Update Fuel Budget</h3>
                  <p className="text-xs text-muted-foreground">
                    {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-3.5">
              {/* Fuel Type */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Fuel Type
                </label>
                <select
                  value={editFuelType}
                  onChange={(e) => setEditFuelType(e.target.value as FuelType)}
                  className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-xs sm:text-sm font-semibold text-foreground outline-none focus:border-[#66C56A] focus:ring-1 focus:ring-[#66C56A]"
                >
                  <option value="Petrol">Petrol</option>
                  <option value="Diesel">Diesel</option>
                  <option value="Electric">Electric</option>
                  <option value="CNG">CNG</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="Not set">Not set</option>
                </select>
              </div>

              {/* Monthly Budget (₹) */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Monthly Budget (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={editBudget}
                  onChange={(e) => setEditBudget(e.target.value)}
                  placeholder="e.g. 4000"
                  required
                  className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-xs sm:text-sm text-foreground outline-none focus:border-[#66C56A] focus:ring-1 focus:ring-[#66C56A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Distance (km) */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Monthly Distance (km)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={editDistance}
                    onChange={(e) => setEditDistance(e.target.value)}
                    placeholder="e.g. 500"
                    required
                    className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-xs sm:text-sm text-foreground outline-none focus:border-[#66C56A] focus:ring-1 focus:ring-[#66C56A]"
                  />
                </div>

                {/* Mileage (km/L or km/kWh) */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Mileage ({editFuelType === "Electric" ? "km/kWh" : "km/L"})
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.5"
                    value={editMileage}
                    onChange={(e) => setEditMileage(e.target.value)}
                    placeholder="e.g. 20"
                    required
                    className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-xs sm:text-sm text-foreground outline-none focus:border-[#66C56A] focus:ring-1 focus:ring-[#66C56A]"
                  />
                </div>
              </div>

              {/* Fuel Price (₹/L or ₹/kWh) */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Fuel Price (₹/{editFuelType === "Electric" ? "kWh" : "L"})
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  placeholder="e.g. 105"
                  required
                  className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-xs sm:text-sm text-foreground outline-none focus:border-[#66C56A] focus:ring-1 focus:ring-[#66C56A]"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsEditModalOpen(false)}
                  className="h-9 rounded-xl px-4 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="h-9 rounded-xl bg-[#2E7D32] hover:bg-[#256628] text-xs text-white font-semibold flex items-center gap-1.5"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Save & Apply
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
