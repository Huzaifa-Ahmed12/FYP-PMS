"use client";
import { useState } from "react";
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select, StatusBadge, Tabs, Textarea, toast } from "@/components/ui";
import { useStore } from "@/lib/store";
import { useTechnician } from "@/lib/use-technician";
import { useQueryParam } from "@/lib/hooks";
import { availableQty } from "@/lib/services";
import { OPEN_STATUSES, partFitsSkills } from "@/lib/technician";
import { fmt } from "@/lib/utils";

const TABS = ["All", "Pending", "Decided"] as const;

export default function TechnicianPartRequests() {
  const { id } = useTechnician();
  const { workOrders, parts, partRequests, submitPartRequest } = useStore();
  const taskParam = useQueryParam("task");
  const myOpen = workOrders.filter((w) => w.assignedTo === id && OPEN_STATUSES.includes(w.status));
  const [woPick, setWoPick] = useState<string | null>(null);
  const woId = woPick ?? (myOpen.some((w) => w.id === taskParam) ? taskParam! : myOpen[0]?.id ?? "");
  const [partId, setPartId] = useState("");
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<(typeof TABS)[number]>("All");

  const wo = myOpen.find((w) => w.id === woId);
  // Parts that fit the task's required skills come first
  const sorted = [...parts].sort((a, b) => Number(partFitsSkills(b, wo?.requiredSkills ?? [])) - Number(partFitsSkills(a, wo?.requiredSkills ?? [])));
  const selId = partId || sorted[0]?.id || "";
  const sel = parts.find((p) => p.id === selId);
  const pname = (pid: string) => parts.find((p) => p.id === pid)?.name ?? pid;
  const unit = (pid: string) => parts.find((p) => p.id === pid)?.unit ?? "";

  const mine = partRequests.filter((r) => r.technicianId === id).filter((r) => (tab === "All" ? true : tab === "Pending" ? r.status === "Pending" : r.status !== "Pending")).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));

  function submit() {
    const e = submitPartRequest({ workOrderId: woId, partId: selId, qty, reason });
    setErr(e ?? "");
    if (!e) { toast("Part request sent to your manager"); setReason(""); setQty(1); }
  }

  return (
    <>
      <PageHeader title="Spare-Part Requests" subtitle="Ask the manager for parts you need. Approved parts are reserved for your work order." />
      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="space-y-3 lg:col-span-2">
          <h2 className="font-bold">New request</h2>
          {myOpen.length === 0 ? <EmptyState title="No open task" text="You can request parts only for a task assigned to you." /> : (
            <>
              <Field label="Work order"><Select value={woId} onChange={(e) => setWoPick(e.target.value)}>{myOpen.map((w) => <option key={w.id} value={w.id}>{w.id} · {w.title.slice(0, 38)}</option>)}</Select></Field>
              <Field label="Part" hint={sel ? `Available now: ${availableQty(sel, workOrders)} ${sel.unit} (on hand ${sel.quantity})${wo && partFitsSkills(sel, wo.requiredSkills) ? " · fits this task" : ""}` : undefined}>
                <Select value={selId} onChange={(e) => setPartId(e.target.value)}>{sorted.map((p) => <option key={p.id} value={p.id}>{partFitsSkills(p, wo?.requiredSkills ?? []) ? "★ " : ""}{p.name} ({p.code})</option>)}</Select>
              </Field>
              <Field label={`Quantity${sel ? ` (${sel.unit})` : ""}`}><Input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} /></Field>
              <Field label="Reason" error={err}><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why do you need it?" /></Field>
              <Button variant="accent" className="w-full" onClick={submit}>Send request</Button>
            </>
          )}
        </Card>

        <Card className="lg:col-span-3">
          <h2 className="mb-1 font-bold">Parts for {wo ? wo.id : "your task"}</h2>
          <p className="mb-3 text-xs opacity-70">★ = fits the skills this task needs. Allocation is what the manager has already reserved for you.</p>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-ink/30"><th className="py-1 pr-2">Part</th><th className="pr-2">Available</th><th className="pr-2">Allocated to task</th><th></th></tr></thead>
            <tbody>{sorted.map((p) => { const fit = partFitsSkills(p, wo?.requiredSkills ?? []); const av = availableQty(p, workOrders); return (
              <tr key={p.id} className="border-b border-ink/10"><td className="py-1.5 pr-2">{fit && "★ "}{p.name} <span className="text-xs opacity-60">{p.code}</span></td><td className="pr-2">{av <= 0 ? <Badge tone="dashed">Out of stock</Badge> : `${av} ${p.unit}`}{av > 0 && av <= p.minStock && <Badge tone="accent" className="ml-1">Low</Badge>}</td><td className="pr-2">{wo?.allocations.find((a) => a.partId === p.id)?.qty ?? 0}</td><td><Button size="sm" variant="outline" onClick={() => setPartId(p.id)}>Select</Button></td></tr>); })}</tbody></table></div>
        </Card>
      </div>

      <h2 className="mb-2 mt-8 font-bold">My requests</h2>
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {mine.length === 0 ? <EmptyState title="No requests" /> : (
        <ul className="space-y-2">
          {mine.map((r) => (
            <li key={r.id}><Card className="text-sm">
              <div className="flex flex-wrap items-center gap-2"><b>{r.id}</b><span>{r.qty} {unit(r.partId)} × {pname(r.partId)}</span><StatusBadge status={r.status} /><Badge tone="muted">{r.workOrderId}</Badge></div>
              <p className="mt-1 text-xs opacity-80">Reason: {r.reason}</p>
              {r.status !== "Pending" && <p className="mt-1 text-xs"><b>Manager decision:</b> {r.approvedQty ?? 0} of {r.qty} approved{r.decisionNote ? ` – ${r.decisionNote}` : ""}{r.decidedAt ? ` (${fmt(r.decidedAt)})` : ""}</p>}
              <p className="mt-1 text-xs opacity-60">Requested {fmt(r.requestedAt)}</p>
            </Card></li>
          ))}
        </ul>
      )}
    </>
  );
}