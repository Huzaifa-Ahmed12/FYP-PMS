import type { Availability, FaultStatus, OperationalStatus, Priority, Severity, Subsystem, TaskStatus } from "./types";

export const APP_NAME = "DG-PdM";

/** Fixed project configuration (requirements §6.2). Replace once the supervisor confirms the exact make/model/rating. */
export const GENERATOR_MODEL = "Selected Model (TBC)";

export const SEVERITIES: Severity[] = ["Normal", "Warning", "High", "Critical"];
export const SEV_RANK: Record<Severity, number> = { Normal: 0, Warning: 1, High: 2, Critical: 3 };
export const TASK_STATUSES: TaskStatus[] = ["Draft", "Pending Assignment", "Assigned", "Accepted", "In Progress", "On Hold", "Completed", "Cancelled"];
export const PRIORITIES: Priority[] = ["Low", "Medium", "High", "Urgent"];
export const AVAILABILITIES: Availability[] = ["Available", "Busy", "Unavailable", "On Leave"];
export const OP_STATUSES: OperationalStatus[] = ["Running", "Stopped", "Under Maintenance", "Unknown"];
export const FAULT_STATUSES: FaultStatus[] = ["Open", "Acknowledged", "Under Maintenance", "Resolved"];

export const SKILLS = [
  "Alternator & Electrical", "Engine Mechanical", "Cooling System", "Fuel System",
  "Lubrication", "Turbocharger & Exhaust", "Controls & Instrumentation",
];

/** Class names come from the proposal (Table 2). Final classes must be reconciled with the real dataset. */
export const FAULT_CATALOG: Record<string, { subsystem: Subsystem; severity: Severity; skills: string[]; action: string }> = {
  "Healthy Operation": { subsystem: "Alternator", severity: "Normal", skills: [], action: "No action required." },
  "Bearing Fault": { subsystem: "Alternator", severity: "High", skills: ["Alternator & Electrical", "Engine Mechanical"], action: "Inspect alternator bearings, check shaft alignment and lubrication; replace bearings if worn." },
  "Rotor Bar Fault": { subsystem: "Alternator", severity: "Critical", skills: ["Alternator & Electrical"], action: "Reduce load and schedule urgent rotor inspection; verify with current-signature re-test." },
  "Normal Operation": { subsystem: "Engine", severity: "Normal", skills: [], action: "No action required." },
  "Fuel-System Fault": { subsystem: "Engine", severity: "Warning", skills: ["Fuel System"], action: "Check fuel filters, injectors and supply pressure." },
  "Cooling-System Degradation": { subsystem: "Engine", severity: "High", skills: ["Cooling System"], action: "Inspect radiator, thermostat, coolant level and water pump." },
  "Exhaust Valve Leakage": { subsystem: "Engine", severity: "High", skills: ["Turbocharger & Exhaust", "Engine Mechanical"], action: "Perform compression test and inspect exhaust valves and seats." },
  "Mechanical Bearing Wear": { subsystem: "Engine", severity: "High", skills: ["Engine Mechanical"], action: "Inspect main/big-end bearings; check oil analysis and vibration source." },
  "Lubrication Breakdown": { subsystem: "Engine", severity: "Critical", skills: ["Lubrication", "Engine Mechanical"], action: "Stop unit if safe; inspect oil pump, pressure and oil quality before restart." },
  "Turbocharger Intake Restriction": { subsystem: "Engine", severity: "Warning", skills: ["Turbocharger & Exhaust"], action: "Inspect air filter and turbocharger intake path for restriction." },
  "Combined Severe Fault": { subsystem: "Engine", severity: "Critical", skills: ["Engine Mechanical", "Cooling System", "Lubrication"], action: "Immediate shutdown and full inspection by a multi-skilled team." },
};

/** PLACEHOLDER channels (requirements §8.3: do not treat as final). Replace with the real dataset schema later. */
export const READING_META: Record<string, { label: string; unit: string; subsystem: Subsystem; normal: number }> = {
  rpm: { label: "Engine speed", unit: "rpm", subsystem: "Engine", normal: 1500 },
  loadPct: { label: "Load", unit: "%", subsystem: "Engine", normal: 65 },
  oilPressureBar: { label: "Oil pressure", unit: "bar", subsystem: "Engine", normal: 4.2 },
  oilTempC: { label: "Oil temperature", unit: "°C", subsystem: "Engine", normal: 88 },
  coolantTempC: { label: "Coolant temperature", unit: "°C", subsystem: "Engine", normal: 82 },
  exhaustTempC: { label: "Exhaust gas temperature", unit: "°C", subsystem: "Engine", normal: 420 },
  fuelRateLph: { label: "Fuel consumption", unit: "L/h", subsystem: "Engine", normal: 38 },
  vibrationMmS: { label: "Vibration (RMS)", unit: "mm/s", subsystem: "Engine", normal: 3.1 },
  ambientTempC: { label: "Ambient temperature", unit: "°C", subsystem: "Engine", normal: 32 },
  thdPct: { label: "Current THD", unit: "%", subsystem: "Alternator", normal: 2.1 },
  crestFactor: { label: "Crest factor", unit: "", subsystem: "Alternator", normal: 1.41 },
  sidebandRatio: { label: "Sideband power ratio", unit: "", subsystem: "Alternator", normal: 0.04 },
};

/** How each fault class shifts the mock readings (for the simulated diagnostic). */
export const PERTURB: Record<string, Record<string, number>> = {
  "Fuel-System Fault": { fuelRateLph: 9, rpm: -40, exhaustTempC: 35 },
  "Cooling-System Degradation": { coolantTempC: 22, oilTempC: 18, exhaustTempC: 45 },
  "Exhaust Valve Leakage": { exhaustTempC: 70, loadPct: -5, fuelRateLph: 4 },
  "Mechanical Bearing Wear": { vibrationMmS: 4.5, oilTempC: 10 },
  "Lubrication Breakdown": { oilPressureBar: -1.8, oilTempC: 25, vibrationMmS: 3 },
  "Turbocharger Intake Restriction": { exhaustTempC: 50, rpm: -25 },
  "Combined Severe Fault": { oilPressureBar: -2.1, coolantTempC: 25, vibrationMmS: 5, exhaustTempC: 90, oilTempC: 28 },
  "Bearing Fault": { thdPct: 2.2, crestFactor: 0.25 },
  "Rotor Bar Fault": { thdPct: 3.8, sidebandRatio: 0.12, crestFactor: 0.3 },
};