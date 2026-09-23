import {
  fetchVehicles,
  getMaintenanceSchedules,
  getInsurancePolicies,
  getVehiclePuc,
} from "@/lib/api";
import { Vehicle, MaintenanceSchedule, InsuranceApiResponse } from "@/lib/types";
import {
  getDaysUntilExpiry,
  getLatestInsurancePolicy,
} from "@/lib/documents";

export interface ReminderItem {
  id: string;
  task_name: string;
  due_date: string;
  due_odometer_km: number;
  status: string;
  vehicle_id: string;
  vehicleName: string;
  reminderType?: "maintenance" | "insurance" | "puc";
}

/**
 * Evaluates the status of a reminder:
 * - "critical": overdue, critical, or past due date (< today)
 * - "warning": warning or due
 * - "normal": future/healthy items
 */
export function getReminderStatus(
  status: string,
  dueDate: string
): "critical" | "warning" | "normal" {
  const normalizedStatus = (status || "").toLowerCase();

  if (
    normalizedStatus === "overdue" ||
    normalizedStatus === "critical"
  ) {
    return "critical";
  }

  if (
    normalizedStatus === "warning" ||
    normalizedStatus === "due"
  ) {
    return "warning";
  }

  if (dueDate) {
    const due = new Date(dueDate);
    const today = new Date();

    if (!Number.isNaN(due.getTime()) && due < today) {
      return "critical";
    }
  }

  return "normal";
}

/**
 * Checks whether a reminder requires immediate attention.
 * True for "critical" and "warning" items. False for "normal".
 */
export function isAttentionRequired(status: string, dueDate: string): boolean {
  const s = getReminderStatus(status, dueDate);
  return s === "critical" || s === "warning";
}

let inFlightRemindersPromise: Promise<ReminderItem[]> | null = null;
let remindersCache: { data: ReminderItem[]; timestamp: number } | null = null;
const REMINDERS_CACHE_TTL_MS = 10_000; // 10s default TTL

/**
 * Invalidate in-memory reminders cache and clear active in-flight tracker.
 */
export function invalidateRemindersCache(): void {
  remindersCache = null;
  inFlightRemindersPromise = null;
}

/**
 * Internal un-memoized fetcher that aggregates all reminders across all vehicles in the user's garage.
 */
async function executeFetchUserReminders(): Promise<ReminderItem[]> {
  const [vehicles, schedules] = await Promise.all([
    fetchVehicles().catch((err) => {
      console.error("Failed to load vehicles for reminders:", err);
      return [] as Vehicle[];
    }),
    getMaintenanceSchedules().catch((err) => {
      console.error("Failed to load maintenance schedules for reminders:", err);
      return [] as MaintenanceSchedule[];
    }),
  ]);

  const vehicleList: Vehicle[] = Array.isArray(vehicles) ? vehicles : [];
  const scheduleList: MaintenanceSchedule[] = Array.isArray(schedules) ? schedules : [];

  const vehicleMap = new Map(
    vehicleList.map((vehicle) => [
      vehicle.id,
      vehicle.nickname || `${vehicle.make} ${vehicle.model}`,
    ])
  );

  const userReminders: ReminderItem[] = scheduleList
    .filter((schedule) => vehicleMap.has(schedule.vehicle_id))
    .map((schedule) => ({
      ...schedule,
      vehicleName: vehicleMap.get(schedule.vehicle_id) || "Vehicle",
      reminderType: "maintenance" as const,
    }));

  // Check document alerts for all vehicles in the garage independently
  const documentResults = await Promise.all(
    vehicleList.map(async (vehicle) => {
      try {
        const [insurancePolicies, puc] = await Promise.all([
          getInsurancePolicies(vehicle.id).catch((): InsuranceApiResponse[] => []),
          getVehiclePuc(vehicle.id).catch(() => null),
        ]);

        return {
          vehicle,
          insurance: getLatestInsurancePolicy<InsuranceApiResponse>(insurancePolicies),
          puc: puc || null,
        };
      } catch (vehicleErr) {
        console.warn(`Failed to fetch documents for vehicle ${vehicle.id}:`, vehicleErr);
        return {
          vehicle,
          insurance: null,
          puc: null,
        };
      }
    })
  );

  const documentReminders: ReminderItem[] = [];

  const addDocumentReminder = (
    id: string,
    name: string,
    expiryDate: string,
    vehicleId: string,
    vehicleName: string,
    reminderType: "insurance" | "puc"
  ) => {
    if (!expiryDate) return;

    const daysRemaining = getDaysUntilExpiry(expiryDate);
    if (daysRemaining === null) return;

    if (daysRemaining < 0) {
      documentReminders.push({
        id,
        task_name: `${name} Expired`,
        due_date: expiryDate,
        due_odometer_km: 0,
        status: "critical",
        vehicle_id: vehicleId,
        vehicleName,
        reminderType,
      });
    } else if (daysRemaining <= 30) {
      documentReminders.push({
        id,
        task_name: `${name} Expiring Soon`,
        due_date: expiryDate,
        due_odometer_km: 0,
        status: "warning",
        vehicle_id: vehicleId,
        vehicleName,
        reminderType,
      });
    }
  };

  documentResults.forEach(({ vehicle, insurance, puc }) => {
    const vehicleName =
      vehicle.nickname || `${vehicle.make} ${vehicle.model}`;

    if (insurance?.expiry_date) {
      addDocumentReminder(
        `insurance-${vehicle.id}`,
        "Insurance Policy",
        insurance.expiry_date,
        vehicle.id,
        vehicleName,
        "insurance"
      );
    }

    if (puc?.expiry_date) {
      addDocumentReminder(
        `puc-${vehicle.id}`,
        "PUC Certificate",
        puc.expiry_date,
        vehicle.id,
        vehicleName,
        "puc"
      );
    }
  });

  const combined = [...documentReminders, ...userReminders];
  combined.sort((a, b) => {
    const priorityOrder: Record<string, number> = {
      critical: 0,
      warning: 1,
      normal: 2,
    };
    const statusA = getReminderStatus(a.status, a.due_date);
    const statusB = getReminderStatus(b.status, b.due_date);
    const prioA = priorityOrder[statusA] ?? 3;
    const prioB = priorityOrder[statusB] ?? 3;
    if (prioA !== prioB) return prioA - prioB;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });

  return combined;
}

/**
 * Fetches and aggregates all reminders with in-flight deduplication and short-TTL memory caching.
 * Header, Dashboard, and Reminders page share identical promises and results.
 */
export async function fetchUserReminders(
  options: { bypassCache?: boolean } = {}
): Promise<ReminderItem[]> {
  const { bypassCache = false } = options;

  if (
    !bypassCache &&
    remindersCache &&
    Date.now() - remindersCache.timestamp < REMINDERS_CACHE_TTL_MS
  ) {
    return remindersCache.data;
  }

  if (!bypassCache && inFlightRemindersPromise) {
    return inFlightRemindersPromise;
  }

  const promise = (async () => {
    try {
      const combined = await executeFetchUserReminders();
      remindersCache = { data: combined, timestamp: Date.now() };
      return combined;
    } finally {
      inFlightRemindersPromise = null;
    }
  })();

  inFlightRemindersPromise = promise;
  return promise;
}

/**
 * Computes the total number of attention-required reminders:
 * expired, expiring soon, overdue, or warning.
 */
export async function fetchAttentionRequiredRemindersCount(
  options: { bypassCache?: boolean } = {}
): Promise<number> {
  try {
    const reminders = await fetchUserReminders(options);
    return reminders.filter((r) => isAttentionRequired(r.status, r.due_date)).length;
  } catch (err) {
    console.error("Failed to compute attention required reminders count:", err);
    return 0;
  }
}

