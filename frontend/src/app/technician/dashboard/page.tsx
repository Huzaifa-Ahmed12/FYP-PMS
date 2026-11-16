"use client";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ClipboardList, Inbox, Package, PlayCircle, TriangleAlert } from "lucide-react";
import { Button, Card, EmptyState, Field, LinkButton, Options, PageHeader, ProgressBar, Select, Skeleton, StatCard, StatusBadge, toast } from "@/components/ui";
import TaskCard from "@/components/TaskCard";
import { useStore } from "@/lib/store";
import { useTechnician } from "@/lib/use-technician";
import { useSimulatedLoad } from "@/lib/hooks";
import { AVAILABILITIES } from "@/lib/config";
import { workloadOf } from "@/lib/services";
import { OPEN_STATUSES, byUrgency, isOverdue } from "@/lib/technician";
import { ago } from "@/lib/utils";
import type { Availability } from "@/lib/types";

export default function TechnicianDashboard() {
  const { id, tech } = useTechnician();
  const { workOrders, techNotifications, partRequests, saveTechnician, acceptTask, markTechRead } = useStore();
  const loading = useSimulatedLoad(300);

  const mine = workOrders.filter((w) => w.assignedTo === id);
  const open = mine.filter((w) => OPEN_STATUSES.includes(w.status)).sort(byUrgency);
  const newOnes = mine.filter((w) => w.status === "Assigned");
  const active = mine.filter((w) => ["Accepted", "In Progress", "On Hold"].includes(w.status));
  const overdue = mine.filter(isOverdue);
  const done = mine.filter((w) => w.status === "Completed");
  const notes = techNotifications.filter((n) => n.recipientId === id);
  const pendingReq = partRequests.filter((r) => r.technicianId === id && r.status === "Pending").length;
  const load = workloadOf(id, workOrders);
  const next = open[0];

  const setAvailability = (a: Availability) => { saveTechnician({ ...tech, availability: a }); toast(`Availability set to ${a}`); };

  return (
    <>
      <PageHeader title={`Hello, ${tech.name.split(" ")[0]}`} subtitle="Your assigned work, alerts and quick actions." />

      {loading ? <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div> : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="New assignments" value={newOnes.length} icon={<Inbox size={16} />} emphasis={newOnes.length > 0} hint="Waiting for you to accept" href="/technician/tasks?tab=New" />
          <StatCard label="Active tasks" value={active.length} icon={<ClipboardList size={16} />} hint="Accepted / in progress / on hold" href="/technician/tasks?tab=Active" />
          <StatCard label="Overdue" value={overdue.length} icon={<AlertTriangle size={16} />} emphasis={overdue.length > 0} hint="Past the due date" href="/technician/tasks?tab=Active" />
          <StatCard label="Completed" value={done.length} icon={<CheckCircle2 size={16} />} hint="All time" href="/technician/history" />
        </div>
      )}

      <Card className="mt-5">
        <h2 className="mb-3 font-bold">Quick actions</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {next
            ? <LinkButton href={`/technician/tasks/${next.id}`} variant="accent" className="py-3"><PlayCircle size={17} />Open next task ({next.id})</LinkButton>
            : <Button variant="outline" disabled className="py-3"><PlayCircle size={17} />No open task</Button>}
          <LinkButton href="/technician/report-fault" variant="primary" className="py-3"><TriangleAlert size={17} />Report a fault</LinkButton>
          <LinkButton href="/technician/part-requests" variant="primary" className="py-3"><Package size={17} />Request parts{pendingReq > 0 && ` (${pendingReq} pending)`}</LinkButton>
          <Field label="Update availability"><Select value={tech.availability} onChange={(e) => setAvailability(e.target.value as Availability)}><Options list={AVAILABILITIES} /></Select></Field>
        </div>
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between"><h2 className="font-bold">Assigned work orders</h2><Link href="/technician/tasks" className="text-sm underline">All tasks</Link></div>
          {loading ? <Skeleton className="h-32 w-full" /> : open.length === 0 ? <EmptyState title="No open work orders" text="New assignments from your manager will appear here." /> : open.map((w) => (
            <TaskCard key={w.id} wo={w}>
              {w.status === "Assigned" && <Button size="sm" variant="accent" onClick={() => { const e = acceptTask(w.id); toast(e ?? `${w.id} accepted`); }}>Accept</Button>}
              <LinkButton size="sm" variant="outline" href={`/technician/tasks/${w.id}`}>Open</LinkButton>
              {["In Progress", "On Hold", "Accepted"].includes(w.status) && <LinkButton size="sm" variant="outline" href={`/technician/maintenance/${w.id}`}>Update</LinkButton>}
            </TaskCard>
          ))}
        </div>

        <div className="space-y-5">
          <Card>
            <h2 className="mb-2 font-bold">My workload</h2>
            <div className="mb-1 flex items-center justify-between text-sm"><span>{load} / {tech.maxConcurrent} active tasks</span><StatusBadge status={tech.availability} /></div>
            <ProgressBar value={load} max={tech.maxConcurrent} accent />
          </Card>
          <Card>
            <div className="mb-2 flex items-center justify-between"><h2 className="font-bold">Notifications</h2><Link href="/technician/notifications" className="text-xs underline">View all</Link></div>
            {notes.length === 0 ? <p className="text-sm opacity-70">Nothing new.</p> : (
              <ul className="divide-y divide-ink/15">
                {notes.slice(0, 5).map((n) => (
                  <li key={n.id}><Link href={n.link ?? "/technician/notifications"} onClick={() => markTechRead(n.id)} className="block py-2 text-sm"><div className="font-medium">{!n.read && "● "}{n.title}</div><div className="text-xs opacity-80">{n.message}</div><div className="text-xs opacity-60">{ago(n.at)}</div></Link></li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}