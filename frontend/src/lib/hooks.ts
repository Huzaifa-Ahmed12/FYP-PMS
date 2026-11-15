"use client";
import { useEffect, useState, useSyncExternalStore } from "react";

const noop = () => () => {};
/** true only after hydration (avoids localStorage/SSR mismatch) */
export const useMounted = () => useSyncExternalStore(noop, () => true, () => false);
/** read ?name=value from the URL without needing a Suspense boundary */
export const useQueryParam = (name: string) =>
  useSyncExternalStore(noop, () => new URLSearchParams(window.location.search).get(name), () => null);
/** fake loading delay so skeleton / loading states are visible in the demo */
export function useSimulatedLoad(ms = 400) {
  const [loading, setLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setLoading(false), ms); return () => clearTimeout(t); }, [ms]);
  return loading;
}