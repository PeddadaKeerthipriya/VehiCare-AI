import {
  Vehicle,
  MaintenanceSchedule,
  ServiceRecord,
  BackendDiagnosis,
} from "./types";

export interface HealthReminderItem {
  id: string;
  task_name: string;
  due_date: string;
  due_odometer_km: number;
  status: string;
  vehicle_id: string;
  vehicleName: string;
  reminderType?: "maintenance" | "insurance" | "puc";
}

export type HealthStatusLevel = "Healthy" | "Attention Needed" | "Critical" | "No Data";

export interface VehicleHealthSummary {
  overall: {
    status: HealthStatusLevel;
    badgeText: string;
    description: string;
    color: "green" | "amber" | "rose" | "gray";
  };
  diagnosis: {
    status: string;
    severity: string | null;
    latestSymptom: string | null;
    possibleCause: string | null;
    recommendedAction: string | null;
    mechanicRequired: boolean;
    date: string | null;
    hasRecord: boolean;
    color: "green" | "amber" | "rose" | "gray";
  };
  maintenance: {
    status: "Up to Date" | "Due Soon" | "Overdue" | "No Schedules";
    badgeText: string;
    nextTaskName: string | null;
    nextDueDate: string | null;
    nextDueOdometerKm: number | null;
    completedServicesCount: number;
    color: "green" | "amber" | "rose" | "gray";
  };
  compliance: {
    status: "Active & Valid" | "Expiring Soon" | "Action Required" | "Not Configured";
    badgeText: string;
    expiringCount: number;
    expiredCount: number;
    detailText: string;
    color: "green" | "amber" | "rose" | "gray";
  };
}

/**
 * Format ISO or calendar date string into readable short date (e.g. "Aug 15, 2026").
 */
export function formatHealthDate(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Pure evaluation of reminder urgency:
 * - "critical": overdue, expired, or past due date (< today)
 * - "warning": due soon, expiring soon
 * - "normal": valid and in future
 */
export function evaluateReminderUrgency(
  status: string,
  dueDate: string
): "critical" | "warning" | "normal" {
  const normalized = (status || "").toLowerCase();

  if (
    normalized === "overdue" ||
    normalized === "critical" ||
    normalized === "expired"
  ) {
    return "critical";
  }

  if (
    normalized === "warning" ||
    normalized === "due" ||
    normalized === "expiring_soon"
  ) {
    return "warning";
  }

  if (dueDate) {
    const due = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!Number.isNaN(due.getTime())) {
      due.setHours(0, 0, 0, 0);
      const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) {
        return "critical";
      }
      if (diffDays <= 30) {
        return "warning";
      }
    }
  }

  return "normal";
}

/**
 * Evaluates vehicle health based on real records for the selected vehicle.
 * Guarantees zero invented/mock data.
 */
export function evaluateVehicleHealth(
  selectedVehicle: Vehicle | null,
  schedules: MaintenanceSchedule[] = [],
  services: ServiceRecord[] = [],
  reminders: HealthReminderItem[] = [],
  diagnoses: BackendDiagnosis[] = []
): VehicleHealthSummary {
  // Empty state when no vehicle is selected
  if (!selectedVehicle) {
    return {
      overall: {
        status: "No Data",
        badgeText: "No Vehicle",
        description: "Select or register a vehicle to view health summary.",
        color: "gray",
      },
      diagnosis: {
        status: "No Data",
        severity: null,
        latestSymptom: null,
        possibleCause: null,
        recommendedAction: null,
        mechanicRequired: false,
        date: null,
        hasRecord: false,
        color: "gray",
      },
      maintenance: {
        status: "No Schedules",
        badgeText: "No Data",
        nextTaskName: null,
        nextDueDate: null,
        nextDueOdometerKm: null,
        completedServicesCount: 0,
        color: "gray",
      },
      compliance: {
        status: "Not Configured",
        badgeText: "No Data",
        expiringCount: 0,
        expiredCount: 0,
        detailText: "No compliance records available.",
        color: "gray",
      },
    };
  }

  const vId = selectedVehicle.id;

  // 1. EVALUATE DIAGNOSES FOR THIS VEHICLE
  const vehicleDiagnoses = diagnoses
    .filter((d) => d.vehicle_id === vId || !d.vehicle_id) // Match vehicle
    .sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeB - timeA;
    });

  const latestDiagnosis = vehicleDiagnoses.length > 0 ? vehicleDiagnoses[0] : null;

  let diagnosisColor: "green" | "amber" | "rose" | "gray" = "green";
  let diagnosisStatusText = "No Issues Reported";

  if (latestDiagnosis) {
    const rawSeverity = (latestDiagnosis.severity || "").toLowerCase();
    if (rawSeverity === "critical" || rawSeverity === "high") {
      diagnosisColor = "rose";
      diagnosisStatusText = latestDiagnosis.severity || "Critical";
    } else if (rawSeverity === "warning" || rawSeverity === "medium") {
      diagnosisColor = "amber";
      diagnosisStatusText = latestDiagnosis.severity || "Warning";
    } else {
      diagnosisColor = "green";
      diagnosisStatusText = latestDiagnosis.severity || "Normal";
    }
  } else {
    diagnosisColor = "gray";
    diagnosisStatusText = "No Diagnoses Recorded";
  }

  const diagnosisSummary = {
    status: diagnosisStatusText,
    severity: latestDiagnosis?.severity || null,
    latestSymptom: latestDiagnosis?.symptom || null,
    possibleCause: latestDiagnosis?.possible_cause || null,
    recommendedAction: latestDiagnosis?.recommended_action || null,
    mechanicRequired: Boolean(latestDiagnosis?.mechanic_required),
    date: formatHealthDate(latestDiagnosis?.created_at),
    hasRecord: Boolean(latestDiagnosis),
    color: diagnosisColor,
  };

  // 2. EVALUATE MAINTENANCE SCHEDULES & SERVICE HISTORY
  const vehicleSchedules = schedules.filter((s) => s.vehicle_id === vId);
  const vehicleServices = services.filter((s) => s.vehicle_id === vId);

  const pendingSchedules = vehicleSchedules.filter((s) => {
    const norm = (s.status || "").toLowerCase();
    return norm !== "completed" && norm !== "done";
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let overdueCount = 0;
  let dueSoonCount = 0;
  let nextDueSchedule: MaintenanceSchedule | null = null;
  let minDiffTime = Infinity;

  for (const s of pendingSchedules) {
    let isOverdue = false;
    let isDueSoon = false;

    if (s.due_date) {
      const target = new Date(s.due_date);
      target.setHours(0, 0, 0, 0);
      const diffMs = target.getTime() - today.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        isOverdue = true;
      } else if (diffDays <= 30) {
        isDueSoon = true;
      }

      if (diffMs < minDiffTime && diffDays >= 0) {
        minDiffTime = diffMs;
        nextDueSchedule = s;
      }
    }

    if (s.due_odometer_km && selectedVehicle.odometer_km) {
      const kmDiff = s.due_odometer_km - selectedVehicle.odometer_km;
      if (kmDiff <= 0) {
        isOverdue = true;
      } else if (kmDiff <= 1000) {
        isDueSoon = true;
      }
    }

    if (isOverdue) overdueCount++;
    else if (isDueSoon) dueSoonCount++;
  }

  // If no upcoming schedule picked by date, fallback to first pending schedule
  if (!nextDueSchedule && pendingSchedules.length > 0) {
    nextDueSchedule = pendingSchedules[0];
  }

  let maintenanceStatus: "Up to Date" | "Due Soon" | "Overdue" | "No Schedules" = "Up to Date";
  let maintenanceBadge = "Up to Date";
  let maintenanceColor: "green" | "amber" | "rose" | "gray" = "green";

  if (pendingSchedules.length === 0) {
    if (vehicleServices.length > 0) {
      maintenanceStatus = "Up to Date";
      maintenanceBadge = "Up to Date";
      maintenanceColor = "green";
    } else {
      maintenanceStatus = "No Schedules";
      maintenanceBadge = "No Schedules";
      maintenanceColor = "gray";
    }
  } else if (overdueCount > 0) {
    maintenanceStatus = "Overdue";
    maintenanceBadge = overdueCount === 1 ? "1 Overdue" : `${overdueCount} Overdue`;
    maintenanceColor = "rose";
  } else if (dueSoonCount > 0) {
    maintenanceStatus = "Due Soon";
    maintenanceBadge = dueSoonCount === 1 ? "1 Due Soon" : `${dueSoonCount} Due Soon`;
    maintenanceColor = "amber";
  } else {
    maintenanceStatus = "Up to Date";
    maintenanceBadge = "Scheduled";
    maintenanceColor = "green";
  }

  const maintenanceSummary = {
    status: maintenanceStatus,
    badgeText: maintenanceBadge,
    nextTaskName: nextDueSchedule?.task_name || null,
    nextDueDate: formatHealthDate(nextDueSchedule?.due_date),
    nextDueOdometerKm: nextDueSchedule?.due_odometer_km || null,
    completedServicesCount: vehicleServices.length,
    color: maintenanceColor,
  };

  // 3. EVALUATE COMPLIANCE & DOCUMENTS
  const vehicleDocReminders = reminders.filter(
    (r) =>
      r.vehicle_id === vId &&
      (r.reminderType === "insurance" || r.reminderType === "puc")
  );

  let docExpiredCount = 0;
  let docExpiringSoonCount = 0;

  for (const r of vehicleDocReminders) {
    const statusType = evaluateReminderUrgency(r.status, r.due_date);
    if (statusType === "critical") {
      docExpiredCount++;
    } else if (statusType === "warning") {
      docExpiringSoonCount++;
    }
  }

  let complianceStatus: "Active & Valid" | "Expiring Soon" | "Action Required" | "Not Configured" =
    "Active & Valid";
  let complianceBadge = "Active & Valid";
  let complianceDetail = "Insurance and PUC documents are valid.";
  let complianceColor: "green" | "amber" | "rose" | "gray" = "green";

  if (vehicleDocReminders.length === 0) {
    complianceStatus = "Not Configured";
    complianceBadge = "Not Configured";
    complianceDetail = "No compliance documents uploaded.";
    complianceColor = "gray";
  } else if (docExpiredCount > 0) {
    complianceStatus = "Action Required";
    complianceBadge = docExpiredCount === 1 ? "1 Expired" : `${docExpiredCount} Expired`;
    complianceDetail = `${docExpiredCount} document expired. Renew immediately.`;
    complianceColor = "rose";
  } else if (docExpiringSoonCount > 0) {
    complianceStatus = "Expiring Soon";
    complianceBadge =
      docExpiringSoonCount === 1 ? "1 Expiring" : `${docExpiringSoonCount} Expiring`;
    complianceDetail = `${docExpiringSoonCount} document expiring within 30 days.`;
    complianceColor = "amber";
  } else {
    complianceStatus = "Active & Valid";
    complianceBadge = "Active & Valid";
    complianceDetail = "All vehicle compliance documents are active.";
    complianceColor = "green";
  }

  const complianceSummary = {
    status: complianceStatus,
    badgeText: complianceBadge,
    expiringCount: docExpiringSoonCount,
    expiredCount: docExpiredCount,
    detailText: complianceDetail,
    color: complianceColor,
  };

  // 4. DERIVE OVERALL VEHICLE HEALTH STATUS
  let overallStatus: HealthStatusLevel = "Healthy";
  let overallBadge = "Healthy";
  let overallDescription = "All monitored systems, schedules, and documents are normal.";
  let overallColor: "green" | "amber" | "rose" | "gray" = "green";

  const isCritical =
    diagnosisColor === "rose" ||
    maintenanceColor === "rose" ||
    complianceColor === "rose";

  const isAttentionNeeded =
    diagnosisColor === "amber" ||
    maintenanceColor === "amber" ||
    complianceColor === "amber";

  const hasNoData =
    diagnosisColor === "gray" &&
    maintenanceColor === "gray" &&
    complianceColor === "gray";

  if (hasNoData) {
    overallStatus = "No Data";
    overallBadge = "No Data";
    overallDescription = "No diagnostic, maintenance, or document records found.";
    overallColor = "gray";
  } else if (isCritical) {
    overallStatus = "Critical";
    overallBadge = "Critical";
    if (diagnosisColor === "rose") {
      overallDescription = `Active ${latestDiagnosis?.severity || "critical"} diagnostic issue requires attention.`;
    } else if (maintenanceColor === "rose") {
      overallDescription = "Overdue maintenance schedule detected.";
    } else {
      overallDescription = "Compliance document expired.";
    }
    overallColor = "rose";
  } else if (isAttentionNeeded) {
    overallStatus = "Attention Needed";
    overallBadge = "Attention Needed";
    if (maintenanceColor === "amber") {
      overallDescription = "Maintenance schedule approaching due date.";
    } else if (complianceColor === "amber") {
      overallDescription = "Compliance document expiring soon.";
    } else {
      overallDescription = "Diagnostic warning logged for review.";
    }
    overallColor = "amber";
  } else {
    overallStatus = "Healthy";
    overallBadge = "Healthy";
    overallDescription = "Vehicle is in good operating condition.";
    overallColor = "green";
  }

  return {
    overall: {
      status: overallStatus,
      badgeText: overallBadge,
      description: overallDescription,
      color: overallColor,
    },
    diagnosis: diagnosisSummary,
    maintenance: maintenanceSummary,
    compliance: complianceSummary,
  };
}
