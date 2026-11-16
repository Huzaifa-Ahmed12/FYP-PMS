"use client";
import { useState } from "react";
import { Search } from "lucide-react";
import { Button, EmptyState, Input, LinkButton, Options, PageHeader, Select, Skeleton, Tabs, toast } from "@/components/ui";
import TaskCard from "@/components/TaskCard";
import { useStore } from "@/lib/store";
import { useTechnician } from "@/lib/use-technician";
import { useQueryParam, useSimulatedLoad } from "@/lib/hooks";
import { SEVERITIES } from "@/lib/config";
import { byUrgency, isClosed } from "@/lib/technician";

const TABS = ["Active", "New", "Completed", "All"] as const;
type Tab = (typeof TABS)[number];

export default function MyTasksPage() {
  const { id } = useTechnician();
  const { workOrders, generators, acceptTask } = useStore();
  const loading = useSimulatedLoad(300);
  const initial = useQueryParam("tab");
  const [picked, setPicked] = useState<Tab | null>(null);
  const tab: Tab = picked ?? (TABS.includes(initial as Tab) ? (initial as Tab) : "Active");
  const [q, setQ] = useState("");
  const [sev, setSev] = useState("all");

  const mine = workOrders.filter((w) => w.assignedTo === id);
  const bySearch = (w: (typeof mine)[number]) => {
    const g = generators.find((x) => x.id === w.assetId);
    return `${w.id} ${w.title} ${w.assetId} ${g?.siteName ?? ""}`.toLowerCase().includes(q.trim().toLowerCase());
  };
  const data = mine
    .filter((w) => (tab === "All" ? true : tab === "New" ? w.status === "Assigned" : tab === "Completed" ? isClosed(w) : !isClosed(w) && w.status !== "Assigned"))
    .filter((w) => sev === "all" || w.severity === sev)
    .filter(bySearch)
    .sort(tab === "Completed" ? (a, b) => (b.completedAt ?? b.createdAt).localeCompare(a.completedAt ?? a.createdAt) : byUrgency);

  return (
    <>
      <PageHeader title="My Tasks" subtitle="Work orders assigned to you by the manager." />
      <Tabs tabs={TABS} value={tab} onChange={setPicked} />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[12rem] flex-1"><Search size={15} className="absolute left-3 top-3 opacity-60" aria-hidden /><Input aria-label="Search tasks" className="pl-9" placeholder="Search task, asset or site…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Select aria-label="Severity filter" className="w-40" value={sev} onChange={(e) => setSev(e.target.value)}><option value="all">All severities</option><Options list={SEVERITIES} /></Select>
      </div>
      <div className="space-y-3">
        {loading ? <Skeleton className="h-32 w-full" /> : data.length === 0 ? <EmptyState title="No tasks here" text="Try another tab or clear the filters." /> : data.map((w) => (
          <TaskCard key={w.id} wo={w}>
            {w.status === "Assigned" && <Button size="sm" variant="accent" onClick={() => { const e = acceptTask(w.id); toast(e ?? `${w.id} accepted`); }}>Accept</Button>}
            <LinkButton size="sm" variant="outline" href={`/technician/tasks/${w.id}`}>Details</LinkButton>
            {["Accepted", "In Progress", "On Hold"].includes(w.status) && <LinkButton size="sm" variant="outline" href={`/technician/maintenance/${w.id}`}>Maintenance update</LinkButton>}
          </TaskCard>
        ))}
      </div>
    </>
  );
}