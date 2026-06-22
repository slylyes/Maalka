import { ReservationsClient } from "@/app/dashboard/reservations/ui";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { firstRelation } from "@/lib/relations";

export default async function ReservationsPage() {
  const supabase = await createSupabaseServerClient();

  const [reservationsRes, dressesRes, clientsRes] = await Promise.all([
    supabase
      .from("reservations")
      .select(
        "id, contract_number, client_id, reservation_date, start_date, end_date, status, total_price, deposit_paid, balance_due, caution_amount, caution_status, reservation_dresses(dress_id, price, base_price, discount_amount, dresses(reference,name)), clients(first_name,last_name,phone)"
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
    reservation_dresses: (Array.isArray(reservation.reservation_dresses)
      ? reservation.reservation_dresses
      : reservation.reservation_dresses
        ? [reservation.reservation_dresses]
        : []
    ).map((item) => ({
      ...item,
      dresses: firstRelation(item.dresses),
    })),
    clients: firstRelation(reservation.clients),
  }));

  return (
    <ReservationsClient
      initialReservations={normalizedReservations}
      initialDresses={(dressesRes.data ?? []).map((dress) => ({
        ...dress,
        price: Number(dress.price),
      }))}
      initialClients={clientsRes.data ?? []}
    />
  );
}
