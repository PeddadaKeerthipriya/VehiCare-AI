"use client";

import React, { useState, useEffect } from "react";
import { X, ShieldCheck, AlertCircle, CheckCircle2, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InsuranceDetails, Vehicle } from "@/lib/types";
import { createInsurancePolicy, getInsurancePolicies } from "@/lib/api";
import { getLatestInsurancePolicy } from "@/lib/documents";
import { emitDocumentUpdate } from "@/lib/realtimeSync";

interface InsuranceModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: InsuranceDetails | null;
  existingVehicles: Vehicle[];
  initialVehicleId?: string;
  onSave: (data: InsuranceDetails, vehicleId?: string) => void;
}

export function InsuranceModal({
  isOpen,
  onClose,
  initialData,
  existingVehicles,
  initialVehicleId,
  onSave,
}: InsuranceModalProps) {
  const [provider, setProvider] = useState(initialData?.provider || "");
  const [selectedVehicleId, setSelectedVehicleId] = useState(initialVehicleId || "");
  const [policyNumber, setPolicyNumber] = useState(initialData?.policyNumber || "");
  const [startDate, setStartDate] = useState(initialData?.startDate || "");
  const [expiryDate, setExpiryDate] = useState(initialData?.expiryDate || "");
  const [documentFileName, setDocumentFileName] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loadingPolicy, setLoadingPolicy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Reset & initialize when modal opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccess(false);
      setSaving(false);
      setDocumentFile(null);
      setDocumentFileName("");
      setValidationErrors({});

      const targetVehicleId = initialVehicleId || existingVehicles[0]?.id || "";
      setSelectedVehicleId(targetVehicleId);
    }
  }, [isOpen, initialVehicleId, existingVehicles]);

  // Fetch policy when selectedVehicleId changes
  useEffect(() => {
    if (!isOpen || !selectedVehicleId) {
      return;
    }

    let active = true;
    setLoadingPolicy(true);
    // Clear fields synchronously on vehicle change to avoid stale values
    setProvider("");
    setPolicyNumber("");
    setStartDate("");
    setExpiryDate("");

    getInsurancePolicies(selectedVehicleId)
      .then((policies) => {
        if (!active) return;
        const latest = getLatestInsurancePolicy(policies);
        if (latest) {
          setProvider(latest.insurer || "");
          setPolicyNumber(latest.policy_number || "");
          setStartDate(latest.start_date ? latest.start_date.split("T")[0] : "");
          setExpiryDate(latest.expiry_date ? latest.expiry_date.split("T")[0] : "");
        } else if (initialData && initialVehicleId === selectedVehicleId) {
          setProvider(initialData.provider || "");
          setPolicyNumber(initialData.policyNumber || "");
          setStartDate(initialData.startDate || "");
          setExpiryDate(initialData.expiryDate || "");
        }
      })
      .catch((fetchErr) => {
        if (!active) return;
        console.error("Failed to fetch existing insurance for vehicle:", fetchErr);
        setProvider("");
        setPolicyNumber("");
        setStartDate("");
        setExpiryDate("");
      })
      .finally(() => {
        if (active) setLoadingPolicy(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, selectedVehicleId, initialVehicleId, initialData]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!selectedVehicleId) {
      errs.selectedVehicleId = "Please select a vehicle.";
    }
    if (!provider.trim()) errs.provider = "Insurance provider name is required.";
    if (!policyNumber.trim()) errs.policyNumber = "Policy number is required.";
    if (!startDate.trim()) errs.startDate = "Start date is required.";
    if (!expiryDate.trim()) errs.expiryDate = "Expiry date is required.";
    if (startDate && expiryDate && new Date(startDate) >= new Date(expiryDate)) {
      errs.expiryDate = "Expiry date must be after start date.";
    }

    setValidationErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validate()) return;

    try {
      setSaving(true);
      const selectedVehicle = existingVehicles.find(
        (vehicle) => vehicle.id === selectedVehicleId
      );

      if (!selectedVehicle) {
        setError("Please select a vehicle.");
        setSaving(false);
        return;
      }

      const data: InsuranceDetails = {
        provider: provider.trim(),
        policyNumber: policyNumber.trim().toUpperCase(),
        startDate,
        expiryDate,
      };

      await createInsurancePolicy(selectedVehicle.id, {
        insurer: provider.trim(),
        policy_number: policyNumber.trim().toUpperCase(),
        start_date: startDate,
        expiry_date: expiryDate,
        document: documentFile,
      });

      emitDocumentUpdate(selectedVehicle.id, "insurance");
      setSuccess(true);
      onSave(data, selectedVehicle.id);

      setTimeout(() => {
        onClose();
      }, 600);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save insurance policy."
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
      aria-labelledby="insurance-modal-title"
    >
      <div className="w-full max-w-lg rounded-2xl bg-[#0B1515] p-6 shadow-xl border border-[#203131] space-y-5 relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#203131] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#101C1C] text-[#66C56A] border border-[#2E7D32]/30">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 id="insurance-modal-title" className="text-xl font-bold text-[#F5F7F6]">
                Insurance Details
              </h2>
              <p className="text-xs text-[#81918E] mt-0.5">
                Keep motor insurance policy and validity on record.
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
            <span>Insurance policy details saved successfully!</span>
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
          <div className="space-y-1">
  <label className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]">
    Select Vehicle *
  </label>

  <select
    disabled={existingVehicles.length === 0}
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
  {loadingPolicy && (
    <div className="flex items-center gap-1.5 text-xs text-[#66C56A] mt-1">
      <Loader2 className="h-3 w-3 animate-spin" />
      <span>Loading vehicle insurance records...</span>
    </div>
  )}
  {validationErrors.selectedVehicleId && (
    <p className="text-xs text-rose-400 mt-1">
      {validationErrors.selectedVehicleId}
    </p>
  )}
</div>
          {/* Provider */}
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]">
              Insurance Provider *
            </label>
            <input
              type="text"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="e.g. ICICI Lombard / HDFC ERGO / Digit"
              className={`w-full rounded-xl border bg-[#101C1C] px-4 py-2.5 text-sm text-[#F5F7F6] outline-none focus:bg-[#132020] ${
                validationErrors.provider ? "border-rose-500" : "border-[#203131] focus:border-[#66C56A]"
              }`}
            />
            {validationErrors.provider && (
              <p className="text-xs text-rose-400 mt-1">{validationErrors.provider}</p>
            )}
          </div>

          {/* Policy Number */}
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]">
              Policy Number *
            </label>
            <input
              type="text"
              value={policyNumber}
              onChange={(e) => setPolicyNumber(e.target.value)}
              placeholder="e.g. POL-9821-4321-00"
              className={`w-full rounded-xl border bg-[#101C1C] px-4 py-2.5 text-sm font-mono text-[#F5F7F6] uppercase outline-none focus:bg-[#132020] ${
                validationErrors.policyNumber ? "border-rose-500" : "border-[#203131] focus:border-[#66C56A]"
              }`}
            />
            {validationErrors.policyNumber && (
              <p className="text-xs text-rose-400 mt-1">{validationErrors.policyNumber}</p>
            )}
          </div>

          {/* Dates */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]">
                Policy Start Date *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={`w-full rounded-xl border bg-[#101C1C] px-4 py-2.5 text-sm text-[#F5F7F6] outline-none focus:bg-[#132020] ${
                  validationErrors.startDate ? "border-rose-500" : "border-[#203131] focus:border-[#66C56A]"
                }`}
              />
              {validationErrors.startDate && (
                <p className="text-xs text-rose-400 mt-1">{validationErrors.startDate}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]">
                Policy Expiry Date *
              </label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className={`w-full rounded-xl border bg-[#101C1C] px-4 py-2.5 text-sm text-[#F5F7F6] outline-none focus:bg-[#132020] ${
                  validationErrors.expiryDate ? "border-rose-500" : "border-[#203131] focus:border-[#66C56A]"
                }`}
              />
              {validationErrors.expiryDate && (
                <p className="text-xs text-rose-400 mt-1">{validationErrors.expiryDate}</p>
              )}
            </div>
          </div>
          {/* Optional Document Upload */}
<div className="space-y-1">
  <label className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]">
    Insurance Document (Optional)
  </label>

  <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-[#203131] bg-[#101C1C] px-4 py-3 text-sm text-[#B8C4C2] hover:border-[#66C56A]">
    <Upload className="h-4 w-4 text-[#66C56A]" />
    <span>
       {documentFileName || "Upload insurance document"}
    </span>
    <input
     type="file"
     accept=".pdf,.jpg,.jpeg,.png"
     className="hidden"
     onChange={(e) => {
  const file = e.target.files?.[0] || null;
  setDocumentFile(file);
  setDocumentFileName(file ? file.name : "");
}}
  />
  </label>

  <p className="text-[11px] text-[#81918E]">
    PDF, JPG, JPEG, or PNG. Optional.
  </p>
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
                "Save Insurance"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
