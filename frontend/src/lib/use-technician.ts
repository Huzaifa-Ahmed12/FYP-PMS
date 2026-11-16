"use client";
import { useStore } from "./store";
import { useMounted } from "./hooks";
import type { Technician } from "./types";

/** Harmless placeholder used only while there is no logged-in technician (see the note below). */
const PLACEHOLDER: Technician = {
  id: "", name: "", phone: "", email: "", skills: [], certifications: [], experienceYears: 0,
  availability: "Available", maxConcurrent: 1, baseLocation: "", lat: 0, lng: 0, active: true,
};

/**
 * The logged-in technician and their profile record.
 *
 * WHY THE PLACEHOLDER: Next.js 16 (dev mode, cacheComponents) renders every page on the server to validate
 * `instant` navigation. On the server nobody is logged in (the session lives in the browser store), so `user`
 * is null and the old `user!.id` crashed. Until the component has mounted in the browser (same moment on server
 * and on first hydration render, so no hydration mismatch) this returns an empty placeholder; afterwards it
 * returns the real logged-in technician. TechnicianShell never shows a page to a visitor unless that
 * technician exists and is active.
 *
 * BACKEND: replace with the authenticated user from your session / GET /api/technicians/me.
 */
export function useTechnician(): { id: string; name: string; tech: Technician } {
  const mounted = useMounted();
  const user = useStore((s) => s.user);
  const tech = useStore((s) => s.technicians.find((t) => t.id === s.user?.id));
  if (!mounted || !user || !tech) return { id: "", name: "", tech: PLACEHOLDER };
  return { id: user.id, name: user.name, tech };
}