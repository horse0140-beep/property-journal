import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { Alert, Platform } from "react-native";

const PHOTO_DIR = `${FileSystem.documentDirectory}homewise/photos/`;
const DOC_DIR = `${FileSystem.documentDirectory}homewise/documents/`;

async function ensureDir(dir: string) {
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
}

// ── Photo picker ────────────────────────────────────────────────────

export type PickedImage = {
  uri: string;
  width: number;
  height: number;
  fileSize?: number;
  mimeType?: string;
};

export async function pickImageFromLibrary(options?: {
  allowsMultiple?: boolean;
  quality?: number;
}): Promise<PickedImage[] | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") {
    Alert.alert(
      "Permission Required",
      "HomeWise needs access to your photo library to attach images. Please enable it in Settings.",
      [{ text: "OK" }]
    );
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: !options?.allowsMultiple,
    allowsMultipleSelection: options?.allowsMultiple ?? false,
    quality: options?.quality ?? 0.8,
    exif: false,
  });

  if (result.canceled || !result.assets.length) return null;

  await ensureDir(PHOTO_DIR);

  const saved: PickedImage[] = [];
  for (const asset of result.assets) {
    const filename = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.jpg`;
    const dest = `${PHOTO_DIR}${filename}`;
    await FileSystem.copyAsync({ from: asset.uri, to: dest });
    saved.push({ uri: dest, width: asset.width, height: asset.height, fileSize: asset.fileSize, mimeType: asset.mimeType ?? "image/jpeg" });
  }
  return saved;
}

export async function takePhoto(options?: { quality?: number }): Promise<PickedImage | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== "granted") {
    Alert.alert(
      "Camera Permission Required",
      "HomeWise needs camera access to take photos. Please enable it in Settings.",
      [{ text: "OK" }]
    );
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    quality: options?.quality ?? 0.85,
    exif: false,
  });

  if (result.canceled || !result.assets.length) return null;

  const asset = result.assets[0];
  await ensureDir(PHOTO_DIR);
  const filename = `photo_${Date.now()}.jpg`;
  const dest = `${PHOTO_DIR}${filename}`;
  await FileSystem.copyAsync({ from: asset.uri, to: dest });

  return { uri: dest, width: asset.width, height: asset.height, fileSize: asset.fileSize, mimeType: "image/jpeg" };
}

// ── Document picker ─────────────────────────────────────────────────

export type PickedDocument = {
  uri: string;
  name: string;
  size?: number;
  mimeType?: string;
  formattedSize: string;
};

export async function pickDocument(): Promise<PickedDocument | null> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*", "application/msword",
             "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.length) return null;

    const asset = result.assets[0];
    await ensureDir(DOC_DIR);

    const ext = asset.name.split(".").pop() ?? "pdf";
    const filename = `doc_${Date.now()}.${ext}`;
    const dest = `${DOC_DIR}${filename}`;
    await FileSystem.copyAsync({ from: asset.uri, to: dest });

    return {
      uri: dest,
      name: asset.name,
      size: asset.size,
      mimeType: asset.mimeType ?? "application/pdf",
      formattedSize: formatBytes(asset.size ?? 0),
    };
  } catch {
    return null;
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── File management ─────────────────────────────────────────────────

export async function deleteLocalFile(uri: string) {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // Silently ignore
  }
}

export async function fileExists(uri: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists;
  } catch {
    return false;
  }
}

export function isImageUri(uri: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(uri);
}

export function isPdfUri(uri: string): boolean {
  return /\.pdf$/i.test(uri);
}
