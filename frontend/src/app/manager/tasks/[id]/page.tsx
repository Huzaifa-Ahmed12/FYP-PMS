"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, LinkButton, Options, PageHeader, Select, SeverityBadge, StatusBadge, toast } from "@/components/ui";
import { useStore } from "@/lib/store";
import { availableQty } from "@/lib/services";
import { fmt, fmtDate } from "@/lib/utils";

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const { workOrders, technicians, parts, partRequests, generators, setTaskStatus, addTaskNote, allocatePart, simulateTechnician } = useStore();
  const wo = workOrders.find((w) => w.id === id);
  const [note, setNote] = useState("");
  const [partId, setPartId] = useState("");
  const [qty, setQty] = useState(1);
  const [partErr, setPartErr] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  if (!wo) return <EmptyState title="Work order not found" />;

  const tech = technicians.find((t) => t.id === wo.assignedTo);
  const gen = generators.find((g) => g.id === wo.assetId);
  const reqs = partRequests.filter((r) => r.workOrderId === wo.id);
  const closed = wo.status === "Completed" || wo.status === "Cancelled";
  const selPart = parts.find((p) => p.id === (partId || parts[0]?.id));
  const pname = (pid: string) => parts.find((p) => p.id === pid)?.name ?? pid;

  return (
    <>
      <PageHeader title={`${wo.id} · ${wo.title}`} subtitle={`${wo.assetId}${gen ? ` · ${gen.siteName}` : ""}`}
        actions={<>{!closed && <LinkButton href={`/manager/recommendations?wo=${wo.id}`} variant="accent">{tech ? "Reassign" : "Recommend technician"}</LinkButton>}<LinkButton href="/manager/tasks" variant="outline">Back</LinkButton></>} />
      <div className="mb-4 flex flex-wrap items-center gap-2"><StatusBadge status={wo.status} /><SeverityBadge severity={wo.severity} /><StatusBadge status={wo.priority} /><Badge tone="outline">Due {fmtDate(wo.dueDate)}</Badge>{wo.faultId && <Link href="/manager/faults" className="text-sm underline">Fault {wo.faultId}</Link>}</div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card><h2 className="mb-2 font-bold">Details</h2><p className="text-sm">{wo.description}</p>
            <div className="mt-3 flex flex-wrap items-center gap-1 text-sm">Required skills: {wo.requiredSkills.map((s) => <Badge key={s} tone="outline">{s}</Badge>)}</div>
            <div className="mt-2 text-sm">Assigned technician: <b>{tech?.name ?? "Unassigned"}</b></div>
          </Card>

          <Card><h2 className="mb-3 font-bold">Timeline & technician updates</h2>
            <ol className="space-y-3 border-l-2 border-ink/30 pl-4">{wo.timeline.map((t) => <li key={t.id} className="relative text-sm"><span className="absolute -left-[22px] top-1.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-ink" /><div className="font-medium">{t.text} {t.status && <StatusBadge status={t.status} />}</div><div className="text-xs opacity-70">{fmt(t.at)} · {t.by}</div></li>)}</ol>
            <div className="mt-4 flex gap-2"><Input aria-label="Add note" placeholder="Add a manager note…" value={note} onChange={(e) => setNote(e.target.value)} /><Button variant="outline" disabled={!note.trim()} onClick={() => { addTaskNote(wo.id, note.trim()); setNote(""); toast("Note added"); }}>Add</Button></div>
          </Card>

          {wo.status === "Completed" && (
            <Card className="border-accent"><h2 className="mb-2 font-bold">Completion report</h2>
              <p className="text-sm">{wo.workSummary}</p><p className="mt-1 text-xs opacity-70">Completed {fmt(wo.completedAt)}</p>
              <div className="mt-2 text-sm"><b>Parts used:</b> {wo.usedParts.length ? wo.usedParts.map((u) => `${u.qty} × ${pname(u.partId)}`).join(", ") : "None"}</div>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card><h2 className="mb-2 font-bold">Spare parts</h2>
            <ul className="mb-3 space-y-1 text-sm">{wo.allocations.length === 0 && <li className="opacity-70">No parts allocated.</li>}{wo.allocations.map((a) => <li key={a.partId} className="flex justify-between"><span>{pname(a.partId)}</span><b>× {a.qty}</b></li>)}</ul>
            {!closed && (
              <div className="space-y-2 border-t border-ink/20 pt-3">
                <Field label="Allocate part"><Select value={partId || parts[0]?.id} onChange={(e) => setPartId(e.target.value)}>{parts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
                {selPart && <div className="text-xs">Available now: <b>{availableQty(selPart, workOrders)} {selPart.unit}</b> (on hand {selPart.quantity})</div>}
                <Field label="Quantity" error={partErr}><Input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} /></Field>
                <Button size="sm" onClick={() => { const err = allocatePart(wo.id, partId || parts[0].id, qty); setPartErr(err ?? ""); if (!err) toast("Part allocated"); }}>Allocate</Button>
              </div>)}
          </Card>
          <Card><h2 className="mb-2 font-bold">Part requests</h2>
            {reqs.length === 0 ? <p className="text-sm opacity-70">None.</p> : <ul className="space-y-1 text-sm">{reqs.map((r) => <li key={r.id} className="flex items-center justify-between"><span>{r.qty} × {pname(r.partId)}</span><StatusBadge status={r.status} /></li>)}</ul>}
            <Link href="/manager/part-requests" className="mt-2 inline-block text-xs underline">Open approvals</Link>
          </Card>
          {!closed && (
            <Card><h2 className="mb-2 font-bold">Manager actions</h2>
              <div className="flex flex-wrap gap-2">
                {wo.status === "On Hold" && <Button size="sm" variant="outline" onClick={() => { setTaskStatus(wo.id, "In Progress", "Manager resumed task"); toast("Task resumed"); }}>Resume</Button>}
                {wo.status !== "On Hold" && wo.status !== "Pending Assignment" && <Button size="sm" variant="outline" onClick={() => { setTaskStatus(wo.id, "On Hold", "Manager placed task on hold"); toast("Task on hold"); }}>Put on hold</Button>}
                <Button size="sm" variant="outline" onClick={() => setCancelOpen(true)}>Cancel task</Button>
              </div>
            </Card>
          )}
          {!closed && wo.assignedTo && (
            <Card className="border-dashed border-ink/60"><h2 className="mb-1 font-bold">Demo: simulate technician</h2><p className="mb-2 text-xs opacity-70">Stands in for the technician module until it is built.</p>
              <div className="flex flex-wrap gap-2">
                {wo.status === "Assigned" && <Button size="sm" variant="accent" onClick={() => simulateTechnician(wo.id, "accept")}>Accept</Button>}
                {(wo.status === "Accepted" || wo.status === "On Hold") && <Button size="sm" variant="accent" onClick={() => simulateTechnician(wo.id, "start")}>Start work</Button>}
                {wo.status === "In Progress" && <><Button size="sm" variant="outline" onClick={() => simulateTechnician(wo.id, "hold")}>Hold</Button><Button size="sm" variant="accent" onClick={() => { simulateTechnician(wo.id, "complete"); toast("Task completed – stock, fault and history updated"); }}>Complete</Button></>}
              </div>
            </Card>
          )}
        </div>
      </div>
      <ConfirmDialog open={cancelOpen} title="Cancel this work order?" message="Allocated parts will be released. The cancellation is recorded in the timeline." confirmLabel="Cancel task"
        onCancel={() => setCancelOpen(false)} onConfirm={() => { setTaskStatus(wo.id, "Cancelled", "Manager cancelled task"); setCancelOpen(false); toast("Task cancelled"); }} />
    </>
  );
}