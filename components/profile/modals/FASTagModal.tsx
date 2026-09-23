"use client";

import React, { useState, useEffect } from "react";
import { X, CreditCard, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FASTagDetails, Vehicle } from "@/lib/types";
import { createVehicleFastag, getVehicleFastag } from "@/lib/api";
import { emitDocumentUpdate } from "@/lib/realtimeSync";

interface FASTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: FASTagDetails | null;
  existingVehicles?: Vehicle[];
  initialVehicleId?: string;
  onSave: (data: FASTagDetails, vehicleId?: string) => void;
}

export function FASTagModal({
  isOpen,
  onClose,
  initialData,
  existingVehicles = [],
  initialVehicleId,
  onSave,
}: FASTagModalProps) {
  const [selectedVehicleId, setSelectedVehicleId] = useState(initialVehicleId || "");
  const [provider, setProvider] = useState(initialData?.provider || "");
  const [fastagNumber, setFastagNumber] = useState(initialData?.fastagNumber || "");
  const [lastRechargeDate, setLastRechargeDate] = useState("");
  const [vehicleClass, setVehicleClass] = useState(
    initialData?.vehicleClass || "VC4 (Car / Jeep / Van)"
  );
  const [status, setStatus] = useState<"Active" | "Inactive" | "Low Balance">(
    initialData?.status || "Active"
  );

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loadingFastag, setLoadingFastag] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccess(false);
      setSaving(false);
      setValidationErrors({});

      const targetVehicleId = initialVehicleId || existingVehicles[0]?.id || "";
      setSelectedVehicleId(targetVehicleId);
    }
  }, [isOpen, initialVehicleId, existingVehicles]);

  useEffect(() => {
    if (!isOpen || !selectedVehicleId) return;

    let active = true;
    setLoadingFastag(true);
    // Clear fields synchronously on vehicle change
    setFastagNumber("");
    setLastRechargeDate("");
    setStatus("Active");

    getVehicleFastag(selectedVehicleId)
      .then((fastag) => {
        if (!active) return;
        if (fastag) {
          setFastagNumber(fastag.tag_id || "");
          setLastRechargeDate(fastag.last_recharge_date ? fastag.last_recharge_date.split("T")[0] : "");
          if (fastag.status === "Active" || fastag.status === "Inactive" || fastag.status === "Low Balance") {
            setStatus(fastag.status);
          }
        } else if (initialData && initialVehicleId === selectedVehicleId) {
          setProvider(initialData.provider || "");
          setFastagNumber(initialData.fastagNumber || "");
          setVehicleClass(initialData.vehicleClass || "VC4 (Car / Jeep / Van)");
          setStatus(initialData.status || "Active");
          setLastRechargeDate(initialData.lastRechargeDate || "");
        }
      })
      .catch((fetchErr) => {
        if (!active) return;
        console.error("Failed to fetch existing FASTag for vehicle:", fetchErr);
        setFastagNumber("");
        setLastRechargeDate("");
      })
      .finally(() => {
        if (active) setLoadingFastag(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, selectedVehicleId, initialVehicleId, initialData]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (existingVehicles.length > 0 && !selectedVehicleId) {
      errs.selectedVehicleId = "Please select a vehicle.";
    }
    if (!provider.trim()) errs.provider = "FASTag provider/bank is required.";
    if (!fastagNumber.trim()) errs.fastagNumber = "FASTag tag number is required.";
    if (!vehicleClass.trim()) errs.vehicleClass = "Vehicle class is required.";

    setValidationErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validate()) return;

    try {
      setSaving(true);
      const data: FASTagDetails = {
        provider: provider.trim(),
        fastagNumber: fastagNumber.trim().toUpperCase(),
        vehicleClass,
        status,
        lastRechargeDate,
      };

      if (selectedVehicleId) {
        await createVehicleFastag(selectedVehicleId, {
          tag_id: fastagNumber.trim().toUpperCase(),
          balance: status === "Low Balance" ? 50 : 500,
          last_recharge_date: lastRechargeDate || null,
          status,
        });
        emitDocumentUpdate(selectedVehicleId, "fastag");
      }

      setSuccess(true);
      onSave(data, selectedVehicleId);

      setTimeout(() => {
        onClose();
      }, 600);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save FASTag details."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fastag-modal-title"
    >
      <div className="w-full max-w-lg rounded-2xl bg-[#0B1515] p-6 shadow-xl border border-[#203131] space-y-5 relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#203131] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#101C1C] text-[#66C56A] border border-[#2E7D32]/30">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h2 id="fastag-modal-title" className="text-xl font-bold text-[#F5F7F6]">
                FASTag Electronic Toll
              </h2>
              <p className="text-xs text-[#81918E] mt-0.5">
                Link and track your RFID toll tag details.
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
            <span>FASTag information linked successfully!</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-950/40 p-3 text-sm text-rose-300 border border-rose-900">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Vehicle Dropdown */}
          {existingVehicles.length > 0 && (
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]">
                Select Vehicle *
              </label>

              <select
                disabled={existingVehicles.length === 0 || saving}
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                className="w-full rounded-xl border border-[#203131] bg-[#101C1C] px-4 py-2.5 text-sm text-[#F5F7F6] outline-none focus:bg-[#132020] focus:border-[#66C56A]"
              >
                <option value="">-- Choose a Vehicle --</option>
                {existingVehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.vehicle_type === "Bike" ? "[Bike] " : "[Car] "}
                    {vehicle.make} {vehicle.model} ({vehicle.year})
                  </option>
                ))}
              </select>
              {loadingFastag && (
                <div className="flex items-center gap-1.5 text-xs text-[#66C56A] mt-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Loading vehicle FASTag details...</span>
                </div>
              )}
              {validationErrors.selectedVehicleId && (
                <p className="text-xs text-rose-400 mt-1">
                  {validationErrors.selectedVehicleId}
                </p>
              )}
            </div>
          )}

          {/* Provider */}
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]">
              Issuing Bank / Provider *
            </label>
            <input
              type="text"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="e.g. ICICI Bank / Paytm Payments Bank / SBI / HDFC"
              className={`w-full rounded-xl border bg-[#101C1C] px-4 py-2.5 text-sm text-[#F5F7F6] outline-none focus:bg-[#132020] ${
                validationErrors.provider ? "border-rose-500" : "border-[#203131] focus:border-[#66C56A]"
              }`}
            />
            {validationErrors.provider && (
              <p className="text-xs text-rose-400 mt-1">{validationErrors.provider}</p>
            )}
          </div>

          {/* FASTag Number / Tag ID */}
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]">
              FASTag ID / Barcode Number *
            </label>
            <input
              type="text"
              value={fastagNumber}
              onChange={(e) => setFastagNumber(e.target.value)}
              placeholder="e.g. FT-3412-7832-88"
              className={`w-full rounded-xl border bg-[#101C1C] px-4 py-2.5 text-sm font-mono text-[#F5F7F6] uppercase outline-none focus:bg-[#132020] ${
                validationErrors.fastagNumber ? "border-rose-500" : "border-[#203131] focus:border-[#66C56A]"
              }`}
            />
            {validationErrors.fastagNumber && (
              <p className="text-xs text-rose-400 mt-1">{validationErrors.fastagNumber}</p>
            )}
          </div>
                    {/* Last Recharge Date */}
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]">
              Last Recharge Date
            </label>

            <input
              type="date"
              value={lastRechargeDate}
              onChange={(e) => setLastRechargeDate(e.target.value)}
              className="w-full rounded-xl border border-[#203131] bg-[#101C1C] px-4 py-2.5 text-sm text-[#F5F7F6] outline-none focus:bg-[#132020] focus:border-[#66C56A]"
            />

            <p className="text-[11px] text-[#81918E]">
              Optional — records the most recent FASTag recharge date.
            </p>
          </div>
          {/* Vehicle Class */}
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]">
              Vehicle Class *
            </label>
            <select
              value={vehicleClass}
              onChange={(e) => setVehicleClass(e.target.value)}
              className="w-full rounded-xl border border-[#203131] bg-[#101C1C] px-4 py-2.5 text-sm text-[#F5F7F6] outline-none focus:bg-[#132020] focus:border-[#66C56A]"
            >
              <option value="VC4 (Car / Jeep / Van)">VC4 (Car / Jeep / Van)</option>
              <option value="VC5 (Light Commercial Vehicle)">VC5 (Light Commercial Vehicle)</option>
              <option value="VC6 (Bus / 3-Axle Truck)">VC6 (Bus / 3-Axle Truck)</option>
            </select>
          </div>

          {/* Status */}
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]">
              Tag Status *
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "Active" | "Inactive" | "Low Balance")}
              className="w-full rounded-xl border border-[#203131] bg-[#101C1C] px-4 py-2.5 text-sm text-[#F5F7F6] outline-none focus:bg-[#132020] focus:border-[#66C56A]"
            >
              <option value="Active">Active & Linked</option>
              <option value="Low Balance">Low Balance Alert</option>
              <option value="Inactive">Inactive / Blacklisted</option>
            </select>
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
              disabled={success || saving}
              className="rounded-xl bg-[#2E7D32] text-white hover:bg-[#256628] shadow-xs min-w-[120px] flex items-center justify-center gap-1.5"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                "Save FASTag"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
