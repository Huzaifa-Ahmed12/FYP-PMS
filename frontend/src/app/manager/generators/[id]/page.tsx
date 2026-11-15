"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, EmptyState, LinkButton, PageHeader, SeverityBadge, StatusBadge } from "@/components/ui";
import MapClient from "@/components/MapClient";
import { useStore } from "@/lib/store";
import { READING_META } from "@/lib/config";
import { ago, fmt, fmtDate } from "@/lib/utils";

export default function GeneratorDetail() {
  const { id } = useParams<{ id: string }>();
  const { generators, faults, workOrders, history, technicians } = useStore();
  const g = generators.find((x) => x.id === id);
  if (!g) return <EmptyState title="Asset not found" text="It may have been removed or the ID is wrong." />;

  const gFaults = faults.filter((f) => f.assetId === g.id);
  const gTasks = workOrders.filter((w) => w.assetId === g.id);
  const timeline = history.filter((h) => h.assetId === g.id).slice(0, 12);
  const info: [string, string | number][] = [["Model", g.model], ["Serial number", g.serialNumber || "—"], ["Rated capacity", `${g.ratedCapacityKva} kVA`], ["Site", g.siteName], ["Address", g.address], ["Coordinates", `${g.lat}, ${g.lng}`], ["Installed", fmtDate(g.installDate)], ["Last diagnostic", `${fmt(g.lastDiagnosticAt)} (${ago(g.lastDiagnosticAt)})`]];

  return (
    <>
      <PageHeader title={g.id} subtitle={`${g.siteName} · ${g.model}`}
        actions={<><LinkButton href="/manager/diagnostics" variant="outline">Run simulated diagnostic</LinkButton><LinkButton href="/manager/generators" variant="outline">Back to list</LinkButton></>} />
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <span className="flex items-center gap-2">Operating status: <StatusBadge status={g.operationalStatus} /></span>
        <span className="flex items-center gap-2">Diagnostic health: <SeverityBadge severity={g.health} /></span>
        {!g.active && <StatusBadge status="Stopped" />}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card><h2 className="mb-3 font-bold">Overview</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">{info.map(([k, v]) => <div key={k}><dt className="text-xs opacity-70">{k}</dt><dd className="font-medium">{v}</dd></div>)}</dl>
          {g.notes && <p className="mt-3 text-sm italic">{g.notes}</p>}
        </Card>
        <Card><h2 className="mb-3 font-bold">Location</h2>
          <MapClient height="260px" points={[{ id: g.id, lat: g.lat, lng: g.lng, kind: "generator", severity: g.health, label: g.id, popup: <div className="text-sm"><b>{g.id}</b><br />{g.siteName}<br />{g.operationalStatus} · {g.health}</div> }]} />
        </Card>

        <Card className="lg:col-span-2"><h2 className="mb-3 font-bold">Latest readings</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {Object.entries(g.latestReadings).map(([k, v]) => <div key={k} className="rounded border border-ink/20 p-2"><div className="text-xs opacity-70">{READING_META[k]?.label ?? k}</div><div className="font-bold">{v} <span className="text-xs font-normal">{READING_META[k]?.unit}</span></div></div>)}
          </div>
          <p className="mt-2 text-xs opacity-70">Placeholder channels – final list depends on the confirmed dataset and instrumentation.</p>
        </Card>

        <Card><h2 className="mb-3 font-bold">Faults ({gFaults.length})</h2>
          {gFaults.length === 0 ? <p className="text-sm">No faults recorded.</p> : <ul className="divide-y divide-ink/15">{gFaults.map((f) => <li key={f.id} className="flex items-center justify-between gap-2 py-2 text-sm"><div><b>{f.id}</b> · {f.faultType}<div className="text-xs opacity-70">{ago(f.reportedAt)} · {f.source}</div></div><div className="flex gap-1"><SeverityBadge severity={f.severity} /><StatusBadge status={f.status} /></div></li>)}</ul>}
        </Card>
        <Card><h2 className="mb-3 font-bold">Assigned tasks ({gTasks.length})</h2>
          {gTasks.length === 0 ? <p className="text-sm">No tasks.</p> : <ul className="divide-y divide-ink/15">{gTasks.map((w) => <li key={w.id} className="flex items-center justify-between gap-2 py-2 text-sm"><div><Link href={`/manager/tasks/${w.id}`} className="font-semibold underline">{w.id}</Link> · {w.title}<div className="text-xs opacity-70">{technicians.find((t) => t.id === w.assignedTo)?.name ?? "Unassigned"}</div></div><StatusBadge status={w.status} /></li>)}</ul>}
        </Card>

        <Card className="lg:col-span-2"><h2 className="mb-3 font-bold">Maintenance timeline</h2>
          <ol className="space-y-3 border-l-2 border-ink/30 pl-4">{timeline.map((h) => <li key={h.id} className="relative text-sm"><span className="absolute -left-[22px] top-1.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-ink" /><div className="font-medium">{h.title}</div><div className="text-xs opacity-70">{fmt(h.at)} · {h.type} · {h.detail}</div></li>)}</ol>
        </Card>
      </div>
    </>
  );
}