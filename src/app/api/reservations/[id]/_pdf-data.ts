import { ReservationPdfData } from "@/lib/pdf/reservation-documents";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getReservationPdfData(id: string): Promise<ReservationPdfData | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("reservations")
    .select(
      "id, contract_number, start_date, end_date, status, total_price, deposit_paid, balance_due, caution_amount, caution_status, notes, dresses(reference,name), clients(first_name,last_name,phone,email,address)"
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    return null;
  }

  const dress = Array.isArray(data.dresses) ? data.dresses[0] : data.dresses;
  const client = Array.isArray(data.clients) ? data.clients[0] : data.clients;

  if (!dress || !client) {
    return null;
  }

  return {
    contractNumber: data.contract_number,
    startDate: data.start_date,
    endDate: data.end_date,
    status: data.status,
    totalPrice: data.total_price,
    depositPaid: data.deposit_paid,
    balanceDue: data.balance_due,
    cautionAmount: data.caution_amount,
    cautionStatus: data.caution_status,
    notes: data.notes,
    dressReference: dress.reference,
    dressName: dress.name,
    clientFirstName: client.first_name,
    clientLastName: client.last_name,
    clientPhone: client.phone,
    clientEmail: client.email,
    clientAddress: client.address,
  };
}
