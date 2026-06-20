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

function EditClientModal({
  client,
  onClose,
  onSaved,
}: {
  client: Client;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [firstName, setFirstName] = useState(client.first_name);
  const [lastName, setLastName] = useState(client.last_name);
  const [phone, setPhone] = useState(client.phone);
  const [email, setEmail] = useState(client.email ?? "");
  const [address, setAddress] = useState(client.address ?? "");
  const [notes, setNotes] = useState(client.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch(`/api/clients/${client.id}`, {
      method: "PATCH",
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

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(json.error || "Erreur lors de la modification du client.");
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
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="premium-card w-full max-w-lg overflow-y-auto max-h-[90vh] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-light tracking-wide text-[var(--foreground)]">
            Modifier — {client.first_name} {client.last_name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary rounded-lg border border-[var(--border-soft)] px-3 py-1 text-sm text-[var(--muted)]"
          >
            Fermer
          </button>
        </div>

        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">Prénom</label>
              <input
                required
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                className="premium-input w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">Nom</label>
              <input
                required
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                className="premium-input w-full"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">Téléphone</label>
            <input
              required
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="premium-input w-full"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">Email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Optionnel"
              className="premium-input w-full"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">Adresse</label>
            <input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              className="premium-input w-full"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted)]">Notes</label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="premium-input min-h-24 w-full"
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={submitting}
            className="premium-btn w-full px-3 py-2.5 text-sm disabled:opacity-60"
          >
            {submitting ? "Enregistrement…" : "Enregistrer les modifications"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function ClientsClient({ initialClients }: ClientsClientProps) {
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const query = search.trim().toLowerCase();
  const filteredClients = query
    ? clients.filter((client) =>
        [client.first_name, client.last_name, client.phone, client.email, client.address].some((value) =>
          (value ?? "").toLowerCase().includes(query)
        )
      )
    : clients;

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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-light tracking-wide text-[var(--foreground)]">Clients</h2>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher (nom, téléphone, email…)"
            className="premium-input w-full sm:max-w-xs"
          />
        </div>
        {loading ? <p className="mt-3 text-sm text-[var(--muted)]">Chargement...</p> : null}
        {!loading && clients.length > 0 && filteredClients.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted)]">Aucun client ne correspond à « {search} ».</p>
        ) : null}
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-[var(--muted)]">
                <th className="pb-3 pr-4 font-medium">Nom</th>
                <th className="pb-3 pr-4 font-medium">Téléphone</th>
                <th className="pb-3 pr-4 font-medium">Email</th>
                <th className="pb-3 pr-4 font-medium">Adresse</th>
                <th className="pb-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client) => (
                <tr key={client.id} className="border-t border-[var(--border-soft)] text-[var(--muted)]">
                  <td className="py-4 pr-4 text-[var(--foreground)]">
                    {client.first_name} {client.last_name}
                  </td>
                  <td className="py-4 pr-4">{client.phone}</td>
                  <td className="py-4 pr-4">{client.email || "-"}</td>
                  <td className="py-4 pr-4">{client.address || "-"}</td>
                  <td className="py-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingClient(client)}
                        className="btn-secondary rounded-lg border border-[var(--border-soft)] bg-white px-3 py-1.5 text-xs text-[var(--muted)]"
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteClient(client.id)}
                        className="btn-danger rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs text-rose-700"
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
        {!loading && clients.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted)]">Aucun client enregistré.</p>
        ) : null}
      </article>

      {editingClient ? (
        <EditClientModal
          client={editingClient}
          onClose={() => setEditingClient(null)}
          onSaved={loadClients}
        />
      ) : null}
    </section>
  );
}
