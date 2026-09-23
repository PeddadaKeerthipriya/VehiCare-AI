"use client";

import React, { useState, useEffect } from "react";
import {
  Car,
  Calendar,
  Wrench,
  Gauge,
  IndianRupee,
  Building2,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff,
  Sparkles,
  Layers,
  Plus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Vehicle, SlipOcrData } from "@/lib/types";
import { createServiceRecord } from "@/lib/api";

interface SlipReviewFormProps {
  vehicles: Vehicle[];
  initialOcrData?: SlipOcrData | null;
  slipId: string;
  imagePreviewUrl?: string | null;
  fileName?: string | null;
  onSaveSuccess: (serviceRecordId: string) => void;
  onCancel: () => void;
}

function normalizeDateToISO(rawDate?: string | null): string {
  if (!rawDate) return new Date().toISOString().split("T")[0];

  const cleaned = rawDate.trim();

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = cleaned.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // YYYY/MM/DD
  const ymdMatch = cleaned.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (ymdMatch) {
    const [, year, month, day] = ymdMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // Fallback try Date parse
  const parsed = new Date(cleaned);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }

  return new Date().toISOString().split("T")[0];
}

export const SlipReviewForm: React.FC<SlipReviewFormProps> = ({
  vehicles,
  initialOcrData,
  slipId,
  imagePreviewUrl,
  fileName,
  onSaveSuccess,
  onCancel,
}) => {
  // Form State
  const [vehicleId, setVehicleId] = useState<string>("");
  const [serviceDate, setServiceDate] = useState<string>(
    normalizeDateToISO(initialOcrData?.service_date)
  );
  const [serviceType, setServiceType] = useState<string>(
    initialOcrData?.service_type || ""
  );
  const [odometerKm, setOdometerKm] = useState<string>(
    initialOcrData?.odometer_reading ? String(initialOcrData.odometer_reading) : ""
  );
  const [cost, setCost] = useState<string>(
    initialOcrData?.service_cost != null ? String(initialOcrData.service_cost) : ""
  );
  const [provider, setProvider] = useState<string>("");
  const [parts, setParts] = useState<string[]>(
    initialOcrData?.parts_replaced || []
  );
  const [newPartInput, setNewPartInput] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // UI States
  const [showImagePreview, setShowImagePreview] = useState<boolean>(Boolean(imagePreviewUrl));
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<{
    vehicleId?: string;
    serviceDate?: string;
    serviceType?: string;
  }>({});

  // Auto-match vehicle from OCR vehicle_number candidate
  useEffect(() => {
    if (vehicles.length === 0) return;

    if (initialOcrData?.vehicle_number) {
      const ocrNum = initialOcrData.vehicle_number.toUpperCase().replace(/[\s-]/g, "");
      const matched = vehicles.find((v) => {
        const vinClean = v.vin.toUpperCase().replace(/[\s-]/g, "");
        return vinClean.includes(ocrNum) || ocrNum.includes(vinClean);
      });

      if (matched) {
        setVehicleId(matched.id);
        return;
      }
    }

    if (!vehicleId && vehicles.length === 1) {
      setVehicleId(vehicles[0].id);
    }
  }, [vehicles, initialOcrData, vehicleId]);

  const handleAddPart = () => {
    const trimmed = newPartInput.trim();
    if (trimmed && !parts.includes(trimmed)) {
      setParts([...parts, trimmed]);
      setNewPartInput("");
    }
  };

  const handleRemovePart = (partToRemove: string) => {
    setParts(parts.filter((p) => p !== partToRemove));
  };

  const validate = (): boolean => {
    const errors: typeof formErrors = {};

    if (!vehicleId) {
      errors.vehicleId = "Please select an existing vehicle from your garage.";
    }

    if (!serviceDate) {
      errors.serviceDate = "Please choose a valid service date.";
    }

    if (!serviceType.trim()) {
      errors.serviceType = "Service type is required.";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validate()) {
      return;
    }

    setSaving(true);

    try {
      const notesSections: string[] = [];

      if (notes.trim()) {
        notesSections.push(`Details: ${notes.trim()}`);
      }
      if (provider.trim()) {
        notesSections.push(`Provider: ${provider.trim()}`);
      }
      if (cost.trim()) {
        notesSections.push(`Total Cost: ₹${cost.trim()}`);
      }
      if (odometerKm.trim()) {
        notesSections.push(`Odometer: ${odometerKm.trim()} km`);
      }
      if (parts.length > 0) {
        notesSections.push(`Parts Replaced: ${parts.join(", ")}`);
      }

      const formattedNotes = notesSections.join("\n\n");
      console.log("[SERVICE REQUEST]", {
        vehicle_id: vehicleId,
        service_date: serviceDate,
        service_type: serviceType.trim(),
        notes: formattedNotes,
        slip_id: slipId,
      });

      const result = await createServiceRecord({
        vehicle_id: vehicleId,
        service_date: serviceDate,
        service_type: serviceType.trim(),
        notes: formattedNotes,
        slip_id: slipId,
      });

      onSaveSuccess(result.service_record_id);
    } catch (err: unknown) {
      console.error("Failed to confirm service record:", err);
      const errMsg = err instanceof Error ? err.message : "Failed to save service record. Please check your inputs.";
      setError(errMsg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Auto-extracted Highlights Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#101C1C]/40 p-4 border border-[#2E7D32]/40">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-[#2E7D32] p-2 text-white shadow-xs">
            <Sparkles className="h-4 w-4 text-[#66C56A]" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#66C56A]">
              OCR Extraction Applied
            </h4>
            <p className="text-xs text-[#B8C4C2]">
              Parsed details have been populated into the fields below. Review and modify as needed.
            </p>
          </div>
        </div>

        {imagePreviewUrl && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowImagePreview(!showImagePreview)}
            className="rounded-xl border-[#203131] bg-[#132020] text-[#66C56A] hover:bg-[#101C1C] text-xs font-semibold"
          >
            {showImagePreview ? (
              <>
                <EyeOff className="mr-1.5 h-3.5 w-3.5" />
                Hide Receipt
              </>
            ) : (
              <>
                <Eye className="mr-1.5 h-3.5 w-3.5" />
                View Receipt
              </>
            )}
          </Button>
        )}
      </div>

      {/* Main Grid: Form + Optional Receipt Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Receipt Image Side Panel */}
        {showImagePreview && imagePreviewUrl && (
          <div className="lg:col-span-4 rounded-2xl border border-[#203131] bg-[#0B1515] p-4 space-y-3 sticky top-4">
            <div className="flex items-center justify-between text-xs text-[#81918E] font-semibold">
              <span className="flex items-center gap-1.5 truncate">
                <FileText className="h-3.5 w-3.5 text-[#66C56A]" />
                {fileName || "Uploaded Slip"}
              </span>
              <button
                type="button"
                onClick={() => setShowImagePreview(false)}
                className="text-[#81918E] hover:text-[#F5F7F6] p-1"
                aria-label="Close preview"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-[#203131] bg-[#101C1C] max-h-[500px] flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreviewUrl}
                alt="Uploaded Service Slip"
                className="w-full h-auto max-h-[500px] object-contain"
              />
            </div>
          </div>
        )}

        {/* Review & Edit Form Card */}
        <div className={showImagePreview && imagePreviewUrl ? "lg:col-span-8" : "lg:col-span-12"}>
          <Card className="border-[#203131] bg-[#0B1515] shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-[#203131] pb-4">
              <CardTitle className="text-base font-bold text-[#F5F7F6]">
                Review & Edit Service Details
              </CardTitle>
              <CardDescription className="text-xs text-[#81918E]">
                Verify the extracted fields before linking to your vehicle record.
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-5 pt-5">
                {error && (
                  <div className="flex items-center gap-3 rounded-xl bg-rose-950/40 p-4 text-rose-300 border border-rose-900">
                    <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
                    <div className="text-xs font-medium">{error}</div>
                  </div>
                )}

                {/* Section 1: Vehicle & Date */}
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Vehicle Selector */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#B8C4C2] flex items-center gap-1.5">
                      <Car className="h-3.5 w-3.5 text-[#66C56A]" />
                      Vehicle Selection *
                    </label>
                    <select
                      disabled={saving || vehicles.length === 0}
                      value={vehicleId}
                      onChange={(e) => setVehicleId(e.target.value)}
                      className={`w-full rounded-xl border bg-[#101C1C] px-4 py-2.5 text-sm text-[#F5F7F6] outline-none transition-all focus:bg-[#132020] ${
                        formErrors.vehicleId
                          ? "border-rose-500 focus:ring-1 focus:ring-rose-500"
                          : "border-[#203131] focus:border-[#66C56A] focus:ring-1 focus:ring-[#66C56A]"
                      }`}
                    >
                      <option value="">-- Choose a Vehicle from your Garage --</option>
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.make} {v.model} ({v.year}) — VIN: {v.vin}
                        </option>
                      ))}
                    </select>
                    {formErrors.vehicleId && (
                      <p className="text-xs font-medium text-rose-400 mt-1">{formErrors.vehicleId}</p>
                    )}
                    {initialOcrData?.vehicle_number && (
                      <p className="text-[11px] text-[#81918E]">
                        OCR detected vehicle number candidate:{" "}
                        <span className="font-semibold text-[#F5F7F6]">
                          {initialOcrData.vehicle_number}
                        </span>
                      </p>
                    )}
                  </div>

                  {/* Service Date */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#B8C4C2] flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-[#66C56A]" />
                      Service Date *
                    </label>
                    <input
                      type="date"
                      value={serviceDate}
                      onChange={(e) => setServiceDate(e.target.value)}
                      disabled={saving}
                      className={`w-full rounded-xl border bg-[#101C1C] px-4 py-2.5 text-sm text-[#F5F7F6] outline-none transition-all focus:bg-[#132020] ${
                        formErrors.serviceDate
                          ? "border-rose-500 focus:ring-1 focus:ring-rose-500"
                          : "border-[#203131] focus:border-[#66C56A] focus:ring-1 focus:ring-[#66C56A]"
                      }`}
                    />
                    {formErrors.serviceDate && (
                      <p className="text-xs font-medium text-rose-400 mt-1">{formErrors.serviceDate}</p>
                    )}
                  </div>

                  {/* Service Type */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#B8C4C2] flex items-center gap-1.5">
                      <Wrench className="h-3.5 w-3.5 text-[#66C56A]" />
                      Service Type *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Periodic Maintenance, Oil Change"
                      value={serviceType}
                      onChange={(e) => setServiceType(e.target.value)}
                      disabled={saving}
                      className={`w-full rounded-xl border bg-[#101C1C] px-4 py-2.5 text-sm text-[#F5F7F6] outline-none transition-all focus:bg-[#132020] ${
                        formErrors.serviceType
                          ? "border-rose-500 focus:ring-1 focus:ring-rose-500"
                          : "border-[#203131] focus:border-[#66C56A] focus:ring-1 focus:ring-[#66C56A]"
                      }`}
                    />
                    {formErrors.serviceType && (
                      <p className="text-xs font-medium text-rose-400 mt-1">{formErrors.serviceType}</p>
                    )}
                  </div>

                  {/* Mileage / Odometer */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#B8C4C2] flex items-center gap-1.5">
                      <Gauge className="h-3.5 w-3.5 text-[#66C56A]" />
                      Mileage (Odometer km)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 45000"
                      value={odometerKm}
                      onChange={(e) => setOdometerKm(e.target.value)}
                      disabled={saving}
                      className="w-full rounded-xl border border-[#203131] bg-[#101C1C] px-4 py-2.5 text-sm text-[#F5F7F6] outline-none transition-all focus:bg-[#132020] focus:border-[#66C56A] focus:ring-1 focus:ring-[#66C56A]"
                    />
                  </div>

                  {/* Total Cost */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#B8C4C2] flex items-center gap-1.5">
                      <IndianRupee className="h-3.5 w-3.5 text-[#66C56A]" />
                      Total Cost (₹)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 1250.00"
                      value={cost}
                      onChange={(e) => setCost(e.target.value)}
                      disabled={saving}
                      className="w-full rounded-xl border border-[#203131] bg-[#101C1C] px-4 py-2.5 text-sm text-[#F5F7F6] outline-none transition-all focus:bg-[#132020] focus:border-[#66C56A] focus:ring-1 focus:ring-[#66C56A]"
                    />
                  </div>

                  {/* Provider / Workshop */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#B8C4C2] flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-[#66C56A]" />
                      Service Center / Workshop Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Apex Automotive, City Garage"
                      value={provider}
                      onChange={(e) => setProvider(e.target.value)}
                      disabled={saving}
                      className="w-full rounded-xl border border-[#203131] bg-[#101C1C] px-4 py-2.5 text-sm text-[#F5F7F6] outline-none transition-all focus:bg-[#132020] focus:border-[#66C56A] focus:ring-1 focus:ring-[#66C56A]"
                    />
                  </div>
                </div>

                {/* Section 2: Parts Replaced */}
                <div className="space-y-2 pt-2 border-t border-[#203131]">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#B8C4C2] flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-[#66C56A]" />
                    Parts Replaced / Items
                  </label>

                  <div className="flex flex-wrap gap-2 mb-2">
                    {parts.map((part) => (
                      <span
                        key={part}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#101C1C] px-3 py-1 text-xs font-semibold text-[#66C56A] border border-[#2E7D32]/40"
                      >
                        {part}
                        <button
                          type="button"
                          onClick={() => handleRemovePart(part)}
                          disabled={saving}
                          className="hover:text-rose-400 transition-colors"
                          aria-label={`Remove ${part}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                    {parts.length === 0 && (
                      <p className="text-xs text-[#81918E] italic">No specific parts registered yet.</p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add replacement part (e.g. Engine Oil, Air Filter)"
                      value={newPartInput}
                      onChange={(e) => setNewPartInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddPart();
                        }
                      }}
                      disabled={saving}
                      className="flex-1 rounded-xl border border-[#203131] bg-[#101C1C] px-4 py-2 text-xs text-[#F5F7F6] outline-none focus:bg-[#132020] focus:border-[#66C56A]"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddPart}
                      disabled={saving || !newPartInput.trim()}
                      className="rounded-xl border-[#203131] bg-[#132020] text-[#F5F7F6] text-xs font-semibold"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add Part
                    </Button>
                  </div>
                </div>

                {/* Section 3: Notes / Observations */}
                <div className="space-y-1.5 pt-2 border-t border-[#203131]">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#B8C4C2] flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-[#66C56A]" />
                    Additional Notes & Observations
                  </label>
                  <textarea
                    placeholder="Enter any mechanic recommendations, warranty notes, or diagnostics details..."
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={saving}
                    className="w-full rounded-xl border border-[#203131] bg-[#101C1C] px-4 py-2.5 text-sm text-[#F5F7F6] placeholder:text-[#81918E] outline-none transition-all focus:bg-[#132020] focus:border-[#66C56A] focus:ring-1 focus:ring-[#66C56A]"
                  />
                </div>

                {/* Form Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-[#203131]">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    disabled={saving}
                    className="w-full sm:w-auto rounded-xl border-[#203131] bg-[#132020] text-[#F5F7F6] hover:bg-[#132020]"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={saving}
                    className="w-full sm:w-auto rounded-xl bg-[#2E7D32] text-white hover:bg-[#256628] shadow-xs flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving to Vehicle Record...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Confirm & Save Record
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
};
