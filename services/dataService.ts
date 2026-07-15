import * as propertyService from "@/services/propertyService";
import * as maintenanceService from "@/services/maintenanceService";
import * as applianceService from "@/services/applianceService";
import * as repairService from "@/services/repairService";
import * as vaultService from "@/services/vaultService";
import * as photoService from "@/services/photoService";
import * as scoreService from "@/services/scoreService";
import { requireAuthUserId } from "@/lib/authUser";

export async function loadAllUserData() {
  const userId = await requireAuthUserId();

  const [
    properties,
    maintenanceItems,
    repairs,
    appliances,
    documents,
    photos,
    contractors,
  ] = await Promise.all([
    propertyService.fetchProperties(),
    maintenanceService.fetchMaintenanceItems(userId),
    repairService.fetchRepairs(userId),
    applianceService.fetchAppliances(userId),
    vaultService.fetchAllVaultDocuments(userId),
    photoService.fetchPhotos(),
    vaultService.fetchContractors(userId),
  ]);

  const propertyIds = properties.map((p) => p.id);

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
