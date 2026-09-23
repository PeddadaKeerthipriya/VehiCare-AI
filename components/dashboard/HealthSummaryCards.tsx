"use client";

import React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import {
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  Sparkles,
  Wrench,
  FileCheck,
  ChevronRight,
  HelpCircle,
} from "lucide-react";
import {
  Vehicle,
  MaintenanceSchedule,
  ServiceRecord,
  BackendDiagnosis,
} from "@/lib/types";
import {
  evaluateVehicleHealth,
  HealthReminderItem,
  VehicleHealthSummary,
} from "@/lib/vehicleHealth";

interface HealthSummaryCardsProps {
  selectedVehicle: Vehicle | null;
  schedules?: MaintenanceSchedule[];
  services?: ServiceRecord[];
  reminders?: HealthReminderItem[];
  diagnoses?: BackendDiagnosis[];
  loading?: boolean;
}

export function HealthSummaryCards({
  selectedVehicle,
  schedules = [],
  services = [],
  reminders = [],
  diagnoses = [],
  loading = false,
}: HealthSummaryCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card
            key={i}
            className="p-4 rounded-2xl shadow-xs animate-pulse"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="h-4 w-24 bg-muted rounded-md" />
              <div className="h-7 w-7 bg-muted rounded-lg" />
            </div>
            <div className="h-6 w-20 bg-muted rounded-md mb-2" />
            <div className="h-3 w-36 bg-muted rounded-md" />
          </Card>
        ))}
      </div>
    );
  }

  if (!selectedVehicle) {
    return (
      <Card className="p-5 rounded-2xl shadow-xs">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-secondary border border-border flex items-center justify-center text-muted-foreground">
              <HelpCircle className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                No Vehicle Selected
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Register or select a vehicle to display live vehicle health indicators.
              </p>
            </div>
          </div>
          <Link
            href="/vehicles/add"
            className="text-xs font-semibold text-emerald-600 dark:text-[#66C56A] hover:underline"
          >
            + Add Vehicle
          </Link>
        </div>
      </Card>
    );
  }

  const health: VehicleHealthSummary = evaluateVehicleHealth(
    selectedVehicle,
    schedules,
    services,
    reminders,
    diagnoses
  );

  const isBike = selectedVehicle.vehicle_type === "Bike";

  // Color mapper helper
  const getColorStyles = (color: "green" | "amber" | "rose" | "gray") => {
    switch (color) {
      case "green":
        return {
          iconText: "text-emerald-600 dark:text-[#66C56A]",
          iconBg: "bg-emerald-500/10 border-emerald-500/20",
          badgeBg: "bg-emerald-500/10 text-emerald-600 dark:text-[#66C56A] border-emerald-500/20",
          border: "border-border hover:border-[#2E7D32]/60 dark:hover:border-[#66C56A]/60",
        };
      case "amber":
        return {
          iconText: "text-[#D9A441]",
          iconBg: "bg-amber-500/10 border-amber-500/20",
          badgeBg: "bg-amber-500/10 text-amber-600 dark:text-[#D9A441] border-amber-500/20",
          border: "border-amber-500/30 hover:border-amber-500/60",
        };
      case "rose":
        return {
          iconText: "text-rose-500 dark:text-rose-400",
          iconBg: "bg-rose-500/10 border-rose-500/20",
          badgeBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
          border: "border-rose-500/30 hover:border-rose-500/60",
        };
      default:
        return {
          iconText: "text-emerald-600 dark:text-[#66C56A]",
          iconBg: "bg-emerald-500/10 border-emerald-500/20",
          badgeBg: "bg-secondary text-muted-foreground border-border",
          border: "border-border hover:border-[#2E7D32]/60 dark:hover:border-[#66C56A]/60",
        };
    }
  };

  const overallStyles = getColorStyles(health.overall.color);
  const diagStyles = getColorStyles(health.diagnosis.color);
  const maintStyles = getColorStyles(health.maintenance.color);
  const compStyles = getColorStyles(health.compliance.color);

  return (
    <div className="space-y-2.5">
      {/* Section Subheading */}
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Live Vehicle Health
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {isBike ? "Motorcycle Metrics" : "Automobile Metrics"}
        </span>
      </div>

      {/* 4 Health Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* ====================================================================
            CARD 1: OVERALL VEHICLE HEALTH
            ==================================================================== */}
        <Card
          className={`relative overflow-hidden rounded-2xl p-4 shadow-sm transition-all h-full ${overallStyles.border}`}
        >
          <CardContent className="p-0 flex flex-col justify-between h-full space-y-2.5">
            <div className="flex items-start justify-between gap-2 min-h-[3.25rem]">
              <div className="min-w-0 flex-1">
                <span className="text-sm font-bold text-foreground block truncate">
                  Overall Status
                </span>
                <div className="mt-1.5 flex items-center">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-0.5 text-xs font-semibold border whitespace-nowrap ${overallStyles.badgeBg}`}
                  >
                    {health.overall.badgeText}
                  </span>
                </div>
              </div>
              <div
                className={`p-2 rounded-xl border shrink-0 ${overallStyles.iconBg} ${overallStyles.iconText}`}
              >
                {health.overall.color === "green" ? (
                  <ShieldCheck className="h-4 w-4" />
                ) : health.overall.color === "amber" ? (
                  <AlertTriangle className="h-4 w-4" />
                ) : health.overall.color === "rose" ? (
                  <AlertOctagon className="h-4 w-4" />
                ) : (
                  <HelpCircle className="h-4 w-4" />
                )}
              </div>
            </div>

            <div className="my-1 min-h-[2.5rem] flex items-center">
              <p className="text-xs text-muted-foreground leading-relaxed font-medium line-clamp-2">
                {health.overall.description}
              </p>
            </div>

            <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <span className="truncate font-medium">
                {selectedVehicle.nickname || `${selectedVehicle.make} ${selectedVehicle.model}`}
              </span>
              <span className="shrink-0 text-emerald-600 dark:text-[#66C56A] font-bold">
                {selectedVehicle.year}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* ====================================================================
            CARD 2: DIAGNOSTIC STATUS
            ==================================================================== */}
        <Link href="/diagnose" className="group">
          <Card
            className={`relative overflow-hidden rounded-2xl p-4 shadow-sm transition-all group-hover:bg-muted/30 cursor-pointer h-full ${diagStyles.border}`}
          >
            <CardContent className="p-0 flex flex-col justify-between h-full space-y-2.5">
              <div className="flex items-start justify-between gap-2 min-h-[3.25rem]">
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-bold text-foreground block truncate">
                    Diagnostic Status
                  </span>
                  <div className="mt-1.5 flex items-center">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-0.5 text-xs font-semibold border whitespace-nowrap ${diagStyles.badgeBg}`}
                    >
                      {health.diagnosis.status === "No Diagnoses Recorded"
                        ? "No Records"
                        : health.diagnosis.status}
                    </span>
                  </div>
                </div>
                <div
                  className={`p-2 rounded-xl border shrink-0 transition-transform group-hover:scale-105 ${diagStyles.iconBg} ${diagStyles.iconText}`}
                >
                  <Sparkles className="h-4 w-4" />
                </div>
              </div>

              <div className="my-1 min-h-[2.5rem] flex items-center">
                {health.diagnosis.hasRecord ? (
                  <div className="space-y-1 w-full">
                    <p className="text-xs text-foreground font-medium truncate">
                      {health.diagnosis.latestSymptom || health.diagnosis.possibleCause || "Diagnostic recorded"}
                    </p>
                    {health.diagnosis.mechanicRequired && (
                      <span className="inline-block text-[10px] font-semibold text-[#D9A441] bg-amber-500/10 px-1.5 py-0.5 rounded-md border border-[#D9A441]/30">
                        Mechanic Recommended
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground leading-relaxed font-medium line-clamp-2">
                    No active faults or abnormal symptoms recorded.
                  </p>
                )}
              </div>

              <div className="pt-2 border-t border-border flex items-center justify-between text-xs font-medium text-muted-foreground group-hover:text-emerald-600 dark:group-hover:text-[#66C56A] transition-colors">
                <span>{health.diagnosis.date ? `Checked: ${health.diagnosis.date}` : "Run Diagnosis"}</span>
                <ChevronRight className="h-4 w-4 text-emerald-600 dark:text-[#66C56A] shrink-0" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* ====================================================================
            CARD 3: MAINTENANCE HEALTH
            ==================================================================== */}
        <Link href="/maintenance" className="group">
          <Card
            className={`relative overflow-hidden rounded-2xl p-4 shadow-sm transition-all group-hover:bg-muted/30 cursor-pointer h-full ${maintStyles.border}`}
          >
            <CardContent className="p-0 flex flex-col justify-between h-full space-y-2.5">
              <div className="flex items-start justify-between gap-2 min-h-[3.25rem]">
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-bold text-foreground block truncate">
                    Maintenance Status
                  </span>
                  <div className="mt-1.5 flex items-center">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-0.5 text-xs font-semibold border whitespace-nowrap ${maintStyles.badgeBg}`}
                    >
                      {health.maintenance.badgeText}
                    </span>
                  </div>
                </div>
                <div
                  className={`p-2 rounded-xl border shrink-0 transition-transform group-hover:scale-105 ${maintStyles.iconBg} ${maintStyles.iconText}`}
                >
                  <Wrench className="h-4 w-4" />
                </div>
              </div>

              <div className="my-1 min-h-[2.5rem] flex items-center">
                {health.maintenance.nextTaskName ? (
                  <div className="space-y-0.5 w-full">
                    <p className="text-xs text-foreground font-medium truncate">
                      {health.maintenance.nextTaskName}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {health.maintenance.nextDueDate
                        ? `Due: ${health.maintenance.nextDueDate}`
                        : health.maintenance.nextDueOdometerKm
                        ? `At: ${health.maintenance.nextDueOdometerKm.toLocaleString()} km`
                        : "Scheduled"}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground leading-relaxed font-medium line-clamp-2">
                    {health.maintenance.completedServicesCount > 0
                      ? `${health.maintenance.completedServicesCount} maintenance service(s) logged.`
                      : "Routine maintenance schedules up to date."}
                  </p>
                )}
              </div>

              <div className="pt-2 border-t border-border flex items-center justify-between text-xs font-medium text-muted-foreground group-hover:text-emerald-600 dark:group-hover:text-[#66C56A] transition-colors">
                <span>View Schedules</span>
                <ChevronRight className="h-4 w-4 text-emerald-600 dark:text-[#66C56A] shrink-0" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* ====================================================================
            CARD 4: COMPLIANCE STATUS
            ==================================================================== */}
        <Link href="/reminders" className="group">
          <Card
            className={`relative overflow-hidden rounded-2xl p-4 shadow-sm transition-all group-hover:bg-muted/30 cursor-pointer h-full ${compStyles.border}`}
          >
            <CardContent className="p-0 flex flex-col justify-between h-full space-y-2.5">
              <div className="flex items-start justify-between gap-2 min-h-[3.25rem]">
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-bold text-foreground block truncate">
                    Compliance & Documents
                  </span>
                  <div className="mt-1.5 flex items-center">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-0.5 text-xs font-semibold border whitespace-nowrap ${compStyles.badgeBg}`}
                    >
                      {health.compliance.badgeText}
                    </span>
                  </div>
                </div>
                <div
                  className={`p-2 rounded-xl border shrink-0 transition-transform group-hover:scale-105 ${compStyles.iconBg} ${compStyles.iconText}`}
                >
                  <FileCheck className="h-4 w-4" />
                </div>
              </div>

              <div className="my-1 min-h-[2.5rem] flex items-center">
                <p className="text-xs text-muted-foreground leading-relaxed font-medium line-clamp-2">
                  {health.compliance.detailText}
                </p>
              </div>

              <div className="pt-2 border-t border-border flex items-center justify-between text-xs font-medium text-muted-foreground group-hover:text-emerald-600 dark:group-hover:text-[#66C56A] transition-colors">
                <span>Manage Reminders</span>
                <ChevronRight className="h-4 w-4 text-emerald-600 dark:text-[#66C56A] shrink-0" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
