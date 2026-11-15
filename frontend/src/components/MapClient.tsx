"use client";
import dynamic from "next/dynamic";
import { Skeleton } from "./ui";

const MapClient = dynamic(() => import("./MapView"), { ssr: false, loading: () => <Skeleton className="h-[420px] w-full" /> });
export default MapClient;
export type { MapPoint } from "./MapView";