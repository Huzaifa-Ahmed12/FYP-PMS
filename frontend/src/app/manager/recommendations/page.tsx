"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Badge, Button, Card, ConfirmDialog, EmptyState, Field, PageHeader, ProgressBar, SeverityBadge, StatusBadge, Textarea, cn, toast } from "@/components/ui";
import MapClient, { type MapPoint } from "@/components/MapClient";
import { useStore } from "@/lib/store";
import { useQueryParam } from "@/lib/hooks";
import { DEFAULT_WEIGHTS, WEIGHT_LABELS, recommendTechnicians, type Weights } from "@/lib/services";
import { FAULT_CATALOG } from "@/lib/config";
import { ago } from "@/lib/utils";

export default function RecommendationsPage() {
  const { workOrders, faults, generators, technicians, createWorkOrder, assignWorkOrder } = useStore();
  const qWo = useQueryParam("wo");
  const qFault = useQueryParam("fault");
  const [selWo, setSelWo] = useState<string | null>(null);
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [compare, setCompare] = useState<string[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);

  const queue = workOrders.filter((w) => w.status === "Pending Assignment" || w.status === "Assigned");
  const fromFault = faults.find((f) => f.id === qFault)?.workOrderId;
  const woId = selWo ?? fromFault ?? qWo ?? queue[0]?.id ?? null;
  const wo = workOrders.find((w) => w.id === woId);
  const gen = generators.find((g) => g.id === wo?.assetId);
  const unlinked = faults.filter((f) => f.status !== "Resolved" && !f.workOrderId);

  const cands = useMemo(() => (wo && gen ? recommendTechnicians(wo.requiredSkills, gen, technicians, workOrders, weights) : []), [wo, gen, technicians, workOrders, weights]);
  const top = cands[0];
  const pick = cands.find((c) => c.tech.id === chosen);
  const override = !!pick && !!top && pick.tech.id !== top.tech.id;
  const total = Object.values(weights).reduce((a, b) => a + b, 0) || 1;

  function createFromFault(fid: string) {
    const f = faults.find((x) => x.id === fid)!;
    const id = createWorkOrder({
      assetId: f.assetId, faultId: f.id, title: `${f.faultType} – ${f.assetId}`, description: FAULT_CATALOG[f.faultType]?.action ?? f.description, severity: f.severity,
      priority: f.severity === "Critical" ? "Urgent" : f.severity === "High" ? "High" : "Medium",
      requiredSkills: FAULT_CATALOG[f.faultType]?.skills ?? [], dueDate: new Date(Date.now() + (f.severity === "Critical" ? 1 : f.severity === "High" ? 3 : 7) * 864e5).toISOString().slice(0, 10), notes: "",
    });
    setSelWo(id); setChosen(null); toast(`Work order ${id} created`);
  }

  const points: MapPoint[] = gen ? [
    { id: gen.id, lat: gen.lat, lng: gen.lng, kind: "generator", severity: gen.health, label: gen.id, popup: <b>{gen.id} · {gen.siteName}</b> },
    ...cands.slice(0, 6).map((c): MapPoint => ({ id: c.tech.id, lat: c.tech.lat, lng: c.tech.lng, kind: "technician", label: c.tech.name, highlight: c.tech.id === chosen, popup: <div className="text-sm"><b>{c.tech.name}</b><br />{c.distanceKm} km · score {c.score}</div> })),
  ] : [];
  const lines: [number, number][][] = gen && pick ? [[[gen.lat, gen.lng], [pick.tech.lat, pick.tech.lng]]] : [];
  const compared = cands.filter((c) => compare.includes(c.tech.id));

  return (
    <>
      <PageHeader title="Technician Recommendations" subtitle="Score = w1·Skill + w2·Availability + w3·Proximity + w4·Workload + w5·Experience. The engine only recommends – you approve." />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4">
          <Card>
            <h2 className="mb-2 font-bold">Work orders to assign</h2>
            {queue.length === 0 && <p className="text-sm opacity-70">Nothing waiting for assignment.</p>}
            <ul className="space-y-1">{queue.map((w) => <li key={w.id}><button onClick={() => { setSelWo(w.id); setChosen(null); setCompare([]); }} className={cn("w-full rounded border p-2 text-left text-sm", w.id === woId ? "border-ink bg-accent/30" : "border-ink/25 hover:bg-ink/10")}><div className="flex items-center justify-between"><b>{w.id}</b><SeverityBadge severity={w.severity} /></div><div>{w.title}</div><div className="text-xs opacity-70"><StatusBadge status={w.status} /> {w.assignedTo ? "(reassign)" : ""}</div></button></li>)}</ul>
          </Card>
          <Card>
            <h2 className="mb-2 font-bold">Faults without a work order</h2>
            {unlinked.length === 0 && <p className="text-sm opacity-70">None.</p>}
            <ul className="space-y-2">{unlinked.map((f) => <li key={f.id} className={cn("rounded border p-2 text-sm", f.id === qFault ? "border-ink bg-accent/30" : "border-ink/25")}><div className="flex items-center justify-between"><b>{f.id} · {f.assetId}</b><SeverityBadge severity={f.severity} /></div><div>{f.faultType}</div><Button size="sm" variant="accent" className="mt-1" onClick={() => createFromFault(f.id)}>Create work order</Button></li>)}</ul>
          </Card>
          <Card>
            <div className="mb-2 flex items-center justify-between"><h2 className="font-bold">Scoring weights</h2><Button size="sm" variant="ghost" onClick={() => setWeights(DEFAULT_WEIGHTS)}>Reset</Button></div>
            {(Object.keys(weights) as (keyof Weights)[]).map((k) => (
              <label key={k} className="mb-2 block text-sm"><div className="flex justify-between"><span>{WEIGHT_LABELS[k]}</span><b>{Math.round((weights[k] / total) * 100)}%</b></div><input type="range" min={0} max={100} value={weights[k]} onChange={(e) => setWeights({ ...weights, [k]: Number(e.target.value) })} className="w-full accent-ink" /></label>
            ))}
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-2">
          {!wo || !gen ? <EmptyState title="Select a work order" text="Pick a work order on the left, or create one from a fault." /> : (
            <>
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-2"><div><div className="font-bold">{wo.id} · {wo.title}</div><div className="text-sm opacity-80">{gen.id} · {gen.siteName} · due {wo.dueDate}</div></div><div className="flex gap-2"><SeverityBadge severity={wo.severity} /><StatusBadge status={wo.priority} /></div></div>
                <div className="mt-2 flex flex-wrap items-center gap-1 text-sm">Required skills: {wo.requiredSkills.length ? wo.requiredSkills.map((s) => <Badge key={s} tone="accent">{s}</Badge>) : <i>none</i>}</div>
                <p className="mt-2 text-sm">{wo.description}</p>
              </Card>

              <Card className="p-0">
                <div className="overflow-x-auto"><table className="w-full text-sm">
                  <thead className="bg-ink text-paper"><tr><th className="p-2 text-left">Pick</th><th className="p-2 text-left">#</th><th className="p-2 text-left">Technician</th><th className="p-2 text-left">Score</th><th className="p-2 text-left">Skill</th><th className="p-2 text-left">Dist.</th><th className="p-2 text-left">Load</th><th className="p-2 text-left">Exp.</th><th className="p-2 text-left">Compare</th></tr></thead>
                  <tbody>{cands.map((c, i) => (
                    <tr key={c.tech.id} className={cn("border-t border-ink/15", chosen === c.tech.id && "bg-accent/30", !c.eligible && "opacity-70")}>
                      <td className="p-2"><input type="radio" name="pick" aria-label={`Select ${c.tech.name}`} checked={chosen === c.tech.id} onChange={() => setChosen(c.tech.id)} className="accent-ink" /></td>
                      <td className="p-2 font-bold">{i + 1}</td>
                      <td className="p-2"><div className="font-semibold">{c.tech.name} {i === 0 && c.eligible && <Badge tone="ink">Top pick</Badge>}</div><div className="flex items-center gap-1 text-xs"><StatusBadge status={c.tech.availability} />{!c.eligible && <span>(not eligible)</span>}</div></td>
                      <td className="w-32 p-2"><div className="font-bold">{c.score}</div><ProgressBar value={c.score} accent /></td>
                      <td className="p-2">{c.matchedSkills.length}/{wo.requiredSkills.length || 0}</td>
                      <td className="p-2">{c.distanceKm} km</td>
                      <td className="p-2">{c.openTasks}/{c.tech.maxConcurrent}</td>
                      <td className="p-2">{c.tech.experienceYears} y</td>
                      <td className="p-2"><input type="checkbox" aria-label={`Compare ${c.tech.name}`} className="accent-ink" checked={compare.includes(c.tech.id)} disabled={!compare.includes(c.tech.id) && compare.length >= 3} onChange={(e) => setCompare(e.target.checked ? [...compare, c.tech.id] : compare.filter((x) => x !== c.tech.id))} /></td>
                    </tr>))}</tbody>
                </table></div>
              </Card>

              {compared.length >= 2 && (
                <Card><h3 className="mb-2 font-bold">Side-by-side factor comparison</h3>
                  <table className="w-full text-sm"><thead><tr><th className="p-1 text-left">Factor (weight)</th>{compared.map((c) => <th key={c.tech.id} className="p-1 text-left">{c.tech.name}</th>)}</tr></thead>
                    <tbody>{(Object.keys(weights) as (keyof Weights)[]).map((k) => <tr key={k} className="border-t border-ink/15"><td className="p-1">{WEIGHT_LABELS[k]} ({Math.round((weights[k] / total) * 100)}%)</td>{compared.map((c) => <td key={c.tech.id} className="p-1"><div className="flex items-center gap-2"><div className="w-20"><ProgressBar value={c.factors[k] * 100} /></div>{Math.round(c.factors[k] * 100)}% → <b>{((weights[k] / total) * c.factors[k] * 100).toFixed(1)}</b></div></td>)}</tr>)}
                      <tr className="border-t-2 border-ink"><td className="p-1 font-bold">Total score</td>{compared.map((c) => <td key={c.tech.id} className="p-1 font-bold">{c.score}</td>)}</tr></tbody></table>
                </Card>
              )}

              <Card className="p-2"><MapClient height="320px" points={points} lines={lines} /></Card>

              <Card className="border-ink">
                <h3 className="mb-2 font-bold">Manager decision</h3>
                {!pick ? <p className="text-sm">Select a technician above to approve.</p> : (
                  <div className="space-y-3">
                    <p className="text-sm">Selected: <b>{pick.tech.name}</b> (score {pick.score}). {override ? <Badge tone="dashed">Override of top recommendation ({top?.tech.name})</Badge> : <Badge tone="outline"><Check size={12} />Follows recommendation</Badge>}</p>
                    {!pick.eligible && <p className="text-sm font-semibold">⚠ This technician is currently unavailable or lacks a required skill.</p>}
                    {(override || !pick.eligible) && <Field label="Reason for override (required, min 5 characters)"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>}
                    <div className="flex justify-end"><Button variant="accent" disabled={(override || !pick.eligible) && reason.trim().length < 5} onClick={() => setConfirm(true)}>Approve & dispatch</Button></div>
                  </div>
                )}
                {wo.assignedTo && <p className="mt-2 text-xs opacity-70">Currently assigned to {technicians.find((t) => t.id === wo.assignedTo)?.name}. Approving will reassign. <Link className="underline" href={`/manager/tasks/${wo.id}`}>Open task</Link> · created {ago(wo.createdAt)}</p>}
              </Card>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog open={confirm} title="Dispatch work order?" message={`${wo?.id} will be assigned to ${pick?.tech.name} and appear in their account. This decision is logged with a timestamp.`} confirmLabel="Approve & dispatch"
        onCancel={() => setConfirm(false)}
        onConfirm={() => { if (wo && pick) { assignWorkOrder(wo.id, pick.tech.id, { recommendedId: top?.tech.id, score: pick.score, overrideReason: override || !pick.eligible ? reason : undefined }); toast(`${wo.id} dispatched to ${pick.tech.name}`); setChosen(null); setReason(""); setCompare([]); } setConfirm(false); }} />
    </>
  );
}