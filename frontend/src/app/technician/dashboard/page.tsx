"use client";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { useStore } from "@/lib/store";

export default function TechnicianPlaceholder() {
  const router = useRouter();
  const { user, logout } = useStore();
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="max-w-md text-center">
        <h1 className="text-xl font-bold">Technician module</h1>
        <p className="my-3 text-sm">Signed in as {user?.name ?? "—"}. The technician interface will be built after the manager console.</p>
        <Button onClick={() => { logout(); router.replace("/login"); }}>Log out</Button>
      </Card>
    </div>
  );
}