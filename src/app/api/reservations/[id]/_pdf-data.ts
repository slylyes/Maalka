import { ReservationPdfData } from "@/lib/pdf/reservation-documents";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getReservationPdfData(id: string): Promise<ReservationPdfData | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("reservations")
    .select(
      "id, contract_number, start_date, end_date, status, total_price, discount_amount, supplement, deposit_paid, balance_due, caution_amount, caution_status, notes, reservation_dresses(price, base_price, discount_amount, dresses(reference,name)), clients(first_name,last_name,phone,email,address)"
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    return null;
  }

  const client = Array.isArray(data.clients) ? data.clients[0] : data.clients;

  if (!client) {
    return null;
  }

  const dressItems = (data.reservation_dresses ?? []).map((item) => {
    const dress = Array.isArray(item.dresses) ? item.dresses[0] : item.dresses;
    return {
      reference: dress?.reference ?? "",
      name: dress?.name ?? null,
      basePrice: Number(item.base_price ?? 0),
      discountAmount: Number(item.discount_amount ?? 0),
      price: Number(item.price ?? 0),
    };
  });

  const baseTotal = dressItems.reduce((sum, item) => sum + item.basePrice, 0);

  return {
    contractNumber: data.contract_number,
    startDate: data.start_date,
    endDate: data.end_date,
    status: data.status,
    totalPrice: data.total_price,
    baseTotal,
    discountAmount: Number(data.discount_amount ?? 0),
    supplement: Number(data.supplement ?? 0),
    depositPaid: data.deposit_paid,
    balanceDue: data.balance_due,
    cautionAmount: data.caution_amount,
    cautionStatus: data.caution_status,
    notes: data.notes,
    dressItems,
    clientFirstName: client.first_name,
    clientLastName: client.last_name,
    clientPhone: client.phone,
    clientEmail: client.email,
    clientAddress: client.address,
  };
}
