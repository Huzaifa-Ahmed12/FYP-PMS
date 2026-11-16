import { SEV_RANK } from "./config";
import { ACTIVE_STATUSES } from "./services";
import type { Part, WorkOrder } from "./types";

/** Statuses in which a task is still "open" for the technician (Assigned → On Hold). */
export const OPEN_STATUSES = ACTIVE_STATUSES;
/** Statuses where the technician is actually working on site. */
export const WORKING_STATUSES = ["Accepted", "In Progress", "On Hold"] as const;

export const today = () => new Date().toISOString().slice(0, 10);
export const isClosed = (w: WorkOrder) => w.status === "Completed" || w.status === "Cancelled";
export const isOverdue = (w: WorkOrder) => !isClosed(w) && w.dueDate < today();

/** Most urgent first: overdue → severity → earliest due date. */
export const byUrgency = (a: WorkOrder, b: WorkOrder) =>
  Number(isOverdue(b)) - Number(isOverdue(a)) || SEV_RANK[b.severity] - SEV_RANK[a.severity] || a.dueDate.localeCompare(b.dueDate);

/** Does an inventory part belong to the skills the task needs? (component names share their first word with the skill names) */
export const partFitsSkills = (p: Part, skills: string[]) => {
  const key = p.component.toLowerCase().split(" ")[0];
  return skills.some((s) => s.toLowerCase().includes(key));
};

/** The 4-step lifecycle shown as a stepper on the task page. */
export const LIFECYCLE = ["Assigned", "Accepted", "In Progress", "Completed"] as const;
export const lifecycleIndex = (status: string) => (status === "On Hold" ? 2 : Math.max(0, LIFECYCLE.indexOf(status as (typeof LIFECYCLE)[number])));