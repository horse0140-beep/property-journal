import type { Document } from "@/data/demoData";

export type PropertySection =
  | "overview"
  | "maintenance"
  | "paint"
  | "documents"
  | "photos"
  | "contractors";

export type MaintenanceView = "tasks" | "repairs" | "appliances";

export type PropertyModal =
  | "maintenance"
  | "repair"
  | "appliance"
  | "paint"
  | "document"
  | "photo"
  | "contractor"
  | null;

export const PROPERTY_SECTIONS: {
  key: PropertySection;
  label: string;
  icon: string;
  addLabel?: string;
}[] = [
  { key: "overview", label: "Overview", icon: "home-outline" },
  { key: "maintenance", label: "Maintenance", icon: "construct-outline", addLabel: "Add Task" },
  { key: "paint", label: "Paint", icon: "color-palette-outline", addLabel: "Add Paint Record" },
  { key: "documents", label: "Documents", icon: "folder-open-outline", addLabel: "Add Document" },
  { key: "photos", label: "Property Photos", icon: "images-outline", addLabel: "Add Photo" },
  { key: "contractors", label: "Contractors", icon: "people-outline", addLabel: "Add Contractor" },
];

export const MAINTENANCE_CATEGORIES = [
  "HVAC",
  "Plumbing",
  "Roof",
  "Exterior",
  "Electrical",
  "Appliances",
  "Foundation",
  "Landscaping",
  "General",
];

export const REPAIR_CATEGORIES = [
  "HVAC",
  "Plumbing",
  "Roof",
  "Electrical",
  "Appliances",
  "Flooring",
  "Painting",
  "Landscaping",
  "Other",
];

export const TRADES = [
  "HVAC",
  "Plumbing",
  "Electrical",
  "Roofing",
  "Painting",
  "Flooring",
  "General Contractor",
  "Appliances",
  "Landscaping",
  "Cleaning",
];

export const PAINT_FINISHES = ["Flat", "Eggshell", "Satin", "Semi-gloss", "Gloss", "High-gloss"];

export const PHOTO_CATEGORIES = [
  "Exterior",
  "Interior",
  "Roof",
  "HVAC",
  "Plumbing",
  "Kitchen",
  "Bathroom",
  "Garage",
  "Yard",
  "Repair",
  "Before",
  "After",
  "Other",
];

export const DOC_CATEGORIES: { value: Document["category"]; label: string }[] = [
  { value: "warranty", label: "Warranty" },
  { value: "insurance", label: "Insurance" },
  { value: "inspection", label: "Inspection" },
  { value: "receipt", label: "Receipt" },
  { value: "permit", label: "Permit" },
  { value: "contract", label: "Contract" },
  { value: "manual", label: "Manual" },
  { value: "other", label: "Other" },
];

export function isPropertySection(value: string | undefined): value is PropertySection {
  if (!value || value === "appliances") return false;
  return PROPERTY_SECTIONS.some((s) => s.key === value);
}

export function resolvePropertySection(value: string | undefined): PropertySection {
  if (value === "appliances") return "maintenance";
  return isPropertySection(value) ? value : "overview";
}

export function resolveMaintenanceView(tab: string | undefined): MaintenanceView | undefined {
  if (tab === "tasks" || tab === "repairs" || tab === "appliances") return tab;
  if (tab === undefined) return undefined;
  return undefined;
}
