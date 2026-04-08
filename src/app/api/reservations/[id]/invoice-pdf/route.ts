import { NextResponse } from "next/server";

import { requireAuthenticatedUser } from "@/lib/api/auth";
import { generateInvoicePdf } from "@/lib/pdf/reservation-documents";
import { getReservationPdfData } from "@/app/api/reservations/[id]/_pdf-data";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const { unauthorizedResponse } = await requireAuthenticatedUser();
  if (unauthorizedResponse) return unauthorizedResponse;

  const { id } = await params;
  const reservation = await getReservationPdfData(id);

  if (!reservation) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  const pdfBuffer = await generateInvoicePdf(reservation);

  return new NextResponse(pdfBuffer as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="facture-${reservation.contractNumber}.pdf"`,
    },
  });
}
