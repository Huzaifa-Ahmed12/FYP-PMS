"use client";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, Printer } from "lucide-react";
import { Button, Card, PageHeader, StatCard } from "@/components/ui";
import { useStore } from "@/lib/store";
import { SEVERITIES } from "@/lib/config";
import { availableQty } from "@/lib/services";
import { downloadCsv } from "@/lib/utils";

const INK = "#14213d", ACCENT = "#fca311";
const tip = { contentStyle: { background: "#e5e5e5", border: "1px solid #14213d" } };
const tick = { fill: INK, fontSize: 12 };

export default function ReportsPage() {
  const { faults, workOrders, parts, technicians, diagnostics } = useStore();
  const resolved = faults.filter((f) => f.status === "Resolved").length;
  const done = workOrders.filter((w) => w.status === "Completed" && w.completedAt);
  const mttr = done.length ? done.reduce((s, w) => s + (new Date(w.completedAt!).getTime() - new Date(w.createdAt).getTime()), 0) / done.length / 3_600_000 : 0;
  const lowCount = parts.filter((p) => availableQty(p, workOrders) <= p.minStock).length;

  const bySeverity = SEVERITIES.filter((s) => s !== "Normal").map((s) => ({ name: s, count: faults.filter((f) => f.severity === s).length }));
  const bySubsystem = (["Alternator", "Engine"] as const).map((s) => ({ name: s, value: faults.filter((f) => f.subsystem === s).length }));
  const byTech = technicians.map((t) => ({
    name: t.name.split(" ")[0],
    completed: workOrders.filter((w) => w.assignedTo === t.id && w.status === "Completed").length,
    active: workOrders.filter((w) => w.assignedTo === t.id && !["Completed", "Cancelled"].includes(w.status)).length,
  }));
  const usage = parts
    .map((p) => ({ name: p.name, used: done.flatMap((w) => w.usedParts).filter((u) => u.partId === p.id).reduce((s, u) => s + u.qty, 0) }))
    .filter((x) => x.used > 0);

  return (
    <>
      <PageHeader title="Reports" subtitle="Summary analytics with CSV export and print/PDF."
        actions={<>
          <Button variant="outline" onClick={() => downloadCsv("faults.csv", faults.map((f) => ({ ID: f.id, Asset: f.assetId, Type: f.faultType, Subsystem: f.subsystem, Severity: f.severity, Source: f.source, Status: f.status, Reported: f.reportedAt })))}><Download size={15} />Faults CSV</Button>
          <Button variant="outline" onClick={() => downloadCsv("work-orders.csv", workOrders.map((w) => ({ ID: w.id, Asset: w.assetId, Title: w.title, Severity: w.severity, Priority: w.priority, Status: w.status, Technician: technicians.find((t) => t.id === w.assignedTo)?.name ?? "", Created: w.createdAt, Completed: w.completedAt ?? "" })))}><Download size={15} />Work orders CSV</Button>
          <Button variant="outline" onClick={() => downloadCsv("diagnostics.csv", diagnostics.map((d) => ({ ID: d.id, Asset: d.assetId, Subsystem: d.subsystem, Class: d.predictedClass, Confidence: d.confidence, Severity: d.severity, Source: d.dataSource, Time: d.timestamp })))}><Download size={15} />Diagnostics CSV</Button>
          <Button onClick={() => window.print()}><Printer size={15} />Print / PDF</Button>
        </>} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total faults" value={faults.length} />
        <StatCard label="Resolved" value={faults.length ? `${Math.round((resolved / faults.length) * 100)}%` : "—"} hint={`${resolved} of ${faults.length}`} />
        <StatCard label="Avg. time to complete" value={done.length ? `${mttr.toFixed(1)} h` : "—"} hint="Created → completed" />
        <StatCard label="Tasks completed" value={done.length} />
        <StatCard label="Low-stock parts" value={lowCount} emphasis={lowCount > 0} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 font-bold">Faults by severity</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={bySeverity}><CartesianGrid strokeDasharray="3 3" stroke="#14213d33" /><XAxis dataKey="name" tick={tick} /><YAxis allowDecimals={false} tick={tick} /><Tooltip {...tip} /><Bar dataKey="count" fill={INK} /></BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <h2 className="mb-2 font-bold">Faults by subsystem</h2>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={bySubsystem} dataKey="value" nameKey="name" outerRadius={90} label stroke={INK}>{bySubsystem.map((_, i) => <Cell key={i} fill={i === 0 ? ACCENT : INK} />)}</Pie>
              <Tooltip {...tip} /><Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <h2 className="mb-2 font-bold">Tasks per technician</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byTech}><CartesianGrid strokeDasharray="3 3" stroke="#14213d33" /><XAxis dataKey="name" tick={tick} /><YAxis allowDecimals={false} tick={tick} /><Tooltip {...tip} /><Legend /><Bar dataKey="completed" fill={INK} /><Bar dataKey="active" fill={ACCENT} /></BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <h2 className="mb-2 font-bold">Parts consumed (completed tasks)</h2>
          {usage.length === 0 ? <p className="text-sm opacity-70">No parts consumed yet.</p> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={usage} layout="vertical" margin={{ left: 40 }}><CartesianGrid strokeDasharray="3 3" stroke="#14213d33" /><XAxis type="number" allowDecimals={false} tick={tick} /><YAxis type="category" dataKey="name" width={130} tick={tick} /><Tooltip {...tip} /><Bar dataKey="used" fill={INK} /></BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </>
  );
}