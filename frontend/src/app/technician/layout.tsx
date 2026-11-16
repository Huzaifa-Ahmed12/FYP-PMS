import { Suspense } from "react";
import TechnicianShell from "@/components/TechnicianShell";

export const instant = false;

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <TechnicianShell>{children}</TechnicianShell>
    </Suspense>
  );
}