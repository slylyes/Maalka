import { DressesClient } from "@/app/dashboard/dresses/ui";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DressesPage() {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("dresses")
    .select(
      "id, reference, name, category, price, discount_amount, size, status, notes, created_at, dress_photos(storage_path,is_primary,created_at)"
    )
    .order("created_at", { ascending: false });

  const withPhotoUrl = await Promise.all(
    (data ?? []).map(async (dress) => {
      const photos = dress.dress_photos ?? [];
      const primary = photos.find((photo) => photo.is_primary) ?? photos[0] ?? null;

      let primaryPhotoUrl: string | null = null;
      if (primary?.storage_path) {
        const { data: signedData } = await supabase.storage
          .from("dresses")
          .createSignedUrl(primary.storage_path, 3600);
        primaryPhotoUrl = signedData?.signedUrl ?? null;
      }

      return {
        id: dress.id,
        reference: dress.reference,
        name: dress.name,
        category: dress.category,
        price: Math.max(Number(dress.price) - Number(dress.discount_amount ?? 0), 0),
        base_price: Number(dress.price),
        discount_amount: Number(dress.discount_amount ?? 0),
        size: dress.size,
        status: dress.status,
        notes: dress.notes,
        primary_photo_url: primaryPhotoUrl,
      };
    })
  );

  return <DressesClient initialDresses={withPhotoUrl} />;
}
