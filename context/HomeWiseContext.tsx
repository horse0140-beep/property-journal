import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { requireAuthUserId } from "@/lib/authUser";
import { Alert } from "react-native";
import { showRealSaveError } from "@/lib/realSaveError";
import { friendlyMessage, logTechnicalError } from "@/lib/userErrors";
import { loadAllUserData } from "@/services/dataService";
import * as propertyService from "@/services/propertyService";
import * as maintenanceService from "@/services/maintenanceService";
import * as applianceService from "@/services/applianceService";
import * as repairService from "@/services/repairService";
import * as vaultService from "@/services/vaultService";
import * as photoService from "@/services/photoService";
import * as scoreService from "@/services/scoreService";
import {
  uploadLocalFile,
  uploadLocalFileIfNeeded,
  bucketForDocumentCategory,
  bucketForRepairAsset,
  deleteFromStorage,
  deleteStorageObject,
  isRemoteUri,
  verifyStorageBucketExists,
} from "@/services/storageService";
import { deleteRepairPhotoObject } from "@/lib/repairPhotos";
import { getPhotoBucket, photoKindFromCategory } from "@/services/storageBuckets";
import {
  isoDateFromTimestamp,
  todayIsoDate,
} from "@/lib/dateForDatabase";
import { assertOnlineForWrite } from "@/lib/connectivity";
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

function statusFromNextDue(nextDue: string): MaintenanceItem["status"] {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(nextDue ?? "").trim());
  if (!m) return "Upcoming";
  const days =
    (new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() - Date.now()) / 86400000;
  if (days < 0) return "Overdue";
  if (days <= 30) return "Due Soon";
  return "Upcoming";
}

export type {
  Property,
  MaintenanceItem,
  Repair,
  Appliance,
  Document,
  PaintColor,
  Contractor,
  PhotoItem,
};

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
  addProperty: (p: Omit<Property, "id" | "isSelected">) => Promise<Property>;
  updateProperty: (id: string, p: Partial<Property>) => Promise<Property | null | undefined>;
  deleteProperty: (id: string) => Promise<void>;
  addMaintenanceItem: (item: Omit<MaintenanceItem, "id">) => Promise<MaintenanceItem>;
  updateMaintenanceItem: (id: string, item: Partial<MaintenanceItem>) => Promise<void>;
  deleteMaintenanceItem: (id: string) => void;
  completeMaintenanceItem: (id: string) => Promise<MaintenanceItem | null>;
  addRepair: (r: Omit<Repair, "id">) => Promise<Repair>;
  updateRepair: (id: string, r: Partial<Repair>) => Promise<void>;
  deleteRepair: (id: string) => void;
  addAppliance: (a: Omit<Appliance, "id">) => Promise<Appliance>;
  updateAppliance: (id: string, a: Partial<Appliance>) => Promise<void>;
  deleteAppliance: (id: string) => void;
  addDocument: (d: Omit<Document, "id">) => Promise<Document>;
  updateDocument: (id: string, d: Partial<Document>) => Promise<void>;
  deleteDocument: (id: string) => void;
  addPaintColor: (p: Omit<PaintColor, "id">) => Promise<PaintColor>;
  deletePaintColor: (id: string) => void;
  addContractor: (c: Omit<Contractor, "id">) => Promise<Contractor>;
  updateContractor: (id: string, c: Partial<Contractor>) => Promise<void>;
  deleteContractor: (id: string) => void;
  addPhoto: (p: Omit<PhotoItem, "id"> & { photoType?: string }) => Promise<PhotoItem>;
  updatePhoto: (id: string, updates: { caption?: string; category?: string }) => Promise<void>;
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

export function HomeWiseProvider({
  children,
  isSignedIn,
}: {
  children: ReactNode;
  isSignedIn: boolean;
}) {
  const [state, setState] = useState<AppState>(EMPTY_STATE);
  const [scoreMap, setScoreMap] = useState<Record<string, PropertyScore>>({});
  const [isLoading, setIsLoading] = useState(isSignedIn);
  const [loadError, setLoadError] = useState<string | null>(null);
  const renderedScoresRef = useRef<Record<string, PropertyScore>>({});
  const isSignedInRef = useRef(isSignedIn);
  isSignedInRef.current = isSignedIn;
  const stateRef = useRef(state);
  stateRef.current = state;
  const completingMaintenanceRef = useRef(false);
  // Only the first load (or post-sign-out load) shows the full-screen spinner;
  // background refreshes after saves must not blank every mounted tab.
  const hasLoadedOnceRef = useRef(false);

  // Score recomputation requests, flushed in an effect after the data commit
  // so computeScore always sees fresh state (setState updaters stay pure).
  const [pendingScoreBumps, setPendingScoreBumps] = useState<string[]>([]);

  const persistScore = useCallback(
    async (propertyId: string, score: PropertyScore) => {
      if (!isSignedIn) return;
      try {
        const userId = await requireAuthUserId();
        await scoreService.upsertPropertyScore(userId, propertyId, score);
        setScoreMap((m) => ({ ...m, [propertyId]: score }));
      } catch {
        // score persistence is best-effort
      }
    },
    [isSignedIn]
  );

  const refreshData = useCallback(async () => {
    if (!isSignedInRef.current) {
      setState(EMPTY_STATE);
      setScoreMap({});
      renderedScoresRef.current = {};
      hasLoadedOnceRef.current = false;
      setIsLoading(false);
      return;
    }

    if (!hasLoadedOnceRef.current) setIsLoading(true);
    setLoadError(null);

    try {
      const data = await loadAllUserData();
      if (!isSignedInRef.current) return;

      setState((prev) => {
        const selectedId =
          prev.selectedPropertyId && data.properties.some((p) => p.id === prev.selectedPropertyId)
            ? prev.selectedPropertyId
            : data.selectedPropertyId;

        return {
          properties: data.properties.map((p) => ({
            ...p,
            isSelected: p.id === selectedId,
          })),
          maintenanceItems: data.maintenanceItems,
          repairs: data.repairs,
          appliances: data.appliances,
          documents: data.documents,
          photos: data.photos,
          contractors: data.contractors,
          paintColors: data.paintColors,
          selectedPropertyId: selectedId,
        };
      });
      setScoreMap(data.scoreMap);
      hasLoadedOnceRef.current = true;

      for (const prop of data.properties) {
        if (!isSignedInRef.current) return;
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
    } catch (e: unknown) {
      logTechnicalError("loadAllUserData", e);
      setLoadError(friendlyMessage("generic"));
    } finally {
      setIsLoading(false);
    }
  }, [isSignedIn, persistScore]);

  const selectProperty = useCallback(
    (id: string) => {
      if (!id) return;

      let didChange = false;
      setState((s) => {
        if (s.selectedPropertyId === id) return s;

        didChange = true;
        return {
          ...s,
          selectedPropertyId: id,
          properties: s.properties.map((p) => {
            const isSelected = p.id === id;
            return p.isSelected === isSelected ? p : { ...p, isSelected };
          }),
        };
      });

      if (didChange && isSignedIn) {
        propertyService.setSelectedProperty(id).catch(() => {});
      }
    },
    [isSignedIn]
  );

  useEffect(() => {
    if (!isSignedIn) {
      setState(EMPTY_STATE);
      setScoreMap({});
      renderedScoresRef.current = {};
      hasLoadedOnceRef.current = false;
      setIsLoading(false);
      setLoadError(null);
      return;
    }
    void refreshData();
    // Only react to auth transitions — not refreshData identity changes while signed in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  // Flush queued score bumps after the triggering data mutation has committed.
  useEffect(() => {
    if (pendingScoreBumps.length === 0) return;
    const unique = [...new Set(pendingScoreBumps)];
    setPendingScoreBumps([]);
    for (const propertyId of unique) {
      const score = computeScore(propertyId, state);
      setScoreMap((m) => ({ ...m, [propertyId]: score }));
      if (isSignedIn) void persistScore(propertyId, score);
    }
    // state is intentionally read at flush time, not tracked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingScoreBumps]);

  const syncError = useCallback((action: string, err: unknown) => {
    showRealSaveError("HomeWiseContext", action, err);
  }, []);

  const value = useMemo<AppContextValue>(() => {
    const prop = state.properties.find((p) => p.id === state.selectedPropertyId);

    function getPropertyScore(propertyId: string): PropertyScore {
      if (scoreMap[propertyId]) return scoreMap[propertyId];
      if (renderedScoresRef.current[propertyId]) return renderedScoresRef.current[propertyId];
      const score = computeScore(propertyId, state);
      renderedScoresRef.current[propertyId] = score;
      return score;
    }

    function bumpScore(propertyId: string) {
      setPendingScoreBumps((prev) => [...prev, propertyId]);
    }

    return {
      ...state,
      isLoading,
      loadError,
      refreshData,
      selectedProperty: prop,
      selectProperty,

      addProperty: async (p) => {
        const newProp: Property = { ...p, id: uuid(), isSelected: state.properties.length === 0 };
        const priorSelectedId = state.selectedPropertyId;

        setState((s) => ({
          ...s,
          properties: [...s.properties, newProp],
          selectedPropertyId: s.properties.length === 0 ? newProp.id : s.selectedPropertyId,
        }));

        if (!isSignedIn) return newProp;
        await assertOnlineForWrite();

        try {
          const created = await propertyService.createProperty(newProp);
          setState((s) => ({
            ...s,
            properties: s.properties.map((pr) => (pr.id === newProp.id ? created : pr)),
            selectedPropertyId: s.selectedPropertyId === newProp.id ? created.id : s.selectedPropertyId,
          }));
          if (created.isSelected) {
            void propertyService.setSelectedProperty(created.id);
          }
          const score = computeScore(created.id, state);
          void persistScore(created.id, score);
          return created;
        } catch (e) {
          // Surgical rollback — remove only this property so concurrent
          // optimistic saves are never clobbered.
          setState((s) => ({
            ...s,
            properties: s.properties.filter((pr) => pr.id !== newProp.id),
            selectedPropertyId:
              s.selectedPropertyId === newProp.id ? priorSelectedId : s.selectedPropertyId,
          }));
          throw e;
        }
      },

      updateProperty: async (id, p) => {
        const previous = state.properties.find((pr) => pr.id === id);
        if (!isSignedIn) return previous ?? null;
        await assertOnlineForWrite();

        try {
          const saved = await propertyService.updateProperty(id, p);
          if (saved) {
            setState((s) => ({
              ...s,
              properties: s.properties.map((pr) => (pr.id === id ? saved : pr)),
            }));
          }
          return saved;
        } catch (e) {
          if (previous) {
            setState((s) => ({
              ...s,
              properties: s.properties.map((pr) => (pr.id === id ? previous : pr)),
            }));
          }
          throw e;
        }
      },

      deleteProperty: async (id) => {
        // Server-first: only update local state after Supabase confirms the
        // delete, so a failed delete can never silently "reappear" on refresh.
        if (isSignedIn) {
          await assertOnlineForWrite();
          await propertyService.deletePropertyDeep(id);
        }
        setState((s) => {
          const remaining = s.properties.filter((pr) => pr.id !== id);
          return {
            ...s,
            properties: remaining,
            maintenanceItems: s.maintenanceItems.filter((m) => m.propertyId !== id),
            repairs: s.repairs.filter((r) => r.propertyId !== id),
            appliances: s.appliances.filter((a) => a.propertyId !== id),
            documents: s.documents.filter((d) => d.propertyId !== id),
            paintColors: s.paintColors.filter((p) => p.propertyId !== id),
            photos: s.photos.filter((p) => p.propertyId !== id),
            contractors: s.contractors.map((c) =>
              c.propertyId === id ? { ...c, propertyId: undefined } : c
            ),
            selectedPropertyId:
              s.selectedPropertyId === id ? (remaining[0]?.id ?? "") : s.selectedPropertyId,
          };
        });
        setScoreMap((m) => {
          if (!(id in m)) return m;
          const next = { ...m };
          delete next[id];
          return next;
        });
      },

      addMaintenanceItem: async (item) => {
        const newItem = { ...item, id: uuid() };
        setState((s) => ({ ...s, maintenanceItems: [newItem, ...s.maintenanceItems] }));
        bumpScore(item.propertyId);
        if (!isSignedIn) return newItem;
        await assertOnlineForWrite();
        try {
          const userId = await requireAuthUserId();
          const created = await maintenanceService.createMaintenanceItem(userId, newItem);
          setState((s) => ({
            ...s,
            maintenanceItems: s.maintenanceItems.map((m) => (m.id === newItem.id ? created : m)),
          }));
          return created;
        } catch (e) {
          setState((s) => ({
            ...s,
            maintenanceItems: s.maintenanceItems.filter((m) => m.id !== newItem.id),
          }));
          throw e;
        }
      },

      updateMaintenanceItem: async (id, item) => {
        const previous = stateRef.current.maintenanceItems.find((m) => m.id === id);
        setState((s) => ({
          ...s,
          maintenanceItems: s.maintenanceItems.map((m) => (m.id === id ? { ...m, ...item } : m)),
        }));
        const pid = item.propertyId ?? previous?.propertyId;
        if (pid) bumpScore(pid);
        if (!isSignedIn) return;
        await assertOnlineForWrite();
        try {
          const userId = await requireAuthUserId();
          const saved = await maintenanceService.updateMaintenanceItem(userId, id, item);
          setState((s) => ({
            ...s,
            maintenanceItems: s.maintenanceItems.map((m) => (m.id === id ? saved : m)),
          }));
        } catch (e) {
          if (previous) {
            setState((s) => ({
              ...s,
              maintenanceItems: s.maintenanceItems.map((m) => (m.id === id ? previous : m)),
            }));
          }
          throw e;
        }
      },

      deleteMaintenanceItem: (id) => {
        const pid = state.maintenanceItems.find((m) => m.id === id)?.propertyId;
        setState((s) => ({ ...s, maintenanceItems: s.maintenanceItems.filter((m) => m.id !== id) }));
        if (pid) bumpScore(pid);
        if (isSignedIn) {
          void requireAuthUserId()
            .then((userId) => maintenanceService.deleteMaintenanceItem(userId, id))
            .catch((e) => syncError("Delete maintenance", e));
        }
      },

      completeMaintenanceItem: async (id) => {
        if (completingMaintenanceRef.current) {
          console.log("[MAINTENANCE COMPLETE] skipped double tap", { id });
          return null;
        }
        completingMaintenanceRef.current = true;

        const item = stateRef.current.maintenanceItems.find((m) => m.id === id);
        console.log("[MAINTENANCE COMPLETE START]", {
          id,
          title: item?.title,
          recurring: item?.recurring,
          intervalDays: item?.intervalDays,
          status: item?.status,
        });

        if (!item) {
          completingMaintenanceRef.current = false;
          console.log("[MAINTENANCE COMPLETE FAILED]", { id, reason: "not_found" });
          throw new Error("Maintenance task not found.");
        }

        const previous = { ...item };
        const lastCompleted = todayIsoDate();

        /**
         * Consistent completion behavior:
         * - Always set last_completed = today (ISO).
         * - Non-recurring → status "Completed"; next_due unchanged.
         * - Recurring → advance next_due by intervalDays from today, keep recurring=true,
         *   set status from the new next_due (Upcoming / Due Soon / Overdue) so the
         *   schedule continues instead of staying Completed forever.
         */
        let nextDue = item.nextDue ?? "";
        let status: MaintenanceItem["status"] = "Completed";

        if (item.recurring) {
          const interval = item.intervalDays && item.intervalDays > 0 ? item.intervalDays : 0;
          if (interval > 0) {
            nextDue = isoDateFromTimestamp(Date.now() + interval * 86400000);
          }
          status = statusFromNextDue(nextDue);
        }

        const updates: Partial<MaintenanceItem> = {
          lastCompleted,
          nextDue,
          status,
          recurring: item.recurring,
        };

        console.log("[MAINTENANCE COMPLETE PAYLOAD]", { id, ...updates });

        setState((s) => ({
          ...s,
          maintenanceItems: s.maintenanceItems.map((m) => (m.id === id ? { ...m, ...updates } : m)),
        }));
        if (item.propertyId) bumpScore(item.propertyId);

        try {
          if (!isSignedIn) {
            const local = { ...item, ...updates } as MaintenanceItem;
            console.log("[MAINTENANCE COMPLETE SUCCESS]", { mode: "local", item: local });
            return local;
          }

          await assertOnlineForWrite();
          const userId = await requireAuthUserId();
          const saved = await maintenanceService.updateMaintenanceItem(userId, id, updates);

          setState((s) => ({
            ...s,
            maintenanceItems: s.maintenanceItems.map((m) => (m.id === id ? saved : m)),
          }));

          console.log("[MAINTENANCE COMPLETE SUCCESS]", { id, saved });
          // Background refresh — do not block UI or close the detail modal.
          void refreshData().catch((e) => console.warn("[MAINTENANCE COMPLETE] refresh failed", e));
          return saved;
        } catch (e) {
          console.log("[MAINTENANCE COMPLETE FAILED]", {
            id,
            error: e instanceof Error ? e.message : String(e),
            code: e && typeof e === "object" && "code" in e ? (e as { code: unknown }).code : undefined,
          });
          setState((s) => ({
            ...s,
            maintenanceItems: s.maintenanceItems.map((m) => (m.id === id ? previous : m)),
          }));
          throw e;
        } finally {
          completingMaintenanceRef.current = false;
        }
      },

      addRepair: async (r) => {
        const newItem = { ...r, id: uuid() };
        setState((s) => ({ ...s, repairs: [newItem, ...s.repairs] }));
        bumpScore(r.propertyId);
        if (!isSignedIn) return newItem;
        await assertOnlineForWrite();
        try {
          const userId = await requireAuthUserId();
          let item = newItem;
          if (r.receiptUri) {
            const url = await uploadLocalFileIfNeeded(userId, bucketForRepairAsset("receipt"), r.receiptUri);
            if (url) item = { ...item, receiptUri: url };
          }
          if (r.photoUris?.length) {
            const repairBucket = getPhotoBucket("repair");
            console.log("[REPAIR PHOTO UPLOAD] start", {
              bucket: repairBucket,
              count: r.photoUris.length,
              localUris: r.photoUris,
            });
            const uploaded = await Promise.all(
              r.photoUris.map((uri) => uploadLocalFileIfNeeded(userId, repairBucket, uri))
            );
            const photoUris = uploaded.filter((u): u is string => Boolean(u));
            console.log("[REPAIR PHOTO UPLOAD] complete", { uploadedUrls: photoUris });
            if (photoUris.length !== r.photoUris.length) {
              throw new Error("One or more repair photos failed to upload. Please try again.");
            }
            item = { ...item, photoUris };
          }
          const created = await repairService.createRepair(userId, item);
          console.log("[REPAIR PHOTO DB ROW]", {
            repairId: created.id,
            photoUris: created.photoUris,
            receiptUri: created.receiptUri,
          });
          setState((s) => ({
            ...s,
            repairs: s.repairs.map((rp) => (rp.id === newItem.id ? created : rp)),
          }));
          return created;
        } catch (e) {
          setState((s) => ({ ...s, repairs: s.repairs.filter((rp) => rp.id !== newItem.id) }));
          throw e;
        }
      },

      updateRepair: async (id, r) => {
        const previous = state.repairs.find((rp) => rp.id === id);
        setState((s) => ({
          ...s,
          repairs: s.repairs.map((rp) => (rp.id === id ? { ...rp, ...r } : rp)),
        }));
        const pid = previous?.propertyId;
        if (pid) bumpScore(pid);
        if (!isSignedIn) return;
        await assertOnlineForWrite();
        try {
          const userId = await requireAuthUserId();
          await repairService.updateRepair(userId, id, r);
        } catch (e) {
          if (previous) {
            setState((s) => ({
              ...s,
              repairs: s.repairs.map((rp) => (rp.id === id ? previous : rp)),
            }));
          }
          throw e;
        }
      },

      deleteRepair: (id) => {
        const repair = state.repairs.find((r) => r.id === id);
        const pid = repair?.propertyId;
        setState((s) => ({ ...s, repairs: s.repairs.filter((r) => r.id !== id) }));
        if (pid) bumpScore(pid);
        if (isSignedIn) {
          void requireAuthUserId()
            .then(async (userId) => {
              await repairService.deleteRepair(userId, id);
              // Best-effort storage cleanup after the DB record is gone.
              for (const url of repair?.photoUris ?? []) {
                await deleteRepairPhotoObject(url);
              }
              if (repair?.receiptUri) {
                await deleteFromStorage(bucketForRepairAsset("receipt"), repair.receiptUri);
              }
            })
            .catch((e) => syncError("Delete repair", e));
        }
      },

      addAppliance: async (a) => {
        const displayName = (a.name ?? "").trim();
        if (!displayName) {
          throw new Error("Appliance name is required.");
        }
        const newItem = { ...a, id: uuid(), name: displayName };
        setState((s) => ({ ...s, appliances: [newItem, ...s.appliances] }));
        bumpScore(a.propertyId);
        if (!isSignedIn) return newItem;
        try {
          const userId = await requireAuthUserId();
          const created = await applianceService.createAppliance(userId, newItem);
          setState((s) => ({
            ...s,
            appliances: s.appliances.map((ap) => (ap.id === newItem.id ? created : ap)),
          }));
          return created;
        } catch (e) {
          setState((s) => ({
            ...s,
            appliances: s.appliances.filter((ap) => ap.id !== newItem.id),
          }));
          throw e;
        }
      },

      updateAppliance: async (id, a) => {
        const previous = state.appliances.find((ap) => ap.id === id);
        setState((s) => ({
          ...s,
          appliances: s.appliances.map((ap) => (ap.id === id ? { ...ap, ...a } : ap)),
        }));
        const pid = previous?.propertyId;
        if (pid) bumpScore(pid);
        if (!isSignedIn) return;
        try {
          const userId = await requireAuthUserId();
          await applianceService.updateAppliance(userId, id, a);
        } catch (e) {
          if (previous) {
            setState((s) => ({
              ...s,
              appliances: s.appliances.map((ap) => (ap.id === id ? previous : ap)),
            }));
          }
          throw e;
        }
      },

      deleteAppliance: (id) => {
        const pid = state.appliances.find((a) => a.id === id)?.propertyId;
        setState((s) => ({ ...s, appliances: s.appliances.filter((a) => a.id !== id) }));
        if (pid) bumpScore(pid);
        if (isSignedIn) {
          void requireAuthUserId()
            .then((userId) => applianceService.deleteAppliance(userId, id))
            .catch((e) => syncError("Delete appliance", e));
        }
      },

      addDocument: async (d) => {
        // STEP 1 — validate picker result / form input
        const title = (d.title ?? "").trim();
        const propertyId = (d.propertyId ?? "").trim();
        console.log("[DOCUMENT STEP 1] input", {
          title,
          propertyId,
          category: d.category,
          fileUri: d.fileUri,
          fileType: d.fileType,
          fileSize: d.fileSize,
        });
        if (!title) throw new Error("Document title is required.");
        if (!propertyId) throw new Error("Property is required.");
        if (!d.fileUri?.trim()) throw new Error("Please choose a file before saving.");

        const newDoc = { ...d, id: uuid(), title, propertyId };
        setState((s) => ({ ...s, documents: [newDoc, ...s.documents] }));
        bumpScore(propertyId);
        if (!isSignedIn) return newDoc;
        await assertOnlineForWrite();

        let uploadedBucket: ReturnType<typeof bucketForDocumentCategory> | null = null;
        let uploadedPath: string | null = null;

        try {
          const userId = await requireAuthUserId();
          let doc = newDoc;

          if (!isRemoteUri(d.fileUri)) {
            // STEP 2 — local URI
            console.log("[DOCUMENT STEP 2] local URI", d.fileUri);

            // STEP 3 — bucket selection
            const bucket = bucketForDocumentCategory(d.category);
            console.log("[DOCUMENT STEP 3] bucket", { category: d.category, bucket });

            // STEP 4 — bucket exists and is reachable for this user
            const bucketCheck = await verifyStorageBucketExists(bucket);
            console.log("[DOCUMENT STEP 4] bucket check", bucketCheck);
            if (!bucketCheck.ok) {
              throw new Error(
                `Storage bucket "${bucket}" is not reachable: ${bucketCheck.error ?? "unknown error"}`
              );
            }

            // STEP 5 — upload (never use raw title as object key — spaces / no extension break Android)
            const mimeHint =
              d.fileType === "pdf"
                ? "application/pdf"
                : d.fileType === "image"
                  ? "image/jpeg"
                  : undefined;
            const uploaded = await uploadLocalFile(
              userId,
              bucket,
              d.fileUri,
              title || undefined,
              undefined,
              mimeHint
            );
            console.log("[DOCUMENT STEP 5] upload response", uploaded.uploadResponse);

            // STEP 6 — storage path
            console.log("[DOCUMENT STEP 6] storage path", uploaded.path);
            uploadedBucket = uploaded.bucket;
            uploadedPath = uploaded.path;

            // STEP 7 — public/signed URL
            console.log("[DOCUMENT STEP 7] url", {
              urlMethod: uploaded.urlMethod,
              isPublic: uploaded.isPublic,
              url: uploaded.url,
            });
            if (!uploaded.url?.trim() || !isRemoteUri(uploaded.url)) {
              throw new Error("File upload did not return a usable URL. Please try again.");
            }
            doc = { ...doc, fileUri: uploaded.url };
          }

          // STEP 8 — DB insert payload (built in vaultService/documentToRow)
          console.log("[DOCUMENT STEP 8] inserting row", {
            id: doc.id,
            title: doc.title,
            category: doc.category,
            fileUri: doc.fileUri,
          });

          let created: Document;
          try {
            created = await vaultService.createVaultDocument(userId, doc);
          } catch (insertError) {
            // DB insert failed — remove the freshly uploaded storage object.
            if (uploadedBucket && uploadedPath) {
              console.warn("[DOCUMENT STEP 8] insert failed — rolling back storage object");
              await deleteStorageObject(uploadedBucket, uploadedPath);
            }
            throw insertError;
          }

          // STEP 9 — returned row
          console.log("[DOCUMENT STEP 9] returned row", {
            id: created.id,
            title: created.title,
            fileUri: created.fileUri,
          });

          // STEP 10 — verify the row references the uploaded file
          if (!created.fileUri?.trim() || !isRemoteUri(created.fileUri)) {
            console.warn("[DOCUMENT STEP 10] row has no valid file URL — rolling back row + storage");
            await vaultService
              .deleteVaultDocument(userId, created)
              .catch((e) => console.warn("[DOCUMENT STEP 10] row rollback failed:", e));
            if (uploadedBucket && uploadedPath) {
              await deleteStorageObject(uploadedBucket, uploadedPath);
            }
            throw new Error("Document row was saved without a file URL and has been rolled back.");
          }
          console.log("[DOCUMENT STEP 10] verified — updating app state");

          setState((s) => ({
            ...s,
            documents: s.documents.map((docItem) => (docItem.id === newDoc.id ? created : docItem)),
          }));
          return created;
        } catch (e) {
          setState((s) => ({
            ...s,
            documents: s.documents.filter((docItem) => docItem.id !== newDoc.id),
          }));
          throw e;
        }
      },

      updateDocument: async (id, d) => {
        const previous = state.documents.find((docItem) => docItem.id === id);
        setState((s) => ({
          ...s,
          documents: s.documents.map((doc) => (doc.id === id ? { ...doc, ...d } : doc)),
        }));
        if (!isSignedIn || !previous) return;
        try {
          const userId = await requireAuthUserId();
          await vaultService.updateVaultDocument(userId, { ...previous, ...d });
        } catch (e) {
          setState((s) => ({
            ...s,
            documents: s.documents.map((doc) => (doc.id === id ? previous : doc)),
          }));
          throw e;
        }
      },

      deleteDocument: (id) => {
        const doc = state.documents.find((d) => d.id === id);
        const pid = doc?.propertyId;
        setState((s) => ({ ...s, documents: s.documents.filter((d) => d.id !== id) }));
        if (pid) bumpScore(pid);
        if (isSignedIn && doc) {
          void requireAuthUserId()
            .then((userId) => vaultService.deleteVaultDocument(userId, doc))
            .catch((e) => syncError("Delete document", e));
        }
      },

      addPaintColor: async (p) => {
        const newItem = { ...p, id: uuid() };
        setState((s) => ({ ...s, paintColors: [newItem, ...s.paintColors] }));
        if (!isSignedIn) return newItem;
        try {
          const userId = await requireAuthUserId();
          const created = await vaultService.createPaintColor(userId, newItem);
          setState((s) => ({
            ...s,
            paintColors: s.paintColors.map((pc) => (pc.id === newItem.id ? created : pc)),
          }));
          return created;
        } catch (e) {
          setState((s) => ({
            ...s,
            paintColors: s.paintColors.filter((pc) => pc.id !== newItem.id),
          }));
          throw e;
        }
      },

      deletePaintColor: (id) => {
        setState((s) => ({ ...s, paintColors: s.paintColors.filter((p) => p.id !== id) }));
        if (isSignedIn) {
          void requireAuthUserId()
            .then((userId) => vaultService.deletePaintColor(userId, id))
            .catch((e) => syncError("Delete paint", e));
        }
      },

      addContractor: async (c) => {
        const newItem = { ...c, id: uuid() };
        setState((s) => ({ ...s, contractors: [newItem, ...s.contractors] }));
        if (!isSignedIn) return newItem;
        try {
          const userId = await requireAuthUserId();
          const created = await vaultService.createContractor(userId, newItem);
          setState((s) => ({
            ...s,
            contractors: s.contractors.map((ct) => (ct.id === newItem.id ? created : ct)),
          }));
          return created;
        } catch (e) {
          setState((s) => ({
            ...s,
            contractors: s.contractors.filter((ct) => ct.id !== newItem.id),
          }));
          throw e;
        }
      },

      updateContractor: async (id, c) => {
        const previous = state.contractors.find((ct) => ct.id === id);
        setState((s) => ({
          ...s,
          contractors: s.contractors.map((ct) => (ct.id === id ? { ...ct, ...c } : ct)),
        }));
        if (!isSignedIn) return;
        try {
          const userId = await requireAuthUserId();
          await vaultService.updateContractor(userId, id, c);
        } catch (e) {
          if (previous) {
            setState((s) => ({
              ...s,
              contractors: s.contractors.map((ct) => (ct.id === id ? previous : ct)),
            }));
          }
          throw e;
        }
      },

      deleteContractor: (id) => {
        setState((s) => ({ ...s, contractors: s.contractors.filter((c) => c.id !== id) }));
        if (isSignedIn) {
          void requireAuthUserId()
            .then((userId) => vaultService.deleteContractor(userId, id))
            .catch((e) => syncError("Delete contractor", e));
        }
      },

      addPhoto: async (p) => {
        const propertyId = (p.propertyId ?? "").trim();
        if (!propertyId) throw new Error("Property is required.");
        if (!p.uri?.trim()) throw new Error("Please choose a photo first.");

        const newItem = { ...p, id: uuid(), propertyId };
        if (!isSignedIn) {
          setState((s) => ({ ...s, photos: [newItem, ...s.photos] }));
          return newItem;
        }

        setState((s) => ({ ...s, photos: [newItem, ...s.photos] }));
        try {
          await assertOnlineForWrite();
          await photoService.savePhoto({
            id: newItem.id,
            propertyId: newItem.propertyId,
            uri: newItem.uri,
            caption: newItem.caption,
            date: newItem.date,
            category: newItem.category,
            photoType: p.photoType ?? photoKindFromCategory(p.category),
          });

          const refreshed = await photoService.fetchPhotos();
          setState((s) => ({ ...s, photos: refreshed }));

          const saved = refreshed.find((ph) => ph.id === newItem.id);
          if (!saved) {
            throw new Error("Photo saved but could not be loaded. Pull to refresh.");
          }
          return saved;
        } catch (e) {
          setState((s) => ({ ...s, photos: s.photos.filter((ph) => ph.id !== newItem.id) }));
          throw e;
        }
      },

      deletePhoto: (id) => {
        setState((s) => ({ ...s, photos: s.photos.filter((p) => p.id !== id) }));
        if (isSignedIn) {
          void photoService.deletePhoto(id).catch((e) => syncError("Delete photo", e));
        }
      },

      updatePhoto: async (id, updates) => {
        const previous = state.photos.find((p) => p.id === id);
        setState((s) => ({
          ...s,
          photos: s.photos.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        }));
        if (!isSignedIn) return;
        try {
          await photoService.updatePhoto(id, updates);
        } catch (e) {
          if (previous) {
            setState((s) => ({
              ...s,
              photos: s.photos.map((p) => (p.id === id ? previous : p)),
            }));
          }
          throw e;
        }
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
  }, [state, isSignedIn, isLoading, loadError, refreshData, scoreMap, persistScore, syncError, selectProperty]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useHomeWise() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useHomeWise must be inside HomeWiseProvider");
  return ctx;
}
