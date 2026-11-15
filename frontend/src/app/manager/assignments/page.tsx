"use client";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge, PageHeader } from "@/components/ui";
import { DataTable } from "@/components/DataTable";
import { useStore } from "@/lib/store";
import { useSimulatedLoad } from "@/lib/hooks";
import { fmt } from "@/lib/utils";
import type { Assignment } from "@/lib/types";

export default function AssignmentsPage() {
  const { assignments, technicians } = useStore();
  const loading = useSimulatedLoad();
  const name = (id?: string) => technicians.find((t) => t.id === id)?.name ?? "—";
  const columns: ColumnDef<Assignment>[] = [
    { id: "at", header: "Assigned at", accessorFn: (a) => a.at, cell: ({ row }) => fmt(row.original.at) },
    { id: "wo", header: "Work order", accessorFn: (a) => a.workOrderId, cell: ({ row }) => <Link className="font-semibold underline" href={`/manager/tasks/${row.original.workOrderId}`}>{row.original.workOrderId}</Link> },
    { header: "Asset", accessorFn: (a) => a.assetId },
    { header: "Assigned to", accessorFn: (a) => name(a.technicianId) },
    { header: "Top recommendation", accessorFn: (a) => name(a.recommendedId) },
    { header: "Score", accessorFn: (a) => a.score ?? "" },
    { id: "d", header: "Decision", accessorFn: (a) => (a.overridden ? "Override" : "Followed"), cell: ({ row }) => <Badge tone={row.original.overridden ? "dashed" : "outline"}>{row.original.overridden ? "Manager override" : "Followed recommendation"}</Badge> },
    { header: "Override reason", accessorFn: (a) => a.reason ?? "—" },
    { header: "By", accessorFn: (a) => a.by },
  ];
  return (<><PageHeader title="Assignment Decisions" subtitle="Audit log of every dispatch and manager override." /><DataTable data={assignments} columns={columns} loading={loading} emptyTitle="No assignments yet" /></>);
}