"use client";
import { useState } from "react";
import MapClient, { type MapPoint } from "@/components/MapClient";
import { Button, Card, PageHeader, SeverityBadge, StatusBadge } from "@/components/ui";
import { useStore } from "@/lib/store";

export default function MapPage() {
  const { generators, technicians } = useStore();
  const [showGen, setShowGen] = useState(true);
  const [showTech, setShowTech] = useState(true);

  const points: MapPoint[] = [
    ...(showGen ? generators.filter((g) => g.active).map((g): MapPoint => ({ id: g.id, lat: g.lat, lng: g.lng, kind: "generator", severity: g.health, label: g.id, popup: <div className="space-y-1 text-sm"><b>{g.id}</b><div>{g.siteName}</div><div className="flex gap-1"><StatusBadge status={g.operationalStatus} /><SeverityBadge severity={g.health} /></div><a className="underline" href={`/manager/generators/${g.id}`}>Open detail</a></div> })) : []),
    ...(showTech ? technicians.filter((t) => t.active).map((t): MapPoint => ({ id: t.id, lat: t.lat, lng: t.lng, kind: "technician", label: t.name, popup: <div className="space-y-1 text-sm"><b>{t.name}</b><div>{t.baseLocation}</div><StatusBadge status={t.availability} /></div> })) : []),
  ];

  return (
    <>
      <PageHeader title="Fleet Map" subtitle="Stored/demo coordinates – live GPS is not required for this phase."
        actions={<><Button variant={showGen ? "primary" : "outline"} onClick={() => setShowGen(!showGen)}>Generators</Button><Button variant={showTech ? "primary" : "outline"} onClick={() => setShowTech(!showTech)}>Technicians</Button></>} />
      <MapClient points={points} height="560px" />
      <Card className="mt-4 flex flex-wrap items-center gap-4 text-sm">
        <b>Legend (G = generator, T = technician)</b>
        {(["Normal", "Warning", "High", "Critical"] as const).map((s) => <SeverityBadge key={s} severity={s} />)}
      </Card>
    </>
  );
}