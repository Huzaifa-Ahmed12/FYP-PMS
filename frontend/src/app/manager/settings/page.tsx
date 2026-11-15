"use client";
import { useState } from "react";
import { Badge, Button, Card, ConfirmDialog, Field, Input, PageHeader, toast } from "@/components/ui";
import { useStore } from "@/lib/store";
import { GENERATOR_MODEL } from "@/lib/config";

export default function SettingsPage() {
  const { user, resetDemo } = useStore();
  const [confirm, setConfirm] = useState(false);
  const [prefs, setPrefs] = useState({ critical: true, parts: true, completion: true });

  return (
    <>
      <PageHeader title="Profile & Settings" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-bold">Profile</h2>
          <div className="space-y-3">
            <Field label="Name"><Input value={user?.name ?? ""} readOnly disabled /></Field>
            <Field label="Email"><Input value={user?.email ?? ""} readOnly disabled /></Field>
            <Field label="Role"><Input value="Manager" readOnly disabled /></Field>
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 font-bold">Project configuration (fixed)</h2>
          <p className="text-sm">Generator model: <Badge tone="accent">{GENERATOR_MODEL}</Badge></p>
          <p className="mt-2 text-xs opacity-70">Change <code>GENERATOR_MODEL</code> in <code>src/lib/config.ts</code> once the supervisor confirms the make, model and rating. Users cannot pick arbitrary brands.</p>
        </Card>

        <Card>
          <h2 className="mb-3 font-bold">Notification preferences (UI only)</h2>
          {([["critical", "Critical & High alerts"], ["parts", "Part requests"], ["completion", "Task completion"]] as const).map(([k, label]) => (
            <label key={k} className="mb-2 flex items-center gap-2 text-sm"><input type="checkbox" className="accent-ink" checked={prefs[k]} onChange={(e) => setPrefs({ ...prefs, [k]: e.target.checked })} />{label}</label>
          ))}
          <Button size="sm" variant="outline" onClick={() => toast("Preferences saved (local only)")}>Save</Button>
        </Card>

        <Card>
          <h2 className="mb-3 font-bold">Demo data</h2>
          <p className="mb-3 text-sm">All data is mock and stored in this browser. Reset restores the original seed scenario.</p>
          <Button variant="outline" onClick={() => setConfirm(true)}>Reset demo data</Button>
        </Card>
      </div>
      <ConfirmDialog open={confirm} title="Reset all demo data?" message="Every change you made (assets, tasks, parts, assignments) will be replaced by the original seed data." confirmLabel="Reset"
        onCancel={() => setConfirm(false)} onConfirm={() => { resetDemo(); setConfirm(false); toast("Demo data reset"); }} />
    </>
  );
}