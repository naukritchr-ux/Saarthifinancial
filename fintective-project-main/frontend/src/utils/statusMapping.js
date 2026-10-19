/**
 * Fintective Deal & Billing Status Mapping Standard
 * Standardizes raw database & CRM status strings into 3 canonical buckets:
 * - INVOICED: Officially billed/closed deals generating revenue
 * - PROGRESSED: Active pipeline, in-progress or held positions
 * - CANCELLED: Dropped, voided, or credited-back deals
 */

export const STATUS_BUCKETS = {
  INVOICED: 'invoiced',
  PROGRESSED: 'progressed',
  CANCELLED: 'cancelled',
  OTHER: 'other'
};

// Raw statuses mapped to canonical buckets
const INVOICED_STATUSES = new Set([
  'closed',
  'offered_and_accepted',
  'offered and accepted',
  'r',
  'rv',
  'invoiced',
  'billed',
  'collected'
]);

const PROGRESSED_STATUSES = new Set([
  'inprogress',
  'in_progress',
  'in progress',
  'position_hold',
  'position hold',
  'revised',
  'reallocation',
  'pipeline',
  'sourcing',
  'interviewing'
]);

const CANCELLED_STATUSES = new Set([
  'cancelled',
  'canceled',
  'internally_closed',
  'internally closed',
  'credit_note',
  'credit note',
  'cn',
  'legal-cn',
  'legal_cn',
  'c',
  'void',
  'dropped'
]);

/**
 * Normalizes any raw status string into one of the 3 canonical buckets.
 * @param {string|any} rawStatus 
 * @returns {'invoiced'|'progressed'|'cancelled'|'other'}
 */
export function getStatusBucket(rawStatus) {
  if (!rawStatus || typeof rawStatus !== 'string') {
    return STATUS_BUCKETS.OTHER;
  }
  const clean = rawStatus.trim().toLowerCase();
  
  if (INVOICED_STATUSES.has(clean)) {
    return STATUS_BUCKETS.INVOICED;
  }
  if (PROGRESSED_STATUSES.has(clean)) {
    return STATUS_BUCKETS.PROGRESSED;
  }
  if (CANCELLED_STATUSES.has(clean)) {
    return STATUS_BUCKETS.CANCELLED;
  }
  
  // Fuzzy checks for compound status strings
  if (clean.includes('closed') || clean.includes('accepted') || clean.includes('billed') || clean.includes('invoice')) {
    return STATUS_BUCKETS.INVOICED;
  }
  if (clean.includes('progress') || clean.includes('hold') || clean.includes('realloc')) {
    return STATUS_BUCKETS.PROGRESSED;
  }
  if (clean.includes('cancel') || clean.includes('credit') || clean.includes('cn')) {
    return STATUS_BUCKETS.CANCELLED;
  }

  return STATUS_BUCKETS.OTHER;
}

/**
 * Checks if a status represents an officially invoiced/won deal.
 */
export function isInvoiced(rawStatus) {
  return getStatusBucket(rawStatus) === STATUS_BUCKETS.INVOICED;
}

/**
 * Checks if a status represents a cancelled/voided deal.
 */
export function isCancelled(rawStatus) {
  return getStatusBucket(rawStatus) === STATUS_BUCKETS.CANCELLED;
}

/**
 * Checks if a status represents an active in-progress pipeline deal.
 */
export function isProgressed(rawStatus) {
  return getStatusBucket(rawStatus) === STATUS_BUCKETS.PROGRESSED;
}

/**
 * Returns user-facing label and styling metadata for UI badges.
 */
export function getStatusBadgeMeta(rawStatus) {
  const bucket = getStatusBucket(rawStatus);
  switch (bucket) {
    case STATUS_BUCKETS.INVOICED:
      return {
        bucket,
        label: 'Invoiced',
        className: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
        dotColor: '#10b981'
      };
    case STATUS_BUCKETS.PROGRESSED:
      return {
        bucket,
        label: 'In Progress',
        className: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
        dotColor: '#f59e0b'
      };
    case STATUS_BUCKETS.CANCELLED:
      return {
        bucket,
        label: 'Cancelled',
        className: 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
        dotColor: '#f43f5e'
      };
    default:
      return {
        bucket,
        label: rawStatus || 'Unknown',
        className: 'bg-slate-50 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
        dotColor: '#94a3b8'
      };
  }
}
