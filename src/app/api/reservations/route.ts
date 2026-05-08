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

  const dressIdsFromPayload = Array.isArray(payload?.dress_ids)
    ? payload.dress_ids.filter((value: unknown) => typeof value === "string")
    : [];
  const dressIdFromPayload = typeof payload?.dress_id === "string" ? [payload.dress_id] : [];
  const uniqueDressIds = Array.from(new Set([...dressIdsFromPayload, ...dressIdFromPayload]));

  if (uniqueDressIds.length === 0) {
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

  const startDate = parseStartDate(payload.start_date);
  const { data: dressRows, error: dressError } = await supabase
    .from("dresses")
    .select("id, price, discount_amount, reference")
    .in("id", uniqueDressIds);

  if (dressError || !dressRows || dressRows.length === 0) {
    return badRequest("Robe introuvable. Merci de sélectionner une robe valide.");
  }

  if (dressRows.length !== uniqueDressIds.length) {
    return badRequest("Certaines robes sélectionnées sont introuvables.");
  }

  const depositPaid =
    typeof payload.deposit_paid === "number" && payload.deposit_paid >= 0
      ? payload.deposit_paid
      : 0;
  const cautionAmount =
    typeof payload.caution_amount === "number" && payload.caution_amount >= 0
      ? payload.caution_amount
      : 0;
  const cautionStatus = typeof payload.caution_status === "string" ? payload.caution_status : "pending";
  const pickupDatetime = typeof payload.pickup_datetime === "string" ? payload.pickup_datetime : null;
  const returnDatetime = typeof payload.return_datetime === "string" ? payload.return_datetime : null;
  const notes = typeof payload.notes === "string" ? payload.notes : null;

  const uniqueReferences = Array.from(new Set(dressRows.map((dress) => dress.reference)));
  const countsByReference = new Map<string, number>();

  try {
    await Promise.all(
      uniqueReferences.map(async (reference) => {
        const firstContractNumber = formatContractNumber(reference, startDate, 0);
        const { count, error } = await supabase
          .from("reservations")
          .select("id", { head: true, count: "exact" })
          .ilike("contract_number", `${firstContractNumber}%`);
        if (error) {
          throw new Error(error.message);
        }
        countsByReference.set(reference, count ?? 0);
      })
    );
  } catch (error) {
    if (error instanceof Error) {
      return serverErrorFrom(error.message);
    }
    return serverErrorFrom("Erreur lors de la génération des numéros de contrat.");
  }

  const referenceOffsets = new Map<string, number>();
  for (const dress of dressRows) {
    const discountedPrice = Math.max(
      Number(dress.price) - Number(dress.discount_amount ?? 0),
      0
    );

    if (depositPaid > discountedPrice) {
      return badRequest("L'acompte dépasse le prix total pour au moins une robe.");
    }
  }

  const insertPayloads = dressRows.map((dress) => {
    const discountedPrice = Math.max(
      Number(dress.price) - Number(dress.discount_amount ?? 0),
      0
    );

    const existingCount = countsByReference.get(dress.reference) ?? 0;
    const offset = referenceOffsets.get(dress.reference) ?? 0;
    const contractNumber = formatContractNumber(dress.reference, startDate, existingCount + offset);
    referenceOffsets.set(dress.reference, offset + 1);

    return {
      contract_number: contractNumber,
      dress_id: dress.id,
      client_id: payload.client_id,
      start_date: payload.start_date,
      end_date: payload.end_date,
      status: "reserved",
      total_price: discountedPrice,
      deposit_paid: depositPaid,
      caution_amount: cautionAmount,
      caution_status: cautionStatus,
      pickup_datetime: pickupDatetime,
      return_datetime: returnDatetime,
      notes,
      created_by: user.id,
    };
  });

  const { data: insertedData, error } = await supabase
    .from("reservations")
    .insert(insertPayloads)
    .select(
      "id, contract_number, dress_id, client_id, start_date, end_date, status, total_price, deposit_paid, balance_due, caution_amount, caution_status, pickup_datetime, return_datetime, notes, created_at, updated_at"
    );

  if (error) return serverErrorFrom(error.message);

  const syncResults = await Promise.all(
    uniqueDressIds.map((dressId) => syncDressAvailability(supabase, dressId))
  );
  const syncError = syncResults.find((result) => result.error)?.error;
  if (syncError) return serverErrorFrom(syncError);

  return NextResponse.json({ data: insertedData }, { status: 201 });
}
