import { supabase } from "@/lib/supabase";
import type { Document } from "@/data/demoData";
import { rowToDocument } from "@/types/database";

type VaultTable = "documents" | "receipts" | "warranties";

function tableForCategory(category: Document["category"]): VaultTable {
  if (category === "receipt") return "receipts";
  if (category === "warranty") return "warranties";
  return "documents";
}

function docToRow(userId: string, doc: Document) {
  const base = {
    id: doc.id,
    user_id: userId,
    property_id: doc.propertyId,
    title: doc.title,
    file_url: doc.fileUri ?? null,
    file_type: doc.fileType,
    file_size: doc.fileSize,
    upload_date: doc.uploadDate,
    notes: doc.notes,
    tags: doc.tags,
  };

  if (doc.category === "warranty") {
    return { ...base, expires_date: doc.expiresDate ?? null };
  }
  if (doc.category !== "receipt") {
    return { ...base, category: doc.category, expires_date: doc.expiresDate ?? null };
  }
  return base;
}

export async function fetchAllVaultDocuments(userId: string): Promise<Document[]> {
  const [docsRes, receiptsRes, warrantiesRes] = await Promise.all([
    supabase.from("documents").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("receipts").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("warranties").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
  ]);

  if (docsRes.error) throw new Error(docsRes.error.message);
  if (receiptsRes.error) throw new Error(receiptsRes.error.message);
  if (warrantiesRes.error) throw new Error(warrantiesRes.error.message);

  const docs = (docsRes.data ?? []).map((r) => rowToDocument(r));
  const receipts = (receiptsRes.data ?? []).map((r) => rowToDocument(r, "receipt"));
  const warranties = (warrantiesRes.data ?? []).map((r) => rowToDocument(r, "warranty"));

  return [...docs, ...receipts, ...warranties].sort((a, b) =>
    (b.uploadDate || "").localeCompare(a.uploadDate || "")
  );
}

export async function createVaultDocument(userId: string, doc: Document): Promise<Document> {
  const table = tableForCategory(doc.category);
  const { data, error } = await supabase
    .from(table)
    .insert(docToRow(userId, doc))
    .select()
    .single();

  if (error) throw new Error(error.message);

  if (table === "receipts") return rowToDocument(data, "receipt");
  if (table === "warranties") return rowToDocument(data, "warranty");
  return rowToDocument(data);
}

export async function updateVaultDocument(userId: string, doc: Document) {
  const table = tableForCategory(doc.category);
  const { error } = await supabase
    .from(table)
    .update(docToRow(userId, doc))
    .eq("id", doc.id)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

export async function deleteVaultDocument(userId: string, doc: Document) {
  const table = tableForCategory(doc.category);
  const { error } = await supabase.from(table).delete().eq("id", doc.id).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function fetchPhotos(userId: string) {
  const { data, error } = await supabase
    .from("photos")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => ({
    id: r.id as string,
    propertyId: r.property_id as string,
    uri: r.file_url as string,
    caption: (r.caption as string) ?? "",
    date: (r.date as string) ?? "",
    category: (r.category as string) ?? "general",
  }));
}

export async function createPhoto(
  userId: string,
  photo: { id: string; propertyId: string; uri: string; caption: string; date: string; category: string }
) {
  const { data, error } = await supabase
    .from("photos")
    .insert({
      id: photo.id,
      user_id: userId,
      property_id: photo.propertyId,
      file_url: photo.uri,
      caption: photo.caption,
      date: photo.date,
      category: photo.category,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return {
    id: data.id as string,
    propertyId: data.property_id as string,
    uri: data.file_url as string,
    caption: data.caption as string,
    date: data.date as string,
    category: data.category as string,
  };
}

export async function deletePhoto(userId: string, id: string) {
  const { error } = await supabase.from("photos").delete().eq("id", id).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function fetchContractors(userId: string) {
  const { data, error } = await supabase
    .from("contractors")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    propertyId: (r.property_id as string) ?? undefined,
    name: r.name as string,
    trade: (r.trade as string) ?? "",
    phone: (r.phone as string) ?? "",
    email: (r.email as string) ?? "",
    website: (r.website as string) ?? "",
    rating: (r.rating as number) ?? 5,
    notes: (r.notes as string) ?? "",
    lastUsed: (r.last_used as string) ?? "",
    licenseNumber: (r.license_number as string) ?? "",
  }));
}

export async function createContractor(userId: string, c: Record<string, unknown>) {
  const { data, error } = await supabase
    .from("contractors")
    .insert({
      id: c.id,
      user_id: userId,
      property_id: c.propertyId ?? null,
      name: c.name,
      trade: c.trade ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
      website: c.website ?? "",
      rating: c.rating ?? 5,
      notes: c.notes ?? "",
      last_used: c.lastUsed ?? "",
      license_number: c.licenseNumber ?? "",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateContractor(userId: string, id: string, updates: Record<string, unknown>) {
  const row: Record<string, unknown> = {};
  if (updates.name !== undefined) row.name = updates.name;
  if (updates.trade !== undefined) row.trade = updates.trade;
  if (updates.phone !== undefined) row.phone = updates.phone;
  if (updates.email !== undefined) row.email = updates.email;
  if (updates.website !== undefined) row.website = updates.website;
  if (updates.rating !== undefined) row.rating = updates.rating;
  if (updates.notes !== undefined) row.notes = updates.notes;
  if (updates.lastUsed !== undefined) row.last_used = updates.lastUsed;
  if (updates.licenseNumber !== undefined) row.license_number = updates.licenseNumber;

  const { error } = await supabase.from("contractors").update(row).eq("id", id).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function deleteContractor(userId: string, id: string) {
  const { error } = await supabase.from("contractors").delete().eq("id", id).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function fetchPaintColors(userId: string) {
  const { data, error } = await supabase
    .from("paint_colors")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => ({
    id: r.id as string,
    propertyId: r.property_id as string,
    room: r.room as string,
    brand: (r.brand as string) ?? "",
    colorName: (r.color_name as string) ?? "",
    colorCode: (r.color_code as string) ?? "",
    finish: (r.finish as string) ?? "",
    hex: (r.hex as string) ?? "",
    purchaseDate: (r.purchase_date as string) ?? "",
    notes: (r.notes as string) ?? "",
  }));
}

export async function createPaintColor(userId: string, p: Record<string, unknown>) {
  const { data, error } = await supabase
    .from("paint_colors")
    .insert({
      id: p.id,
      user_id: userId,
      property_id: p.propertyId,
      room: p.room,
      brand: p.brand ?? "",
      color_name: p.colorName ?? "",
      color_code: p.colorCode ?? "",
      finish: p.finish ?? "",
      hex: p.hex ?? "",
      purchase_date: p.purchaseDate ?? "",
      notes: p.notes ?? "",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deletePaintColor(userId: string, id: string) {
  const { error } = await supabase.from("paint_colors").delete().eq("id", id).eq("user_id", userId);
  if (error) throw new Error(error.message);
}
