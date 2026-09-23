"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  Wrench,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
  FileUp,
  ArrowRight,
  RefreshCw,
  Car,
  Calendar,
  IndianRupee,
  Building2,
  Gauge,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {fetchVehicles, createServiceRecord,uploadServiceSlip,getServiceSlips,} from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Vehicle, ServiceSlip, SlipOcrData, SlipStatus } from "@/lib/types";
import { SlipStatusStepper } from "@/components/slips/SlipStatusStepper";
import { SlipReviewForm } from "@/components/slips/SlipReviewForm";

type TabMode = "upload" | "manual";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/jpg"];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export default function SlipsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabMode>("upload");

  // Vehicles state
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [vehiclesError, setVehiclesError] = useState<string | null>(null);
    // Slip History state
  const [slipHistory, setSlipHistory] = useState<ServiceSlip[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Upload States
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pipeline / Review States
  const [activeSlipId, setActiveSlipId] = useState<string | null>(null);
  const [slipStatus, setSlipStatus] = useState<SlipStatus | string | null>(null);
  const [ocrData, setOcrData] = useState<SlipOcrData | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [pollingActive, setPollingActive] = useState(false);
  const [confirmedRecordId, setConfirmedRecordId] = useState<string | null>(null);

  // Manual Entry States
  const [manualVehicleId, setManualVehicleId] = useState("");
  const [manualServiceDate, setManualServiceDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [manualServiceType, setManualServiceType] = useState("");
  const [manualOdometer, setManualOdometer] = useState("");
  const [manualCost, setManualCost] = useState("");
  const [manualProvider, setManualProvider] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [savingManual, setSavingManual] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualSuccess, setManualSuccess] = useState(false);
  const [manualFormErrors, setManualFormErrors] = useState<{
    vehicleId?: string;
    serviceDate?: string;
    serviceType?: string;
  }>({});

  // Load Vehicles on mount
  useEffect(() => {
    async function loadVehicles() {
      setLoadingVehicles(true);
      setVehiclesError(null);
      try {
        const list = await fetchVehicles();
        setVehicles(list);
      } catch (err: unknown) {
        console.error("Failed to fetch vehicles list:", err);
        const errMsg =
          err instanceof Error ? err.message : "Failed to load vehicles from database.";
        setVehiclesError(errMsg);
      } finally {
        setLoadingVehicles(false);
      }
    }
    loadVehicles();
  }, []);
    // Load Slip History on mount
  useEffect(() => {
    async function loadSlipHistory() {
      setLoadingHistory(true);
      setHistoryError(null);

      try {
        const slips = await getServiceSlips();
        setSlipHistory(slips);
      } catch (err: unknown) {
        console.error("Failed to fetch slip history:", err);

        const errMsg =
          err instanceof Error
            ? err.message
            : "Failed to load slip history.";

        setHistoryError(errMsg);
      } finally {
        setLoadingHistory(false);
      }
    }

    loadSlipHistory();
  }, []);

  // Revoke object URL on unmount or file change
  useEffect(() => {
    return () => {
      if (filePreviewUrl) {
        URL.revokeObjectURL(filePreviewUrl);
      }
    };
  }, [filePreviewUrl]);

  // Supabase Realtime subscription for service slip status updates
useEffect(() => {
  if (!activeSlipId) return;

  const channel = supabase
    .channel(`service-slip-status-${activeSlipId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "service_slips",
        filter: `id=eq.${activeSlipId}`,
      },
      (payload) => {
        const updatedSlip = payload.new as {
          id: string;
          status?: string | null;
          error_message?: string | null;
        };

        setSlipStatus(updatedSlip.status ?? "");

        if (updatedSlip.status === "OCR failed" || updatedSlip.error_message) {
          setOcrError(
            updatedSlip.error_message ||
              "OCR parsing failed for this document."
          );
          setPollingActive(false);
        } else if (
          updatedSlip.status === "Parsed" ||
          updatedSlip.status === "Confirmed"
        ) {
          setPollingActive(false);
        }
      }
    )
    .subscribe((status) => {
      console.log(
        `[SLIP REALTIME] ${activeSlipId}:`,
        status
      );
    });

  return () => {
    supabase.removeChannel(channel);
  };
}, [activeSlipId]);

  // File Validation & Drag-Drop Handlers
  const validateAndSetFile = (file: File) => {
    setUploadError(null);

    // Explicit PDF check with helpful messaging
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      setUploadError(
        "PDF format is not supported. Please upload a clear JPG, JPEG, or PNG image of the service receipt."
      );
      setSelectedFile(null);
      setFilePreviewUrl(null);
      return;
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setUploadError("Invalid file type. Only JPG, JPEG, and PNG images are supported.");
      setSelectedFile(null);
      setFilePreviewUrl(null);
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setUploadError("File size exceeds the 10 MB limit. Please select a smaller image.");
      setSelectedFile(null);
      setFilePreviewUrl(null);
      return;
    }

    setSelectedFile(file);

    // Create image preview
    const previewUrl = URL.createObjectURL(file);
    setFilePreviewUrl(previewUrl);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleRemoveFile = () => {
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
    }
    setSelectedFile(null);
    setFilePreviewUrl(null);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Upload Submission Handler
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || uploading) return;

    setUploading(true);
    setUploadError(null);
    setOcrError(null);

    try {
      const result = await uploadServiceSlip(selectedFile);

      setActiveSlipId(result.slip_id);
      setSlipStatus(result.status);

      // Backend returns parsed OCR data directly under `ocr`
     
 if (result.ocr?.requirements) {
  const requirements = result.ocr.requirements;

  setOcrData({
    vehicle_number: requirements.vehicle_numbers?.[0] ?? null,
    service_date: requirements.service_dates?.[0] ?? null,
    service_type: requirements.service_types?.[0] ?? null,
    parts_replaced: requirements.parts_replaced ?? [],
    service_cost: requirements.service_costs?.[0]
      ? Number(requirements.service_costs[0])
      : null,
    odometer_reading: requirements.odometer_readings?.[0] ?? null,
  });
}

      // If backend processed synchronously to Parsed, stop polling
      if (result.status === "Parsed") {
        setPollingActive(false);
      } else if (result.status === "OCR failed") {
        setOcrError("OCR processing failed for this invoice. You can log it manually.");
        setPollingActive(false);
      } else {
        // Asynchronous processing -> initiate polling
        setPollingActive(true);
      }
    } catch (err: unknown) {
      console.error("Upload error:", err);
      const errMsg =
        err instanceof Error ? err.message : "Failed to upload slip to the backend server.";
      setUploadError(errMsg);
    } finally {
      setUploading(false);
    }
  };

  // Reset to Clean Upload State
  const handleResetFlow = () => {
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
    }
    setSelectedFile(null);
    setFilePreviewUrl(null);
    setActiveSlipId(null);
    setSlipStatus(null);
    setOcrData(null);
    setOcrError(null);
    setPollingActive(false);
    setConfirmedRecordId(null);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Review Form Save Success Handler
  const handleReviewSaveSuccess = (serviceRecordId: string) => {
    setConfirmedRecordId(serviceRecordId);
    setSlipStatus("Confirmed");
  };

  // Manual Entry Submission Handler
  const validateManualForm = (): boolean => {
    const errors: typeof manualFormErrors = {};
    if (!manualVehicleId) errors.vehicleId = "Please select a vehicle from your garage.";
    if (!manualServiceDate) errors.serviceDate = "Please choose a valid service date.";
    if (!manualServiceType.trim()) errors.serviceType = "Service type is required.";
    setManualFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualError(null);
    setManualSuccess(false);

    if (!validateManualForm()) return;

    setSavingManual(true);
    try {
      const notesSections: string[] = [];
      if (manualNotes.trim()) notesSections.push(`Details: ${manualNotes.trim()}`);
      if (manualProvider.trim()) notesSections.push(`Provider: ${manualProvider.trim()}`);
      if (manualCost.trim()) notesSections.push(`Cost: ₹${manualCost.trim()}`);
      if (manualOdometer.trim()) notesSections.push(`Odometer: ${manualOdometer.trim()} km`);

      const formattedNotes = notesSections.join("\n\n");

      await createServiceRecord({
        vehicle_id: manualVehicleId,
        service_date: manualServiceDate,
        service_type: manualServiceType.trim(),
        notes: formattedNotes,
      });

      setManualSuccess(true);
      setManualVehicleId("");
      setManualServiceDate(new Date().toISOString().split("T")[0]);
      setManualServiceType("");
      setManualOdometer("");
      setManualCost("");
      setManualProvider("");
      setManualNotes("");
    } catch (err: unknown) {
      console.error("Manual save error:", err);
      const errMsg =
        err instanceof Error ? err.message : "Failed to save service record to the backend.";
      setManualError(errMsg);
    } finally {
      setSavingManual(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header Block */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Service Slips</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload maintenance invoices to extract data automatically, or record service logs manually.
          </p>
        </div>
      </div>

      {/* Mode Switcher Tabs (Hidden during active pipeline execution) */}
      {!slipStatus && (
        <div className="flex rounded-xl bg-secondary p-1 border border-border w-fit">
          <button
            onClick={() => {
              setActiveTab("upload");
              setUploadError(null);
            }}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${
              activeTab === "upload"
                ? "bg-card text-[#66C56A] border border-[#2E7D32]/40 shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Upload className="h-3.5 w-3.5 text-[#66C56A]" />
            Upload Slip
          </button>
          <button
            onClick={() => {
              setActiveTab("manual");
              setManualError(null);
              setManualSuccess(false);
            }}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${
              activeTab === "manual"
                ? "bg-card text-[#66C56A] border border-[#2E7D32]/40 shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Wrench className="h-3.5 w-3.5 text-[#66C56A]" />
            Manual Entry
          </button>
        </div>
      )}

      {/* TAB 1: UPLOAD & PROCESSING FLOW */}
      {activeTab === "upload" ? (
        slipStatus ? (
          <div className="space-y-6">
            {/* Visual Stepper */}
            <SlipStatusStepper status={slipStatus} errorMessage={ocrError} />

            {/* STATE 1: OCR Failed */}
            {ocrError && (
              <Card className="border-rose-500/30 bg-card shadow-sm rounded-2xl overflow-hidden">
                <div className="h-1.5 w-full bg-rose-600"></div>
                <CardContent className="flex flex-col items-center justify-center py-10 text-center space-y-4">
                  <div className="rounded-full bg-rose-500/20 p-3.5 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                    <AlertCircle className="h-8 w-8" />
                  </div>
                  <div className="space-y-1.5 max-w-md">
                    <h3 className="text-base font-bold text-foreground">
                      OCR Document Extraction Failed
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{ocrError}</p>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button
                      onClick={handleResetFlow}
                      className="rounded-xl bg-[#2E7D32] hover:bg-[#256628] text-white shadow-xs text-xs font-semibold"
                    >
                      <RefreshCw className="mr-2 h-3.5 w-3.5" />
                      Try Another Receipt
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        handleResetFlow();
                        setActiveTab("manual");
                      }}
                      className="rounded-xl border-border bg-secondary text-foreground hover:bg-muted text-xs font-semibold"
                    >
                      <Wrench className="mr-2 h-3.5 w-3.5" />
                      Log Manually Instead
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* STATE 2: OCR Running Loader */}
            {pollingActive && !ocrError && (
              <Card className="border-border bg-card shadow-sm rounded-2xl p-8">
                <div className="flex flex-col items-center justify-center text-center space-y-4 py-8">
                  <div className="rounded-full bg-secondary p-4 text-[#66C56A] border border-[#2E7D32]/30">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-foreground">
                      Reading & Structuring Slip Data
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      Our OCR parser is extracting vehicle details, service items, odometer, and costs...
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* STATE 3: Parsed - Review & Edit Screen */}
            {slipStatus === "Parsed" && !ocrError && (
              <SlipReviewForm
                vehicles={vehicles}
                initialOcrData={ocrData}
                slipId={activeSlipId!}
                imagePreviewUrl={filePreviewUrl}
                fileName={selectedFile?.name}
                onSaveSuccess={handleReviewSaveSuccess}
                onCancel={handleResetFlow}
              />
            )}

            {/* STATE 4: Confirmed State */}
            {slipStatus === "Confirmed" && (
              <Card className="border-[#2E7D32]/50 bg-card shadow-sm rounded-2xl overflow-hidden">
                <div className="h-1.5 w-full bg-[#2E7D32]"></div>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-5">
                  <div className="rounded-full bg-secondary p-4 text-[#66C56A] border border-[#2E7D32]/40 ring-8 ring-[#2E7D32]/10">
                    <CheckCircle2 className="h-10 w-10" />
                  </div>
                  <div className="space-y-2 max-w-md">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-secondary border border-[#2E7D32]/40 px-3 py-1 text-xs font-bold text-[#66C56A]">
                      Status: Confirmed
                    </div>
                    <h3 className="text-xl font-bold text-foreground">
                      Service Record Logged Successfully
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      The service slip has been reconciled and linked to your vehicle maintenance log.
                      {confirmedRecordId && (
                        <span className="block mt-1 font-mono text-[11px] text-muted-foreground">
                          Record ID: {confirmedRecordId}
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-3">
                    <Button
                      onClick={() => {
                        router.push("/maintenance");
                        router.refresh();
                      }}
                      className="rounded-xl bg-[#2E7D32] hover:bg-[#256628] text-white shadow-xs text-xs font-semibold"
                    >
                      View in Maintenance History
                      <ArrowRight className="ml-2 h-3.5 w-3.5" />
                    </Button>

                    <Button
                      variant="outline"
                      onClick={handleResetFlow}
                      className="rounded-xl border-border bg-secondary text-foreground hover:bg-muted text-xs font-semibold"
                    >
                      Upload Another Slip
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          /* Standard Upload Card */
          <Card className="border-border bg-card shadow-sm overflow-hidden rounded-2xl">
            <div className="h-1.5 w-full bg-[#2E7D32]"></div>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-secondary p-2.5 text-[#66C56A] border border-[#2E7D32]/30">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-foreground">
                    Upload Service Slip / Invoice
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Upload an image of your service bill to automatically extract service items, costs, and odometer readings.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {vehiclesError && (
                <div className="flex items-center gap-3 rounded-xl bg-amber-500/10 p-4 text-amber-600 dark:text-amber-200 border border-amber-500/30">
                  <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                  <div className="text-xs">{vehiclesError}</div>
                </div>
              )}

              {uploadError && (
                <div className="flex items-center gap-3 rounded-xl bg-rose-500/10 p-4 text-rose-600 dark:text-rose-200 border border-rose-500/30">
                  <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                  <div className="text-xs font-medium">{uploadError}</div>
                </div>
              )}

              <form onSubmit={handleUploadSubmit} className="space-y-4">
                {/* Drag and Drop Zone */}
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all cursor-pointer ${
                    dragActive
                      ? "border-[#66C56A] bg-secondary"
                      : "border-border bg-secondary/40 hover:bg-secondary hover:border-[#2E7D32]"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileChange}
                    accept=".jpg,.jpeg,.png"
                    className="hidden"
                    disabled={uploading}
                  />

                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-[#66C56A] border border-[#2E7D32]/30">
                    <FileUp className="h-6 w-6" />
                  </div>

                  <h3 className="mb-1 text-sm font-bold text-foreground">
                    Drag & drop your service slip here
                  </h3>
                  <p className="mb-4 text-xs text-muted-foreground">
                    Supports JPG, JPEG, and PNG images up to 10 MB
                  </p>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploading}
                    className="rounded-xl border-border bg-secondary text-foreground hover:bg-muted hover:border-[#66C56A]/40 text-xs font-semibold"
                  >
                    Browse Files
                  </Button>
                </div>

                {/* Selected File Details & Preview */}
                {selectedFile && (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-border bg-secondary p-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {filePreviewUrl ? (
                        <div className="h-12 w-12 rounded-lg border border-[#203131] overflow-hidden bg-[#071011] shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={filePreviewUrl}
                            alt="Slip preview"
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="rounded-lg bg-[#071011] p-2 text-[#66C56A] border border-[#203131] shadow-xs shrink-0">
                          <FileText className="h-5 w-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#F5F7F6] truncate">
                          {selectedFile.name}
                        </p>
                        <p className="text-[11px] text-[#81918E] font-medium">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      disabled={uploading}
                      className="self-end sm:self-center rounded-xl p-1.5 text-[#81918E] hover:bg-[#203131] hover:text-[#F5F7F6] transition-colors"
                      aria-label="Remove file"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {/* Submit Action */}
                {selectedFile && (
                  <Button
                    type="submit"
                    disabled={uploading}
                    className="w-full rounded-xl bg-[#2E7D32] text-white hover:bg-[#256628] py-3 text-xs font-semibold flex items-center justify-center gap-2 shadow-xs"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Uploading & Processing Slip...
                      </>
                    ) : (
                      <>
                        Upload & Extract Data
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                )}
              </form>
            </CardContent>
          </Card>
        )
      ) : (
        /* TAB 2: MANUAL ENTRY FLOW */
        <Card className="border-[#203131] bg-[#0B1515] shadow-sm overflow-hidden rounded-2xl">
          <div className="h-1.5 w-full bg-[#2E7D32]"></div>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-[#101C1C] p-2.5 text-[#66C56A] border border-[#2E7D32]/30">
                <Wrench className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-[#F5F7F6]">
                  Manual Maintenance Record
                </CardTitle>
                <CardDescription className="text-xs text-[#81918E]">
                  Record vehicle maintenance logs manually if you do not have an invoice receipt.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <form onSubmit={handleManualSubmit}>
            <CardContent className="space-y-4">
              {manualSuccess && (
                <div className="flex items-center gap-3 rounded-xl bg-emerald-950/40 p-4 text-emerald-200 border border-emerald-900">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <div className="text-xs font-semibold">Service record logged successfully!</div>
                </div>
              )}

              {manualError && (
                <div className="flex items-center gap-3 rounded-xl bg-rose-950/40 p-4 text-rose-200 border border-rose-900">
                  <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                  <div className="text-xs">{manualError}</div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Vehicle Selector */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#B8C4C2] flex items-center gap-1.5">
                    <Car className="h-3.5 w-3.5 text-[#66C56A]" />
                    Select Vehicle *
                  </label>
                  <select
                    disabled={loadingVehicles || savingManual}
                    value={manualVehicleId}
                    onChange={(e) => setManualVehicleId(e.target.value)}
                    className={`w-full rounded-xl border bg-[#101C1C] px-4 py-2.5 text-sm text-[#F5F7F6] outline-none transition-all focus:bg-[#132020] ${
                      manualFormErrors.vehicleId
                        ? "border-rose-500 focus:ring-1 focus:ring-rose-500"
                        : "border-[#203131] focus:border-[#66C56A] focus:ring-1 focus:ring-[#66C56A]"
                    }`}
                  >
                    <option value="" className="bg-[#101C1C] text-[#81918E]">-- Choose a Vehicle from your Garage --</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id} className="bg-[#101C1C] text-[#F5F7F6]">
                        {v.make} {v.model} ({v.year}) — VIN: {v.vin}
                      </option>
                    ))}
                  </select>
                  {manualFormErrors.vehicleId && (
                    <p className="text-xs font-medium text-rose-400 mt-1">
                      {manualFormErrors.vehicleId}
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
                    value={manualServiceDate}
                    onChange={(e) => setManualServiceDate(e.target.value)}
                    disabled={savingManual}
                    className={`w-full rounded-xl border bg-[#101C1C] px-4 py-2.5 text-sm text-[#F5F7F6] outline-none transition-all focus:bg-[#132020] ${
                      manualFormErrors.serviceDate
                        ? "border-rose-500 focus:ring-1 focus:ring-rose-500"
                        : "border-[#203131] focus:border-[#66C56A] focus:ring-1 focus:ring-[#66C56A]"
                    }`}
                  />
                  {manualFormErrors.serviceDate && (
                    <p className="text-xs font-medium text-rose-400 mt-1">
                      {manualFormErrors.serviceDate}
                    </p>
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
                    placeholder="e.g. Scheduled Service, Oil Change"
                    value={manualServiceType}
                    onChange={(e) => setManualServiceType(e.target.value)}
                    disabled={savingManual}
                    className={`w-full rounded-xl border bg-[#101C1C] px-4 py-2.5 text-sm text-[#F5F7F6] placeholder:text-[#81918E] outline-none transition-all focus:bg-[#132020] ${
                      manualFormErrors.serviceType
                        ? "border-rose-500 focus:ring-1 focus:ring-rose-500"
                        : "border-[#203131] focus:border-[#66C56A] focus:ring-1 focus:ring-[#66C56A]"
                    }`}
                  />
                  {manualFormErrors.serviceType && (
                    <p className="text-xs font-medium text-rose-400 mt-1">
                      {manualFormErrors.serviceType}
                    </p>
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
                    value={manualOdometer}
                    onChange={(e) => setManualOdometer(e.target.value)}
                    disabled={savingManual}
                    className="w-full rounded-xl border border-[#203131] bg-[#101C1C] px-4 py-2.5 text-sm text-[#F5F7F6] placeholder:text-[#81918E] outline-none transition-all focus:bg-[#132020] focus:border-[#66C56A] focus:ring-1 focus:ring-[#66C56A]"
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
                    placeholder="e.g. 2500"
                    value={manualCost}
                    onChange={(e) => setManualCost(e.target.value)}
                    disabled={savingManual}
                    className="w-full rounded-xl border border-[#203131] bg-[#101C1C] px-4 py-2.5 text-sm text-[#F5F7F6] placeholder:text-[#81918E] outline-none transition-all focus:bg-[#132020] focus:border-[#66C56A] focus:ring-1 focus:ring-[#66C56A]"
                  />
                </div>

                {/* Provider */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#B8C4C2] flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-[#66C56A]" />
                    Workshop / Provider Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Authorized Service Station"
                    value={manualProvider}
                    onChange={(e) => setManualProvider(e.target.value)}
                    disabled={savingManual}
                    className="w-full rounded-xl border border-[#203131] bg-[#101C1C] px-4 py-2.5 text-sm text-[#F5F7F6] placeholder:text-[#81918E] outline-none transition-all focus:bg-[#132020] focus:border-[#66C56A] focus:ring-1 focus:ring-[#66C56A]"
                  />
                </div>

                {/* Notes */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#B8C4C2] flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-[#66C56A]" />
                    Service Details & Notes
                  </label>
                  <textarea
                    placeholder="Provide details regarding parts swapped, inspection findings, etc."
                    rows={3}
                    value={manualNotes}
                    onChange={(e) => setManualNotes(e.target.value)}
                    disabled={savingManual}
                    className="w-full rounded-xl border border-[#203131] bg-[#101C1C] px-4 py-2.5 text-sm text-[#F5F7F6] placeholder:text-[#81918E] outline-none transition-all focus:bg-[#132020] focus:border-[#66C56A] focus:ring-1 focus:ring-[#66C56A]"
                  />
                </div>
              </div>
            </CardContent>

            <CardFooter className="pt-2">
              <Button
                type="submit"
                disabled={savingManual || loadingVehicles}
                className="w-full rounded-xl bg-[#2E7D32] text-white hover:bg-[#256628] py-3 text-xs font-semibold flex items-center justify-center gap-2 shadow-xs"
              >
                {savingManual ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving Service Record...
                  </>
                ) : (
                  <>
                    Save Service Record
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {/* SLIP HISTORY */}
      {!slipStatus && (
        <Card className="shadow-sm rounded-2xl overflow-hidden">
          <div className="h-1.5 w-full bg-emerald-600/30"></div>

          <CardHeader>
            <CardTitle className="text-base font-bold text-foreground">
              Slip History
            </CardTitle>

            <CardDescription className="text-xs text-muted-foreground">
              Your previously uploaded service slips.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {loadingHistory && (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-[#66C56A]" />
                Loading slip history...
              </div>
            )}

            {!loadingHistory && historyError && (
              <div className="rounded-xl border border-rose-900/60 bg-rose-950/40 p-4 text-xs text-rose-300">
                {historyError}
              </div>
            )}

            {!loadingHistory &&
              !historyError &&
              slipHistory.length === 0 && (
                <div className="py-8 text-center text-sm text-[#81918E]">
                  No service slips found.
                </div>
              )}

            {!loadingHistory &&
              !historyError &&
              slipHistory.length > 0 && (
                <div className="space-y-3">
                  {slipHistory.map((slip) => (
                    <div
                      key={slip.id}
                      className="flex flex-col sm:flex-row gap-4 rounded-xl border border-[#203131] bg-[#071011] p-3 hover:bg-[#101C1C] transition-colors"
                    >
                      {/* Thumbnail */}
                      <div className="h-20 w-20 rounded-lg overflow-hidden border border-[#203131] bg-[#101C1C] shrink-0 flex items-center justify-center">
                        {slip.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={slip.image_url}
                            alt={slip.file_name || "Service slip"}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <FileText className="h-7 w-7 text-[#81918E]" />
                        )}
                      </div>

                      {/* Details */}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#F5F7F6] truncate">
                          {slip.file_name || "Service Slip"}
                        </p>

                        <p className="text-xs text-[#81918E] mt-1">
                          Uploaded:{" "}
                          {slip.created_at
                            ? new Date(slip.created_at).toLocaleString(
                                "en-IN",
                                {
                                  timeZone: "Asia/Kolkata",
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                }
                              )
                            : "—"}
                        </p>

                        <div className="mt-2">
                          <span className="inline-flex rounded-full bg-[#101C1C] border border-[#2E7D32]/30 px-2.5 py-1 text-[11px] font-semibold text-[#66C56A]">
                            {slip.status || "Unknown"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
