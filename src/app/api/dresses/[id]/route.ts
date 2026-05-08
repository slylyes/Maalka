import { NextResponse } from "next/server";

import { badRequest, requireAuthenticatedUser, serverErrorFrom } from "@/lib/api/auth";

type Params = { params: Promise<{ id: string }> };

function normalizeDressPrice(price: number, discountAmount: number | null) {
  return Math.max(Number(price) - Number(discountAmount ?? 0), 0);
}

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const { supabase, unauthorizedResponse } = await requireAuthenticatedUser();
  if (unauthorizedResponse) return unauthorizedResponse;

  const { data, error } = await supabase
    .from("dresses")
    .select("id, reference, name, category, price, discount_amount, size, status, notes, created_at, updated_at")
    .eq("id", id)
    .single();

  if (error) return serverErrorFrom(error.message);
  return NextResponse.json({
    data: {
      ...data,
      price: normalizeDressPrice(Number(data.price), Number(data.discount_amount ?? 0)),
      base_price: Number(data.price),
      discount_amount: Number(data.discount_amount ?? 0),
    },
  });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const { supabase, unauthorizedResponse } = await requireAuthenticatedUser();
  if (unauthorizedResponse) return unauthorizedResponse;

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return badRequest("Requête invalide.");
  }

  const updatePayload: Record<string, unknown> = {};

  if (typeof payload.reference === "string") updatePayload.reference = payload.reference.trim();
  if (typeof payload.name === "string") updatePayload.name = payload.name.trim();
  if (typeof payload.category === "string") updatePayload.category = payload.category.trim();
  if (typeof payload.notes === "string") updatePayload.notes = payload.notes;
  if (typeof payload.status === "string") updatePayload.status = payload.status;
  if (typeof payload.price === "number" && payload.price >= 0) updatePayload.price = payload.price;
  if (typeof payload.discount_amount === "number" && payload.discount_amount >= 0) {
    updatePayload.discount_amount = payload.discount_amount;
  }
  if (typeof payload.size === "string") {
    updatePayload.size = payload.size.trim().length > 0 ? payload.size.trim() : null;
  }

  const nextPrice =
    typeof updatePayload.price === "number" ? updatePayload.price : undefined;
  const nextDiscountAmount =
    typeof updatePayload.discount_amount === "number"
      ? updatePayload.discount_amount
      : typeof payload.discount_amount === "number"
        ? payload.discount_amount
        : undefined;

  if (typeof nextPrice === "number" && typeof nextDiscountAmount === "number" && nextDiscountAmount > nextPrice) {
    return badRequest("La remise ne peut pas dépasser le prix initial.");
  }

  if (Object.keys(updatePayload).length === 0) {
    return badRequest("Aucun champ valide à mettre à jour.");
  }

  const { data, error } = await supabase
    .from("dresses")
    .update(updatePayload)
    .eq("id", id)
    .select("id, reference, name, category, price, discount_amount, size, status, notes, created_at, updated_at")
    .single();

  if (error) return serverErrorFrom(error.message);
  return NextResponse.json({
    data: {
      ...data,
      price: normalizeDressPrice(Number(data.price), Number(data.discount_amount ?? 0)),
      base_price: Number(data.price),
      discount_amount: Number(data.discount_amount ?? 0),
    },
  });
}

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;
  const { supabase, unauthorizedResponse } = await requireAuthenticatedUser();
  if (unauthorizedResponse) return unauthorizedResponse;

  const { error } = await supabase.from("dresses").delete().eq("id", id);
  if (error) return serverErrorFrom(error.message);

  return NextResponse.json({ success: true });
}
