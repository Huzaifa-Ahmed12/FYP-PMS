"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { Button, Field, Input, Modal, Options, PageHeader, Select, SeverityBadge, StatusBadge, Textarea, cn, toast } from "@/components/ui";
import { DataTable } from "@/components/DataTable";
import { useStore } from "@/lib/store";
import { useSimulatedLoad } from "@/lib/hooks";
import { FAULT_CATALOG, PRIORITIES, SEVERITIES, SKILLS, TASK_STATUSES } from "@/lib/config";
import { fmtDate } from "@/lib/utils";
import type { WorkOrder } from "@/lib/types";

const schema = z.object({
  assetId: z.string().min(1, "Select an asset"),
  faultId: z.string(),
  title: z.string().min(5, "Title required (min 5 chars)"),
  description: z.string().min(5, "Description required"),
  severity: z.enum(["Normal", "Warning", "High", "Critical"]),
  priority: z.enum(["Low", "Medium", "High", "Urgent"]),
  requiredSkills: z.array(z.string()),
  dueDate: z.string().min(1, "Due date required"),
  notes: z.string(),
});
type FormValues = z.infer<typeof schema>;

function WoForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { generators, faults, createWorkOrder } = useStore();
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { assetId: generators[0]?.id ?? "", faultId: "", title: "", description: "", severity: "Warning", priority: "Medium", requiredSkills: [], dueDate: new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10), notes: "" },
  });
  const [assetId, faultId, skills] = [watch("assetId"), watch("faultId"), watch("requiredSkills")];
  const options = faults.filter((f) => f.assetId === assetId && f.status !== "Resolved" && !f.workOrderId);

  useEffect(() => {
    const f = faults.find((x) => x.id === faultId);
    if (!f) return;
    setValue("title", `${f.faultType} – ${f.assetId}`); setValue("description", FAULT_CATALOG[f.faultType]?.action ?? f.description);
    setValue("severity", f.severity); setValue("requiredSkills", FAULT_CATALOG[f.faultType]?.skills ?? []);
    setValue("priority", f.severity === "Critical" ? "Urgent" : f.severity === "High" ? "High" : "Medium");
  }, [faultId, faults, setValue]);

  const onSubmit = (v: FormValues) => { const id = createWorkOrder({ ...v, faultId: v.faultId || undefined }); toast(`Work order ${id} created`); onClose(); router.push(`/manager/tasks/${id}`); };
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3 sm:grid-cols-2">
      <Field label="Asset" error={errors.assetId?.message}><Select {...register("assetId")}>{generators.filter((g) => g.active).map((g) => <option key={g.id}>{g.id}</option>)}</Select></Field>
      <Field label="Linked fault (optional)"><Select {...register("faultId")}><option value="">— manual work order —</option>{options.map((f) => <option key={f.id} value={f.id}>{f.id} · {f.faultType}</option>)}</Select></Field>
      <Field label="Title" error={errors.title?.message} className="sm:col-span-2"><Input {...register("title")} /></Field>
      <Field label="Description" error={errors.description?.message} className="sm:col-span-2"><Textarea {...register("description")} /></Field>
      <Field label="Severity"><Select {...register("severity")}><Options list={SEVERITIES} /></Select></Field>
      <Field label="Priority"><Select {...register("priority")}><Options list={PRIORITIES} /></Select></Field>
      <div className="sm:col-span-2"><div className="mb-1 text-sm font-medium">Required skills</div><div className="flex flex-wrap gap-2">{SKILLS.map((s) => { const on = skills.includes(s); return <button type="button" key={s} aria-pressed={on} onClick={() => setValue("requiredSkills", on ? skills.filter((x) => x !== s) : [...skills, s])} className={cn("rounded border px-2 py-1 text-xs", on ? "border-ink bg-ink text-paper" : "border-ink/40")}>{on && "✓ "}{s}</button>; })}</div></div>
      <Field label="Due date" error={errors.dueDate?.message}><Input type="date" {...register("dueDate")} /></Field>
      <Field label="Notes"><Input {...register("notes")} /></Field>
      <div className="flex justify-end gap-2 sm:col-span-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">Create work order</Button></div>
    </form>
  );
}

export default function TasksPage() {
  const { workOrders, technicians } = useStore();
  const loading = useSimulatedLoad();
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [open, setOpen] = useState(false);
  const data = workOrders.filter((w) => (status === "all" || w.status === status) && (priority === "all" || w.priority === priority));

  const columns: ColumnDef<WorkOrder>[] = [
    { id: "id", header: "Task ID", accessorFn: (w) => w.id, cell: ({ row }) => <Link href={`/manager/tasks/${row.original.id}`} className="font-semibold underline">{row.original.id}</Link> },
    { header: "Asset", accessorFn: (w) => w.assetId }, { header: "Title", accessorFn: (w) => w.title },
    { id: "sev", header: "Severity", accessorFn: (w) => w.severity, cell: ({ row }) => <SeverityBadge severity={row.original.severity} /> },
    { id: "pri", header: "Priority", accessorFn: (w) => w.priority, cell: ({ row }) => <StatusBadge status={row.original.priority} /> },
    { id: "st", header: "Status", accessorFn: (w) => w.status, cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { header: "Technician", accessorFn: (w) => technicians.find((t) => t.id === w.assignedTo)?.name ?? "Unassigned" },
    { id: "due", header: "Due", accessorFn: (w) => w.dueDate, cell: ({ row }) => fmtDate(row.original.dueDate) },
  ];
  return (
    <>
      <PageHeader title="Work Orders" subtitle="Create, assign and monitor maintenance tasks." actions={<Button onClick={() => setOpen(true)}><Plus size={16} />New work order</Button>} />
      <DataTable data={data} columns={columns} loading={loading} searchPlaceholder="Search work orders…" emptyTitle="No work orders"
        toolbar={<><Select aria-label="Status filter" className="w-44" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All statuses</option><Options list={TASK_STATUSES} /></Select><Select aria-label="Priority filter" className="w-40" value={priority} onChange={(e) => setPriority(e.target.value)}><option value="all">All priorities</option><Options list={PRIORITIES} /></Select></>} />
      <Modal open={open} onClose={() => setOpen(false)} title="New work order" wide>{open && <WoForm onClose={() => setOpen(false)} />}</Modal>
    </>
  );
}