export type DocumentExpiryStatus = "active" | "expiring_soon" | "expired";

/**
 * Safely parse a date string (YYYY-MM-DD or ISO) into a local midnight Date.
 * Avoids UTC timezone shift issues when comparing calendar dates.
 */
export function parseCalendarDate(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const clean = String(dateStr).split("T")[0].trim();
  const parts = clean.split("-");
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      return new Date(year, month, day, 0, 0, 0, 0);
    }
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

/**
 * Determine expiry status:
 * - "expired": expiry date is strictly before today (< 0 days)
 * - "expiring_soon": expiry date is between 0 and 30 days from today (inclusive)
 * - "active": expiry date is more than 30 days remaining
 */
export function getDocumentExpiryStatus(expiryDateStr?: string | null): DocumentExpiryStatus {
  if (!expiryDateStr) return "active";
  const expiry = parseCalendarDate(expiryDateStr);
  if (!expiry) return "active";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  const diffMs = expiry.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return "expired";
  }
  if (diffDays <= 30) {
    return "expiring_soon";
  }
  return "active";
}

/**
 * Determine days remaining until expiry.
 * Negative numbers mean expired X days ago.
 */
export function getDaysUntilExpiry(expiryDateStr?: string | null): number | null {
  if (!expiryDateStr) return null;
  const expiry = parseCalendarDate(expiryDateStr);
  if (!expiry) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  return Math.round((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Consistently find the latest/current insurance policy for a vehicle.
 * Safely compares created_at, expiry_date, and start_date without NaN sorting bugs.
 */
export interface BaseInsurancePolicy {
  id?: string | null;
  created_at?: string | null;
  expiry_date?: string | null;
  start_date?: string | null;
  updated_at?: string | null;
}

export function getLatestInsurancePolicy<
  T extends BaseInsurancePolicy = BaseInsurancePolicy
>(policies?: T[] | null): T | null {
  if (!policies || !Array.isArray(policies) || policies.length === 0) {
    return null;
  }

  const validPolicies = [...policies].filter((p) => Boolean(p));
  if (validPolicies.length === 0) return null;

  // Reverse so later elements in array win ties (representing later insertion)
  return [...validPolicies].reverse().sort((a, b) => {
    // 1. Compare latest timestamp between updated_at and created_at
    const getTimestamp = (p: T): number => {
      const updated = p.updated_at ? new Date(p.updated_at).getTime() : 0;
      const created = p.created_at ? new Date(p.created_at).getTime() : 0;
      const validUpdated = isNaN(updated) ? 0 : updated;
      const validCreated = isNaN(created) ? 0 : created;
      return Math.max(validUpdated, validCreated);
    };

    const timeA = getTimestamp(a);
    const timeB = getTimestamp(b);
    if (timeA !== timeB) {
      return timeB - timeA;
    }

    // 2. Compare start_date (most recently started policy period)
    const startDateA = a.start_date ? parseCalendarDate(a.start_date)?.getTime() || 0 : 0;
    const startDateB = b.start_date ? parseCalendarDate(b.start_date)?.getTime() || 0 : 0;
    if (startDateA !== startDateB) {
      return startDateB - startDateA;
    }

    return 0;
  })[0] || null;
}

/**
 * Compute the dynamic count of active documents.
 */
export function getActiveDocumentsCount(
  insuranceExpiry?: string | null,
  pucExpiry?: string | null,
  fastagStatus?: string | null
): number {
  let count = 0;
  if (insuranceExpiry && getDocumentExpiryStatus(insuranceExpiry) === "active") {
    count += 1;
  }
  if (pucExpiry && getDocumentExpiryStatus(pucExpiry) === "active") {
    count += 1;
  }
  if (fastagStatus && fastagStatus.toLowerCase() === "active") {
    count += 1;
  }
  return count;
}
