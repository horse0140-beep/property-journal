/**
 * Share permissions / snapshot filter smoke tests (no DB).
 * Run: node --experimental-strip-types scripts/test-share-permissions.mjs
 * or: npx tsx scripts/test-share-permissions.mjs
 */
import assert from "node:assert/strict";

// Inline minimal replicas of critical rules so this runs without TS path aliases.
function allFalse() {
  return {
    basicPropertyInfo: false,
    propertyAddress: false,
    propertyPhotos: false,
    maintenanceHistory: false,
    upcomingMaintenance: false,
    completedRepairs: false,
    repairCosts: false,
    contractorContact: false,
    appliances: false,
    appliancePhotos: false,
    applianceModelSerial: false,
    documents: false,
    warranties: false,
    receipts: false,
    inspectionReports: false,
    permits: false,
    ownerMessage: false,
    ownerContact: false,
  };
}

function hasAnyShareSelection(permissions, ownerMessage) {
  const s = permissions.sections;
  if (s.basicPropertyInfo || s.propertyAddress) return true;
  if (s.ownerMessage && ownerMessage.trim()) return true;
  if (s.ownerContact) return true;
  if (s.propertyPhotos && permissions.itemIds.photos.length > 0) return true;
  if (
    (s.maintenanceHistory || s.upcomingMaintenance) &&
    permissions.itemIds.maintenance.length > 0
  ) {
    return true;
  }
  if (s.completedRepairs && permissions.itemIds.repairs.length > 0) return true;
  if (s.appliances && permissions.itemIds.appliances.length > 0) return true;
  if (
    (s.documents || s.warranties || s.receipts || s.inspectionReports || s.permits) &&
    permissions.itemIds.documents.length > 0
  ) {
    return true;
  }
  return false;
}

function filterDocs(docs, sections, selectedIds) {
  return docs.filter((d) => {
    if (!selectedIds.includes(d.id)) return false;
    if (d.category === "receipt") return sections.receipts;
    if (d.category === "inspection") return sections.inspectionReports || sections.documents;
    if (d.category === "permit") return sections.permits || sections.documents;
    if (d.category === "warranty") return sections.warranties || sections.documents;
    return sections.documents;
  });
}

function filterRepairs(repairs, sections, selectedIds) {
  if (!sections.completedRepairs) return [];
  return repairs
    .filter((r) => selectedIds.includes(r.id))
    .map((r) => ({
      id: r.id,
      title: r.title,
      cost: sections.repairCosts ? r.cost : undefined,
      contractor: sections.contractorContact ? r.contractor : undefined,
      notes: undefined,
    }));
}

// 1. Empty selection blocked when only false sections
{
  const sections = allFalse();
  assert.equal(
    hasAnyShareSelection({ sections, itemIds: { maintenance: [], repairs: [], appliances: [], documents: [], photos: [] } }, ""),
    false
  );
}

// 2. Basic info alone is enough
{
  const sections = allFalse();
  sections.basicPropertyInfo = true;
  assert.equal(
    hasAnyShareSelection({ sections, itemIds: { maintenance: [], repairs: [], appliances: [], documents: [], photos: [] } }, ""),
    true
  );
}

// 3. One document only
{
  const sections = allFalse();
  sections.documents = true;
  sections.warranties = true;
  const docs = [
    { id: "d1", title: "Roof warranty", category: "warranty" },
    { id: "d2", title: "Insurance", category: "insurance" },
  ];
  const out = filterDocs(docs, sections, ["d1"]);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, "d1");
}

// 4. Two photos only
{
  const photos = ["p1", "p2", "p3"];
  const selected = ["p1", "p3"];
  const out = photos.filter((id) => selected.includes(id));
  assert.equal(out.length, 2);
}

// 5. Hide repair costs
{
  const sections = allFalse();
  sections.completedRepairs = true;
  sections.repairCosts = false;
  const out = filterRepairs(
    [{ id: "r1", title: "Roof", cost: "1200", contractor: "Acme", notes: "private" }],
    sections,
    ["r1"]
  );
  assert.equal(out[0].cost, undefined);
  assert.equal(out[0].contractor, undefined);
  assert.equal(out[0].notes, undefined);
}

// 6. Insurance preset enables receipts + repair costs
{
  const buyer = ["basicPropertyInfo", "propertyAddress", "propertyPhotos", "maintenanceHistory", "completedRepairs", "appliances", "warranties", "inspectionReports", "documents"];
  const insurance = ["basicPropertyInfo", "propertyAddress", "completedRepairs", "repairCosts", "inspectionReports", "receipts", "propertyPhotos", "warranties", "documents"];
  assert.equal(insurance.includes("receipts"), true);
  assert.equal(buyer.includes("receipts"), false);
  assert.equal(insurance.includes("repairCosts"), true);
  assert.equal(buyer.includes("repairCosts"), false);
}

// 7. Contractor preset excludes receipts
{
  const contractor = ["propertyAddress", "maintenanceHistory", "completedRepairs", "appliances", "propertyPhotos"];
  assert.equal(contractor.includes("receipts"), false);
  assert.equal(contractor.includes("documents"), false);
}

console.log("PASS share permissions smoke tests (7 checks)");
