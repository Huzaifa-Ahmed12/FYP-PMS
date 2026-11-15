"use client";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, type ReactNode } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import type { Severity } from "@/lib/types";

export interface MapPoint { id: string; lat: number; lng: number; kind: "generator" | "technician"; severity?: Severity; label: string; popup: ReactNode; highlight?: boolean }

const SEV: Record<Severity, string> = {
  Normal: "bg-paper text-ink border-ink",
  Warning: "bg-accent/40 text-ink border-ink",
  High: "bg-accent text-ink border-ink",
  Critical: "bg-ink text-accent border-accent ring-2 ring-accent",
};
function icon(p: MapPoint) {
  const base = "flex h-8 w-8 items-center justify-center border-2 text-xs font-bold shadow";
  const html = p.kind === "generator"
    ? `<div class="${base} rounded-full ${SEV[p.severity ?? "Normal"]}">G</div>`
    : `<div class="${base} rotate-45 rounded-sm border-paper bg-ink text-paper ${p.highlight ? "ring-2 ring-accent" : ""}"><span class="-rotate-45">T</span></div>`;
  return L.divIcon({ className: "", html, iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -16] });
}
function Fit({ points }: { points: MapPoint[] }) {
  const map = useMap();
  const key = points.map((p) => p.id).join();
  useEffect(() => {
    if (!points.length) return;
    map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), { padding: [40, 40], maxZoom: 14 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

export default function MapView({ points, lines = [], height = "420px" }: { points: MapPoint[]; lines?: [number, number][][]; height?: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-ink/40" style={{ height }}>
      <MapContainer center={[33.68, 73.05]} zoom={11} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Fit points={points} />
        {lines.map((l, i) => <Polyline key={i} positions={l} pathOptions={{ color: "#14213d", weight: 3, dashArray: "6 8" }} />)}
        {points.map((p) => <Marker key={p.id} position={[p.lat, p.lng]} icon={icon(p)}><Popup>{p.popup}</Popup></Marker>)}
      </MapContainer>
    </div>
  );
}