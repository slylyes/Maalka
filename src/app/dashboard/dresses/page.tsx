import { DressesClient } from "@/app/dashboard/dresses/ui";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DressesPage() {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("dresses")
    .select(
      "id, reference, name, category, price, size, status, notes, created_at, dress_photos(storage_path,is_primary,created_at)"
    )
    .order("created_at", { ascending: false });

  // Récupère le chemin de la photo principale de chaque robe, puis génère TOUTES
  // les URLs signées en un seul appel batch (au lieu d'un appel par robe).
  const primaryPathByDress = new Map<string, string>();
  for (const dress of data ?? []) {
    const photos = dress.dress_photos ?? [];
    const primary = photos.find((photo) => photo.is_primary) ?? photos[0] ?? null;
    if (primary?.storage_path) primaryPathByDress.set(dress.id, primary.storage_path);
  }

  const uniquePaths = Array.from(new Set(primaryPathByDress.values()));
  const signedUrlByPath = new Map<string, string>();
  if (uniquePaths.length > 0) {
    const { data: signedList } = await supabase.storage
      .from("dresses")
      .createSignedUrls(uniquePaths, 3600);
    for (const signed of signedList ?? []) {
      if (signed.path && signed.signedUrl) signedUrlByPath.set(signed.path, signed.signedUrl);
    }
  }

  const withPhotoUrl = (data ?? []).map((dress) => {
    const path = primaryPathByDress.get(dress.id);
    return {
      id: dress.id,
      reference: dress.reference,
      name: dress.name,
      category: dress.category,
      price: Number(dress.price),
      size: dress.size,
      status: dress.status,
      notes: dress.notes,
      primary_photo_url: path ? signedUrlByPath.get(path) ?? null : null,
    };
  });

  return <DressesClient initialDresses={withPhotoUrl} />;
}
