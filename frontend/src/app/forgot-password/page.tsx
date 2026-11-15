"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button, Card, Field, Input } from "@/components/ui";

export default function ForgotPassword() {
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-2xl font-bold">Reset password</h1>
        {sent ? <p className="my-4 text-sm">If an account exists for <b>{email}</b>, a reset link will be sent. (UI placeholder – email delivery is backend work.)</p> : (
          <form onSubmit={(e: FormEvent) => { e.preventDefault(); setSent(true); }} className="mt-4 space-y-4">
            <Field label="Account email"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Button type="submit" className="w-full">Send reset link</Button>
          </form>
        )}
        <Link href="/login" className="mt-4 block text-sm underline">Back to sign in</Link>
      </Card>
    </div>
  );
}