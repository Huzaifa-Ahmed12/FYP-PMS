"use client";
import { useState } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Button, Field, Input, Modal, PageHeader, Select, StatusBadge, Tabs, Textarea, toast } from "@/components/ui";
import { DataTable } from "@/components/DataTable";
import { useStore } from "@/lib/store";
import { useSimulatedLoad } from "@/lib/hooks";
import { availableQty } from "@/lib/services";
import { fmt } from "@/lib/utils";
import type { PartRequest } from "@/lib/types";

const TABS = ["Pending", "All"] as const;

export default function PartRequestsPage() {
  const { partRequests, parts, technicians, workOrders, decidePartRequest } = useStore();
  const loading = useSimulatedLoad();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Pending");
  const [selId, setSelId] = useState<string | null>(null);
  const [decision, setDecision] = useState<"Approved" | "Partially Approved" | "Rejected">("Approved");
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  const sel = partRequests.find((r) => r.id === selId);
  const part = parts.find((p) => p.id === sel?.partId);
  const data = partRequests.filter((r) => tab === "All" || r.status === "Pending");

  function open(r: PartRequest) { setSelId(r.id); setDecision("Approved"); setQty(r.qty); setNote(""); setErr(""); }
  function submit() {
    if (!sel) return;
    if (decision === "Rejected" && note.trim().length < 3) return setErr("Give a reason for rejection.");
    if (decision === "Partially Approved" && (qty < 1 || qty >= sel.qty)) return setErr(`Partial quantity must be between 1 and ${sel.qty - 1}.`);
    const e = decidePartRequest(sel.id, decision, decision === "Approved" ? sel.qty : qty, note);
    if (e) return setErr(e);
    toast(`Request ${decision.toLowerCase()}`); setSelId(null);
  }

  const columns: ColumnDef<PartRequest>[] = [
    { header: "Request", accessorFn: (r) => r.id },
    { id: "wo", header: "Work order", accessorFn: (r) => r.workOrderId, cell: ({ row }) => <Link className="underline" href={`/manager/tasks/${row.original.workOrderId}`}>{row.original.workOrderId}</Link> },
    { header: "Part", accessorFn: (r) => parts.find((p) => p.id === r.partId)?.name ?? r.partId },
    { header: "Technician", accessorFn: (r) => technicians.find((t) => t.id === r.technicianId)?.name ?? "—" },
    { header: "Qty", accessorFn: (r) => r.qty },
    { id: "av", header: "Available now", accessorFn: (r) => { const p = parts.find((x) => x.id === r.partId); return p ? availableQty(p, workOrders) : 0; } },
    { header: "Reason", accessorFn: (r) => r.reason },
    { id: "st", header: "Status", accessorFn: (r) => r.status, cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { id: "t", header: "Requested", accessorFn: (r) => r.requestedAt, cell: ({ row }) => fmt(row.original.requestedAt) },
    { id: "a", header: "", enableSorting: false, cell: ({ row }) => row.original.status === "Pending" ? <Button size="sm" variant="accent" onClick={() => open(row.original)}>Review</Button> : <span className="text-xs opacity-70">{row.original.decisionNote}</span> },
  ];

  return (
    <>
      <PageHeader title="Part Requests" subtitle="Approve, partially approve or reject technician requests. Approval reserves stock for the work order." />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      <DataTable data={data} columns={columns} loading={loading} emptyTitle="No part requests" />
      <Modal open={!!sel} onClose={() => setSelId(null)} title={sel ? `Review ${sel.id}` : ""}>
        {sel && part && (
          <div className="space-y-3">
            <p className="text-sm"><b>{sel.qty} × {part.name}</b> for {sel.workOrderId}<br />Reason: {sel.reason}<br />Available now: <b>{availableQty(part, workOrders)} {part.unit}</b></p>
            <Field label="Decision"><Select value={decision} onChange={(e) => { setDecision(e.target.value as typeof decision); setErr(""); }}><option>Approved</option><option>Partially Approved</option><option>Rejected</option></Select></Field>
            {decision === "Partially Approved" && <Field label="Approved quantity"><Input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} /></Field>}
            <Field label="Note to technician" error={err}><Textarea value={note} onChange={(e) => setNote(e.target.value)} /></Field>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setSelId(null)}>Cancel</Button><Button onClick={submit}>Submit decision</Button></div>
          </div>
        )}
      </Modal>
    </>
  );
}