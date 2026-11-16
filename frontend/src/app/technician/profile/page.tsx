"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LocateFixed, LogOut } from "lucide-react";
import { Badge, Button, Card, Field, Input, Options, PageHeader, ProgressBar, Select, StatusBadge, toast } from "@/components/ui";
import MapClient from "@/components/MapClient";
import { useStore } from "@/lib/store";
import { useTechnician } from "@/lib/use-technician";
import { AVAILABILITIES } from "@/lib/config";
import { workloadOf } from "@/lib/services";
import type { Availability } from "@/lib/types";

const schema = z.object({
  phone: z.string().min(7, "Contact number required"),
  baseLocation: z.string().min(2, "Base location required"),
  lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180),
});
type FormValues = z.infer<typeof schema>;

export default function TechnicianProfile() {
  const router = useRouter();
  const { tech } = useTechnician();
  const { workOrders, saveTechnician, logout } = useStore();
  const [consent, setConsent] = useState(false);
  const [prefs, setPrefs] = useState({ assignments: true, parts: true, manager: true });
  const { register, handleSubmit, setValue, formState: { errors, isDirty } } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { phone: tech.phone, baseLocation: tech.baseLocation, lat: tech.lat, lng: tech.lng } });

  const onSubmit = (v: FormValues) => { saveTechnician({ ...tech, ...v }); toast("Profile updated"); };
  function locate() {
    if (!navigator.geolocation) return toast("Location is not available on this device");
    navigator.geolocation.getCurrentPosition(
      (p) => { setValue("lat", Number(p.coords.latitude.toFixed(5)), { shouldDirty: true }); setValue("lng", Number(p.coords.longitude.toFixed(5)), { shouldDirty: true }); toast("Location captured – save to share it with your manager"); },
      () => toast("Could not read your location (permission denied)"),
    );
  }
  const load = workloadOf(tech.id, workOrders);

  return (
    <>
      <PageHeader title="Profile & Availability" actions={<Button variant="outline" onClick={() => { logout(); router.replace("/login"); }}><LogOut size={15} />Log out</Button>} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="font-bold">Availability</h2>
          <div className="flex items-center gap-2"><StatusBadge status={tech.availability} /><span className="text-xs opacity-70">The manager sees this when assigning work.</span></div>
          <Field label="Set my status"><Select value={tech.availability} onChange={(e) => { saveTechnician({ ...tech, availability: e.target.value as Availability }); toast(`Availability set to ${e.target.value}`); }}><Options list={AVAILABILITIES} /></Select></Field>
          <div><div className="mb-1 flex justify-between text-sm"><span>Workload</span><b>{load} / {tech.maxConcurrent}</b></div><ProgressBar value={load} max={tech.maxConcurrent} accent /></div>
        </Card>

        <Card className="space-y-2 text-sm">
          <h2 className="font-bold">My details <span className="text-xs font-normal opacity-60">(managed by your manager)</span></h2>
          <div><b>{tech.name}</b> · {tech.email}</div>
          <div>Experience: {tech.experienceYears} years</div>
          <div className="flex flex-wrap gap-1">{tech.skills.map((s) => <Badge key={s} tone="outline">{s}</Badge>)}</div>
          <div>Certifications: {tech.certifications.length ? tech.certifications.join(", ") : "—"}</div>
        </Card>

        <Card>
          <h2 className="mb-3 font-bold">Contact & location</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <Field label="Phone" error={errors.phone?.message}><Input {...register("phone")} /></Field>
            <Field label="Base / current location" error={errors.baseLocation?.message}><Input {...register("baseLocation")} /></Field>
            <div className="grid grid-cols-2 gap-2"><Field label="Latitude" error={errors.lat?.message}><Input type="number" step="any" {...register("lat", { valueAsNumber: true })} /></Field><Field label="Longitude" error={errors.lng?.message}><Input type="number" step="any" {...register("lng", { valueAsNumber: true })} /></Field></div>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 accent-ink" checked={consent} onChange={(e) => setConsent(e.target.checked)} />I consent to sharing my device location with my manager (used for the proximity score).</label>
            <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!consent} onClick={locate}><LocateFixed size={15} />Use my current location</Button><Button type="submit" disabled={!isDirty}>Save changes</Button></div>
          </form>
        </Card>

        <div className="space-y-5">
          <MapClient height="220px" points={[{ id: tech.id, lat: tech.lat, lng: tech.lng, kind: "technician", highlight: true, label: tech.name, popup: <b>{tech.name} · {tech.baseLocation}</b> }]} />
          <Card>
            <h2 className="mb-2 font-bold">Notification preferences (UI only)</h2>
            {([["assignments", "New assignments"], ["parts", "Part-request decisions"], ["manager", "Manager messages"]] as const).map(([k, label]) => (
              <label key={k} className="mb-2 flex items-center gap-2 text-sm"><input type="checkbox" className="accent-ink" checked={prefs[k]} onChange={(e) => setPrefs({ ...prefs, [k]: e.target.checked })} />{label}</label>
            ))}
            <Button size="sm" variant="outline" onClick={() => toast("Preferences saved (local only)")}>Save</Button>
          </Card>
        </div>
      </div>
    </>
  );
}