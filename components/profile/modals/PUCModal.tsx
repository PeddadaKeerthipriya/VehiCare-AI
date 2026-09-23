"use client";

import React, { useState, useEffect } from "react";
import { X, FileCheck, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PUCDetails, Vehicle } from "@/lib/types";
import { createVehiclePuc, getVehiclePuc } from "@/lib/api";
import { emitDocumentUpdate } from "@/lib/realtimeSync";

interface PUCModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: PUCDetails | null;
  existingVehicles?: Vehicle[];
  initialVehicleId?: string;
  onSave: (data: PUCDetails, vehicleId?: string) => void;
}

export function PUCModal({
  isOpen,
  onClose,
  initialData,
  existingVehicles = [],
  initialVehicleId,
  onSave,
}: PUCModalProps) {
  const [selectedVehicleId, setSelectedVehicleId] = useState(initialVehicleId || "");
  const [certNo, setCertNo] = useState(initialData?.certificateNumber || "");
  const [issueDate, setIssueDate] = useState(initialData?.issueDate || "");
  const [expiryDate, setExpiryDate] = useState(initialData?.expiryDate || "");
  const [status, setStatus] = useState<"Valid" | "Expired" | "Pending">(
    initialData?.status || "Valid"
  );

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loadingPuc, setLoadingPuc] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Reset & initialize when modal opens
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

  // Fetch existing PUC for selected vehicle
  useEffect(() => {
    if (!isOpen || !selectedVehicleId) {
      return;
    }

    let active = true;
    setLoadingPuc(true);
    // Clear fields synchronously on vehicle change
    setCertNo("");
    setIssueDate("");
    setExpiryDate("");
    setStatus("Valid");

    getVehiclePuc(selectedVehicleId)
      .then((puc) => {
        if (!active) return;
        if (puc) {
          setCertNo(puc.certificate_number || "");
          setIssueDate(puc.issued_date ? puc.issued_date.split("T")[0] : "");
          setExpiryDate(puc.expiry_date ? puc.expiry_date.split("T")[0] : "");
          if (puc.status === "Valid" || puc.status === "Expired" || puc.status === "Pending") {
            setStatus(puc.status);
          } else {
            setStatus("Valid");
          }
        } else if (initialData && initialVehicleId === selectedVehicleId) {
          setCertNo(initialData.certificateNumber || "");
          setIssueDate(initialData.issueDate || "");
          setExpiryDate(initialData.expiryDate || "");
          setStatus(initialData.status || "Valid");
        }
      })
      .catch((fetchErr) => {
        if (!active) return;
        console.error("Failed to fetch existing PUC for vehicle:", fetchErr);
        setCertNo("");
        setIssueDate("");
        setExpiryDate("");
        setStatus("Valid");
      })
      .finally(() => {
        if (active) setLoadingPuc(false);
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
    if (!certNo.trim()) errs.certNo = "Certificate number is required.";
    if (!issueDate.trim()) errs.issueDate = "Issue date is required.";
    if (!expiryDate.trim()) errs.expiryDate = "Expiry date is required.";
    if (issueDate && expiryDate && new Date(issueDate) >= new Date(expiryDate)) {
      errs.expiryDate = "Expiry date must be after issue date.";
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
      const data: PUCDetails = {
        certificateNumber: certNo.trim().toUpperCase(),
        issueDate,
        expiryDate,
        status,
      };

      if (selectedVehicleId) {
        await createVehiclePuc(selectedVehicleId, {
          certificate_number: certNo.trim().toUpperCase(),
          issued_date: issueDate,
          expiry_date: expiryDate,
          emission_details: "BS VI Compliant",
        });
        emitDocumentUpdate(selectedVehicleId, "puc");
      }

      setSuccess(true);
      onSave(data, selectedVehicleId);

      setTimeout(() => {
        onClose();
      }, 600);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save PUC certificate."
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
      aria-labelledby="puc-modal-title"
    >
      <div className="w-full max-w-lg rounded-2xl bg-[#0B1515] p-6 shadow-xl border border-[#203131] space-y-5 relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#203131] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#101C1C] text-[#66C56A] border border-[#2E7D32]/30">
              <FileCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 id="puc-modal-title" className="text-xl font-bold text-[#F5F7F6]">
                Pollution Under Control (PUC)
              </h2>
              <p className="text-xs text-[#81918E] mt-0.5">
                Record your emission test certificate details.
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
            <span>PUC Certificate details saved successfully!</span>
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
              {loadingPuc && (
                <div className="flex items-center gap-1.5 text-xs text-[#66C56A] mt-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Loading vehicle PUC details...</span>
                </div>
              )}
              {validationErrors.selectedVehicleId && (
                <p className="text-xs text-rose-400 mt-1">
                  {validationErrors.selectedVehicleId}
                </p>
              )}
            </div>
          )}

          {/* Certificate Number */}
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]">
              Certificate Number *
            </label>
            <input
              type="text"
              value={certNo}
              onChange={(e) => setCertNo(e.target.value)}
              placeholder="e.g. PUC-4102-9821-DL"
              className={`w-full rounded-xl border bg-[#101C1C] px-4 py-2.5 text-sm font-mono text-[#F5F7F6] uppercase outline-none focus:bg-[#132020] ${
                validationErrors.certNo ? "border-rose-500" : "border-[#203131] focus:border-[#66C56A]"
              }`}
            />
            {validationErrors.certNo && (
              <p className="text-xs text-rose-400 mt-1">{validationErrors.certNo}</p>
            )}
          </div>

          {/* Dates */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]">
                Issue Date *
              </label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className={`w-full rounded-xl border bg-[#101C1C] px-4 py-2.5 text-sm text-[#F5F7F6] outline-none focus:bg-[#132020] ${
                  validationErrors.issueDate ? "border-rose-500" : "border-[#203131] focus:border-[#66C56A]"
                }`}
              />
              {validationErrors.issueDate && (
                <p className="text-xs text-rose-400 mt-1">{validationErrors.issueDate}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]">
                Expiry Date *
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

          {/* Status */}
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]">
              Certificate Status *
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "Valid" | "Expired" | "Pending")}
              className="w-full rounded-xl border border-[#203131] bg-[#101C1C] px-4 py-2.5 text-sm text-[#F5F7F6] outline-none focus:bg-[#132020] focus:border-[#66C56A]"
            >
              <option value="Valid">Valid / Certified</option>
              <option value="Pending">Pending Renewal</option>
              <option value="Expired">Expired</option>
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
                "Save PUC Details"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
