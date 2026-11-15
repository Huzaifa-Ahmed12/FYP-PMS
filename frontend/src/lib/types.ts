export type Role = "manager" | "technician";
export type Severity = "Normal" | "Warning" | "High" | "Critical";
export type OperationalStatus = "Running" | "Stopped" | "Under Maintenance" | "Unknown";
export type Availability = "Available" | "Busy" | "Unavailable" | "On Leave";
export type Subsystem = "Alternator" | "Engine";
export type FaultSource = "ML Diagnostic" | "Manual Report";
export type FaultStatus = "Open" | "Acknowledged" | "Under Maintenance" | "Resolved";
export type TaskStatus = "Draft" | "Pending Assignment" | "Assigned" | "Accepted" | "In Progress" | "On Hold" | "Completed" | "Cancelled";
export type Priority = "Low" | "Medium" | "High" | "Urgent";
export type RequestStatus = "Pending" | "Approved" | "Rejected" | "Partially Approved" | "Fulfilled";
export type DataSource = "CSV_UPLOAD" | "SIMULATION" | "API" | "SENSOR_GATEWAY";
export type NotificationType = "fault" | "assignment" | "acceptance" | "progress" | "part_request" | "completion" | "system";
export type HistoryType = "Diagnostic" | "Fault" | "Task" | "Parts" | "Assignment" | "Generator";

export interface User { id: string; name: string; email: string; role: Role }

export interface GeneratorAsset {
  id: string; // unique asset ID, e.g. DG-10189
  model: string; serialNumber: string; ratedCapacityKva: number;
  siteName: string; address: string; lat: number; lng: number; installDate: string;
  operationalStatus: OperationalStatus; health: Severity; active: boolean; notes: string;
  lastDiagnosticAt: string; latestReadings: Record<string, number>;
}
export interface Technician {
  id: string; name: string; phone: string; email: string; skills: string[]; certifications: string[];
  experienceYears: number; availability: Availability; maxConcurrent: number;
  baseLocation: string; lat: number; lng: number; active: boolean;
}
export interface DiagnosticRecord {
  id: string; assetId: string; timestamp: string; subsystem: Subsystem; predictedClass: string;
  confidence: number; severity: Severity; dataSource: DataSource; modelName: string; modelVersion: string;
  validation: "Valid" | "Valid with warnings" | "Invalid"; inputSummary: Record<string, number>;
}
export interface AuditEntry { id: string; at: string; by: string; action: string }
export interface Fault {
  id: string; assetId: string; faultType: string; subsystem: Subsystem; severity: Severity;
  source: FaultSource; status: FaultStatus; reportedAt: string; reportedBy: string; description: string;
  diagnosticId?: string; workOrderId?: string; audit: AuditEntry[];
}
export interface TimelineEntry { id: string; at: string; by: string; text: string; status?: TaskStatus }
export interface PartAllocation { partId: string; qty: number }
export interface WorkOrder {
  id: string; assetId: string; faultId?: string; title: string; description: string; severity: Severity;
  priority: Priority; status: TaskStatus; requiredSkills: string[]; assignedTo?: string; dueDate: string;
  createdAt: string; completedAt?: string; notes: string; allocations: PartAllocation[];
  usedParts: PartAllocation[]; workSummary?: string; timeline: TimelineEntry[];
}
export type NewWorkOrder = Pick<WorkOrder, "assetId" | "faultId" | "title" | "description" | "severity" | "priority" | "requiredSkills" | "dueDate" | "notes">;
export interface Part { id: string; name: string; code: string; component: string; quantity: number; minStock: number; unit: string; location: string; notes: string }
export interface PartRequest {
  id: string; workOrderId: string; partId: string; technicianId: string; qty: number; reason: string;
  status: RequestStatus; requestedAt: string; approvedQty?: number; decisionNote?: string; decidedAt?: string;
}
export interface Notification { id: string; type: NotificationType; title: string; message: string; severity?: Severity; at: string; read: boolean; link?: string }
export interface Assignment {
  id: string; workOrderId: string; assetId: string; technicianId: string; recommendedId?: string;
  score?: number; overridden: boolean; reason?: string; at: string; by: string;
}
export interface HistoryEvent {
  id: string; at: string; type: HistoryType; assetId: string; title: string; detail: string;
  subsystem?: Subsystem; faultType?: string; severity?: Severity; technicianId?: string;
}