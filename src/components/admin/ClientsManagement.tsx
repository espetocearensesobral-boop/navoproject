import React, { useState, useEffect } from 'react';
import { Users, Search, Edit2, Trash2, Plus, Star, Award, ShieldCheck, Mail, Phone, Calendar, CheckCircle2, X } from 'lucide-react';
import { authFetch } from '../../lib/api';

interface Profile {
  id: string;
  name: string;
  email: string;
  phone: string;
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Profile | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
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
  const filteredClients = safeClients.filter(c => {
    const matchesSearch = 
      (c.name && c.name.toLowerCase().includes(search.toLowerCase())) || 
      (c.email && c.email.toLowerCase().includes(search.toLowerCase())) ||
      (c.phone && c.phone.includes(search));

    if (!matchesSearch) return false;

    if (selectedTier === 'vip') {
      return c.loyaltyTier === 'Ouro' || c.loyaltyTier === 'Diamante';
    } else if (selectedTier === 'admin') {
      return c.role === 'admin';
    } else if (selectedTier !== 'all') {
      return c.loyaltyTier === selectedTier;
    }

    return true;
  });

  const totalPoints = safeClients.reduce((acc, c) => acc + (c.loyaltyPoints || 0), 0);
  const vipCount = safeClients.filter(c => c.loyaltyTier === 'Ouro' || c.loyaltyTier === 'Diamante').length;

  const handleOpenModal = (client?: Profile) => {
    if (client) {
      setEditingClient(client);
      setFormData({
        name: client.name,
        email: client.email,
        phone: client.phone || '',
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
      {/* DESKTOP HEADER (MD AND UP) */}
      <div className="hidden md:flex justify-between items-center">
        <div>
          <h1 className="text-xl font-serif text-content-base font-semibold tracking-tight">Gestão de Clientes</h1>
          <p className="text-content-muted text-xs mt-0.5">Gerencie os perfis, níveis de fidelidade e pontuação</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-gold-base text-surface-base px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 hover:bg-gold-base/80 transition-all shadow-md active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Cliente</span>
        </button>
      </div>

      {/* DESKTOP KPI STATS (MD AND UP) */}
      <div className="hidden md:grid grid-cols-3 gap-3">
        <div className="p-3.5 bg-surface-card border border-border-subtle rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-content-muted uppercase tracking-wider">Total de Clientes</p>
            <p className="text-xl font-serif text-content-base font-semibold mt-0.5">{safeClients.length}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-gold-base/10 border border-[#FFFFFF]/30 flex items-center justify-center text-gold-hover">
            <Users className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 bg-surface-card border border-border-subtle rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-content-muted uppercase tracking-wider">Clientes VIP</p>
            <p className="text-xl font-extrabold text-gold-hover mt-0.5">{vipCount}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-gold-base/10 border border-[#FFFFFF]/30 flex items-center justify-center text-gold-hover">
            <Star className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 bg-surface-card border border-border-subtle rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-content-muted uppercase tracking-wider">Pontos Totais</p>
            <p className="text-xl font-serif text-content-base font-semibold mt-0.5">{totalPoints} pts</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-gold-base/10 border border-[#FFFFFF]/30 flex items-center justify-center text-gold-hover">
            <Award className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* MOBILE TOP BAR (COMPACT MINIMALIST MD:HIDDEN) */}
      <div className="md:hidden flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
          <input
            type="text"
            placeholder="Buscar por nome, email ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-card border border-border-subtle rounded-xl pl-8 pr-3 py-2 text-xs text-content-base placeholder-[#666666] focus:outline-none focus:border-[#FFFFFF]"
          />
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="bg-gold-base text-surface-base px-3 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1 shrink-0 shadow-sm active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Novo</span>
        </button>
      </div>

      {/* HORIZONTAL FILTER PILLS */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        {[
          { id: 'all', label: 'Todos', count: safeClients.length },
          { id: 'vip', label: 'VIP (Ouro/Diamante)', count: vipCount },
          { id: 'Bronze', label: 'Bronze' },
          { id: 'Prata', label: 'Prata' },
          { id: 'Ouro', label: 'Ouro' },
          { id: 'Diamante', label: 'Diamante' },
          { id: 'admin', label: 'Admins' },
        ].map((pill) => (
          <button
            key={pill.id}
            onClick={() => setSelectedTier(pill.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
              selectedTier === pill.id
                ? 'bg-gold-base text-surface-base border-[#FFFFFF]'
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
            className="w-full bg-surface-card border border-border-subtle rounded-xl pl-8 pr-3 py-1.5 text-xs text-content-base focus:outline-none focus:border-[#FFFFFF]"
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
          <div className="w-6 h-6 border-2 border-[#FFFFFF] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* MOBILE COMPACT CARDS FEED (MD:HIDDEN) */}
          <div className="md:hidden space-y-2">
            {filteredClients.map((client) => (
              <div
                key={client.id}
                className="bg-surface-card border border-border-subtle rounded-xl p-3 flex items-center justify-between gap-3 hover:border-border-subtle transition-all"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-surface-card border border-border-subtle flex items-center justify-center text-gold-hover font-bold text-xs shrink-0 overflow-hidden">
                    {client.avatarUrl ? (
                      <img src={client.avatarUrl} alt={client.name} className="w-full h-full object-cover" />
                    ) : (
                      client.name.charAt(0).toUpperCase()
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-content-base truncate">{client.name}</p>
                      <span className="px-1.5 py-0.2 rounded bg-gold-base/10 text-gold-hover text-[9px] font-extrabold shrink-0">
                        {client.loyaltyTier}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-content-muted mt-0.5 truncate">
                      <span className="truncate">{client.email}</span>
                      {client.phone && <span className="shrink-0">• {client.phone}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleOpenModal(client)}
                    className="p-1.5 rounded-lg bg-surface-card text-content-muted hover:text-content-base transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(client.id)}
                    className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {filteredClients.length === 0 && (
              <div className="p-8 text-center text-xs text-content-muted bg-surface-card border border-border-subtle rounded-xl">
                Nenhum cliente encontrado.
              </div>
            )}
          </div>

          {/* DESKTOP RICH TABLE (HIDDEN MD:BLOCK) */}
          <div className="hidden md:block bg-surface-card border border-border-subtle rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-surface-base text-content-muted border-b border-border-subtle">
                  <tr>
                    <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Cliente</th>
                    <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Contato</th>
                    <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Fidelidade</th>
                    <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Papel</th>
                    <th className="p-3.5 font-bold uppercase tracking-wider text-[10px] text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {filteredClients.map((client) => (
                    <tr key={client.id} className="hover:bg-surface-card transition-colors">
                      <td className="p-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-surface-card border border-border-subtle flex items-center justify-center text-gold-hover font-extrabold shrink-0 overflow-hidden">
                            {client.avatarUrl ? (
                              <img src={client.avatarUrl} alt={client.name} className="w-full h-full object-cover" />
                            ) : (
                              client.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-content-base text-xs">{client.name}</p>
                            <p className="text-[10px] text-content-muted">Membro desde {new Date(client.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5 space-y-0.5">
                        <div className="flex items-center gap-1.5 text-content-muted">
                          <Mail className="w-3 h-3 shrink-0" />
                          <span className="text-xs">{client.email}</span>
                        </div>
                        {client.phone && (
                          <div className="flex items-center gap-1.5 text-content-muted">
                            <Phone className="w-3 h-3 shrink-0" />
                            <span className="text-xs">{client.phone}</span>
                          </div>
                        )}
                      </td>
                      <td className="p-3.5">
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1 bg-gold-base/10 text-gold-hover px-2 py-0.5 rounded-full text-[10px] font-extrabold w-fit">
                            <Star className="w-3 h-3" />
                            <span>{client.loyaltyTier}</span>
                          </span>
                          <span className="text-[10px] text-content-muted font-bold">{client.loyaltyPoints} pts</span>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold w-fit ${
                          client.role === 'admin' ? 'bg-[#9C27B0]/15 text-[#9C27B0]' : 'bg-surface-card text-content-muted border border-border-subtle'
                        }`}>
                          {client.role === 'admin' ? <ShieldCheck className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                          <span className="capitalize">{client.role}</span>
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenModal(client)}
                            className="p-1.5 bg-surface-card text-content-muted hover:text-content-base rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(client.id)}
                            className="p-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredClients.length === 0 && (
                <div className="p-8 text-center text-xs text-content-muted">
                  Nenhum cliente encontrado.
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* COMPACT MODULAR CLIENT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-surface-base/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-hidden">
          <div className="bg-surface-card border border-border-subtle sm:border-[#FFFFFF]/30 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-fade-in">
            {/* Header */}
            <div className="p-3.5 bg-surface-base border-b border-border-subtle flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gold-base/10 border border-[#FFFFFF]/30 flex items-center justify-center text-gold-hover">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-content-base">
                    {editingClient ? `Editar: ${editingClient.name}` : 'Cadastrar Novo Cliente'}
                  </h2>
                  <p className="text-[10px] text-content-muted">Ajuste informações de contato e pontuação</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded-xl bg-surface-card text-content-muted hover:text-content-base flex items-center justify-center transition-colors"
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

              <form id="clientForm" onSubmit={handleSave} className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-gold-hover block mb-1">Nome Completo *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Carlos Silva"
                    className="w-full bg-surface-base border border-border-subtle rounded-xl px-3 py-2 text-xs text-content-base focus:outline-none focus:border-[#FFFFFF]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] font-bold text-gold-hover block mb-1">E-mail *</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      placeholder="carlos@email.com"
                      className="w-full bg-surface-base border border-border-subtle rounded-xl px-3 py-2 text-xs text-content-base focus:outline-none focus:border-[#FFFFFF]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gold-hover block mb-1">Telefone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="(11) 99999-9999"
                      className="w-full bg-surface-base border border-border-subtle rounded-xl px-3 py-2 text-xs text-content-base focus:outline-none focus:border-[#FFFFFF]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gold-hover block mb-1">
                    Senha {editingClient && <span className="text-content-muted font-normal">(Deixe em branco para manter)</span>}
                  </label>
                  <input
                    type="password"
                    required={!editingClient}
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full bg-surface-base border border-border-subtle rounded-xl px-3 py-2 text-xs text-content-base focus:outline-none focus:border-[#FFFFFF]"
                  />
                </div>

                <div className="p-3 bg-surface-base border border-border-subtle rounded-xl space-y-2.5">
                  <p className="text-[10px] font-bold text-gold-hover uppercase tracking-wider">Fidelidade & Permissões</p>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-content-muted block mb-1">Papel</label>
                      <select
                        value={formData.role}
                        onChange={e => setFormData({ ...formData, role: e.target.value })}
                        className="w-full bg-surface-card border border-border-subtle rounded-xl px-2.5 py-1.5 text-xs text-content-base focus:outline-none focus:border-[#FFFFFF]"
                      >
                        <option value="client">Cliente</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-content-muted block mb-1">Nível Fidelidade</label>
                      <select
                        value={formData.loyaltyTier}
                        onChange={e => setFormData({ ...formData, loyaltyTier: e.target.value })}
                        className="w-full bg-surface-card border border-border-subtle rounded-xl px-2.5 py-1.5 text-xs text-content-base focus:outline-none focus:border-[#FFFFFF]"
                      >
                        <option value="Bronze">Bronze</option>
                        <option value="Prata">Prata</option>
                        <option value="Ouro">Ouro</option>
                        <option value="Diamante">Diamante</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-content-muted block mb-1">Pontos de Fidelidade</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.loyaltyPoints}
                      onChange={e => setFormData({ ...formData, loyaltyPoints: parseInt(e.target.value) || 0 })}
                      className="w-full bg-surface-card border border-border-subtle rounded-xl px-2.5 py-1.5 text-xs text-content-base focus:outline-none focus:border-[#FFFFFF]"
                    />
                  </div>
                </div>
              </form>
            </div>

            {/* Footer */}
            <div className="p-3 bg-surface-base border-t border-border-subtle flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-content-muted hover:text-content-base bg-surface-card transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="clientForm"
                className="px-4 py-1.5 rounded-xl text-xs font-extrabold text-surface-base bg-gold-base hover:bg-gold-base/80 transition-all"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
