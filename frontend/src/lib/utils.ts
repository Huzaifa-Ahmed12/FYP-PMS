import { format, formatDistanceToNow } from "date-fns";

export const fmt = (iso?: string) => (iso ? format(new Date(iso), "dd MMM yyyy, HH:mm") : "—");
export const fmtDate = (iso?: string) => (iso ? format(new Date(iso), "dd MMM yyyy") : "—");
export const ago = (iso?: string) => (iso ? formatDistanceToNow(new Date(iso), { addSuffix: true }) : "—");

export function downloadCsv(filename: string, rows: Record<string, string | number>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h] ?? "")).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}