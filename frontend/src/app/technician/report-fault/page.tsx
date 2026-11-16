"use client";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2 } from "lucide-react";
import { Button, Card, EmptyState, Field, Options, PageHeader, Select, SeverityBadge, StatusBadge, Textarea, toast } from "@/components/ui";
import PhotoPicker from "@/components/PhotoPicker";
import { useStore } from "@/lib/store";
import { useTechnician } from "@/lib/use-technician";
import { useQueryParam } from "@/lib/hooks";
import { FAULT_CATALOG, OPERATIONAL_IMPACTS, URGENCY_LEVELS } from "@/lib/config";
import { fmt } from "@/lib/utils";

const schema = z.object({
  assetId: z.string().min(1, "Select the generator"),
  subsystem: z.enum(["Alternator", "Engine"]),
  faultType: z.string().min(1, "Select a fault category"),
  component: z.string(),
  symptoms: z.string().min(10, "Describe the symptoms (min 10 characters)"),
  urgency: z.string().min(1, "Select how urgent it is"),
  impact: z.string().min(1, "Select the operational impact"),
});
type FormValues = z.infer<typeof schema>;

export default function ReportFaultPage() {
  const { id, name } = useTechnician();
  const { generators, workOrders, parts, faults, reportManualFault } = useStore();
  const taskParam = useQueryParam("task");
  const preset = workOrders.find((w) => w.id === taskParam && w.assignedTo === id);
  const assets = generators.filter((g) => g.active);
  const [photos, setPhotos] = useState<string[]>([]);
  const [doneId, setDoneId] = useState<string | null>(null);

  const { register, handleSubmit, control, setValue, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { assetId: preset?.assetId ?? assets[0]?.id ?? "", subsystem: "Engine", faultType: "", component: "", symptoms: "", urgency: "", impact: "" },
  });
  const sub = useWatch({ control, name: "subsystem" });
  const faultTypes = Object.keys(FAULT_CATALOG).filter((c) => FAULT_CATALOG[c].subsystem === sub && FAULT_CATALOG[c].severity !== "Normal");
  const components = [...new Set(parts.map((p) => p.component))];

  function onSubmit(v: FormValues) {
    const description = [
      v.symptoms.trim(),
      `Urgency: ${v.urgency}.`, `Operational impact: ${v.impact}.`,
      v.component ? `Component / area: ${v.component}.` : "",
      preset ? `Observed during ${preset.id}.` : "",
      photos.length ? `Photos attached: ${photos.length}.` : "",
    ].filter(Boolean).join(" ");
    const fid = reportManualFault({ assetId: v.assetId, faultType: v.faultType, description });
    toast(`Fault ${fid} sent to your manager`); setDoneId(fid); setPhotos([]);
    reset({ assetId: v.assetId, subsystem: v.subsystem, faultType: "", component: "", symptoms: "", urgency: "", impact: "" });
  }

  const mine = faults.filter((f) => f.source === "Manual Report" && f.reportedBy === name);

  return (
    <>
      <PageHeader title="Report a Fault" subtitle="Use this when no ML prediction exists, or you found a problem the system has not detected. Your manager reviews it and creates a work order." />
      {doneId && <Card className="mb-5 border-2 border-accent"><div className="flex items-center gap-2 font-bold"><CheckCircle2 size={18} />Fault {doneId} submitted</div><p className="mt-1 text-sm">It is visible to your manager as a <b>Manual Report</b> and can be followed below.</p></Card>}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Card className="grid gap-3 sm:grid-cols-2">
          <Field label="Generator asset" error={errors.assetId?.message}><Select {...register("assetId")}>{assets.map((g) => <option key={g.id} value={g.id}>{g.id} · {g.siteName}</option>)}</Select></Field>
          <Field label="Subsystem"><Select {...register("subsystem", { onChange: () => setValue("faultType", "") })}><option>Engine</option><option>Alternator</option></Select></Field>
          <Field label="Fault category" error={errors.faultType?.message}><Select {...register("faultType")}><option value="">Select…</option><Options list={faultTypes} /></Select></Field>
          <Field label="Component / area (optional)"><Select {...register("component")}><option value="">Not sure</option><Options list={components} /></Select></Field>
          <Field label="Urgency" error={errors.urgency?.message}><Select {...register("urgency")}><option value="">Select…</option><Options list={URGENCY_LEVELS} /></Select></Field>
          <Field label="Operational impact" error={errors.impact?.message}><Select {...register("impact")}><option value="">Select…</option><Options list={OPERATIONAL_IMPACTS} /></Select></Field>
        </Card>
        <Card className="space-y-3">
          <Field label="Symptoms / observations" error={errors.symptoms?.message}><Textarea rows={4} {...register("symptoms")} placeholder="What did you see, hear, smell or measure? When does it happen?" /></Field>
          <PhotoPicker names={photos} onChange={setPhotos} />
        </Card>
        <div className="flex justify-end"><Button type="submit" variant="accent" className="w-full sm:w-auto">Submit fault report</Button></div>
      </form>

      <h2 className="mb-3 mt-8 font-bold">My fault reports</h2>
      {mine.length === 0 ? <EmptyState title="No reports yet" text="Faults you report will be tracked here." /> : (
        <ul className="space-y-2">
          {mine.map((f) => (
            <li key={f.id}><Card className="text-sm"><div className="flex flex-wrap items-center gap-2"><b>{f.id}</b><span>{f.assetId} · {f.faultType}</span><SeverityBadge severity={f.severity} /><StatusBadge status={f.status} />{f.workOrderId && <span className="text-xs">→ {f.workOrderId}</span>}</div><p className="mt-1 text-xs opacity-80">{f.description}</p><p className="mt-1 text-xs opacity-60">{fmt(f.reportedAt)}</p></Card></li>
          ))}
        </ul>
      )}
    </>
  );
}