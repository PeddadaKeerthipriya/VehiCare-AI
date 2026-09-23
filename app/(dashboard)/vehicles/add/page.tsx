"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Car, Bike, Save, AlertCircle, CheckCircle2, HelpCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { createVehicle as createVehicleApi } from "@/lib/api";
import { emitVehicleUpdate } from "@/lib/realtimeSync";
import Link from "next/link";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  VehicleType,
  getVehicleCatalog,
  getModelsForMake,
} from "@/constants/vehicles";

interface FormErrors {
  vehicleType?: string;
  make?: string;
  model?: string;
  year?: string;
  vin?: string;
  nickname?: string;
  mileage?: string;
}

export default function AddVehiclePage() {
  const router = useRouter();

  // Form states
  const [vehicleType, setVehicleType] = useState<VehicleType | "">("");
  const [make, setMake] = useState("");
  const [customMake, setCustomMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [vin, setVin] = useState("");
  const [nickname, setNickname] = useState("");
  const [mileage, setMileage] = useState("");

  const vehicleTypeOptions = useMemo(
    () => [
      { value: "Car", label: " Car" },
      { value: "Bike", label: " Bike" },
    ],
    []
  );

  const makeOptions = useMemo(() => {
    if (!vehicleType) return [];
    const catalog = getVehicleCatalog(vehicleType);
    const options = catalog.map((cat) => ({
      value: cat.make,
      label: cat.make,
      aliases: cat.aliases,
    }));
    options.push({
      value: "Others",
      label: "Others",
      aliases: ["Other", "Custom", "Misc", "Unknown"],
    });
    return options;
  }, [vehicleType]);

  const isCustomMake = useMemo(() => {
    const normalized = make.trim().toLowerCase();
    return normalized === "others" || normalized === "other";
  }, [make]);

  const modelOptions = useMemo(() => {
    if (!vehicleType || !make) return [];
    return getModelsForMake(make, vehicleType);
  }, [vehicleType, make]);

  const handleVehicleTypeChange = (newType: string) => {
    setVehicleType(newType as VehicleType);
    setMake("");
    setCustomMake("");
    setModel("");
    setValidationErrors((prev) => {
      const updated = { ...prev };
      delete updated.vehicleType;
      delete updated.make;
      delete updated.model;
      return updated;
    });
  };

  const handleMakeChange = (newMake: string) => {
    setMake(newMake);
    setCustomMake("");
    setModel("");
    setValidationErrors((prev) => {
      const updated = { ...prev };
      delete updated.make;
      delete updated.model;
      return updated;
    });
  };

  const handleModelChange = (newModel: string) => {
    setModel(newModel);
    setValidationErrors((prev) => {
      const updated = { ...prev };
      delete updated.model;
      return updated;
    });
  };

  // UI States
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState<FormErrors>({});
  const [showVinHelp, setShowVinHelp] = useState(false);
  const vinHelpRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (vinHelpRef.current && !vinHelpRef.current.contains(e.target as Node)) {
        setShowVinHelp(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowVinHelp(false);
      }
    };

    if (showVinHelp) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showVinHelp]);

  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    const currentYear = new Date().getFullYear();
    const finalMake = isCustomMake ? customMake.trim() : make.trim();

    if (!vehicleType) errors.vehicleType = "Vehicle type is required.";
    if (!finalMake) {
      errors.make = isCustomMake ? "Custom make is required." : "Make is required.";
    }
    if (!model.trim()) errors.model = "Model is required.";

    if (!year) {
      errors.year = "Year is required.";
    } else {
      const yearNum = parseInt(year);
      if (isNaN(yearNum) || yearNum < 1900 || yearNum > currentYear + 1) {
        errors.year = `Please enter a valid year between 1900 and ${currentYear + 1}.`;
      }
    }

    if (!vin.trim()) {
      errors.vin = "VIN is required.";
    } else if (!/^[A-HJ-NPR-Z0-9]{17}$/i.test(vin.trim())) {
      errors.vin = "VIN must be a valid 17-character alphanumeric string (excluding I, O, Q).";
    }

    if (!nickname.trim()) errors.nickname = "Nickname is required.";

    if (!mileage) {
      errors.mileage = "Mileage is required.";
    } else {
      const mileageNum = parseFloat(mileage);
      if (isNaN(mileageNum)) {
        errors.mileage = "Mileage must be a valid number.";
      } else if (mileageNum < 0) {
        errors.mileage = "Mileage cannot be negative.";
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(false);

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      const finalMake = isCustomMake ? customMake.trim() : make.trim();
      const payload = {
        make: finalMake,
        model: model.trim(),
        year: parseInt(year),
        vin: vin.trim().toUpperCase(),
        odometer_km: Math.round(parseFloat(mileage)),
        vehicle_type: (vehicleType as VehicleType) || "Car",
      };

      const created = await createVehicleApi(payload);
      emitVehicleUpdate(created?.id);

      setSubmitSuccess(true);
      
      setTimeout(() => {
        router.push("/vehicles");
        router.refresh();
      }, 1500);

    } catch (err: unknown) {
      console.error("Error creating vehicle:", err);
      const errMsg = err instanceof Error ? err.message : "Failed to save the vehicle. Please check your connection and try again.";
      setSubmitError(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Back button */}
      <div className="flex items-center gap-2">
        <Link href="/vehicles" className="text-muted-foreground hover:text-foreground transition-colors">
          <Button variant="ghost" size="sm" className="rounded-xl">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to Garage
          </Button>
        </Link>
      </div>

      <Card className="border-[#203131] bg-[#0B1515] shadow-sm rounded-2xl">
        {/* Top visual accent */}
        <div className="h-1.5 w-full bg-[#2E7D32] rounded-t-2xl"></div>

        <CardHeader className="p-6">
          <div className="flex items-center gap-3.5">
            <div className="rounded-xl bg-[#101C1C] p-2.5 text-[#66C56A] border border-[#2E7D32]/30 shrink-0">
              {vehicleType === "Bike" ? (
                <Bike className="h-6 w-6" />
              ) : (
                <Car className="h-6 w-6" />
              )}
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-[#F5F7F6]">Add New Vehicle</CardTitle>
              <CardDescription className="text-sm text-[#81918E] mt-0.5">
                Register a vehicle to start tracking maintenance logs and reminders.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 px-6 pt-0 pb-6">
            {/* Status alerts */}
            {submitSuccess && (
              <div className="flex items-center gap-3 rounded-xl bg-[#101C1C] p-4 text-[#66C56A] border border-[#2E7D32]/40">
                <CheckCircle2 className="h-5 w-5 text-[#66C56A] shrink-0" />
                <div className="text-sm font-semibold">
                  Vehicle registered successfully! Redirecting...
                </div>
              </div>
            )}

            {submitError && (
              <div className="flex items-center gap-3 rounded-xl bg-rose-950/40 p-4 text-rose-300 border border-rose-900">
                <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
                <div className="text-sm">
                  <span className="font-semibold block">Failed to save vehicle</span>
                  {submitError}
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Nickname */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]">
                  Nickname *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Swift Commuter, Family Nexon"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  disabled={submitting || submitSuccess}
                  className={`w-full rounded-xl border bg-[#101C1C] px-4 py-2.5 text-sm text-[#F5F7F6] placeholder:text-[#81918E] outline-none transition-all focus:bg-[#132020] ${
                    validationErrors.nickname
                      ? "border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                      : "border-[#203131] focus:border-[#66C56A] focus:ring-1 focus:ring-[#66C56A]"
                  }`}
                />
                {validationErrors.nickname && (
                  <p className="text-xs font-medium text-rose-400 mt-1">{validationErrors.nickname}</p>
                )}
                <span className="text-[11px] text-[#81918E] block">
                  Note: Nickname will be kept locally since persistent backend storage is currently being set up.
                </span>
              </div>

              {/* Vehicle Type */}
              <div className="space-y-1.5 sm:col-span-2">
                <label
                  htmlFor="vehicle-type"
                  className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]"
                >
                  Vehicle Type *
                </label>
                <SearchableSelect
                  id="vehicle-type"
                  name="vehicleType"
                  value={vehicleType}
                  onChange={handleVehicleTypeChange}
                  options={vehicleTypeOptions}
                  placeholder="Select vehicle type"
                  noResultsMessage="No matching vehicle type found"
                  disabled={submitting || submitSuccess}
                  error={!!validationErrors.vehicleType}
                />
                {validationErrors.vehicleType && (
                  <p className="text-xs font-medium text-rose-400 mt-1">{validationErrors.vehicleType}</p>
                )}
              </div>

              {/* Make */}
              <div className="space-y-1.5">
                <label
                  htmlFor="make"
                  className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]"
                >
                  Make *
                </label>
                <SearchableSelect
                  id="make"
                  name="make"
                  value={make}
                  onChange={handleMakeChange}
                  options={makeOptions}
                  placeholder={vehicleType ? "Select or type make" : "Select vehicle type first"}
                  noResultsMessage="No matching vehicle make found"
                  disabled={!vehicleType || submitting || submitSuccess}
                  error={!!validationErrors.make}
                  allowCustom={true}
                />
                {validationErrors.make && !isCustomMake && (
                  <p className="text-xs font-medium text-rose-400 mt-1">{validationErrors.make}</p>
                )}
              </div>

              {/* Custom Make Field (shown when "Others" is selected) */}
              {isCustomMake && (
                <div className="space-y-1.5 sm:col-span-2">
                  <label
                    htmlFor="custom-make"
                    className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]"
                  >
                    Custom Make *
                  </label>
                  <input
                    id="custom-make"
                    type="text"
                    placeholder="Enter custom make (e.g. Mahindra, Volvo, BYD)"
                    value={customMake}
                    onChange={(e) => {
                      setCustomMake(e.target.value);
                      setValidationErrors((prev) => {
                        const updated = { ...prev };
                        delete updated.make;
                        return updated;
                      });
                    }}
                    disabled={submitting || submitSuccess}
                    className={`w-full rounded-xl border bg-[#101C1C] px-4 py-2.5 text-sm text-[#F5F7F6] placeholder:text-[#81918E] outline-none transition-all focus:bg-[#132020] ${
                      validationErrors.make
                        ? "border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                        : "border-[#203131] focus:border-[#66C56A] focus:ring-1 focus:ring-[#66C56A]"
                    }`}
                  />
                  {validationErrors.make && (
                    <p className="text-xs font-medium text-rose-400 mt-1">{validationErrors.make}</p>
                  )}
                </div>
              )}

              {/* Model */}
              <div className="space-y-1.5">
                <label
                  htmlFor="model"
                  className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]"
                >
                  Model *
                </label>
                <SearchableSelect
                  id="model"
                  name="model"
                  value={model}
                  onChange={handleModelChange}
                  options={modelOptions}
                  placeholder={
                    !make
                      ? "Select make first"
                      : "Select or type model"
                  }
                  noResultsMessage="No matching catalog model found"
                  disabled={!make || submitting || submitSuccess}
                  error={!!validationErrors.model}
                  allowCustom={true}
                />
                {validationErrors.model && (
                  <p className="text-xs font-medium text-rose-400 mt-1">{validationErrors.model}</p>
                )}
                {!validationErrors.model && make && (
                  <span className="text-[11px] text-[#81918E] block">
                    Type a custom model or select from suggestions.
                  </span>
                )}
              </div>

              {/* Year */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]">
                  Year *
                </label>
                <input
                  type="number"
                  placeholder="e.g. 2023"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  disabled={submitting || submitSuccess}
                  className={`w-full rounded-xl border bg-[#101C1C] px-4 py-2.5 text-sm text-[#F5F7F6] placeholder:text-[#81918E] outline-none transition-all focus:bg-[#132020] ${
                    validationErrors.year
                      ? "border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                      : "border-[#203131] focus:border-[#66C56A] focus:ring-1 focus:ring-[#66C56A]"
                  }`}
                />
                {validationErrors.year && (
                  <p className="text-xs font-medium text-rose-400 mt-1">{validationErrors.year}</p>
                )}
              </div>

              {/* Mileage (Odometer) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]">
                  Odometer Mileage (km) *
                </label>
                <input
                  type="number"
                  placeholder="e.g. 45000"
                  value={mileage}
                  onChange={(e) => setMileage(e.target.value)}
                  disabled={submitting || submitSuccess}
                  className={`w-full rounded-xl border bg-[#101C1C] px-4 py-2.5 text-sm text-[#F5F7F6] placeholder:text-[#81918E] outline-none transition-all focus:bg-[#132020] ${
                    validationErrors.mileage
                      ? "border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                      : "border-[#203131] focus:border-[#66C56A] focus:ring-1 focus:ring-[#66C56A]"
                  }`}
                />
                {validationErrors.mileage && (
                  <p className="text-xs font-medium text-rose-400 mt-1">{validationErrors.mileage}</p>
                )}
              </div>

              {/* VIN */}
              <div className="space-y-1.5 sm:col-span-2">
                <div className="flex items-center gap-1.5">
                  <label htmlFor="vin" className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]">
                    VIN (Vehicle Identification Number) *
                  </label>
                  <div className="relative inline-flex items-center" ref={vinHelpRef}>
                    <button
                      type="button"
                      onClick={() => setShowVinHelp((prev) => !prev)}
                      aria-label="How to find your VIN"
                      aria-expanded={showVinHelp}
                      aria-haspopup="dialog"
                      className="inline-flex items-center justify-center rounded-full text-[#81918E] hover:text-[#66C56A] hover:bg-[#132020] p-0.5 focus:outline-none focus:ring-2 focus:ring-[#66C56A]/30 transition-colors"
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                    </button>

                    {showVinHelp && (
                      <>
                        <div
                          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs sm:hidden animate-in fade-in-0 duration-100"
                          onClick={() => setShowVinHelp(false)}
                          aria-hidden="true"
                        />

                        <div
                          role="dialog"
                          aria-label="How to Get Your VIN Number"
                          className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 mx-auto max-w-sm sm:max-w-none sm:translate-y-0 sm:inset-x-auto sm:top-auto sm:bottom-full sm:left-0 sm:mb-2 w-auto sm:w-80 max-h-[80vh] sm:max-h-[min(270px,calc(100vh-14rem))] flex flex-col bg-[#0B1515] border border-[#203131] rounded-2xl sm:rounded-xl shadow-2xl sm:shadow-xl text-xs text-[#B8C4C2] animate-in fade-in-0 zoom-in-95 duration-100 sm:absolute"
                        >
                          <div className="flex items-center justify-between gap-2 px-4 py-3 sm:px-3.5 sm:pt-3 sm:pb-2 border-b border-[#203131] bg-[#0B1515] rounded-t-2xl sm:rounded-t-xl shrink-0">
                            <span className="font-semibold text-[#F5F7F6] flex items-center gap-1.5 text-sm sm:text-xs">
                              <HelpCircle className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-[#66C56A] shrink-0" />
                              How to Get Your VIN Number
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowVinHelp(false)}
                              aria-label="Close VIN help"
                              className="rounded-full p-1 text-[#81918E] hover:text-[#F5F7F6] hover:bg-[#132020] transition-colors shrink-0"
                            >
                              <X className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                            </button>
                          </div>

                          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3.5 sm:px-3.5 sm:py-3 space-y-2.5 text-[#B8C4C2] overscroll-contain">
                            <p className="leading-relaxed">
                              A VIN (Vehicle Identification Number) is a unique 17-character code made of letters and numbers used to identify your vehicle.
                            </p>
                            <p className="font-medium text-[#F5F7F6]">Common places to find it:</p>
                            <ul className="space-y-1.5">
                              <li className="flex items-start gap-1.5">
                                <span className="text-[#66C56A] font-bold shrink-0">•</span>
                                <span>On the dashboard near the windshield on the driver&apos;s side.</span>
                              </li>
                              <li className="flex items-start gap-1.5">
                                <span className="text-[#66C56A] font-bold shrink-0">•</span>
                                <span>On the driver&apos;s side door frame or door post when opened.</span>
                              </li>
                              <li className="flex items-start gap-1.5">
                                <span className="text-[#66C56A] font-bold shrink-0">•</span>
                                <span>Printed on your vehicle registration or insurance documents.</span>
                              </li>
                            </ul>
                            <div className="rounded-lg bg-[#101C1C] border border-[#2E7D32]/40 p-2 text-[11px] text-[#66C56A] font-medium">
                              Note: A standard VIN is 17 characters long and uses letters and numbers (excluding letters I, O, and Q).
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <input
                  id="vin"
                  type="text"
                  placeholder="17-character alphanumeric code"
                  value={vin}
                  onChange={(e) => setVin(e.target.value)}
                  disabled={submitting || submitSuccess}
                  className={`w-full rounded-xl border bg-[#101C1C] px-4 py-2.5 text-sm text-[#F5F7F6] placeholder:text-[#81918E] outline-none uppercase transition-all focus:bg-[#132020] ${
                    validationErrors.vin
                      ? "border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                      : "border-[#203131] focus:border-[#66C56A] focus:ring-1 focus:ring-[#66C56A]"
                  }`}
                />
                {validationErrors.vin && (
                  <p className="text-xs font-medium text-rose-400 mt-1">{validationErrors.vin}</p>
                )}
              </div>
            </div>
          </CardContent>

          <CardFooter className="form-action-footer flex justify-between items-center border-t border-[#203131] bg-[#101C1C]/50 px-6 py-4 rounded-b-2xl">
            <Link href="/vehicles">
              <Button type="button" variant="outline" className="form-cancel-btn rounded-xl border-[#203131] bg-[#132020] text-[#F5F7F6] hover:bg-[#132020]" disabled={submitting || submitSuccess}>
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={submitting || submitSuccess}
              className="rounded-xl bg-[#2E7D32] text-white hover:bg-[#256628] flex items-center gap-2 shadow-xs"
            >
              <Save className="h-4 w-4" />
              {submitting ? "Registering..." : "Register Vehicle"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
