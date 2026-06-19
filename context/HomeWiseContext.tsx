import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Alert } from "react-native";
import { loadAllUserData } from "@/services/dataService";
import * as propertyService from "@/services/propertyService";
import * as maintenanceService from "@/services/maintenanceService";
import * as applianceService from "@/services/applianceService";
import * as repairService from "@/services/repairService";
import * as vaultService from "@/services/vaultService";
import * as scoreService from "@/services/scoreService";
import {
  uploadLocalFileIfNeeded,
  bucketForDocumentCategory,
  bucketForPropertyPhoto,
  bucketForRepairAsset,
} from "@/services/storageService";

export type {
  Property,
  MaintenanceItem,
  Repair,
  Appliance,
  Document,
  PaintColor,
  Contractor,
  PhotoItem,
} from "@/data/demoData";

import type {
  Property,
  MaintenanceItem,
  Repair,
  Appliance,
  Document,
  PaintColor,
  Contractor,
  PhotoItem,
} from "@/data/demoData";

type AppState = {
  properties: Property[];
  maintenanceItems: MaintenanceItem[];
  repairs: Repair[];
  appliances: Appliance[];
  documents: Document[];
  paintColors: PaintColor[];
  contractors: Contractor[];
  photos: PhotoItem[];
  selectedPropertyId: string;
};

export type PropertyScore = {
  overall: number;
  maintenance: number;
  appliances: number;
  repairs: number;
  warranty: number;
  inspections: number;
  label: "Excellent" | "Very Good" | "Good" | "Fair" | "Poor";
};

type AppContextValue = AppState & {
  isLoading: boolean;
  loadError: string | null;
  refreshData: () => Promise<void>;
  selectedProperty: Property | undefined;
  selectProperty: (id: string) => void;
  addProperty: (p: Omit<Property, "id" | "isSelected">) => void;
  updateProperty: (id: string, p: Partial<Property>) => void;
  deleteProperty: (id: string) => void;
  addMaintenanceItem: (item: Omit<MaintenanceItem, "id">) => void;
  updateMaintenanceItem: (id: string, item: Partial<MaintenanceItem>) => void;
  deleteMaintenanceItem: (id: string) => void;
  completeMaintenanceItem: (id: string) => void;
  addRepair: (r: Omit<Repair, "id">) => void;
  updateRepair: (id: string, r: Partial<Repair>) => void;
  deleteRepair: (id: string) => void;
  addAppliance: (a: Omit<Appliance, "id">) => void;
  updateAppliance: (id: string, a: Partial<Appliance>) => void;
  deleteAppliance: (id: string) => void;
  addDocument: (d: Omit<Document, "id">) => void;
  updateDocument: (id: string, d: Partial<Document>) => void;
  deleteDocument: (id: string) => void;
  addPaintColor: (p: Omit<PaintColor, "id">) => void;
  deletePaintColor: (id: string) => void;
  addContractor: (c: Omit<Contractor, "id">) => void;
  updateContractor: (id: string, c: Partial<Contractor>) => void;
  deleteContractor: (id: string) => void;
  addPhoto: (p: Omit<PhotoItem, "id">) => void;
  deletePhoto: (id: string) => void;
  getPropertyScore: (propertyId: string) => PropertyScore;
  resetDemoData: () => void;
};

const EMPTY_STATE: AppState = {
  properties: [],
  maintenanceItems: [],
  repairs: [],
  appliances: [],
  documents: [],
  paintColors: [],
  contractors: [],
  photos: [],
  selectedPropertyId: "",
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function scoreLabel(n: number): PropertyScore["label"] {
  if (n >= 90) return "Excellent";
  if (n >= 80) return "Very Good";
  if (n >= 70) return "Good";
  if (n >= 55) return "Fair";
  return "Poor";
}

function computeScore(
  propertyId: string,
  state: AppState
): PropertyScore {
  const maintenance = state.maintenanceItems.filter((m) => m.propertyId === propertyId);
  const appliances = state.appliances.filter((a) => a.propertyId === propertyId);
  const repairs = state.repairs.filter((r) => r.propertyId === propertyId);
  const docs = state.documents.filter((d) => d.propertyId === propertyId);

  const overdue = maintenance.filter((m) => m.status === "Overdue").length;
  const dueSoon = maintenance.filter((m) => m.status === "Due Soon").length;
  const maintScore = Math.max(40, 100 - overdue * 12 - dueSoon * 5);

  const condMap = { Excellent: 100, Good: 85, Fair: 70, Poor: 45, "Replace Soon": 30 };
  const appScore =
    appliances.length === 0
      ? 80
      : Math.round(
          appliances.reduce((acc, a) => acc + (condMap[a.condition] ?? 70), 0) / appliances.length
        );

  const repScore = Math.min(100, 70 + repairs.length * 5);
  const warranties = docs.filter((d) => d.category === "warranty");
  const warScore = Math.min(100, 65 + warranties.length * 10);
  const inspections = docs.filter((d) => d.category === "inspection");
  const inspScore = inspections.length > 0 ? 89 : 60;

  const overall = Math.round(
    maintScore * 0.3 + appScore * 0.25 + repScore * 0.2 + warScore * 0.15 + inspScore * 0.1
  );

  return {
    overall,
    maintenance: maintScore,
    appliances: appScore,
    repairs: repScore,
    warranty: warScore,
    inspections: inspScore,
    label: scoreLabel(overall),
  };
}

export function HomeWiseProvider({ children, userId }: { children: ReactNode; userId?: string }) {
  const [state, setState] = useState<AppState>(EMPTY_STATE);
  const [scoreMap, setScoreMap] = useState<Record<string, PropertyScore>>({});
  const [isLoading, setIsLoading] = useState(!!userId);
  const [loadError, setLoadError] = useState<string | null>(null);

  const persistScore = useCallback(
    async (propertyId: string, score: PropertyScore) => {
      if (!userId) return;
      try {
        await scoreService.upsertPropertyScore(userId, propertyId, score);
        setScoreMap((m) => ({ ...m, [propertyId]: score }));
      } catch {
        // score persistence is best-effort
      }
    },
    [userId]
  );

  const refreshData = useCallback(async () => {
    if (!userId) {
      setState(EMPTY_STATE);
      setScoreMap({});
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const data = await loadAllUserData(userId);
      setState({
        properties: data.properties,
        maintenanceItems: data.maintenanceItems,
        repairs: data.repairs,
        appliances: data.appliances,
        documents: data.documents,
        photos: data.photos,
        contractors: data.contractors,
        paintColors: data.paintColors,
        selectedPropertyId: data.selectedPropertyId,
      });
      setScoreMap(data.scoreMap);

      for (const prop of data.properties) {
        if (!data.scoreMap[prop.id]) {
          const score = computeScore(prop.id, {
            ...EMPTY_STATE,
            maintenanceItems: data.maintenanceItems,
            repairs: data.repairs,
            appliances: data.appliances,
            documents: data.documents,
          });
          setScoreMap((m) => ({ ...m, [prop.id]: score }));
          void persistScore(prop.id, score);
        }
      }
    } catch (e: any) {
      setLoadError(e.message ?? "Failed to load home data");
    } finally {
      setIsLoading(false);
    }
  }, [userId, persistScore]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const syncError = useCallback((action: string, err: unknown) => {
    const msg = err instanceof Error ? err.message : "Unknown error";
    Alert.alert(`${action} Failed`, msg);
  }, []);

  const value = useMemo<AppContextValue>(() => {
    const prop = state.properties.find((p) => p.id === state.selectedPropertyId);

    function getPropertyScore(propertyId: string): PropertyScore {
      if (scoreMap[propertyId]) return scoreMap[propertyId];
      const score = computeScore(propertyId, state);
      if (userId) persistScore(propertyId, score);
      return score;
    }

    function bumpScore(propertyId: string) {
      setState((s) => {
        const score = computeScore(propertyId, s);
        if (userId) persistScore(propertyId, score);
        setScoreMap((m) => ({ ...m, [propertyId]: score }));
        return s;
      });
    }

    return {
      ...state,
      isLoading,
      loadError,
      refreshData,
      selectedProperty: prop,

      selectProperty: (id) => {
        setState((s) => ({
          ...s,
          selectedPropertyId: id,
          properties: s.properties.map((p) => ({ ...p, isSelected: p.id === id })),
        }));
        if (userId) propertyService.setSelectedProperty(userId, id).catch(() => {});
      },

      addProperty: (p) => {
        const newProp: Property = { ...p, id: uuid(), isSelected: state.properties.length === 0 };
        setState((s) => ({
          ...s,
          properties: [...s.properties, newProp],
          selectedPropertyId: s.properties.length === 0 ? newProp.id : s.selectedPropertyId,
        }));
        if (userId) {
          propertyService.createProperty(userId, newProp).then((created) => {
            setState((s) => ({
              ...s,
              properties: s.properties.map((pr) => (pr.id === newProp.id ? created : pr)),
              selectedPropertyId: s.selectedPropertyId === newProp.id ? created.id : s.selectedPropertyId,
            }));
            const score = computeScore(created.id, { ...state, properties: [...state.properties, created] });
            persistScore(created.id, score);
          }).catch((e) => syncError("Add property", e));
        }
      },

      updateProperty: (id, p) => {
        setState((s) => ({
          ...s,
          properties: s.properties.map((pr) => (pr.id === id ? { ...pr, ...p } : pr)),
        }));
        if (userId) propertyService.updateProperty(userId, id, p).catch((e) => syncError("Update property", e));
      },

      deleteProperty: (id) => {
        setState((s) => {
          const remaining = s.properties.filter((pr) => pr.id !== id);
          return {
            ...s,
            properties: remaining,
            selectedPropertyId: s.selectedPropertyId === id ? (remaining[0]?.id ?? "") : s.selectedPropertyId,
          };
        });
        if (userId) propertyService.deleteProperty(userId, id).catch((e) => syncError("Delete property", e));
      },

      addMaintenanceItem: (item) => {
        const newItem = { ...item, id: uuid() };
        setState((s) => ({ ...s, maintenanceItems: [newItem, ...s.maintenanceItems] }));
        bumpScore(item.propertyId);
        if (userId) {
          maintenanceService.createMaintenanceItem(userId, newItem).then((created) => {
            setState((s) => ({
              ...s,
              maintenanceItems: s.maintenanceItems.map((m) => (m.id === newItem.id ? created : m)),
            }));
          }).catch((e) => syncError("Add maintenance", e));
        }
      },

      updateMaintenanceItem: (id, item) => {
        setState((s) => {
          const updated = s.maintenanceItems.map((m) => (m.id === id ? { ...m, ...item } : m));
          const pid = updated.find((m) => m.id === id)?.propertyId;
          if (pid) bumpScore(pid);
          return { ...s, maintenanceItems: updated };
        });
        if (userId) maintenanceService.updateMaintenanceItem(userId, id, item).catch((e) => syncError("Update maintenance", e));
      },

      deleteMaintenanceItem: (id) => {
        const pid = state.maintenanceItems.find((m) => m.id === id)?.propertyId;
        setState((s) => ({ ...s, maintenanceItems: s.maintenanceItems.filter((m) => m.id !== id) }));
        if (pid) bumpScore(pid);
        if (userId) maintenanceService.deleteMaintenanceItem(userId, id).catch((e) => syncError("Delete maintenance", e));
      },

      completeMaintenanceItem: (id) => {
        const item = state.maintenanceItems.find((m) => m.id === id);
        const lastCompleted = new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" });
        const nextDue =
          item?.recurring && item.intervalDays
            ? new Date(Date.now() + item.intervalDays * 86400000).toLocaleDateString("en-US", {
                month: "short",
                year: "numeric",
              })
            : item?.nextDue ?? "TBD";
        const updates = {
          status: (item?.recurring ? "Upcoming" : "Completed") as const,
          lastCompleted,
          nextDue,
        };
        setState((s) => ({
          ...s,
          maintenanceItems: s.maintenanceItems.map((m) => (m.id === id ? { ...m, ...updates } : m)),
        }));
        const pid = state.maintenanceItems.find((m) => m.id === id)?.propertyId;
        if (pid) bumpScore(pid);
        if (userId) maintenanceService.updateMaintenanceItem(userId, id, updates).catch((e) => syncError("Complete maintenance", e));
      },

      addRepair: (r) => {
        const newItem = { ...r, id: uuid() };
        setState((s) => ({ ...s, repairs: [newItem, ...s.repairs] }));
        bumpScore(r.propertyId);
        if (userId) {
          (async () => {
            try {
              let item = newItem;
              if (r.receiptUri) {
                const url = await uploadLocalFileIfNeeded(
                  userId,
                  bucketForRepairAsset("receipt"),
                  r.receiptUri
                );
                if (url) item = { ...item, receiptUri: url };
              }
              if (r.photoUris?.length) {
                const uploaded = await Promise.all(
                  r.photoUris.map((uri) =>
                    uploadLocalFileIfNeeded(userId, bucketForRepairAsset("photo"), uri)
                  )
                );
                item = {
                  ...item,
                  photoUris: uploaded.filter((u): u is string => Boolean(u)),
                };
              }
              const created = await repairService.createRepair(userId, item);
              setState((s) => ({
                ...s,
                repairs: s.repairs.map((rp) => (rp.id === newItem.id ? created : rp)),
              }));
            } catch (e) {
              syncError("Add repair", e);
            }
          })();
        }
      },

      updateRepair: (id, r) => {
        setState((s) => ({
          ...s,
          repairs: s.repairs.map((rp) => (rp.id === id ? { ...rp, ...r } : rp)),
        }));
        const pid = state.repairs.find((rp) => rp.id === id)?.propertyId;
        if (pid) bumpScore(pid);
        if (userId) repairService.updateRepair(userId, id, r).catch((e) => syncError("Update repair", e));
      },

      deleteRepair: (id) => {
        const pid = state.repairs.find((r) => r.id === id)?.propertyId;
        setState((s) => ({ ...s, repairs: s.repairs.filter((r) => r.id !== id) }));
        if (pid) bumpScore(pid);
        if (userId) repairService.deleteRepair(userId, id).catch((e) => syncError("Delete repair", e));
      },

      addAppliance: (a) => {
        const newItem = { ...a, id: uuid() };
        setState((s) => ({ ...s, appliances: [newItem, ...s.appliances] }));
        bumpScore(a.propertyId);
        if (userId) {
          applianceService.createAppliance(userId, newItem).then((created) => {
            setState((s) => ({
              ...s,
              appliances: s.appliances.map((ap) => (ap.id === newItem.id ? created : ap)),
            }));
          }).catch((e) => syncError("Add appliance", e));
        }
      },

      updateAppliance: (id, a) => {
        setState((s) => ({
          ...s,
          appliances: s.appliances.map((ap) => (ap.id === id ? { ...ap, ...a } : ap)),
        }));
        const pid = state.appliances.find((ap) => ap.id === id)?.propertyId;
        if (pid) bumpScore(pid);
        if (userId) applianceService.updateAppliance(userId, id, a).catch((e) => syncError("Update appliance", e));
      },

      deleteAppliance: (id) => {
        const pid = state.appliances.find((a) => a.id === id)?.propertyId;
        setState((s) => ({ ...s, appliances: s.appliances.filter((a) => a.id !== id) }));
        if (pid) bumpScore(pid);
        if (userId) applianceService.deleteAppliance(userId, id).catch((e) => syncError("Delete appliance", e));
      },

      addDocument: (d) => {
        const newDoc = { ...d, id: uuid() };
        setState((s) => ({ ...s, documents: [newDoc, ...s.documents] }));
        bumpScore(d.propertyId);
        if (userId) {
          (async () => {
            try {
              let doc = newDoc;
              if (d.fileUri) {
                const bucket = bucketForDocumentCategory(d.category);
                const url = await uploadLocalFileIfNeeded(userId, bucket, d.fileUri);
                if (url) doc = { ...doc, fileUri: url };
              }
              const created = await vaultService.createVaultDocument(userId, doc);
              setState((s) => ({
                ...s,
                documents: s.documents.map((docItem) => (docItem.id === newDoc.id ? created : docItem)),
              }));
            } catch (e) {
              syncError("Add document", e);
            }
          })();
        }
      },

      updateDocument: (id, d) => {
        setState((s) => ({
          ...s,
          documents: s.documents.map((doc) => (doc.id === id ? { ...doc, ...d } : doc)),
        }));
        if (userId) {
          const doc = state.documents.find((docItem) => docItem.id === id);
          if (doc) {
            vaultService.updateVaultDocument(userId, { ...doc, ...d }).catch((e) => syncError("Update document", e));
          }
        }
      },

      deleteDocument: (id) => {
        const doc = state.documents.find((d) => d.id === id);
        const pid = doc?.propertyId;
        setState((s) => ({ ...s, documents: s.documents.filter((d) => d.id !== id) }));
        if (pid) bumpScore(pid);
        if (userId && doc) vaultService.deleteVaultDocument(userId, doc).catch((e) => syncError("Delete document", e));
      },

      addPaintColor: (p) => {
        const newItem = { ...p, id: uuid() };
        setState((s) => ({ ...s, paintColors: [newItem, ...s.paintColors] }));
        if (userId) {
          vaultService.createPaintColor(userId, newItem as unknown as Record<string, unknown>).catch((e) => syncError("Add paint", e));
        }
      },

      deletePaintColor: (id) => {
        setState((s) => ({ ...s, paintColors: s.paintColors.filter((p) => p.id !== id) }));
        if (userId) vaultService.deletePaintColor(userId, id).catch((e) => syncError("Delete paint", e));
      },

      addContractor: (c) => {
        const newItem = { ...c, id: uuid() };
        setState((s) => ({ ...s, contractors: [newItem, ...s.contractors] }));
        if (userId) {
          vaultService.createContractor(userId, newItem as unknown as Record<string, unknown>).catch((e) => syncError("Add contractor", e));
        }
      },

      updateContractor: (id, c) => {
        setState((s) => ({
          ...s,
          contractors: s.contractors.map((ct) => (ct.id === id ? { ...ct, ...c } : ct)),
        }));
        if (userId) vaultService.updateContractor(userId, id, c as Record<string, unknown>).catch((e) => syncError("Update contractor", e));
      },

      deleteContractor: (id) => {
        setState((s) => ({ ...s, contractors: s.contractors.filter((c) => c.id !== id) }));
        if (userId) vaultService.deleteContractor(userId, id).catch((e) => syncError("Delete contractor", e));
      },

      addPhoto: (p) => {
        const newItem = { ...p, id: uuid() };
        setState((s) => ({ ...s, photos: [newItem, ...s.photos] }));
        if (userId) {
          (async () => {
            try {
              let photo = newItem;
              if (p.uri) {
                const url = await uploadLocalFileIfNeeded(
                  userId,
                  bucketForPropertyPhoto(),
                  p.uri
                );
                if (url) photo = { ...photo, uri: url };
              }
              const created = await vaultService.createPhoto(userId, photo);
              setState((s) => ({
                ...s,
                photos: s.photos.map((ph) => (ph.id === newItem.id ? created : ph)),
              }));
            } catch (e) {
              syncError("Add photo", e);
            }
          })();
        }
      },

      deletePhoto: (id) => {
        setState((s) => ({ ...s, photos: s.photos.filter((p) => p.id !== id) }));
        if (userId) vaultService.deletePhoto(userId, id).catch((e) => syncError("Delete photo", e));
      },

      getPropertyScore,

      resetDemoData: () => {
        Alert.alert(
          "Reset Data",
          "This reloads your data from Supabase. Local demo reset is disabled when using cloud sync.",
          [{ text: "OK" }]
        );
        refreshData();
      },
    };
  }, [state, userId, isLoading, loadError, refreshData, scoreMap, persistScore, syncError]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useHomeWise() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useHomeWise must be inside HomeWiseProvider");
  return ctx;
}
