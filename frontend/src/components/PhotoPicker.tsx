"use client";
import { useRef } from "react";
import { Camera, X } from "lucide-react";
import { Button } from "./ui";

/**
 * Optional photo attachment (requirement 7.3 – "if supported by the eventual backend").
 * MOCK: only the file names are kept. BACKEND: upload the File objects (multipart/form-data) and store the returned URLs.
 */
export default function PhotoPicker({ names, onChange }: { names: string[]; onChange: (n: string[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <div className="mb-1 text-sm font-medium">Photos (optional)</div>
      <input ref={ref} type="file" accept="image/*" multiple capture="environment" className="sr-only" aria-label="Attach photos"
        onChange={(e) => { onChange([...names, ...Array.from(e.target.files ?? []).map((f) => f.name)]); e.target.value = ""; }} />
      <Button variant="outline" onClick={() => ref.current?.click()}><Camera size={16} />Add photo</Button>
      {names.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2 text-xs">
          {names.map((n, i) => <li key={`${n}-${i}`} className="inline-flex items-center gap-1 rounded border border-ink/30 px-2 py-1">{n}<button type="button" aria-label={`Remove ${n}`} onClick={() => onChange(names.filter((_, j) => j !== i))}><X size={12} /></button></li>)}
        </ul>
      )}
      <p className="mt-1 text-xs opacity-60">Demo build: only the file names are saved.</p>
    </div>
  );
}