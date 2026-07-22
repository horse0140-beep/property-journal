import {
  ScrollView,
  Text,
  View,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  Dimensions,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardModal } from "@/components/KeyboardModal";
import { PhotoCard } from "@/components/PhotoCard";
import { DocumentCard } from "@/components/DocumentCard";
import { DocumentViewerModal } from "@/components/DocumentViewerModal";
import { ContractorCard } from "@/components/ContractorCard";
import { ContractorViewerModal } from "@/components/ContractorViewerModal";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { ScoreRing } from "@/components/ScoreRing";
import { WebHomeButton, goBackOrHome } from "@/components/WebHomeButton";
import { colors, styles } from "@/constants/theme";
import { useHomeWise } from "@/context/HomeWiseContext";
import type { MaintenanceItem, Property } from "@/context/HomeWiseContext";
import type { Contractor, Document } from "@/data/demoData";
import { showRealSaveError, logSaveSuccessEvent } from "@/lib/realSaveError";
import { showMaintenanceSaveError, showRepairSaveError } from "@/lib/maintenanceRepairSave";
import { formatDateForDisplay, todayIsoDate } from "@/lib/dateForDatabase";
import { deleteRepairPhotoObject } from "@/lib/repairPhotos";
import { RepairPhotoStrip } from "@/components/RepairPhotoStrip";
import { RepairDetailModal } from "@/components/RepairDetailModal";
import { MaintenanceDetailModal } from "@/components/MaintenanceDetailModal";
import { DatePickerField, toIsoDateValue } from "@/components/DatePickerField";
import type { Repair } from "@/data/demoData";
import { matchesPropertyId } from "@/types/database";
import { useUpgrade } from "@/context/UpgradeContext";
import {
  pickCameraForUpload,
  pickDocumentForUpload,
  pickImageForUpload,
  isRemoteUri,
  type UploadProgress,
} from "@/services/storageService";
import { photoKindFromCategory } from "@/services/storageBuckets";
import { displayFileNameFromUri, titleFromFileName, takePhoto, pickImageFromLibrary } from "@/lib/fileUtils";
import {
  DOC_CATEGORIES,
  MAINTENANCE_CATEGORIES,
  PAINT_FINISHES,
  PHOTO_CATEGORIES,
  PROPERTY_SECTIONS,
  REPAIR_CATEGORIES,
  TRADES,
  type MaintenanceView,
  type PropertyModal,
  type PropertySection,
} from "@/components/property/propertyDetailConstants";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const THUMB_SIZE = (SCREEN_WIDTH - 48 - 8) / 3;

const TYPE_LABELS: Record<Property["type"], string> = {
  primary: "Primary Home",
  rental: "Rental",
  vacation: "Vacation Home",
  investment: "Investment",
};

function DetailRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <View style={{ flex: 1, minWidth: "45%", marginBottom: 12 }}>
      <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: "700", textTransform: "uppercase" }}>
        {label}
      </Text>
      <Text style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 14, marginTop: 2 }}>{value}</Text>
    </View>
  );
}

function statusBadge(status: string) {
  if (status === "Overdue") return styles.badgeDanger;
  if (status === "Due Soon") return styles.badgeWarn;
  if (status === "Completed") return styles.badge;
  return styles.badgeInfo;
}

function conditionColor(c: string) {
  if (c === "Excellent") return colors.scoreExcellent;
  if (c === "Good") return colors.scoreGood;
  if (c === "Fair") return colors.scoreFair;
  return colors.scorePoor;
}

function computeMaintenanceStatus(nextDue: string): MaintenanceItem["status"] {
  if (!nextDue || nextDue === "TBD") return "Upcoming";
  const iso = toIsoDateValue(nextDue);
  if (iso) {
    const [y, m, d] = iso.split("-").map(Number);
    const days = (new Date(y, m - 1, d).getTime() - Date.now()) / 86400000;
    if (days < 0) return "Overdue";
    if (days <= 30) return "Due Soon";
    return "Upcoming";
  }
  const parsed = Date.parse(nextDue);
  if (Number.isNaN(parsed)) return "Upcoming";
  const days = (parsed - Date.now()) / 86400000;
  if (days < 0) return "Overdue";
  if (days <= 30) return "Due Soon";
  return "Upcoming";
}

const EMPTY_DOC: Omit<Document, "id"> = {
  propertyId: "",
  title: "",
  category: "other",
  fileType: "pdf",
  fileSize: "—",
  fileName: "",
  uploadDate: todayIsoDate(),
  notes: "",
  tags: [],
  expiresDate: "",
};

function SectionAddButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: colors.primary,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
      }}
    >
      <Ionicons name="add" size={16} color="#fff" />
      <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}

export default function PropertyDetailContent({
  propertyId,
  initialSection = "overview",
  initialMaintenanceView,
}: {
  propertyId: string;
  initialSection?: PropertySection;
  initialMaintenanceView?: MaintenanceView;
}) {
  const insets = useSafeAreaInsets();
  const { canAccess, showUpgrade } = useUpgrade();
  const {
    properties,
    maintenanceItems,
    repairs,
    appliances,
    documents,
    paintColors,
    contractors,
    photos,
    addMaintenanceItem,
    updateMaintenanceItem,
    deleteMaintenanceItem,
    completeMaintenanceItem,
    addRepair,
    updateRepair,
    deleteRepair,
    addAppliance,
    updateAppliance,
    deleteAppliance,
    addPaintColor,
    deletePaintColor,
    addContractor,
    updateContractor,
    deleteContractor,
    addDocument,
    updateDocument,
    deleteDocument,
    addPhoto,
    updatePhoto,
    deletePhoto,
    getPropertyScore,
    refreshData,
  } = useHomeWise();

  const property = properties.find((p) => p.id === propertyId);
  const [section, setSection] = useState<PropertySection>(initialSection);
  const [maintenanceView, setMaintenanceView] = useState<MaintenanceView>(
    initialMaintenanceView ?? "tasks"
  );
  const [modal, setModal] = useState<PropertyModal>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  // Maintenance — dates stored as ISO YYYY-MM-DD from the calendar picker
  const [mTitle, setMTitle] = useState("");
  const [mCategory, setMCategory] = useState("General");
  const [mNextDue, setMNextDue] = useState("");
  const [mLastCompleted, setMLastCompleted] = useState("");
  const [mNotes, setMNotes] = useState("");
  const [mPriority, setMPriority] = useState<"low" | "medium" | "high">("medium");
  const [viewRepair, setViewRepair] = useState<Repair | null>(null);
  const [viewMaintenance, setViewMaintenance] = useState<MaintenanceItem | null>(null);

  // Repair
  const [rTitle, setRTitle] = useState("");
  const [rDate, setRDate] = useState("");
  const [rCost, setRCost] = useState("");
  const [rContractor, setRContractor] = useState("");
  const [rCategory, setRCategory] = useState("General");
  const [rNotes, setRNotes] = useState("");
  const [rWarranty, setRWarranty] = useState("");
  const [rPhotoUris, setRPhotoUris] = useState<string[]>([]);

  // Appliance
  const [aName, setAName] = useState("");
  const [aBrand, setABrand] = useState("");
  const [aModel, setAModel] = useState("");
  const [aSerial, setASerial] = useState("");
  const [aInstall, setAInstall] = useState("");
  const [aPrice, setAPrice] = useState("");
  const [aWarranty, setAWarranty] = useState("");
  const [aCondition, setACondition] = useState<"Excellent" | "Good" | "Fair" | "Poor" | "Replace Soon">("Good");
  const [aNotes, setANotes] = useState("");
  const [aLife, setALife] = useState("12");
  const [aPhotoUri, setAPhotoUri] = useState<string | null>(null);

  // Paint
  const [pRoom, setPRoom] = useState("");
  const [pBrand, setPBrand] = useState("");
  const [pName, setPName] = useState("");
  const [pCode, setPCode] = useState("");
  const [pFinish, setPFinish] = useState("Eggshell");
  const [pHex, setPHex] = useState("#F5EFE2");
  const [pDate, setPDate] = useState("");
  const [pNotes, setPNotes] = useState("");

  // Contractor
  const [cName, setCName] = useState("");
  const [cTrade, setCTrade] = useState("General Contractor");
  const [cPhone, setCPhone] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cNotes, setCNotes] = useState("");

  // Document
  const [docForm, setDocForm] = useState<Omit<Document, "id">>({ ...EMPTY_DOC });
  const [pickedFileName, setPickedFileName] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  // Photo
  const [pendingPhotoUri, setPendingPhotoUri] = useState<string | null>(null);
  const [photoCaption, setPhotoCaption] = useState("");
  const [photoCategory, setPhotoCategory] = useState("Exterior");
  const [photoSavePhase, setPhotoSavePhase] = useState<"idle" | "uploading" | "saved">("idle");
  const [viewDocument, setViewDocument] = useState<Document | null>(null);
  const [viewContractor, setViewContractor] = useState<(typeof contractors)[number] | null>(null);

  useEffect(() => {
    setSection(initialSection);
    if (initialMaintenanceView) {
      setMaintenanceView(initialMaintenanceView);
    }
  }, [initialSection, initialMaintenanceView]);

  if (!property) {
    return (
      <Screen>
        <View style={styles.emptyState}>
          <Ionicons name="home-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyStateTitle}>Property not found</Text>
          <Pressable style={styles.primaryButton} onPress={() => router.back()}>
            <Text style={styles.primaryButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const pid = property.id;
  const score = getPropertyScore(pid);
  const maint = maintenanceItems.filter((m) => matchesPropertyId(m.propertyId, pid));
  const propRepairs = repairs.filter((r) => matchesPropertyId(r.propertyId, pid));
  const propAppliances = appliances.filter((a) => matchesPropertyId(a.propertyId, pid));
  const propDocs = documents.filter((d) => matchesPropertyId(d.propertyId, pid));
  const propPaint = paintColors.filter((p) => matchesPropertyId(p.propertyId, pid));
  const propContractors = contractors.filter((c) => !c.propertyId || matchesPropertyId(c.propertyId, pid));
  const propPhotos = photos.filter((p) => matchesPropertyId(p.propertyId, pid));

  const fullAddress = [property.address, property.city, property.state, property.zip].filter(Boolean).join(", ");
  const sectionMeta = PROPERTY_SECTIONS.find((s) => s.key === section);
  const addLabel =
    section === "maintenance"
      ? maintenanceView === "tasks"
        ? "Add Task"
        : maintenanceView === "repairs"
          ? "Log Repair"
          : "Add Appliance"
      : sectionMeta?.addLabel;

  function resetForms() {
    setEditingId(null);
    setMTitle("");
    setMNextDue("");
    setMLastCompleted("");
    setMNotes("");
    setMCategory("General");
    setMPriority("medium");
    setRTitle("");
    setRDate("");
    setRCost("");
    setRContractor("");
    setRCategory("General");
    setRNotes("");
    setRWarranty("");
    setRPhotoUris([]);
    setAName("");
    setABrand("");
    setAModel("");
    setASerial("");
    setAInstall("");
    setAPrice("");
    setAWarranty("");
    setACondition("Good");
    setANotes("");
    setALife("12");
    setAPhotoUri(null);
    setPRoom("");
    setPBrand("");
    setPName("");
    setPCode("");
    setPFinish("Eggshell");
    setPHex("#F5EFE2");
    setPDate("");
    setPNotes("");
    setCName("");
    setCTrade("General Contractor");
    setCPhone("");
    setCEmail("");
    setCNotes("");
    setDocForm({ ...EMPTY_DOC, propertyId: pid });
    setPickedFileName(null);
    setPendingPhotoUri(null);
    setPhotoCaption("");
    setPhotoCategory("Exterior");
    setPhotoSavePhase("idle");
  }

  // Keep the open detail modal in sync with context after Mark Complete / refresh.
  useEffect(() => {
    if (!viewMaintenance) return;
    const fresh = maintenanceItems.find((m) => m.id === viewMaintenance.id);
    if (!fresh) return;
    if (
      fresh.status !== viewMaintenance.status ||
      fresh.lastCompleted !== viewMaintenance.lastCompleted ||
      fresh.nextDue !== viewMaintenance.nextDue ||
      fresh.notes !== viewMaintenance.notes
    ) {
      setViewMaintenance(fresh);
    }
  }, [maintenanceItems, viewMaintenance]);

  function openAdd(kind: PropertyModal) {
    resetForms();
    setModal(kind);
  }

  function openEditMaintenance(item: MaintenanceItem) {
    setViewMaintenance(null);
    setEditingId(item.id);
    setMTitle(item.title);
    setMCategory(item.category);
    setMNextDue(toIsoDateValue(item.nextDue) ?? "");
    setMLastCompleted(toIsoDateValue(item.lastCompleted) ?? "");
    setMNotes(item.notes ?? "");
    setMPriority(item.priority);
    setModal("maintenance");
  }

  function openEditRepair(item: Repair) {
    console.log("[RepairCard] tapped", { id: item.id, title: item.title });
    setViewRepair(null);
    setEditingId(item.id);
    setRTitle(item.title);
    setRDate(toIsoDateValue(item.date) ?? "");
    setRCost(item.cost ?? "");
    setRContractor(item.contractor === "Not listed" ? "" : (item.contractor ?? ""));
    setRCategory(item.category || "General");
    setRNotes(item.notes ?? "");
    setRWarranty(toIsoDateValue(item.warrantyExpires) ?? "");
    setRPhotoUris([...(item.photoUris ?? [])]);
    setModal("repair");
  }

  function openEditAppliance(a: (typeof appliances)[number]) {
    setEditingId(a.id);
    setAName(a.name);
    setABrand(a.brand ?? "");
    setAModel(a.model ?? "");
    setASerial(a.serial ?? "");
    setAInstall(toIsoDateValue(a.installDate) ?? "");
    setAPrice(a.purchasePrice ?? "");
    setAWarranty(toIsoDateValue(a.warrantyExpires) ?? "");
    setACondition(a.condition);
    setANotes(a.notes ?? "");
    setALife(String(a.expectedLifeYears ?? 12));
    setAPhotoUri(a.photoUri?.trim() ? a.photoUri : null);
    setModal("appliance");
  }

  function openEditContractor(c: Contractor) {
    setViewContractor(null);
    setEditingId(c.id);
    setCName(c.name);
    setCTrade(c.trade || "General Contractor");
    setCPhone(c.phone ?? "");
    setCEmail(c.email ?? "");
    setCNotes(c.notes ?? "");
    setModal("contractor");
  }

  function openEditDocument(d: Document) {
    setViewDocument(null);
    setEditingId(d.id);
    const resolvedName =
      d.fileName?.trim() ||
      displayFileNameFromUri(d.fileUri, d.title || "Attached file");
    setDocForm({
      propertyId: d.propertyId,
      title: d.title,
      category: d.category,
      fileType: d.fileType,
      fileSize: d.fileSize,
      fileName: resolvedName,
      uploadDate: d.uploadDate,
      notes: d.notes ?? "",
      tags: d.tags ?? [],
      expiresDate: toIsoDateValue(d.expiresDate) ?? "",
      fileUri: d.fileUri,
    });
    setPickedFileName(d.fileUri ? resolvedName : null);
    setModal("document");
  }

  function handleSectionAdd() {
    if (section === "maintenance") {
      if (maintenanceView === "tasks") openAdd("maintenance");
      else if (maintenanceView === "repairs") openAdd("repair");
      else openAdd("appliance");
      return;
    }
    const map: Partial<Record<PropertySection, PropertyModal>> = {
      paint: "paint",
      documents: "document",
      photos: "photo",
      contractors: "contractor",
    };
    const kind = map[section];
    if (kind) openAdd(kind);
  }

  async function handleSave() {
    if (savingRef.current || isSaving || !modal) return;
    savingRef.current = true;
    setIsSaving(true);
    const action = `save ${modal}`;
    const activeModal = modal;
    try {
      let saved: unknown;
      if (activeModal === "maintenance") {
        if (!mTitle.trim()) {
          Alert.alert("Required", "Enter a task name.");
          return;
        }
        const nextDueIso = toIsoDateValue(mNextDue);
        if (!nextDueIso) {
          Alert.alert("Required", "Choose a next due date from the calendar.");
          return;
        }
        const lastCompletedIso = toIsoDateValue(mLastCompleted);
        if (mLastCompleted.trim() && !lastCompletedIso) {
          Alert.alert("Invalid Date", "Choose a valid last completed date from the calendar.");
          return;
        }
        const status = computeMaintenanceStatus(nextDueIso);
        if (editingId) {
          await updateMaintenanceItem(editingId, {
            title: mTitle,
            category: mCategory,
            nextDue: nextDueIso,
            lastCompleted: lastCompletedIso ?? "",
            notes: mNotes,
            priority: mPriority,
            status,
          });
          saved = { id: editingId, title: mTitle };
        } else {
          saved = await addMaintenanceItem({
            propertyId: pid,
            title: mTitle,
            category: mCategory,
            lastCompleted: lastCompletedIso ?? "",
            nextDue: nextDueIso,
            status,
            notes: mNotes,
            recurring: true,
            intervalDays: 180,
            priority: mPriority,
          });
        }
      } else if (activeModal === "repair") {
        if (!rTitle.trim()) {
          Alert.alert("Required", "Enter a repair name.");
          return;
        }
        const repairDateIso = toIsoDateValue(rDate);
        if (!repairDateIso) {
          Alert.alert("Required", "Choose a repair date from the calendar.");
          return;
        }
        const warrantyIso = toIsoDateValue(rWarranty);
        if (rWarranty.trim() && !warrantyIso) {
          Alert.alert("Invalid Warranty Date", "Choose a valid warranty date from the calendar.");
          return;
        }
        const repairPayload = {
          propertyId: pid,
          title: rTitle,
          date: repairDateIso,
          cost: rCost,
          contractor: rContractor || "Not listed",
          category: rCategory,
          notes: rNotes,
          photoUris: rPhotoUris,
          warrantyExpires: warrantyIso ?? undefined,
        };
        if (editingId) {
          await updateRepair(editingId, repairPayload);
          saved = { id: editingId, title: rTitle };
        } else {
          saved = await addRepair(repairPayload);
        }
      } else if (activeModal === "appliance") {
        if (!aName.trim()) {
          Alert.alert("Required", "Enter appliance name.");
          return;
        }
        const installIso = toIsoDateValue(aInstall);
        if (aInstall.trim() && !installIso) {
          Alert.alert("Invalid Install Date", "Choose a valid install date from the calendar.");
          return;
        }
        const applianceWarrantyIso = toIsoDateValue(aWarranty);
        if (aWarranty.trim() && !applianceWarrantyIso) {
          Alert.alert("Invalid Warranty Date", "Choose a valid warranty date from the calendar.");
          return;
        }
        const payload = {
          propertyId: pid,
          name: aName.trim(),
          category: "Appliance" as const,
          brand: aBrand,
          model: aModel,
          serial: aSerial,
          installDate: installIso ?? "",
          purchasePrice: aPrice,
          expectedLifeYears: parseInt(aLife, 10) || 12,
          warrantyExpires: applianceWarrantyIso ?? "",
          lastService: "Not recorded",
          nextService: "TBD",
          condition: aCondition,
          notes: aNotes,
          photoUri: aPhotoUri?.trim() || undefined,
        };
        if (editingId) {
          await updateAppliance(editingId, {
            ...payload,
            photoUri: aPhotoUri?.trim() ? aPhotoUri.trim() : "",
          });
          saved = { id: editingId, name: aName };
        } else {
          saved = await addAppliance(payload);
        }
      } else if (activeModal === "paint") {
        if (!pRoom.trim()) {
          Alert.alert("Required", "Enter a room.");
          return;
        }
        const paintDateIso = toIsoDateValue(pDate);
        if (pDate.trim() && !paintDateIso) {
          Alert.alert("Invalid Date", "Choose a valid purchase date from the calendar.");
          return;
        }
        saved = await addPaintColor({
          propertyId: pid,
          room: pRoom,
          brand: pBrand,
          colorName: pName,
          colorCode: pCode,
          finish: pFinish,
          hex: pHex.startsWith("#") ? pHex : `#${pHex}`,
          purchaseDate: paintDateIso ?? "",
          notes: pNotes,
        });
      } else if (activeModal === "contractor") {
        if (!cName.trim()) {
          Alert.alert("Required", "Enter contractor name.");
          return;
        }
        if (editingId) {
          await updateContractor(editingId, {
            name: cName.trim(),
            trade: cTrade,
            phone: cPhone,
            email: cEmail,
            notes: cNotes,
          });
          saved = { id: editingId, name: cName };
        } else {
          saved = await addContractor({
            name: cName,
            trade: cTrade,
            phone: cPhone,
            email: cEmail,
            website: "",
            rating: 5,
            notes: cNotes,
            lastUsed: "Not recorded",
            licenseNumber: "",
            propertyId: pid,
          });
        }
      } else if (activeModal === "document") {
        if (!docForm.title.trim()) {
          Alert.alert("Required", "Please enter a document title.");
          return;
        }
        const expiresIso = toIsoDateValue(docForm.expiresDate);
        if ((docForm.expiresDate ?? "").trim() && !expiresIso) {
          Alert.alert("Invalid Date", "Choose a valid expiration date from the calendar.");
          return;
        }
        if (editingId) {
          if (!docForm.fileUri?.trim()) {
            Alert.alert("File Missing", "This document has no file attached.");
            return;
          }
          await updateDocument(editingId, {
            title: docForm.title.trim(),
            category: docForm.category,
            notes: docForm.notes,
            expiresDate: expiresIso ?? "",
          });
          saved = { id: editingId, title: docForm.title };
        } else {
          if (!docForm.fileUri?.trim()) {
            Alert.alert("File Required", "Please choose a file first.");
            return;
          }
          if (docForm.fileUri && !isRemoteUri(docForm.fileUri) && !canAccess("cloud_backup")) {
            showUpgrade("cloud_backup");
            return;
          }
          saved = await addDocument({
            ...docForm,
            propertyId: pid,
            expiresDate: expiresIso ?? "",
          });
        }
      } else if (activeModal === "photo") {
        if (!pendingPhotoUri) {
          Alert.alert("Photo Required", "Please choose a photo first.");
          return;
        }
        if (!canAccess("cloud_backup")) {
          showUpgrade("cloud_backup");
          return;
        }
        setPhotoSavePhase("uploading");
        saved = await addPhoto({
          propertyId: pid,
          uri: pendingPhotoUri,
          caption: photoCaption,
          date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          category: photoCategory,
          photoType: photoKindFromCategory(photoCategory),
        });
      }

      if (saved !== undefined) {
        logSaveSuccessEvent("property", action, saved);
        if (activeModal === "photo") {
          setSection("photos");
          setPhotoSavePhase("saved");
          setTimeout(() => {
            setModal(null);
            resetForms();
          }, 1200);
        } else {
          setModal(null);
          resetForms();
        }
        try {
          await refreshData();
        } catch {
          if (activeModal === "document") {
            Alert.alert(
              "Saved",
              "Document uploaded, but the list could not refresh. Pull to refresh."
            );
          }
        }
      }
    } catch (e) {
      if (activeModal === "photo") {
        setPhotoSavePhase("idle");
      }
      if (activeModal === "maintenance") {
        showMaintenanceSaveError(action, e);
      } else if (activeModal === "repair") {
        showRepairSaveError(action, e);
      } else {
        const errorScreen =
          activeModal === "appliance"
            ? "appliance"
            : activeModal === "paint"
              ? "paint"
              : activeModal === "contractor"
                ? "contractor"
                : activeModal === "document"
                  ? "vault"
                  : activeModal === "photo"
                    ? "photos"
                    : "maintenance";
        showRealSaveError(errorScreen, action, e);
      }
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  async function attachDocument(
    picker: () => Promise<{ localUri: string; name: string; formattedSize: string; fileType: "pdf" | "image" | "other" } | null>
  ) {
    setPicking(true);
    try {
      const result = await picker();
      if (result) {
        setPickedFileName(result.name);
        setDocForm((f) => ({
          ...f,
          fileUri: result.localUri,
          fileSize: result.formattedSize,
          fileType: result.fileType,
          fileName: result.name,
          // Prefill title only when empty — never overwrite a user-entered title.
          title: f.title.trim() ? f.title : titleFromFileName(result.name),
        }));
      }
    } catch (e) {
      showRealSaveError("property", "pick document", e);
    } finally {
      setPicking(false);
    }
  }

  async function attachAppliancePhoto(fromCamera: boolean) {
    setPicking(true);
    try {
      if (fromCamera) {
        const shot = await takePhoto({ allowsEditing: false, quality: 0.85 });
        if (shot?.uri) setAPhotoUri(shot.uri);
        return;
      }
      const results = await pickImageFromLibrary({ allowsMultiple: false, allowsEditing: false, quality: 0.85 });
      if (results?.[0]?.uri) setAPhotoUri(results[0].uri);
    } catch (e) {
      showRealSaveError("appliance", "pick photo", e);
    } finally {
      setPicking(false);
    }
  }

  async function attachPhoto(fromCamera: boolean) {
    setPicking(true);
    try {
      const picked = fromCamera ? await pickCameraForUpload() : await pickImageForUpload();
      if (picked) {
        setPendingPhotoUri(picked.localUri);
        setModal("photo");
      }
    } catch (e) {
      showRealSaveError("property", "pick photo", e);
    } finally {
      setPicking(false);
    }
  }

  async function handleDeleteRepairPhoto(repairId: string, storedUrl: string) {
    const repair = propRepairs.find((rp) => rp.id === repairId);
    if (!repair) return;
    const remaining = (repair.photoUris ?? []).filter((u) => u !== storedUrl);
    try {
      await updateRepair(repairId, { photoUris: remaining });
      await deleteRepairPhotoObject(storedUrl);
      console.log("[REPAIR PHOTO DB ROW]", { repairId, action: "photo removed", remaining: remaining.length });
    } catch (e) {
      showRepairSaveError("delete repair photo", e);
    }
  }

  async function attachRepairPhoto(fromCamera: boolean) {
    setPicking(true);
    try {
      const picked = fromCamera ? await pickCameraForUpload() : await pickImageForUpload();
      if (picked) {
        setRPhotoUris((prev) => [...prev, picked.localUri]);
      }
    } catch (e) {
      showRealSaveError("property", "pick repair photo", e);
    } finally {
      setPicking(false);
    }
  }

  function renderOverview(prop: Property) {
    const overdue = maint.filter((m) => m.status === "Overdue").length;
    const dueSoon = maint.filter((m) => m.status === "Due Soon").length;
    const upcoming = maint.filter((m) => m.status === "Upcoming").length;

    return (
      <>
        {prop.photoUri ? (
          <Image
            source={{ uri: prop.photoUri }}
            style={{ width: "100%", height: 180, borderRadius: 16, marginBottom: 16 }}
            resizeMode="cover"
          />
        ) : null}

        <Card style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <ScoreRing score={score.overall} size={72} label={score.label} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700" }}>HOME HEALTH SCORE</Text>
              <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: "900", marginTop: 2 }}>{score.label}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                Maintenance {score.maintenance} · Appliances {score.appliances} · Repairs {score.repairs}
              </Text>
            </View>
          </View>
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <Text style={[styles.sectionHeader, { marginBottom: 10 }]}>Property Details</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            <DetailRow label="Address" value={fullAddress} />
            <DetailRow label="Property Type" value={TYPE_LABELS[prop.type]} />
            <DetailRow label="Year Built" value={prop.yearBuilt} />
            <DetailRow label="Square Footage" value={prop.squareFeet ? `${prop.squareFeet} sq ft` : ""} />
            <DetailRow label="Bedrooms" value={prop.bedrooms} />
            <DetailRow label="Bathrooms" value={prop.bathrooms} />
            <DetailRow label="Estimated Value" value={prop.estimatedValue ? `$${prop.estimatedValue}` : ""} />
          </View>
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <Text style={[styles.sectionHeader, { marginBottom: 10 }]}>At a Glance</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {[
              { label: "Tasks", value: maint.length, section: "maintenance" as PropertySection, tab: "tasks" as MaintenanceView },
              { label: "Appliances", value: propAppliances.length, section: "maintenance" as PropertySection, tab: "appliances" as MaintenanceView },
              { label: "Documents", value: propDocs.length, section: "documents" as PropertySection },
              { label: "Photos", value: propPhotos.length, section: "photos" as PropertySection },
            ].map((item) => (
              <Pressable
                key={item.label}
                onPress={() => {
                  setSection(item.section);
                  if ("tab" in item && item.tab) setMaintenanceView(item.tab);
                }}
                style={{ flex: 1, minWidth: "45%", backgroundColor: colors.bgSection, borderRadius: 12, padding: 14 }}
              >
                <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700" }}>{item.label}</Text>
                <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: "900", marginTop: 4 }}>{item.value}</Text>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: 12, marginTop: 14 }}>
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={{ color: colors.danger, fontSize: 18, fontWeight: "900" }}>{overdue}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 11 }}>Overdue</Text>
            </View>
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={{ color: colors.warning, fontSize: 18, fontWeight: "900" }}>{dueSoon}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 11 }}>Due Soon</Text>
            </View>
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={{ color: colors.primary, fontSize: 18, fontWeight: "900" }}>{upcoming}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 11 }}>Upcoming</Text>
            </View>
          </View>
        </Card>
      </>
    );
  }

  function renderMaintenance() {
    return (
      <>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
          {(["tasks", "repairs", "appliances"] as const).map((v) => (
            <Pressable
              key={v}
              onPress={() => setMaintenanceView(v)}
              style={[styles.chip, maintenanceView === v && styles.chipActive, { flex: 1 }]}
            >
              <Text style={[{ textAlign: "center" }, maintenanceView === v ? styles.chipTextActive : styles.chipText]}>
                {v === "tasks" ? "Tasks" : v === "repairs" ? "Repairs" : "Appliances"}
              </Text>
            </Pressable>
          ))}
        </View>
        {maintenanceView === "appliances" ? (
          propAppliances.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 16 }}>
              <Text style={{ color: colors.textMuted, fontStyle: "italic", marginBottom: 12 }}>
                No appliances recorded.
              </Text>
              <Pressable style={styles.primaryButton} onPress={() => openAdd("appliance")}>
                <Text style={styles.primaryButtonText}>Add Appliance</Text>
              </Pressable>
            </View>
          ) : (
            propAppliances.map((a) => (
              <Card key={a.id} style={{ marginBottom: 10 }}>
                <View style={styles.rowBetween}>
                  <View style={{ flexDirection: "row", flex: 1, gap: 10, alignItems: "center" }}>
                    {a.photoUri ? (
                      <Image
                        source={{ uri: a.photoUri }}
                        style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: colors.bgSection }}
                        resizeMode="cover"
                      />
                    ) : null}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{a.name}</Text>
                      <Text style={styles.muted}>{[a.brand, a.model].filter(Boolean).join(" · ")}</Text>
                    </View>
                  </View>
                  <Text style={{ color: conditionColor(a.condition), fontWeight: "700" }}>{a.condition}</Text>
                </View>
                <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
                  <Pressable onPress={() => openEditAppliance(a)}>
                    <Text style={{ color: colors.primary, fontWeight: "700" }}>Edit</Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      Alert.alert("Delete", `Remove "${a.name}"?`, [
                        { text: "Cancel", style: "cancel" },
                        { text: "Delete", style: "destructive", onPress: () => deleteAppliance(a.id) },
                      ])
                    }
                  >
                    <Text style={styles.deleteText}>Delete</Text>
                  </Pressable>
                </View>
              </Card>
            ))
          )
        ) : maintenanceView === "tasks" ? (
          maint.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 16 }}>
              <Text style={{ color: colors.textMuted, fontStyle: "italic", marginBottom: 12 }}>
                No maintenance tasks yet.
              </Text>
              <Pressable style={styles.primaryButton} onPress={() => openAdd("maintenance")}>
                <Text style={styles.primaryButtonText}>Add Maintenance Task</Text>
              </Pressable>
            </View>
          ) : (
            maint.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => {
                  console.log("[MaintenanceCard] tapped", { id: item.id, title: item.title });
                  setViewMaintenance(item);
                }}
              >
                <Card style={{ marginBottom: 10 }}>
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{item.title}</Text>
                      <Text style={styles.muted}>
                        Due {formatDateForDisplay(item.nextDue) || "—"} · {item.category}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 6 }}>
                      <Text style={statusBadge(item.status)}>{item.status}</Text>
                      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                    </View>
                  </View>
              <Text style={{ color: colors.primary, fontWeight: "700", marginTop: 8, fontSize: 13 }}>
                View details
              </Text>
                </Card>
              </Pressable>
            ))
          )
        ) : propRepairs.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 16 }}>
            <Text style={{ color: colors.textMuted, fontStyle: "italic", marginBottom: 12 }}>
              No repairs recorded.
            </Text>
            <Pressable style={styles.primaryButton} onPress={() => openAdd("repair")}>
              <Text style={styles.primaryButtonText}>Log Repair</Text>
            </Pressable>
          </View>
        ) : (
          propRepairs.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => {
                console.log("[RepairCard] tapped", { id: r.id, title: r.title });
                setViewRepair(r);
              }}
            >
              <Card style={{ marginBottom: 10 }}>
                <View style={styles.rowBetween}>
                  <Text style={[styles.cardTitle, { flex: 1 }]}>{r.title}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </View>
                <Text style={styles.muted}>
                  {formatDateForDisplay(r.date) || r.date}
                  {r.cost ? ` · $${r.cost}` : ""}
                  {r.contractor && r.contractor !== "Not listed" ? ` · ${r.contractor}` : ""}
                </Text>
                <RepairPhotoStrip urls={r.photoUris ?? []} />
                <Text style={{ color: colors.primary, fontWeight: "700", marginTop: 8, fontSize: 13 }}>
                  View details
                </Text>
              </Card>
            </Pressable>
          ))
        )}
      </>
    );
  }

  const prop = property;

  function renderSectionBody() {
    switch (section) {
      case "overview":
        return renderOverview(prop);
      case "maintenance":
        return renderMaintenance();
      case "paint":
        return propPaint.length === 0 ? (
          <Text style={{ color: colors.textMuted, fontStyle: "italic" }}>No paint records yet.</Text>
        ) : (
          propPaint.map((p) => (
            <Card key={p.id} style={{ marginBottom: 10 }}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{p.room}</Text>
                  <Text style={styles.muted}>{[p.brand, p.colorName, p.colorCode].filter(Boolean).join(" · ")}</Text>
                </View>
                {p.hex ? (
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: p.hex, borderWidth: 2, borderColor: colors.border }} />
                ) : null}
              </View>
              <Pressable
                onPress={() =>
                  Alert.alert("Delete", `Remove "${p.room}"?`, [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: () => deletePaintColor(p.id) },
                  ])
                }
                style={{ marginTop: 8 }}
              >
                <Text style={styles.deleteText}>Delete</Text>
              </Pressable>
            </Card>
          ))
        );
      case "documents":
        return propDocs.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 16 }}>
            <Text style={{ color: colors.textMuted, fontStyle: "italic", marginBottom: 12 }}>
              No documents yet.
            </Text>
            <Pressable style={styles.primaryButton} onPress={() => openAdd("document")}>
              <Text style={styles.primaryButtonText}>Upload Document</Text>
            </Pressable>
          </View>
        ) : (
          propDocs.map((d) => (
            <DocumentCard key={d.id} document={d} onPress={setViewDocument} />
          ))
        );
      case "photos":
        return (
          <View>
            <Text style={{ color: colors.textPrimary, fontWeight: "800", fontSize: 16, marginBottom: 4 }}>
              Property Photos
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 12 }}>
              Exterior · Interior · Repairs · Projects
            </Text>
            {propPhotos.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 16 }}>
                <Text style={{ color: colors.textMuted, fontStyle: "italic", marginBottom: 12 }}>
                  No property photos yet.
                </Text>
                <Pressable style={styles.primaryButton} onPress={() => openAdd("photo")}>
                  <Text style={styles.primaryButtonText}>Add Property Photo</Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {propPhotos.map((ph) => (
                  <PhotoCard
                    key={ph.id}
                    photo={ph}
                    size={THUMB_SIZE}
                    onUpdatePhoto={async (id, updates) => {
                      await updatePhoto(id, updates);
                      await refreshData().catch(() => {});
                    }}
                    onDelete={() =>
                      Alert.alert("Delete", "Remove this photo?", [
                        { text: "Cancel", style: "cancel" },
                        { text: "Delete", style: "destructive", onPress: () => deletePhoto(ph.id) },
                      ])
                    }
                  />
                ))}
              </View>
            )}
          </View>
        );
      case "contractors":
        return propContractors.length === 0 ? (
          <Text style={{ color: colors.textMuted, fontStyle: "italic" }}>No contractors saved.</Text>
        ) : (
          propContractors.map((c) => (
            <ContractorCard key={c.id} contractor={c} onPress={setViewContractor} />
          ))
        );
      default:
        return null;
    }
  }

  const modalTitle =
    modal === "maintenance"
      ? editingId
        ? "Edit Task"
        : "Add Task"
      : modal === "repair"
        ? editingId
          ? "Edit Repair"
          : "Log Repair"
        : modal === "appliance"
          ? editingId
            ? "Edit Appliance"
            : "Add Appliance"
          : modal === "paint"
            ? "Add Paint Record"
            : modal === "document"
              ? editingId
                ? "Edit Document"
                : "Add Document"
              : modal === "photo"
                ? "Add Photo"
                : modal === "contractor"
                  ? editingId
                    ? "Edit Contractor"
                    : "Add Contractor"
                  : "";

  return (
    <Screen noPad>
      <View style={{ paddingTop: insets.top + 4, paddingHorizontal: 16, paddingBottom: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable onPress={goBackOrHome} hitSlop={12} accessibilityLabel="Back">
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <WebHomeButton compact />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: colors.textPrimary }} numberOfLines={1}>
              {property.nickname || property.address}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={1}>
              {fullAddress}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push({ pathname: "/(tabs)/properties", params: { edit: pid } })}
            style={[styles.secondaryButton, { marginTop: 0, paddingVertical: 8, paddingHorizontal: 12 }]}
          >
            <Text style={styles.secondaryButtonText}>Edit</Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 12 }}
          contentContainerStyle={{ gap: 6, paddingRight: 8 }}
        >
          {PROPERTY_SECTIONS.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => setSection(t.key)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                backgroundColor: section === t.key ? colors.primary : colors.bgSection,
                borderWidth: 1,
                borderColor: section === t.key ? colors.primary : colors.border,
              }}
            >
              <Ionicons
                name={t.icon as keyof typeof Ionicons.glyphMap}
                size={13}
                color={section === t.key ? "#fff" : colors.textMuted}
              />
              <Text
                style={{
                  color: section === t.key ? "#fff" : colors.textSecondary,
                  fontWeight: "700",
                  fontSize: 12,
                }}
              >
                {t.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        {section !== "overview" && addLabel ? (
          <View style={[styles.rowBetween, { marginBottom: 14 }]}>
            <Text style={styles.sectionHeader}>{sectionMeta?.label}</Text>
            <SectionAddButton label={addLabel} onPress={handleSectionAdd} />
          </View>
        ) : null}
        {renderSectionBody()}
      </ScrollView>

      <KeyboardModal
        visible={modal !== null}
        onRequestClose={() => !isSaving && photoSavePhase !== "uploading" && setModal(null)}
      >
        <View style={styles.rowBetween}>
          <Text style={styles.modalTitle}>{modalTitle}</Text>
          <Pressable onPress={() => !isSaving && photoSavePhase !== "uploading" && setModal(null)}>
            <Ionicons name="close" size={24} color={colors.textMuted} />
          </Pressable>
        </View>

        {modal === "maintenance" && (
          <>
            <Text style={styles.label}>Task Name *</Text>
            <TextInput style={styles.input} placeholder="e.g. HVAC filter change" placeholderTextColor={colors.textMuted} value={mTitle} onChangeText={setMTitle} />
            <Text style={styles.label}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {MAINTENANCE_CATEGORIES.map((c) => (
                <Pressable key={c} style={mCategory === c ? styles.chipActive : styles.chip} onPress={() => setMCategory(c)}>
                  <Text style={mCategory === c ? styles.chipTextActive : styles.chipText}>{c}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <DatePickerField
              label="Next Due Date"
              value={mNextDue}
              onChange={setMNextDue}
              required
              placeholder="Select date"
            />
            <DatePickerField
              label="Last Completed"
              value={mLastCompleted}
              onChange={setMLastCompleted}
              optional
              placeholder="Select date"
            />
            <Text style={styles.label}>Notes</Text>
            <TextInput style={[styles.input, styles.textArea]} placeholder="Notes…" placeholderTextColor={colors.textMuted} value={mNotes} onChangeText={setMNotes} multiline />
          </>
        )}

        {modal === "repair" && (
          <>
            <Text style={styles.label}>Repair / Upgrade *</Text>
            <TextInput style={styles.input} placeholder="e.g. Replaced roof shingles" placeholderTextColor={colors.textMuted} value={rTitle} onChangeText={setRTitle} />
            <Text style={styles.label}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {REPAIR_CATEGORIES.map((c) => (
                <Pressable key={c} style={rCategory === c ? styles.chipActive : styles.chip} onPress={() => setRCategory(c)}>
                  <Text style={rCategory === c ? styles.chipTextActive : styles.chipText}>{c}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <DatePickerField
              label="Date"
              value={rDate}
              onChange={setRDate}
              required
              placeholder="Select date"
            />
            <Text style={styles.label}>Cost ($)</Text>
            <TextInput style={styles.input} placeholder="1,200" placeholderTextColor={colors.textMuted} value={rCost} onChangeText={setRCost} keyboardType="numeric" />
            <Text style={styles.label}>Contractor</Text>
            <TextInput style={styles.input} placeholder="Company or technician" placeholderTextColor={colors.textMuted} value={rContractor} onChangeText={setRContractor} />
            <DatePickerField
              label="Warranty Expiration"
              value={rWarranty}
              onChange={setRWarranty}
              optional
              placeholder="Select date"
            />
            <Text style={styles.label}>Notes</Text>
            <TextInput style={[styles.input, styles.textArea]} placeholder="Notes…" placeholderTextColor={colors.textMuted} value={rNotes} onChangeText={setRNotes} multiline />
            <Text style={styles.label}>Photos</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={() => attachRepairPhoto(true)}
                disabled={picking}
                style={[styles.secondaryButton, { flex: 1, marginTop: 0, opacity: picking ? 0.6 : 1 }]}
              >
                <Text style={styles.secondaryButtonText}>Camera</Text>
              </Pressable>
              <Pressable
                onPress={() => attachRepairPhoto(false)}
                disabled={picking}
                style={[styles.primaryButton, { flex: 1, marginTop: 0, opacity: picking ? 0.6 : 1 }]}
              >
                <Text style={styles.primaryButtonText}>Library</Text>
              </Pressable>
            </View>
            {picking ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>Choosing photo…</Text>
              </View>
            ) : null}
            {rPhotoUris.length > 0 ? (
              <>
                <Text style={{ color: colors.success, fontWeight: "700", marginTop: 8 }}>
                  {rPhotoUris.length} photo{rPhotoUris.length === 1 ? "" : "s"} attached
                </Text>
                <RepairPhotoStrip urls={rPhotoUris} />
              </>
            ) : (
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 8 }}>Optional repair photos</Text>
            )}
          </>
        )}

        {modal === "appliance" && (
          <>
            <Text style={styles.label}>Appliance Name *</Text>
            <TextInput style={styles.input} placeholder="e.g. HVAC System" placeholderTextColor={colors.textMuted} value={aName} onChangeText={setAName} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Brand</Text>
                <TextInput style={styles.input} placeholder="Lennox" placeholderTextColor={colors.textMuted} value={aBrand} onChangeText={setABrand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Model #</Text>
                <TextInput style={styles.input} placeholder="XC21-048" placeholderTextColor={colors.textMuted} value={aModel} onChangeText={setAModel} />
              </View>
            </View>
            <DatePickerField
              label="Install Date"
              value={aInstall}
              onChange={setAInstall}
              optional
              placeholder="Select date"
            />
            <DatePickerField
              label="Warranty Expiration"
              value={aWarranty}
              onChange={setAWarranty}
              optional
              placeholder="Select date"
            />
            <Text style={styles.label}>Condition</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {(["Excellent", "Good", "Fair", "Poor", "Replace Soon"] as const).map((c) => (
                <Pressable key={c} style={[styles.chip, aCondition === c && styles.chipActive]} onPress={() => setACondition(c)}>
                  <Text style={aCondition === c ? styles.chipTextActive : styles.chipText}>{c}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>Appliance Photo (optional)</Text>
            {aPhotoUri ? (
              <>
                <Image
                  source={{ uri: aPhotoUri }}
                  style={{ width: "100%", height: 160, borderRadius: 12, marginBottom: 10, backgroundColor: colors.bgSection }}
                  resizeMode="cover"
                />
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable
                    onPress={() => attachAppliancePhoto(false)}
                    disabled={picking}
                    style={[styles.secondaryButton, { flex: 1, marginTop: 0, opacity: picking ? 0.6 : 1 }]}
                  >
                    <Text style={styles.secondaryButtonText}>Replace</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setAPhotoUri(null)}
                    disabled={picking || isSaving}
                    style={[styles.secondaryButton, { flex: 1, marginTop: 0, borderColor: colors.danger }]}
                  >
                    <Text style={[styles.secondaryButtonText, { color: colors.danger }]}>Remove</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <View style={{ flexDirection: "row", gap: 8 }}>
                {Platform.OS !== "web" ? (
                  <Pressable
                    onPress={() => attachAppliancePhoto(true)}
                    disabled={picking}
                    style={[styles.secondaryButton, { flex: 1, marginTop: 0, opacity: picking ? 0.6 : 1 }]}
                  >
                    <Text style={styles.secondaryButtonText}>Camera</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => attachAppliancePhoto(false)}
                  disabled={picking}
                  style={[styles.primaryButton, { flex: 1, marginTop: 0, opacity: picking ? 0.6 : 1 }]}
                >
                  <Text style={styles.primaryButtonText}>
                    {Platform.OS === "web" ? "Choose Photo" : "Library"}
                  </Text>
                </Pressable>
              </View>
            )}
          </>
        )}

        {modal === "paint" && (
          <>
            <Text style={styles.label}>Room *</Text>
            <TextInput style={styles.input} placeholder="Living Room" placeholderTextColor={colors.textMuted} value={pRoom} onChangeText={setPRoom} />
            <Text style={styles.label}>Color Name</Text>
            <TextInput style={styles.input} placeholder="Accessible Beige" placeholderTextColor={colors.textMuted} value={pName} onChangeText={setPName} />
            <Text style={styles.label}>Finish</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {PAINT_FINISHES.map((f) => (
                <Pressable key={f} style={pFinish === f ? styles.chipActive : styles.chip} onPress={() => setPFinish(f)}>
                  <Text style={pFinish === f ? styles.chipTextActive : styles.chipText}>{f}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <DatePickerField
              label="Purchase Date"
              value={pDate}
              onChange={setPDate}
              optional
              placeholder="Select date"
            />
          </>
        )}

        {modal === "contractor" && (
          <>
            <Text style={styles.label}>Name *</Text>
            <TextInput style={styles.input} placeholder="Company name" placeholderTextColor={colors.textMuted} value={cName} onChangeText={setCName} />
            <Text style={styles.label}>Trade</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {TRADES.map((t) => (
                <Pressable key={t} style={cTrade === t ? styles.chipActive : styles.chip} onPress={() => setCTrade(t)}>
                  <Text style={cTrade === t ? styles.chipTextActive : styles.chipText}>{t}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={styles.label}>Phone</Text>
            <TextInput style={styles.input} placeholder="555-555-5555" placeholderTextColor={colors.textMuted} value={cPhone} onChangeText={setCPhone} keyboardType="phone-pad" />
            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} placeholder="email@company.com" placeholderTextColor={colors.textMuted} value={cEmail} onChangeText={setCEmail} keyboardType="email-address" autoCapitalize="none" />
            <Text style={styles.label}>Notes</Text>
            <TextInput style={[styles.input, styles.textArea]} placeholder="Notes…" placeholderTextColor={colors.textMuted} value={cNotes} onChangeText={setCNotes} multiline />
          </>
        )}

        {modal === "document" && (
          <>
            <Text style={styles.label}>Document Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Roof Warranty"
              placeholderTextColor={colors.textMuted}
              value={docForm.title}
              onChangeText={(v) => setDocForm((f) => ({ ...f, title: v }))}
              editable={!isSaving}
            />
            <Text style={styles.label}>File name</Text>
            <View
              style={[
                styles.input,
                {
                  backgroundColor: colors.bgSection,
                  justifyContent: "center",
                  minHeight: 44,
                },
              ]}
            >
              <Text style={{ color: pickedFileName || docForm.fileName ? colors.textPrimary : colors.textMuted, fontSize: 14 }}>
                {pickedFileName || docForm.fileName || "No file selected"}
              </Text>
            </View>
            <Text style={styles.label}>Category</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {DOC_CATEGORIES.map((c) => (
                <Pressable
                  key={c.value}
                  style={[styles.chip, docForm.category === c.value && styles.chipActive]}
                  onPress={() => setDocForm((f) => ({ ...f, category: c.value }))}
                >
                  <Text style={docForm.category === c.value ? styles.chipTextActive : styles.chipText}>{c.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Policy #, coverage details, etc."
              placeholderTextColor={colors.textMuted}
              value={docForm.notes}
              onChangeText={(v) => setDocForm((f) => ({ ...f, notes: v }))}
              multiline
            />
            <DatePickerField
              label="Expiration Date"
              value={docForm.expiresDate ?? ""}
              onChange={(iso) => setDocForm((f) => ({ ...f, expiresDate: iso }))}
              optional
              placeholder="Select date"
            />
            {editingId ? (
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 8 }}>
                {docForm.fileUri ? "Current file stays attached — no re-upload needed." : "No file attached."}
              </Text>
            ) : (
              <>
            <Text style={styles.label}>Attach File *</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={() => attachDocument(() => pickDocumentForUpload())}
                disabled={picking}
                style={[styles.secondaryButton, { flex: 1, marginTop: 0 }]}
              >
                <Text style={styles.secondaryButtonText}>Document</Text>
              </Pressable>
              <Pressable
                onPress={() => attachDocument(() => pickImageForUpload())}
                disabled={picking}
                style={[styles.secondaryButton, { flex: 1, marginTop: 0 }]}
              >
                <Text style={styles.secondaryButtonText}>Photo</Text>
              </Pressable>
            </View>
            {!pickedFileName ? (
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 8 }}>Please choose a file first</Text>
            ) : null}
              </>
            )}
          </>
        )}

        {modal === "photo" && (
          <>
            {!pendingPhotoUri ? (
              <>
                <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 12 }}>
                  {Platform.OS === "web"
                    ? "Choose a photo from your device, then tap Save Photo."
                    : "Take a photo or choose from your library, then tap Save."}
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {Platform.OS !== "web" ? (
                    <Pressable
                      onPress={() => attachPhoto(true)}
                      disabled={picking}
                      style={[styles.secondaryButton, { flex: 1, marginTop: 0, opacity: picking ? 0.6 : 1 }]}
                    >
                      <Text style={styles.secondaryButtonText}>Camera</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={() => attachPhoto(false)}
                    disabled={picking}
                    style={[styles.primaryButton, { flex: 1, marginTop: 0, opacity: picking ? 0.6 : 1 }]}
                  >
                    <Text style={styles.primaryButtonText}>
                      {Platform.OS === "web" ? "Choose Photo" : "Library"}
                    </Text>
                  </Pressable>
                </View>
                {picking ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 }}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={{ color: colors.textMuted, fontSize: 13 }}>Opening photo picker…</Text>
                  </View>
                ) : null}
              </>
            ) : (
              <>
                <Image source={{ uri: pendingPhotoUri }} style={{ width: "100%", height: 160, borderRadius: 12, marginBottom: 12 }} resizeMode="cover" />
                {photoSavePhase === "uploading" ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      padding: 12,
                      borderRadius: 10,
                      backgroundColor: colors.bgSection,
                      marginBottom: 12,
                    }}
                  >
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "600" }}>
                      Uploading photo…
                    </Text>
                  </View>
                ) : photoSavePhase === "saved" ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      padding: 12,
                      borderRadius: 10,
                      backgroundColor: colors.successBg,
                      marginBottom: 12,
                    }}
                  >
                    <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                    <Text style={{ color: colors.success, fontSize: 14, fontWeight: "700" }}>Photo saved</Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.label}>Caption</Text>
                    <TextInput style={styles.input} placeholder="Optional caption" placeholderTextColor={colors.textMuted} value={photoCaption} onChangeText={setPhotoCaption} />
                    <Text style={styles.label}>Category</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                      {PHOTO_CATEGORIES.map((c) => (
                        <Pressable key={c} style={photoCategory === c ? styles.chipActive : styles.chip} onPress={() => setPhotoCategory(c)}>
                          <Text style={photoCategory === c ? styles.chipTextActive : styles.chipText}>{c}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </>
                )}
              </>
            )}
          </>
        )}

        {modal === "photo" && !pendingPhotoUri ? null : modal === "photo" ? (
          photoSavePhase === "saved" ? null : (
            <Pressable
              style={[styles.primaryButton, (isSaving || picking || photoSavePhase === "uploading") && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={isSaving || picking || photoSavePhase === "uploading"}
            >
              {isSaving || photoSavePhase === "uploading" ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Save Photo</Text>
              )}
            </Pressable>
          )
        ) : (
          <Pressable
            style={[styles.primaryButton, (isSaving || picking) && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={isSaving || picking}
          >
            {isSaving ? <ActivityIndicator color="#fff" /> : (
              <Text style={styles.primaryButtonText}>{editingId ? "Save Changes" : "Save"}</Text>
            )}
          </Pressable>
        )}
        <Pressable
          style={styles.ghostButton}
          onPress={() => !isSaving && photoSavePhase !== "uploading" && setModal(null)}
          disabled={isSaving || photoSavePhase === "uploading"}
        >
          <Text style={styles.ghostButtonText}>Cancel</Text>
        </Pressable>
        <View style={{ height: 20 }} />
      </KeyboardModal>

      <DocumentViewerModal
        visible={viewDocument !== null}
        document={viewDocument}
        onClose={() => setViewDocument(null)}
        onDelete={deleteDocument}
        onEdit={viewDocument ? () => openEditDocument(viewDocument) : undefined}
      />

      <ContractorViewerModal
        visible={viewContractor !== null}
        contractor={viewContractor}
        onClose={() => setViewContractor(null)}
        onDelete={deleteContractor}
        onEdit={viewContractor ? () => openEditContractor(viewContractor) : undefined}
      />

      <RepairDetailModal
        visible={viewRepair !== null}
        repair={viewRepair}
        onClose={() => setViewRepair(null)}
        onEdit={openEditRepair}
        onDelete={deleteRepair}
        onDeletePhoto={handleDeleteRepairPhoto}
      />

      <MaintenanceDetailModal
        visible={viewMaintenance !== null}
        item={viewMaintenance}
        onClose={() => setViewMaintenance(null)}
        onEdit={openEditMaintenance}
        onComplete={async (id) => completeMaintenanceItem(id)}
        onDelete={deleteMaintenanceItem}
      />
    </Screen>
  );
}
