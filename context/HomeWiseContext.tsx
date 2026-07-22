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
  verifyLocalFileExists,
} from "@/services/storageService";
import { deleteRepairPhotoObject } from "@/lib/repairPhotos";
import { getPhotoBucket, photoKindFromCategory } from "@/services/storageBuckets";
import {
  isoDateFromTimestamp,
  todayIsoDate,
} from "@/lib/dateForDatabase";
import { assertOnlineForWrite } from "@/lib/connectivity";
import type { CompleteMaintenanceOptions } from "@/lib/maintenanceComplete";
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
  completeMaintenanceItem: (
    id: string,
    options?: CompleteMaintenanceOptions
  ) => Promise<MaintenanceItem | null>;
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
  deletePhoto: (id: string) => Promise<void>;
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
        const uploadedPaths: { bucket: ReturnType<typeof getPhotoBucket>; path: string }[] = [];
        try {
          const userId = await requireAuthUserId();
          let payload = newItem;
          const localPhotos = (item.photoUris ?? []).filter((u) => u?.trim());
          if (localPhotos.length) {
            const bucket = getPhotoBucket("property");
            const uploaded: string[] = [];
            for (let i = 0; i < localPhotos.length; i++) {
              const uri = localPhotos[i];
              if (isRemoteUri(uri)) {
                uploaded.push(uri);
                continue;
              }
              const result = await uploadLocalFile(
                userId,
                bucket,
                uri,
                `maintenance_${newItem.id}_${i}.jpg`,
                undefined,
                "image/jpeg",
                [item.propertyId, newItem.id]
              );
              uploadedPaths.push({ bucket: result.bucket, path: result.path });
              if (!result.url?.trim() || !isRemoteUri(result.url)) {
                throw new Error("Maintenance photo upload did not return a usable URL.");
              }
              uploaded.push(result.url);
            }
            payload = { ...payload, photoUris: uploaded };
          }

          let created: MaintenanceItem;
          try {
            created = await maintenanceService.createMaintenanceItem(userId, payload);
          } catch (insertError) {
            for (const u of uploadedPaths) {
              await deleteStorageObject(u.bucket, u.path).catch(() => undefined);
            }
            throw insertError;
          }

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
        const uploadedPaths: { bucket: ReturnType<typeof getPhotoBucket>; path: string }[] = [];
        try {
          const userId = await requireAuthUserId();
          const updates: Partial<MaintenanceItem> = { ...item };
          if (item.photoUris !== undefined) {
            const bucket = getPhotoBucket("property");
            const uploaded: string[] = [];
            for (let i = 0; i < item.photoUris.length; i++) {
              const uri = item.photoUris[i];
              if (!uri?.trim()) continue;
              if (isRemoteUri(uri)) {
                uploaded.push(uri);
                continue;
              }
              const result = await uploadLocalFile(
                userId,
                bucket,
                uri,
                `maintenance_${id}_${i}_${Date.now()}.jpg`,
                undefined,
                "image/jpeg",
                [previous?.propertyId ?? "", id]
              );
              uploadedPaths.push({ bucket: result.bucket, path: result.path });
              if (!result.url?.trim() || !isRemoteUri(result.url)) {
                throw new Error("Maintenance photo upload did not return a usable URL.");
              }
              uploaded.push(result.url);
            }
            updates.photoUris = uploaded;
          }

          try {
            const saved = await maintenanceService.updateMaintenanceItem(userId, id, updates);
            setState((s) => ({
              ...s,
              maintenanceItems: s.maintenanceItems.map((m) => (m.id === id ? saved : m)),
            }));

            if (item.photoUris !== undefined && previous?.photoUris?.length) {
              const nextSet = new Set(updates.photoUris ?? []);
              for (const url of previous.photoUris) {
                if (url && isRemoteUri(url) && !nextSet.has(url)) {
                  await deleteFromStorage(getPhotoBucket("property"), url).catch(() => undefined);
                }
              }
            }
          } catch (updateError) {
            for (const u of uploadedPaths) {
              await deleteStorageObject(u.bucket, u.path).catch(() => undefined);
            }
            throw updateError;
          }
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
        const item = state.maintenanceItems.find((m) => m.id === id);
        const pid = item?.propertyId;
        setState((s) => ({ ...s, maintenanceItems: s.maintenanceItems.filter((m) => m.id !== id) }));
        if (pid) bumpScore(pid);
        if (isSignedIn && item) {
          void requireAuthUserId()
            .then(async (userId) => {
              await maintenanceService.deleteMaintenanceItem(userId, id);
              for (const url of item.photoUris ?? []) {
                if (url && isRemoteUri(url)) {
                  await deleteFromStorage(getPhotoBucket("property"), url).catch(() => undefined);
                }
              }
            })
            .catch((e) => syncError("Delete maintenance", e));
        }
      },

      completeMaintenanceItem: async (id, options) => {
        if (completingMaintenanceRef.current) {
          return null;
        }
        completingMaintenanceRef.current = true;

        const item = stateRef.current.maintenanceItems.find((m) => m.id === id);

        if (!item) {
          completingMaintenanceRef.current = false;
          throw new Error("Maintenance task not found.");
        }

        const previous = { ...item };
        const outcome = options?.outcome ?? (item.recurring ? "reschedule" : "history");
        const lastCompleted = options?.completedAt?.trim() || todayIsoDate();

        let nextDue = item.nextDue ?? "";
        let status: MaintenanceItem["status"] = "Completed";
        let recurring = item.recurring;
        let intervalDays = item.intervalDays;
        let archived = false;

        if (outcome === "history") {
          status = "Completed";
          recurring = false;
          archived = false;
        } else if (outcome === "archive") {
          status = "Completed";
          recurring = false;
          archived = true;
        } else {
          // reschedule
          nextDue = options?.nextDue?.trim() || "";
          if (!nextDue) {
            const interval = item.intervalDays && item.intervalDays > 0 ? item.intervalDays : 30;
            nextDue = isoDateFromTimestamp(Date.now() + interval * 86400000);
          }
          if (options?.intervalDays && options.intervalDays > 0) {
            intervalDays = options.intervalDays;
          }
          recurring = true;
          archived = false;
          status = statusFromNextDue(nextDue);
        }

        let notes = item.notes ?? "";
        const completionNotes = options?.completionNotes?.trim();
        if (completionNotes) {
          notes = notes.trim()
            ? `${notes.trim()}\n\nCompleted (${lastCompleted}): ${completionNotes}`
            : `Completed (${lastCompleted}): ${completionNotes}`;
        }

        const photoUris =
          options?.photoUris !== undefined
            ? options.photoUris.filter((u) => Boolean(u?.trim()))
            : item.photoUris;

        const updates: Partial<MaintenanceItem> = {
          lastCompleted,
          nextDue,
          status,
          recurring,
          intervalDays,
          archived,
          notes,
          photoUris,
        };

        setState((s) => ({
          ...s,
          maintenanceItems: s.maintenanceItems.map((m) => (m.id === id ? { ...m, ...updates } : m)),
        }));
        if (item.propertyId) bumpScore(item.propertyId);

        try {
          if (!isSignedIn) {
            return { ...item, ...updates } as MaintenanceItem;
          }

          await assertOnlineForWrite();
          const userId = await requireAuthUserId();

          let payload = { ...updates };
          if (photoUris?.length) {
            const bucket = getPhotoBucket("property");
            const uploaded: string[] = [];
            for (let i = 0; i < photoUris.length; i++) {
              const uri = photoUris[i];
              if (!uri?.trim()) continue;
              if (isRemoteUri(uri)) {
                uploaded.push(uri);
                continue;
              }
              const result = await uploadLocalFile(
                userId,
                bucket,
                uri,
                `maintenance_${id}_complete_${i}_${Date.now()}.jpg`,
                undefined,
                "image/jpeg",
                [item.propertyId, id]
              );
              if (!result.url?.trim() || !isRemoteUri(result.url)) {
                await deleteStorageObject(result.bucket, result.path).catch(() => undefined);
                throw new Error("Completion photo upload did not return a usable URL.");
              }
              uploaded.push(result.url);
            }
            payload = { ...payload, photoUris: uploaded };
          }

          const saved = await maintenanceService.updateMaintenanceItem(userId, id, payload);

          setState((s) => ({
            ...s,
            maintenanceItems: s.maintenanceItems.map((m) => (m.id === id ? saved : m)),
          }));

          void refreshData().catch(() => undefined);
          return saved;
        } catch (e) {
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
        const inputPhotos =
          a.photoUris?.length
            ? a.photoUris.filter((u) => Boolean(u?.trim()))
            : a.photoUri?.trim()
              ? [a.photoUri.trim()]
              : [];
        const newItem = {
          ...a,
          id: uuid(),
          name: displayName,
          photoUris: inputPhotos,
          photoUri: inputPhotos[0],
        };
        setState((s) => ({ ...s, appliances: [newItem, ...s.appliances] }));
        bumpScore(a.propertyId);
        if (!isSignedIn) return newItem;
        await assertOnlineForWrite();

        const uploadedPaths: { bucket: ReturnType<typeof getPhotoBucket>; path: string }[] = [];

        try {
          const userId = await requireAuthUserId();
          let item = newItem;

          if (inputPhotos.length) {
            const bucket = getPhotoBucket("property");
            const uploaded: string[] = [];
            for (let i = 0; i < inputPhotos.length; i++) {
              const uri = inputPhotos[i];
              if (isRemoteUri(uri)) {
                uploaded.push(uri);
                continue;
              }
              const result = await uploadLocalFile(
                userId,
                bucket,
                uri,
                `appliance_${newItem.id}_${i}.jpg`,
                undefined,
                "image/jpeg",
                [a.propertyId, newItem.id]
              );
              uploadedPaths.push({ bucket: result.bucket, path: result.path });
              if (!result.url?.trim() || !isRemoteUri(result.url)) {
                await deleteStorageObject(result.bucket, result.path);
                throw new Error("Appliance photo upload did not return a usable URL.");
              }
              uploaded.push(result.url);
            }
            item = { ...item, photoUris: uploaded, photoUri: uploaded[0] };
          }

          let created: Appliance;
          try {
            created = await applianceService.createAppliance(userId, item);
          } catch (insertError) {
            for (const u of uploadedPaths) {
              await deleteStorageObject(u.bucket, u.path);
            }
            throw insertError;
          }

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
        if (!isSignedIn || !previous) return;
        await assertOnlineForWrite();

        const uploadedPaths: { bucket: ReturnType<typeof getPhotoBucket>; path: string }[] = [];

        try {
          const userId = await requireAuthUserId();
          const updates: Partial<Appliance> = { ...a };
          const propertyId = previous.propertyId;

          const nextPhotos =
            a.photoUris !== undefined
              ? a.photoUris.filter((u) => Boolean(u?.trim()))
              : a.photoUri !== undefined
                ? a.photoUri.trim()
                  ? [a.photoUri.trim()]
                  : []
                : undefined;

          if (nextPhotos !== undefined) {
            const bucket = getPhotoBucket("property");
            const uploaded: string[] = [];
            for (let i = 0; i < nextPhotos.length; i++) {
              const uri = nextPhotos[i];
              if (isRemoteUri(uri)) {
                uploaded.push(uri);
                continue;
              }
              const result = await uploadLocalFile(
                userId,
                bucket,
                uri,
                `appliance_${id}_${i}_${Date.now()}.jpg`,
                undefined,
                "image/jpeg",
                [propertyId, id]
              );
              uploadedPaths.push({ bucket: result.bucket, path: result.path });
              if (!result.url?.trim() || !isRemoteUri(result.url)) {
                await deleteStorageObject(result.bucket, result.path);
                throw new Error("Appliance photo upload did not return a usable URL.");
              }
              uploaded.push(result.url);
            }
            updates.photoUris = uploaded;
            updates.photoUri = uploaded[0] ?? "";
          }

          try {
            await applianceService.updateAppliance(userId, id, updates);
          } catch (updateError) {
            for (const u of uploadedPaths) {
              await deleteStorageObject(u.bucket, u.path);
            }
            throw updateError;
          }

          if (nextPhotos !== undefined) {
            const prevList =
              previous.photoUris?.length
                ? previous.photoUris
                : previous.photoUri?.trim()
                  ? [previous.photoUri.trim()]
                  : [];
            const nextSet = new Set(updates.photoUris ?? []);
            for (const url of prevList) {
              if (url && isRemoteUri(url) && !nextSet.has(url)) {
                await deleteFromStorage(getPhotoBucket("property"), url).catch(() => undefined);
              }
            }
          }

          setState((s) => ({
            ...s,
            appliances: s.appliances.map((ap) =>
              ap.id === id
                ? {
                    ...ap,
                    ...updates,
                    photoUris: updates.photoUris ?? ap.photoUris,
                    photoUri: updates.photoUri ?? ap.photoUri,
                  }
                : ap
            ),
          }));
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
        const appliance = state.appliances.find((a) => a.id === id);
        const pid = appliance?.propertyId;
        setState((s) => ({ ...s, appliances: s.appliances.filter((a) => a.id !== id) }));
        if (pid) bumpScore(pid);
        if (isSignedIn && appliance) {
          void requireAuthUserId()
            .then(async (userId) => {
              await applianceService.deleteAppliance(userId, id);
              const urls =
                appliance.photoUris?.length
                  ? appliance.photoUris
                  : appliance.photoUri
                    ? [appliance.photoUri]
                    : [];
              for (const url of urls) {
                if (url && isRemoteUri(url)) {
                  await deleteFromStorage(getPhotoBucket("property"), url);
                }
              }
            })
            .catch((e) => syncError("Delete appliance", e));
        }
      },

      addDocument: async (d) => {
        const title = (d.title ?? "").trim();
        const propertyId = (d.propertyId ?? "").trim();
        if (!title) throw new Error("Document title is required.");
        if (!propertyId) throw new Error("Property is required.");
        if (!d.fileUri?.trim()) throw new Error("Please choose a file before saving.");

        const newDoc = {
          ...d,
          id: uuid(),
          title,
          propertyId,
        };
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
            const mimeHint =
              d.fileType === "pdf"
                ? "application/pdf"
                : d.fileType === "image"
                  ? "image/jpeg"
                  : undefined;

            const fileInfo = await verifyLocalFileExists(d.fileUri);
            if (!fileInfo.exists) {
              throw new Error(fileInfo.error ?? "File not found on device.");
            }
            if (fileInfo.size === 0) {
              throw new Error("Selected file is 0 bytes.");
            }

            const bucket = bucketForDocumentCategory(d.category);
            const bucketCheck = await verifyStorageBucketExists(bucket);
            if (!bucketCheck.ok) {
              throw new Error(
                `Storage bucket "${bucket}" is not reachable: ${bucketCheck.error ?? "unknown error"}`
              );
            }

            const uploaded = await uploadLocalFile(
              userId,
              bucket,
              d.fileUri,
              d.fileName?.trim() || title || undefined,
              undefined,
              mimeHint
            );
            uploadedBucket = uploaded.bucket;
            uploadedPath = uploaded.path;

            if (!uploaded.url?.trim() || !isRemoteUri(uploaded.url)) {
              await deleteStorageObject(uploaded.bucket, uploaded.path);
              throw new Error("File upload did not return a usable URL.");
            }
            doc = { ...doc, fileUri: uploaded.url };
          }

          let created: Document;
          try {
            created = await vaultService.createVaultDocument(userId, doc);
          } catch (insertError) {
            if (uploadedBucket && uploadedPath) {
              await deleteStorageObject(uploadedBucket, uploadedPath);
            }
            throw insertError;
          }

          if (!created.fileUri?.trim() || !isRemoteUri(created.fileUri)) {
            const all = await vaultService.fetchAllVaultDocuments(userId).catch(() => [] as Document[]);
            const fetched = all.find((x) => x.id === created.id);
            if (fetched?.fileUri && isRemoteUri(fetched.fileUri)) {
              created = fetched;
            }
          }

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
            .then(async (userId) => {
              const result = await vaultService.deleteVaultDocument(userId, doc);
              if (result.storageWarning) {
                syncError("Document deleted — storage cleanup warning", new Error(result.storageWarning));
              }
            })
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

      deletePhoto: async (id) => {
        const previous = stateRef.current.photos.find((p) => p.id === id);
        setState((s) => ({ ...s, photos: s.photos.filter((p) => p.id !== id) }));
        if (!isSignedIn) return;
        try {
          const result = await photoService.deletePhoto(id);
          if (result.storageWarning) {
            throw new Error(
              `Photo removed from your records, but file cleanup failed: ${result.storageWarning}`
            );
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          // Restore only when the DB delete failed (not when storage cleanup warned after success).
          if (previous && !msg.includes("file cleanup failed")) {
            setState((s) => ({
              ...s,
              photos: [previous, ...s.photos.filter((p) => p.id !== previous.id)],
            }));
          }
          throw e instanceof Error ? e : new Error(msg);
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
