"use client";

import React, { useCallback, useState, useMemo } from "react";

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
  notes?: string | null;
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

// ── Searchable select for dresses ───────────────────────────────────────────
function DressSearchSelect({
  dresses,
  value,
  onChange,
  placeholder = "Rechercher une robe…",
}: {
  dresses: DressOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return dresses.filter(
      (d) =>
        d.reference.toLowerCase().includes(q) ||
        (d.name ?? "").toLowerCase().includes(q)
    );
  }, [dresses, query]);

  return (
    <div className="space-y-1">
      <input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="premium-input w-full text-sm"
      />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="premium-input w-full"
        size={Math.min(filtered.length + 1, 6)}
      >
        <option value="">— Sélectionner —</option>
        {filtered.map((dress) => (
          <option key={dress.id} value={dress.id}>
            {dress.reference}
            {dress.name ? ` - ${dress.name}` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Searchable select for clients ────────────────────────────────────────────
function ClientSearchSelect({
  clients,
  value,
  onChange,
}: {
  clients: ClientOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const sorted = useMemo(
    () =>
      [...clients].sort((a, b) =>
        `${a.last_name} ${a.first_name}`.localeCompare(
          `${b.last_name} ${b.first_name}`,
          "fr"
        )
      ),
    [clients]
  );
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return sorted.filter(
      (c) =>
        c.first_name.toLowerCase().includes(q) ||
        c.last_name.toLowerCase().includes(q) ||
        c.phone.includes(q)
    );
  }, [sorted, query]);

  return (
    <div className="space-y-1">
      <input
        type="text"
        placeholder="Rechercher un client…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="premium-input w-full text-sm"
      />
      <select
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="premium-input w-full"
        size={Math.min(filtered.length + 1, 6)}
      >
        <option value="">— Sélectionner —</option>
        {filtered.map((client) => (
          <option key={client.id} value={client.id}>
            {client.last_name} {client.first_name} — {client.phone}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Edit modal ───────────────────────────────────────────────────────────────
function EditReservationModal({
  reservation,
  clients,
  onClose,
  onSaved,
}: {
  reservation: Reservation;
  clients: ClientOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [clientId, setClientId] = useState(reservation.client_id);
  const [startDate, setStartDate] = useState(reservation.start_date);
  const [endDate, setEndDate] = useState(reservation.end_date);
  const [status, setStatus] = useState(reservation.status);
  const [totalPrice, setTotalPrice] = useState(String(reservation.total_price));
  const [depositPaid, setDepositPaid] = useState(String(reservation.deposit_paid));
  const [cautionAmount, setCautionAmount] = useState(String(reservation.caution_amount));
  const [cautionStatus, setCautionStatus] = useState(reservation.caution_status);
  const [notes, setNotes] = useState(reservation.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const parsedTotal = Number(totalPrice);
    const parsedDeposit = Number(depositPaid);
    const parsedCaution = Number(cautionAmount);

    if (!Number.isFinite(parsedTotal) || parsedTotal < 0) {
      setError("Prix total invalide.");
      setSubmitting(false);
      return;
    }
    if (parsedDeposit > parsedTotal) {
      setError("L'acompte ne peut pas dépasser le prix total.");
      setSubmitting(false);
      return;
    }

    const response = await fetch(`/api/reservations/${reservation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        start_date: startDate,
        end_date: endDate,
        status,
        total_price: parsedTotal,
        deposit_paid: parsedDeposit,
        caution_amount: parsedCaution,
        caution_status: cautionStatus,
        notes,
      }),
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(json.error ?? "Erreur lors de la modification.");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    onSaved();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="premium-card w-full max-w-lg overflow-y-auto max-h-[90vh] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-light tracking-wide text-[var(--foreground)]">
            Modifier — {reservation.contract_number}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--border-soft)] px-3 py-1 text-sm text-[var(--muted)]"
          >
            Fermer
          </button>
        </div>

        <form className="space-y-3" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">
              Client
            </label>
            <ClientSearchSelect clients={clients} value={clientId} onChange={setClientId} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">
                Début
              </label>
              <input
                required
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="premium-input w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">
                Fin
              </label>
              <input
                required
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="premium-input w-full"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">
              Statut
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="premium-input w-full"
            >
              <option value="draft">Brouillon</option>
              <option value="reserved">Réservé</option>
              <option value="rented">En location</option>
              <option value="preparing">En préparation</option>
              <option value="completed">Terminé</option>
              <option value="cancelled">Annulé</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">
              Prix total (DA)
            </label>
            <input
              required
              type="number"
              min={0}
              step="0.01"
              value={totalPrice}
              onChange={(e) => setTotalPrice(e.target.value)}
              className="premium-input w-full"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">
              Acompte (DA)
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={depositPaid}
              onChange={(e) => setDepositPaid(e.target.value)}
              className="premium-input w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">
                Caution (DA)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={cautionAmount}
                onChange={(e) => setCautionAmount(e.target.value)}
                className="premium-input w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">
                Statut caution
              </label>
              <select
                value={cautionStatus}
                onChange={(e) => setCautionStatus(e.target.value)}
                className="premium-input w-full"
              >
                <option value="pending">En attente</option>
                <option value="received">Reçue</option>
                <option value="returned">Restituée</option>
                <option value="retained">Retenue</option>
                <option value="not_required">Non requise</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="premium-input min-h-20 w-full"
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            disabled={submitting}
            type="submit"
            className="premium-btn w-full px-3 py-2.5 text-sm disabled:opacity-60"
          >
            {submitting ? "Enregistrement…" : "Enregistrer les modifications"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
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

  // Create form state
  const [dressId, setDressId] = useState("");
  const [dressIds, setDressIds] = useState<string[]>([]);
  const [clientId, setClientId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [depositPaid, setDepositPaid] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [cautionAmount, setCautionAmount] = useState("");
  const [cautionStatus, setCautionStatus] = useState("pending");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Edit modal state
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);

  const selectedDresses = dresses.filter((dress) => dressIds.includes(dress.id));
  const baseTotalValue = selectedDresses.reduce((total, dress) => total + Number(dress.price || 0), 0);
  const parsedDiscount = discountAmount.trim().length > 0 ? Number(discountAmount) : 0;
  const safeDiscount = Number.isFinite(parsedDiscount) ? Math.max(parsedDiscount, 0) : 0;
  const totalPriceValue = Math.max(baseTotalValue - safeDiscount, 0);
  const totalPrice = selectedDresses.length ? totalPriceValue.toFixed(2) : "";

  // Available dresses for the picker (exclude already selected)
  const availableDressesForPicker = useMemo(
    () => dresses.filter((d) => !dressIds.includes(d.id)),
    [dresses, dressIds]
  );

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

  async function createReservation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    if (dressIds.length === 0 || !clientId || !startDate || !endDate) {
      setError("Merci de renseigner au moins une robe, le client et les dates de réservation.");
      setSubmitting(false);
      return;
    }

    if (safeDiscount > baseTotalValue) {
      setError("La remise ne peut pas dépasser le prix total.");
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
        discount_amount: safeDiscount,
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
    setDiscountAmount("");
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
    <>
      {editingReservation ? (
        <EditReservationModal
          reservation={editingReservation}
          clients={clients}
          onClose={() => setEditingReservation(null)}
          onSaved={loadData}
        />
      ) : null}

      <section className="grid gap-5 xl:grid-cols-12">
        <article className="premium-card p-6 xl:col-span-4">
          <h2 className="text-xl font-light tracking-wide text-[var(--foreground)]">Nouvelle réservation</h2>
          <form className="mt-3 space-y-3" onSubmit={createReservation}>
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Robe</p>
              <DressSearchSelect
                dresses={availableDressesForPicker}
                value={dressId}
                onChange={setDressId}
              />
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

            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Client</p>
              <ClientSearchSelect clients={clients} value={clientId} onChange={setClientId} />
            </div>

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
              placeholder="Remise (DA)"
              value={discountAmount}
              onChange={(event) => setDiscountAmount(event.target.value)}
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
                          onClick={() => setEditingReservation(reservation)}
                          className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs text-amber-700"
                        >
                          Modifier
                        </button>
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
    </>
  );
}
