import { NextResponse } from "next/server";

import { requireAuthenticatedUser, serverError } from "@/lib/api/auth";

type Params = { params: Promise<{ id: string }> };

function monthBoundaries(monthValue: string | null) {
  const now = new Date();
  const parsed = monthValue && /^\d{4}-\d{2}$/.test(monthValue) ? monthValue : null;

  const year = parsed ? Number(parsed.slice(0, 4)) : now.getFullYear();
  const monthIndex = parsed ? Number(parsed.slice(5, 7)) - 1 : now.getMonth();

  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);

  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);
  const normalizedMonth = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

  return { startDate, endDate, normalizedMonth };
}

export async function GET(request: Request, { params }: Params) {
  const { id: dressId } = await params;
  const { supabase, unauthorizedResponse } = await requireAuthenticatedUser();
  if (unauthorizedResponse) return unauthorizedResponse;

  const url = new URL(request.url);
  const month = url.searchParams.get("month");
  const { startDate, endDate, normalizedMonth } = monthBoundaries(month);

  const { data, error } = await supabase
    .from("reservation_dresses")
    .select(
      "id, start_date, end_date, status, reservations(contract_number, clients(first_name,last_name))"
    )
    .eq("dress_id", dressId)
    .lte("start_date", endDate)
    .gte("end_date", startDate)
    .order("start_date", { ascending: true });

  if (error) return serverError(error.message);

  const normalized = (data ?? []).map((item) => {
    const reservation = Array.isArray(item.reservations) ? item.reservations[0] : item.reservations;
    const client = reservation
      ? Array.isArray(reservation.clients)
        ? reservation.clients[0]
        : reservation.clients
      : null;
    return {
      id: item.id,
      contract_number: reservation?.contract_number ?? "",
      start_date: item.start_date,
      end_date: item.end_date,
      status: item.status,
      client_name: client
        ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim()
        : null,
    };
  });

  return NextResponse.json({ month: normalizedMonth, data: normalized });
}
