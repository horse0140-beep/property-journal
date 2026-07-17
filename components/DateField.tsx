/**
 * Re-export shared date picker. Prefer importing from DatePickerField.
 * Kept so older imports continue to resolve during the transition.
 */
export {
  DatePickerField as DateField,
  DatePickerField,
  formatPickerDateDisplay,
  toIsoDateValue,
} from "@/components/DatePickerField";
export type { DatePickerFieldProps } from "@/components/DatePickerField";
