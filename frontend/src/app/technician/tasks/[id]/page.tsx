"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Check, MapPin, Package, PhoneCall, Wrench } from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, LinkButton, Modal, PageHeader, SeverityBadge, StatusBadge, Textarea, cn, toast } from "@/components/ui";
import MapClient from "@/components/MapClient";
import { useStore } from "@/lib/store";
import { useTechnician } from "@/lib/use-technician";
import { ALLOW_DECLINE, READING_META } from "@/lib/config";
import { LIFECYCLE, isOverdue, lifecycleIndex } from "@/lib/technician";
import { fmt, fmtDate } from "@/lib/utils";

export default function TechnicianTaskDetail() {
  const { id: woId } = useParams<{ id: string }>();
  const router = useRouter();
  const { id: me, tech } = useTechnician();
  const { workOrders, generators, faults, diagnostics, parts, partRequests, acceptTask, declineTask, startWork } = useStore();
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");

  const wo = workOrders.find((w) => w.id === woId);
  // A technician only sees tasks assigned to them (a declined / reassigned task disappears from their account)
  if (!wo || wo.assignedTo !== me) return <EmptyState title="Task not available" text="This work order does not exist or is not assigned to you." />;

  const gen = generators.find((g) => g.id === wo.assetId);
  const fault = faults.find((f) => f.id === wo.faultId);
  const dx = diagnostics.find((d) => d.id === fault?.diagnosticId);
  const reqs = partRequests.filter((r) => r.workOrderId === wo.id);
  const pname = (pid: string) => parts.find((p) => p.id === pid)?.name ?? pid;
  const punit = (pid: string) => parts.find((p) => p.id === pid)?.unit ?? "";
  const managerNotes = wo.timeline.filter((t) => t.text.startsWith("Manager note:"));
  const step = lifecycleIndex(wo.status);
  const closed = wo.status === "Completed" || wo.status === "Cancelled";
  const working = ["In Progress", "On Hold"].includes(wo.status);

  function doAccept() { const e = acceptTask(wo!.id); toast(e ?? "Task accepted"); }
  function doStart() { const e = startWork(wo!.id); if (e) return toast(e); toast("Work started – generator set to Under Maintenance"); router.push(`/technician/maintenance/${wo!.id}`); }
  function doDecline() { const e = declineTask(wo!.id, reason); if (e) return setErr(e); toast("Assignment declined – manager notified"); router.replace("/technician/tasks"); }

  return (
    <>
      <PageHeader title={`${wo.id} · ${wo.title}`} subtitle={`${wo.assetId}${gen ? ` · ${gen.siteName}` : ""}`} actions={<LinkButton href="/technician/tasks" variant="outline">Back</LinkButton>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge status={wo.status} /><SeverityBadge severity={wo.severity} /><StatusBadge status={wo.priority} />
        <Badge tone={isOverdue(wo) ? "ink" : "outline"} className={isOverdue(wo) ? "text-accent" : ""}>{isOverdue(wo) && "⏰ Overdue · "}Due {fmtDate(wo.dueDate)}</Badge>
      </div>

      {wo.status !== "Cancelled" && (
        <ol className="mb-5 grid grid-cols-4 gap-1 text-center text-xs" aria-label="Task progress">
          {LIFECYCLE.map((s, i) => (
            <li key={s} aria-current={i === step ? "step" : undefined} className={cn("rounded border px-1 py-2", i < step || wo.status === "Completed" ? "border-ink bg-ink text-paper" : i === step ? "border-accent bg-accent font-semibold" : "border-ink/30 opacity-60")}>
              {(i < step || wo.status === "Completed") && <Check size={12} className="mr-1 inline" aria-hidden />}{s === "In Progress" && wo.status === "On Hold" ? "On Hold" : s}
            </li>
          ))}
        </ol>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <h2 className="mb-2 font-bold">Fault details</h2>
            {fault ? (
              <div className="space-y-2 text-sm">
                <div className="flex flex-wrap items-center gap-2"><b>{fault.faultType}</b><SeverityBadge severity={fault.severity} /><StatusBadge status={fault.source} /><span className="opacity-70">{fault.subsystem} · reported {fmt(fault.reportedAt)}</span></div>
                <p>{fault.description}</p>
              </div>
            ) : <p className="text-sm">No linked fault record.</p>}
            <div className="mt-3 flex flex-wrap items-center gap-1 text-sm">Required skills: {wo.requiredSkills.length ? wo.requiredSkills.map((s) => <Badge key={s} tone={tech.skills.includes(s) ? "ink" : "outline"}>{s}</Badge>) : "—"}</div>
          </Card>

          <Card>
            <h2 className="mb-2 font-bold">Diagnostic summary</h2>
            {dx ? (
              <>
                <div className="flex flex-wrap items-center gap-2 text-sm"><b>{dx.predictedClass}</b><SeverityBadge severity={dx.severity} /><span className="opacity-70">{Math.round(dx.confidence * 100)}% confidence · {dx.modelName} v{dx.modelVersion} · {dx.dataSource.replace("_", " ")} · {fmt(dx.timestamp)}</span></div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {Object.entries(dx.inputSummary).map(([k, v]) => <div key={k} className="rounded border border-ink/20 p-2"><div className="text-xs opacity-70">{READING_META[k]?.label ?? k}</div><div className="font-bold">{v} <span className="text-xs font-normal">{READING_META[k]?.unit}</span></div></div>)}
                </div>
              </>
            ) : <p className="text-sm">{fault?.source === "Manual Report" ? `Manual report by ${fault.reportedBy} – there is no ML prediction for this fault.` : "No diagnostic record is linked to this task."}</p>}
          </Card>

          <Card>
            <h2 className="mb-2 font-bold">Manager instructions</h2>
            <p className="text-sm">{wo.description}</p>
            {wo.notes && <p className="mt-2 text-sm"><b>Notes:</b> {wo.notes}</p>}
            {managerNotes.length > 0 && <ul className="mt-3 space-y-1 border-t border-ink/20 pt-2 text-sm">{managerNotes.map((n) => <li key={n.id}>{n.text.replace("Manager note: ", "")}<span className="ml-2 text-xs opacity-60">{fmt(n.at)}</span></li>)}</ul>}
          </Card>

          <Card>
            <h2 className="mb-3 font-bold">Timeline</h2>
            <ol className="space-y-3 border-l-2 border-ink/30 pl-4">{wo.timeline.map((t) => <li key={t.id} className="relative text-sm"><span className="absolute -left-[22px] top-1.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-ink" /><div className="font-medium">{t.text} {t.status && <StatusBadge status={t.status} />}</div><div className="text-xs opacity-70">{fmt(t.at)} · {t.by}</div></li>)}</ol>
          </Card>

          {wo.status === "Completed" && (
            <Card className="border-accent"><h2 className="mb-2 font-bold">Completion report</h2><p className="text-sm">{wo.workSummary}</p><p className="mt-1 text-xs opacity-70">Completed {fmt(wo.completedAt)}</p>
              <div className="mt-2 text-sm"><b>Parts used:</b> {wo.usedParts.length ? wo.usedParts.map((u) => `${u.qty} × ${pname(u.partId)}`).join(", ") : "None"}</div></Card>
          )}
        </div>

        <div className="space-y-5">
          {!closed && (
            <Card className="border-2 border-accent">
              <h2 className="mb-3 font-bold">Next step</h2>
              <div className="flex flex-col gap-2">
                {wo.status === "Assigned" && <><Button variant="accent" onClick={doAccept}>Accept task</Button>{ALLOW_DECLINE && <Button variant="outline" onClick={() => { setReason(""); setErr(""); setDeclineOpen(true); }}>Decline with reason</Button>}</>}
                {wo.status === "Accepted" && <><Button variant="accent" onClick={doStart}><Wrench size={16} />Start work on site</Button>{ALLOW_DECLINE && <Button variant="outline" onClick={() => { setReason(""); setErr(""); setDeclineOpen(true); }}>Decline with reason</Button>}</>}
                {working && <LinkButton href={`/technician/maintenance/${wo.id}`} variant="accent"><Wrench size={16} />Open maintenance update</LinkButton>}
                <LinkButton href={`/technician/inspection?task=${wo.id}`} variant="outline">Record inspection</LinkButton>
                <LinkButton href={`/technician/part-requests?task=${wo.id}`} variant="outline"><Package size={16} />Request spare parts</LinkButton>
                <LinkButton href={`/technician/report-fault?task=${wo.id}`} variant="outline">Report another fault</LinkButton>
              </div>
            </Card>
          )}

          <Card>
            <h2 className="mb-2 font-bold">Generator & site</h2>
            {gen ? (
              <div className="space-y-1 text-sm">
                <div><b>{gen.id}</b> · {gen.model}</div>
                <div className="flex items-start gap-1"><MapPin size={15} className="mt-0.5 shrink-0" aria-hidden />{gen.siteName}, {gen.address}</div>
                <div>Rated capacity: {gen.ratedCapacityKva} kVA</div>
                <div className="flex flex-wrap gap-2 pt-1"><StatusBadge status={gen.operationalStatus} /><SeverityBadge severity={gen.health} /></div>
                <div className="pt-2"><MapClient height="220px" points={[
                  { id: gen.id, lat: gen.lat, lng: gen.lng, kind: "generator", severity: gen.health, label: gen.id, popup: <b>{gen.id} · {gen.siteName}</b> },
                  { id: tech.id, lat: tech.lat, lng: tech.lng, kind: "technician", label: "You", highlight: true, popup: <b>Your stored location</b> },
                ]} /></div>
                <a className="mt-1 inline-block text-xs underline" href={`https://www.google.com/maps/dir/?api=1&destination=${gen.lat},${gen.lng}`} target="_blank" rel="noreferrer">Open directions in Maps</a>
              </div>
            ) : <p className="text-sm">Asset record not found.</p>}
          </Card>

          <Card>
            <h2 className="mb-2 flex items-center gap-2 font-bold"><PhoneCall size={16} />Site contact</h2>
            <p className="text-sm">Site contact details are shared by your manager for privacy. Contact: <a className="underline" href="mailto:manager@dgpdm.pk">manager@dgpdm.pk</a></p>
          </Card>

          <Card>
            <h2 className="mb-2 font-bold">Spare parts</h2>
            <ul className="mb-2 space-y-1 text-sm">
              {wo.allocations.length === 0 && <li className="opacity-70">No parts allocated yet.</li>}
              {wo.allocations.map((a) => <li key={a.partId} className="flex justify-between"><span>{pname(a.partId)}</span><b>{a.qty} {punit(a.partId)} allocated</b></li>)}
            </ul>
            {reqs.length > 0 && <ul className="space-y-1 border-t border-ink/20 pt-2 text-sm">{reqs.map((r) => <li key={r.id} className="flex items-center justify-between"><span>{r.qty} × {pname(r.partId)}</span><StatusBadge status={r.status} /></li>)}</ul>}
            <Link href={`/technician/part-requests?task=${wo.id}`} className="mt-2 inline-block text-xs underline">Open part requests</Link>
          </Card>
        </div>
      </div>

      <Modal open={declineOpen} onClose={() => setDeclineOpen(false)} title="Decline this assignment?">
        <div className="space-y-3">
          <p className="text-sm">The task goes back to <b>Pending Assignment</b> and your manager is notified so they can pick another technician.</p>
          <Field label="Reason" error={err}><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Not enough time before the due date; need a different skill set…" /></Field>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setDeclineOpen(false)}>Cancel</Button><Button variant="accent" onClick={doDecline}>Decline task</Button></div>
        </div>
      </Modal>
    </>
  );
}