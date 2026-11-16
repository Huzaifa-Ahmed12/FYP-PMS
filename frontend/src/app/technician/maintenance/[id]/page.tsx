"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Pause, Play, Trash2 } from "lucide-react";
import { Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, LinkButton, Modal, Options, PageHeader, Select, SeverityBadge, StatusBadge, Textarea, toast } from "@/components/ui";
import { useStore } from "@/lib/store";
import { useTechnician } from "@/lib/use-technician";
import { FAULT_CATALOG, READING_META, TASK_OUTCOMES } from "@/lib/config";
import { reservedQty } from "@/lib/services";
import { fmt } from "@/lib/utils";
import type { TaskOutcome } from "@/lib/types";

export default function MaintenanceUpdatePage() {
  const { id: woId } = useParams<{ id: string }>();
  const router = useRouter();
  const { id: me } = useTechnician();
  const { workOrders, faults, parts, startWork, holdTask, resumeTask, addProgressNote, recordPartUsage, removePartUsage, completeTask } = useStore();

  // progress note
  const [text, setText] = useState("");
  const [diagnosis, setDiagnosis] = useState<"Not assessed" | "Confirmed" | "Changed">("Not assessed");
  const [newType, setNewType] = useState("");
  const [readings, setReadings] = useState<Record<string, string>>({});
  const [noteErr, setNoteErr] = useState("");
  // parts used
  const [partId, setPartId] = useState("");
  const [qty, setQty] = useState(1);
  const [partErr, setPartErr] = useState("");
  // on hold
  const [holdOpen, setHoldOpen] = useState(false);
  const [holdReason, setHoldReason] = useState("");
  const [holdErr, setHoldErr] = useState("");
  // completion
  const [summary, setSummary] = useState("");
  const [outcome, setOutcome] = useState<TaskOutcome>("Fault rectified");
  const [recs, setRecs] = useState("");
  const [doneErr, setDoneErr] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const wo = workOrders.find((w) => w.id === woId);
  if (!wo || wo.assignedTo !== me) return <EmptyState title="Task not available" text="This work order does not exist or is not assigned to you." />;

  const fault = faults.find((f) => f.id === wo.faultId);
  const sub = fault?.subsystem ?? "Engine";
  const readingFields = Object.entries(READING_META).filter(([, m]) => m.subsystem === sub);
  const faultTypes = Object.keys(FAULT_CATALOG).filter((c) => FAULT_CATALOG[c].severity !== "Normal" && c !== fault?.faultType);
  const pname = (pid: string) => parts.find((p) => p.id === pid)?.name ?? pid;
  const room = (pid: string) => { const p = parts.find((x) => x.id === pid); if (!p) return 0; return p.quantity - reservedQty(pid, workOrders.filter((x) => x.id !== wo.id)) - (wo.usedParts.find((u) => u.partId === pid)?.qty ?? 0); };
  const selPartId = partId || parts[0]?.id;
  const holdEntry = [...wo.timeline].reverse().find((t) => t.text.startsWith("Placed on hold"));
  const working = wo.status === "In Progress";
  const closed = wo.status === "Completed" || wo.status === "Cancelled";

  function saveNote() {
    const r: Record<string, number> = {};
    for (const [k, v] of Object.entries(readings)) if (v.trim() !== "" && Number.isFinite(Number(v))) r[k] = Number(v);
    const e = addProgressNote(wo!.id, { text, diagnosis, newFaultType: newType || undefined, readings: r });
    if (e) return setNoteErr(e);
    setText(""); setDiagnosis("Not assessed"); setNewType(""); setReadings({}); setNoteErr(""); toast("Progress update sent to manager");
  }
  function addPart() { const e = recordPartUsage(wo!.id, selPartId, qty); setPartErr(e ?? ""); if (!e) { toast("Part usage recorded"); setQty(1); } }
  function doHold() { const e = holdTask(wo!.id, holdReason); if (e) return setHoldErr(e); setHoldOpen(false); setHoldReason(""); toast("Task placed on hold"); }
  function askComplete() {
    if (summary.trim().length < 20) return setDoneErr("Describe the work performed (min 20 characters).");
    setDoneErr(""); setConfirmOpen(true);
  }
  function doComplete() {
    const e = completeTask(wo!.id, { summary, outcome, recommendations: recs });
    setConfirmOpen(false); if (e) return setDoneErr(e);
    toast("Task completed – manager, stock and history updated"); router.push(`/technician/tasks/${wo!.id}`);
  }

  return (
    <>
      <PageHeader title={`Maintenance update · ${wo.id}`} subtitle={`${wo.title} · ${wo.assetId}`} actions={<LinkButton href={`/technician/tasks/${wo.id}`} variant="outline">Task details</LinkButton>} />
      <div className="mb-4 flex flex-wrap items-center gap-2"><StatusBadge status={wo.status} /><SeverityBadge severity={wo.severity} />{fault && <Badge tone="outline">{fault.faultType}</Badge>}</div>

      {wo.status === "Assigned" && <Card className="mb-5 border-accent"><p className="text-sm">You must accept this task before you can record maintenance work.</p><LinkButton className="mt-3" href={`/technician/tasks/${wo.id}`} variant="accent">Go to task details</LinkButton></Card>}
      {closed && <Card className="mb-5"><p className="text-sm">This task is <b>{wo.status}</b>. Updates are locked.</p>{wo.workSummary && <p className="mt-2 text-sm">{wo.workSummary}</p>}</Card>}

      {wo.status === "Accepted" && (
        <Card className="mb-5 border-2 border-accent"><h2 className="mb-1 font-bold">Ready to start?</h2><p className="mb-3 text-sm">Starting work marks the generator <b>Under Maintenance</b> and the fault <b>Under Maintenance</b> for your manager.</p>
          <Button variant="accent" onClick={() => { const e = startWork(wo.id); toast(e ?? "Work started"); }}><Play size={16} />Start work</Button></Card>
      )}
      {wo.status === "On Hold" && (
        <Card className="mb-5 border-2 border-accent"><h2 className="mb-1 font-bold">Task is on hold</h2><p className="mb-3 text-sm">{holdEntry?.text ?? "Placed on hold."}</p>
          <Button variant="accent" onClick={() => { const e = resumeTask(wo.id); toast(e ?? "Work resumed"); }}><Play size={16} />Resume work</Button></Card>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {working && (
            <Card>
              <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Progress note & observations</h2><Button size="sm" variant="outline" onClick={() => setHoldOpen(true)}><Pause size={14} />Put on hold</Button></div>
              <div className="space-y-3">
                <Field label="Work performed / observation" error={noteErr}><Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Drained coolant, cleaned radiator fins, found thermostat stuck half-open…" /></Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Diagnosis"><Select value={diagnosis} onChange={(e) => setDiagnosis(e.target.value as typeof diagnosis)}><option>Not assessed</option><option value="Confirmed">Confirmed as predicted{fault ? ` (${fault.faultType})` : ""}</option><option value="Changed">Changed – different fault found</option></Select></Field>
                  {diagnosis === "Changed" && <Field label="Corrected fault type"><Select value={newType} onChange={(e) => setNewType(e.target.value)}><option value="">Select…</option><Options list={faultTypes} /></Select></Field>}
                </div>
                <details className="rounded-md border border-ink/25 p-3">
                  <summary className="cursor-pointer text-sm font-medium">Record readings (optional)</summary>
                  <p className="mt-1 text-xs opacity-70">Placeholder channels for the {sub.toLowerCase()} – the final list comes from the confirmed dataset schema.</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {readingFields.map(([k, m]) => <Field key={k} label={`${m.label}${m.unit ? ` (${m.unit})` : ""}`}><Input type="number" step="any" value={readings[k] ?? ""} onChange={(e) => setReadings({ ...readings, [k]: e.target.value })} /></Field>)}
                  </div>
                </details>
                <div className="flex justify-end"><Button onClick={saveNote}>Send update</Button></div>
              </div>
            </Card>
          )}

          <Card>
            <h2 className="mb-3 font-bold">Parts used</h2>
            <ul className="mb-3 divide-y divide-ink/15 text-sm">
              {wo.usedParts.length === 0 && <li className="py-2 opacity-70">No parts recorded yet.</li>}
              {wo.usedParts.map((u) => (
                <li key={u.partId} className="flex items-center justify-between py-2"><span>{pname(u.partId)}</span><span className="flex items-center gap-2"><b>× {u.qty}</b>{(working || wo.status === "On Hold") && <Button size="sm" variant="ghost" aria-label={`Remove ${pname(u.partId)}`} onClick={() => removePartUsage(wo.id, u.partId)}><Trash2 size={14} /></Button>}</span></li>
              ))}
            </ul>
            {(working || wo.status === "On Hold") && (
              <div className="grid gap-3 border-t border-ink/20 pt-3 sm:grid-cols-3">
                <Field label="Part" className="sm:col-span-2"><Select value={selPartId} onChange={(e) => setPartId(e.target.value)}>{parts.map((p) => <option key={p.id} value={p.id}>{p.name} — {room(p.id)} {p.unit} usable</option>)}</Select></Field>
                <Field label="Quantity" error={partErr}><Input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} /></Field>
                <div className="flex flex-wrap items-center gap-2 sm:col-span-3"><Button variant="outline" onClick={addPart}>Record usage</Button><LinkButton variant="ghost" href={`/technician/part-requests?task=${wo.id}`}>Need a part that is not available? Request it</LinkButton></div>
                <p className="text-xs opacity-70 sm:col-span-3">Stock is deducted when you complete the task.</p>
              </div>
            )}
          </Card>

          {working && (
            <Card className="border-2 border-accent">
              <h2 className="mb-3 font-bold">Complete task</h2>
              <div className="space-y-3">
                <Field label="Work summary" error={doneErr} hint="What was wrong, what you did, and the result of the post-repair test."><Textarea rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} /></Field>
                <Field label="Outcome"><Select value={outcome} onChange={(e) => setOutcome(e.target.value as TaskOutcome)}><Options list={TASK_OUTCOMES} /></Select></Field>
                <Field label="Recommendations for the manager (optional)"><Textarea value={recs} onChange={(e) => setRecs(e.target.value)} /></Field>
                <p className="text-xs opacity-70">Completion time is stamped automatically when you submit. Parts used: {wo.usedParts.length ? wo.usedParts.map((u) => `${u.qty} × ${pname(u.partId)}`).join(", ") : "none recorded"}.</p>
                <Button variant="accent" className="w-full sm:w-auto" onClick={askComplete}>Submit completion</Button>
              </div>
            </Card>
          )}
        </div>

        <Card className="h-fit">
          <h2 className="mb-3 font-bold">Activity</h2>
          <ol className="space-y-3 border-l-2 border-ink/30 pl-4">{[...wo.timeline].reverse().map((t) => <li key={t.id} className="relative text-sm"><span className="absolute -left-[22px] top-1.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-ink" /><div className="font-medium">{t.text} {t.status && <StatusBadge status={t.status} />}</div><div className="text-xs opacity-70">{fmt(t.at)} · {t.by}</div></li>)}</ol>
        </Card>
      </div>

      <Modal open={holdOpen} onClose={() => setHoldOpen(false)} title="Put task on hold">
        <div className="space-y-3">
          <Field label="Why is the work blocked?" error={holdErr}><Textarea value={holdReason} onChange={(e) => setHoldReason(e.target.value)} placeholder="e.g. Waiting for fuel injector delivery…" /></Field>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setHoldOpen(false)}>Cancel</Button><Button variant="accent" onClick={doHold}>Put on hold</Button></div>
        </div>
      </Modal>
      <ConfirmDialog open={confirmOpen} title="Submit completion?" confirmLabel="Complete task"
        message={`${wo.id} will be marked Completed (${outcome}). ${outcome === "Fault rectified" ? "The fault will be resolved and the generator set to Running." : "The fault stays open for the manager to schedule follow-up work."} Stock is updated for the parts you recorded.`}
        onCancel={() => setConfirmOpen(false)} onConfirm={doComplete} />
    </>
  );
}