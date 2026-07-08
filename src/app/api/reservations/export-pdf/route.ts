import { NextResponse } from "next/server";

import { requireAuthenticatedUser, serverErrorFrom } from "@/lib/api/auth";
import { isValidDate } from "@/lib/format";
import { firstRelation } from "@/lib/relations";
import { generateReservationsListPdf, type ReservationExportRow } from "@/lib/pdf/export-documents";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { supabase, unauthorizedResponse } = await requireAuthenticatedUser();
  if (unauthorizedResponse) return unauthorizedResponse;

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();
  const from = isValidDate(searchParams.get("from")) ? searchParams.get("from")! : null;
  const to = isValidDate(searchParams.get("to")) ? searchParams.get("to")! : null;

  const { data, error } = await supabase
    .from("reservations")
    .select(
      "id, contract_number, reservation_date, start_date, end_date, status, total_price, deposit_paid, balance_due, reservation_dresses(dresses(reference,name)), clients(first_name,last_name,phone)"
    )
    .order("start_date", { ascending: false });

  if (error) return serverErrorFrom(error.message);

  // Mêmes filtres que la liste à l'écran : texte (client, contrat, robe) + chevauchement de période
  const rows: ReservationExportRow[] = (data ?? [])
    .filter((r) => {
      if (from && r.end_date < from) return false;
      if (to && r.start_date > to) return false;
      if (q) {
        const client = firstRelation(r.clients);
        const clientName = `${client?.first_name ?? ""} ${client?.last_name ?? ""}`;
        const dressText = (Array.isArray(r.reservation_dresses) ? r.reservation_dresses : [])
          .map((item) => {
            const dress = firstRelation(item.dresses);
            return `${dress?.name ?? ""} ${dress?.reference ?? ""}`;
          })
          .join(" ");
        const matches = [clientName, r.contract_number, dressText].some((value) =>
          value.toLowerCase().includes(q)
        );
        if (!matches) return false;
      }
      return true;
    })
    .map((r) => {
      const client = firstRelation(r.clients);
      const dresses = (Array.isArray(r.reservation_dresses) ? r.reservation_dresses : [])
        .map((item) => {
          const dress = firstRelation(item.dresses);
          return dress?.reference ?? dress?.name ?? "";
        })
        .filter(Boolean)
        .join(", ");
      return {
        contractNumber: r.contract_number,
        clientName: `${client?.first_name ?? ""} ${client?.last_name ?? ""}`.trim(),
        phone: client?.phone ?? "",
        reservationDate: r.reservation_date,
        startDate: r.start_date,
        endDate: r.end_date,
        status: r.status,
        dresses,
        totalPrice: Number(r.total_price ?? 0),
        depositPaid: Number(r.deposit_paid ?? 0),
        balanceDue: Number(r.balance_due ?? 0),
      };
    });

  const subtitleParts: string[] = [];
  if (from || to) {
    subtitleParts.push(`Période: ${from ?? "…"} → ${to ?? "…"}`);
  }
  if (q) subtitleParts.push(`Filtre: « ${searchParams.get("q")} »`);
  const subtitle = subtitleParts.length > 0 ? subtitleParts.join(" · ") : "Toutes les réservations";

  const pdfBuffer = await generateReservationsListPdf(rows, subtitle);

  return new NextResponse(pdfBuffer as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="reservations-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
