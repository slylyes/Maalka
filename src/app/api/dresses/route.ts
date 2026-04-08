import { NextResponse } from "next/server";

import { badRequest, requireAuthenticatedUser, serverErrorFrom } from "@/lib/api/auth";

type DressPhotoRow = {
  storage_path: string;
  is_primary: boolean;
  created_at: string;
};

type DressRow = {
  id: string;
  reference: string;
  name: string | null;
  category: string;
  price: number;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  dress_photos: DressPhotoRow[] | null;
};

export async function GET() {
  const { supabase, unauthorizedResponse } = await requireAuthenticatedUser();
  if (unauthorizedResponse) return unauthorizedResponse;

  const { data, error } = await supabase
    .from("dresses")
    .select(
      "id, reference, name, category, price, status, notes, created_at, updated_at, dress_photos(storage_path,is_primary,created_at)"
    )
    .order("created_at", { ascending: false });

  if (error) return serverErrorFrom(error.message);

  const mapped = await Promise.all(
    ((data ?? []) as DressRow[]).map(async (dress) => {
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
        price: dress.price,
        status: dress.status,
        notes: dress.notes,
        created_at: dress.created_at,
        updated_at: dress.updated_at,
        primary_photo_url: primaryPhotoUrl,
      };
    })
  );

  return NextResponse.json({ data: mapped });
}

export async function POST(request: Request) {
  const { supabase, user, unauthorizedResponse } = await requireAuthenticatedUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse;

  const payload = await request.json().catch(() => null);

  if (!payload?.reference || typeof payload.reference !== "string") {
    return badRequest("La référence de la robe est obligatoire.");
  }

  if (typeof payload.price !== "number" || payload.price < 0) {
    return badRequest("Le prix de la robe doit être un nombre positif.");
  }

  const insertPayload = {
    reference: payload.reference.trim(),
    name: typeof payload.name === "string" ? payload.name.trim() : null,
    category:
      typeof payload.category === "string" && payload.category.trim().length > 0
        ? payload.category.trim()
        : "Caftans",
    price: payload.price,
    status: typeof payload.status === "string" ? payload.status : "available",
    notes: typeof payload.notes === "string" ? payload.notes : null,
    created_by: user.id,
  };

  const { data, error } = await supabase
    .from("dresses")
    .insert(insertPayload)
    .select("id, reference, name, category, price, status, notes, created_at, updated_at")
    .single();

  if (error) return serverErrorFrom(error.message);
  return NextResponse.json({ data }, { status: 201 });
}
