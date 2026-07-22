import type { CompleteMaintenanceOutcome } from "@/components/TaskCompletionModal";

export type { CompleteMaintenanceOutcome };

export type CompleteMaintenanceOptions = {
  completedAt: string;
  completionNotes?: string;
  photoUris?: string[];
  outcome: CompleteMaintenanceOutcome;
  nextDue?: string;
  intervalDays?: number;
};
