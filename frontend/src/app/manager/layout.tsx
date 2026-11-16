import { Suspense } from "react";
import ManagerShell from "@/components/ManagerShell";

export const instant = false;

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <ManagerShell>{children}</ManagerShell>
    </Suspense>
  );
}