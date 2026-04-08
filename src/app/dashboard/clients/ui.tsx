"use client";

import { FormEvent, useCallback, useState } from "react";

type Client = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  address: string | null;
  notes: string | null;
};

type ClientsClientProps = {
  initialClients: Client[];
};

export function ClientsClient({ initialClients }: ClientsClientProps) {
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadClients = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/clients", { cache: "no-store" });
    const json = await response.json();

    if (!response.ok) {
      setError(json.error || "Erreur lors du chargement des clients");
      setLoading(false);
      return;
    }

    setClients(json.data ?? []);
    setLoading(false);
  }, []);

  async function createClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        phone,
        email,
        address,
        notes,
      }),
    });

    const json = await response.json();

    if (!response.ok) {
      setError(json.error || "Erreur lors de la création du client");
      setSubmitting(false);
      return;
    }

    setFirstName("");
    setLastName("");
    setPhone("");
    setEmail("");
    setAddress("");
    setNotes("");
    setSubmitting(false);
    await loadClients();
  }

  async function deleteClient(id: string) {
    setError(null);
    const response = await fetch(`/api/clients/${id}`, { method: "DELETE" });
    const json = await response.json().catch(() => ({}));

    if (response.ok) {
      await loadClients();
      return;
    }

    setError(json.error || "Suppression impossible pour ce client.");
  }

  return (
    <section className="grid gap-5 xl:grid-cols-12">
      <article className="premium-card p-6 xl:col-span-4">
        <h2 className="text-xl font-light tracking-wide text-[var(--foreground)]">Nouveau client</h2>
        <form className="mt-3 space-y-3" onSubmit={createClient}>
          <input
            required
            placeholder="Prénom"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            className="premium-input w-full"
          />
          <input
            required
            placeholder="Nom"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            className="premium-input w-full"
          />
          <input
            required
            placeholder="Téléphone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="premium-input w-full"
          />
          <input
            type="email"
            placeholder="Email (optionnel)"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="premium-input w-full"
          />
          <input
            placeholder="Adresse"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            className="premium-input w-full"
          />
          <textarea
            placeholder="Notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="premium-input min-h-24 w-full"
          />
          <button
            type="submit"
            disabled={submitting}
            className="premium-btn w-full px-3 py-2.5 text-sm disabled:opacity-60"
          >
            {submitting ? "Création..." : "Créer le client"}
          </button>
        </form>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </article>

      <article className="premium-card p-6 xl:col-span-8">
        <h2 className="text-xl font-light tracking-wide text-[var(--foreground)]">Clients</h2>
        {loading ? <p className="mt-3 text-sm text-[var(--muted)]">Chargement...</p> : null}
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-[var(--muted)]">
                <th className="pb-3 pr-4 font-medium">Nom</th>
                <th className="pb-3 pr-4 font-medium">Téléphone</th>
                <th className="pb-3 pr-4 font-medium">Email</th>
                <th className="pb-3 pr-4 font-medium">Adresse</th>
                <th className="pb-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} className="border-t border-[var(--border-soft)] text-[var(--muted)]">
                  <td className="py-4 pr-4 text-[var(--foreground)]">
                    {client.first_name} {client.last_name}
                  </td>
                  <td className="py-4 pr-4">{client.phone}</td>
                  <td className="py-4 pr-4">{client.email || "-"}</td>
                  <td className="py-4 pr-4">{client.address || "-"}</td>
                  <td className="py-4">
                    <button
                      type="button"
                      onClick={() => void deleteClient(client.id)}
                      className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs text-rose-700"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && clients.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted)]">Aucun client enregistré.</p>
        ) : null}
      </article>
    </section>
  );
}
