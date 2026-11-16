"use client";
import { useState } from "react";
import Link from "next/link";
import { Bell, Check } from "lucide-react";
import { Badge, Button, Card, EmptyState, PageHeader, Select, SeverityBadge, Tabs, cn } from "@/components/ui";
import { useStore } from "@/lib/store";
import { useTechnician } from "@/lib/use-technician";
import { ago, fmt } from "@/lib/utils";

const TABS = ["All", "Unread"] as const;
const TYPES: Record<string, string> = { assignment: "New assignment", part_request: "Part request", progress: "Manager message", acceptance: "Acceptance", completion: "Completion", fault: "Fault", system: "System" };

export default function TechnicianNotifications() {
  const { id } = useTechnician();
  const { techNotifications, markTechRead, markAllTechRead } = useStore();
  const [tab, setTab] = useState<(typeof TABS)[number]>("All");
  const [type, setType] = useState("all");
  const mine = techNotifications.filter((n) => n.recipientId === id);
  const unread = mine.filter((n) => !n.read).length;
  const data = mine.filter((n) => (tab === "All" || !n.read) && (type === "all" || n.type === type));

  return (
    <>
      <PageHeader title="Notifications" subtitle="New assignments, manager messages and part-request decisions." actions={<Button variant="outline" disabled={unread === 0} onClick={() => markAllTechRead(id)}><Check size={15} />Mark all read ({unread})</Button>} />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      <div className="mb-4"><Select aria-label="Type filter" className="w-52" value={type} onChange={(e) => setType(e.target.value)}><option value="all">All types</option>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></div>
      {data.length === 0 ? <EmptyState title="Nothing here" text="You are all caught up." /> : (
        <ul className="space-y-2">
          {data.map((n) => (
            <li key={n.id}>
              <Card className={cn("flex items-start gap-3", !n.read && "border-accent bg-accent/20")}>
                <Bell size={18} className="mt-0.5 shrink-0" aria-hidden />
                <div className="flex-1 text-sm">
                  <div className="flex flex-wrap items-center gap-2 font-semibold">{!n.read && <Badge tone="ink" className="text-accent">NEW</Badge>}{n.title}{n.severity && <SeverityBadge severity={n.severity} />}<Badge tone="muted">{TYPES[n.type]}</Badge></div>
                  <p className="mt-0.5">{n.message}</p>
                  <p className="mt-0.5 text-xs opacity-60">{ago(n.at)} · {fmt(n.at)}</p>
                  <div className="mt-2 flex gap-2">{n.link && <Link href={n.link} onClick={() => markTechRead(n.id)} className="text-xs font-semibold underline">Open</Link>}{!n.read && <button className="text-xs underline" onClick={() => markTechRead(n.id)}>Mark read</button>}</div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}