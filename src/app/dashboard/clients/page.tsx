import { ClientsClient } from "@/app/dashboard/clients/ui";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ClientsPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("clients")
    .select("id, first_name, last_name, phone, email, address, notes")
    .order("created_at", { ascending: false });

  return <ClientsClient initialClients={data ?? []} />;
}
