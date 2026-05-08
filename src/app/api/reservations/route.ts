import { NextResponse } from "next/server";

import { badRequest, requireAuthenticatedUser, serverErrorFrom } from "@/lib/api/auth";

const allowedCautionStatuses = new Set(["pending", "received", "not_required"]);

function formatContractNumber(reference: string, date: Date, suffix: number) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  const normalizedRef = reference.replace(/\s+/g, "").toUpperCase();
  const base = `${normalizedRef}-${dd}${mm}${yyyy}`;
  return suffix <= 0 ? base : `${base}-${suffix + 1}`;
}

function parseStartDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

const blockingStatuses = ["reserved", "rented", "preparing"] as const;

async function syncDressAvailability(
  supabase: Awaited<ReturnType<typeof requireAuthenticatedUser>>["supabase"],
  dressId: string
) {
  const today = new Date().toISOString().slice(0, 10);

  const { count, error: countError } = await supabase
    .from("reservations")
    .select("id", { head: true, count: "exact" })
    .eq("dress_id", dressId)
    .in("status", [...blockingStatuses])
    .lte("start_date", today)
    .gte("end_date", today);

  if (countError) {
    return { error: countError.message };
  }

  const nextStatus = (count ?? 0) > 0 ? "reserved" : "available";
  const { error: updateError } = await supabase
    .from("dresses")
    .update({ status: nextStatus })
    .eq("id", dressId)
    .in("status", ["available", "reserved"]);

  if (updateError) {
    return { error: updateError.message };
  }

  return { error: null };
}

export async function GET() {
  const { supabase, unauthorizedResponse } = await requireAuthenticatedUser();
  if (unauthorizedResponse) return unauthorizedResponse;

  const { data, error } = await supabase
    .from("reservations")
    .select(
      "id, contract_number, dress_id, client_id, start_date, end_date, status, total_price, deposit_paid, balance_due, caution_amount, caution_status, pickup_datetime, return_datetime, notes, created_at, updated_at, dresses(reference,name), clients(first_name,last_name,phone,email)"
    )
    .order("created_at", { ascending: false });

  if (error) return serverErrorFrom(error.message);
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const { supabase, user, unauthorizedResponse } = await requireAuthenticatedUser();
  if (unauthorizedResponse || !user) return unauthorizedResponse;

  const payload = await request.json().catch(() => null);

  if (!payload?.dress_id || typeof payload.dress_id !== "string") {
    return badRequest("La robe est obligatoire.");
  }

  if (!payload?.client_id || typeof payload.client_id !== "string") {
    return badRequest("Le client est obligatoire.");
  }

  if (!payload?.start_date || typeof payload.start_date !== "string") {
    return badRequest("La date de début est obligatoire.");
  }

  if (!payload?.end_date || typeof payload.end_date !== "string") {
    return badRequest("La date de fin est obligatoire.");
  }

  if (
    payload.caution_status &&
    (typeof payload.caution_status !== "string" || !allowedCautionStatuses.has(payload.caution_status))
  ) {
    return badRequest("Le statut de caution doit être: en attente, reçue, ou pas de caution.");
  }

  const { data: dressData, error: dressError } = await supabase
    .from("dresses")
    .select("price, discount_amount, reference")
    .eq("id", payload.dress_id)
    .single();

  if (dressError || !dressData) {
    return badRequest("Robe introuvable. Merci de sélectionner une robe valide.");
  }

  const startDate = parseStartDate(payload.start_date);
  const firstContractNumber = formatContractNumber(dressData.reference, startDate, 0);
  const discountedPrice = Math.max(
    Number(dressData.price) - Number(dressData.discount_amount ?? 0),
    0
  );

  const { count: existingCount } = await supabase
    .from("reservations")
    .select("id", { head: true, count: "exact" })
    .ilike("contract_number", `${firstContractNumber}%`);

  const contractNumber = formatContractNumber(dressData.reference, startDate, existingCount ?? 0);

  const insertPayload = {
    contract_number: contractNumber,
    dress_id: payload.dress_id,
    client_id: payload.client_id,
    start_date: payload.start_date,
    end_date: payload.end_date,
    status: "reserved",
    total_price: discountedPrice,
    deposit_paid:
      typeof payload.deposit_paid === "number" && payload.deposit_paid >= 0
        ? payload.deposit_paid
        : 0,
    caution_amount:
      typeof payload.caution_amount === "number" && payload.caution_amount >= 0
        ? payload.caution_amount
        : 0,
    caution_status:
      typeof payload.caution_status === "string" ? payload.caution_status : "pending",
    pickup_datetime:
      typeof payload.pickup_datetime === "string" ? payload.pickup_datetime : null,
    return_datetime:
      typeof payload.return_datetime === "string" ? payload.return_datetime : null,
    notes: typeof payload.notes === "string" ? payload.notes : null,
    created_by: user.id,
  };

  const { data, error } = await supabase
    .from("reservations")
    .insert(insertPayload)
    .select(
      "id, contract_number, dress_id, client_id, start_date, end_date, status, total_price, deposit_paid, balance_due, caution_amount, caution_status, pickup_datetime, return_datetime, notes, created_at, updated_at"
    )
    .single();

  if (error) return serverErrorFrom(error.message);

  const syncResult = await syncDressAvailability(supabase, payload.dress_id);
  if (syncResult.error) return serverErrorFrom(syncResult.error);

  return NextResponse.json({ data }, { status: 201 });
}
