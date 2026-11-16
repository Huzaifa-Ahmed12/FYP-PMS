"use client";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2 } from "lucide-react";
import { Badge, Button, Card, Field, Input, LinkButton, PageHeader, Select, Textarea, cn, toast } from "@/components/ui";
import PhotoPicker from "@/components/PhotoPicker";
import { useStore } from "@/lib/store";
import { useTechnician } from "@/lib/use-technician";
import { useQueryParam } from "@/lib/hooks";
import { INSPECTION_CHECKLIST } from "@/lib/config";
import { OPEN_STATUSES } from "@/lib/technician";
import { fmt } from "@/lib/utils";
import type { ChecklistState } from "@/lib/types";

const STATES: ChecklistState[] = ["OK", "Needs attention", "N/A"];
const schema = z.object({
  assetId: z.string().min(1, "Select the generator"),
  workOrderId: z.string(),
  condition: z.enum(["Good", "Fair", "Poor"], { error: "Select the observed condition" }),
  notes: z.string().min(5, "Add inspection notes (min 5 characters)"),
  checklist: z.array(z.string()).refine((a) => a.every((x) => x !== ""), "Answer every checklist item (use N/A if it does not apply)"),
});
type FormValues = z.infer<typeof schema>;

export default function InspectionPage() {
  const { id } = useTechnician();
  const { generators, workOrders, inspections, submitInspection } = useStore();
  const taskParam = useQueryParam("task");
  const myOpen = workOrders.filter((w) => w.assignedTo === id && OPEN_STATUSES.includes(w.status));
  const preset = myOpen.find((w) => w.id === taskParam);
  const assets = generators.filter((g) => g.active);
  const [photos, setPhotos] = useState<string[]>([]);
  const [now] = useState(() => new Date().toISOString());
  const [doneId, setDoneId] = useState<{ id: string; flagged: boolean; wo: string } | null>(null);

  const { register, handleSubmit, control, setValue, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { assetId: preset?.assetId ?? assets[0]?.id ?? "", workOrderId: preset?.id ?? "", notes: "", checklist: INSPECTION_CHECKLIST.map(() => "") },
  });
  const checklist = useWatch({ control, name: "checklist" });
  const condition = useWatch({ control, name: "condition" });

  function onSubmit(v: FormValues) {
    const flagged = v.checklist.includes("Needs attention") || v.condition === "Poor";
    const iid = submitInspection({
      assetId: v.assetId, workOrderId: v.workOrderId || undefined, technicianId: id, condition: v.condition, notes: v.notes.trim(), photos,
      checklist: INSPECTION_CHECKLIST.map((item, i) => ({ item, state: v.checklist[i] as ChecklistState })),
    });
    toast(`Inspection ${iid} submitted`); setDoneId({ id: iid, flagged, wo: v.workOrderId }); setPhotos([]);
    reset({ assetId: v.assetId, workOrderId: "", notes: "", checklist: INSPECTION_CHECKLIST.map(() => "") });
  }

  const mineInsp = inspections.filter((i) => i.technicianId === id);

  return (
    <>
      <PageHeader title="On-site Inspection" subtitle="Record the condition of the generator you are visiting. Findings go to the manager and the task timeline." />

      {doneId && (
        <Card className="mb-5 border-2 border-accent">
          <div className="flex items-center gap-2 font-bold"><CheckCircle2 size={18} />Inspection {doneId.id} submitted</div>
          <p className="mt-1 text-sm">{doneId.flagged ? "Something needs attention. If this is a new problem, report it as a fault so the manager can create a work order." : "Your manager has been notified."}</p>
          <div className="mt-3 flex flex-wrap gap-2">{doneId.flagged && <LinkButton variant="accent" href={`/technician/report-fault${doneId.wo ? `?task=${doneId.wo}` : ""}`}>Report a fault</LinkButton>}<Button variant="outline" onClick={() => setDoneId(null)}>New inspection</Button></div>
        </Card>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Card className="grid gap-3 sm:grid-cols-2">
          <Field label="Related work order (optional)">
            <Select {...register("workOrderId", { onChange: (e) => { const w = myOpen.find((x) => x.id === e.target.value); if (w) setValue("assetId", w.assetId); } })}>
              <option value="">Not linked to a task</option>{myOpen.map((w) => <option key={w.id} value={w.id}>{w.id} · {w.title.slice(0, 40)}</option>)}
            </Select>
          </Field>
          <Field label="Generator asset" error={errors.assetId?.message}><Select {...register("assetId")}>{assets.map((g) => <option key={g.id} value={g.id}>{g.id} · {g.siteName}</option>)}</Select></Field>
          <Field label="Date & time"><Input value={fmt(now)} readOnly disabled /></Field>
          <div>
            <div className="mb-1 text-sm font-medium">Observed condition</div>
            <div className="flex gap-2" role="radiogroup" aria-label="Observed condition">
              {(["Good", "Fair", "Poor"] as const).map((c) => (
                <label key={c} className={cn("flex-1 cursor-pointer rounded-md border px-3 py-2 text-center text-sm", condition === c ? "border-ink bg-ink font-semibold text-paper" : "border-ink/40")}>
                  <input type="radio" value={c} className="sr-only" {...register("condition")} />{c}
                </label>
              ))}
            </div>
            {errors.condition && <span role="alert" className="mt-1 block text-xs font-semibold">⚠ {errors.condition.message}</span>}
          </div>
        </Card>

        <Card>
          <h2 className="mb-1 font-bold">Checklist</h2>
          <p className="mb-3 text-xs opacity-70">Generic walk-around items. The final list should follow the supervisor-approved component taxonomy.</p>
          <ul className="divide-y divide-ink/15">
            {INSPECTION_CHECKLIST.map((item, i) => (
              <li key={item} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="text-sm">{item}</span>
                <div className="flex gap-1" role="group" aria-label={item}>
                  {STATES.map((s) => {
                    const on = checklist[i] === s;
                    return <button type="button" key={s} aria-pressed={on} onClick={() => { const n = [...checklist]; n[i] = s; setValue("checklist", n, { shouldValidate: true }); }}
                      className={cn("rounded border px-2.5 py-1 text-xs", on ? (s === "Needs attention" ? "border-ink bg-accent font-semibold" : "border-ink bg-ink text-paper") : "border-ink/40")}>{on && s === "Needs attention" && "⚠ "}{on && s !== "Needs attention" && "✓ "}{s}</button>;
                  })}
                </div>
              </li>
            ))}
          </ul>
          {errors.checklist && <span role="alert" className="mt-2 block text-xs font-semibold">⚠ {errors.checklist.message}</span>}
        </Card>

        <Card className="space-y-3">
          <Field label="Inspection notes" error={errors.notes?.message}><Textarea rows={4} {...register("notes")} placeholder="What you saw, heard or measured…" /></Field>
          <PhotoPicker names={photos} onChange={setPhotos} />
        </Card>
        <div className="flex justify-end"><Button type="submit" variant="accent" className="w-full sm:w-auto">Submit inspection</Button></div>
      </form>

      <h2 className="mb-3 mt-8 font-bold">My recent inspections</h2>
      {mineInsp.length === 0 ? <p className="text-sm opacity-70">None yet.</p> : (
        <ul className="space-y-2">
          {mineInsp.slice(0, 6).map((i) => (
            <li key={i.id}><Card className="text-sm"><div className="flex flex-wrap items-center gap-2"><b>{i.id}</b><Badge tone="outline">{i.assetId}</Badge><Badge tone={i.condition === "Poor" ? "accent" : "outline"}>{i.condition}</Badge>{i.workOrderId && <Badge tone="muted">{i.workOrderId}</Badge>}<span className="text-xs opacity-70">{fmt(i.at)}</span></div>
              <p className="mt-1">{i.notes}</p>{i.checklist.filter((c) => c.state === "Needs attention").length > 0 && <p className="mt-1 text-xs">⚠ Needs attention: {i.checklist.filter((c) => c.state === "Needs attention").map((c) => c.item).join(", ")}</p>}</Card></li>
          ))}
        </ul>
      )}
    </>
  );
}