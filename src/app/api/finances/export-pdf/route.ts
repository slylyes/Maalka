import { NextResponse } from "next/server";

import { requireAuthenticatedUser } from "@/lib/api/auth";
import { getFinancesData } from "@/lib/finances";
import { generateFinancesReportPdf } from "@/lib/pdf/export-documents";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { unauthorizedResponse } = await requireAuthenticatedUser();
  if (unauthorizedResponse) return unauthorizedResponse;

  const { searchParams } = new URL(request.url);
  const data = await getFinancesData({
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
  });

  const pdfBuffer = await generateFinancesReportPdf(data);

  return new NextResponse(pdfBuffer as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="rapport-financier-${data.from}-${data.to}.pdf"`,
    },
  });
}
