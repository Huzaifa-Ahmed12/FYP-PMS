"use client";
import { Button, Card } from "@/components/ui";
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return <Card className="mx-auto mt-10 max-w-md text-center"><h1 className="text-xl font-bold">Something went wrong</h1><p className="my-2 text-sm">The page could not be loaded. This is the server-error state.</p><Button onClick={reset}>Try again</Button></Card>;
}