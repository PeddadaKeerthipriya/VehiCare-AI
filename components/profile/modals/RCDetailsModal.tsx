"use client";

import React, { useState, useEffect } from "react";
import { X, Car, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RCDetails, Vehicle } from "@/lib/types";

interface RCDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: RCDetails | null;
  existingVehicles?: Vehicle[];
  onSave: (data: RCDetails) => void;
}

export function RCDetailsModal({
  isOpen,
  onClose,
  initialData,
  existingVehicles = [],
  onSave,
}: RCDetailsModalProps) {
  const [regNo, setRegNo] = useState(initialData?.registrationNumber || "");
  const [make, setMake] = useState(initialData?.make || "");
  const [model, setModel] = useState(initialData?.model || "");
  const [year, setYear] = useState(String(initialData?.year || "2023"));
  const [vin, setVin] = useState(initialData?.vin || "");
  const [odometer, setOdometer] = useState(String(initialData?.odometer || "15000"));

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      setRegNo(initialData.registrationNumber);
      setMake(initialData.make);
      setModel(initialData.model);
      setYear(String(initialData.year));
      setVin(initialData.vin);
      setOdometer(String(initialData.odometer));
    } else if (existingVehicles.length > 0 && !make) {
      const v = existingVehicles[0];
      setMake(v.make);
      setModel(v.model);
      setYear(String(v.year));
      setVin(v.vin);
      setOdometer(String(v.odometer_km));
    }
  }, [initialData, existingVehicles, make]);

  if (!isOpen) return null;

  const handleSelectVehicle = (vehicleId: string) => {
    setSelectedVehicleId(vehicleId);
    const found = existingVehicles.find((v) => v.id === vehicleId);
    if (found) {
      setMake(found.make);
      setModel(found.model);
      setYear(String(found.year));
      setVin(found.vin);
      setOdometer(String(found.odometer_km));
    }
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!regNo.trim()) errs.regNo = "Registration number is required.";
    if (!make.trim()) errs.make = "Make is required.";
    if (!model.trim()) errs.model = "Model is required.";
    if (!year.trim() || isNaN(Number(year))) errs.year = "Valid year is required.";
    if (!vin.trim()) errs.vin = "VIN / Chassis number is required.";
    if (!odometer.trim() || isNaN(Number(odometer))) errs.odometer = "Odometer reading is required.";

    setValidationErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validate()) return;

    const data: RCDetails = {
      registrationNumber: regNo.trim().toUpperCase(),
      make: make.trim(),
      model: model.trim(),
      year: parseInt(year, 10),
      vin: vin.trim().toUpperCase(),
      odometer: parseInt(odometer, 10),
    };

    setSuccess(true);
    onSave(data);

    setTimeout(() => {
      onClose();
    }, 600);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rc-modal-title"
    >
      <div className="w-full max-w-lg rounded-2xl bg-[#0B1515] p-6 shadow-xl border border-[#203131] space-y-5 relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#203131] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#101C1C] text-[#66C56A] border border-[#2E7D32]/30">
              <Car className="h-5 w-5" />
            </div>
            <div>
              <h2 id="rc-modal-title" className="text-xl font-bold text-[#F5F7F6]">
                Vehicle & RC Details
              </h2>
              <p className="text-xs text-[#81918E] mt-0.5">
                Register your vehicle Registration Certificate details.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-xl p-1.5 text-[#81918E] hover:bg-[#132020] hover:text-[#F5F7F6] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Feedback */}
        {success && (
          <div className="flex items-center gap-2 rounded-xl bg-[#101C1C] p-3 text-sm text-[#66C56A] border border-[#2E7D32]/40">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-[#66C56A]" />
            <span>Vehicle & RC details recorded successfully!</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-950/40 p-3 text-sm text-rose-300 border border-rose-900">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Quick Pre-fill from Fleet */}
        {existingVehicles.length > 0 && (
          <div className="rounded-xl bg-[#101C1C] border border-[#203131] p-3">
            <label className="block text-xs font-semibold text-[#B8C4C2] mb-1.5">
              Quick Pre-fill from Garage Fleet
            </label>
            <select
              value={selectedVehicleId}
              onChange={(e) => handleSelectVehicle(e.target.value)}
              className="w-full rounded-lg border border-[#203131] bg-[#132020] px-3 py-2 text-xs text-[#F5F7F6] outline-none focus:border-[#66C56A]"
            >
              <option value="">-- Select a vehicle from your garage --</option>
              {existingVehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.year} {v.make} {v.model} ({v.vin})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Registration Number */}
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]">
                Registration Number (RC) *
              </label>
              <input
                type="text"
                value={regNo}
                onChange={(e) => setRegNo(e.target.value)}
                placeholder="e.g. DL 01 AB 1234"
                className={`w-full rounded-xl border bg-[#101C1C] px-4 py-2.5 text-sm text-[#F5F7F6] uppercase outline-none focus:bg-[#132020] ${
                  validationErrors.regNo ? "border-rose-500" : "border-[#203131] focus:border-[#66C56A]"
                }`}
              />
              {validationErrors.regNo && (
                <p className="text-xs text-rose-400 mt-1">{validationErrors.regNo}</p>
              )}
            </div>

            {/* Make */}
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]">
                Make *
              </label>
              <input
                type="text"
                value={make}
                onChange={(e) => setMake(e.target.value)}
                placeholder="e.g. Maruti Suzuki"
                className={`w-full rounded-xl border bg-[#101C1C] px-4 py-2.5 text-sm text-[#F5F7F6] outline-none focus:bg-[#132020] ${
                  validationErrors.make ? "border-rose-500" : "border-[#203131] focus:border-[#66C56A]"
                }`}
              />
              {validationErrors.make && (
                <p className="text-xs text-rose-400 mt-1">{validationErrors.make}</p>
              )}
            </div>

            {/* Model */}
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]">
                Model *
              </label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. Swift ZXi"
                className={`w-full rounded-xl border bg-[#101C1C] px-4 py-2.5 text-sm text-[#F5F7F6] outline-none focus:bg-[#132020] ${
                  validationErrors.model ? "border-rose-500" : "border-[#203131] focus:border-[#66C56A]"
                }`}
              />
              {validationErrors.model && (
                <p className="text-xs text-rose-400 mt-1">{validationErrors.model}</p>
              )}
            </div>

            {/* Year */}
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]">
                Manufacturing Year *
              </label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="e.g. 2023"
                className={`w-full rounded-xl border bg-[#101C1C] px-4 py-2.5 text-sm text-[#F5F7F6] outline-none focus:bg-[#132020] ${
                  validationErrors.year ? "border-rose-500" : "border-[#203131] focus:border-[#66C56A]"
                }`}
              />
              {validationErrors.year && (
                <p className="text-xs text-rose-400 mt-1">{validationErrors.year}</p>
              )}
            </div>

            {/* Odometer */}
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]">
                Odometer (KM) *
              </label>
              <input
                type="number"
                value={odometer}
                onChange={(e) => setOdometer(e.target.value)}
                placeholder="e.g. 25000"
                className={`w-full rounded-xl border bg-[#101C1C] px-4 py-2.5 text-sm text-[#F5F7F6] outline-none focus:bg-[#132020] ${
                  validationErrors.odometer ? "border-rose-500" : "border-[#203131] focus:border-[#66C56A]"
                }`}
              />
              {validationErrors.odometer && (
                <p className="text-xs text-rose-400 mt-1">{validationErrors.odometer}</p>
              )}
            </div>

            {/* VIN */}
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]">
                VIN / Chassis Number *
              </label>
              <input
                type="text"
                value={vin}
                onChange={(e) => setVin(e.target.value)}
                placeholder="17-character VIN"
                className={`w-full rounded-xl border bg-[#101C1C] px-4 py-2.5 text-sm font-mono uppercase text-[#F5F7F6] outline-none focus:bg-[#132020] ${
                  validationErrors.vin ? "border-rose-500" : "border-[#203131] focus:border-[#66C56A]"
                }`}
              />
              {validationErrors.vin && (
                <p className="text-xs text-rose-400 mt-1">{validationErrors.vin}</p>
              )}
            </div>
          </div>

          <p className="text-[11px] text-[#81918E] italic">
            * Frontend Demo: Stored in active session state for profile completion tracking.
          </p>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#203131]">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-xl border-[#203131] bg-[#132020] text-[#F5F7F6] hover:bg-[#132020]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={success}
              className="rounded-xl bg-[#2E7D32] text-white hover:bg-[#256628] shadow-xs min-w-[120px]"
            >
              Save RC Details
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
