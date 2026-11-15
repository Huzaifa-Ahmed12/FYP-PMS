import { FAULT_CATALOG, GENERATOR_MODEL } from "./config";
import { buildReadings } from "./services";
import type { Assignment, DiagnosticRecord, Fault, GeneratorAsset, HistoryEvent, Notification, Part, PartRequest, Subsystem, Technician, TimelineEntry, WorkOrder, HistoryType, Severity, TaskStatus } from "./types";

export function makeSeed() {
  const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
  const ahead = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
  let n = 0; const id = () => `s${++n}`;

  const gen = (gid: string, site: string, address: string, lat: number, lng: number, kva: number, health: Severity, cls: string, sub: Subsystem, hrs: number, extra: Partial<GeneratorAsset> = {}): GeneratorAsset => ({
    id: gid, model: GENERATOR_MODEL, serialNumber: `SN-${gid.slice(3)}`, ratedCapacityKva: kva, siteName: site, address, lat, lng,
    installDate: "2023-03-14", operationalStatus: "Running", health, active: true, notes: "",
    lastDiagnosticAt: ago(hrs), latestReadings: { ...buildReadings("Normal Operation"), ...buildReadings(cls, false, sub), ...(sub === "Alternator" ? buildReadings("Cooling-System Degradation", false, "Engine") : {}) }, ...extra,
  });

  // Three same-model units are seeded for a richer demo. If the supervisor approves ONE unit, deactivate the other two on the Generators page.
  const generators: GeneratorAsset[] = [
    gen("DG-10189", "Bahria University – Main Campus", "E-8, Islamabad", 33.7215, 73.0433, 500, "Critical", "Rotor Bar Fault", "Alternator", 2, { notes: "Primary campus backup unit." }),
    gen("DG-10190", "City Hospital – Rawalpindi", "Saddar, Rawalpindi", 33.5984, 73.0441, 500, "Warning", "Fuel-System Fault", "Engine", 5),
    gen("DG-10191", "Data Center – Blue Area", "Blue Area, Islamabad", 33.71, 73.06, 500, "Warning", "Turbocharger Intake Restriction", "Engine", 8),
  ];

  const tech = (tid: string, name: string, skills: string[], exp: number, av: Technician["availability"], loc: string, lat: number, lng: number, certs: string[] = []): Technician =>
    ({ id: tid, name, phone: "+92 300 " + (1000000 + n++ * 1371).toString().slice(0, 7), email: `${name.split(" ")[0].toLowerCase()}@dgpdm.pk`, skills, certifications: certs, experienceYears: exp, availability: av, maxConcurrent: 3, baseLocation: loc, lat, lng, active: true });
  const technicians: Technician[] = [
    tech("t1", "Usman Tariq", ["Engine Mechanical", "Lubrication", "Cooling System"], 9, "Available", "Saddar, Rawalpindi", 33.5973, 73.0479, ["Diesel Engine Service Level 3"]),
    tech("t2", "Bilal Ahmed", ["Alternator & Electrical", "Controls & Instrumentation"], 6, "Available", "G-9, Islamabad", 33.69, 73.03, ["Electrical Technician (NAVTTC)"]),
    tech("t3", "Sana Malik", ["Fuel System", "Turbocharger & Exhaust", "Engine Mechanical"], 4, "Busy", "I-9, Islamabad", 33.66, 73.06),
    tech("t4", "Imran Qureshi", ["Cooling System", "Lubrication"], 12, "Available", "Chaklala, Rawalpindi", 33.614, 73.098),
    tech("t5", "Hamza Sheikh", ["Alternator & Electrical", "Engine Mechanical"], 3, "On Leave", "Satellite Town, Rawalpindi", 33.637, 73.062),
    tech("t6", "Faisal Mehmood", ["Turbocharger & Exhaust", "Fuel System", "Controls & Instrumentation"], 7, "Available", "Bahria Town Ph-4, Rawalpindi", 33.523, 73.121),
  ];

  const part = (pid: string, name: string, code: string, component: string, quantity: number, minStock: number, unit: string, location: string): Part => ({ id: pid, name, code, component, quantity, minStock, unit, location, notes: "" });
  const parts: Part[] = [
    part("P-01", "Oil Pump Assembly", "OP-220", "Lubrication", 4, 2, "pcs", "Store A / Rack 1"),
    part("P-02", "Oil Filter", "OF-118", "Lubrication", 12, 5, "pcs", "Store A / Rack 2"),
    part("P-03", "Thermostat Valve", "TV-045", "Cooling System", 3, 2, "pcs", "Store A / Rack 3"),
    part("P-04", "Engine Coolant", "CL-5L", "Cooling System", 40, 20, "L", "Store B / Drum area"),
    part("P-05", "Fuel Injector", "FI-310", "Fuel System", 6, 4, "pcs", "Store A / Rack 4"),
    part("P-06", "Fuel Filter", "FF-077", "Fuel System", 2, 4, "pcs", "Store A / Rack 4"),
    part("P-07", "Alternator Bearing Set", "AB-902", "Alternator", 2, 2, "set", "Store C / Rack 1"),
    part("P-08", "Turbo Gasket Kit", "TG-150", "Turbocharger", 3, 2, "kit", "Store C / Rack 2"),
    part("P-09", "Rotor Inspection Kit", "RK-001", "Alternator", 1, 1, "kit", "Store C / Rack 3"),
  ];

  const dx = (num: number, assetId: string, h: number, subsystem: Subsystem, cls: string, conf: number): DiagnosticRecord => ({
    id: `DX-${num}`, assetId, timestamp: ago(h), subsystem, predictedClass: cls, confidence: conf, severity: FAULT_CATALOG[cls].severity,
    dataSource: "SIMULATION", modelName: subsystem === "Alternator" ? "RandomForest-MCSA (mock)" : "LightGBM-Engine (mock)", modelVersion: "0.1-mock",
    validation: "Valid", inputSummary: buildReadings(cls, false, subsystem),
  });
  const diagnostics: DiagnosticRecord[] = [
    dx(2001, "DG-10189", 2, "Alternator", "Rotor Bar Fault", 0.91), dx(2002, "DG-10189", 3, "Engine", "Cooling-System Degradation", 0.87),
    dx(2003, "DG-10189", 30, "Engine", "Normal Operation", 0.95), dx(2004, "DG-10190", 5, "Engine", "Fuel-System Fault", 0.78),
    dx(2005, "DG-10190", 28, "Alternator", "Healthy Operation", 0.97), dx(2006, "DG-10191", 8, "Engine", "Turbocharger Intake Restriction", 0.74),
    dx(2007, "DG-10191", 52, "Engine", "Normal Operation", 0.93), dx(2008, "DG-10189", 400, "Engine", "Lubrication Breakdown", 0.89),
    dx(2009, "DG-10190", 80, "Alternator", "Healthy Operation", 0.96),
  ];

  const flt = (fid: string, assetId: string, type: string, status: Fault["status"], h: number, source: Fault["source"], by: string, desc: string, extra: Partial<Fault> = {}): Fault => ({
    id: fid, assetId, faultType: type, subsystem: FAULT_CATALOG[type].subsystem, severity: FAULT_CATALOG[type].severity, source, status, reportedAt: ago(h), reportedBy: by, description: desc,
    audit: [{ id: id(), at: ago(h), by, action: source === "ML Diagnostic" ? "Fault created from diagnostic" : "Manual fault report submitted" }], ...extra,
  });
  const faults: Fault[] = [
    flt("F-1003", "DG-10189", "Rotor Bar Fault", "Open", 2, "ML Diagnostic", "RandomForest-MCSA (mock)", FAULT_CATALOG["Rotor Bar Fault"].action, { diagnosticId: "DX-2001" }),
    flt("F-1001", "DG-10189", "Cooling-System Degradation", "Under Maintenance", 3, "ML Diagnostic", "LightGBM-Engine (mock)", FAULT_CATALOG["Cooling-System Degradation"].action, { diagnosticId: "DX-2002", workOrderId: "WO-1001" }),
    flt("F-1002", "DG-10190", "Fuel-System Fault", "Open", 5, "ML Diagnostic", "LightGBM-Engine (mock)", FAULT_CATALOG["Fuel-System Fault"].action, { diagnosticId: "DX-2004", workOrderId: "WO-1002" }),
    flt("F-1004", "DG-10191", "Turbocharger Intake Restriction", "Acknowledged", 8, "ML Diagnostic", "LightGBM-Engine (mock)", FAULT_CATALOG["Turbocharger Intake Restriction"].action, { diagnosticId: "DX-2006", workOrderId: "WO-1004" }),
    flt("F-1005", "DG-10191", "Mechanical Bearing Wear", "Open", 6, "Manual Report", "Faisal Mehmood", "Unusual vibration and knocking noise noticed during site walk-through."),
    flt("F-1000", "DG-10189", "Lubrication Breakdown", "Resolved", 410, "ML Diagnostic", "LightGBM-Engine (mock)", FAULT_CATALOG["Lubrication Breakdown"].action, { diagnosticId: "DX-2008", workOrderId: "WO-1003" }),
  ];

  const tl = (h: number, by: string, text: string, status?: TaskStatus): TimelineEntry => ({ id: id(), at: ago(h), by, text, status });
  const wo = (wid: string, assetId: string, faultId: string, title: string, sev: Severity, priority: WorkOrder["priority"], status: TaskStatus, assignedTo: string | undefined, skills: string[], due: string, h: number, timeline: TimelineEntry[], extra: Partial<WorkOrder> = {}): WorkOrder => ({
    id: wid, assetId, faultId, title, description: FAULT_CATALOG[faults.find((f) => f.id === faultId)!.faultType].action, severity: sev, priority, status, assignedTo,
    requiredSkills: skills, dueDate: due, createdAt: ago(h), notes: "", allocations: [], usedParts: [], timeline, ...extra,
  });
  const workOrders: WorkOrder[] = [
    wo("WO-1001", "DG-10189", "F-1001", "Cooling-system degradation – inspect radiator & thermostat", "High", "High", "In Progress", "t4", ["Cooling System"], ahead(1), 3,
      [tl(3, "Ahsan Raza", "Work order created", "Pending Assignment"), tl(2.8, "Ahsan Raza", "Assigned to Imran Qureshi", "Assigned"), tl(2.5, "Imran Qureshi", "Accepted task", "Accepted"), tl(1.5, "Imran Qureshi", "Work started on site", "In Progress")],
      { allocations: [{ partId: "P-03", qty: 1 }, { partId: "P-04", qty: 10 }] }),
    wo("WO-1002", "DG-10190", "F-1002", "Fuel-system fault – check injectors & filters", "Warning", "Medium", "Pending Assignment", undefined, ["Fuel System"], ahead(3), 5,
      [tl(5, "Ahsan Raza", "Work order created", "Pending Assignment")]),
    wo("WO-1003", "DG-10189", "F-1000", "Lubrication breakdown – oil pump service", "Critical", "Urgent", "Completed", "t1", ["Lubrication", "Engine Mechanical"], ahead(-16), 410,
      [tl(410, "Ahsan Raza", "Work order created", "Pending Assignment"), tl(409, "Ahsan Raza", "Assigned to Usman Tariq", "Assigned"), tl(398, "Usman Tariq", "Completed – oil pump replaced", "Completed")],
      { completedAt: ago(398), usedParts: [{ partId: "P-01", qty: 1 }, { partId: "P-02", qty: 2 }], allocations: [{ partId: "P-01", qty: 1 }, { partId: "P-02", qty: 2 }], workSummary: "Oil pump replaced, filter changed, pressure restored to 4.1 bar under load." }),
    wo("WO-1004", "DG-10191", "F-1004", "Turbocharger intake restriction – clean & inspect", "Warning", "Medium", "Assigned", "t3", ["Turbocharger & Exhaust"], ahead(2), 8,
      [tl(8, "Ahsan Raza", "Work order created", "Pending Assignment"), tl(7.5, "Ahsan Raza", "Assigned to Sana Malik", "Assigned")]),
  ];

  const pr = (rid: string, woId: string, partId: string, techId: string, qty: number, reason: string, status: PartRequest["status"], h: number, extra: Partial<PartRequest> = {}): PartRequest =>
    ({ id: rid, workOrderId: woId, partId, technicianId: techId, qty, reason, status, requestedAt: ago(h), ...extra });
  const partRequests: PartRequest[] = [
    pr("PR-1", "WO-1001", "P-04", "t4", 10, "Coolant flush needs additional volume.", "Pending", 1.2),
    pr("PR-2", "WO-1004", "P-08", "t3", 1, "Intake gasket damaged on inspection.", "Pending", 4),
    pr("PR-3", "WO-1003", "P-02", "t1", 2, "Replace filters with the oil pump.", "Fulfilled", 405, { approvedQty: 2, decidedAt: ago(404) }),
    pr("PR-4", "WO-1001", "P-06", "t4", 3, "Spare fuel filters for later.", "Rejected", 2, { approvedQty: 0, decisionNote: "Low stock – not related to this fault.", decidedAt: ago(1.8) }),
  ];

  const nt = (type: Notification["type"], title: string, message: string, h: number, read: boolean, severity?: Severity, link?: string): Notification => ({ id: id(), type, title, message, severity, at: ago(h), read, link });
  const notifications: Notification[] = [
    nt("fault", "Critical fault detected", "DG-10189: Rotor Bar Fault (alternator)", 2, false, "Critical", "/manager/faults"),
    nt("part_request", "New part request", "Imran Qureshi requested 10 L Engine Coolant for WO-1001", 1.2, false, undefined, "/manager/part-requests"),
    nt("progress", "Task in progress", "WO-1001 work started on site", 1.5, false, undefined, "/manager/tasks/WO-1001"),
    nt("fault", "High severity fault", "DG-10189: Cooling-System Degradation", 3, true, "High", "/manager/faults"),
    nt("acceptance", "Technician accepted", "Imran Qureshi accepted WO-1001", 2.5, true, undefined, "/manager/tasks/WO-1001"),
    nt("completion", "Task completed", "WO-1003 completed by Usman Tariq", 398, true, undefined, "/manager/tasks/WO-1003"),
  ];

  const assignments: Assignment[] = [
    { id: "A-1", workOrderId: "WO-1003", assetId: "DG-10189", technicianId: "t1", recommendedId: "t1", score: 84.2, overridden: false, at: ago(409), by: "Ahsan Raza" },
    { id: "A-2", workOrderId: "WO-1001", assetId: "DG-10189", technicianId: "t4", recommendedId: "t4", score: 79.6, overridden: false, at: ago(2.8), by: "Ahsan Raza" },
    { id: "A-3", workOrderId: "WO-1004", assetId: "DG-10191", technicianId: "t3", recommendedId: "t6", score: 71.5, overridden: true, reason: "Sana already familiar with this unit's turbocharger.", at: ago(7.5), by: "Ahsan Raza" },
  ];

  const he = (h: number, type: HistoryType, assetId: string, title: string, detail: string, extra: Partial<HistoryEvent> = {}): HistoryEvent => ({ id: id(), at: ago(h), type, assetId, title, detail, ...extra });
  const history: HistoryEvent[] = [
    he(2, "Diagnostic", "DG-10189", "Rotor Bar Fault predicted", "Alternator · confidence 91%", { subsystem: "Alternator", faultType: "Rotor Bar Fault", severity: "Critical" }),
    he(2, "Fault", "DG-10189", "Fault F-1003 opened", "Rotor Bar Fault (ML Diagnostic)", { subsystem: "Alternator", faultType: "Rotor Bar Fault", severity: "Critical" }),
    he(3, "Diagnostic", "DG-10189", "Cooling-System Degradation predicted", "Engine · confidence 87%", { subsystem: "Engine", faultType: "Cooling-System Degradation", severity: "High" }),
    he(2.8, "Assignment", "DG-10189", "WO-1001 assigned to Imran Qureshi", "Followed recommendation (score 79.6)", { technicianId: "t4", faultType: "Cooling-System Degradation", subsystem: "Engine", severity: "High" }),
    he(1.5, "Task", "DG-10189", "WO-1001 in progress", "Work started on site", { technicianId: "t4", faultType: "Cooling-System Degradation", subsystem: "Engine", severity: "High" }),
    he(7.5, "Assignment", "DG-10191", "WO-1004 assigned to Sana Malik", "Manager override of recommendation", { technicianId: "t3", faultType: "Turbocharger Intake Restriction", subsystem: "Engine", severity: "Warning" }),
    he(398, "Task", "DG-10189", "WO-1003 completed", "Oil pump replaced; fault F-1000 resolved", { technicianId: "t1", faultType: "Lubrication Breakdown", subsystem: "Engine", severity: "Critical" }),
    he(404, "Parts", "DG-10189", "Parts used on WO-1003", "1 × Oil Pump Assembly, 2 × Oil Filter", { technicianId: "t1", faultType: "Lubrication Breakdown", subsystem: "Engine", severity: "Critical" }),
    he(410, "Fault", "DG-10189", "Fault F-1000 opened", "Lubrication Breakdown (ML Diagnostic)", { subsystem: "Engine", faultType: "Lubrication Breakdown", severity: "Critical" }),
  ];

  return { generators, technicians, diagnostics, faults, workOrders, parts, partRequests, notifications, assignments, history };
}