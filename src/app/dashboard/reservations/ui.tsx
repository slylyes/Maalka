"use client";

import { FormEvent, useCallback, useState } from "react";

function formatDateFr(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}-${month}-${year}`;
}

type DressOption = {
  id: string;
  reference: string;
  name: string | null;
  status: string;
  price: number;
  base_price?: number;
  discount_amount?: number;
};
type ClientOption = { id: string; first_name: string; last_name: string; phone: string };

type Reservation = {
  id: string;
  contract_number: string;
  client_id: string;
  start_date: string;
  end_date: string;
  status: string;
  total_price: number;
  deposit_paid: number;
  balance_due: number;
  caution_amount: number;
  caution_status: string;
  reservation_dresses?: Array<{
    dress_id: string;
    price: number;
    base_price?: number | null;
    discount_amount?: number | null;
    dresses?: { reference?: string; name?: string } | null;
  }> | null;
  clients?: { first_name?: string; last_name?: string; phone?: string } | null;
};

type ReservationsClientProps = {
  initialReservations: Reservation[];
  initialDresses: DressOption[];
  initialClients: ClientOption[];
};

export function ReservationsClient({
  initialReservations,
  initialDresses,
  initialClients,
}: ReservationsClientProps) {
  const [reservations, setReservations] = useState<Reservation[]>(initialReservations);
  const [dresses, setDresses] = useState<DressOption[]>(initialDresses);
  const [clients, setClients] = useState<ClientOption[]>(initialClients);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dressId, setDressId] = useState("");
  const [dressIds, setDressIds] = useState<string[]>([]);
  const [clientId, setClientId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [depositPaid, setDepositPaid] = useState("");
  const [cautionAmount, setCautionAmount] = useState("");
  const [cautionStatus, setCautionStatus] = useState("pending");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedDresses = dresses.filter((dress) => dressIds.includes(dress.id));
  const totalPriceValue = selectedDresses.reduce((total, dress) => total + Number(dress.price || 0), 0);
  const totalPrice = selectedDresses.length ? totalPriceValue.toFixed(2) : "";

  const formatReservationDresses = (reservation: Reservation) => {
    const items = reservation.reservation_dresses ?? [];
    if (!items.length) return "-";
    const labels = items.map((item) => {
      const dress = item.dresses;
      if (!dress) return "Robe";
      const namePart = dress.name ? `- ${dress.name}` : "";
      return `${dress.reference ?? "Robe"} ${namePart}`.trim();
    });
    if (labels.length <= 2) return labels.join(", ");
    return `${labels[0]}, ${labels[1]} +${labels.length - 2}`;
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [reservationsRes, dressesRes, clientsRes] = await Promise.all([
      fetch("/api/reservations", { cache: "no-store" }),
      fetch("/api/dresses", { cache: "no-store" }),
      fetch("/api/clients", { cache: "no-store" }),
    ]);

    const [reservationsJson, dressesJson, clientsJson] = await Promise.all([
      reservationsRes.json(),
      dressesRes.json(),
      clientsRes.json(),
    ]);

    if (!reservationsRes.ok) {
      setError(reservationsJson.error || "Erreur chargement réservations");
      setLoading(false);
      return;
    }

    const normalizedReservations = (reservationsJson.data ?? []).map((reservation: Reservation) => ({
      ...reservation,
      reservation_dresses: Array.isArray(reservation.reservation_dresses)
        ? reservation.reservation_dresses
        : reservation.reservation_dresses
          ? [reservation.reservation_dresses]
          : [],
    }));
    setReservations(normalizedReservations);
    setDresses(dressesJson.data ?? []);
    setClients(clientsJson.data ?? []);
    setLoading(false);
  }, []);

  async function createReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    if (dressIds.length === 0 || !clientId || !startDate || !endDate) {
      setError("Merci de renseigner au moins une robe, le client et les dates de réservation.");
      setSubmitting(false);
      return;
    }

    const response = await fetch("/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dress_ids: dressIds,
        client_id: clientId,
        start_date: startDate,
        end_date: endDate,
        deposit_paid: depositPaid.trim().length > 0 ? Number(depositPaid) : 0,
        caution_amount: cautionAmount.trim().length > 0 ? Number(cautionAmount) : 0,
        caution_status: cautionStatus,
        notes,
      }),
    });

    const json = await response.json();

    if (!response.ok) {
      setError(json.error || "Erreur lors de la création de la réservation");
      setSubmitting(false);
      return;
    }

    setDressId("");
    setDressIds([]);
    setClientId("");
    setStartDate("");
    setEndDate("");
    setDepositPaid("");
    setCautionAmount("");
    setCautionStatus("pending");
    setNotes("");
    setSubmitting(false);
    await loadData();
  }

  async function deleteReservation(id: string) {
    setError(null);
    const response = await fetch(`/api/reservations/${id}`, { method: "DELETE" });
    const json = await response.json().catch(() => ({}));

    if (response.ok) {
      await loadData();
      return;
    }

    setError(json.error || "Suppression impossible pour cette réservation.");
  }

  return (
    <section className="grid gap-5 xl:grid-cols-12">
      <article className="premium-card p-6 xl:col-span-4">
        <h2 className="text-xl font-light tracking-wide text-[var(--foreground)]">Nouvelle réservation</h2>
        <form className="mt-3 space-y-3" onSubmit={createReservation}>
          <div className="space-y-2">
            <select
              value={dressId}
              onChange={(event) => setDressId(event.target.value)}
              className="premium-input w-full"
            >
              <option value="">Sélectionner une robe</option>
              {dresses.map((dress) => (
                <option key={dress.id} value={dress.id}>
                  {dress.reference} {dress.name ? `- ${dress.name}` : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                setError(null);
                if (!dressId) {
                  setError("Sélectionne une robe avant de l'ajouter.");
                  return;
                }
                if (dressIds.includes(dressId)) {
                  setError("Cette robe est déjà ajoutée.");
                  return;
                }
                setDressIds((previous) => [...previous, dressId]);
                setDressId("");
              }}
              className="w-full rounded-xl border border-[var(--border-soft)] bg-white px-3 py-2 text-sm text-[var(--muted)]"
            >
              Ajouter la robe
            </button>
          </div>

          <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Robes ajoutées</p>
            {selectedDresses.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--muted)]">Aucune robe ajoutée pour l&apos;instant.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {selectedDresses.map((dress) => (
                  <li key={dress.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-[var(--foreground)]">
                      {dress.reference} {dress.name ? `- ${dress.name}` : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setDressIds((previous) => previous.filter((id) => id !== dress.id));
                      }}
                      className="rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-xs text-rose-700"
                    >
                      Retirer
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <select
            required
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            className="premium-input w-full"
          >
            <option value="">Sélectionner un client</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.first_name} {client.last_name}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-2">
            <input
              required
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="premium-input w-full"
            />
            <input
              required
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="premium-input w-full"
            />
          </div>

          <input
            readOnly
            type="text"
            placeholder="Prix total (auto)"
            value={totalPrice}
            className="premium-input w-full"
          />
          <input
            min={0}
            type="number"
            step="0.01"
            placeholder="Acompte total (DA)"
            value={depositPaid}
            onChange={(event) => setDepositPaid(event.target.value)}
            className="premium-input w-full"
          />
          <input
            min={0}
            type="number"
            step="0.01"
            placeholder="Montant caution total (DA)"
            value={cautionAmount}
            onChange={(event) => setCautionAmount(event.target.value)}
            className="premium-input w-full"
          />
          <select
            value={cautionStatus}
            onChange={(event) => setCautionStatus(event.target.value)}
            className="premium-input w-full"
          >
            <option value="pending">Caution en attente</option>
            <option value="received">Caution reçue</option>
            <option value="not_required">Pas de caution</option>
          </select>
          <textarea
            placeholder="Notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="premium-input min-h-24 w-full"
          />
          <button
            disabled={submitting}
            type="submit"
            className="premium-btn w-full px-3 py-2.5 text-sm disabled:opacity-60"
          >
            {submitting ? "Création..." : "Créer la réservation"}
          </button>
        </form>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </article>

      <article className="premium-card p-6 xl:col-span-8">
        <h2 className="text-xl font-light tracking-wide text-[var(--foreground)]">Réservations</h2>
        {loading ? <p className="mt-3 text-sm text-[var(--muted)]">Chargement...</p> : null}
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-[var(--muted)]">
                <th className="pb-3 pr-4 font-medium">Contrat</th>
                <th className="pb-3 pr-4 font-medium">Période</th>
                <th className="pb-3 pr-4 font-medium">Client</th>
                <th className="pb-3 pr-4 font-medium">Robe</th>
                <th className="pb-3 pr-4 font-medium">Paiement</th>
                <th className="pb-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((reservation) => (
                <tr key={reservation.id} className="border-t border-[var(--border-soft)] text-[var(--muted)]">
                  <td className="py-4 pr-4 text-[var(--foreground)]">{reservation.contract_number}</td>
                  <td className="py-4 pr-4">
                    {formatDateFr(reservation.start_date)} → {formatDateFr(reservation.end_date)}
                    <div className="mt-1 text-xs">{reservation.status}</div>
                  </td>
                  <td className="py-4 pr-4">
                    {reservation.clients?.first_name} {reservation.clients?.last_name}
                  </td>
                  <td className="py-4 pr-4">{formatReservationDresses(reservation)}</td>
                  <td className="py-4 pr-4">
                    <div>Total: {reservation.total_price} DA</div>
                    <div>Acompte: {reservation.deposit_paid} DA</div>
                    <div>Reste: {reservation.balance_due} DA</div>
                  </td>
                  <td className="py-4">
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={`/api/reservations/${reservation.id}/contract-pdf`}
                        className="rounded-lg border border-[var(--border-soft)] bg-white px-3 py-1.5 text-xs text-[var(--muted)]"
                      >
                        Contrat
                      </a>
                      <a
                        href={`/api/reservations/${reservation.id}/invoice-pdf`}
                        className="rounded-lg border border-[var(--border-soft)] bg-white px-3 py-1.5 text-xs text-[var(--muted)]"
                      >
                        Facture
                      </a>
                      <button
                        type="button"
                        onClick={() => void deleteReservation(reservation.id)}
                        className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs text-rose-700"
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && reservations.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted)]">Aucune réservation enregistrée.</p>
        ) : null}
      </article>
    </section>
  );
}
