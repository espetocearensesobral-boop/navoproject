import React, { useRef, useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Users, Search, Edit2, Trash2, Plus, Star, Award, ShieldCheck, Mail, Phone, Calendar, AlertCircle, AlertTriangle, X } from 'lucide-react';
import { authFetch } from '../../lib/api';
import { z } from 'zod';
import { formatPhone } from '../../utils/masks';
import { handleEnterAsTab } from '../../utils/formUtils';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { AdminPageHeader } from './shared/AdminPageHeader';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { AdminListSkeleton } from './shared/AdminSkeleton';
import { AdminEmptyState } from './shared/AdminEmptyState';
import { useToast } from '../ui/Toast';
import { Button } from '../ui/Button';
import { AdminLabel } from '../ui/AdminLabel';

const clientFormSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome.'),
  email: z.string().trim().email('Informe um e-mail válido.'),
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
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
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
    name: '',
    email: '',
    phone: '',
    birthday: '',
    password: '',
    role: 'client',
    loyaltyPoints: 0,
    loyaltyTier: 'Bronze'
  });

  useEffect(() => {
    loadClients(debouncedSearch);
  }, [debouncedSearch]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 180);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadClients = async (query = '') => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      const res = await authFetch(`/api/profiles${params.toString() ? `?${params.toString()}` : ''}`);
      const data = await res.json();
      setClients(Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn(e);
      setClients([]);
      setLoadError('Não foi possível carregar os clientes.');
    } finally {
      setLoading(false);
    }
  };

  const [selectedTier, setSelectedTier] = useState<string>('all');

  const safeClients = Array.isArray(clients) ? clients : [];
  const normalizedSearch = debouncedSearch.trim().toLowerCase();
  const normalizedPhoneSearch = normalizedSearch.replace(/\D/g, '');
  const filteredClients = safeClients.filter(c => {
    const name = (c.name || '').toLowerCase();
    const email = (c.email || '').toLowerCase();
    const phone = c.phone || '';
    const normalizedPhone = phone.replace(/\D/g, '');
    const matchesSearch = !normalizedSearch
      || name.includes(normalizedSearch)
      || email.includes(normalizedSearch)
      || (normalizedPhoneSearch.length > 0 && normalizedPhone.includes(normalizedPhoneSearch));

    if (!matchesSearch) return false;

    const tier = (c.loyaltyTier || 'Bronze').toLowerCase();
    const role = (c.role || 'client').toLowerCase();
    if (selectedTier === 'vip') return tier === 'ouro' || tier === 'diamante';
    if (selectedTier === 'admin') return role === 'admin';
    if (selectedTier !== 'all') return tier === selectedTier.toLowerCase();
    return true;
  });

  const totalPoints = safeClients.reduce((acc, c) => acc + (c.loyaltyPoints || 0), 0);
  const vipCount = safeClients.filter(c => {
    const tier = (c.loyaltyTier || '').toLowerCase();
    return tier === 'ouro' || tier === 'diamante';
  }).length;

  const handleOpenModal = (client?: Profile) => {
    setFieldErrors({});
    if (client) {
      setEditingClient(client);
      setFormData({
        name: client.name,
        email: client.email,
        phone: client.phone || '',
        birthday: client.birthday || '',
        password: '',
        role: client.role,
        loyaltyPoints: client.loyaltyPoints,
        loyaltyTier: client.loyaltyTier
      });
    } else {
      setEditingClient(null);
      setFormData({
        name: '',
        email: '',
        phone: '',
        password: '',
        role: 'client',
        loyaltyPoints: 0,
        loyaltyTier: 'Bronze'
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
      const nextErrors = validation.error.issues.reduce<ClientFieldErrors>((result, issue) => {
        const field = issue.path[0] as ClientField;
        if (!result[field]) result[field] = issue.message;
        return result;
      }, {});
      setFieldErrors(nextErrors);
      return;
    }

    setFieldErrors({});
    setErrorMsg(null);
    try {
      const method = editingClient ? 'PUT' : 'POST';
      const url = editingClient ? `/api/profiles/${editingClient.id}` : '/api/profiles';
      
      const res = await authFetch(url, {
        method,
        body: JSON.stringify(formData)
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao salvar cliente');
      }

      const successTitle = editingClient ? 'Cliente atualizado' : 'Cliente cadastrado';
      showToast('success', successTitle, 'A lista de clientes foi atualizada.');
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
      const res = await authFetch(`/api/profiles/${deleteTargetId}`, { method: 'DELETE' });
      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        throw new Error(errorBody?.error || 'Não foi possível excluir o cliente.');
      }
      showToast('success', 'Cliente excluído', 'A lista de clientes foi atualizada.');
      await loadClients(debouncedSearch);
    } catch (error: any) {
      showToast('error', 'Erro ao excluir', error?.message || 'Não foi possível excluir o cliente.');
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
          { label: 'clientes', value: safeClients.length },
          { label: 'VIP', value: vipCount, tone: 'gold' },
          { label: 'pts totais', value: totalPoints, tone: 'info' },
        ]}
        action={{ label: 'Novo cliente', onClick: () => handleOpenModal() }}
      />

      {/* MOBILE CTA + TOP BAR: mesmo padrão de Produtos & Estoque */}
      <div className="md:hidden space-y-2">
        <Button
          type="button"
          onClick={() => handleOpenModal()}
          title="Novo cliente"
          aria-label="Novo cliente"
          className="w-full h-10 shadow-md active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Novo cliente</span>
        </Button>
      </div>
      <div className="md:hidden flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
          <input
            type="text"
            placeholder="Nome, e-mail ou telefone..."
            title="Busca local nos clientes carregados"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-card border border-border-subtle rounded-xl pl-8 pr-3 py-2 text-xs text-content-base placeholder:text-content-muted focus:outline-none focus:border-gold-base"
          />
        </div>

      </div>

      {/* HORIZONTAL FILTER PILLS */}
      <div data-gesture-scroll="horizontal" className="admin-category-scroll flex items-center gap-2 overflow-x-auto no-scrollbar py-1 -mx-1 px-1">
        {[
          { id: 'all', label: 'Todos', count: safeClients.length },
          { id: 'vip', label: 'VIP', count: vipCount },
          { id: 'bronze', label: 'Bronze' },
          { id: 'prata', label: 'Prata' },
          { id: 'ouro', label: 'Ouro' },
          { id: 'diamante', label: 'Diamante' },
          { id: 'admin', label: 'Admins' },
        ].map((pill) => (
          <button
            key={pill.id}
            onClick={() => setSelectedTier(pill.id)}
            className={`shrink-0 min-h-11 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all border ${
              selectedTier === pill.id
                ? 'bg-gold-base text-surface-base border-gold-base'
                : 'bg-surface-card text-content-muted border-border-subtle hover:text-content-base hover:border-border-subtle'
            }`}
          >
            <span>{pill.label}</span>
            {pill.count !== undefined && (
              <span className={`ml-1 px-1.5 py-0.2 rounded-full text-xs ${
                selectedTier === pill.id ? 'bg-surface-base/15 text-surface-base' : 'bg-surface-card text-content-muted'
              }`}>
                {pill.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* DESKTOP SEARCH BAR (MD AND UP) */}
      <div className="hidden md:flex bg-surface-card p-3 rounded-xl border border-border-subtle justify-between items-center">
        <div className="relative w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
          <input
            type="text"
            placeholder="Nome, e-mail ou telefone..."
            title="Busca local nos clientes carregados"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-card border border-border-subtle rounded-xl pl-8 pr-3 py-1.5 text-xs text-content-base focus:outline-none focus:border-gold-base"
          />
        </div>
        <p className="text-xs text-content-muted font-bold">
          Exibindo <span className="text-content-base">{filteredClients.length}</span> resultados
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
          {/* RESPONSIVE CLIENT LIST */}
          <div className="space-y-2">
            {filteredClients.map((client, index) => {
              const isExpanded = expandedClientId === client.id;
              const tier = client.loyaltyTier || 'Bronze';
              const isAdmin = (client.role || '').toLowerCase() === 'admin';

              return (
                <article key={client.id} style={{ animationDelay: `${Math.min(index, 6) * 24}ms` }} className={`admin-list-item-enter overflow-hidden rounded-2xl border bg-surface-card transition-colors ${isExpanded ? 'border-gold-base/50' : 'border-border-subtle'}`}>
                  <button
                    type="button"
                    onClick={() => setExpandedClientId(isExpanded ? null : client.id)}
                    aria-expanded={isExpanded}
                    className="w-full min-h-[82px] p-3.5 sm:p-4 text-left flex items-center gap-3 sm:gap-4 hover:bg-surface-base/40 active:scale-[0.995] transition-[transform,background-color] duration-150"
                  >
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-surface-base border border-border-subtle flex items-center justify-center text-gold-hover font-bold text-sm shrink-0 overflow-hidden">
                      {client.avatarUrl ? <img src={client.avatarUrl} alt="" className="w-full h-full object-cover" /> : (client.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="text-sm sm:text-base font-bold text-content-base admin-clamp-2">{client.name || 'Cliente sem nome'}</h3>
                        <span className="shrink-0 px-2 py-1 rounded-md bg-gold-base/10 text-gold-hover text-xs font-bold">{tier}</span>
                      </div>
                      <p className="text-xs text-content-muted admin-safe-wrap">{client.email || 'E-mail não informado'}</p>
                      <p className="text-xs text-content-muted admin-safe-wrap">{client.birthday ? `Aniversário em ${new Date(`${client.birthday}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}` : 'Aniversário não informado'}</p>
                    </div>
                    <div className="hidden sm:block text-right shrink-0 min-w-[78px]">
                      <p className="text-xs text-content-muted">Fidelidade</p>
                      <p className="text-sm font-bold text-gold-base">{client.loyaltyPoints || 0} pts</p>
                    </div>
                    <div className="hidden md:block text-right shrink-0 min-w-[70px]">
                      <p className="text-xs text-content-muted">Papel</p>
                      <p className="text-xs font-semibold text-content-base capitalize">{client.role || 'client'}</p>
                    </div>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-gold-base shrink-0" /> : <ChevronDown className="w-5 h-5 text-content-muted shrink-0" />}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border-subtle bg-surface-base/35 p-3.5 sm:p-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <div className="rounded-xl bg-surface-base p-3"><p className="text-xs text-content-muted uppercase tracking-wider">Contato</p><p className="mt-1 text-content-base font-semibold break-words">{client.email || 'E-mail não informado'}</p><p className="text-content-muted">{client.phone || 'Telefone não informado'}</p><p className="text-content-muted">{client.birthday ? `Aniversário: ${new Date(`${client.birthday}T12:00:00`).toLocaleDateString('pt-BR')}` : 'Aniversário não informado'}</p></div>
                        <div className="rounded-xl bg-surface-base p-3"><p className="text-xs text-content-muted uppercase tracking-wider">Fidelidade</p><p className="mt-1 text-content-base font-semibold">{tier}</p><p className="text-gold-base font-bold">{client.loyaltyPoints || 0} pontos</p></div>
                        <div className="rounded-xl bg-surface-base p-3"><p className="text-xs text-content-muted uppercase tracking-wider">Papel e cadastro</p><p className="mt-1 text-content-base font-semibold capitalize">{client.role || 'client'}</p><p className="text-content-muted">Atualizado em {client.updatedAt ? new Date(client.updatedAt).toLocaleDateString('pt-BR') : '—'}</p></div>
                      </div>
                      <div className="admin-action-group">
                        {client.phone && <a href={`https://wa.me/55${client.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" title="Abrir WhatsApp" aria-label="Abrir WhatsApp" className="admin-action-icon min-h-10 min-w-10 px-2 sm:px-4 rounded-xl border border-status-success/30 text-status-success text-sm font-semibold flex items-center justify-center gap-1.5"><Phone className="w-4 h-4" /><span className="hidden sm:inline">WhatsApp</span></a>}
                        <button type="button" onClick={() => handleOpenModal(client)} title="Editar cliente" aria-label="Editar cliente" className="admin-action-icon min-h-10 min-w-10 px-2 sm:px-4 rounded-xl bg-gold-base text-surface-base text-sm font-bold flex items-center justify-center gap-1.5"><Edit2 className="w-4 h-4" /><span className="hidden sm:inline">Editar</span></button>
                        <button type="button" onClick={() => handleDelete(client.id)} disabled={isDeleting} title="Excluir cliente" aria-label="Excluir cliente" className="admin-action-icon min-h-10 min-w-10 px-2 sm:px-4 rounded-xl border border-status-error/25 text-status-error text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-status-error/10 disabled:cursor-not-allowed disabled:opacity-50 transition-colors">
                          {isDeleting && deleteTargetId === client.id ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-status-error/30 border-t-status-error" aria-hidden="true" /> : <Trash2 className="w-4 h-4" />}
                          <span className="hidden sm:inline">{isDeleting && deleteTargetId === client.id ? 'Excluindo…' : 'Excluir'}</span>
                        </button>
                        {isAdmin && <span title="Administrador" aria-label="Administrador" className="admin-action-icon min-h-10 min-w-10 px-2 sm:px-4 rounded-xl bg-purple-500/15 text-purple-300 text-sm font-semibold flex items-center justify-center gap-1.5"><ShieldCheck className="w-4 h-4" /><span className="hidden sm:inline">Administrador</span></span>}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}

            {!loadError && filteredClients.length === 0 && (
              <AdminEmptyState
                icon={Users}
                title={normalizedSearch || selectedTier !== 'all' ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
                description={normalizedSearch || selectedTier !== 'all' ? 'Ajuste a busca ou o filtro para tentar novamente.' : 'Cadastre o primeiro cliente para acompanhar contatos, fidelidade e agenda.'}
                actionLabel={!normalizedSearch && selectedTier === 'all' ? 'Novo cliente' : undefined}
                onAction={!normalizedSearch && selectedTier === 'all' ? () => handleOpenModal() : undefined}
              />
            )}
          </div>        </>
      )}

      {/* COMPACT MODULAR CLIENT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-surface-base/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden" onClick={() => setIsModalOpen(false)}>
          <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="client-dialog-title" onClick={(event) => event.stopPropagation()} className="bg-surface-card border border-border-subtle sm:border-gold-base/30 rounded-t-2xl sm:rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[94dvh] sm:max-h-[90vh] animate-fade-in">
            {/* Header */}
            <div className="p-3.5 bg-surface-base border-b border-border-subtle flex justify-between items-center gap-2 shrink-0">
              <div className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-border-subtle sm:hidden" aria-hidden="true" />
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-gold-base/10 border border-gold-base/30 flex items-center justify-center text-gold-hover shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h2 id="client-dialog-title" className="text-sm font-bold text-content-base truncate">
                    {editingClient ? `Editar: ${editingClient.name}` : 'Novo cliente'}
                  </h2>
                  <p className="text-xs text-content-muted truncate">Ajuste informações de contato e pontuação</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="Fechar cliente"
                className="w-7 h-7 rounded-xl bg-surface-card text-content-muted hover:text-content-base flex items-center justify-center transition-colors shrink-0"
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

              <form id="clientForm" onSubmit={handleSave} className="space-y-3" onKeyDown={handleEnterAsTab}>
                <div>
                  <AdminLabel tone="accent">Nome Completo *</AdminLabel>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => { setFormData({ ...formData, name: e.target.value }); setFieldErrors((current) => ({ ...current, name: undefined })); }}
                    aria-invalid={Boolean(fieldErrors.name)}
                    aria-describedby={fieldErrors.name ? 'client-name-error' : undefined}
                    placeholder="Ex: Carlos Silva"
                    className={`w-full bg-surface-base border rounded-xl px-3 py-2 text-xs text-content-base focus:outline-none focus:border-gold-base ${fieldErrors.name ? 'border-status-error' : 'border-border-subtle'}`}
                  />
                  {fieldErrors.name && <p id="client-name-error" className="mt-1 text-xs text-status-error">{fieldErrors.name}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <AdminLabel tone="accent">E-mail *</AdminLabel>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={e => { setFormData({ ...formData, email: e.target.value }); setFieldErrors((current) => ({ ...current, email: undefined })); }}
                      aria-invalid={Boolean(fieldErrors.email)}
                      aria-describedby={fieldErrors.email ? 'client-email-error' : undefined}
                      placeholder="carlos@email.com"
                      className={`w-full bg-surface-base border rounded-xl px-3 py-2 text-xs text-content-base focus:outline-none focus:border-gold-base ${fieldErrors.email ? 'border-status-error' : 'border-border-subtle'}`}
                    />
                    {fieldErrors.email && <p id="client-email-error" className="mt-1 text-xs text-status-error">{fieldErrors.email}</p>}
                  </div>
                  <div>
                    <AdminLabel tone="accent">Telefone</AdminLabel>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={e => { setFormData({ ...formData, phone: formatPhone(e.target.value) }); setFieldErrors((current) => ({ ...current, phone: undefined })); }}
                      aria-invalid={Boolean(fieldErrors.phone)}
                      aria-describedby={fieldErrors.phone ? 'client-phone-error' : undefined}
                      placeholder="(11) 99999-9999"
                      className={`w-full bg-surface-base border rounded-xl px-3 py-2 text-xs text-content-base focus:outline-none focus:border-gold-base ${fieldErrors.phone ? 'border-status-error' : 'border-border-subtle'}`}
                    />
                    {fieldErrors.phone && <p id="client-phone-error" className="mt-1 text-xs text-status-error">{fieldErrors.phone}</p>}
                  </div>
                </div>

                <div>
                  <AdminLabel tone="accent">Data de aniversário <span className="text-content-muted font-normal">(opcional)</span></AdminLabel>
                  <input
                    type="date"
                    value={formData.birthday}
                    onChange={e => setFormData({ ...formData, birthday: e.target.value })}
                    className="w-full bg-surface-base border border-border-subtle rounded-xl px-3 py-2 text-xs text-content-base focus:outline-none focus:border-gold-base"
                  />
                </div>

                <div>
                  <AdminLabel tone="accent">
                    Senha {editingClient && <span className="text-content-muted font-normal">(Deixe em branco para manter)</span>}
                  </AdminLabel>
                  <input
                    type="password"
                    required={!editingClient}
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full bg-surface-base border border-border-subtle rounded-xl px-3 py-2 text-xs text-content-base focus:outline-none focus:border-gold-base"
                  />
                </div>

                <div className="p-3 bg-surface-base border border-border-subtle rounded-xl space-y-2.5">
                  <p className="text-xs font-bold text-gold-hover uppercase tracking-wider">Fidelidade & Permissões</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <AdminLabel tone="muted">Papel</AdminLabel>
                      <select
                        value={formData.role}
                        onChange={e => setFormData({ ...formData, role: e.target.value })}
                        className="w-full bg-surface-card border border-border-subtle rounded-xl px-2.5 py-1.5 text-xs text-content-base focus:outline-none focus:border-gold-base"
                      >
                        <option value="client">Cliente</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </div>

                    <div>
                      <AdminLabel tone="muted">Nível Fidelidade</AdminLabel>
                      <select
                        value={formData.loyaltyTier}
                        onChange={e => setFormData({ ...formData, loyaltyTier: e.target.value })}
                        className="w-full bg-surface-card border border-border-subtle rounded-xl px-2.5 py-1.5 text-xs text-content-base focus:outline-none focus:border-gold-base"
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
                      onChange={e => setFormData({ ...formData, loyaltyPoints: parseInt(e.target.value) || 0 })}
                      className="w-full bg-surface-card border border-border-subtle rounded-xl px-2.5 py-1.5 text-xs text-content-base focus:outline-none focus:border-gold-base"
                    />
                  </div>
                </div>
              </form>
            </div>

            {/* Footer */}
            <div className="p-3 bg-surface-base border-t border-border-subtle flex justify-end gap-2 shrink-0">
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
    </div>
  );
};
