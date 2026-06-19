import * as propertyService from "@/services/propertyService";
import * as maintenanceService from "@/services/maintenanceService";
import * as applianceService from "@/services/applianceService";
import * as repairService from "@/services/repairService";
import * as vaultService from "@/services/vaultService";
import * as scoreService from "@/services/scoreService";

export async function loadAllUserData(userId: string) {
  const [
    properties,
    maintenanceItems,
    repairs,
    appliances,
    documents,
    photos,
    contractors,
  ] = await Promise.all([
    propertyService.fetchProperties(userId),
    maintenanceService.fetchMaintenanceItems(userId),
    repairService.fetchRepairs(userId),
    applianceService.fetchAppliances(userId),
    vaultService.fetchAllVaultDocuments(userId),
    vaultService.fetchPhotos(userId),
    vaultService.fetchContractors(userId),
  ]);

  const propertyIds = properties.map((p) => p.id);

  // Optional data — missing tables/columns must not block core screens.
  const [scoreMap, paintColors] = await Promise.all([
    scoreService.fetchPropertyScores(userId, propertyIds),
    vaultService.fetchPaintColors(userId),
  ]);

  const selected = properties.find((p) => p.isSelected)?.id ?? properties[0]?.id ?? "";

  return {
    properties,
    maintenanceItems,
    repairs,
    appliances,
    documents,
    photos,
    contractors,
    paintColors,
    selectedPropertyId: selected,
    scoreMap,
  };
}

export { propertyService, maintenanceService, applianceService, repairService, vaultService, scoreService };
