import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Users, Search, Edit2, Trash2, Plus, Star, Award, ShieldCheck, Mail, Phone, Calendar, CheckCircle2, X } from 'lucide-react';
import { authFetch } from '../../lib/api';
import { formatPhone } from '../../utils/masks';
import { handleEnterAsTab } from '../../utils/formUtils';
import { AdminPageHeader } from './shared/AdminPageHeader';
import { Button } from '../ui/Button';
import { AdminLabel } from '../ui/AdminLabel';

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
  const [clients, setClients] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Profile | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
    loadClients();
  }, []);

  const loadClients = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/profiles');
      const data = await res.json();
      setClients(Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn(e);
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  const [selectedTier, setSelectedTier] = useState<string>('all');

  const safeClients = Array.isArray(clients) ? clients : [];
  const normalizedSearch = search.trim().toLowerCase();
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

      setSuccessMsg(`Cliente ${editingClient ? 'atualizado' : 'cadastrado'} com sucesso!`);
      setIsModalOpen(false);
      loadClients();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (error: any) {
      setErrorMsg(error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este cliente?')) return;
    try {
      const res = await authFetch(`/api/profiles/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao excluir');
      setSuccessMsg('Cliente excluído com sucesso!');
      loadClients();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (error: any) {
      console.warn(error);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* HEADER (MD AND UP) */}
      <AdminPageHeader
        icon={Users}
        title="Gestão de Clientes"
        stats={[
          { label: 'clientes', value: safeClients.length },
          { label: 'VIP', value: vipCount, tone: 'gold' },
          { label: 'pts totais', value: totalPoints, tone: 'info' },
        ]}
        action={{ label: 'Novo Cliente', onClick: () => handleOpenModal() }}
      />

      {/* MOBILE CTA + TOP BAR: mesmo padrão de Produtos & Estoque */}
      <div className="md:hidden space-y-2">
        <Button
          type="button"
          onClick={() => handleOpenModal()}
          title="Cadastrar novo cliente"
          aria-label="Cadastrar novo cliente"
          className="w-full h-10 shadow-md active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Cliente</span>
        </Button>
      </div>
      <div className="md:hidden flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
          <input
            type="text"
            placeholder="Buscar por nome, email ou telefone..."
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
          { id: 'vip', label: 'VIP (Ouro/Diamante)', count: vipCount },
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
              <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${
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
            placeholder="Buscar por nome, email ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-card border border-border-subtle rounded-xl pl-8 pr-3 py-1.5 text-xs text-content-base focus:outline-none focus:border-gold-base"
          />
        </div>
        <p className="text-xs text-content-muted font-bold">
          Exibindo <span className="text-content-base">{filteredClients.length}</span> resultados
        </p>
      </div>

      {successMsg && (
        <div className="bg-status-success/10 border border-status-success/30 text-status-success p-3 rounded-xl flex items-center gap-2 text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-gold-base border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* RESPONSIVE CLIENT LIST */}
          <div className="space-y-2">
            {filteredClients.map((client) => {
              const isExpanded = expandedClientId === client.id;
              const tier = client.loyaltyTier || 'Bronze';
              const isAdmin = (client.role || '').toLowerCase() === 'admin';

              return (
                <article key={client.id} className={`overflow-hidden rounded-2xl border bg-surface-card transition-colors ${isExpanded ? 'border-gold-base/50' : 'border-border-subtle'}`}>
                  <button
                    type="button"
                    onClick={() => setExpandedClientId(isExpanded ? null : client.id)}
                    aria-expanded={isExpanded}
                    className="w-full min-h-[82px] p-3.5 sm:p-4 text-left flex items-center gap-3 sm:gap-4 hover:bg-surface-base/40"
                  >
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-surface-base border border-border-subtle flex items-center justify-center text-gold-hover font-bold text-sm shrink-0 overflow-hidden">
                      {client.avatarUrl ? <img src={client.avatarUrl} alt="" className="w-full h-full object-cover" /> : (client.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="text-sm sm:text-base font-bold text-content-base truncate">{client.name || 'Cliente sem nome'}</h3>
                        <span className="shrink-0 px-2 py-1 rounded-md bg-gold-base/10 text-gold-hover text-[10px] font-bold">{tier}</span>
                      </div>
                      <p className="text-xs text-content-muted truncate">{client.email || 'E-mail não informado'}</p>
                      <p className="text-[11px] text-content-muted truncate">{client.birthday ? `Aniversário em ${new Date(`${client.birthday}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}` : 'Aniversário não informado'}</p>
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
                        <div className="rounded-xl bg-surface-base p-3"><p className="text-[10px] text-content-muted uppercase tracking-wider">Contato</p><p className="mt-1 text-content-base font-semibold break-words">{client.email || 'E-mail não informado'}</p><p className="text-content-muted">{client.phone || 'Telefone não informado'}</p><p className="text-content-muted">{client.birthday ? `Aniversário: ${new Date(`${client.birthday}T12:00:00`).toLocaleDateString('pt-BR')}` : 'Aniversário não informado'}</p></div>
                        <div className="rounded-xl bg-surface-base p-3"><p className="text-[10px] text-content-muted uppercase tracking-wider">Fidelidade</p><p className="mt-1 text-content-base font-semibold">{tier}</p><p className="text-gold-base font-bold">{client.loyaltyPoints || 0} pontos</p></div>
                        <div className="rounded-xl bg-surface-base p-3"><p className="text-[10px] text-content-muted uppercase tracking-wider">Papel e cadastro</p><p className="mt-1 text-content-base font-semibold capitalize">{client.role || 'client'}</p><p className="text-content-muted">Atualizado em {client.updatedAt ? new Date(client.updatedAt).toLocaleDateString('pt-BR') : '—'}</p></div>
                      </div>
                      <div className="admin-action-group">
                        {client.phone && <a href={`https://wa.me/55${client.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" title="Abrir WhatsApp" aria-label="Abrir WhatsApp" className="admin-action-icon min-h-10 min-w-10 px-2 sm:px-4 rounded-xl border border-status-success/30 text-status-success text-sm font-semibold flex items-center justify-center gap-1.5"><Phone className="w-4 h-4" /><span className="hidden sm:inline">WhatsApp</span></a>}
                        <button type="button" onClick={() => handleOpenModal(client)} title="Editar cliente" aria-label="Editar cliente" className="admin-action-icon min-h-10 min-w-10 px-2 sm:px-4 rounded-xl bg-gold-base text-surface-base text-sm font-bold flex items-center justify-center gap-1.5"><Edit2 className="w-4 h-4" /><span className="hidden sm:inline">Editar</span></button>
                        <button type="button" onClick={() => handleDelete(client.id)} title="Excluir cliente" aria-label="Excluir cliente" className="admin-action-icon min-h-10 min-w-10 px-2 sm:px-4 rounded-xl border border-status-error/25 text-status-error text-sm font-semibold flex items-center justify-center gap-1.5"><Trash2 className="w-4 h-4" /><span className="hidden sm:inline">Excluir</span></button>
                        {isAdmin && <span title="Administrador" aria-label="Administrador" className="admin-action-icon min-h-10 min-w-10 px-2 sm:px-4 rounded-xl bg-purple-500/15 text-purple-300 text-sm font-semibold flex items-center justify-center gap-1.5"><ShieldCheck className="w-4 h-4" /><span className="hidden sm:inline">Administrador</span></span>}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}

            {filteredClients.length === 0 && (
              <div className="p-8 text-center text-sm text-content-muted bg-surface-card border border-border-subtle rounded-2xl">
                Nenhum cliente encontrado.
              </div>
            )}
          </div>        </>
      )}

      {/* COMPACT MODULAR CLIENT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-surface-base/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-hidden">
          <div className="bg-surface-card border border-border-subtle sm:border-gold-base/30 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-fade-in">
            {/* Header */}
            <div className="p-3.5 bg-surface-base border-b border-border-subtle flex justify-between items-center gap-2 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-gold-base/10 border border-gold-base/30 flex items-center justify-center text-gold-hover shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-content-base truncate">
                    {editingClient ? `Editar: ${editingClient.name}` : 'Cadastrar Novo Cliente'}
                  </h2>
                  <p className="text-[10px] text-content-muted truncate">Ajuste informações de contato e pontuação</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
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
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Carlos Silva"
                    className="w-full bg-surface-base border border-border-subtle rounded-xl px-3 py-2 text-xs text-content-base focus:outline-none focus:border-gold-base"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <AdminLabel tone="accent">E-mail *</AdminLabel>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      placeholder="carlos@email.com"
                      className="w-full bg-surface-base border border-border-subtle rounded-xl px-3 py-2 text-xs text-content-base focus:outline-none focus:border-gold-base"
                    />
                  </div>
                  <div>
                    <AdminLabel tone="accent">Telefone</AdminLabel>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
                      placeholder="(11) 99999-9999"
                      className="w-full bg-surface-base border border-border-subtle rounded-xl px-3 py-2 text-xs text-content-base focus:outline-none focus:border-gold-base"
                    />
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
                  <p className="text-[10px] font-bold text-gold-hover uppercase tracking-wider">Fidelidade & Permissões</p>

                  <div className="grid grid-cols-2 gap-2">
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
    </div>
  );
};
