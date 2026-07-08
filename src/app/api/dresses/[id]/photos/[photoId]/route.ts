import { NextResponse } from "next/server";

import { badRequest, requireAuthenticatedUser, serverErrorFrom } from "@/lib/api/auth";

type Params = { params: Promise<{ id: string; photoId: string }> };

async function getPhoto(
  supabase: Awaited<ReturnType<typeof requireAuthenticatedUser>>["supabase"],
  dressId: string,
  photoId: string
) {
  const { data, error } = await supabase
    .from("dress_photos")
    .select("id, dress_id, storage_path, is_primary")
    .eq("id", photoId)
    .eq("dress_id", dressId)
    .single();

  if (error || !data) return null;
  return data;
}

// Définir la photo comme principale
export async function PATCH(_: Request, { params }: Params) {
  const { id: dressId, photoId } = await params;
  const { supabase, unauthorizedResponse } = await requireAuthenticatedUser();
  if (unauthorizedResponse) return unauthorizedResponse;

  const photo = await getPhoto(supabase, dressId, photoId);
  if (!photo) return badRequest("Photo introuvable pour cette robe.");

  const { error: clearError } = await supabase
    .from("dress_photos")
    .update({ is_primary: false })
    .eq("dress_id", dressId);

  if (clearError) return serverErrorFrom(clearError.message);

  const { error: setError } = await supabase
    .from("dress_photos")
    .update({ is_primary: true })
    .eq("id", photoId);

  if (setError) return serverErrorFrom(setError.message);

  return NextResponse.json({ success: true });
}

// Supprimer la photo (fichier storage + ligne en base)
export async function DELETE(_: Request, { params }: Params) {
  const { id: dressId, photoId } = await params;
  const { supabase, unauthorizedResponse } = await requireAuthenticatedUser();
  if (unauthorizedResponse) return unauthorizedResponse;

  const photo = await getPhoto(supabase, dressId, photoId);
  if (!photo) return badRequest("Photo introuvable pour cette robe.");

  const { error: deleteError } = await supabase.from("dress_photos").delete().eq("id", photoId);
  if (deleteError) return serverErrorFrom(deleteError.message);

  // Suppression du fichier storage en dernier : si elle échoue, on garde au pire
  // un fichier orphelin (sans conséquence), jamais une ligne sans fichier.
  if (photo.storage_path) {
    await supabase.storage.from("dresses").remove([photo.storage_path]);
  }

  return NextResponse.json({ success: true });
}
