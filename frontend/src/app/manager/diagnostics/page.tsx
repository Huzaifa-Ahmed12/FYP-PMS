"use client";
import { useState } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Play } from "lucide-react";
import { Badge, Button, Card, Field, LinkButton, Modal, Options, PageHeader, Select, SeverityBadge, Tabs, toast } from "@/components/ui";
import { DataTable } from "@/components/DataTable";
import { useStore } from "@/lib/store";
import { useSimulatedLoad } from "@/lib/hooks";
import { FAULT_CATALOG, READING_META } from "@/lib/config";
import { simulateDiagnostic } from "@/lib/services";
import { fmt } from "@/lib/utils";
import type { DataSource, DiagnosticRecord, Subsystem } from "@/lib/types";

const TABS = ["All", "Alternator", "Engine"] as const;

export default function DiagnosticsPage() {
  const { diagnostics, generators, faults, recordDiagnostic } = useStore();
  const loading = useSimulatedLoad();
  const [tab, setTab] = useState<(typeof TABS)[number]>("All");
  const [selected, setSelected] = useState<DiagnosticRecord | null>(null);
  const [simOpen, setSimOpen] = useState(false);
  const [asset, setAsset] = useState("");
  const [sub, setSub] = useState<Subsystem>("Engine");
  const [cls, setCls] = useState("random");
  const [src, setSrc] = useState<DataSource>("SIMULATION");

  const classes = Object.keys(FAULT_CATALOG).filter((c) => FAULT_CATALOG[c].subsystem === sub);
  const data = diagnostics.filter((d) => tab === "All" || d.subsystem === tab);

  function run() {
    const target = asset || generators.find((g) => g.active)?.id;
    if (!target) return toast("Register an asset first");
    const chosen = cls === "random" ? classes[Math.floor(Math.random() * classes.length)] : cls;
    const { diagnostic } = recordDiagnostic(simulateDiagnostic(target, sub, chosen, src));
    setSimOpen(false); setSelected(diagnostic);
    toast(`Diagnostic ${diagnostic.id} recorded${diagnostic.severity !== "Normal" ? " – alert raised" : ""}`);
  }

  const columns: ColumnDef<DiagnosticRecord>[] = [
    { id: "t", header: "Time", accessorFn: (d) => d.timestamp, cell: ({ row }) => fmt(row.original.timestamp) },
    { header: "Asset", accessorFn: (d) => d.assetId },
    { header: "Subsystem", accessorFn: (d) => d.subsystem },
    { header: "Predicted class", accessorFn: (d) => d.predictedClass },
    { id: "c", header: "Confidence", accessorFn: (d) => d.confidence, cell: ({ row }) => `${Math.round(row.original.confidence * 100)}%` },
    { id: "s", header: "Severity", accessorFn: (d) => d.severity, cell: ({ row }) => <SeverityBadge severity={row.original.severity} /> },
    { header: "Source", accessorFn: (d) => d.dataSource },
    { header: "Model", accessorFn: (d) => d.modelName },
  ];

  const linkedFault = selected && faults.find((f) => f.diagnosticId === selected.id);

  return (
    <>
      <PageHeader title="Diagnostics" subtitle="Model predictions per subsystem. Inference is mocked until the ML pipeline is connected."
        actions={<Button variant="accent" onClick={() => setSimOpen(true)}><Play size={15} />Run simulated diagnostic</Button>} />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      <DataTable data={data} columns={columns} loading={loading} onRowClick={setSelected} searchPlaceholder="Search asset, class, model…" emptyTitle="No diagnostic records" />

      <Modal open={simOpen} onClose={() => setSimOpen(false)} title="Simulated diagnostic (mock input → mock result)">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Asset"><Select value={asset} onChange={(e) => setAsset(e.target.value)}>{generators.filter((g) => g.active).map((g) => <option key={g.id} value={g.id}>{g.id}</option>)}</Select></Field>
          <Field label="Subsystem"><Select value={sub} onChange={(e) => { setSub(e.target.value as Subsystem); setCls("random"); }}><Options list={["Engine", "Alternator"]} /></Select></Field>
          <Field label="Scenario (predicted class)"><Select value={cls} onChange={(e) => setCls(e.target.value)}><option value="random">Random</option><Options list={classes} /></Select></Field>
          <Field label="Data source"><Select value={src} onChange={(e) => setSrc(e.target.value as DataSource)}><Options list={["SIMULATION", "CSV_UPLOAD", "API", "SENSOR_GATEWAY"]} /></Select></Field>
        </div>
        <p className="mt-3 text-xs opacity-70">Request/response mirrors the contract in requirements §8.3 so the real endpoint can replace this later.</p>
        <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setSimOpen(false)}>Cancel</Button><Button onClick={run}>Run diagnostic</Button></div>
      </Modal>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? `Diagnostic ${selected.id}` : ""} wide>
        {selected && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3"><SeverityBadge severity={selected.severity} /><b>{selected.predictedClass}</b><Badge tone="outline">{selected.subsystem}</Badge></div>
            <Card><div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              {([["Asset", selected.assetId], ["Timestamp", fmt(selected.timestamp)], ["Confidence", `${Math.round(selected.confidence * 100)}%`], ["Model", `${selected.modelName} v${selected.modelVersion}`], ["Data source", selected.dataSource], ["Validation", selected.validation]] as const).map(([k, v]) => <div key={k}><div className="text-xs opacity-70">{k}</div><b>{v}</b></div>)}
            </div></Card>
            <div><h3 className="mb-2 font-semibold">Input summary</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{Object.entries(selected.inputSummary).map(([k, v]) => <div key={k} className="rounded border border-ink/20 p-2 text-sm"><div className="text-xs opacity-70">{READING_META[k]?.label ?? k}</div><b>{v} {READING_META[k]?.unit}</b></div>)}</div></div>
            <Card className="border-accent"><b>Recommended action</b><p className="text-sm">{FAULT_CATALOG[selected.predictedClass]?.action}</p></Card>
            <div className="flex flex-wrap justify-end gap-2">
              {linkedFault && <LinkButton variant="outline" href="/manager/faults">View fault {linkedFault.id}</LinkButton>}
              {linkedFault && !linkedFault.workOrderId && <LinkButton variant="accent" href={`/manager/recommendations?fault=${linkedFault.id}`}>Recommend technician</LinkButton>}
              <Link href={`/manager/generators/${selected.assetId}`} className="self-center text-sm underline">Open asset</Link>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}