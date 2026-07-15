import type { Contractor } from "@/data/demoData";

type ContractorLike = Contractor | Record<string, unknown>;

export function logContractorCardTap(contractor: ContractorLike): void {
  const record = contractor as Record<string, unknown>;
  console.log("[ContractorCard] tapped", {
    id: record.id,
    name: record.name,
    trade: record.trade,
  });
}

export function contractorPhone(contractor: ContractorLike): string {
  return String((contractor as Record<string, unknown>).phone ?? "").trim();
}

export function contractorEmail(contractor: ContractorLike): string {
  return String((contractor as Record<string, unknown>).email ?? "").trim();
}
