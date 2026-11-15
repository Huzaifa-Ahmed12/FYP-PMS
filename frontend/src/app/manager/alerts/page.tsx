"use client";
import { useState } from "react";
import Link from "next/link";
import { Siren } from "lucide-react";
import { Badge, Button, Card, EmptyState, PageHeader, SeverityBadge, Tabs, cn, toast } from "@/components/ui";
import { useStore } from "@/lib/store";
import { SEV_RANK } from "@/lib/config";
import { ago } from "@/lib/utils";

const TABS = ["Alerts", "Notifications"] as const;
const TYPES = ["all", "fault", "assignment", "acceptance", "progress", "part_request", "completion"] as const;

export default function AlertsPage() {
  const { faults, notifications, setFaultStatus, markRead, markAllRead } = useStore();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Alerts");
  const [type, setType] = useState<(typeof TYPES)[number]>("all");
  const [unreadOnly, setUnreadOnly] = useState(false);

  const alerts = faults.filter((f) => f.severity !== "Normal" && f.status !== "Resolved").sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity]);
  const notes = notifications.filter((n) => (type === "all" || n.type === type) && (!unreadOnly || !n.read));

  return (
    <>
      <PageHeader title="Alerts & Notifications" subtitle="Warning, High and Critical conditions need manager attention." />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === "Alerts" ? (
        <div className="space-y-3">
          {alerts.length === 0 && <EmptyState title="No active alerts" text="All generators are operating normally." />}
          {alerts.map((f) => {
            const crit = f.severity === "Critical";
            return (
              <div key={f.id} className={cn("rounded-lg border p-4", crit ? "border-4 border-accent bg-ink text-paper" : "border-ink/30 bg-ink/[0.04]")}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {crit && <Siren className="text-accent" aria-hidden />}
                    <div><div className="font-bold">{crit && "CRITICAL – IMMEDIATE ACTION · "}{f.faultType}</div><div className="text-sm opacity-80">{f.assetId} · {f.subsystem} · {ago(f.reportedAt)} · {f.source}</div></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={f.severity} />
                    <Badge tone={f.status === "Open" ? "accent" : "outline"} className={crit && f.status !== "Open" ? "text-paper" : ""}>{f.status === "Open" ? "Unacknowledged" : "Acknowledged"}</Badge>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {f.status === "Open" && <Button size="sm" variant="accent" onClick={() => { setFaultStatus(f.id, "Acknowledged"); toast("Alert acknowledged"); }}>Acknowledge</Button>}
                  {f.workOrderId ? <Link href={`/manager/tasks/${f.workOrderId}`} className="text-sm underline">Open {f.workOrderId}</Link> : <Link href={`/manager/recommendations?fault=${f.id}`} className="text-sm font-semibold underline">Recommend technician →</Link>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {TYPES.map((t) => <Button key={t} size="sm" variant={type === t ? "primary" : "outline"} onClick={() => setType(t)}>{t.replace("_", " ")}</Button>)}
            <label className="ml-2 flex items-center gap-1 text-sm"><input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} className="accent-ink" />Unread only</label>
            <Button size="sm" variant="outline" className="ml-auto" onClick={markAllRead}>Mark all read</Button>
          </div>
          <Card className="p-0">
            {notes.length === 0 && <div className="p-4"><EmptyState title="No notifications match" /></div>}
            <ul>{notes.map((n) => (
              <li key={n.id} className={cn("flex items-start justify-between gap-3 border-b border-ink/15 p-3", !n.read && "bg-accent/20")}>
                <div><div className="text-sm font-semibold">{!n.read && "● "}{n.title} {n.severity && <SeverityBadge severity={n.severity} />}</div><div className="text-sm">{n.message}</div><div className="text-xs opacity-60">{ago(n.at)} · {n.type.replace("_", " ")}</div></div>
                <div className="flex gap-2">{n.link && <Link href={n.link} className="text-sm underline" onClick={() => markRead(n.id)}>Open</Link>}{!n.read && <Button size="sm" variant="outline" onClick={() => markRead(n.id)}>Mark read</Button>}</div>
              </li>))}</ul>
          </Card>
        </>
      )}
    </>
  );
}