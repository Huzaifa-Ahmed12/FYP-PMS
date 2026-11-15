"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Zap } from "lucide-react";
import { Button, Card, Field, Input } from "@/components/ui";
import { useStore } from "@/lib/store";
import { useMounted } from "@/lib/hooks";
import { APP_NAME } from "@/lib/config";

export default function LoginPage() {
  const router = useRouter();
  const mounted = useMounted();
  const { user, login } = useStore();   
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (mounted && user) router.replace(user.role === "manager" ? "/manager/dashboard" : "/technician/dashboard");
  }, [mounted, user, router]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!login(email.trim(), password)) setError("Invalid email or password.");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-ink p-10 text-paper lg:flex">
        <div className="flex items-center gap-2 text-xl font-bold"><span className="rounded bg-accent p-1.5 text-ink"><Zap /></span>{APP_NAME}</div>
        <div>
          <h1 className="text-4xl font-bold leading-tight">AI-based predictive maintenance for <span className="text-accent">commercial diesel generators</span></h1>
          <p className="mt-4 max-w-md opacity-80">Detect faults, assess severity, assign the right technician and close the maintenance loop from one platform.</p>
        </div>
        <p className="text-xs opacity-60">Final Year Project · Bahria University, Islamabad</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-6">
          <h2 className="text-2xl font-bold">Sign in</h2>
          <p className="mb-5 text-sm opacity-70">Use a demo account to explore the console.</p>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Email"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="manager@dgpdm.pk" /></Field>
            <Field label="Password" error={error}><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
            <Button type="submit" className="w-full">Sign in</Button>
          </form>
          <div className="mt-3 text-right text-sm"><Link href="/forgot-password" className="underline">Forgot password?</Link></div>
          <div className="mt-5 rounded-md border border-dashed border-ink/50 p-3 text-xs">
            <div className="mb-2 font-semibold">Demo accounts</div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => { setEmail("manager@dgpdm.pk"); setPassword("manager123"); }}>Manager</Button>
              <Button size="sm" variant="outline" onClick={() => { setEmail("tech@dgpdm.pk"); setPassword("tech123"); }}>Technician</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}