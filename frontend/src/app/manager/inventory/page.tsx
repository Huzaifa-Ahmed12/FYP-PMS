"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus, TriangleAlert } from "lucide-react";
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Textarea, toast } from "@/components/ui";
import { DataTable } from "@/components/DataTable";
import { useStore } from "@/lib/store";
import { useSimulatedLoad } from "@/lib/hooks";
import { availableQty, reservedQty } from "@/lib/services";
import type { Part } from "@/lib/types";

const schema = z.object({
  name: z.string().min(2, "Part name required"), code: z.string().min(2, "Part code required"),
  component: z.string().min(2, "Compatible component required"),
  quantity: z.number().min(0, "Cannot be negative"), minStock: z.number().min(0), unit: z.string().min(1, "Unit required"),
  location: z.string().min(1, "Storage location required"), notes: z.string(),
});
type FormValues = z.infer<typeof schema>;

function PartForm({ initial, onClose }: { initial?: Part; onClose: () => void }) {
  const { parts, savePart } = useStore();
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: initial ?? { name: "", code: "", component: "", quantity: 0, minStock: 1, unit: "pcs", location: "", notes: "" } });
  const onSubmit = (v: FormValues) => { savePart({ ...v, id: initial?.id ?? `P-${String(parts.length + 1).padStart(2, "0")}` }); toast(initial ? "Part updated" : "Part added"); onClose(); };
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3 sm:grid-cols-2">
      <Field label="Part name" error={errors.name?.message}><Input {...register("name")} /></Field>
      <Field label="Part code" error={errors.code?.message}><Input {...register("code")} /></Field>
      <Field label="Compatible component" error={errors.component?.message}><Input {...register("component")} /></Field>
      <Field label="Storage location" error={errors.location?.message}><Input {...register("location")} /></Field>
      <Field label="Quantity on hand" error={errors.quantity?.message}><Input type="number" {...register("quantity", { valueAsNumber: true })} /></Field>
      <Field label="Minimum stock"><Input type="number" {...register("minStock", { valueAsNumber: true })} /></Field>
      <Field label="Unit" error={errors.unit?.message}><Input {...register("unit")} /></Field>
      <Field label="Notes"><Textarea rows={1} {...register("notes")} /></Field>
      <div className="flex justify-end gap-2 sm:col-span-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">{initial ? "Save" : "Add part"}</Button></div>
    </form>
  );
}

export default function InventoryPage() {
  const { parts, workOrders } = useStore();
  const loading = useSimulatedLoad();
  const [editing, setEditing] = useState<Part | "new" | null>(null);
  const low = parts.filter((p) => availableQty(p, workOrders) <= p.minStock);

  const columns: ColumnDef<Part>[] = [
    { header: "Part", accessorFn: (p) => p.name }, { header: "Code", accessorFn: (p) => p.code }, { header: "Component", accessorFn: (p) => p.component },
    { header: "On hand", accessorFn: (p) => p.quantity },
    { id: "res", header: "Reserved", accessorFn: (p) => reservedQty(p.id, workOrders) },
    { id: "av", header: "Available", accessorFn: (p) => availableQty(p, workOrders), cell: ({ row }) => `${availableQty(row.original, workOrders)} ${row.original.unit}` },
    { header: "Min", accessorFn: (p) => p.minStock }, { header: "Location", accessorFn: (p) => p.location },
    { id: "s", header: "Stock", accessorFn: (p) => availableQty(p, workOrders) <= p.minStock, cell: ({ row }) => availableQty(row.original, workOrders) <= row.original.minStock ? <Badge tone="accent"><TriangleAlert size={12} />Low stock</Badge> : <Badge tone="outline">OK</Badge> },
    { id: "a", header: "", enableSorting: false, cell: ({ row }) => <Button size="sm" variant="outline" aria-label="Edit part" onClick={() => setEditing(row.original)}><Pencil size={13} /></Button> },
  ];
  return (
    <>
      <PageHeader title="Inventory & Parts" subtitle="Spare parts for the selected generator model. Available = on hand − reserved by open work orders." actions={<Button onClick={() => setEditing("new")}><Plus size={16} />Add part</Button>} />
      {low.length > 0 && <Card className="mb-4 border-accent bg-accent/20"><b className="flex items-center gap-2"><TriangleAlert size={16} />Low stock: {low.map((p) => p.name).join(", ")}</b></Card>}
      <DataTable data={parts} columns={columns} loading={loading} searchPlaceholder="Search parts…" emptyTitle="No parts recorded" />
      <Modal open={!!editing} onClose={() => setEditing(null)} wide title={editing === "new" ? "Add spare part" : "Edit spare part"}>{editing && <PartForm initial={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}</Modal>
    </>
  );
}