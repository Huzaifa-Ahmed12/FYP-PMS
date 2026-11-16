"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarClock, MapPin } from "lucide-react";
import { Badge, Card, SeverityBadge, StatusBadge, cn } from "./ui";
import { useStore } from "@/lib/store";
import { isOverdue } from "@/lib/technician";
import { fmtDate } from "@/lib/utils";
import type { WorkOrder } from "@/lib/types";

/** Mobile-friendly work-order card used on the dashboard and the task list. `children` = action buttons. */
export default function TaskCard({ wo, children }: { wo: WorkOrder; children?: ReactNode }) {
  const gen = useStore((s) => s.generators.find((g) => g.id === wo.assetId));
  const overdue = isOverdue(wo);
  return (
    <Card className={cn("flex flex-col gap-2", overdue && "border-2 border-accent")}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-bold">{wo.id}</span>
        <SeverityBadge severity={wo.severity} /><StatusBadge status={wo.status} /><StatusBadge status={wo.priority} />
        {overdue && <Badge tone="ink" className="text-accent">⏰ Overdue</Badge>}
      </div>
      <Link href={`/technician/tasks/${wo.id}`} className="font-semibold hover:underline">{wo.title}</Link>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <b>{wo.assetId}</b>
        <span className="inline-flex items-center gap-1"><MapPin size={13} aria-hidden />{gen?.siteName ?? "—"}</span>
        <span className="inline-flex items-center gap-1"><CalendarClock size={13} aria-hidden />Due {fmtDate(wo.dueDate)}</span>
      </div>
      {children && <div className="mt-1 flex flex-wrap gap-2">{children}</div>}
    </Card>
  );
}