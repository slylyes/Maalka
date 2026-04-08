import { NextResponse } from "next/server";

import { badRequest, requireAuthenticatedUser, serverErrorFrom } from "@/lib/api/auth";

type Params = { params: Promise<{ id: string }> };

const MAX_IMAGE_SIZE_BYTES = 6 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function sanitizeFilename(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9_.-]/g, "_");
}

export async function POST(request: Request, { params }: Params) {
  const { id: dressId } = await params;
  const { supabase, unauthorizedResponse } = await requireAuthenticatedUser();
  if (unauthorizedResponse) return unauthorizedResponse;

  const formData = await request.formData();
  const file = formData.get("file");
  const isPrimary = formData.get("isPrimary") === "true";

  if (!(file instanceof File)) {
    return badRequest("Merci de sélectionner une image.");
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return badRequest("Image trop volumineuse. Taille maximale autorisée: 6 Mo.");
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
    return badRequest("Format image non autorisé. Formats acceptés: JPEG, PNG, WEBP.");
  }

  const filePath = `${dressId}/${crypto.randomUUID()}-${sanitizeFilename(file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from("dresses")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });

  if (uploadError) return serverErrorFrom(uploadError.message);

  if (isPrimary) {
    const { error: clearPrimaryError } = await supabase
      .from("dress_photos")
      .update({ is_primary: false })
      .eq("dress_id", dressId);

    if (clearPrimaryError) return serverErrorFrom(clearPrimaryError.message);
  }

  const { data, error } = await supabase
    .from("dress_photos")
    .insert({
      dress_id: dressId,
      storage_path: filePath,
      is_primary: isPrimary,
    })
    .select("id, dress_id, storage_path, is_primary, created_at")
    .single();

  if (error) return serverErrorFrom(error.message);

  return NextResponse.json({ data }, { status: 201 });
}

export async function GET(_: Request, { params }: Params) {
  const { id: dressId } = await params;
  const { supabase, unauthorizedResponse } = await requireAuthenticatedUser();
  if (unauthorizedResponse) return unauthorizedResponse;

  const { data, error } = await supabase
    .from("dress_photos")
    .select("id, dress_id, storage_path, is_primary, created_at")
    .eq("dress_id", dressId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return serverErrorFrom(error.message);
  return NextResponse.json({ data });
}
