import { createSupabaseServerClient } from "@/lib/supabase/server";

function formatDateFr(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}-${month}-${year}`;
}

function formatAmount(value: number) {
  return `${value.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} DA`;
}

function parsePeriodDays(value: string | undefined) {
  const allowed = new Set([30, 90, 180]);
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !allowed.has(parsed)) return 30;
  return parsed;
}

function monthKeyFromDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

type DashboardPageProps = {
  searchParams: Promise<{ period?: string }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const periodDays = parsePeriodDays(params.period);

  const today = new Date().toISOString().slice(0, 10);
  const periodStartDate = new Date();
  periodStartDate.setDate(periodStartDate.getDate() - (periodDays - 1));
  const periodStart = periodStartDate.toISOString().slice(0, 10);

  const { data: activeDressRows } = await supabase
    .from("reservations")
    .select("dress_id")
    .in("status", ["reserved", "rented", "preparing"])
    .lte("start_date", today)
    .gte("end_date", today);

  const activeDressIds = Array.from(new Set((activeDressRows ?? []).map((item) => item.dress_id)));

  await supabase
    .from("dresses")
    .update({ status: "available" })
    .in("status", ["available", "reserved"]);

  if (activeDressIds.length > 0) {
    await supabase
      .from("dresses")
      .update({ status: "reserved" })
      .in("id", activeDressIds)
      .in("status", ["available", "reserved"]);
  }

  const [
    { data: pickups },
    { data: returns },
    { count: totalDresses },
    { count: availableDresses },
    { count: activeReservations },
    { data: upcomingReservations },
    { data: periodReservations },
  ] = await Promise.all([
    supabase
      .from("reservations")
      .select(
        "id, contract_number, start_date, status, total_price, balance_due, dresses(reference,name), clients(first_name,last_name,phone)"
      )
      .eq("start_date", today)
      .in("status", ["reserved", "preparing", "rented"])
      .order("start_date", { ascending: true }),
    supabase
      .from("reservations")
      .select(
        "id, contract_number, end_date, status, dresses(reference,name), clients(first_name,last_name,phone)"
      )
      .eq("end_date", today)
      .in("status", ["reserved", "preparing", "rented"])
      .order("end_date", { ascending: true }),
    supabase.from("dresses").select("id", { count: "exact", head: true }),
    supabase
      .from("dresses")
      .select("id", { count: "exact", head: true })
      .eq("status", "available"),
    supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .in("status", ["reserved", "preparing", "rented"])
      .lte("start_date", today)
      .gte("end_date", today),
    supabase
      .from("reservations")
      .select(
        "id, contract_number, start_date, end_date, status, dresses(reference,name), clients(first_name,last_name)"
      )
      .gte("start_date", today)
      .in("status", ["reserved", "preparing", "rented"])
      .order("start_date", { ascending: true })
      .limit(5),
    supabase
      .from("reservations")
      .select("id, dress_id, start_date, status, total_price, deposit_paid, balance_due, dresses(reference,name)")
      .gte("start_date", periodStart)
      .lte("start_date", today)
      .order("start_date", { ascending: true }),
  ]);

  const firstRelation = <T,>(value: T[] | T | null | undefined): T | null => {
    if (!value) return null;
    if (Array.isArray(value)) {
      if (value.length === 0) return null;
      return value[0];
    }
    return value;
  };

  const expectedTurnoverToday =
    pickups?.reduce((sum, reservation) => sum + Number((reservation as { total_price?: number }).total_price ?? 0), 0) ?? 0;

  const expectedOutstandingToday =
    pickups?.reduce((sum, reservation) => sum + Number((reservation as { balance_due?: number }).balance_due ?? 0), 0) ?? 0;

  const analyticRows = (periodReservations ?? []).filter(
    (reservation) => reservation.status !== "cancelled" && reservation.status !== "draft"
  );

  const reservationsInPeriod = analyticRows.length;
  const turnoverInPeriod =
    analyticRows.reduce((sum, reservation) => sum + Number(reservation.total_price ?? 0), 0) ?? 0;
  const collectedInPeriod =
    analyticRows.reduce((sum, reservation) => sum + Number(reservation.deposit_paid ?? 0), 0) ?? 0;
  const outstandingInPeriod =
    analyticRows.reduce((sum, reservation) => sum + Number(reservation.balance_due ?? 0), 0) ?? 0;
  const averageBasket = reservationsInPeriod > 0 ? turnoverInPeriod / reservationsInPeriod : 0;

  const topDressesMap = new Map<string, { label: string; count: number; turnover: number }>();

  for (const reservation of analyticRows) {
    const dress = firstRelation(reservation.dresses);
    const key = reservation.dress_id;
    const labelBase = dress?.reference ? dress.reference : "Robe";
    const label = dress?.name ? `${labelBase} - ${dress.name}` : labelBase;

    const current = topDressesMap.get(key) ?? { label, count: 0, turnover: 0 };
    current.count += 1;
    current.turnover += Number(reservation.total_price ?? 0);
    topDressesMap.set(key, current);
  }

  const topDresses = Array.from(topDressesMap.values())
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.turnover - a.turnover;
    })
    .slice(0, 5);

  const maxTopDressCount = Math.max(1, ...topDresses.map((item) => item.count));

  const statusLabel: Record<string, string> = {
    reserved: "Réservée",
    preparing: "Préparation",
    rented: "Louée",
    completed: "Terminée",
  };

  const statusCountMap = new Map<string, number>();
  for (const reservation of analyticRows) {
    const previous = statusCountMap.get(reservation.status) ?? 0;
    statusCountMap.set(reservation.status, previous + 1);
  }

  const statusDistribution = Array.from(statusCountMap.entries())
    .map(([status, count]) => ({
      status,
      label: statusLabel[status] ?? status,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const maxStatusCount = Math.max(1, ...statusDistribution.map((item) => item.count));

  const monthCount = Math.min(12, Math.max(4, Math.ceil(periodDays / 30)));
  const monthBuckets = Array.from({ length: monthCount }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (monthCount - 1 - index));
    return {
      key: monthKeyFromDate(date),
      label: date.toLocaleDateString("fr-FR", { month: "short" }),
      turnover: 0,
      reservations: 0,
    };
  });

  const monthIndexMap = new Map(monthBuckets.map((bucket, index) => [bucket.key, index]));

  for (const reservation of analyticRows) {
    const key = reservation.start_date.slice(0, 7);
    const index = monthIndexMap.get(key);
    if (index === undefined) continue;

    monthBuckets[index].turnover += Number(reservation.total_price ?? 0);
    monthBuckets[index].reservations += 1;
  }

  const maxMonthlyTurnover = Math.max(1, ...monthBuckets.map((item) => item.turnover));

  return (
    <section className="grid gap-5">
      <article className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="premium-card p-5">
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Robes en stock</p>
          <p className="mt-2 text-3xl font-light text-[var(--foreground)]">{totalDresses ?? 0}</p>
        </div>
        <div className="premium-card p-5">
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Robes disponibles</p>
          <p className="mt-2 text-3xl font-light text-[var(--foreground)]">{availableDresses ?? 0}</p>
        </div>
        <div className="premium-card p-5">
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Réservations actives</p>
          <p className="mt-2 text-3xl font-light text-[var(--foreground)]">{activeReservations ?? 0}</p>
        </div>
        <div className="premium-card p-5">
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">CA prévu aujourd&apos;hui</p>
          <p className="mt-2 text-3xl font-light text-[var(--foreground)]">{expectedTurnoverToday.toFixed(2)} DA</p>
          <p className="mt-1 text-xs text-[var(--muted)]">Reste attendu: {expectedOutstandingToday.toFixed(2)} DA</p>
        </div>
      </article>

      <article className="premium-card p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-light tracking-wide text-[var(--foreground)]">Performance commerciale</h2>
            <p className="text-sm text-[var(--muted)]">
              Analyse du {formatDateFr(periodStart)} au {formatDateFr(today)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[30, 90, 180].map((value) => {
              const active = value === periodDays;
              return (
                <a
                  key={value}
                  href={`/dashboard?period=${value}`}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                    active
                      ? "border-[var(--accent)] bg-[var(--surface-soft)] text-[var(--accent-deep)]"
                      : "border-[var(--border-soft)] bg-white text-[var(--muted)] hover:bg-[var(--surface-soft)]"
                  }`}
                >
                  {value} jours
                </a>
              );
            })}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Réservations</p>
            <p className="mt-2 text-2xl font-light text-[var(--foreground)]">{reservationsInPeriod}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">CA période</p>
            <p className="mt-2 text-2xl font-light text-[var(--foreground)]">{formatAmount(turnoverInPeriod)}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Encaissements</p>
            <p className="mt-2 text-2xl font-light text-[var(--foreground)]">{formatAmount(collectedInPeriod)}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Reste à encaisser</p>
            <p className="mt-2 text-2xl font-light text-[var(--foreground)]">{formatAmount(outstandingInPeriod)}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-12">
          <section className="rounded-2xl border border-[var(--border-soft)] bg-white p-4 xl:col-span-7">
            <h3 className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">Évolution mensuelle du CA</h3>
            <div className="mt-4 flex items-end gap-3 overflow-x-auto pb-2">
              {monthBuckets.map((bucket) => {
                const barHeight = Math.max(10, Math.round((bucket.turnover / maxMonthlyTurnover) * 140));
                return (
                  <div key={bucket.key} className="flex min-w-[64px] flex-col items-center gap-2">
                    <div className="text-[10px] text-[var(--muted)]">{Math.round(bucket.turnover).toLocaleString("fr-FR")}</div>
                    <div className="flex h-36 items-end">
                      <div
                        className="w-8 rounded-t-md bg-[var(--accent)]"
                        style={{ height: `${barHeight}px` }}
                        title={`${bucket.label}: ${formatAmount(bucket.turnover)} (${bucket.reservations} réservations)`}
                      />
                    </div>
                    <div className="text-[11px] uppercase tracking-wide text-[var(--muted)]">{bucket.label}</div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border-soft)] bg-white p-4 xl:col-span-5">
            <h3 className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">
              Répartition des statuts
            </h3>
            <div className="mt-4 space-y-3">
              {statusDistribution.length ? (
                statusDistribution.map((item) => {
                  const width = Math.max(8, Math.round((item.count / maxStatusCount) * 100));
                  return (
                    <div key={item.status}>
                      <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                        <span>{item.label}</span>
                        <span>{item.count}</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-[var(--surface-soft)]">
                        <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-[var(--muted)]">Aucune donnée sur cette période.</p>
              )}
            </div>
          </section>
        </div>

        <section className="mt-5 rounded-2xl border border-[var(--border-soft)] bg-white p-4">
          <h3 className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">Robes les plus louées</h3>
          <div className="mt-4 space-y-3">
            {topDresses.length ? (
              topDresses.map((item) => {
                const width = Math.max(10, Math.round((item.count / maxTopDressCount) * 100));
                return (
                  <div key={item.label}>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-[var(--foreground)]">{item.label}</span>
                      <span className="whitespace-nowrap text-[var(--muted)]">
                        {item.count} locations • {formatAmount(item.turnover)}
                      </span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-[var(--surface-soft)]">
                      <div className="h-full rounded-full bg-[var(--accent-deep)]" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-[var(--muted)]">Aucune location enregistrée sur cette période.</p>
            )}
          </div>
          <p className="mt-3 text-xs text-[var(--muted)]">Panier moyen: {formatAmount(averageBasket)}</p>
        </section>
      </article>

      <section className="grid gap-5 lg:grid-cols-2">
      <article className="premium-card p-6">
        <h2 className="text-xl font-light tracking-wide text-[var(--foreground)]">
          Sorties prévues aujourd&apos;hui
        </h2>
        <ul className="mt-4 space-y-3 text-sm text-[var(--muted)]">
          {pickups?.length ? (
            pickups.map((item) => (
              <li key={item.id} className="rounded-xl border border-[var(--border-soft)] bg-white p-3">
                {(() => {
                  const dress = firstRelation(item.dresses);
                  const client = firstRelation(item.clients);

                  return (
                    <>
                        <p className="font-medium text-[var(--foreground)]">{item.contract_number}</p>
                        <p className="mt-1">
                        Robe: {dress?.reference} {dress?.name ? `- ${dress.name}` : ""}
                        </p>
                        <p>
                        Client: {client?.first_name} {client?.last_name}
                        </p>
                    </>
                  );
                })()}
              </li>
            ))
          ) : (
            <li>Aucune sortie prévue aujourd&apos;hui.</li>
          )}
        </ul>
      </article>

      <article className="premium-card p-6">
        <h2 className="text-xl font-light tracking-wide text-[var(--foreground)]">
          Retours attendus aujourd&apos;hui
        </h2>
        <ul className="mt-4 space-y-3 text-sm text-[var(--muted)]">
          {returns?.length ? (
            returns.map((item) => (
              <li key={item.id} className="rounded-xl border border-[var(--border-soft)] bg-white p-3">
                {(() => {
                  const dress = firstRelation(item.dresses);
                  const client = firstRelation(item.clients);

                  return (
                    <>
                        <p className="font-medium text-[var(--foreground)]">{item.contract_number}</p>
                        <p className="mt-1">
                        Robe: {dress?.reference} {dress?.name ? `- ${dress.name}` : ""}
                        </p>
                        <p>
                        Client: {client?.first_name} {client?.last_name}
                        </p>
                    </>
                  );
                })()}
              </li>
            ))
          ) : (
            <li>Aucun retour attendu aujourd&apos;hui.</li>
          )}
        </ul>
      </article>

      </section>

      <article className="premium-card p-6">
        <h2 className="text-xl font-light tracking-wide text-[var(--foreground)]">Prochaines réservations</h2>
        <ul className="mt-4 space-y-3 text-sm text-[var(--muted)]">
          {upcomingReservations?.length ? (
            upcomingReservations.map((item) => (
              <li key={item.id} className="rounded-xl border border-[var(--border-soft)] bg-white p-3">
                {(() => {
                  const dress = firstRelation(item.dresses);
                  const client = firstRelation(item.clients);

                  return (
                    <>
                      <p className="font-medium text-[var(--foreground)]">{item.contract_number}</p>
                      <p className="mt-1">
                        {formatDateFr(item.start_date)} → {formatDateFr(item.end_date)} ({item.status})
                      </p>
                      <p>
                        Robe: {dress?.reference} {dress?.name ? `- ${dress.name}` : ""}
                      </p>
                      <p>
                        Client: {client?.first_name} {client?.last_name}
                      </p>
                    </>
                  );
                })()}
              </li>
            ))
          ) : (
            <li>Aucune réservation à venir.</li>
          )}
        </ul>
      </article>
    </section>
  );
}
