"use client";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui";
import TaskCard from "@/components/TaskCard";
import { useStore } from "@/lib/store";
import { useTechnician } from "@/lib/use-technician";
import { byUrgency } from "@/lib/technician";

/** Index of the "Maintenance Update" menu item: pick the task you want to update. */
export default function MaintenanceIndex() {
  const { id } = useTechnician();
  const { workOrders } = useStore();
  const list = workOrders.filter((w) => w.assignedTo === id && ["Accepted", "In Progress", "On Hold"].includes(w.status)).sort(byUrgency);
  return (
    <>
      <PageHeader title="Maintenance Update" subtitle="Choose the task you are working on to log progress, parts used and completion." />
      <div className="space-y-3">
        {list.length === 0 ? <EmptyState title="No task to update" text="Accept a task first, then start work from its detail page." /> : list.map((w) => (
          <TaskCard key={w.id} wo={w}><LinkButton size="sm" variant="accent" href={`/technician/maintenance/${w.id}`}>Open update</LinkButton></TaskCard>
        ))}
        {list.length === 0 && <LinkButton href="/technician/tasks" variant="outline">Go to my tasks</LinkButton>}
      </div>
    </>
  );
}