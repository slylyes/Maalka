import { NextResponse } from "next/server";

import { requireAuthenticatedUser, serverError } from "@/lib/api/auth";

function normalizeRelation<T>(value: T[] | T | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function GET() {
  const { supabase, unauthorizedResponse } = await requireAuthenticatedUser();
  if (unauthorizedResponse) return unauthorizedResponse;

  const today = new Date().toISOString().slice(0, 10);

  const [pickupsRes, returnsRes] = await Promise.all([
    supabase
      .from("reservations")
      .select(
        "id, contract_number, start_date, status, total_price, balance_due, dresses(reference,name), clients(first_name,last_name,phone)"
      )
      .eq("start_date", today)
      .in("status", ["reserved", "preparing", "rented"])
      .order("start_date", { ascending: true }),
    supabase
      .from("reservations")
      .select(
        "id, contract_number, end_date, status, total_price, balance_due, dresses(reference,name), clients(first_name,last_name,phone)"
      )
      .eq("end_date", today)
      .in("status", ["reserved", "preparing", "rented"])
      .order("end_date", { ascending: true }),
  ]);

  if (pickupsRes.error) return serverError(pickupsRes.error.message);
  if (returnsRes.error) return serverError(returnsRes.error.message);

  const pickups = (pickupsRes.data ?? []).map((item) => ({
    ...item,
    dresses: normalizeRelation(item.dresses),
    clients: normalizeRelation(item.clients),
  }));

  const returns = (returnsRes.data ?? []).map((item) => ({
    ...item,
    dresses: normalizeRelation(item.dresses),
    clients: normalizeRelation(item.clients),
  }));

  return NextResponse.json({
    date: today,
    pickups,
    returns,
  });
}
