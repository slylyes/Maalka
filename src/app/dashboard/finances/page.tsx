import { FinancesClient } from "@/app/dashboard/finances/ui";
import { getFinancesData } from "@/lib/finances";

type PageProps = { searchParams: Promise<{ from?: string; to?: string }> };

export default async function FinancesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const data = await getFinancesData(params);
  return <FinancesClient data={data} />;
}
