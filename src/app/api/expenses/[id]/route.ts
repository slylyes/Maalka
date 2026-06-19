import { NextResponse } from "next/server";

import { requireAuthenticatedUser, serverErrorFrom } from "@/lib/api/auth";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;
  const { supabase, unauthorizedResponse } = await requireAuthenticatedUser();
  if (unauthorizedResponse) return unauthorizedResponse;

  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) return serverErrorFrom(error.message);
  return NextResponse.json({ success: true });
}
