export type CompleteMaintenanceOutcome = "delete" | "reschedule" | "archive";

export type CompleteMaintenanceOptions = {
  completedAt: string;
  completionNotes?: string;
  photoUris?: string[];
  outcome: CompleteMaintenanceOutcome;
  nextDue?: string;
  intervalDays?: number;
};
