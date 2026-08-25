import React, { useRef, useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronUp,
  Users,
  Search,
  Edit2,
  Trash2,
  Plus,
  Star,
  Award,
  ShieldCheck,
  Mail,
  Phone,
  Calendar,
  AlertCircle,
  AlertTriangle,
  X,
} from "lucide-react";
import { authFetch } from "../../lib/api";
import { z } from "zod";
import { formatPhone } from "../../utils/masks";
import { handleEnterAsTab } from "../../utils/formUtils";
import { useDialogFocus } from "../../hooks/useDialogFocus";
import { AdminPageHeader } from "./shared/AdminPageHeader";
import { AdminFab } from "./shared/AdminFab";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { AdminListSkeleton } from "./shared/AdminSkeleton";
import { AdminEmptyState } from "./shared/AdminEmptyState";
import { useToast } from "../ui/Toast";
import { Button } from "../ui/Button";
import { AdminLabel } from "../ui/AdminLabel";

const clientFormSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome."),
  email: z.string().trim().email("Informe um e-mail válido."),
  phone: z.string().trim().optional(),
  birthday: z.string().optional(),
});

type ClientField = keyof z.infer<typeof clientFormSchema>;

type ClientFieldErrors = Partial<Record<ClientField, string>>;

interface Profile {
  id: string;
  name: string;
  email: string;
  phone: string;
  birthday: string | null;
  role: string;
  avatarUrl: string | null;
  loyaltyPoints: number;
  loyaltyTier: string;
  createdAt: string;
  updatedAt: string;
}

export const ClientsManagement: React.FC = () => {
  const { showToast } = useToast();
  const [clients, setClients] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Profile | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ClientFieldErrors>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(isModalOpen, dialogRef);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    birthday: "",
    password: "",
    role: "client",
    loyaltyPoints: 0,
    loyaltyTier: "Bronze",
  });

  useEffect(() => {
    loadClients(debouncedSearch);
  }, [debouncedSearch]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 180);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadClients = async (query = "") => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      const res = await authFetch(
        `/api/profiles${params.toString() ? `?${params.toString()}` : ""}`,
      );
      const data = await res.json();
      setClients(Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn(e);
      setClients([]);
      setLoadError("Não foi possível carregar os clientes.");
    } finally {
      setLoading(false);
    }
  };

  const [selectedTier, setSelectedTier] = useState<string>("all");

  const safeClients = Array.isArray(clients) ? clients : [];
  const normalizedSearch = debouncedSearch.trim().toLowerCase();
  const normalizedPhoneSearch = normalizedSearch.replace(/\D/g, "");
  const filteredClients = safeClients.filter((c) => {
    const name = (c.name || "").toLowerCase();
    const email = (c.email || "").toLowerCase();
    const phone = c.phone || "";
    const normalizedPhone = phone.replace(/\D/g, "");
    const matchesSearch =
      !normalizedSearch ||
      name.includes(normalizedSearch) ||
      email.includes(normalizedSearch) ||
      (normalizedPhoneSearch.length > 0 &&
        normalizedPhone.includes(normalizedPhoneSearch));

    if (!matchesSearch) return false;

    const tier = (c.loyaltyTier || "Bronze").toLowerCase();
    const role = (c.role || "client").toLowerCase();
    if (selectedTier === "vip") return tier === "ouro" || tier === "diamante";
    if (selectedTier === "admin") return role === "admin";
    if (selectedTier !== "all") return tier === selectedTier.toLowerCase();
    return true;
  });

  const totalPoints = safeClients.reduce(
    (acc, c) => acc + (c.loyaltyPoints || 0),
    0,
  );
  const vipCount = safeClients.filter((c) => {
    const tier = (c.loyaltyTier || "").toLowerCase();
    return tier === "ouro" || tier === "diamante";
  }).length;

  const handleOpenModal = (client?: Profile) => {
    setFieldErrors({});
    if (client) {
      setEditingClient(client);
      setFormData({
        name: client.name,
        email: client.email,
        phone: client.phone || "",
        birthday: client.birthday || "",
        password: "",
        role: client.role,
        loyaltyPoints: client.loyaltyPoints,
        loyaltyTier: client.loyaltyTier,
      });
    } else {
      setEditingClient(null);
      setFormData({
        name: "",
        email: "",
        phone: "",
        password: "",
        role: "client",
        loyaltyPoints: 0,
        loyaltyTier: "Bronze",
      });
    }
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = clientFormSchema.safeParse({
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      birthday: formData.birthday,
    });

    if (!validation.success) {
      const nextErrors = validation.error.issues.reduce<ClientFieldErrors>(
        (result, issue) => {
          const field = issue.path[0] as ClientField;
          if (!result[field]) result[field] = issue.message;
          return result;
        },
        {},
      );
      setFieldErrors(nextErrors);
      return;
    }

    setFieldErrors({});
    setErrorMsg(null);
    try {
      const method = editingClient ? "PUT" : "POST";
      const url = editingClient
        ? `/api/profiles/${editingClient.id}`
        : "/api/profiles";

      const res = await authFetch(url, {
        method,
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao salvar cliente");
      }

      const successTitle = editingClient
        ? "Cliente atualizado"
        : "Cliente cadastrado";
      showToast("success", successTitle, "A lista de clientes foi atualizada.");
      setIsModalOpen(false);
      loadClients(debouncedSearch);
    } catch (error: any) {
      setErrorMsg(error.message);
    }
  };

  const handleDelete = (id: string) => {
    if (isDeleting) return;
    setDeleteTargetId(id);
  };

  const confirmDelete = async () => {
    if (!deleteTargetId || isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await authFetch(`/api/profiles/${deleteTargetId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        throw new Error(
          errorBody?.error || "Não foi possível excluir o cliente.",
        );
      }
      showToast(
        "success",
        "Cliente excluído",
        "A lista de clientes foi atualizada.",
      );
      await loadClients(debouncedSearch);
    } catch (error: any) {
      showToast(
        "error",
        "Erro ao excluir",
        error?.message || "Não foi possível excluir o cliente.",
      );
    } finally {
      setIsDeleting(false);
      setDeleteTargetId(null);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* HEADER (MD AND UP) */}
      <AdminPageHeader
        icon={Users}
        title="Clientes"
        stats={[
          { label: "clientes", value: safeClients.length },
          { label: "VIP", value: vipCount, tone: "gold" },
          { label: "pts totais", value: totalPoints, tone: "info" },
        ]}
      />

      {/* MOBILE SEARCH BAR */}
      <div className="md:hidden flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)]" />
          <input
            type="text"
            placeholder="Nome, e-mail ou telefone..."
            title="Busca local nos clientes carregados"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-xl pl-8 pr-3 py-2 text-xs text-[var(--admin-text-main)] placeholder:text-[var(--admin-text-muted)] focus:outline-none focus:border-[var(--admin-accent)]"
          />
        </div>
      </div>

      {/* HORIZONTAL FILTER PILLS */}
      <div
        data-gesture-scroll="horizontal"
        className="admin-category-scroll flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 -mx-1 px-1"
      >
        {[
          { id: "all", label: "Todos", count: safeClients.length },
          { id: "vip", label: "VIP", count: vipCount },
          { id: "bronze", label: "Bronze" },
          { id: "prata", label: "Prata" },
          { id: "ouro", label: "Ouro" },
          { id: "diamante", label: "Diamante" },
          { id: "admin", label: "Admins" },
        ].map((pill) => (
          <button
            key={pill.id}
            type="button"
            onClick={() => setSelectedTier(pill.id)}
            className={`shrink-0 min-h-9 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer ${
              selectedTier === pill.id
                ? "bg-[var(--admin-accent)] text-[var(--admin-accent-text)] border-[var(--admin-accent)] shadow-xs"
                : "bg-[var(--admin-surface)] text-[var(--admin-text-muted)] border-[var(--admin-border)] hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-bg)]"
            }`}
          >
            <span>{pill.label}</span>
            {pill.count !== undefined && (
              <span
                className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  selectedTier === pill.id
                    ? "bg-[var(--admin-bg)]/20 text-surface-base"
                    : "bg-[var(--admin-accent)]/10 text-[var(--admin-accent)]"
                }`}
              >
                {pill.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* DESKTOP SEARCH BAR (MD AND UP) */}
      <div className="hidden md:flex bg-[var(--admin-surface)] px-4 py-3 rounded-xl border border-[var(--admin-border)] justify-between items-center shadow-xs">
        <div className="relative w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)]" />
          <input
            type="text"
            placeholder="Nome, e-mail ou telefone..."
            title="Busca local nos clientes carregados"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-lg pl-9 pr-3 py-1.5 text-xs text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)] transition-colors"
          />
        </div>
        <p className="text-xs text-[var(--admin-text-muted)] font-medium">
          Exibindo{" "}
          <span className="text-[var(--admin-text-main)] font-bold">
            {filteredClients.length}
          </span>{" "}
          {filteredClients.length === 1 ? "cliente" : "clientes"}
        </p>
      </div>

      {loading ? (
        <AdminListSkeleton rows={5} />
      ) : (
        <>
          {loadError && (
            <AdminEmptyState
              icon={AlertCircle}
              title="Não foi possível carregar"
              description={loadError}
              actionLabel="Tentar novamente"
              onAction={() => loadClients(debouncedSearch)}
            />
          )}

          {/* DESKTOP TABLE VIEW (Hidden on Mobile) */}
          <div className="hidden md:block admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Contato</th>
                  <th>Fidelidade</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client) => {
                  const tier = client.loyaltyTier || "Bronze";
                  const isAdmin = (client.role || "").toLowerCase() === "admin";
                  
                  return (
                    <tr key={client.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[var(--admin-bg)] border border-[var(--admin-border)] flex items-center justify-center text-[var(--admin-accent)] font-bold text-sm shrink-0 overflow-hidden shadow-inner">
                            {client.avatarUrl ? (
                              <img src={client.avatarUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              (client.name || "?").charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-[var(--admin-text-main)] truncate text-[13px]">{client.name || "Sem nome"}</p>
                            {isAdmin && (
                              <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-400 uppercase tracking-wider border border-purple-500/30">
                                Admin
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <p className="text-[var(--admin-text-main)] truncate max-w-[200px] text-[13px]" title={client.email}>
                          {client.email || "—"}
                        </p>
                        <p className="text-[11px] text-[var(--admin-text-muted)] font-mono mt-0.5">
                          {client.phone || "—"}
                        </p>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="inline-block px-2 py-0.5 rounded bg-[var(--admin-accent)]/10 text-[var(--admin-accent)] text-xs font-bold border border-[var(--admin-accent)]/20 uppercase tracking-wider">
                            {tier}
                          </span>
                          <span className="font-bold text-[var(--admin-text-main)] text-[13px]">
                            {client.loyaltyPoints || 0} <span className="text-[11px] text-[var(--admin-text-muted)]">pts</span>
                          </span>
                        </div>
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {client.phone && (
                            <a
                              href={`https://wa.me/55${client.phone.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              title="Abrir WhatsApp"
                              className="admin-btn-icon-sm hover:text-status-success hover:bg-status-success/10 text-[var(--admin-text-muted)] flex items-center justify-center rounded"
                            >
                              <Phone className="w-4 h-4" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenModal(client)}
                            title="Editar"
                            className="admin-btn-icon-sm hover:text-[var(--admin-accent)] hover:bg-[var(--admin-accent)]/10 text-[var(--admin-text-muted)] flex items-center justify-center rounded"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(client.id)}
                            disabled={isDeleting}
                            title="Excluir"
                            className="admin-btn-icon-sm hover:text-status-error hover:bg-status-error/10 text-[var(--admin-text-muted)] flex items-center justify-center rounded disabled:opacity-50"
                          >
                            {isDeleting && deleteTargetId === client.id ? (
                              <span className="h-3 w-3 animate-spin rounded-full border border-status-error border-t-transparent" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredClients.length === 0 && !loadError && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[var(--admin-text-muted)]">
                      Nenhum cliente encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* MOBILE ACCORDION VIEW (Hidden on Desktop) */}
          <div className="md:hidden space-y-2">
            {filteredClients.map((client, index) => {
              const isExpanded = expandedClientId === client.id;
              const tier = client.loyaltyTier || "Bronze";
              const isAdmin = (client.role || "").toLowerCase() === "admin";

              return (
                <article
                  key={client.id}
                  style={{ animationDelay: `${Math.min(index, 6) * 24}ms` }}
                  className={`admin-list-item-enter overflow-hidden rounded-2xl border bg-[var(--admin-surface)] transition-colors ${isExpanded ? "border-[var(--admin-accent)]/50" : "border-[var(--admin-border)]"}`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedClientId(isExpanded ? null : client.id)
                    }
                    aria-expanded={isExpanded}
                    className="w-full min-h-[82px] p-3.5 text-left flex items-center gap-3 hover:bg-[var(--admin-bg)]/40 active:scale-[0.995] transition-[transform,background-color] duration-150"
                  >
                    <div className="w-11 h-11 rounded-full bg-[var(--admin-bg)] border border-[var(--admin-border)] flex items-center justify-center text-[var(--admin-accent)] font-bold text-sm shrink-0 overflow-hidden">
                      {client.avatarUrl ? (
                        <img
                          src={client.avatarUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        (client.name || "?").charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="text-sm font-bold text-[var(--admin-text-main)] admin-clamp-2">
                          {client.name || "Cliente sem nome"}
                        </h3>
                        <span className="shrink-0 px-2 py-1 rounded-md bg-[var(--admin-accent)]/10 text-[var(--admin-accent)] text-[10px] font-bold">
                          {tier}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--admin-text-muted)] admin-safe-wrap mt-0.5">
                        {client.email || "E-mail não informado"}
                      </p>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-[var(--admin-accent)] shrink-0" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-[var(--admin-text-muted)] shrink-0" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-[var(--admin-border)] bg-[var(--admin-bg)]/35 p-3.5 space-y-3">
                      <div className="grid grid-cols-1 gap-2 text-xs">
                        <div className="rounded-xl bg-[var(--admin-bg)] p-3">
                          <p className="text-[10px] text-[var(--admin-text-muted)] uppercase tracking-wider font-bold mb-1.5">
                            Contato e Info
                          </p>
                          <p className="text-[var(--admin-text-main)] font-semibold break-words">
                            {client.email || "—"}
                          </p>
                          <p className="text-[var(--admin-text-muted)] mt-1">
                            {client.phone || "Sem telefone"}
                          </p>
                          {client.birthday && (
                            <p className="text-[var(--admin-text-muted)] mt-1 flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5" />
                              {new Date(`${client.birthday}T12:00:00`).toLocaleDateString("pt-BR")}
                            </p>
                          )}
                        </div>
                        <div className="rounded-xl bg-[var(--admin-bg)] p-3 flex justify-between items-center">
                           <div>
                             <p className="text-[10px] text-[var(--admin-text-muted)] uppercase tracking-wider font-bold mb-1">
                               Pontos
                             </p>
                             <p className="text-[var(--admin-accent)] font-bold text-base">
                               {client.loyaltyPoints || 0} pts
                             </p>
                           </div>
                           <div className="text-right">
                              <p className="text-[10px] text-[var(--admin-text-muted)] uppercase tracking-wider font-bold mb-1">
                                Nível
                              </p>
                              <p className="text-[var(--admin-text-main)] font-semibold">
                                {tier}
                              </p>
                           </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {client.phone && (
                          <a
                            href={`https://wa.me/55${client.phone.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 min-h-10 px-3 rounded-xl border border-status-success/30 bg-status-success/5 text-status-success text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                          >
                            <Phone className="w-4 h-4" />
                            WhatsApp
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenModal(client)}
                          className="flex-1 min-h-10 px-3 rounded-xl bg-[var(--admin-accent)] text-[var(--admin-accent-text)] text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                        >
                          <Edit2 className="w-4 h-4" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(client.id)}
                          disabled={isDeleting}
                          className="flex-none min-h-10 min-w-10 px-3 rounded-xl border border-status-error/25 bg-status-error/5 text-status-error flex items-center justify-center hover:bg-status-error/10 active:scale-95 transition-all disabled:opacity-50"
                        >
                          {isDeleting && deleteTargetId === client.id ? (
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-status-error/30 border-t-status-error" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}

            {!loadError && filteredClients.length === 0 && (
              <AdminEmptyState
                icon={Users}
                title={
                  normalizedSearch || selectedTier !== "all"
                    ? "Nenhum cliente encontrado"
                    : "Nenhum cliente cadastrado"
                }
                description={
                  normalizedSearch || selectedTier !== "all"
                    ? "Ajuste a busca ou o filtro para tentar novamente."
                    : "Cadastre o primeiro cliente para acompanhar contatos, fidelidade e agenda."
                }
                actionLabel={
                  !normalizedSearch && selectedTier === "all"
                    ? "Novo cliente"
                    : undefined
                }
                onAction={
                  !normalizedSearch && selectedTier === "all"
                    ? () => handleOpenModal()
                    : undefined
                }
              />
            )}
          </div>
        </>
      )}

      {/* COMPACT MODULAR CLIENT MODAL */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-[var(--admin-bg)]/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="client-dialog-title"
            onClick={(event) => event.stopPropagation()}
            className="bg-[var(--admin-surface)] border border-[var(--admin-border)] sm:border-[var(--admin-accent)]/30 rounded-t-2xl sm:rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[94dvh] sm:max-h-[90vh] animate-fade-in"
          >
            {/* Header */}
            <div className="p-3.5 bg-[var(--admin-bg)] border-b border-[var(--admin-border)] flex justify-between items-center gap-2 shrink-0">
              <div
                className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-[var(--admin-border)] sm:hidden"
                aria-hidden="true"
              />
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-[var(--admin-accent)]/10 border border-[var(--admin-accent)]/30 flex items-center justify-center text-[var(--admin-accent)] shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h2
                    id="client-dialog-title"
                    className="text-sm font-bold text-[var(--admin-text-main)] truncate"
                  >
                    {editingClient
                      ? `Editar: ${editingClient.name}`
                      : "Novo cliente"}
                  </h2>
                  <p className="text-xs text-[var(--admin-text-muted)] truncate">
                    Ajuste informações de contato e pontuação
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="Fechar cliente"
                className="w-7 h-7 rounded-xl bg-[var(--admin-surface)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] flex items-center justify-center transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="p-4 overflow-y-auto space-y-3 custom-scrollbar flex-1">
              {errorMsg && (
                <div className="p-2.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs font-bold">
                  {errorMsg}
                </div>
              )}

              <form
                id="clientForm"
                onSubmit={handleSave}
                className="space-y-3"
                onKeyDown={handleEnterAsTab}
              >
                <div>
                  <AdminLabel tone="accent">Nome Completo *</AdminLabel>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({ ...formData, name: e.target.value });
                      setFieldErrors((current) => ({
                        ...current,
                        name: undefined,
                      }));
                    }}
                    aria-invalid={Boolean(fieldErrors.name)}
                    aria-describedby={
                      fieldErrors.name ? "client-name-error" : undefined
                    }
                    placeholder="Ex: Carlos Silva"
                    className={`w-full bg-[var(--admin-bg)] border rounded-xl px-3 py-2 text-xs text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)] ${fieldErrors.name ? "border-status-error" : "border-[var(--admin-border)]"}`}
                  />
                  {fieldErrors.name && (
                    <p
                      id="client-name-error"
                      className="mt-1 text-xs text-status-error"
                    >
                      {fieldErrors.name}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <AdminLabel tone="accent">E-mail *</AdminLabel>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => {
                        setFormData({ ...formData, email: e.target.value });
                        setFieldErrors((current) => ({
                          ...current,
                          email: undefined,
                        }));
                      }}
                      aria-invalid={Boolean(fieldErrors.email)}
                      aria-describedby={
                        fieldErrors.email ? "client-email-error" : undefined
                      }
                      placeholder="carlos@email.com"
                      className={`w-full bg-[var(--admin-bg)] border rounded-xl px-3 py-2 text-xs text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)] ${fieldErrors.email ? "border-status-error" : "border-[var(--admin-border)]"}`}
                    />
                    {fieldErrors.email && (
                      <p
                        id="client-email-error"
                        className="mt-1 text-xs text-status-error"
                      >
                        {fieldErrors.email}
                      </p>
                    )}
                  </div>
                  <div>
                    <AdminLabel tone="accent">Telefone</AdminLabel>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          phone: formatPhone(e.target.value),
                        });
                        setFieldErrors((current) => ({
                          ...current,
                          phone: undefined,
                        }));
                      }}
                      aria-invalid={Boolean(fieldErrors.phone)}
                      aria-describedby={
                        fieldErrors.phone ? "client-phone-error" : undefined
                      }
                      placeholder="(11) 99999-9999"
                      className={`w-full bg-[var(--admin-bg)] border rounded-xl px-3 py-2 text-xs text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)] ${fieldErrors.phone ? "border-status-error" : "border-[var(--admin-border)]"}`}
                    />
                    {fieldErrors.phone && (
                      <p
                        id="client-phone-error"
                        className="mt-1 text-xs text-status-error"
                      >
                        {fieldErrors.phone}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <AdminLabel tone="accent">
                    Data de aniversário{" "}
                    <span className="text-[var(--admin-text-muted)] font-normal">
                      (opcional)
                    </span>
                  </AdminLabel>
                  <input
                    type="date"
                    value={formData.birthday}
                    onChange={(e) =>
                      setFormData({ ...formData, birthday: e.target.value })
                    }
                    className="w-full bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-xl px-3 py-2 text-xs text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)]"
                  />
                </div>

                <div>
                  <AdminLabel tone="accent">
                    Senha{" "}
                    {editingClient && (
                      <span className="text-[var(--admin-text-muted)] font-normal">
                        (Deixe em branco para manter)
                      </span>
                    )}
                  </AdminLabel>
                  <input
                    type="password"
                    required={!editingClient}
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    placeholder="••••••••"
                    className="w-full bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-xl px-3 py-2 text-xs text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)]"
                  />
                </div>

                <div className="p-3 bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-xl space-y-2.5">
                  <p className="text-xs font-bold text-[var(--admin-accent)] uppercase tracking-wider">
                    Fidelidade & Permissões
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <AdminLabel tone="muted">Papel</AdminLabel>
                      <select
                        value={formData.role}
                        onChange={(e) =>
                          setFormData({ ...formData, role: e.target.value })
                        }
                        className="w-full bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-xl px-2.5 py-1.5 text-xs text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)]"
                      >
                        <option value="client">Cliente</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </div>

                    <div>
                      <AdminLabel tone="muted">Nível Fidelidade</AdminLabel>
                      <select
                        value={formData.loyaltyTier}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            loyaltyTier: e.target.value,
                          })
                        }
                        className="w-full bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-xl px-2.5 py-1.5 text-xs text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)]"
                      >
                        <option value="Bronze">Bronze</option>
                        <option value="Prata">Prata</option>
                        <option value="Ouro">Ouro</option>
                        <option value="Diamante">Diamante</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <AdminLabel tone="muted">Pontos de Fidelidade</AdminLabel>
                    <input
                      type="number"
                      min="0"
                      value={formData.loyaltyPoints}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          loyaltyPoints: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-xl px-2.5 py-1.5 text-xs text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)]"
                    />
                  </div>
                </div>
              </form>
            </div>

            {/* Footer */}
            <div className="p-3 bg-[var(--admin-bg)] border-t border-[var(--admin-border)] flex justify-end gap-2 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                form="clientForm"
                variant="primary"
                size="sm"
              >
                Salvar
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(deleteTargetId)}
        onClose={() => !isDeleting && setDeleteTargetId(null)}
        onConfirm={confirmDelete}
        title="Excluir cliente?"
        description="Esta ação não pode ser desfeita. O histórico de fidelidade e os vínculos do cliente serão removidos."
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="danger"
        isLoading={isDeleting}
        icon={<AlertTriangle className="h-6 w-6" aria-hidden="true" />}
      />

      <AdminFab
        onClick={() => handleOpenModal()}
        label="Novo Cliente"
        icon={Plus}
      />
    </div>
  );
};
