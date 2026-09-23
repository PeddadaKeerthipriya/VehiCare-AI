"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Car,
  Bike,
  Calendar,
  AlertCircle,
  RefreshCw,
  Clock,
  FileText,
  User,
  Wrench,
  Fuel,
  Zap,
  Save,
  X,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  FileCheck,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loading } from "@/components/common/Loading";
import {
  fetchVehicleById,
  updateVehicle,
  deleteVehicle,
  getInsurancePolicies,
  getVehiclePuc,
  getVehicleFastag,
  getServiceRecords,
  getMaintenanceSchedules,
} from "@/lib/api";
import {
  InsuranceApiResponse,
  PucApiResponse,
  FastagApiResponse,
  ServiceRecord,
  MaintenanceSchedule,
  VehicleType,
} from "@/lib/types";
import { supabase } from "@/lib/supabase";
import {
  getDocumentExpiryStatus,
  getLatestInsurancePolicy,
  getActiveDocumentsCount,
} from "@/lib/documents";
import { subscribeToSyncEvents, emitVehicleUpdate } from "@/lib/realtimeSync";
import Link from "next/link";
import Image from "next/image";
import Vehicle3DViewer from "@/components/vehicles/Vehicle3DViewer";

type TabType = "profile" | "history" | "schedule" | "documents";

interface MockVehicleData {
  vehicle: {
    id: string;
    nickname: string;
    make: string;
    model: string;
    year: number;
    vin: string;
    odometer_km: number;
    vehicle_type?: VehicleType;
  };
  history: Array<{
    id: string;
    service_date: string;
    service_type: string;
    cost: string;
    shop: string;
    notes: string;
  }>;
  schedule: Array<{
    id: string;
    task_name: string;
    due_date: string;
    due_odometer_km: number;
    status: string;
  }>;
}

const mockDatabase: Record<string, MockVehicleData> = {
  "1": {
    vehicle: {
      id: "1",
      nickname: "Swift Commuter",
      make: "Maruti Suzuki",
      model: "Swift",
      year: 2021,
      vin: "MHR32A1C9DK982103",
      odometer_km: 34250,
    },
    history: [
      {
        id: "h1",
        service_date: "2026-07-24",
        service_type: "Brake Pad Replacement",
        cost: "₹18,500.00",
        shop: "Precision Brake Center",
        notes: "Front brake pads swapped. Rotor resurfaced.",
      },
      {
        id: "h2",
        service_date: "2026-06-10",
        service_type: "Oil Change",
        cost: "₹3,200.00",
        shop: "Swift Service Center",
        notes: "Engine oil and filter replaced.",
      }
    ],
    schedule: [
      {
        id: "s1",
        task_name: "Engine Oil Change",
        due_date: "2026-08-16",
        due_odometer_km: 40000,
        status: "Pending",
      },
      {
        id: "s2",
        task_name: "Tire Rotation",
        due_date: "2026-09-05",
        due_odometer_km: 42000,
        status: "Pending",
      }
    ],
  },
  "2": {
    vehicle: {
      id: "2",
      nickname: "Family Cruiser",
      make: "Mahindra",
      model: "XUV700",
      year: 2023,
      vin: "MHR44B2C8EK991204",
      odometer_km: 18940,
    },
    history: [
      {
        id: "h3",
        service_date: "2026-07-16",
        service_type: "Cabin Air Filter",
        cost: "₹2,500.00",
        shop: "Mahindra Service Center",
        notes: "HEPA filter replacement.",
      }
    ],
    schedule: [
      {
        id: "s3",
        task_name: "Tire Rotation",
        due_date: "2026-08-18",
        due_odometer_km: 25000,
        status: "Pending",
      }
    ],
  },
  "3": {
    vehicle: {
      id: "3",
      nickname: "City EV",
      make: "Tata",
      model: "Nexon EV",
      year: 2022,
      vin: "MHR11A5C3CK772391",
      odometer_km: 12500,
    },
    history: [],
    schedule: [],
  }
};

export default function VehicleDetailsPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabType>("profile");
  
  // UI and Data States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MockVehicleData | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const [insuranceData, setInsuranceData] = useState<InsuranceApiResponse | null>(null);
  const [pucData, setPucData] = useState<PucApiResponse | null>(null);
  const [fastagData, setFastagData] = useState<FastagApiResponse | null>(null);

  // Edit form states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editVehicleType, setEditVehicleType] = useState<VehicleType>("Car");
  const [editMake, setEditMake] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editYear, setEditYear] = useState("");
  const [editVin, setEditVin] = useState("");
  const [editNickname, setEditNickname] = useState("");
  const [editMileage, setEditMileage] = useState("");

  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState(false);
  const [editValidationErrors, setEditValidationErrors] = useState<Record<string, string>>({});

  // Delete states
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const openEditModal = () => {
    if (!data) return;
    setEditVehicleType(data.vehicle.vehicle_type || "Car");
    setEditMake(data.vehicle.make);
    setEditModel(data.vehicle.model);
    setEditYear(String(data.vehicle.year));
    setEditVin(data.vehicle.vin);
    setEditNickname(data.vehicle.nickname);
    setEditMileage(String(data.vehicle.odometer_km));
    setEditError(null);
    setEditSuccess(false);
    setEditValidationErrors({});
    setIsEditModalOpen(true);
  };

  const validateEditForm = (): boolean => {
    const errors: Record<string, string> = {};
    const currentYear = new Date().getFullYear();

    if (!editMake.trim()) errors.make = "Make is required.";
    if (!editModel.trim()) errors.model = "Model is required.";

    if (!editYear) {
      errors.year = "Year is required.";
    } else {
      const yearNum = parseInt(editYear);
      if (isNaN(yearNum) || yearNum < 1900 || yearNum > currentYear + 1) {
        errors.year = `Please enter a valid year between 1900 and ${currentYear + 1}.`;
      }
    }

    if (!editVin.trim()) {
      errors.vin = "VIN is required.";
    } else if (!/^[A-HJ-NPR-Z0-9]{17}$/i.test(editVin.trim())) {
      errors.vin = "VIN must be a valid 17-character alphanumeric string (excluding I, O, Q).";
    }

    if (!editNickname.trim()) errors.nickname = "Nickname is required.";

    if (!editMileage) {
      errors.mileage = "Mileage is required.";
    } else {
      const mileageNum = parseFloat(editMileage);
      if (isNaN(mileageNum)) {
        errors.mileage = "Mileage must be a valid number.";
      } else if (mileageNum < 0) {
        errors.mileage = "Mileage cannot be negative.";
      }
    }

    setEditValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);
    setEditSuccess(false);

    if (!validateEditForm()) return;

    setSubmittingEdit(true);
    try {
      const payload = {
        make: editMake.trim(),
        model: editModel.trim(),
        year: parseInt(editYear),
        vin: editVin.trim().toUpperCase(),
        odometer_km: Math.round(parseFloat(editMileage)),
        vehicle_type: editVehicleType,
      };

      const updated = await updateVehicle(id, payload);
      emitVehicleUpdate(id);

      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          vehicle: {
            ...prev.vehicle,
            make: updated.make,
            model: updated.model,
            year: updated.year,
            vin: updated.vin,
            odometer_km: updated.odometer_km,
            vehicle_type: updated.vehicle_type || editVehicleType,
            nickname: editNickname.trim(),
          },
        };
      });

      setEditSuccess(true);
      setTimeout(() => {
        setIsEditModalOpen(false);
      }, 1000);
    } catch (err: unknown) {
      console.error("Error updating vehicle:", err);
      const errMsg = err instanceof Error ? err.message : "Failed to update vehicle.";
      setEditError(errMsg);
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to remove this vehicle from your garage?")) return;

    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteVehicle(id);
      emitVehicleUpdate(id);
      router.push("/vehicles");
    } catch (err: unknown) {
      console.error("Error deleting vehicle:", err);
      const errMsg = err instanceof Error ? err.message : "Failed to delete vehicle.";
      setDeleteError(errMsg);
      setDeleting(false);
    }
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setData(null);
    setInsuranceData(null);
    setPucData(null);
    setFastagData(null);

    async function loadVehicle() {
      try {
        const [vehicle, insurance, puc, fastag, liveServices, liveSchedules] = await Promise.all([
          fetchVehicleById(id),
          getInsurancePolicies(id).catch((): InsuranceApiResponse[] => []),
          getVehiclePuc(id).catch(() => null),
          getVehicleFastag(id).catch(() => null),
          getServiceRecords().catch(() => []),
          getMaintenanceSchedules().catch(() => []),
        ]);

        if (active) {
          const latestInsurance = getLatestInsurancePolicy<InsuranceApiResponse>(insurance || []);
          setInsuranceData(latestInsurance);
          setPucData(puc || null);
          setFastagData(fastag || null);
        }

        const mockData = mockDatabase[id] || { history: [], schedule: [] };

        // Map live services for this vehicle
        const filteredServices = (liveServices || [])
          .filter((s: ServiceRecord) => s.vehicle_id === id)
          .map((s: ServiceRecord) => ({
            id: s.id,
            service_date: s.service_date || "",
            service_type: s.service_type || "Service",
            cost: "—",
            shop: "—",
            notes: s.notes || "",
          }));

        // Map live schedules for this vehicle
        const filteredSchedules = (liveSchedules || [])
          .filter((s: MaintenanceSchedule) => s.vehicle_id === id)
          .map((s: MaintenanceSchedule) => ({
            id: s.id,
            task_name: s.task_name,
            due_date: s.due_date || "",
            due_odometer_km: s.due_odometer_km || 0,
            status: s.status || "Pending",
          }));

        if (active) {
          setData({
            vehicle: {
              id: vehicle.id,
              nickname: vehicle.nickname || mockDatabase[id]?.vehicle?.nickname || "My Vehicle",
              make: vehicle.make,
              model: vehicle.model,
              year: vehicle.year,
              vin: vehicle.vin,
              odometer_km: vehicle.odometer_km,
              vehicle_type: vehicle.vehicle_type,
            },
            history: filteredServices.length > 0 ? filteredServices : mockData.history,
            schedule: filteredSchedules.length > 0 ? filteredSchedules : mockData.schedule,
          });
          setLoading(false);
        }
      } catch (err: unknown) {
        if (active) {
          console.error("Error loading vehicle details:", err);
          const errMsg = err instanceof Error ? err.message : "Unable to load vehicle details. Please verify your connection.";
          setError(errMsg);
          setLoading(false);
        }
      }
    }

    loadVehicle();

    // Supabase Realtime: subscribe to vehicle and document changes
    const channel = supabase
      .channel(`vehicle-detail-${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "insurance_policies",
          filter: `vehicle_id=eq.${id}`,
        },
        () => {
          console.log("[Realtime] vehicle insurance changed");
          loadVehicle();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "puc_certificates",
          filter: `vehicle_id=eq.${id}`,
        },
        () => {
          console.log("[Realtime] vehicle PUC changed");
          loadVehicle();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "fastag_accounts",
          filter: `vehicle_id=eq.${id}`,
        },
        () => {
          console.log("[Realtime] vehicle FASTag changed");
          loadVehicle();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "vehicles",
          filter: `id=eq.${id}`,
        },
        () => {
          console.log("[Realtime] vehicle details changed");
          loadVehicle();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "service_records",
          filter: `vehicle_id=eq.${id}`,
        },
        () => {
          console.log("[Realtime] vehicle service records changed");
          loadVehicle();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "maintenance_schedules",
          filter: `vehicle_id=eq.${id}`,
        },
        () => {
          console.log("[Realtime] vehicle maintenance schedules changed");
          loadVehicle();
        }
      )
      .subscribe((status) => {
        console.log(`[Realtime] vehicle-detail-${id} status:`, status);
      });

    // Sync bus: subscribe to immediate same-tab, cross-tab, and Supabase broadcast updates
    const unsubscribeSync = subscribeToSyncEvents((payload) => {
      if (!payload.vehicleId || payload.vehicleId === id) {
        console.log(`[RealtimeSync] vehicle ${id} reloading data due to sync event:`, payload);
        loadVehicle();
      }
    });

    return () => {
      active = false;
      unsubscribeSync();
      supabase.removeChannel(channel);
    };
  }, [id, retryTrigger]);

  const handleRetry = () => {
    setRetryTrigger((prev) => prev + 1);
  };

  const getVehicleImage = (make?: string) => {
    const m = make?.toLowerCase() || "";
    if (m.includes("maruti") || m.includes("swift") || m.includes("toyota")) return "/vehicles/camry.png";
    if (m.includes("nexon") || m.includes("tesla") || m.includes("ev")) return "/vehicles/modely.png";
    if (m.includes("mahindra") || m.includes("xuv") || m.includes("harrier") || m.includes("tata") || m.includes("ford")) return "/vehicles/f150.png";
    return "/vehicles/camry.png";
  };
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Link href="/vehicles" className="text-[#81918E] hover:text-[#F5F7F6] transition-colors">
            <Button variant="ghost" size="sm" className="rounded-xl">
              <ArrowLeft className="mr-1 h-4 w-4" /> Back
            </Button>
          </Link>
        </div>
        <Loading />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Link href="/vehicles" className="text-[#81918E] hover:text-[#F5F7F6] transition-colors">
            <Button variant="ghost" size="sm" className="rounded-xl">
              <ArrowLeft className="mr-1 h-4 w-4" /> Back to Garage
            </Button>
          </Link>
        </div>

        <Card className="border-rose-900 bg-rose-950/40">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center space-y-4">
            <div className="rounded-full bg-rose-900/60 p-3 text-rose-400">
              <AlertCircle className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-lg font-bold text-rose-200">
                {error === "Vehicle not found." ? "Vehicle Not Found" : "Connection Error"}
              </CardTitle>
              <CardDescription className="max-w-md text-sm text-rose-400">
                {error || "Vehicle details could not be loaded."}
              </CardDescription>
            </div>
            {error !== "Vehicle not found." && (
              <Button
                onClick={handleRetry}
                className="rounded-xl bg-rose-600 text-white hover:bg-rose-700 shadow-xs"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const { vehicle, history, schedule } = data;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div className="flex items-center gap-2">
        <Link href="/vehicles" className="text-[#81918E] hover:text-[#F5F7F6] transition-colors">
          <Button variant="ghost" size="sm" className="rounded-xl">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Garage
          </Button>
        </Link>
      </div>

      {/* Vehicle Summary Hero Card */}
      <Card className="border-[#203131] bg-[#0B1515] shadow-sm overflow-hidden rounded-2xl">
        <div className="h-1.5 w-full bg-[#2E7D32]"></div>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Image */}
            <div className="relative w-28 h-20 rounded-xl overflow-hidden bg-[#101C1C] border border-[#203131] shrink-0 flex items-center justify-center">
              {vehicle.vehicle_type === "Bike" ? (
                <div className="flex flex-col items-center justify-center text-[#66C56A]">
                  <Bike className="h-10 w-10" />
                </div>
              ) : (
                <Image
                  src={getVehicleImage(vehicle.make)}
                  alt={`${vehicle.make} ${vehicle.model}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 112px) 100vw, 112px"
                />
              )}
            </div>
            {/* Text details */}
            <div className="text-center sm:text-left flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#101C1C] text-[#66C56A] border border-[#2E7D32]/40">
                  {vehicle.nickname}
                </span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#101C1C] text-[#B8C4C2] border border-[#203131] flex items-center gap-1">
                  {vehicle.vehicle_type === "Bike" ? (
                    <>
                      <Bike className="h-3 w-3 text-[#66C56A]" /> Bike
                    </>
                  ) : (
                    <>
                      <Car className="h-3 w-3 text-[#66C56A]" /> Car
                    </>
                  )}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-[#F5F7F6] mt-1 truncate">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </h1>
              <p className="text-xs text-[#81918E] mt-0.5 uppercase tracking-wider font-semibold">
                VIN: {vehicle.vin}
              </p>
            </div>
            {/* Odometer stat */}
            <div className="rounded-xl bg-[#101C1C] p-4 border border-[#203131] text-center shrink-0 w-full sm:w-auto">
              <span className="text-[10px] uppercase font-bold text-[#81918E] block tracking-wider">Odometer</span>
              <span className="text-xl font-bold text-[#F5F7F6] mt-0.5 block">
                {Number(vehicle.odometer_km).toLocaleString()} km
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 360° Interactive Vehicle Viewer */}
      <Vehicle3DViewer
        vehicleMake={vehicle.make}
        vehicleModel={vehicle.model}
        vehicleNickname={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
      />

      {/* Tabs Header Navigation */}
      <div className="flex border-b border-[#203131] overflow-x-auto scrollbar-none">
        {(["profile", "history", "schedule", "documents"] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 sm:px-6 pb-3 text-sm font-semibold capitalize transition-all border-b-2 outline-none -mb-[2px] shrink-0 ${
              activeTab === tab
                ? "border-[#66C56A] text-[#66C56A]"
                : "border-transparent text-[#81918E] hover:text-[#F5F7F6]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      {/* Tabs Content Switching */}
      <div className="mt-4">
        {/* Profile Tab */}
        {activeTab === "profile" && (
          <div className="grid gap-6 sm:grid-cols-2">
            <Card className="border-border bg-card">
              <CardHeader className="pb-3 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#66C56A]">
                    {vehicle.vehicle_type === "Bike" ? (
                      <Bike className="h-5 w-5" />
                    ) : (
                      <Car className="h-5 w-5" />
                    )}
                    <CardTitle className="text-base font-bold text-foreground">Specifications</CardTitle>
                  </div>
                  <Button variant="outline" size="sm" onClick={openEditModal} className="rounded-xl border-border bg-secondary text-[#66C56A] hover:bg-muted hover:border-[#2E7D32]/50">
                    Edit Specs
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                <div className="flex justify-between border-b border-border pb-2.5 text-sm">
                  <span className="text-muted-foreground">Vehicle Type</span>
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    {vehicle.vehicle_type === "Bike" ? (
                      <>
                        <Bike className="h-4 w-4 text-[#66C56A]" /> Bike
                      </>
                    ) : (
                      <>
                        <Car className="h-4 w-4 text-[#66C56A]" /> Car
                      </>
                    )}
                  </span>
                </div>
                <div className="flex justify-between border-b border-border pb-2.5 text-sm">
                  <span className="text-muted-foreground">Make</span>
                  <span className="font-semibold text-foreground">{vehicle.make}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2.5 text-sm">
                  <span className="text-muted-foreground">Model</span>
                  <span className="font-semibold text-foreground">{vehicle.model}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2.5 text-sm">
                  <span className="text-muted-foreground">Year</span>
                  <span className="font-semibold text-foreground">{vehicle.year}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2.5 text-sm">
                  <span className="text-muted-foreground">VIN</span>
                  <span className="font-mono font-semibold text-foreground uppercase">{vehicle.vin}</span>
                </div>
                <div className="flex justify-between text-sm pt-0.5">
                  <span className="text-muted-foreground">Engine Type</span>
                  <span className="font-semibold text-foreground flex items-center gap-1">
                    {vehicle.make.toLowerCase() === "tesla" || vehicle.model.toLowerCase().includes("ev") || vehicle.make.toLowerCase().includes("nexon") ? (
                      <>
                        <Zap className="h-4 w-4 text-[#66C56A]" /> Electric
                      </>
                    ) : (
                      <>
                        <Fuel className="h-4 w-4 text-[#66C56A]" /> Gasoline
                      </>
                    )}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="pb-3 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#66C56A]">
                    <User className="h-5 w-5" />
                    <CardTitle className="text-base font-bold text-foreground">Ownership Detail</CardTitle>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="rounded-xl border-rose-500/30 bg-rose-500/15 text-rose-600 dark:text-rose-400 hover:bg-rose-500/25 disabled:opacity-50"
                  >
                    {deleting ? "Deleting..." : "Delete Vehicle"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                <div className="flex justify-between border-b border-border pb-2.5 text-sm">
                  <span className="text-muted-foreground">Assigned Nickname</span>
                  <span className="font-semibold text-foreground">
                    {vehicle.nickname}
                  </span>
                </div>
                <div className="flex justify-between border-b border-border pb-2.5 text-sm">
                  <span className="text-muted-foreground">Vehicle ID</span>
                  <span className="font-mono text-xs text-muted-foreground truncate max-w-[200px]">{vehicle.id}</span>
                </div>
                <div className="flex justify-between text-sm pt-0.5">
                  <span className="text-muted-foreground">Status</span>
                  {(() => {
                    const status = getDocumentExpiryStatus(
                      insuranceData?.expiry_date || ""
                    );

                    return (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                          status === "expired"
                            ? "bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30"
                            : status === "expiring_soon"
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30"
                            : "bg-secondary text-[#66C56A] border-[#2E7D32]/40"
                        }`}
                      >
                        {status === "expired"
                          ? "Expired"
                          : status === "expiring_soon"
                          ? "Expiring Soon"
                          : "Active"}
                      </span>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* History Tab */}
        {activeTab === "history" && (
          <Card className="border-[#203131] bg-[#0B1515]">
            <CardHeader className="pb-3 border-b border-[#203131]">
              <div className="flex items-center gap-2 text-[#66C56A]">
                <FileText className="h-5 w-5" />
                <CardTitle className="text-base font-bold text-[#F5F7F6]">Service & Maintenance Records</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                  <div className="rounded-full bg-[#101C1C] p-3 text-[#81918E] border border-[#203131]">
                    <Wrench className="h-8 w-8" />
                  </div>
                  <h3 className="text-sm font-bold text-[#F5F7F6]">No service history available.</h3>
                  <p className="text-xs text-[#81918E] max-w-sm">
                    No past service activities or invoices are recorded for this vehicle.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {history.map((record) => (
                    <div
                      key={record.id}
                      className="flex flex-col sm:flex-row gap-4 justify-between border-b border-[#203131] pb-4 last:border-0 last:pb-0"
                    >
                      <div className="flex gap-3">
                        <div className="rounded-xl bg-[#101C1C] text-[#66C56A] border border-[#2E7D32]/30 p-2 h-10 w-10 flex items-center justify-center shrink-0">
                          <Wrench className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-[#F5F7F6] capitalize">
                            {record.service_type || "General Maintenance"}
                          </h4>
                          <p className="text-xs text-[#B8C4C2] mt-1 max-w-md">
                            {record.notes}
                          </p>
                          <div className="flex flex-wrap gap-4 mt-2 text-[11px] text-[#81918E] font-medium">
                            <span>Cost: <strong className="text-[#66C56A]">{record.cost}</strong></span>
                            <span>Shop: <strong className="text-[#B8C4C2]">{record.shop}</strong></span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 rounded-xl bg-[#101C1C] px-3 py-1.5 h-fit text-xs font-semibold text-[#B8C4C2] border border-[#203131]">
                        <Calendar className="h-3.5 w-3.5 text-[#66C56A]" />
                        {new Date(record.service_date).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Schedule Tab */}
        {activeTab === "schedule" && (
          <Card className="border-[#203131] bg-[#0B1515]">
            <CardHeader className="pb-3 border-b border-[#203131]">
              <div className="flex items-center gap-2 text-[#66C56A]">
                <Clock className="h-5 w-5" />
                <CardTitle className="text-base font-bold text-[#F5F7F6]">Upcoming Service Schedule</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {schedule.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                  <div className="rounded-full bg-[#101C1C] p-3 text-[#81918E] border border-[#203131]">
                    <Calendar className="h-8 w-8" />
                  </div>
                  <h3 className="text-sm font-bold text-[#F5F7F6]">No upcoming maintenance scheduled.</h3>
                  <p className="text-xs text-[#81918E] max-w-sm">
                    No upcoming services or reminders are scheduled for this vehicle.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {schedule.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between border-b border-[#203131] pb-4 last:border-0 last:pb-0"
                    >
                      <div className="flex gap-3 items-center">
                        <div className="rounded-xl bg-amber-950/60 text-amber-400 p-2 h-10 w-10 flex items-center justify-center shrink-0 border border-amber-800">
                          <Clock className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-[#F5F7F6]">
                            {item.task_name}
                          </h4>
                          <span className="text-[10px] text-[#81918E] uppercase tracking-wider font-semibold">
                            Due at: {Number(item.due_odometer_km).toLocaleString()} km
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 items-center text-xs">
                        <div className="flex items-center gap-1.5 rounded-xl bg-[#101C1C] px-3 py-1.5 h-fit font-semibold text-[#B8C4C2] border border-[#203131]">
                          <Calendar className="h-3.5 w-3.5 text-[#66C56A]" />
                          {new Date(item.due_date).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                        <span className="flex items-center gap-1 rounded-full bg-amber-950/60 border border-amber-800 px-2.5 py-0.5 font-semibold text-amber-300 capitalize">
                          {item.status || "Pending"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Documents Tab */}
        {activeTab === "documents" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-[#F5F7F6]">Vehicle Documents</h3>
                <p className="text-xs text-[#81918E]">
                  Keep essential vehicle papers, certificates, and toll passes accessible in one place.
                </p>
              </div>
              {(() => {
                const activeCount = getActiveDocumentsCount(
                  insuranceData?.expiry_date,
                  pucData?.expiry_date,
                  fastagData?.status
                );
                return (
                  <span className="text-[11px] font-semibold text-[#66C56A] bg-[#101C1C] px-2.5 py-1 rounded-lg w-fit border border-[#2E7D32]/40">
                    {activeCount === 1 ? "1 Document Active" : `${activeCount} Documents Active`}
                  </span>
                );
              })()}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Document 1: Insurance */}
              <Card className="border-[#203131] bg-[#0B1515] hover:border-[#66C56A]/50 transition-all rounded-2xl shadow-xs overflow-hidden flex flex-col justify-between">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="rounded-xl bg-[#101C1C] p-2.5 text-[#66C56A] border border-[#2E7D32]/30">
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-bold text-[#F5F7F6]">Insurance Policy</CardTitle>
                        <span className="text-[11px] text-[#81918E] font-medium">Motor Comprehensive</span>
                      </div>
                    </div>
                    {(() => {
                      if (!insuranceData || !insuranceData.expiry_date) {
                        return (
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold border bg-[#101C1C] text-[#81918E] border-[#203131]">
                            Not Configured
                          </span>
                        );
                      }
                      const status = getDocumentExpiryStatus(insuranceData.expiry_date);

                      return (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                            status === "expired"
                              ? "bg-rose-950/60 text-rose-300 border-rose-800"
                              : status === "expiring_soon"
                              ? "bg-amber-950/60 text-amber-300 border-amber-800"
                              : "bg-[#101C1C] text-[#66C56A] border-[#2E7D32]/40"
                          }`}
                        >
                          {status === "expired"
                            ? "Expired"
                            : status === "expiring_soon"
                            ? "Expiring Soon"
                            : "Active"}
                        </span>
                      );
                    })()}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2.5 pt-0 text-xs">
                  <div className="rounded-xl bg-[#101C1C] p-3 space-y-1.5 border border-[#203131]">
                    <div className="flex justify-between">
                      <span className="text-[#81918E]">Policy No.</span>
                      <span className="font-mono font-semibold text-[#F5F7F6]">
  {insuranceData?.policy_number || "—"}
</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#81918E]">Coverage Type</span>
                      <span className="font-semibold text-[#F5F7F6]">Zero Depreciation</span>
                    </div>
                    <div className="flex justify-between">
  <span className="text-[#81918E]">Valid Until</span>
  <span className="font-semibold text-[#F5F7F6]">
    {insuranceData?.expiry_date
      ? new Date(insuranceData.expiry_date).toLocaleDateString(
          undefined,
          {
            year: "numeric",
            month: "long",
            day: "numeric",
          }
        )
      : "—"}
  </span>
</div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full rounded-xl border-[#203131] bg-[#132020] text-xs font-semibold text-[#F5F7F6] hover:bg-[#132020]"
                  >
                    <FileText className="mr-1.5 h-3.5 w-3.5 text-[#66C56A]" />
                    View Policy Document
                  </Button>
                </CardContent>
              </Card>

              {/* Document 2: PUC */}
              <Card className="border-[#203131] bg-[#0B1515] hover:border-[#66C56A]/50 transition-all rounded-2xl shadow-xs overflow-hidden flex flex-col justify-between">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="rounded-xl bg-[#101C1C] p-2.5 text-[#66C56A] border border-[#2E7D32]/30">
                        <FileCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-bold text-[#F5F7F6]">PUC Certificate</CardTitle>
                        <span className="text-[11px] text-[#81918E] font-medium">Pollution Under Control</span>
                      </div>
                    </div>
                    {(() => {
                      if (!pucData || !pucData.expiry_date) {
                        return (
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold border bg-[#101C1C] text-[#81918E] border-[#203131]">
                            Not Configured
                          </span>
                        );
                      }
                      const status = getDocumentExpiryStatus(pucData.expiry_date);

                      return (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                            status === "expired"
                              ? "bg-rose-950/60 text-rose-300 border-rose-800"
                              : status === "expiring_soon"
                              ? "bg-amber-950/60 text-amber-300 border-amber-800"
                              : "bg-[#101C1C] text-[#66C56A] border-[#2E7D32]/40"
                          }`}
                        >
                          {status === "expired"
                            ? "Expired"
                            : status === "expiring_soon"
                            ? "Expiring Soon"
                            : "Active"}
                        </span>
                      );
                    })()}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2.5 pt-0 text-xs">
                  <div className="rounded-xl bg-[#101C1C] p-3 space-y-1.5 border border-[#203131]">
                    <div className="flex justify-between">
                      <span className="text-[#81918E]">Cert No.</span>
                      <span className="font-mono font-semibold text-[#F5F7F6]">{pucData?.certificate_number || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#81918E]">Emission Standard</span>
                      <span className="font-semibold text-[#F5F7F6]">BS VI Compliant</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#81918E]">Valid Until</span>
                      <span className="font-semibold text-[#F5F7F6]">{pucData?.expiry_date
  ? new Date(pucData.expiry_date).toLocaleDateString(
      undefined,
      {
        year: "numeric",
        month: "long",
        day: "numeric",
      }
    )
  : "—"}</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full rounded-xl border-[#203131] bg-[#132020] text-xs font-semibold text-[#F5F7F6] hover:bg-[#132020]"
                  >
                    <FileText className="mr-1.5 h-3.5 w-3.5 text-[#66C56A]" />
                    View Certificate
                  </Button>
                </CardContent>
              </Card>

              {/* Document 3: FASTag */}
              <Card className="border-[#203131] bg-[#0B1515] hover:border-[#66C56A]/50 transition-all rounded-2xl shadow-xs overflow-hidden flex flex-col justify-between sm:col-span-2 lg:col-span-1">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="rounded-xl bg-[#101C1C] p-2.5 text-[#66C56A] border border-[#2E7D32]/30">
                        <CreditCard className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-bold text-[#F5F7F6]">FASTag Electronic Toll</CardTitle>
                        <span className="text-[11px] text-[#81918E] font-medium">RFID Toll Pass</span>
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                        fastagData?.status === "Active"
                          ? "bg-[#101C1C] text-[#66C56A] border-[#2E7D32]/40"
                          : fastagData
                          ? "bg-amber-950/60 text-amber-300 border-amber-800"
                          : "bg-[#101C1C] text-[#81918E] border-[#203131]"
                      }`}
                    >
                      {fastagData?.status || "Unlinked"}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2.5 pt-0 text-xs">
                  <div className="rounded-xl bg-[#101C1C] p-3 space-y-1.5 border border-[#203131]">
                    <div className="flex justify-between">
                      <span className="text-[#81918E]">Tag ID</span>
                      <span className="font-mono font-semibold text-[#F5F7F6]">
                        {fastagData?.tag_id || "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#81918E]">Vehicle Class</span>
                      <span className="font-semibold text-[#F5F7F6]">VC4 (Car / Jeep / Van)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#81918E]">Wallet Status</span>
                      <span className="font-semibold text-[#66C56A]">
                        {fastagData?.status ? `${fastagData.status} Balance` : "Not Configured"}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full rounded-xl border-[#203131] bg-[#132020] text-xs font-semibold text-[#F5F7F6] hover:bg-[#132020]"
                  >
                    <CreditCard className="mr-1.5 h-3.5 w-3.5 text-[#66C56A]" />
                    Manage FASTag
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Edit Vehicle Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-[#0B1515] p-6 shadow-xl border border-[#203131] space-y-4 relative">
            <button
              onClick={() => setIsEditModalOpen(false)}
              className="absolute right-4 top-4 rounded-xl p-1 text-[#81918E] hover:bg-[#132020] hover:text-[#F5F7F6] transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div>
              <h2 className="text-xl font-bold text-[#F5F7F6]">
                Edit Vehicle Details
              </h2>
              <p className="text-xs text-[#81918E] mt-0.5">
                Update the specifications and nickname of your vehicle.
              </p>
            </div>

            {editSuccess && (
              <div className="flex items-center gap-2 rounded-xl bg-[#101C1C] p-3 text-sm text-[#66C56A] border border-[#2E7D32]/40">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-[#66C56A]" />
                <span>Vehicle specifications updated successfully!</span>
              </div>
            )}

            {editError && (
              <div className="flex items-center gap-2 rounded-xl bg-rose-950/40 p-3 text-sm text-rose-300 border border-rose-900">
                <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Vehicle Type */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]">
                    Vehicle Type *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={submittingEdit || editSuccess}
                      onClick={() => setEditVehicleType("Car")}
                      className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-xs font-semibold border transition-all ${
                        editVehicleType === "Car"
                          ? "bg-[#163D23] text-[#66C56A] border-[#2E7D32]"
                          : "bg-[#101C1C] text-[#81918E] border-[#203131] hover:text-[#F5F7F6]"
                      }`}
                    >
                      <Car className="h-4 w-4" />
                      <span>Car</span>
                    </button>
                    <button
                      type="button"
                      disabled={submittingEdit || editSuccess}
                      onClick={() => setEditVehicleType("Bike")}
                      className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-xs font-semibold border transition-all ${
                        editVehicleType === "Bike"
                          ? "bg-[#163D23] text-[#66C56A] border-[#2E7D32]"
                          : "bg-[#101C1C] text-[#81918E] border-[#203131] hover:text-[#F5F7F6]"
                      }`}
                    >
                      <Bike className="h-4 w-4" />
                      <span>Bike</span>
                    </button>
                  </div>
                </div>

                {/* Nickname */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]">
                    Nickname *
                  </label>
                  <input
                    type="text"
                    disabled={submittingEdit || editSuccess}
                    value={editNickname}
                    onChange={(e) => setEditNickname(e.target.value)}
                    className={`w-full rounded-xl border bg-[#101C1C] px-4 py-2.5 text-sm text-[#F5F7F6] outline-none transition-all focus:bg-[#132020] ${
                      editValidationErrors.nickname ? "border-rose-500 focus:ring-1 focus:ring-rose-500" : "border-[#203131] focus:border-[#66C56A] focus:ring-1 focus:ring-[#66C56A]"
                    }`}
                  />
                  {editValidationErrors.nickname && (
                    <p className="text-xs text-rose-400 mt-1">{editValidationErrors.nickname}</p>
                  )}
                </div>

                {/* Make */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]">
                    Make *
                  </label>
                  <input
                    type="text"
                    disabled={submittingEdit || editSuccess}
                    value={editMake}
                    onChange={(e) => setEditMake(e.target.value)}
                    className={`w-full rounded-xl border bg-[#101C1C] px-4 py-2.5 text-sm text-[#F5F7F6] outline-none transition-all focus:bg-[#132020] ${
                      editValidationErrors.make ? "border-rose-500 focus:ring-1 focus:ring-rose-500" : "border-[#203131] focus:border-[#66C56A] focus:ring-1 focus:ring-[#66C56A]"
                    }`}
                  />
                  {editValidationErrors.make && (
                    <p className="text-xs text-rose-400 mt-1">{editValidationErrors.make}</p>
                  )}
                </div>

                {/* Model */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]">
                    Model *
                  </label>
                  <input
                    type="text"
                    disabled={submittingEdit || editSuccess}
                    value={editModel}
                    onChange={(e) => setEditModel(e.target.value)}
                    className={`w-full rounded-xl border bg-[#101C1C] px-4 py-2.5 text-sm text-[#F5F7F6] outline-none transition-all focus:bg-[#132020] ${
                      editValidationErrors.model ? "border-rose-500 focus:ring-1 focus:ring-rose-500" : "border-[#203131] focus:border-[#66C56A] focus:ring-1 focus:ring-[#66C56A]"
                    }`}
                  />
                  {editValidationErrors.model && (
                    <p className="text-xs text-rose-400 mt-1">{editValidationErrors.model}</p>
                  )}
                </div>

                {/* Year */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]">
                    Year *
                  </label>
                  <input
                    type="number"
                    disabled={submittingEdit || editSuccess}
                    value={editYear}
                    onChange={(e) => setEditYear(e.target.value)}
                    className={`w-full rounded-xl border bg-[#101C1C] px-4 py-2.5 text-sm text-[#F5F7F6] outline-none transition-all focus:bg-[#132020] ${
                      editValidationErrors.year ? "border-rose-500 focus:ring-1 focus:ring-rose-500" : "border-[#203131] focus:border-[#66C56A] focus:ring-1 focus:ring-[#66C56A]"
                    }`}
                  />
                  {editValidationErrors.year && (
                    <p className="text-xs text-rose-400 mt-1">{editValidationErrors.year}</p>
                  )}
                </div>

                {/* Odometer */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]">
                    Odometer Mileage (km) *
                  </label>
                  <input
                    type="number"
                    disabled={submittingEdit || editSuccess}
                    value={editMileage}
                    onChange={(e) => setEditMileage(e.target.value)}
                    className={`w-full rounded-xl border bg-[#101C1C] px-4 py-2.5 text-sm text-[#F5F7F6] outline-none transition-all focus:bg-[#132020] ${
                      editValidationErrors.mileage ? "border-rose-500 focus:ring-1 focus:ring-rose-500" : "border-[#203131] focus:border-[#66C56A] focus:ring-1 focus:ring-[#66C56A]"
                    }`}
                  />
                  {editValidationErrors.mileage && (
                    <p className="text-xs text-rose-400 mt-1">{editValidationErrors.mileage}</p>
                  )}
                </div>

                {/* VIN */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#B8C4C2]">
                    VIN *
                  </label>
                  <input
                    type="text"
                    disabled={submittingEdit || editSuccess}
                    value={editVin}
                    onChange={(e) => setEditVin(e.target.value)}
                    className={`w-full rounded-xl border bg-[#101C1C] px-4 py-2.5 text-sm uppercase text-[#F5F7F6] outline-none transition-all focus:bg-[#132020] ${
                      editValidationErrors.vin ? "border-rose-500 focus:ring-1 focus:ring-rose-500" : "border-[#203131] focus:border-[#66C56A] focus:ring-1 focus:ring-[#66C56A]"
                    }`}
                  />
                  {editValidationErrors.vin && (
                    <p className="text-xs text-rose-400 mt-1">{editValidationErrors.vin}</p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={submittingEdit}
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 rounded-xl border-[#203131] bg-[#132020] text-[#F5F7F6] hover:bg-[#132020]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submittingEdit || editSuccess}
                  className="flex-1 rounded-xl bg-[#2E7D32] text-white hover:bg-[#256628] flex items-center justify-center gap-1.5 shadow-xs"
                >
                  {submittingEdit ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      {deleteError && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-xl bg-rose-950/60 p-3 text-sm text-rose-300 border border-rose-800 shadow-lg">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
          <span>{deleteError}</span>
        </div>
      )}
    </div>
  );
}
