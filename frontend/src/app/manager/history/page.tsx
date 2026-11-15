"use client";
import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Download } from "lucide-react";
import { Badge, Button, Card, Field, Input, Options, PageHeader, Select, SeverityBadge } from "@/components/ui";
import { DataTable } from "@/components/DataTable";
import { useStore } from "@/lib/store";
import { useSimulatedLoad } from "@/lib/hooks";
import { FAULT_CATALOG, SEVERITIES } from "@/lib/config";
import { downloadCsv, fmt } from "@/lib/utils";
import type { HistoryEvent } from "@/lib/types";

export default function HistoryPage() {
  const { history, generators, technicians } = useStore();
  const loading = useSimulatedLoad();
  const [f, setF] = useState({ from: "", to: "", asset: "all", sub: "all", fault: "all", sev: "all", tech: "all", type: "all" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const data = history.filter((h) => {
    const t = new Date(h.at).getTime();
    return (!f.from || t >= new Date(f.from).getTime()) && (!f.to || t <= new Date(f.to).getTime() + 864e5)
      && (f.asset === "all" || h.assetId === f.asset) && (f.sub === "all" || h.subsystem === f.sub) && (f.fault === "all" || h.faultType === f.fault)
      && (f.sev === "all" || h.severity === f.sev) && (f.tech === "all" || h.technicianId === f.tech) && (f.type === "all" || h.type === f.type);
  });
  const tn = (id?: string) => technicians.find((t) => t.id === id)?.name ?? "";

  const columns: ColumnDef<HistoryEvent>[] = [
    { id: "t", header: "Time", accessorFn: (h) => h.at, cell: ({ row }) => fmt(row.original.at) },
    { id: "ty", header: "Type", accessorFn: (h) => h.type, cell: ({ row }) => <Badge tone="outline">{row.original.type}</Badge> },
    { header: "Asset", accessorFn: (h) => h.assetId }, { header: "Event", accessorFn: (h) => h.title }, { header: "Detail", accessorFn: (h) => h.detail },
    { id: "s", header: "Severity", accessorFn: (h) => h.severity ?? "", cell: ({ row }) => row.original.severity ? <SeverityBadge severity={row.original.severity} /> : "—" },
    { header: "Technician", accessorFn: (h) => tn(h.technicianId) },
  ];

  return (
    <>
      <PageHeader title="Maintenance History" subtitle="Unified diagnostic, fault, task, assignment and parts timeline."
        actions={<Button variant="outline" onClick={() => downloadCsv("maintenance-history.csv", data.map((h) => ({ Time: h.at, Type: h.type, Asset: h.assetId, Event: h.title, Detail: h.detail, Severity: h.severity ?? "", Technician: tn(h.technicianId) })))}><Download size={15} />Export CSV</Button>} />
      <Card className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="From"><Input type="date" value={f.from} onChange={set("from")} /></Field>
        <Field label="To"><Input type="date" value={f.to} onChange={set("to")} /></Field>
        <Field label="Asset"><Select value={f.asset} onChange={set("asset")}><option value="all">All</option><Options list={generators.map((g) => g.id)} /></Select></Field>
        <Field label="Event type"><Select value={f.type} onChange={set("type")}><option value="all">All</option><Options list={["Diagnostic", "Fault", "Task", "Parts", "Assignment", "Generator"]} /></Select></Field>
        <Field label="Subsystem"><Select value={f.sub} onChange={set("sub")}><option value="all">All</option><Options list={["Alternator", "Engine"]} /></Select></Field>
        <Field label="Fault type"><Select value={f.fault} onChange={set("fault")}><option value="all">All</option><Options list={Object.keys(FAULT_CATALOG).filter((c) => FAULT_CATALOG[c].severity !== "Normal")} /></Select></Field>
        <Field label="Severity"><Select value={f.sev} onChange={set("sev")}><option value="all">All</option><Options list={SEVERITIES} /></Select></Field>
        <Field label="Technician"><Select value={f.tech} onChange={set("tech")}><option value="all">All</option>{technicians.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
      </Card>
      <DataTable data={data} columns={columns} loading={loading} pageSize={10} searchPlaceholder="Search history…" emptyTitle="No events match the filters" />
    </>
  );
}