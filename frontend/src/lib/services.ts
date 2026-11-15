import { FAULT_CATALOG, PERTURB, READING_META } from "./config";
import type { Availability, DataSource, DiagnosticRecord, Part, Severity, Subsystem, TaskStatus, Technician, WorkOrder } from "./types";

const r2 = (n: number) => Math.round(n * 100) / 100;

/* ---------- Diagnostics (mock inference) ---------- */
export function buildReadings(faultClass: string, jitter = false, subsystem?: Subsystem) {
  const out: Record<string, number> = {};
  for (const [key, m] of Object.entries(READING_META)) {
    if (subsystem && m.subsystem !== subsystem) continue;
    const delta = PERTURB[faultClass]?.[key] ?? 0;
    const noise = jitter ? m.normal * (Math.random() - 0.5) * 0.04 : 0;
    out[key] = r2(m.normal + delta + noise);
  }
  return out;
}
export const assessSeverity = (c: string): Severity => FAULT_CATALOG[c]?.severity ?? "Warning";

export function simulateDiagnostic(assetId: string, subsystem: Subsystem, faultClass: string, dataSource: DataSource): Omit<DiagnosticRecord, "id"> {
  return {
    assetId, subsystem, predictedClass: faultClass, dataSource,
    timestamp: new Date().toISOString(),
    confidence: r2(0.72 + Math.random() * 0.26),
    severity: assessSeverity(faultClass),
    modelName: subsystem === "Alternator" ? "RandomForest-MCSA (mock)" : "LightGBM-Engine (mock)",
    modelVersion: "0.1-mock", validation: "Valid",
    inputSummary: buildReadings(faultClass, true, subsystem),
  };
}

/* ---------- Workload and inventory helpers ---------- */
export const ACTIVE_STATUSES: TaskStatus[] = ["Assigned", "Accepted", "In Progress", "On Hold"];
export const workloadOf = (techId: string, wos: WorkOrder[]) =>
  wos.filter((w) => w.assignedTo === techId && ACTIVE_STATUSES.includes(w.status)).length;

export const reservedQty = (partId: string, wos: WorkOrder[]) =>
  wos.filter((w) => w.status !== "Completed" && w.status !== "Cancelled")
    .flatMap((w) => w.allocations).filter((a) => a.partId === partId).reduce((s, a) => s + a.qty, 0);
export const availableQty = (p: Part, wos: WorkOrder[]) => p.quantity - reservedQty(p.id, wos);

/* ---------- Recommendation engine: Score = w1·Skill + w2·Availability + w3·Proximity + w4·Workload + w5·Experience ---------- */
export interface Weights { skill: number; availability: number; proximity: number; workload: number; experience: number }
export const DEFAULT_WEIGHTS: Weights = { skill: 35, availability: 20, proximity: 15, workload: 15, experience: 15 };
export const WEIGHT_LABELS: Record<keyof Weights, string> = { skill: "Skill match", availability: "Availability", proximity: "Proximity", workload: "Workload capacity", experience: "Experience" };
const MAX_KM = 40;

export interface Candidate {
  tech: Technician; score: number; factors: Weights; distanceKm: number;
  openTasks: number; matchedSkills: string[]; eligible: boolean;
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180, dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export function recommendTechnicians(requiredSkills: string[], site: { lat: number; lng: number }, techs: Technician[], wos: WorkOrder[], w: Weights = DEFAULT_WEIGHTS): Candidate[] {
  const total = Object.values(w).reduce((a, b) => a + b, 0) || 1;
  const AV: Record<Availability, number> = { Available: 1, Busy: 0.5, Unavailable: 0, "On Leave": 0 };
  return techs.filter((t) => t.active).map((t) => {
    const matched = requiredSkills.filter((s) => t.skills.includes(s));
    const open = workloadOf(t.id, wos);
    const dist = distanceKm(t, site);
    const factors: Weights = {
      skill: requiredSkills.length ? matched.length / requiredSkills.length : 1,
      availability: AV[t.availability],
      proximity: Math.max(0, 1 - dist / MAX_KM),
      workload: Math.max(0, 1 - open / t.maxConcurrent),
      experience: Math.min(t.experienceYears / 10, 1),
    };
    const score = ((Object.keys(w) as (keyof Weights)[]).reduce((s, k) => s + w[k] * factors[k], 0) / total) * 100;
    return { tech: t, score: Math.round(score * 10) / 10, factors, distanceKm: r2(dist), openTasks: open, matchedSkills: matched, eligible: AV[t.availability] > 0 && matched.length > 0 };
  }).sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score);
}