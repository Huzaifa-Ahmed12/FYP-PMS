"use client";
import { useState } from "react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ClipboardList, Inbox, OctagonAlert, Siren, UserCheck, Users, Zap } from "lucide-react";
import { Card, Field, Options, PageHeader, ProgressBar, Select, SeverityBadge, Skeleton, StatCard, StatusBadge } from "@/components/ui";
import { useStore } from "@/lib/store";
import { useSimulatedLoad } from "@/lib/hooks";
import { ago, fmt } from "@/lib/utils";
import { READING_META, SEVERITIES, SEV_RANK, TASK_STATUSES } from "@/lib/config";
import { ACTIVE_STATUSES, workloadOf } from "@/lib/services";
import type { Severity } from "@/lib/types";

export default function DashboardPage() {
  const { generators, diagnostics, faults, workOrders, technicians, partRequests } = useStore();
  const loading = useSimulatedLoad();
  const [site, setSite] = useState("all");
  const [assetId, setAssetId] = useState("all");
  const [days, setDays] = useState("30");

  const sites = [...new Set(generators.map((g) => g.siteName))];
  const assets = generators.filter((g) => g.active && (site === "all" || g.siteName === site) && (assetId === "all" || g.id === assetId));
  const ids = new Set(assets.map((g) => g.id));
  const inRange = (iso: string) => days === "all" || Date.now() - new Date(iso).getTime() <= Number(days) * 864e5;

  const recentDiag = diagnostics.filter((d) => ids.has(d.assetId) && inRange(d.timestamp)).slice(0, 6);
  const openFaults = faults.filter((f) => ids.has(f.assetId) && f.status !== "Resolved");
  const critical = openFaults.filter((f) => f.severity === "Critical");
  const tasks = workOrders.filter((w) => ids.has(w.assetId));
  const activeTasks = tasks.filter((w) => ACTIVE_STATUSES.includes(w.status));
  const availableTechs = technicians.filter((t) => t.active && t.availability === "Available");
  const pendingReq = partRequests.filter((r) => r.status === "Pending");
  const pendingAssign = tasks.filter((w) => w.status === "Pending Assignment");
  const onHold = tasks.filter((w) => w.status === "On Hold");
  const worst = assets.reduce<Severity>((a, g) => (SEV_RANK[g.health] > SEV_RANK[a] ? g.health : a), "Normal");
  const readingAsset = assets[0];
  const statusData = TASK_STATUSES.map((s) => ({ status: s, count: tasks.filter((w) => w.status === s).length }));
  const priorityData = (["Urgent", "High", "Medium", "Low"] as const).map((p) => ({ p, n: tasks.filter((w) => w.priority === p && !["Completed", "Cancelled"].includes(w.status)).length }));

  return (
    <>
      <PageHeader title="Manager Dashboard" subtitle="Fleet health, open work and pending approvals at a glance." />

      <Card className="mb-5 grid gap-3 sm:grid-cols-3">
        <Field label="Location / site"><Select value={site} onChange={(e) => { setSite(e.target.value); setAssetId("all"); }}><option value="all">All sites</option><Options list={sites} /></Select></Field>
        <Field label="Generator asset ID"><Select value={assetId} onChange={(e) => setAssetId(e.target.value)}><option value="all">All assets</option><Options list={generators.map((g) => g.id)} /></Select></Field>
        <Field label="Period"><Select value={days} onChange={(e) => setDays(e.target.value)}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="all">All time</option></Select></Field>
      </Card>

      {loading ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Registered assets" value={assets.length} icon={<Zap size={16} />} hint="Selected model only" href="/manager/generators" />
          <StatCard label="Current health" value={<SeverityBadge severity={worst} />} hint="Worst across selected assets" />
          <StatCard label="Open faults" value={openFaults.length} icon={<OctagonAlert size={16} />} href="/manager/faults" />
          <StatCard label="Critical alerts" value={critical.length} icon={<Siren size={16} />} emphasis={critical.length > 0} href="/manager/alerts" />
          <StatCard label="Active tasks" value={activeTasks.length} icon={<ClipboardList size={16} />} href="/manager/tasks" />
          <StatCard label="Available technicians" value={availableTechs.length} icon={<Users size={16} />} href="/manager/technicians" />
          <StatCard label="Pending part requests" value={pendingReq.length} icon={<Inbox size={16} />} href="/manager/part-requests" />
          <StatCard label="Awaiting assignment" value={pendingAssign.length} icon={<UserCheck size={16} />} href="/manager/recommendations" />
        </div>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card>
          <h2 className="mb-3 font-bold">Generator health overview</h2>
          <div className="grid grid-cols-2 gap-2">
            {SEVERITIES.map((s) => <div key={s} className="rounded-md border border-ink/25 p-3"><SeverityBadge severity={s} /><div className="mt-1 text-2xl font-bold">{assets.filter((g) => g.health === s).length}</div></div>)}
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <h2 className="mb-3 font-bold">Latest readings {readingAsset && <span className="font-normal text-sm opacity-70">· {readingAsset.id} · {ago(readingAsset.lastDiagnosticAt)}</span>}</h2>
          {readingAsset ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {Object.entries(readingAsset.latestReadings).map(([k, v]) => <div key={k} className="rounded border border-ink/20 p-2"><div className="text-xs opacity-70">{READING_META[k]?.label ?? k}</div><div className="font-bold">{v} <span className="text-xs font-normal">{READING_META[k]?.unit}</span></div></div>)}
            </div>
          ) : <p className="text-sm">No asset selected.</p>}
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="mb-3 font-bold">Recent diagnostic events</h2>
          <ul className="divide-y divide-ink/15">
            {recentDiag.length === 0 && <li className="py-3 text-sm opacity-70">No events in this period.</li>}
            {recentDiag.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div><span className="font-semibold">{d.assetId}</span> · {d.subsystem} · {d.predictedClass}<div className="text-xs opacity-70">{fmt(d.timestamp)} · {Math.round(d.confidence * 100)}% confidence</div></div>
                <SeverityBadge severity={d.severity} />
              </li>
            ))}
          </ul>
          <Link href="/manager/diagnostics" className="mt-2 inline-block text-sm underline">All diagnostics</Link>
        </Card>
        <Card>
          <h2 className="mb-3 font-bold">Pending approvals</h2>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between"><Link href="/manager/recommendations" className="underline">Assignments to approve</Link><b>{pendingAssign.length}</b></li>
            <li className="flex justify-between"><Link href="/manager/part-requests" className="underline">Part requests</Link><b>{pendingReq.length}</b></li>
            <li className="flex justify-between"><Link href="/manager/tasks" className="underline">Tasks on hold (change review)</Link><b>{onHold.length}</b></li>
          </ul>
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="mb-3 font-bold">Work orders by status</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={statusData} layout="vertical" margin={{ left: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#14213d33" />
              <XAxis type="number" allowDecimals={false} tick={{ fill: "#14213d", fontSize: 12 }} />
              <YAxis type="category" dataKey="status" width={120} tick={{ fill: "#14213d", fontSize: 12 }} />
              <Tooltip contentStyle={{ background: "#e5e5e5", border: "1px solid #14213d" }} />
              <Bar dataKey="count" fill="#14213d" />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-wrap gap-3 text-xs">{priorityData.map((x) => <span key={x.p} className="rounded border border-ink/30 px-2 py-0.5">{x.p}: <b>{x.n}</b> open</span>)}</div>
        </Card>
        <Card>
          <h2 className="mb-3 font-bold">Technician workload</h2>
          <ul className="space-y-3">
            {technicians.filter((t) => t.active).map((t) => (
              <li key={t.id} className="text-sm">
                <div className="mb-1 flex items-center justify-between"><span>{t.name}</span><StatusBadge status={t.availability} /></div>
                <ProgressBar value={workloadOf(t.id, workOrders)} max={t.maxConcurrent} accent />
                <div className="text-xs opacity-70">{workloadOf(t.id, workOrders)} / {t.maxConcurrent} active tasks</div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}