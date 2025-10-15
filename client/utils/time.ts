import { formatDistanceToNow } from "date-fns";

/**
 * Returns human-readable relative time, e.g. "2 hours ago".
 * Accepts Date instance or ISO string.
 */
export function timeAgo(input?: string | Date): string {
  if (!input) return "-";
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return "-";
  return formatDistanceToNow(d, { addSuffix: true });
}
