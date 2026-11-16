"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { CheckCircle2, Clock, Download, Package } from "lucide-react";
import { Badge, Button, Card, Options, PageHeader, Select, SeverityBadge, StatCard, StatusBadge } from "@/components/ui";
import { DataTable } from "@/components/DataTable";
import { useStore } from "@/lib/store";
import { useTechnician } from "@/lib/use-technician";
import { useSimulatedLoad } from "@/lib/hooks";
import { SEVERITIES } from "@/lib/config";
import { downloadCsv, fmt } from "@/lib/utils";
import type { WorkOrder } from "@/lib/types";

export default function TechnicianHistory() {
  const { id } = useTechnician();
  const router = useRouter();
  const { workOrders, history, generators } = useStore();
  const loading = useSimulatedLoad(300);
  const [asset, setAsset] = useState("all");
  const [sev, setSev] = useState("all");

  const closed = workOrders.filter((w) => w.assignedTo === id && (w.status === "Completed" || w.status === "Cancelled"));
  const done = closed.filter((w) => w.status === "Completed" && w.completedAt);
  const avgHrs = done.length ? done.reduce((s, w) => s + (new Date(w.completedAt!).getTime() - new Date(w.createdAt).getTime()) / 36e5, 0) / done.length : 0;
  const partsUsed = done.reduce((s, w) => s + w.usedParts.reduce((a, u) => a + u.qty, 0), 0);
  const data = closed.filter((w) => (asset === "all" || w.assetId === asset) && (sev === "all" || w.severity === sev));
  const activity = history.filter((h) => h.technicianId === id).slice(0, 8);

  const columns: ColumnDef<WorkOrder>[] = [
    { id: "id", header: "Task", accessorFn: (w) => w.id, cell: ({ row }) => <span className="font-semibold underline">{row.original.id}</span> },
    { header: "Title", accessorFn: (w) => w.title }, { header: "Asset", accessorFn: (w) => w.assetId },
    { id: "sev", header: "Severity", accessorFn: (w) => w.severity, cell: ({ row }) => <SeverityBadge severity={row.original.severity} /> },
    { id: "st", header: "Status", accessorFn: (w) => w.status, cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { id: "c", header: "Closed", accessorFn: (w) => w.completedAt ?? w.createdAt, cell: ({ row }) => fmt(row.original.completedAt ?? row.original.createdAt) },
    { id: "p", header: "Parts used", accessorFn: (w) => w.usedParts.reduce((a, u) => a + u.qty, 0) },
  ];

  return (
    <>
      <PageHeader title="Task History" subtitle="Your completed and cancelled work orders."
        actions={<Button variant="outline" onClick={() => downloadCsv("my-task-history.csv", data.map((w) => ({ Task: w.id, Title: w.title, Asset: w.assetId, Severity: w.severity, Status: w.status, Closed: w.completedAt ?? "", Summary: w.workSummary ?? "" })))}><Download size={15} />Export CSV</Button>} />
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Completed tasks" value={done.length} icon={<CheckCircle2 size={16} />} />
        <StatCard label="Avg. time to complete" value={done.length ? `${avgHrs.toFixed(1)} h` : "—"} icon={<Clock size={16} />} hint="From work order creation" />
        <StatCard label="Parts used" value={partsUsed} icon={<Package size={16} />} hint="Total quantity" />
      </div>
      <DataTable data={data} columns={columns} loading={loading} onRowClick={(w) => router.push(`/technician/tasks/${w.id}`)} searchPlaceholder="Search history…" emptyTitle="No closed tasks yet"
        toolbar={<>
          <Select aria-label="Asset filter" className="w-36" value={asset} onChange={(e) => setAsset(e.target.value)}><option value="all">All assets</option><Options list={generators.map((g) => g.id)} /></Select>
          <Select aria-label="Severity filter" className="w-36" value={sev} onChange={(e) => setSev(e.target.value)}><option value="all">All severities</option><Options list={SEVERITIES} /></Select>
        </>} />
      <Card className="mt-6">
        <h2 className="mb-2 font-bold">Recent activity</h2>
        {activity.length === 0 ? <p className="text-sm opacity-70">No activity yet.</p> : (
          <ul className="divide-y divide-ink/15 text-sm">{activity.map((h) => <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span><Badge tone="outline" className="mr-2">{h.type}</Badge>{h.title}<span className="block text-xs opacity-70">{h.detail}</span></span><span className="text-xs opacity-60">{fmt(h.at)}</span></li>)}</ul>
        )}
      </Card>
    </>
  );
}