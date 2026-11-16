import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ALLOW_DECLINE, FAULT_CATALOG, READING_META, SEV_RANK, TECH_DEFAULT_PASSWORD } from "./config";
import { makeSeed } from "./mock-data";
import { availableQty, reservedQty } from "./services";
import type { Assignment, DiagnosticRecord, Fault, GeneratorAsset, HistoryEvent, NewWorkOrder, Notification, OperationalStatus, Part, PartAllocation, PartRequest, Severity, Subsystem, TaskStatus, Technician, User, WorkOrder, FaultStatus, HistoryType, Inspection, NewInspection, TaskOutcome } from "./types";

const uid = () => Math.random().toString(36).slice(2, 9);
const nowIso = () => new Date().toISOString();

const USERS = [
  { id: "u-mgr", name: "Ahsan Raza", email: "manager@dgpdm.pk", password: "manager123", role: "manager" as const },
];

const withHealth = (gens: GeneratorAsset[], faults: Fault[]) =>
  gens.map((g) => {
    const health = faults.filter((f) => f.assetId === g.id && f.status !== "Resolved")
      .reduce<Severity>((a, f) => (SEV_RANK[f.severity] > SEV_RANK[a] ? f.severity : a), "Normal");
    return { ...g, health };
  });

const upsertAlloc = (list: PartAllocation[], partId: string, qty: number) =>
  list.some((a) => a.partId === partId) ? list.map((a) => (a.partId === partId ? { ...a, qty: a.qty + qty } : a)) : [...list, { partId, qty }];

type Data = ReturnType<typeof makeSeed>;
interface Actions {
  login: (email: string, password: string) => User | null;
  logout: () => void;
  saveGenerator: (g: GeneratorAsset) => void;
  toggleGenerator: (id: string) => void;
  saveTechnician: (t: Technician) => void;
  toggleTechnician: (id: string) => void;
  recordDiagnostic: (d: Omit<DiagnosticRecord, "id">) => { diagnostic: DiagnosticRecord; fault?: Fault };
  reportManualFault: (i: { assetId: string; faultType: string; description: string }) => string;
  setFaultStatus: (id: string, status: FaultStatus, note?: string) => void;
  createWorkOrder: (i: NewWorkOrder) => string;
  assignWorkOrder: (woId: string, techId: string, meta: { recommendedId?: string; score?: number; overrideReason?: string }) => void;
  setTaskStatus: (id: string, status: TaskStatus, note: string) => void;
  addTaskNote: (id: string, text: string) => void;
  allocatePart: (woId: string, partId: string, qty: number) => string | null;
  savePart: (p: Part) => void;
  decidePartRequest: (id: string, status: "Approved" | "Partially Approved" | "Rejected", approvedQty: number, note: string) => string | null;
  markRead: (id: string) => void;
  markAllRead: () => void;
  simulateTechnician: (woId: string, action: "accept" | "start" | "hold" | "complete") => void;
  resetDemo: () => void;

  /* ----- Technician module (all return an error message, or null on success) ----- */
  acceptTask: (woId: string) => string | null;
  declineTask: (woId: string, reason: string) => string | null;
  startWork: (woId: string) => string | null;
  holdTask: (woId: string, reason: string) => string | null;
  resumeTask: (woId: string) => string | null;
  addProgressNote: (woId: string, i: { text: string; diagnosis: "Not assessed" | "Confirmed" | "Changed"; newFaultType?: string; readings?: Record<string, number> }) => string | null;
  recordPartUsage: (woId: string, partId: string, qty: number) => string | null;
  removePartUsage: (woId: string, partId: string) => void;
  submitPartRequest: (i: { workOrderId: string; partId: string; qty: number; reason: string }) => string | null;
  submitInspection: (i: NewInspection) => string;
  completeTask: (woId: string, i: { summary: string; outcome: TaskOutcome; recommendations: string }) => string | null;
  markTechRead: (id: string) => void;
  markAllTechRead: (recipientId: string) => void;
}
type State = { user: User | null } & Data & Actions;

export const useStore = create<State>()(
  persist(
    (set, get) => {
      const me = () => get().user?.name ?? "System";
      const hist = (type: HistoryType, assetId: string, title: string, detail: string, extra: Partial<HistoryEvent> = {}): HistoryEvent => ({ id: uid(), at: nowIso(), type, assetId, title, detail, ...extra });
      const note = (type: Notification["type"], title: string, message: string, severity?: Severity, link?: string): Notification => ({ id: uid(), at: nowIso(), read: false, type, title, message, severity, link });
      const tl = (text: string, status?: TaskStatus) => ({ id: uid(), at: nowIso(), by: me(), text, status });
      const patchWo = (id: string, fn: (w: WorkOrder) => WorkOrder) => (s: State) => ({ workOrders: s.workOrders.map((w) => (w.id === id ? fn(w) : w)) });
      /** notification addressed to ONE technician (the manager's own `notifications` list is never touched by this) */
      const tnote = (recipientId: string, type: Notification["type"], title: string, message: string, link?: string): Notification => ({ id: uid(), at: nowIso(), read: false, type, title, message, link, recipientId });
      /** notify whoever is assigned to a work order (used by manager-side actions) */
      const notifyAssignee = (s: State, woId: string, title: string, message: string) => {
        const w = s.workOrders.find((x) => x.id === woId);
        return w?.assignedTo ? [tnote(w.assignedTo, "progress", title, `${woId}: ${message}`, `/technician/tasks/${woId}`), ...s.techNotifications] : s.techNotifications;
      };
      /** technician may only act on their OWN task and only from the allowed statuses */
      const own = (woId: string, from: TaskStatus[]): WorkOrder | string => {
        const s = get(); const w = s.workOrders.find((x) => x.id === woId);
        if (!w) return "Work order not found";
        if (w.assignedTo !== s.user?.id) return "This task is not assigned to you";
        if (!from.includes(w.status)) return `Not allowed while the task is "${w.status}"`;
        return w;
      };
      /** one status transition done by the technician: timeline + fault + generator + manager notification + history */
      const step = (w: WorkOrder, status: TaskStatus, text: string, kind: "acceptance" | "progress", o: { fault?: FaultStatus; op?: OperationalStatus } = {}) => set((st) => {
        const faults = o.fault && w.faultId ? st.faults.map((f) => (f.id === w.faultId ? { ...f, status: o.fault as FaultStatus, audit: [...f.audit, { id: uid(), at: nowIso(), by: me(), action: text }] } : f)) : st.faults;
        const gens = o.op ? st.generators.map((g) => (g.id === w.assetId ? { ...g, operationalStatus: o.op as OperationalStatus } : g)) : st.generators;
        return {
          workOrders: st.workOrders.map((x) => (x.id === w.id ? { ...x, status, timeline: [...x.timeline, tl(text, status)] } : x)),
          faults, generators: withHealth(gens, faults),
          notifications: [note(kind, `Task ${status.toLowerCase()}`, `${w.id}: ${me()} – ${text}`, undefined, `/manager/tasks/${w.id}`), ...st.notifications],
          history: [hist("Task", w.assetId, `${w.id} → ${status}`, text, { technicianId: w.assignedTo, severity: w.severity }), ...st.history],
        };
      });

      return {
        user: null,
        ...makeSeed(),

        login: (email, password) => {
          const e = email.trim().toLowerCase();
          const u = USERS.find((x) => x.email === e && x.password === password);
          if (u) { const user = { id: u.id, name: u.name, email: u.email, role: u.role }; set({ user }); return user; }
          // Technician accounts come from the technician records the manager maintains (deactivated technicians cannot sign in).
          const t = get().technicians.find((x) => x.active && password === TECH_DEFAULT_PASSWORD && (x.email.toLowerCase() === e || (x.id === "t1" && e === "tech@dgpdm.pk")));
          if (!t) return null;
          const user = { id: t.id, name: t.name, email: t.email, role: "technician" as const };
          set({ user });
          return user;
        },
        logout: () => set({ user: null }),

        saveGenerator: (g) => set((s) => {
          const exists = s.generators.some((x) => x.id === g.id);
          return { generators: exists ? s.generators.map((x) => (x.id === g.id ? g : x)) : [g, ...s.generators], history: [hist("Generator", g.id, exists ? "Asset updated" : "Asset registered", `${g.id} at ${g.siteName}`), ...s.history] };
        }),
        toggleGenerator: (id) => set((s) => ({ generators: s.generators.map((g) => (g.id === id ? { ...g, active: !g.active } : g)) })),

        saveTechnician: (t) => set((s) => ({ technicians: s.technicians.some((x) => x.id === t.id) ? s.technicians.map((x) => (x.id === t.id ? t : x)) : [t, ...s.technicians] })),
        toggleTechnician: (id) => set((s) => ({ technicians: s.technicians.map((t) => (t.id === id ? { ...t, active: !t.active } : t)) })),

        recordDiagnostic: (d) => {
          const s = get();
          const diagnostic: DiagnosticRecord = { ...d, id: `DX-${2001 + s.diagnostics.length}` };
          const fault: Fault | undefined = d.severity !== "Normal" ? {
            id: `F-${1001 + s.faults.length}`, assetId: d.assetId, faultType: d.predictedClass, subsystem: d.subsystem, severity: d.severity,
            source: "ML Diagnostic", status: "Open", reportedAt: d.timestamp, reportedBy: d.modelName,
            description: FAULT_CATALOG[d.predictedClass]?.action ?? "", diagnosticId: diagnostic.id,
            audit: [{ id: uid(), at: nowIso(), by: d.modelName, action: "Fault created from diagnostic" }],
          } : undefined;
          set((st) => {
            const faults = fault ? [fault, ...st.faults] : st.faults;
            const gens = st.generators.map((g) => g.id === d.assetId ? { ...g, lastDiagnosticAt: d.timestamp, latestReadings: { ...g.latestReadings, ...d.inputSummary } } : g);
            return {
              diagnostics: [diagnostic, ...st.diagnostics], faults, generators: withHealth(gens, faults),
              notifications: fault ? [note("fault", `${fault.severity} fault detected`, `${d.assetId}: ${d.predictedClass}`, fault.severity, "/manager/faults"), ...st.notifications] : st.notifications,
              history: [hist("Diagnostic", d.assetId, `${d.predictedClass} predicted`, `${d.subsystem} · confidence ${Math.round(d.confidence * 100)}%`, { subsystem: d.subsystem, faultType: d.predictedClass, severity: d.severity }), ...st.history],
            };
          });
          return { diagnostic, fault };
        },

        reportManualFault: ({ assetId, faultType, description }) => {
          const s = get(); const cat = FAULT_CATALOG[faultType]; const fid = `F-${1001 + s.faults.length}`;
          const fault: Fault = { id: fid, assetId, faultType, subsystem: cat.subsystem, severity: cat.severity, source: "Manual Report", status: "Open", reportedAt: nowIso(), reportedBy: me(), description, audit: [{ id: uid(), at: nowIso(), by: me(), action: "Manual fault report submitted" }] };
          set((st) => {
            const faults = [fault, ...st.faults];
            return { faults, generators: withHealth(st.generators, faults), notifications: [note("fault", `${cat.severity} fault reported`, `${assetId}: ${faultType} (manual)`, cat.severity, "/manager/faults"), ...st.notifications], history: [hist("Fault", assetId, `Fault ${fid} opened`, `${faultType} (Manual Report)`, { subsystem: cat.subsystem, faultType, severity: cat.severity }), ...st.history] };
          });
          return fid;
        },

        setFaultStatus: (id, status, n) => set((s) => {
          const faults = s.faults.map((f) => f.id === id ? { ...f, status, audit: [...f.audit, { id: uid(), at: nowIso(), by: me(), action: `Status → ${status}${n ? ` (${n})` : ""}` }] } : f);
          const f = faults.find((x) => x.id === id)!;
          return { faults, generators: withHealth(s.generators, faults), history: [hist("Fault", f.assetId, `Fault ${id} → ${status}`, f.faultType, { subsystem: f.subsystem, faultType: f.faultType, severity: f.severity }), ...s.history] };
        }),

        createWorkOrder: (i) => {
          const s = get(); const wid = `WO-${1001 + s.workOrders.length}`;
          const wo: WorkOrder = { ...i, id: wid, status: "Pending Assignment", createdAt: nowIso(), allocations: [], usedParts: [], timeline: [tl("Work order created", "Pending Assignment")] };
          set((st) => ({
            workOrders: [wo, ...st.workOrders],
            faults: st.faults.map((f) => (f.id === i.faultId ? { ...f, workOrderId: wid, status: f.status === "Open" ? "Acknowledged" : f.status, audit: [...f.audit, { id: uid(), at: nowIso(), by: me(), action: `Work order ${wid} created` }] } : f)),
            history: [hist("Task", i.assetId, `${wid} created`, i.title, { severity: i.severity }), ...st.history],
          }));
          return wid;
        },

        assignWorkOrder: (woId, techId, meta) => {
          const s = get(); const wo = s.workOrders.find((w) => w.id === woId)!; const t = s.technicians.find((x) => x.id === techId)!;
          const overridden = !!meta.recommendedId && meta.recommendedId !== techId;
          const a: Assignment = { id: `A-${1 + s.assignments.length}`, workOrderId: woId, assetId: wo.assetId, technicianId: techId, recommendedId: meta.recommendedId, score: meta.score, overridden, reason: meta.overrideReason, at: nowIso(), by: me() };
          set((st) => ({
            workOrders: st.workOrders.map((w) => w.id === woId ? { ...w, assignedTo: techId, status: "Assigned", timeline: [...w.timeline, tl(`Assigned to ${t.name}${overridden ? " (manager override)" : ""}`, "Assigned")] } : w),
            assignments: [a, ...st.assignments],
            notifications: [note("assignment", "Work order dispatched", `${woId} assigned to ${t.name}`, undefined, `/manager/tasks/${woId}`), ...st.notifications],
            techNotifications: [tnote(techId, "assignment", "New work order assigned", `${woId} · ${wo.title} (${wo.assetId})`, `/technician/tasks/${woId}`), ...st.techNotifications],
            history: [hist("Assignment", wo.assetId, `${woId} assigned to ${t.name}`, overridden ? "Manager override of recommendation" : `Followed recommendation (score ${meta.score ?? "–"})`, { technicianId: techId, severity: wo.severity }), ...st.history],
          }));
        },

        setTaskStatus: (id, status, n) => set((s) => ({
          ...patchWo(id, (w) => ({ ...w, status, timeline: [...w.timeline, tl(n, status)] }))(s),
          history: [hist("Task", s.workOrders.find((w) => w.id === id)!.assetId, `${id} → ${status}`, n), ...s.history],
          techNotifications: notifyAssignee(s, id, `Task ${status.toLowerCase()}`, n),
        })),
        addTaskNote: (id, text) => set((s) => ({ ...patchWo(id, (w) => ({ ...w, timeline: [...w.timeline, tl(`Manager note: ${text}`)] }))(s), techNotifications: notifyAssignee(s, id, "Message from manager", text) })),

        allocatePart: (woId, partId, qty) => {
          const s = get(); const p = s.parts.find((x) => x.id === partId);
          if (!p) return "Part not found";
          if (!Number.isFinite(qty) || qty < 1) return "Quantity must be at least 1";
          const avail = availableQty(p, s.workOrders);
          if (qty > avail) return `Only ${avail} ${p.unit} available`;
          set((st) => ({
            ...patchWo(woId, (w) => ({ ...w, allocations: upsertAlloc(w.allocations, partId, qty), timeline: [...w.timeline, tl(`Allocated ${qty} ${p.unit} × ${p.name}`)] }))(st),
            history: [hist("Parts", st.workOrders.find((w) => w.id === woId)!.assetId, `Parts allocated to ${woId}`, `${qty} × ${p.name}`), ...st.history],
          }));
          return null;
        },
        savePart: (p) => set((s) => ({ parts: s.parts.some((x) => x.id === p.id) ? s.parts.map((x) => (x.id === p.id ? p : x)) : [p, ...s.parts] })),

        decidePartRequest: (id, status, approvedQty, n) => {
          const req = get().partRequests.find((r) => r.id === id)!;
          if (status !== "Rejected") { const err = get().allocatePart(req.workOrderId, req.partId, approvedQty); if (err) return err; }
          set((s) => ({
            partRequests: s.partRequests.map((r) => r.id === id ? { ...r, status, approvedQty: status === "Rejected" ? 0 : approvedQty, decisionNote: n, decidedAt: nowIso() } : r),
            notifications: [note("part_request", `Part request ${status.toLowerCase()}`, `${id} for ${req.workOrderId}`, undefined, "/manager/part-requests"), ...s.notifications],
            techNotifications: [tnote(req.technicianId, "part_request", `Part request ${status.toLowerCase()}`, `${id}${status === "Rejected" ? "" : ` – ${approvedQty} approved`}${n ? `: ${n}` : ""}`, "/technician/part-requests"), ...s.techNotifications],
          }));
          return null;
        },

        markRead: (id) => set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
        markAllRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),

        /** Demo only – stands in for the technician module until it is built. */
        simulateTechnician: (woId, action) => {
          const s = get(); const wo = s.workOrders.find((w) => w.id === woId)!; const tName = s.technicians.find((t) => t.id === wo.assignedTo)?.name ?? "Technician";
          const map = { accept: "Accepted", start: "In Progress", hold: "On Hold", complete: "Completed" } as const;
          const status: TaskStatus = map[action];
          const text = { accept: "Accepted task", start: "Work started on site", hold: "Placed on hold – waiting for parts", complete: "Completed – fault rectified and unit tested" }[action];
          set((st) => {
            const workOrders = st.workOrders.map((w) => w.id !== woId ? w : { ...w, status, timeline: [...w.timeline, { id: uid(), at: nowIso(), by: tName, text, status }], ...(action === "complete" ? { completedAt: nowIso(), usedParts: w.allocations, workSummary: "Fault rectified and unit tested under load (simulated technician report)." } : {}) });
            let faults = st.faults;
            if (action === "start" || action === "complete") faults = faults.map((f) => f.id === wo.faultId ? { ...f, status: action === "start" ? "Under Maintenance" : "Resolved", audit: [...f.audit, { id: uid(), at: nowIso(), by: tName, action: action === "start" ? "Maintenance started" : "Resolved on task completion" }] } : f);
            const opStatus: OperationalStatus | null = action === "start" ? "Under Maintenance" : action === "complete" ? "Running" : null;
            const gens = st.generators.map((g) => (g.id === wo.assetId && opStatus ? { ...g, operationalStatus: opStatus } : g));
            const parts = action === "complete" ? st.parts.map((p) => { const u = wo.allocations.find((a) => a.partId === p.id); return u ? { ...p, quantity: Math.max(0, p.quantity - u.qty) } : p; }) : st.parts;
            const type = action === "accept" ? "acceptance" : action === "complete" ? "completion" : "progress";
            return {
              workOrders, faults, parts, generators: withHealth(gens, faults),
              notifications: [note(type, `Task ${status.toLowerCase()}`, `${woId}: ${tName} – ${text}`, undefined, `/manager/tasks/${woId}`), ...st.notifications],
              history: [hist("Task", wo.assetId, `${woId} → ${status}`, text, { technicianId: wo.assignedTo, severity: wo.severity }), ...st.history],
            };
          });
        },

        /* ===================== TECHNICIAN MODULE ACTIONS ===================== */
        acceptTask: (woId) => {
          const w = own(woId, ["Assigned"]); if (typeof w === "string") return w;
          step(w, "Accepted", "Accepted task", "acceptance"); return null;
        },
        declineTask: (woId, reason) => {
          if (!ALLOW_DECLINE) return "Declining is disabled by the manager workflow";
          const w = own(woId, ["Assigned", "Accepted"]); if (typeof w === "string") return w;
          const why = reason.trim(); if (why.length < 5) return "Give a reason (min 5 characters)";
          const name = me();
          set((st) => ({
            workOrders: st.workOrders.map((x) => (x.id === woId ? { ...x, assignedTo: undefined, status: "Pending Assignment", timeline: [...x.timeline, tl(`Declined by ${name}: ${why}`, "Pending Assignment")] } : x)),
            notifications: [note("assignment", "Assignment declined", `${woId}: ${name} declined – ${why}`, undefined, `/manager/recommendations?wo=${woId}`), ...st.notifications],
            history: [hist("Assignment", w.assetId, `${woId} declined by ${name}`, why, { technicianId: w.assignedTo, severity: w.severity }), ...st.history],
          }));
          return null;
        },
        startWork: (woId) => {
          const w = own(woId, ["Accepted"]); if (typeof w === "string") return w;
          step(w, "In Progress", "Work started on site", "progress", { fault: "Under Maintenance", op: "Under Maintenance" }); return null;
        },
        holdTask: (woId, reason) => {
          const w = own(woId, ["In Progress"]); if (typeof w === "string") return w;
          if (reason.trim().length < 5) return "Give the reason the task is blocked (min 5 characters)";
          step(w, "On Hold", `Placed on hold: ${reason.trim()}`, "progress"); return null;
        },
        resumeTask: (woId) => {
          const w = own(woId, ["On Hold"]); if (typeof w === "string") return w;
          step(w, "In Progress", "Work resumed", "progress"); return null;
        },

        addProgressNote: (woId, i) => {
          const w = own(woId, ["In Progress"]); if (typeof w === "string") return w;
          const text = i.text.trim(); if (text.length < 5) return "Describe the work or observation (min 5 characters)";
          const fault = get().faults.find((f) => f.id === w.faultId);
          const newType = i.diagnosis === "Changed" ? i.newFaultType : undefined;
          if (i.diagnosis === "Changed" && (!newType || !FAULT_CATALOG[newType])) return "Select the corrected fault type";
          const changed = !!fault && !!newType && newType !== fault.faultType;
          const dx = i.diagnosis === "Confirmed" ? " Diagnosis confirmed." : changed ? ` Diagnosis changed: ${fault!.faultType} → ${newType}.` : "";
          const rd = Object.entries(i.readings ?? {}).filter(([, v]) => Number.isFinite(v));
          const rdTxt = rd.length ? ` Readings: ${rd.map(([k, v]) => `${READING_META[k]?.label ?? k} ${v}${READING_META[k]?.unit ? ` ${READING_META[k].unit}` : ""}`).join(", ")}.` : "";
          const cat = changed ? FAULT_CATALOG[newType!] : null;
          set((st) => {
            const faults = changed ? st.faults.map((f) => (f.id === fault!.id ? { ...f, faultType: newType!, subsystem: cat!.subsystem, severity: cat!.severity, audit: [...f.audit, { id: uid(), at: nowIso(), by: me(), action: `Diagnosis changed by technician: ${f.faultType} → ${newType}` }] } : f)) : st.faults;
            return {
              workOrders: st.workOrders.map((x) => (x.id === woId ? { ...x, severity: cat ? cat.severity : x.severity, timeline: [...x.timeline, tl(`${text}${dx}${rdTxt}`)] } : x)),
              faults, generators: withHealth(st.generators, faults),
              notifications: [note("progress", changed ? "Diagnosis changed on site" : "Progress update", `${woId}: ${text}${dx}`, changed ? cat!.severity : undefined, `/manager/tasks/${woId}`), ...st.notifications],
              history: [hist("Task", w.assetId, `${woId} progress update`, `${text}${dx}`, { technicianId: w.assignedTo, severity: cat ? cat.severity : w.severity }), ...st.history],
            };
          });
          return null;
        },

        recordPartUsage: (woId, partId, qty) => {
          const w = own(woId, ["In Progress", "On Hold"]); if (typeof w === "string") return w;
          const s = get(); const p = s.parts.find((x) => x.id === partId); if (!p) return "Part not found";
          if (!Number.isInteger(qty) || qty < 1) return "Quantity must be a whole number of at least 1";
          const others = reservedQty(partId, s.workOrders.filter((x) => x.id !== woId));
          const usedHere = w.usedParts.find((u) => u.partId === partId)?.qty ?? 0;
          const room = p.quantity - others - usedHere;
          if (qty > room) return room > 0 ? `Only ${room} ${p.unit} can still be used – request more from the manager` : `No ${p.name} left to use – request it from the manager`;
          set((st) => ({
            ...patchWo(woId, (x) => ({ ...x, usedParts: upsertAlloc(x.usedParts, partId, qty), timeline: [...x.timeline, tl(`Recorded part usage: ${qty} ${p.unit} × ${p.name}`)] }))(st),
          }));
          return null;
        },
        removePartUsage: (woId, partId) => set((s) => {
          const p = s.parts.find((x) => x.id === partId);
          return patchWo(woId, (x) => ({ ...x, usedParts: x.usedParts.filter((u) => u.partId !== partId), timeline: [...x.timeline, tl(`Removed part usage entry: ${p?.name ?? partId}`)] }))(s);
        }),

        submitPartRequest: ({ workOrderId, partId, qty, reason }) => {
          const w = own(workOrderId, ["Assigned", "Accepted", "In Progress", "On Hold"]); if (typeof w === "string") return w;
          const s = get(); const p = s.parts.find((x) => x.id === partId); if (!p) return "Select a part";
          if (!Number.isInteger(qty) || qty < 1) return "Quantity must be a whole number of at least 1";
          if (reason.trim().length < 5) return "Give a reason for the request (min 5 characters)";
          const rid = `PR-${1 + s.partRequests.length}`;
          const req: PartRequest = { id: rid, workOrderId, partId, technicianId: s.user!.id, qty, reason: reason.trim(), status: "Pending", requestedAt: nowIso() };
          set((st) => ({
            partRequests: [req, ...st.partRequests],
            workOrders: st.workOrders.map((x) => (x.id === workOrderId ? { ...x, timeline: [...x.timeline, tl(`Requested ${qty} ${p.unit} × ${p.name} (${rid})`)] } : x)),
            notifications: [note("part_request", "New part request", `${me()} requested ${qty} ${p.unit} × ${p.name} for ${workOrderId}`, undefined, "/manager/part-requests"), ...st.notifications],
            history: [hist("Parts", w.assetId, `Part requested for ${workOrderId}`, `${qty} × ${p.name}`, { technicianId: w.assignedTo }), ...st.history],
          }));
          return null;
        },

        submitInspection: (i) => {
          const s = get(); const iid = `INS-${1 + s.inspections.length}`;
          const insp: Inspection = { ...i, id: iid, at: nowIso() };
          const flagged = i.checklist.filter((c) => c.state === "Needs attention").length;
          const summary = `Inspection ${iid} submitted – condition ${i.condition}${flagged ? `, ${flagged} item(s) need attention` : ""}`;
          set((st) => ({
            inspections: [insp, ...st.inspections],
            workOrders: i.workOrderId ? st.workOrders.map((x) => (x.id === i.workOrderId ? { ...x, timeline: [...x.timeline, tl(`${summary}. ${i.notes}`)] } : x)) : st.workOrders,
            notifications: [note("progress", "Inspection submitted", `${i.assetId}: condition ${i.condition}${flagged ? `, ${flagged} item(s) need attention` : ""}${i.workOrderId ? ` (${i.workOrderId})` : ""}`, i.condition === "Poor" ? "High" : undefined, i.workOrderId ? `/manager/tasks/${i.workOrderId}` : "/manager/history"), ...st.notifications],
            history: [hist("Generator", i.assetId, `Inspection ${iid}`, `${i.condition} · ${i.notes.slice(0, 80)}`, { technicianId: i.technicianId }), ...st.history],
          }));
          return iid;
        },

        completeTask: (woId, i) => {
          const w = own(woId, ["In Progress"]); if (typeof w === "string") return w;
          if (i.summary.trim().length < 20) return "Work summary must be at least 20 characters";
          const rectified = i.outcome === "Fault rectified";
          const rec = i.recommendations.trim();
          const workSummary = `${i.summary.trim()} · Outcome: ${i.outcome}.${rec ? ` Recommendations: ${rec}` : ""}`;
          const name = me(); const at = nowIso();
          const faultStatus: FaultStatus = rectified ? "Resolved" : "Open";
          const op: OperationalStatus = i.outcome === "Not rectified – follow-up needed" ? "Stopped" : "Running";
          const faultType = get().faults.find((f) => f.id === w.faultId)?.faultType;
          const used = w.usedParts, pn = (pid: string) => get().parts.find((p) => p.id === pid)?.name ?? pid;
          set((st) => {
            const faults = w.faultId ? st.faults.map((f) => (f.id === w.faultId ? { ...f, status: faultStatus, workOrderId: rectified ? f.workOrderId : undefined, audit: [...f.audit, { id: uid(), at, by: name, action: rectified ? "Resolved on task completion" : `Task ${woId} closed – ${i.outcome}; follow-up work order needed` }] } : f)) : st.faults;
            const gens = st.generators.map((g) => (g.id === w.assetId ? { ...g, operationalStatus: op } : g));
            return {
              workOrders: st.workOrders.map((x) => (x.id === woId ? { ...x, status: "Completed", completedAt: at, workSummary, timeline: [...x.timeline, tl(`Completed – ${i.outcome}`, "Completed")] } : x)),
              faults, generators: withHealth(gens, faults),
              parts: st.parts.map((p) => { const u = used.find((x) => x.partId === p.id); return u ? { ...p, quantity: Math.max(0, p.quantity - u.qty) } : p; }),
              partRequests: st.partRequests.map((r) => (r.workOrderId === woId && (r.status === "Approved" || r.status === "Partially Approved") ? { ...r, status: "Fulfilled" } : r)),
              notifications: [note("completion", "Task completed", `${woId}: ${name} – ${i.outcome}`, undefined, `/manager/tasks/${woId}`), ...st.notifications],
              history: [
                hist("Task", w.assetId, `${woId} completed`, `${i.outcome}. ${i.summary.trim().slice(0, 90)}`, { technicianId: w.assignedTo, faultType, severity: w.severity }),
                ...(used.length ? [hist("Parts", w.assetId, `Parts used on ${woId}`, used.map((u) => `${u.qty} × ${pn(u.partId)}`).join(", "), { technicianId: w.assignedTo, faultType, severity: w.severity })] : []),
                ...st.history,
              ],
            };
          });
          return null;
        },

        markTechRead: (id) => set((s) => ({ techNotifications: s.techNotifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
        markAllTechRead: (rid) => set((s) => ({ techNotifications: s.techNotifications.map((n) => (n.recipientId === rid ? { ...n, read: true } : n)) })),

        resetDemo: () => set({ ...makeSeed() }),
      };
    },
    { name: "dg-pdm-manager-store", version: 1 },
  ),
);

export type { Subsystem };