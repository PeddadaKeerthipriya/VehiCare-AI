"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import {
  fetchVehicles,
  getServiceRecords,
  getMaintenanceSchedules,
  getDiagnosisHistory,
} from "@/lib/api";
import {
  fetchUserReminders,
  isAttentionRequired,
  getReminderStatus,
  ReminderItem,
} from "@/lib/reminders";
import { subscribeToSyncEvents } from "@/lib/realtimeSync";
import {
  Vehicle,
  ServiceRecord,
  MaintenanceSchedule,
  BackendDiagnosis,
} from "@/lib/types";
import { HealthSummaryCards } from "@/components/dashboard/HealthSummaryCards";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Car,
  Bike,
  Wrench,
  BellRing,
  Fuel,
  Plus,
  ChevronRight,
  Sparkles,
  AlertCircle,
  FileText,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { DashboardProfileReminder } from "@/components/dashboard/DashboardProfileReminder";
import { DashboardFuelCard } from "@/components/dashboard/DashboardFuelCard";
import { DashboardOnboarding } from "@/components/dashboard/DashboardOnboarding";
import { FindServiceCenter } from "@/components/dashboard/FindServiceCenter";
import {
  getVehicleFuelConfig,
  calculateFuelBudget,
  formatCurrency,
} from "@/lib/fuelCalculator";

function formatDueText(dueDate: string): string {
  if (!dueDate) return "No due date";
  const due = new Date(dueDate);
  if (isNaN(due.getTime())) return dueDate;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dueDate);
  target.setHours(0, 0, 0, 0);

  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const daysAgo = Math.abs(diffDays);
    return daysAgo === 1 ? "Expired yesterday" : `Expired ${daysAgo} days ago`;
  }
  if (diffDays === 0) {
    return "Due today";
  }
  if (diffDays === 1) {
    return "Due tomorrow";
  }
  if (diffDays <= 30) {
    return `Due in ${diffDays} days`;
  }
  return `Due ${due.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

export default function DashboardPage() {
  const [userName, setUserName] = useState("User");
  const [carImageError, setCarImageError] = useState(false);
  const [vehicleCount, setVehicleCount] = useState<number | string>("—");
  const [servicesCount, setServicesCount] = useState<number | string>("—");
  const [remindersCount, setRemindersCount] = useState<number | string>("—");
  const [upcomingReminders, setUpcomingReminders] = useState<ReminderItem[]>([]);
  const [recentServices, setRecentServices] = useState<
    Array<{
      id: string;
      service: string;
      vehicle: string;
      date: string;
      notes?: string;
    }>
  >([]);

  // Vehicle Switcher & Fuel Tracking state
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [fuelSpendEstimate, setFuelSpendEstimate] = useState<string>("—");
  const [statsError, setStatsError] = useState<string | null>(null);

  // Health Summary data state
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [allServices, setAllServices] = useState<ServiceRecord[]>([]);
  const [allRemindersList, setAllRemindersList] = useState<ReminderItem[]>([]);
  const [vehicleDiagnoses, setVehicleDiagnoses] = useState<BackendDiagnosis[]>([]);
  const [loadingDiagnoses, setLoadingDiagnoses] = useState<boolean>(false);
  const [loadingStats, setLoadingStats] = useState<boolean>(true);

  const selectedVehicle =
    vehicles.find((v) => v.id === selectedVehicleId) || null;

  const handleSelectVehicle = (id: string) => {
    setSelectedVehicleId(id);
    try {
      localStorage.setItem("vehicare_active_vehicle_id", id);
    } catch {
      // ignore storage quota error
    }
  };

  // Reactively calculate fuel spend estimate when selected vehicle changes
  useEffect(() => {
    if (selectedVehicle) {
      const fuelConfig = getVehicleFuelConfig(selectedVehicle);
      const res = calculateFuelBudget(fuelConfig);
      if (res.isCalculable && res.estimatedCost !== null) {
        setFuelSpendEstimate(formatCurrency(res.estimatedCost));
      } else {
        setFuelSpendEstimate("N/A");
      }
    } else {
      setFuelSpendEstimate("—");
    }
  }, [selectedVehicle]);

  // Reactively fetch real AI diagnosis history for selected vehicle
  useEffect(() => {
    let active = true;
    if (!selectedVehicle?.id) {
      setVehicleDiagnoses([]);
      return;
    }

    const loadDiagnoses = async () => {
      setLoadingDiagnoses(true);
      try {
        const history = await getDiagnosisHistory(selectedVehicle.id);
        if (active) {
          setVehicleDiagnoses(Array.isArray(history) ? history : []);
        }
      } catch (err) {
        console.warn("Failed to load vehicle diagnosis history:", err);
        if (active) setVehicleDiagnoses([]);
      } finally {
        if (active) setLoadingDiagnoses(false);
      }
    };

    loadDiagnoses();

    return () => {
      active = false;
    };
  }, [selectedVehicle?.id]);

  const stats = [
    { name: "My Vehicles", value: String(vehicleCount), icon: Car, href: "/vehicles" },
    { name: "Services Logged", value: String(servicesCount), icon: Wrench, href: "/maintenance" },
    { name: "Active Reminders", value: String(remindersCount), icon: BellRing, href: "/reminders" },
    { name: "Est. Fuel Spend", value: fuelSpendEstimate, icon: Fuel, href: "#fuel-budget" },
  ];

  const loadStats = async () => {
    try {
      const [vehiclesResult, servicesResult, remindersResult, schedulesResult] =
        await Promise.allSettled([
          fetchVehicles(),
          getServiceRecords(),
          fetchUserReminders(),
          getMaintenanceSchedules(),
        ]);

      const vehiclesList: Vehicle[] =
        vehiclesResult.status === "fulfilled" && Array.isArray(vehiclesResult.value)
          ? vehiclesResult.value
          : [];

      if (vehiclesResult.status === "rejected") {
        const reason = vehiclesResult.reason;
        const msg =
          reason instanceof Error ? reason.message : "Failed to load vehicle data.";
        setStatsError(msg);
      } else {
        setStatsError(null);
      }

      const services: ServiceRecord[] =
        servicesResult.status === "fulfilled" && Array.isArray(servicesResult.value)
          ? servicesResult.value
          : [];
      const allReminders: ReminderItem[] =
        remindersResult.status === "fulfilled" && Array.isArray(remindersResult.value)
          ? remindersResult.value
          : [];
      const scheduleList: MaintenanceSchedule[] =
        schedulesResult.status === "fulfilled" && Array.isArray(schedulesResult.value)
          ? schedulesResult.value
          : [];

      // Vehicle count & fleet state
      setVehicleCount(vehiclesList.length);
      setVehicles(vehiclesList);
      setSelectedVehicleId((prev) => {
        let storedId: string | null = null;
        try {
          storedId =
            typeof window !== "undefined"
              ? localStorage.getItem("vehicare_active_vehicle_id")
              : null;
        } catch {
          // ignore
        }
        if (prev && vehiclesList.some((v) => v.id === prev)) {
          return prev;
        }
        if (storedId && vehiclesList.some((v) => v.id === storedId)) {
          return storedId;
        }
        return vehiclesList.length > 0 ? vehiclesList[0].id : "";
      });

      // Health summary dataset
      setAllServices(services);
      setAllRemindersList(allReminders);
      setSchedules(scheduleList);

      // Services count
      setServicesCount(services.length);

      // Active Reminders: attention required count (matches header bell badge exactly!)
      const attentionCount = allReminders.filter((r) =>
        isAttentionRequired(r.status, r.due_date)
      ).length;
      setRemindersCount(attentionCount);

      // Upcoming Reminders: top 3 items
      setUpcomingReminders(allReminders.slice(0, 3));

      // Recent Service Logs: top 2 mapped with vehicle names
      const vehicleMap = new Map(
        vehiclesList.map((v) => [v.id, v.nickname || `${v.make} ${v.model}`])
      );

      const sortedServices = [...services].sort((a, b) => {
        const timeA = a.service_date ? new Date(a.service_date).getTime() : 0;
        const timeB = b.service_date ? new Date(b.service_date).getTime() : 0;
        return timeB - timeA;
      });

      const mappedServices = sortedServices.slice(0, 2).map((rec) => {
        const vName = vehicleMap.get(rec.vehicle_id) || "Vehicle";
        const dateStr = rec.service_date
          ? new Date(rec.service_date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "—";

        return {
          id: rec.id,
          service: rec.service_type || "General Service",
          vehicle: vName,
          date: dateStr,
          notes: rec.notes,
        };
      });

      setRecentServices(mappedServices);
    } catch (err) {
      console.error("Error loading dashboard stats:", err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    const initializeDashboard = async () => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        setStatsError("Your session has expired. Please sign in again.");
        setLoadingStats(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const fullName = user.user_metadata?.full_name;

        if (fullName) {
          setUserName(fullName);
        }
      }

      await loadStats();
    };

    initializeDashboard();

    // Supabase Realtime: subscribe to dashboard metrics changes
    const channel = supabase
      .channel("dashboard-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "vehicles",
        },
        () => {
          console.log("[Realtime] vehicles changed — reloading dashboard stats");
          loadStats();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "service_records",
        },
        () => {
          console.log("[Realtime] service_records changed — reloading dashboard stats");
          loadStats();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "maintenance_schedules",
        },
        () => {
          console.log("[Realtime] maintenance_schedules changed — reloading dashboard stats");
          loadStats();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "insurance_policies",
        },
        () => {
          console.log("[Realtime] insurance_policies changed — reloading dashboard stats");
          loadStats();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "puc_certificates",
        },
        () => {
          console.log("[Realtime] puc_certificates changed — reloading dashboard stats");
          loadStats();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "fault_diagnoses",
        },
        () => {
          console.log("[Realtime] fault_diagnoses changed — reloading dashboard stats");
          loadStats();
        }
      )
      .subscribe((status) => {
        console.log("[Realtime] dashboard-realtime status:", status);
      });

    // Sync bus: instant same-tab, cross-tab, and Supabase broadcast updates
    const unsubscribeSync = subscribeToSyncEvents((payload) => {
      console.log("[RealtimeSync] Dashboard received sync event — reloading stats:", payload);
      loadStats();
    });

    return () => {
      unsubscribeSync();
      supabase.removeChannel(channel);
    };
  }, []);

  // Loading skeleton while initial dashboard metrics load
  if (loadingStats) {
    return (
      <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto animate-pulse">
        <div className="h-48 sm:h-56 rounded-2xl sm:rounded-3xl border border-[#203131] bg-[#0B1515]" />
        <div className="h-16 rounded-2xl border border-[#203131] bg-[#0B1515]" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl border border-[#203131] bg-[#0B1515]" />
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl border border-[#203131] bg-[#0B1515]" />
          ))}
        </div>
      </div>
    );
  }

  // If stats failed to load and no cached vehicles are available, show an explicit error recovery state
  if (statsError && vehicles.length === 0) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-8 text-center max-w-lg mx-auto my-12 space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/30">
          <AlertCircle className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-base font-bold text-[#F5F7F6]">Unable to Load Dashboard</h3>
          <p className="text-xs text-[#81918E] mt-1">
            {statsError}
          </p>
        </div>
        <Button
          onClick={() => {
            setLoadingStats(true);
            setStatsError(null);
            loadStats();
          }}
          className="rounded-xl font-semibold bg-[#2E7D32] text-white hover:bg-[#256628] text-xs h-9 px-4 inline-flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Retry</span>
        </Button>
      </div>
    );
  }

  // First-run onboarding gating: authenticated user with 0 vehicles
  if (vehicles.length === 0) {
    return <DashboardOnboarding userName={userName} />;
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Background sync / stats refresh error banner */}
      {statsError && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-300 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
            <span className="truncate">{statsError}</span>
          </div>
          <button
            onClick={() => loadStats()}
            className="underline font-bold text-amber-200 hover:text-white shrink-0 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* ========================================================================
          DASHBOARD HERO CARD (Side-by-Side on Both Mobile & Desktop)
          ======================================================================== */}
      <div className="dashboard-hero-card relative overflow-hidden rounded-2xl sm:rounded-3xl border border-[#203131] bg-gradient-to-r from-[#071011] via-[#0B1515] to-[#101C1C] p-4 sm:p-6 md:p-8 text-[#F5F7F6] shadow-xl min-h-[190px] sm:min-h-[220px] md:min-h-[250px] lg:min-h-[270px] flex flex-col justify-center">
        {/* Atmospheric Green Smudge Gradients Behind Car */}
        <div className="pointer-events-none absolute right-0 top-0 h-48 w-48 sm:h-80 sm:w-80 md:h-96 md:w-96 rounded-full bg-[#66C56A]/15 blur-3xl"></div>
        <div className="pointer-events-none absolute right-4 sm:right-12 top-2 sm:top-6 h-28 w-28 sm:h-56 sm:w-56 rounded-full bg-[#2E7D32]/25 blur-2xl"></div>
        <div className="pointer-events-none absolute bottom-0 right-0 h-14 sm:h-20 w-48 sm:w-96 md:w-[480px] rounded-full bg-[#2E7D32]/30 blur-xl"></div>

        {/* Content & Action Layer (Left on mobile & desktop, preventing car overlap) */}
        <div className="relative z-10 flex flex-col justify-between max-w-[calc(100%-145px)] sm:max-w-[55%] md:max-w-[55%] lg:max-w-[58%] space-y-2 sm:space-y-4">
          <h1 className="text-base min-[400px]:text-lg sm:text-3xl md:text-4xl font-bold tracking-tight text-[#F5F7F6] leading-tight">
            Good Afternoon, {userName}!
          </h1>

          <div className="space-y-0.5 sm:space-y-1 text-[11px] sm:text-base text-[#B8C4C2] leading-snug sm:leading-relaxed">
            <p>Your vehicles are in top shape.</p>
            <p>
              You have{" "}
              <span className="text-[#66C56A] font-semibold">{remindersCount}</span> reminders requiring attention this week.
            </p>
          </div>

          {/* Action Buttons: Flexible wrap on mobile, inline-flow on tablet/desktop */}
          <div className="pt-1 sm:pt-2 flex flex-wrap gap-1.5 sm:gap-3 items-center">
            {/* Add Maintenance Button */}
            <Link href="/maintenance" className="inline-block sm:w-auto">
              <Button
                size="default"
                className="w-auto rounded-lg sm:rounded-2xl font-semibold bg-[#2E7D32] text-white hover:bg-[#256628] shadow-md hover:shadow-[#2E7D32]/25 transition-all h-8 sm:h-11 px-2.5 sm:px-5 text-[11px] sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2"
              >
                <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 stroke-[2.5]" />
                <span>Add Maintenance</span>
              </Button>
            </Link>

            {/* Quick Action: Upload Slip */}
            <Link href="/slips" className="inline-block sm:w-auto">
              <Button
                size="default"
                variant="outline"
                className="dashboard-secondary-btn group w-auto rounded-lg sm:rounded-2xl font-semibold border border-[#203131] bg-[#101C1C]/80 text-[#F5F7F6] hover:bg-[#132020] hover:border-[#66C56A]/40 transition-all h-8 sm:h-11 px-2.5 sm:px-5 text-[11px] sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2"
              >
                <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#66C56A] group-hover:text-inherit shrink-0 transition-colors" />
                <span>Upload Slip</span>
              </Button>
            </Link>

            {/* Run AI Diagnosis */}
            <Link
              href={selectedVehicleId ? `/diagnose?vehicleId=${selectedVehicleId}` : "/diagnose"}
              className="inline-block sm:w-auto"
            >
              <Button
                size="default"
                variant="outline"
                className="dashboard-secondary-btn group w-auto rounded-lg sm:rounded-2xl font-semibold border border-[#203131] bg-[#101C1C]/80 text-[#F5F7F6] hover:bg-[#132020] hover:border-[#66C56A]/40 transition-all h-8 sm:h-11 px-2.5 sm:px-4 text-[11px] sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2"
              >
                <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#66C56A] group-hover:text-inherit shrink-0 transition-colors" />
                <span>AI Diagnosis</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* ========================================================================
            RIGHT CAR VISUAL LAYER (Absolute on Right for Mobile & Desktop)
            ======================================================================== */}
        <div className="absolute right-0 bottom-0 w-[145px] min-[375px]:w-[165px] min-[400px]:w-[185px] sm:w-[280px] md:w-[460px] lg:w-[540px] xl:w-[600px] h-[85px] min-[375px]:h-[95px] min-[400px]:h-[110px] sm:h-[140px] md:h-[190px] lg:h-[225px] xl:h-[245px] flex items-end justify-end pointer-events-none z-0">
          {!carImageError ? (
            <div className="relative w-full h-full">
              <Image
                src="/images/dashboard-car.png"
                alt="Vehicle Showcase"
                fill
                priority
                sizes="(max-width: 640px) 185px, (max-width: 768px) 280px, (max-width: 1024px) 460px, (max-width: 1280px) 540px, 600px"
                className="object-contain object-bottom-right drop-shadow-[0_8px_16px_rgba(0,0,0,0.8)]"
                onError={() => setCarImageError(true)}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-2 text-center rounded-xl border border-[#203131] bg-[#0B1515] w-28 h-16 mr-2 mb-2">
              <div className="p-1 rounded-lg bg-[#101C1C] text-[#66C56A] border border-[#2E7D32]/30 mb-0.5">
                <Car className="h-4 w-4" />
              </div>
              <span className="text-[9px] font-semibold text-[#F5F7F6]">Garage Connected</span>
            </div>
          )}
        </div>
      </div>

      {/* Profile & Vehicle Completion Reminder Card */}
      <DashboardProfileReminder />

      {/* ========================================================================
          VEHICLE SWITCHER BAR (Car & Bike Support)
          ======================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl border border-border bg-card shadow-xs">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-secondary text-emerald-600 dark:text-[#66C56A] shrink-0 border border-emerald-500/30">
            {selectedVehicle?.vehicle_type === "Bike" ? (
              <Bike className="h-5 w-5 sm:h-6 sm:w-6" />
            ) : (
              <Car className="h-5 w-5 sm:h-6 sm:w-6" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-[#66C56A]">
                Active Vehicle
              </span>
              {selectedVehicle && (
                <span className="inline-flex items-center rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-[#66C56A] border border-emerald-500/20">
                  {selectedVehicle.vehicle_type || "Car"}
                </span>
              )}
            </div>

            {vehicles.length > 0 ? (
              <div className="mt-1">
                <select
                  id="dashboard-vehicle-switcher"
                  aria-label="Select active vehicle"
                  value={selectedVehicleId}
                  onChange={(e) => handleSelectVehicle(e.target.value)}
                  className="w-full max-w-sm sm:max-w-md rounded-xl border border-border bg-secondary px-3 py-1.5 text-xs sm:text-sm font-semibold text-foreground outline-none transition-all focus:border-[#66C56A] focus:ring-1 focus:ring-[#66C56A] cursor-pointer"
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vehicle_type === "Bike" ? "[Bike] " : "[Car] "}
                      {v.nickname || `${v.year} ${v.make} ${v.model}`} (Odo: {v.odometer_km ? `${Number(v.odometer_km).toLocaleString()} km` : "N/A"})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">No vehicles registered.</span>
                <Link
                  href="/vehicles/add"
                  className="text-xs font-semibold text-emerald-600 dark:text-[#66C56A] hover:underline inline-flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Add Vehicle
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Right: Selected Vehicle Quick Info Badges */}
        {selectedVehicle && (
          <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border text-xs">
            <div className="rounded-xl bg-secondary px-3 py-1.5 border border-border">
              <span className="block text-[9px] text-muted-foreground uppercase font-semibold">Odometer</span>
              <span className="text-xs font-bold text-foreground">
                {selectedVehicle.odometer_km ? `${Number(selectedVehicle.odometer_km).toLocaleString()} km` : "N/A"}
              </span>
            </div>
            <Link href={`/vehicles/${selectedVehicle.id}`}>
              <Button
                variant="outline"
                size="sm"
                className="h-8 sm:h-9 rounded-xl border-border bg-secondary text-xs text-emerald-600 dark:text-[#66C56A] hover:bg-muted"
              >
                Manage
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* ========================================================================
          VEHICLE HEALTH SUMMARY CARDS (Reactive to Selected Vehicle)
          ======================================================================== */}
      <HealthSummaryCards
        selectedVehicle={selectedVehicle}
        schedules={schedules}
        services={allServices}
        reminders={allRemindersList}
        diagnoses={vehicleDiagnoses}
        loading={loadingDiagnoses}
      />

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.name} href={stat.href}>
              <Card className="hover:border-[#2E7D32]/60 dark:hover:border-[#66C56A]/60 transition-all cursor-pointer group active:scale-[0.99] shadow-sm">
                <CardContent className="p-3.5 sm:p-5 flex flex-col justify-between h-28 sm:h-32">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground truncate">
                      {stat.name}
                    </span>
                    <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-[#66C56A] border border-emerald-500/20 transition-transform group-hover:scale-105 shrink-0">
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="mt-2 text-xl sm:text-3xl font-bold tracking-tight text-foreground">
                    {stat.value}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Main Activities & Performance Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Columns - Activities */}
        <div className="md:col-span-2 space-y-6">
          {/* Upcoming Reminders Card */}
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
              <div>
                <CardTitle className="text-base sm:text-lg text-foreground">Upcoming Reminders</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">Tasks & document expiries requiring attention</CardDescription>
              </div>
              <Link href="/reminders" className="text-xs font-semibold text-emerald-600 dark:text-[#66C56A] hover:underline flex items-center gap-1">
                <span>View All</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </CardHeader>
            <CardContent className="divide-y divide-border pt-0">
              {upcomingReminders.length > 0 ? (
                upcomingReminders.map((reminder) => {
                  const statusType = getReminderStatus(reminder.status, reminder.due_date);
                  const isCritical = statusType === "critical";
                  const isWarning = statusType === "warning";

                  const dotColor = isCritical
                    ? "bg-[#E05252] shadow-[0_0_8px_rgba(224,82,82,0.6)]"
                    : isWarning
                    ? "bg-[#D9A441] shadow-[0_0_8px_rgba(217,164,65,0.6)]"
                    : "bg-[#66C56A] shadow-[0_0_8px_rgba(102,197,106,0.6)]";

                  return (
                    <Link
                      key={reminder.id}
                      href="/reminders"
                      className="flex items-center justify-between py-3.5 hover:bg-muted/40 px-1 rounded-lg transition-colors group cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`h-2.5 w-2.5 rounded-full ${dotColor} shrink-0`} />
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-foreground truncate group-hover:text-emerald-600 dark:group-hover:text-[#66C56A] transition-colors">
                            {reminder.task_name}
                          </h4>
                          <p className="text-xs text-muted-foreground truncate">
                            {reminder.vehicleName} • {formatDueText(reminder.due_date)}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-emerald-600 dark:group-hover:text-[#66C56A] shrink-0 transition-colors" />
                    </Link>
                  );
                })
              ) : (
                <div className="py-6 text-center">
                  <div className="flex justify-center mb-2">
                    <div className="p-2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-[#66C56A] border border-emerald-500/20">
                      <Sparkles className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-sm font-medium text-foreground">All Caught Up!</p>
                  <p className="text-xs text-muted-foreground mt-0.5">No upcoming maintenance or document alerts at this time.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Maintenance Log */}
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
              <div>
                <CardTitle className="text-base sm:text-lg text-foreground">Recent Service Logs</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">Latest completed maintenance</CardDescription>
              </div>
              <Link href="/maintenance" className="text-xs font-semibold text-emerald-600 dark:text-[#66C56A] hover:underline flex items-center gap-1">
                <span>View History</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </CardHeader>
            <CardContent className="divide-y divide-border pt-0">
              {recentServices.length > 0 ? (
                recentServices.map((service) => (
                  <Link
                    key={service.id}
                    href="/maintenance"
                    className="flex items-start gap-3.5 py-3.5 hover:bg-muted/40 px-1 rounded-lg transition-colors group cursor-pointer"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-[#66C56A] border border-emerald-500/20 shrink-0 mt-0.5 group-hover:border-emerald-500/50 transition-colors">
                      <Wrench className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="text-sm font-semibold text-foreground truncate group-hover:text-emerald-600 dark:group-hover:text-[#66C56A] transition-colors">
                          {service.service}
                        </h4>
                        <span className="text-xs font-semibold text-emerald-600 dark:text-[#9BE39A] bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 shrink-0">
                          Logged
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {service.vehicle} • {service.date}
                      </p>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="py-6 text-center">
                  <div className="flex justify-center mb-2">
                    <div className="p-2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-[#66C56A] border border-emerald-500/20">
                      <Wrench className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-sm font-medium text-foreground">No Service Logs</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Log completed maintenance to track vehicle health.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Fuel Budget */}
        <div className="flex flex-col h-full">
          {/* Track Your Fuel Budget Card */}
          <DashboardFuelCard
            className="h-full"
            selectedVehicle={selectedVehicle}
            onBudgetUpdate={(cost) => {
              setFuelSpendEstimate(cost !== null ? formatCurrency(cost) : "N/A");
            }}
          />
        </div>
      </div>

      {/* ========================================================================
          FIND SERVICE CENTER (Real Geolocation + List/Map Views + Detail Card)
          ======================================================================== */}
      <FindServiceCenter />
    </div>
  );
}
