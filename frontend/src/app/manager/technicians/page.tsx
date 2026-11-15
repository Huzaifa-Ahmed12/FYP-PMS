"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus, Power } from "lucide-react";
import { Badge, Button, Card, ConfirmDialog, Field, Input, Modal, Options, PageHeader, Select, StatusBadge, cn, toast } from "@/components/ui";
import { DataTable } from "@/components/DataTable";
import MapClient from "@/components/MapClient";
import { useStore } from "@/lib/store";
import { useSimulatedLoad } from "@/lib/hooks";
import { AVAILABILITIES, SKILLS } from "@/lib/config";
import { workloadOf } from "@/lib/services";
import { fmt } from "@/lib/utils";
import type { Technician } from "@/lib/types";

const schema = z.object({
  name: z.string().min(2, "Name required"),
  phone: z.string().min(7, "Contact number required"),
  email: z.string().email("Valid email required"),
  skills: z.array(z.string()).min(1, "Select at least one skill"),
  certifications: z.string(),
  experienceYears: z.number().min(0).max(45),
  availability: z.enum(["Available", "Busy", "Unavailable", "On Leave"]),
  maxConcurrent: z.number().min(1).max(10),
  baseLocation: z.string().min(2, "Base location required"),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
type FormValues = z.infer<typeof schema>;

function TechForm({ initial, onClose }: { initial?: Technician; onClose: () => void }) {
  const { saveTechnician, technicians } = useStore();
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial ? { ...initial, certifications: initial.certifications.join(", ") } : { name: "", phone: "", email: "", skills: [], certifications: "", experienceYears: 1, availability: "Available", maxConcurrent: 3, baseLocation: "", lat: 33.6844, lng: 73.0479 },
  });
  const skills = watch("skills");
  const onSubmit = (v: FormValues) => {
    saveTechnician({ ...v, id: initial?.id ?? `t${technicians.length + 1}`, active: initial?.active ?? true, certifications: v.certifications.split(",").map((s) => s.trim()).filter(Boolean) });
    toast(initial ? "Technician updated" : "Technician added"); onClose();
  };
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3 sm:grid-cols-2">
      <Field label="Full name" error={errors.name?.message}><Input {...register("name")} /></Field>
      <Field label="Phone" error={errors.phone?.message}><Input {...register("phone")} /></Field>
      <Field label="Email" error={errors.email?.message}><Input {...register("email")} /></Field>
      <Field label="Experience (years)" error={errors.experienceYears?.message}><Input type="number" {...register("experienceYears", { valueAsNumber: true })} /></Field>
      <div className="sm:col-span-2">
        <div className="mb-1 text-sm font-medium">Skill tags</div>
        <div className="flex flex-wrap gap-2">{SKILLS.map((s) => { const on = skills.includes(s); return <button type="button" key={s} aria-pressed={on} onClick={() => setValue("skills", on ? skills.filter((x) => x !== s) : [...skills, s], { shouldValidate: true })} className={cn("rounded border px-2 py-1 text-xs", on ? "border-ink bg-ink text-paper" : "border-ink/40")}>{on && "✓ "}{s}</button>; })}</div>
        {errors.skills && <span role="alert" className="mt-1 block text-xs font-semibold">⚠ {errors.skills.message}</span>}
      </div>
      <Field label="Certifications (comma separated)" className="sm:col-span-2"><Input {...register("certifications")} /></Field>
      <Field label="Availability"><Select {...register("availability")}><Options list={AVAILABILITIES} /></Select></Field>
      <Field label="Max concurrent tasks" error={errors.maxConcurrent?.message}><Input type="number" {...register("maxConcurrent", { valueAsNumber: true })} /></Field>
      <Field label="Base / current location" error={errors.baseLocation?.message}><Input {...register("baseLocation")} /></Field>
      <div className="grid grid-cols-2 gap-2"><Field label="Latitude"><Input type="number" step="any" {...register("lat", { valueAsNumber: true })} /></Field><Field label="Longitude"><Input type="number" step="any" {...register("lng", { valueAsNumber: true })} /></Field></div>
      <div className="flex justify-end gap-2 sm:col-span-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">{initial ? "Save changes" : "Add technician"}</Button></div>
    </form>
  );
}

export default function TechniciansPage() {
  const { technicians, workOrders, saveTechnician, toggleTechnician } = useStore();
  const loading = useSimulatedLoad();
  const [editing, setEditing] = useState<Technician | "new" | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Technician | null>(null);
  const view = technicians.find((t) => t.id === viewId);

  const columns: ColumnDef<Technician>[] = [
    { id: "name", header: "Name", accessorFn: (t) => t.name, cell: ({ row }) => <button className="font-semibold underline" onClick={() => setViewId(row.original.id)}>{row.original.name}</button> },
    { id: "skills", header: "Skills", accessorFn: (t) => t.skills.join(" "), cell: ({ row }) => <div className="flex max-w-xs flex-wrap gap-1">{row.original.skills.map((s) => <Badge key={s} tone="outline">{s}</Badge>)}</div> },
    { header: "Exp (yrs)", accessorFn: (t) => t.experienceYears },
    {
      id: "av", header: "Availability", accessorFn: (t) => t.availability,
      cell: ({ row }) => <Select aria-label={`Availability for ${row.original.name}`} className="w-32 py-1" value={row.original.availability} onChange={(e) => { saveTechnician({ ...row.original, availability: e.target.value as Technician["availability"] }); toast("Availability updated"); }}><Options list={AVAILABILITIES} /></Select>,
    },
    { id: "load", header: "Workload", accessorFn: (t) => workloadOf(t.id, workOrders), cell: ({ row }) => `${workloadOf(row.original.id, workOrders)} / ${row.original.maxConcurrent}` },
    { header: "Location", accessorFn: (t) => t.baseLocation },
    { id: "rec", header: "Record", accessorFn: (t) => (t.active ? "Active" : "Inactive"), cell: ({ row }) => <StatusBadge status={row.original.active ? "Available" : "Unavailable"} /> },
    {
      id: "act", header: "", enableSorting: false, cell: ({ row }) => (
        <div className="flex gap-1"><Button size="sm" variant="outline" aria-label="Edit" onClick={() => setEditing(row.original)}><Pencil size={13} /></Button><Button size="sm" variant="outline" onClick={() => setConfirm(row.original)}><Power size={13} />{row.original.active ? "Deactivate" : "Activate"}</Button></div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Technicians" subtitle="Profiles, skills, availability and workload used by the recommendation engine." actions={<Button onClick={() => setEditing("new")}><Plus size={16} />Add technician</Button>} />
      <DataTable data={technicians} columns={columns} loading={loading} searchPlaceholder="Search name, skill, location…" />

      <Modal open={!!editing} onClose={() => setEditing(null)} wide title={editing === "new" ? "Add technician" : "Edit technician"}>{editing && <TechForm initial={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}</Modal>
      <ConfirmDialog open={!!confirm} title={confirm?.active ? "Deactivate technician?" : "Activate technician?"} message={confirm?.active ? "Inactive technicians are excluded from recommendations. Task history is kept." : "This technician will appear in recommendations again."}
        onCancel={() => setConfirm(null)} onConfirm={() => { if (confirm) { toggleTechnician(confirm.id); toast("Technician record updated"); } setConfirm(null); }} />

      <Modal open={!!view} onClose={() => setViewId(null)} wide title={view?.name ?? ""}>
        {view && (() => {
          const mine = workOrders.filter((w) => w.assignedTo === view.id);
          return (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 text-sm">
                <div className="flex gap-2"><StatusBadge status={view.availability} /><Badge tone="outline">{view.experienceYears} yrs</Badge></div>
                <div>{view.phone} · {view.email}</div><div>Base: {view.baseLocation}</div>
                <div className="flex flex-wrap gap-1">{view.skills.map((s) => <Badge key={s} tone="outline">{s}</Badge>)}</div>
                {view.certifications.length > 0 && <div>Certifications: {view.certifications.join(", ")}</div>}
                <div className="font-semibold">Workload: {workloadOf(view.id, workOrders)} / {view.maxConcurrent}</div>
                <h3 className="pt-2 font-semibold">Assigned & completed tasks</h3>
                <ul className="divide-y divide-ink/15">{mine.length === 0 && <li className="py-1 opacity-70">None yet</li>}{mine.map((w) => <li key={w.id} className="flex justify-between py-1"><span>{w.id} · {w.title.slice(0, 32)}…<div className="text-xs opacity-60">{fmt(w.createdAt)}</div></span><StatusBadge status={w.status} /></li>)}</ul>
              </div>
              <Card className="p-2"><MapClient height="300px" points={[{ id: view.id, lat: view.lat, lng: view.lng, kind: "technician", label: view.name, popup: <b>{view.name}</b> }]} /></Card>
            </div>
          );
        })()}
      </Modal>
    </>
  );
}