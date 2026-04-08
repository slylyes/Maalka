import { ReservationsClient } from "@/app/dashboard/reservations/ui";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ReservationsPage() {
  const supabase = await createSupabaseServerClient();

  const [reservationsRes, dressesRes, clientsRes] = await Promise.all([
    supabase
      .from("reservations")
      .select(
        "id, contract_number, dress_id, client_id, start_date, end_date, status, total_price, deposit_paid, balance_due, caution_amount, caution_status, dresses(reference,name), clients(first_name,last_name,phone)"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("dresses")
      .select("id, reference, name, status, price")
      .order("created_at", { ascending: false }),
    supabase
      .from("clients")
      .select("id, first_name, last_name, phone")
      .order("created_at", { ascending: false }),
  ]);

  const normalizedReservations = (reservationsRes.data ?? []).map((reservation) => ({
    ...reservation,
    dresses: Array.isArray(reservation.dresses) ? reservation.dresses[0] ?? null : reservation.dresses,
    clients: Array.isArray(reservation.clients) ? reservation.clients[0] ?? null : reservation.clients,
  }));

  return (
    <ReservationsClient
      initialReservations={normalizedReservations}
      initialDresses={dressesRes.data ?? []}
      initialClients={clientsRes.data ?? []}
    />
  );
}
