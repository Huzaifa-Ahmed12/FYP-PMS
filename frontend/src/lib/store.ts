import { create } from "zustand";
import { persist } from "zustand/middleware";
import { FAULT_CATALOG, SEV_RANK } from "./config";
import { makeSeed } from "./mock-data";
import { availableQty } from "./services";
import type { Assignment, DiagnosticRecord, Fault, GeneratorAsset, HistoryEvent, NewWorkOrder, Notification, OperationalStatus, Part, PartAllocation, PartRequest, Severity, Subsystem, TaskStatus, Technician, User, WorkOrder, FaultStatus, HistoryType } from "./types";

const uid = () => Math.random().toString(36).slice(2, 9);
const nowIso = () => new Date().toISOString();

const USERS = [
  { id: "u-mgr", name: "Ahsan Raza", email: "manager@dgpdm.pk", password: "manager123", role: "manager" as const },
  { id: "t1", name: "Usman Tariq", email: "tech@dgpdm.pk", password: "tech123", role: "technician" as const },
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

      return {
        user: null,
        ...makeSeed(),

        login: (email, password) => {
          const u = USERS.find((x) => x.email === email && x.password === password);
          if (!u) return null;
          const user = { id: u.id, name: u.name, email: u.email, role: u.role };
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
            history: [hist("Assignment", wo.assetId, `${woId} assigned to ${t.name}`, overridden ? "Manager override of recommendation" : `Followed recommendation (score ${meta.score ?? "–"})`, { technicianId: techId, severity: wo.severity }), ...st.history],
          }));
        },

        setTaskStatus: (id, status, n) => set((s) => ({
          ...patchWo(id, (w) => ({ ...w, status, timeline: [...w.timeline, tl(n, status)] }))(s),
          history: [hist("Task", s.workOrders.find((w) => w.id === id)!.assetId, `${id} → ${status}`, n), ...s.history],
        })),
        addTaskNote: (id, text) => set(patchWo(id, (w) => ({ ...w, timeline: [...w.timeline, tl(`Manager note: ${text}`)] }))),

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

        resetDemo: () => set({ ...makeSeed() }),
      };
    },
    { name: "dg-pdm-manager-store", version: 1 },
  ),
);

export type { Subsystem };