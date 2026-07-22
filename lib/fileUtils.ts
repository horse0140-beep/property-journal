import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Alert, Platform } from "react-native";

const PHOTO_DIR = `${FileSystem.documentDirectory ?? ""}homewise/photos/`;
const DOC_DIR = `${FileSystem.documentDirectory ?? ""}homewise/documents/`;

function canUseLocalFs(): boolean {
  return Platform.OS !== "web" && Boolean(FileSystem.documentDirectory);
}

async function ensureDir(dir: string) {
  if (!canUseLocalFs() || !dir) return;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
}

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
  allowsEditing?: boolean;
}): Promise<PickedImage[] | null> {
  if (Platform.OS !== "web") {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Property Journal needs access to your photo library to attach images. Please enable it in Settings.",
        [{ text: "OK" }]
      );
      return null;
    }
  }

  const allowsMultiple = options?.allowsMultiple ?? false;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: allowsMultiple ? false : (options?.allowsEditing ?? false),
    allowsMultipleSelection: allowsMultiple,
    quality: options?.quality ?? 0.8,
    exif: false,
  });

  if (result.canceled || !result.assets.length) return null;

  const saved: PickedImage[] = [];
  for (const asset of result.assets) {
    if (!canUseLocalFs()) {
      // Web: keep blob:/https: URI from the picker — do not FileSystem.copyAsync.
      saved.push({
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        fileSize: asset.fileSize,
        mimeType: asset.mimeType ?? "image/jpeg",
      });
      continue;
    }

    await ensureDir(PHOTO_DIR);
    const filename = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.jpg`;
    const dest = `${PHOTO_DIR}${filename}`;
    await FileSystem.copyAsync({ from: asset.uri, to: dest });
    saved.push({
      uri: dest,
      width: asset.width,
      height: asset.height,
      fileSize: asset.fileSize,
      mimeType: asset.mimeType ?? "image/jpeg",
    });
  }
  return saved;
}

export async function takePhoto(options?: {
  quality?: number;
  allowsEditing?: boolean;
}): Promise<PickedImage | null> {
  // Web: no reliable camera module — fall back to library / file picker.
  if (Platform.OS === "web") {
    const results = await pickImageFromLibrary({
      allowsMultiple: false,
      allowsEditing: options?.allowsEditing ?? false,
      quality: options?.quality ?? 0.85,
    });
    return results?.[0] ?? null;
  }

  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== "granted") {
    Alert.alert(
      "Camera Permission Required",
      "Property Journal needs camera access to take photos. Please enable it in Settings.",
      [{ text: "OK" }]
    );
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    allowsEditing: options?.allowsEditing ?? false,
    quality: options?.quality ?? 0.85,
    exif: false,
  });

  if (result.canceled || !result.assets.length) return null;

  const asset = result.assets[0];
  await ensureDir(PHOTO_DIR);
  const filename = `photo_${Date.now()}.jpg`;
  const dest = `${PHOTO_DIR}${filename}`;
  await FileSystem.copyAsync({ from: asset.uri, to: dest });

  return {
    uri: dest,
    width: asset.width,
    height: asset.height,
    fileSize: asset.fileSize,
    mimeType: "image/jpeg",
  };
}

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
      type: [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/*",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ],
      copyToCacheDirectory: Platform.OS !== "web",
    });

    if (result.canceled || !result.assets?.length) return null;

    const asset = result.assets[0];
    const mime = asset.mimeType ?? "application/pdf";
    let ext = "pdf";
    if (asset.name && /\.[a-zA-Z0-9]{1,5}$/.test(asset.name)) {
      ext = asset.name.split(".").pop()!.toLowerCase();
    } else if (mime.includes("pdf")) {
      ext = "pdf";
    } else if (mime.includes("png")) {
      ext = "png";
    } else if (mime.includes("jpeg") || mime.includes("jpg")) {
      ext = "jpg";
    } else if (mime.includes("webp")) {
      ext = "webp";
    } else if (mime.includes("wordprocessingml") || mime.includes("docx")) {
      ext = "docx";
    } else if (mime.includes("msword")) {
      ext = "doc";
    }

    const displayName = asset.name?.includes(".") ? asset.name : `document.${ext}`;

    if (!canUseLocalFs()) {
      // Web: use blob: / object URL from the picker directly.
      const size = asset.size ?? 0;
      return {
        uri: asset.uri,
        name: displayName,
        size,
        mimeType: mime,
        formattedSize: formatBytes(size),
      };
    }

    await ensureDir(DOC_DIR);
    const filename = `doc_${Date.now()}.${ext}`;
    const dest = `${DOC_DIR}${filename}`;
    await FileSystem.copyAsync({ from: asset.uri, to: dest });

    const destInfo = await FileSystem.getInfoAsync(dest);
    const destSize = destInfo.exists && "size" in destInfo ? destInfo.size : asset.size;
    if (!destInfo.exists || destSize === 0) {
      throw new Error(
        `Copied document is missing or empty. exists=${destInfo.exists} size=${destSize ?? "unknown"}`
      );
    }

    return {
      uri: dest,
      name: displayName,
      size: destSize ?? asset.size,
      mimeType: mime,
      formattedSize: formatBytes(destSize ?? asset.size ?? 0),
    };
  } catch (e) {
    console.warn("pickDocument error:", e);
    if (__DEV__) {
      Alert.alert(
        "File pick failed",
        e instanceof Error ? e.message : String(e)
      );
    }
    return null;
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function deleteLocalFile(uri: string) {
  if (!canUseLocalFs()) return;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // Silently ignore
  }
}

export async function fileExists(uri: string): Promise<boolean> {
  if (Platform.OS === "web") {
    if (uri.startsWith("blob:") || uri.startsWith("data:") || uri.startsWith("http")) {
      try {
        const res = await fetch(uri);
        return res.ok;
      } catch {
        return false;
      }
    }
    return false;
  }
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists;
  } catch {
    return false;
  }
}

export function isImageUri(uri: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(uri) || uri.startsWith("blob:");
}

export function isPdfUri(uri: string): boolean {
  return /\.pdf$/i.test(uri);
}
