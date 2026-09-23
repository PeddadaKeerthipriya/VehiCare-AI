import { supabase } from "./supabase";
import {
  ServiceSlip,
  ServiceSlipUploadResponse,
  SlipStatusResponse,
  DiagnosisResponse,
  BackendDiagnosis,
  MaintenanceSchedule,
  InsuranceApiResponse,
  PucApiResponse,
  FastagApiResponse,
  BackendNotification,
  NotificationPreferences,
  ServiceRecord,
  VehicleType,
  NearbyServiceCentersResponse,
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
async function getAuthHeaders(
  includeJsonContentType = true
): Promise<Record<string, string>> {
  const { data: { session }, error } = await supabase.auth.getSession();

  const headers: Record<string, string> = {};

  if (includeJsonContentType) {
    headers["Content-Type"] = "application/json";
  }

  if (!error && session) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  return headers;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export interface ApiFetchOptions {
  bypassCache?: boolean;
  ttlMs?: number;
  signal?: AbortSignal;
}

const DEFAULT_CACHE_TTL_MS = 10_000; // 10 seconds default

// In-memory response cache: maps cacheKey -> { data, timestamp }
const apiCache = new Map<string, CacheEntry<unknown>>();

// In-flight request deduplication: maps cacheKey -> pending Promise<unknown>
const inFlightRequests = new Map<string, Promise<unknown>>();

/**
 * Invalidate matching keys in the in-memory API cache and pending in-flight requests.
 * If no pattern is provided, clears the entire cache.
 */
export function invalidateApiCache(pattern?: string | RegExp): void {
  if (!pattern) {
    apiCache.clear();
    inFlightRequests.clear();
    return;
  }
  for (const key of Array.from(apiCache.keys())) {
    if (typeof pattern === "string") {
      if (key.includes(pattern)) {
        apiCache.delete(key);
      }
    } else if (pattern.test(key)) {
      apiCache.delete(key);
    }
  }
  for (const key of Array.from(inFlightRequests.keys())) {
    if (typeof pattern === "string") {
      if (key.includes(pattern)) {
        inFlightRequests.delete(key);
      }
    } else if (pattern.test(key)) {
      inFlightRequests.delete(key);
    }
  }
}

/**
 * Clear the entire API cache and cancel deduplicated references.
 */
export function clearApiCache(): void {
  apiCache.clear();
  inFlightRequests.clear();
}

/**
 * Executes a network fetch with in-flight request deduplication and short-TTL memory caching.
 */
export async function dedupedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { bypassCache = false, ttlMs = DEFAULT_CACHE_TTL_MS } = options;

  // 1. Check in-memory cache if not bypassing
  if (!bypassCache) {
    const cached = apiCache.get(key);
    if (cached && Date.now() - cached.timestamp < ttlMs) {
      return cached.data as T;
    }
  }

  // 2. Check in-flight deduplication
  if (!bypassCache) {
    const inFlight = inFlightRequests.get(key);
    if (inFlight) {
      return inFlight as Promise<T>;
    }
  }

  // 3. Initiate request
  const requestPromise = (async () => {
    try {
      const data = await fetcher();
      apiCache.set(key, { data, timestamp: Date.now() });
      return data;
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, requestPromise);
  return requestPromise;
}

export async function fetchVehicles(options?: ApiFetchOptions) {
  return dedupedFetch(
    "GET:/vehicles/",
    async () => {
      const headers = await getAuthHeaders(false);
      const res = await fetch(`${API_BASE_URL}/vehicles/`, {
        headers,
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch vehicles list from backend (HTTP ${res.status}).`);
      }
      const data = await res.json();
      // Handle case where response might be wrapped in an object or directly an array
      if (Array.isArray(data)) {
        return data;
      }
      if (data && Array.isArray(data.vehicles)) {
        return data.vehicles;
      }
      if (data && typeof data === "object") {
        // If the mock backend returns a message, convert it to an empty array so it is safely loopable
        return [];
      }
      return [];
    },
    options
  );
}
export async function fetchNotifications(options?: ApiFetchOptions): Promise<
  BackendNotification[]
> {
  return dedupedFetch(
    "GET:/notifications",
    async () => {
      const headers = await getAuthHeaders(false);
      const res = await fetch(`${API_BASE_URL}/notifications`, {
        headers,
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(
          `Failed to fetch notifications from backend (HTTP ${res.status}).`
        );
      }

      return res.json();
    },
    options
  );
}

export async function fetchNotificationPreferences(options?: ApiFetchOptions): Promise<
  NotificationPreferences
> {
  return dedupedFetch(
    "GET:/notifications/preferences",
    async () => {
      const headers = await getAuthHeaders(false);
      const res = await fetch(
        `${API_BASE_URL}/notifications/preferences`,
        {
          headers,
          cache: "no-store",
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.detail ||
            `Failed to fetch notification preferences (HTTP ${res.status}).`
        );
      }

      return res.json();
    },
    options
  );
}

export async function updateNotificationPreferences(
  preferences: {
    in_app_enabled: boolean;
    email_enabled: boolean;
    sms_enabled: boolean;
  }
): Promise<NotificationPreferences> {
  const headers = await getAuthHeaders();

  const res = await fetch(
    `${API_BASE_URL}/notifications/preferences`,
    {
      method: "PUT",
      headers,
      body: JSON.stringify(preferences),
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));

    throw new Error(
      errorData.detail ||
        `Failed to update notification preferences (HTTP ${res.status}).`
    );
  }

  invalidateApiCache("/notifications");
  return res.json();
}

export async function fetchVehicleById(id: string, options?: ApiFetchOptions) {
  return dedupedFetch(
    `GET:/vehicles/${id}`,
    async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/vehicles/${id}`, {
        headers,
        cache: "no-store",
      });
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("Vehicle not found.");
        }
        throw new Error(`Failed to fetch vehicle profile from backend (HTTP ${res.status}).`);
      }
      return res.json();
    },
    options
  );
}

export async function createVehicle(payload: {
  make: string;
  model: string;
  year: number;
  vin: string;
  odometer_km: number;
  vehicle_type?: VehicleType;
}) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/vehicles/`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `Failed to create vehicle on backend (HTTP ${res.status}).`
    );
  }
  invalidateApiCache("/vehicles");
  return res.json();
}

export async function createServiceRecord(payload: {
  vehicle_id: string;
  service_date: string;
  service_type: string;
  notes: string;
  slip_id?: string;
}) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/services/`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `Failed to create service record on backend (HTTP ${res.status}).`
    );
  }
  invalidateApiCache("/services");
  invalidateApiCache("/maintenance-schedules");
  return res.json();
}

export async function getServiceRecords(options?: ApiFetchOptions): Promise<ServiceRecord[]> {
  return dedupedFetch(
    "GET:/services/",
    async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/services/`, {
        headers,
        cache: "no-store",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.detail ||
            `Failed to fetch service records (HTTP ${res.status}).`
        );
      }

      return res.json();
    },
    options
  );
}
export async function getMaintenanceSchedules(options?: ApiFetchOptions): Promise<MaintenanceSchedule[]> {
  return dedupedFetch(
    "GET:/maintenance-schedules/",
    async () => {
      const headers = await getAuthHeaders();

      try {
        const res = await fetch(`${API_BASE_URL}/maintenance-schedules/`, {
          headers,
          cache: "no-store",
        });

        if (res.ok) {
          const data = await res.json();
          return Array.isArray(data) ? data : data?.schedules || [];
        }
      } catch {
        // API endpoint unavailable or network error, fallback to Supabase table
      }

      // Fallback to Supabase
      const { data, error } = await supabase
        .from("maintenance_schedules")
        .select("*")
        .order("due_date", { ascending: true });

      if (error) {
        console.error("Failed to fetch maintenance schedules from Supabase:", error);
        return [];
      }

      return data || [];
    },
    options
  );
}

export async function createMaintenanceSchedule(payload: {
  vehicle_id: string;
  task_name: string;
  due_date?: string | null;
  due_odometer_km?: number | null;
  status?: string;
}): Promise<MaintenanceSchedule> {
  const headers = {
    ...(await getAuthHeaders()),
    "Content-Type": "application/json",
  };

  try {
    const res = await fetch(`${API_BASE_URL}/maintenance-schedules/`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      invalidateApiCache("/maintenance-schedules");
      return res.json();
    }
  } catch {
    // API endpoint unavailable or network error, fallback to Supabase table
  }

  // Fallback to Supabase
  const { data, error } = await supabase
    .from("maintenance_schedules")
    .insert([payload])
    .select()
    .single();

  if (error) {
    throw new Error(error.message || "Failed to create maintenance schedule.");
  }

  invalidateApiCache("/maintenance-schedules");
  return data;
}

export async function getInsurancePolicies(
  vehicleId: string,
  options?: ApiFetchOptions
): Promise<InsuranceApiResponse[]> {
  return dedupedFetch(
    `GET:/vehicles/${encodeURIComponent(vehicleId)}/insurance`,
    async () => {
      const headers = await getAuthHeaders();

      const res = await fetch(
        `${API_BASE_URL}/vehicles/${encodeURIComponent(vehicleId)}/insurance`,
        {
          headers,
          cache: "no-store",
        }
      );

      if (res.status === 404) {
        return [];
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));

        throw new Error(
          errorData.detail ||
            `Failed to fetch insurance policies (HTTP ${res.status}).`
        );
      }

      const data = await res.json();
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.policies)) return data.policies;
      if (data && typeof data === "object") return [data];
      return [];
    },
    options
  );
}

export async function createInsurancePolicy(
  vehicleId: string,
  payload: {
    insurer: string;
    policy_number: string;
    start_date: string;
    expiry_date: string;
    document?: File | null;
  }
): Promise<InsuranceApiResponse> {
  const headers = await getAuthHeaders(false);

  const formData = new FormData();

  formData.append("insurer", payload.insurer);
  formData.append("policy_number", payload.policy_number);
  formData.append("start_date", payload.start_date);
  formData.append("expiry_date", payload.expiry_date);

  if (payload.document) {
    formData.append("document", payload.document);
  }

  const res = await fetch(
    `${API_BASE_URL}/vehicles/${encodeURIComponent(vehicleId)}/insurance`,
    {
      method: "POST",
      headers,
      body: formData,
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));

    throw new Error(
      errorData.detail ||
        `Failed to create insurance policy (HTTP ${res.status}).`
    );
  }

  invalidateApiCache("/insurance");
  invalidateApiCache(`/vehicles/${encodeURIComponent(vehicleId)}`);
  return res.json();
}

export async function getVehiclePuc(
  vehicleId: string,
  options?: ApiFetchOptions
): Promise<PucApiResponse | null> {
  return dedupedFetch(
    `GET:/vehicles/${encodeURIComponent(vehicleId)}/puc`,
    async () => {
      const headers = await getAuthHeaders();

      const res = await fetch(
        `${API_BASE_URL}/vehicles/${encodeURIComponent(vehicleId)}/puc`,
        {
          headers,
          cache: "no-store",
        }
      );

      if (res.status === 404) {
        return null;
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));

        throw new Error(
          errorData.detail ||
            `Failed to fetch PUC details (HTTP ${res.status}).`
        );
      }

      const data = await res.json();
      if (Array.isArray(data)) {
        if (data.length === 0) return null;
        return data[0] || null;
      }
      return data || null;
    },
    options
  );
}

export async function createVehiclePuc(
  vehicleId: string,
  payload: {
    certificate_number: string;
    issued_date: string;
    expiry_date: string;
    emission_details: string;
  }
): Promise<PucApiResponse> {
  const headers = {
    ...(await getAuthHeaders()),
    "Content-Type": "application/json",
  };

  const res = await fetch(
    `${API_BASE_URL}/vehicles/${encodeURIComponent(vehicleId)}/puc`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));

    throw new Error(
      errorData.detail ||
        `Failed to create PUC details (HTTP ${res.status}).`
    );
  }

  invalidateApiCache("/puc");
  invalidateApiCache(`/vehicles/${encodeURIComponent(vehicleId)}`);
  return res.json();
}

export async function getVehicleFastag(
  vehicleId: string,
  options?: ApiFetchOptions
): Promise<FastagApiResponse | null> {
  return dedupedFetch(
    `GET:/vehicles/${encodeURIComponent(vehicleId)}/fastag`,
    async () => {
      const headers = await getAuthHeaders();

      const res = await fetch(
        `${API_BASE_URL}/vehicles/${encodeURIComponent(vehicleId)}/fastag`,
        {
          headers,
          cache: "no-store",
        }
      );

      if (res.status === 404) {
        return null;
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));

        throw new Error(
          errorData.detail ||
            `Failed to fetch FASTag details (HTTP ${res.status}).`
        );
      }

      const data = await res.json();
      if (Array.isArray(data)) {
        if (data.length === 0) return null;
        return data[0] || null;
      }
      return data || null;
    },
    options
  );
}

export async function createVehicleFastag(
  vehicleId: string,
  payload: {
    tag_id: string;
    balance: number;
    last_recharge_date?: string | null;
    status: "Active" | "Inactive" | "Blocked" | "Low Balance";
  }
): Promise<FastagApiResponse> {
  const headers = {
    ...(await getAuthHeaders()),
    "Content-Type": "application/json",
  };

  const res = await fetch(
    `${API_BASE_URL}/vehicles/${encodeURIComponent(vehicleId)}/fastag`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));

    throw new Error(
      errorData.detail ||
        `Failed to create FASTag details (HTTP ${res.status}).`
    );
  }

  invalidateApiCache("/fastag");
  invalidateApiCache(`/vehicles/${encodeURIComponent(vehicleId)}`);
  return res.json();
}

export interface OEMInterval {
  id: string;
  component: string;
  interval_km: number;
  interval_months: number;
  notes?: string | null;
}

export async function getOEMIntervals(options?: ApiFetchOptions): Promise<OEMInterval[]> {
  return dedupedFetch(
    "GET:/oem-intervals/",
    async () => {
      const headers = await getAuthHeaders();

      const res = await fetch(`${API_BASE_URL}/oem-intervals/`, {
        headers,
        cache: "no-store",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));

        throw new Error(
          errorData.detail ||
            `Failed to fetch OEM intervals (HTTP ${res.status}).`
        );
      }

      return res.json();
    },
    options
  );
}

export async function createOEMInterval(payload: {
  component: string;
  interval_km: number;
  interval_months: number;
  notes?: string | null;
}): Promise<OEMInterval> {
  const headers = {
    ...(await getAuthHeaders()),
    "Content-Type": "application/json",
  };

  const res = await fetch(`${API_BASE_URL}/oem-intervals/`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));

    throw new Error(
      errorData.detail ||
        `Failed to create OEM interval (HTTP ${res.status}).`
    );
  }

  invalidateApiCache("/oem-intervals");
  return res.json();
}
export interface CustomInterval {
  id: string;
  vehicle_id: string;
  component: string;
  interval_km: number;
  interval_months: number;
  notes?: string | null;
}

export async function createCustomInterval(payload: {
  vehicle_id: string;
  component: string;
  interval_km: number;
  interval_months: number;
  notes?: string | null;
}): Promise<CustomInterval> {
  const headers = {
    ...(await getAuthHeaders()),
    "Content-Type": "application/json",
  };

  try {
    const res = await fetch(`${API_BASE_URL}/custom-intervals/`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      invalidateApiCache("/custom-intervals");
      return res.json();
    }
  } catch {
    // API endpoint unavailable or network error, fallback to Supabase table
  }

  // Fallback to Supabase
  const { data, error } = await supabase
    .from("custom_intervals")
    .insert([payload])
    .select()
    .single();

  if (error) {
    throw new Error(error.message || "Failed to create custom interval.");
  }

  invalidateApiCache("/custom-intervals");
  return data;
}

export async function getCustomIntervals(
  vehicleId?: string,
  options?: ApiFetchOptions
): Promise<CustomInterval[]> {
  return dedupedFetch(
    `GET:/custom-intervals/${vehicleId || "all"}`,
    async () => {
      const headers = await getAuthHeaders();

      try {
        const res = await fetch(`${API_BASE_URL}/custom-intervals/`, {
          headers,
          cache: "no-store",
        });

        if (res.ok) {
          const data = await res.json();
          const intervals: CustomInterval[] = Array.isArray(data)
            ? data
            : data && Array.isArray(data.intervals)
            ? data.intervals
            : [];

          if (vehicleId) {
            return intervals.filter((item) => item.vehicle_id === vehicleId);
          }

          return intervals;
        }
      } catch {
        // API endpoint unavailable or network error, fallback to Supabase table
      }

      // Fallback to Supabase
      let query = supabase.from("custom_intervals").select("*");
      if (vehicleId) {
        query = query.eq("vehicle_id", vehicleId);
      }

      const { data, error } = await query;
      if (error) {
        console.error("Failed to fetch custom intervals from Supabase:", error);
        return [];
      }

      return data || [];
    },
    options
  );
}

export async function uploadServiceSlip(file: File): Promise<ServiceSlipUploadResponse> {
  const { data: { session }, error } = await supabase.auth.getSession();
  const headers: Record<string, string> = {};
  if (!error && session) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE_URL}/slips/`, {
    method: "POST",
    headers,
    body: formData,
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `Failed to upload slip (HTTP ${res.status}).`
    );
  }
  invalidateApiCache("/slips");
  return res.json();
}

export async function getSlipStatus(slipId: string): Promise<SlipStatusResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/slips/${slipId}/status`, {
    headers,
    cache: "no-store",
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `Failed to fetch slip status (HTTP ${res.status}).`
    );
  }
  return res.json();
}

export async function getSlipById(slipId: string, options?: ApiFetchOptions): Promise<ServiceSlip> {
  return dedupedFetch(
    `GET:/slips/${slipId}`,
    async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/slips/${slipId}`, {
        headers,
        cache: "no-store",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.detail || `Failed to fetch service slip (HTTP ${res.status}).`
        );
      }
      return res.json();
    },
    options
  );
}

export async function getServiceSlips(options?: ApiFetchOptions): Promise<ServiceSlip[]> {
  return dedupedFetch(
    "GET:/slips/",
    async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/slips/`, {
        headers,
        cache: "no-store",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.detail || `Failed to fetch service slip history (HTTP ${res.status}).`
        );
      }

      const data = await res.json();

      if (Array.isArray(data)) {
        return data;
      }

      if (data && Array.isArray(data.slips)) {
        return data.slips;
      }

      return [];
    },
    options
  );
}

export async function updateVehicle(
  id: string,
  payload: {
    make: string;
    model: string;
    year: number;
    vin: string;
    odometer_km: number;
    vehicle_type?: VehicleType;
  }
) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/vehicles/${id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `Failed to update vehicle on backend (HTTP ${res.status}).`
    );
  }
  invalidateApiCache("/vehicles");
  return res.json();
}

export async function deleteVehicle(id: string) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/vehicles/${id}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `Failed to delete vehicle from backend (HTTP ${res.status}).`
    );
  }
  invalidateApiCache("/vehicles");
  return res.json();
}

export async function diagnoseVehicle(
  vehicleId: string,
  symptom: string
): Promise<DiagnosisResponse> {
  const headers = await getAuthHeaders();
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/diagnosis/diagnose`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        vehicle_id: vehicleId,
        symptom,
      }),
    });
  } catch {
    const networkError = new Error(
      "Unable to connect to the diagnosis service. Please check your connection and try again."
    );
    (networkError as unknown as { status: number }).status = 0;
    throw networkError;
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const err = new Error(
      errorData.detail || `Diagnosis request failed (HTTP ${res.status}).`
    );
    (err as unknown as { status: number; detail: string }).status = res.status;
    (err as unknown as { status: number; detail: string }).detail = errorData.detail;
    throw err;
  }

  invalidateApiCache("/diagnoses");
  return res.json();
}

export async function getDiagnosisHistory(
  vehicleId: string,
  options?: ApiFetchOptions
): Promise<BackendDiagnosis[]> {
  return dedupedFetch(
    `GET:/diagnoses/vehicle/${vehicleId}`,
    async () => {
      const headers = await getAuthHeaders();

      const res = await fetch(
        `${API_BASE_URL}/diagnoses/vehicle/${vehicleId}`,
        {
          headers,
          cache: "no-store",
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.detail ||
            `Failed to fetch diagnosis history (HTTP ${res.status}).`
        );
      }

      return res.json();
    },
    options
  );
}

export async function getNearbyServiceCenters(
  lat: number,
  lng: number,
  radius: number = 5000,
  options?: ApiFetchOptions
): Promise<NearbyServiceCentersResponse> {
  const cacheKey = `GET:/services/nearby?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}&radius=${radius}`;
  return dedupedFetch(
    cacheKey,
    async () => {
      const headers = await getAuthHeaders();
      const query = new URLSearchParams({
        lat: lat.toString(),
        lng: lng.toString(),
        radius: radius.toString(),
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      // Connect caller's abort signal to abort the fetch if cancelled
      const externalSignal = options?.signal;
      const onExternalAbort = () => controller.abort();
      if (externalSignal) {
        if (externalSignal.aborted) {
          controller.abort();
        } else {
          externalSignal.addEventListener("abort", onExternalAbort);
        }
      }

      try {
        const res = await fetch(`${API_BASE_URL}/services/nearby?${query.toString()}`, {
          headers,
          cache: "no-store",
          signal: controller.signal,
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          if (errorData.detail) {
            throw new Error(errorData.detail);
          }
          if (res.status === 429) {
            throw new Error(
              "Service center search is temporarily rate-limited. Please wait a moment and try again."
            );
          }
          if (res.status === 504 || res.status === 408) {
            throw new Error(
              "Service center lookup timed out. Please try expanding or narrowing your search radius."
            );
          }
          if (res.status === 502 || res.status === 503) {
            throw new Error(
              "Service center provider is temporarily unavailable (Bad Gateway). Please retry in a few moments."
            );
          }
          throw new Error(
            `Failed to fetch nearby service centers (HTTP ${res.status}).`
          );
        }

        return res.json();
      } catch (err: unknown) {
        if (externalSignal?.aborted) {
          const abortError = new Error("Request was cancelled.");
          abortError.name = "AbortError";
          throw abortError;
        }
        if (err instanceof Error && err.name === "AbortError") {
          throw new Error(
            "Service center lookup timed out after 30 seconds. Please try again."
          );
        }
        throw err;
      } finally {
        clearTimeout(timeoutId);
        if (externalSignal) {
          externalSignal.removeEventListener("abort", onExternalAbort);
        }
      }
    },
    { ttlMs: 60_000, ...options }
  );
}