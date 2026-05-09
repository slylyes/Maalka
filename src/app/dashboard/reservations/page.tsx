import { ReservationsClient } from "@/app/dashboard/reservations/ui";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ReservationsPage() {
  const supabase = await createSupabaseServerClient();

  const [reservationsRes, dressesRes, clientsRes] = await Promise.all([
    supabase
      .from("reservations")
      .select(
        "id, contract_number, client_id, start_date, end_date, status, total_price, deposit_paid, balance_due, caution_amount, caution_status, reservation_dresses(dress_id, price, base_price, discount_amount, dresses(reference,name)), clients(first_name,last_name,phone)"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("dresses")
      .select("id, reference, name, status, price, discount_amount")
      .order("created_at", { ascending: false }),
    supabase
      .from("clients")
      .select("id, first_name, last_name, phone")
      .order("created_at", { ascending: false }),
  ]);

  const normalizedReservations = (reservationsRes.data ?? []).map((reservation) => ({
    ...reservation,
    reservation_dresses: (Array.isArray(reservation.reservation_dresses)
      ? reservation.reservation_dresses
      : reservation.reservation_dresses
        ? [reservation.reservation_dresses]
        : []
    ).map((item) => ({
      ...item,
      dresses: Array.isArray(item.dresses) ? item.dresses[0] ?? null : item.dresses,
    })),
    clients: Array.isArray(reservation.clients) ? reservation.clients[0] ?? null : reservation.clients,
  }));

  return (
    <ReservationsClient
      initialReservations={normalizedReservations}
      initialDresses={(dressesRes.data ?? []).map((dress) => ({
        ...dress,
        price: Math.max(Number(dress.price) - Number(dress.discount_amount ?? 0), 0),
        discount_amount: Number(dress.discount_amount ?? 0),
        base_price: Number(dress.price),
      }))}
      initialClients={clientsRes.data ?? []}
    />
  );
}
