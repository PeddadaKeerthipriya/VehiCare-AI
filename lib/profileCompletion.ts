import { ProfileCompletionState } from "./types";

const STORAGE_KEY = "vehicare_profile_completion_state";
const DOCS_STORAGE_KEY = "vehicare_profile_docs_state";
function getUserStorageKey(baseKey: string, userId?: string | null): string {
  return userId ? `${baseKey}_${userId}` : baseKey;
}

export const COMPLETION_WEIGHTS = {
  basicProfile: 20,
  vehicleRc: 35,
  insurance: 20,
  puc: 10,
  fastag: 15,
} as const;

export const DEFAULT_COMPLETION_STATE: ProfileCompletionState = {
  basicProfile: false, // Default 20% for registered auth user
  vehicleRc: false,
  insurance: false,
  puc: false,
  fastag: false,
};

export function calculateCompletionPercentage(completion: ProfileCompletionState): number {
  let percentage = 0;
  if (completion.basicProfile) percentage += COMPLETION_WEIGHTS.basicProfile;
  if (completion.vehicleRc) percentage += COMPLETION_WEIGHTS.vehicleRc;
  if (completion.insurance) percentage += COMPLETION_WEIGHTS.insurance;
  if (completion.puc) percentage += COMPLETION_WEIGHTS.puc;
  if (completion.fastag) percentage += COMPLETION_WEIGHTS.fastag;
  return Math.min(percentage, 100);
}

export function getStoredCompletionState(
  userId?: string | null
): ProfileCompletionState {
  if (typeof window === "undefined") {
    return DEFAULT_COMPLETION_STATE;
  }
  try {
    const raw = localStorage.getItem(
  getUserStorageKey(STORAGE_KEY, userId)
);
    if (!raw) return DEFAULT_COMPLETION_STATE;
    return { ...DEFAULT_COMPLETION_STATE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_COMPLETION_STATE;
  }
}

export function saveStoredCompletionState(
  state: ProfileCompletionState,
  userId?: string | null
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
  getUserStorageKey(STORAGE_KEY, userId),
  JSON.stringify(state)
);
  } catch (err) {
    console.error("Failed to save profile completion state:", err);
  }
}

function getUserVehicleStorageKey(
  baseKey: string,
  userId?: string | null,
  vehicleId?: string | null
): string {
  let key = userId ? `${baseKey}_${userId}` : baseKey;
  if (vehicleId) {
    key = `${key}_${vehicleId}`;
  }
  return key;
}

export function getStoredDocs(userId?: string | null, vehicleId?: string | null) {
  if (typeof window === "undefined") {
    return {
      rcData: null,
      insuranceData: null,
      pucData: null,
      fastagData: null,
      coverUrl: null,
    };
  }
  try {
    let raw = vehicleId
      ? localStorage.getItem(getUserVehicleStorageKey(DOCS_STORAGE_KEY, userId, vehicleId))
      : null;
    if (!raw) {
      raw = localStorage.getItem(getUserStorageKey(DOCS_STORAGE_KEY, userId));
    }
    if (!raw) {
      return {
        rcData: null,
        insuranceData: null,
        pucData: null,
        fastagData: null,
        coverUrl: null,
      };
    }
    return JSON.parse(raw);
  } catch {
    return {
      rcData: null,
      insuranceData: null,
      pucData: null,
      fastagData: null,
      coverUrl: null,
    };
  }
}

export function saveStoredDocs(
  docs: Record<string, unknown>,
  userId?: string | null,
  vehicleId?: string | null
): void {
  if (typeof window === "undefined") return;
  try {
    if (vehicleId) {
      localStorage.setItem(
        getUserVehicleStorageKey(DOCS_STORAGE_KEY, userId, vehicleId),
        JSON.stringify(docs)
      );
    }
    localStorage.setItem(
      getUserStorageKey(DOCS_STORAGE_KEY, userId),
      JSON.stringify(docs)
    );
  } catch (err) {
    console.error("Failed to save profile docs:", err);
  }
}
