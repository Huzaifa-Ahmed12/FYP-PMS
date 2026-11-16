"use client";
import { useStore } from "./store";
import type { Technician } from "./types";

/**
 * The logged-in technician and their profile record.
 * TechnicianShell only renders pages once both exist, so the non-null assertion is safe inside /technician/*.
 * BACKEND: replace with the authenticated user from your session / GET /api/technicians/me.
 */
export function useTechnician(): { id: string; name: string; tech: Technician } {
  const user = useStore((s) => s.user);
  const tech = useStore((s) => s.technicians.find((t) => t.id === s.user?.id));
  return { id: user!.id, name: user!.name, tech: tech! };
}