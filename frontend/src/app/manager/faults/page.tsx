"use client";
import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { Button, ConfirmDialog, Field, LinkButton, Modal, Options, PageHeader, Select, SeverityBadge, StatusBadge, Textarea, toast } from "@/components/ui";
import { DataTable } from "@/components/DataTable";
import { useStore } from "@/lib/store";
import { useSimulatedLoad } from "@/lib/hooks";
import { FAULT_CATALOG, FAULT_STATUSES, SEVERITIES } from "@/lib/config";
import { fmt } from "@/lib/utils";
import type { Fault } from "@/lib/types";

export default function FaultsPage() {
  const { faults, generators, setFaultStatus, reportManualFault } = useStore();
  const loading = useSimulatedLoad();
  const [status, setStatus] = useState("all");
  const [sev, setSev] = useState("all");
  const [source, setSource] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState({ assetId: "", faultType: "Fuel-System Fault", description: "" });
  const [err, setErr] = useState("");

  const selected = faults.find((f) => f.id === selectedId) ?? null;
  const data = faults.filter((f) => (status === "all" || f.status === status) && (sev === "all" || f.severity === sev) && (source === "all" || f.source === source));
  const faultTypes = Object.keys(FAULT_CATALOG).filter((c) => FAULT_CATALOG[c].severity !== "Normal");

  const columns: ColumnDef<Fault>[] = [
    { header: "Fault", accessorFn: (f) => f.id }, { header: "Asset", accessorFn: (f) => f.assetId }, { header: "Fault type", accessorFn: (f) => f.faultType }, { header: "Subsystem", accessorFn: (f) => f.subsystem },
    { id: "sev", header: "Severity", accessorFn: (f) => f.severity, cell: ({ row }) => <SeverityBadge severity={row.original.severity} /> },
    { id: "src", header: "Source", accessorFn: (f) => f.source, cell: ({ row }) => <StatusBadge status={row.original.source} /> },
    { id: "st", header: "Status", accessorFn: (f) => f.status, cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { id: "t", header: "Reported", accessorFn: (f) => f.reportedAt, cell: ({ row }) => fmt(row.original.reportedAt) },
  ];

  function submitManual() {
    if (form.description.trim().length < 10) return setErr("Describe the symptoms (min 10 characters).");
    const asset = form.assetId || generators[0]?.id;
    const id = reportManualFault({ ...form, assetId: asset });
    toast(`Manual fault ${id} logged`); setNewOpen(false); setForm({ ...form, description: "" }); setErr("");
  }

  return (
    <>
      <PageHeader title="Faults" subtitle="ML-detected and manually reported faults with a preserved audit history."
        actions={<Button onClick={() => setNewOpen(true)}><Plus size={16} />Log manual fault</Button>} />
      <DataTable data={data} columns={columns} loading={loading} onRowClick={(f) => setSelectedId(f.id)} searchPlaceholder="Search faults…"
        toolbar={<>
          <Select aria-label="Status filter" className="w-40" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All statuses</option><Options list={FAULT_STATUSES} /></Select>
          <Select aria-label="Severity filter" className="w-40" value={sev} onChange={(e) => setSev(e.target.value)}><option value="all">All severities</option><Options list={SEVERITIES} /></Select>
          <Select aria-label="Source filter" className="w-44" value={source} onChange={(e) => setSource(e.target.value)}><option value="all">All sources</option><Options list={["ML Diagnostic", "Manual Report"]} /></Select>
        </>} />

      <Modal open={!!selected} onClose={() => setSelectedId(null)} title={selected ? `${selected.id} · ${selected.faultType}` : ""} wide>
        {selected && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2"><SeverityBadge severity={selected.severity} /><StatusBadge status={selected.status} /><StatusBadge status={selected.source} /><span className="text-sm">{selected.assetId} · {selected.subsystem}</span></div>
            <p className="text-sm"><b>Description / recommended action:</b> {selected.description}</p>
            <div><h3 className="mb-2 font-semibold">Audit history</h3>
              <ol className="space-y-1 border-l-2 border-ink/30 pl-4 text-sm">{selected.audit.map((a) => <li key={a.id}><b>{a.action}</b><div className="text-xs opacity-70">{fmt(a.at)} · {a.by}</div></li>)}</ol></div>
            <div className="flex flex-wrap justify-end gap-2">
              {selected.status === "Open" && <Button variant="outline" onClick={() => { setFaultStatus(selected.id, "Acknowledged"); toast("Fault acknowledged"); }}>Acknowledge</Button>}
              {selected.status !== "Resolved" && selected.status !== "Under Maintenance" && <Button variant="outline" onClick={() => { setFaultStatus(selected.id, "Under Maintenance"); toast("Marked under maintenance"); }}>Mark under maintenance</Button>}
              {selected.status !== "Resolved" && <Button variant="outline" onClick={() => setResolveId(selected.id)}>Mark resolved</Button>}
              {selected.workOrderId ? <LinkButton href={`/manager/tasks/${selected.workOrderId}`} variant="accent">Open {selected.workOrderId}</LinkButton>
                : selected.status !== "Resolved" && <LinkButton href={`/manager/recommendations?fault=${selected.id}`} variant="accent">Create work order & recommend</LinkButton>}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="Log manual fault">
        <div className="space-y-3">
          <Field label="Asset"><Select value={form.assetId} onChange={(e) => setForm({ ...form, assetId: e.target.value })}>{generators.filter((g) => g.active).map((g) => <option key={g.id} value={g.id}>{g.id}</option>)}</Select></Field>
          <Field label="Fault category"><Select value={form.faultType} onChange={(e) => setForm({ ...form, faultType: e.target.value })}><Options list={faultTypes} /></Select></Field>
          <Field label="Symptoms / observations" error={err}><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button><Button onClick={submitManual}>Submit</Button></div>
        </div>
      </Modal>
      <ConfirmDialog open={!!resolveId} title="Mark fault as resolved?" message="The audit trail keeps the previous states. Normally this happens automatically when a task is completed." confirmLabel="Mark resolved"
        onCancel={() => setResolveId(null)} onConfirm={() => { if (resolveId) setFaultStatus(resolveId, "Resolved", "manual"); setResolveId(null); toast("Fault resolved"); }} />
    </>
  );
}