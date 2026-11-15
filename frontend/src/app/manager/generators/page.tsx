"use client";
import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus, Power } from "lucide-react";
import { Button, ConfirmDialog, Field, Input, LinkButton, Modal, Options, PageHeader, Select, SeverityBadge, StatusBadge, Textarea, toast } from "@/components/ui";
import { DataTable } from "@/components/DataTable";
import { useStore } from "@/lib/store";
import { useSimulatedLoad } from "@/lib/hooks";
import { GENERATOR_MODEL, OP_STATUSES } from "@/lib/config";
import { buildReadings } from "@/lib/services";
import { ago } from "@/lib/utils";
import type { GeneratorAsset } from "@/lib/types";

const schema = z.object({
  id: z.string().regex(/^DG-\d{3,}$/, "Format: DG-10189"),
  serialNumber: z.string(),
  ratedCapacityKva: z.number().min(1, "Enter rated capacity (kVA)"),
  siteName: z.string().min(2, "Site name required"),
  address: z.string().min(2, "Address required"),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  installDate: z.string().min(1, "Install date required"),
  operationalStatus: z.enum(["Running", "Stopped", "Under Maintenance", "Unknown"]),
  notes: z.string(),
});
type FormValues = z.infer<typeof schema>;

function GeneratorForm({ initial, onClose }: { initial?: GeneratorAsset; onClose: () => void }) {
  const { generators, saveGenerator } = useStore();
  const { register, handleSubmit, setError, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial ?? { id: `DG-${10189 + generators.length}`, serialNumber: "", ratedCapacityKva: 500, siteName: "", address: "", lat: 33.6844, lng: 73.0479, installDate: new Date().toISOString().slice(0, 10), operationalStatus: "Running", notes: "" },
  });
  const onSubmit = (v: FormValues) => {
    if (!initial && generators.some((g) => g.id === v.id)) return setError("id", { message: "Asset ID already exists" });
    saveGenerator({ ...(initial ?? { health: "Normal" as const, active: true, lastDiagnosticAt: new Date().toISOString(), latestReadings: buildReadings("Normal Operation") }), ...v, model: GENERATOR_MODEL });
    toast(initial ? "Asset updated" : "Asset registered");
    onClose();
  };
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3 sm:grid-cols-2">
      <Field label="Asset ID" error={errors.id?.message}><Input {...register("id")} disabled={!!initial} /></Field>
      <Field label="Generator model (fixed project configuration)"><Input value={GENERATOR_MODEL} disabled readOnly /></Field>
      <Field label="Serial number (optional)"><Input {...register("serialNumber")} /></Field>
      <Field label="Rated capacity (kVA)" error={errors.ratedCapacityKva?.message}><Input type="number" {...register("ratedCapacityKva", { valueAsNumber: true })} /></Field>
      <Field label="Installation / site name" error={errors.siteName?.message}><Input {...register("siteName")} /></Field>
      <Field label="Address" error={errors.address?.message}><Input {...register("address")} /></Field>
      <Field label="Latitude" error={errors.lat?.message}><Input type="number" step="any" {...register("lat", { valueAsNumber: true })} /></Field>
      <Field label="Longitude" error={errors.lng?.message}><Input type="number" step="any" {...register("lng", { valueAsNumber: true })} /></Field>
      <Field label="Installation date" error={errors.installDate?.message}><Input type="date" {...register("installDate")} /></Field>
      <Field label="Operating status"><Select {...register("operationalStatus")}><Options list={OP_STATUSES} /></Select></Field>
      <Field label="Notes" className="sm:col-span-2"><Textarea {...register("notes")} /></Field>
      <div className="flex justify-end gap-2 sm:col-span-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">{initial ? "Save changes" : "Register asset"}</Button></div>
    </form>
  );
}

export default function GeneratorsPage() {
  const { generators, toggleGenerator } = useStore();
  const loading = useSimulatedLoad();
  const [editing, setEditing] = useState<GeneratorAsset | "new" | null>(null);
  const [confirm, setConfirm] = useState<GeneratorAsset | null>(null);

  const columns: ColumnDef<GeneratorAsset>[] = [
    { id: "id", header: "Asset ID", accessorFn: (g) => g.id, cell: ({ row }) => <Link href={`/manager/generators/${row.original.id}`} className="font-semibold underline">{row.original.id}</Link> },
    { header: "Model", accessorFn: (g) => g.model },
    { header: "Site", accessorFn: (g) => g.siteName },
    { header: "kVA", accessorFn: (g) => g.ratedCapacityKva },
    { id: "op", header: "Operating status", accessorFn: (g) => g.operationalStatus, cell: ({ row }) => <StatusBadge status={row.original.operationalStatus} /> },
    { id: "health", header: "Health", accessorFn: (g) => g.health, cell: ({ row }) => <SeverityBadge severity={row.original.health} /> },
    { id: "last", header: "Last diagnostic", accessorFn: (g) => g.lastDiagnosticAt, cell: ({ row }) => ago(row.original.lastDiagnosticAt) },
    { id: "active", header: "Record", accessorFn: (g) => (g.active ? "Active" : "Deactivated"), cell: ({ row }) => <StatusBadge status={row.original.active ? "Running" : "Stopped"} /> },
    {
      id: "actions", header: "", enableSorting: false, cell: ({ row }) => (
        <div className="flex gap-1">
          <Button size="sm" variant="outline" aria-label="Edit" onClick={() => setEditing(row.original)}><Pencil size={13} /></Button>
          <Button size="sm" variant="outline" aria-label="Activate or deactivate" onClick={() => setConfirm(row.original)}><Power size={13} />{row.original.active ? "Deactivate" : "Activate"}</Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Generator Assets" subtitle="Unique asset records for the selected generator model. Operating status is separate from diagnostic health."
        actions={<><LinkButton href="/manager/map" variant="outline">View map</LinkButton><Button onClick={() => setEditing("new")}><Plus size={16} />Register asset</Button></>} />
      <DataTable data={generators} columns={columns} loading={loading} searchPlaceholder="Search asset, site, model…" emptyTitle="No generator assets registered" />
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "Register generator asset" : "Edit generator asset"} wide>
        {editing && <GeneratorForm initial={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
      </Modal>
      <ConfirmDialog open={!!confirm} title={confirm?.active ? "Deactivate asset?" : "Activate asset?"} message={`${confirm?.id} will ${confirm?.active ? "be hidden from dashboards and new diagnostics" : "return to active use"}. Its history is preserved.`}
        onCancel={() => setConfirm(null)} onConfirm={() => { if (confirm) { toggleGenerator(confirm.id); toast("Asset record updated"); } setConfirm(null); }} />
    </>
  );
}