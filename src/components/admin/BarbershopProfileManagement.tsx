import React, { useState, useEffect } from 'react';
import { handleEnterAsTab } from "../../utils/formUtils";
import { formatPhone } from "../../utils/masks";
import { 
  Store, 
  MapPin, 
  Phone, 
  Clock, 
  Save, 
  CheckCircle2, 
  Globe, 
  Instagram, 
  MessageSquare, 
  Navigation,
  Scissors,
  Calendar,
  Sparkles,
  Info,
  AlertTriangle
} from 'lucide-react';
import { AdminPageHeader } from './shared/AdminPageHeader';
import { 
  ShopProfile, 
  defaultShopProfile, 
  fetchShopProfile, 
  saveShopProfile, 
  daysOfWeekMap,
  generateTimeSlotsFromProfile 
} from '../../services/shopProfileService';
import { timeToMinutes } from '../../utils/dateUtils';

export const BarbershopProfileManagement: React.FC = () => {
  const [profile, setProfile] = useState<ShopProfile>(defaultShopProfile);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'address' | 'hours' | 'preview'>('info');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    const data = await fetchShopProfile(true);
    setProfile(data);
    setLoading(false);
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleSave = async () => {
    // Validação local: horário de abertura precisa ser antes do de fechamento
    // em todo dia ativo (evita salvar uma configuração que zera os horários
    // disponíveis silenciosamente).
    const invalidDayLabels: string[] = [];
    for (const d of daysOfWeekMap) {
      const sch = profile.operatingSchedule?.[d.key];
      if (sch?.active && !(timeToMinutes(sch.open) < timeToMinutes(sch.close))) {
        invalidDayLabels.push(d.label);
      }
    }
    if (invalidDayLabels.length > 0) {
      showToast(`Horário de abertura deve ser antes do fechamento em: ${invalidDayLabels.join(', ')}.`);
      return;
    }

    setIsSaving(true);
    try {
      const updated = await saveShopProfile(profile);
      setProfile(updated);
      showToast('Perfil e horários da barbearia atualizados com sucesso!');
    } catch (err: any) {
      showToast(err?.message || 'Erro ao salvar perfil da barbearia.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateScheduleDay = (dayKey: keyof ShopProfile['operatingSchedule'], field: 'active' | 'open' | 'close', value: any) => {
    setProfile(prev => {
      const currentDay = prev.operatingSchedule[dayKey] || { active: true, open: '09:00', close: '20:00' };
      const updatedDay = { ...currentDay, [field]: value };
      const newSchedule = { ...prev.operatingSchedule, [dayKey]: updatedDay };
      
      // Recalcular os índices dos dias ativos (0 = Dom, 1 = Seg...)
      const activeDays: number[] = [];
      daysOfWeekMap.forEach(d => {
        if (newSchedule[d.key]?.active) {
          activeDays.push(d.dayIndex);
        }
      });

      return {
        ...prev,
        operatingSchedule: newSchedule,
        operatingDays: activeDays
      };
    });
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="w-8 h-8 border-4 border-gold-base/20 border-t-gold-base rounded-full animate-spin" />
      </div>
    );
  }

  const sampleSlots = generateTimeSlotsFromProfile(profile);

  return (
    <div className="space-y-5 animate-fade-in pb-12">
      {/* HEADER (desktop) */}
      <AdminPageHeader
        icon={Store}
        title="Perfil & Unidade"
        action={{
          label: isSaving ? 'Salvando...' : 'Salvar Alterações',
          onClick: handleSave,
          icon: Save,
          disabled: isSaving,
        }}
      />

      {/* Ação (mobile) */}
      <button
        onClick={handleSave}
        disabled={isSaving}
        className="md:hidden h-10 px-5 bg-gold-base hover:bg-gold-hover text-surface-base rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow active:scale-95 disabled:opacity-50 w-full"
      >
        <Save className="w-4 h-4" />
        <span>{isSaving ? 'Salvando...' : 'Salvar Alterações'}</span>
      </button>

      {/* TOAST MESSAGE */}
      {toastMsg && (
        <div className="bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 p-3.5 rounded-xl flex items-center gap-2.5 text-xs font-bold animate-fade-in shadow-md">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* NAVIGATION TABS */}
      <div className="flex items-center gap-1.5 border-b border-border-subtle pb-2 overflow-x-auto custom-scrollbar">
        <button
          onClick={() => setActiveTab('info')}
          className={`h-9 px-3.5 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
            activeTab === 'info' 
              ? 'bg-gold-base text-surface-base' 
              : 'text-content-muted hover:text-content-base hover:bg-surface-card'
          }`}
        >
          <Store className="w-3.5 h-3.5" />
          <span>Identidade e Dados</span>
        </button>

        <button
          onClick={() => setActiveTab('hours')}
          className={`h-9 px-3.5 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
            activeTab === 'hours' 
              ? 'bg-gold-base text-surface-base' 
              : 'text-content-muted hover:text-content-base hover:bg-surface-card'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Horários de Funcionamento</span>
        </button>

        <button
          onClick={() => setActiveTab('address')}
          className={`h-9 px-3.5 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
            activeTab === 'address' 
              ? 'bg-gold-base text-surface-base' 
              : 'text-content-muted hover:text-content-base hover:bg-surface-card'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          <span>Endereço e Contatos</span>
        </button>

        <button
          onClick={() => setActiveTab('preview')}
          className={`h-9 px-3.5 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
            activeTab === 'preview' 
              ? 'bg-gold-base text-surface-base' 
              : 'text-content-muted hover:text-content-base hover:bg-surface-card'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Previsualizar no App</span>
        </button>
      </div>

      {/* TAB CONTENT: IDENTIDADE */}
      {activeTab === 'info' && (
        <form className="bg-surface-card border border-border-subtle p-5 rounded-lg space-y-5" onKeyDown={handleEnterAsTab}>
          <div className="flex items-center gap-2 pb-3 border-b border-border-subtle">
            <Store className="w-4 h-4 text-gold-base" />
            <h2 className="text-sm font-serif font-bold text-content-base">Informações da Marca e Unidade</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold text-content-muted uppercase tracking-wider block mb-1">
                Nome Principal da Barbearia
              </label>
              <input
                type="text"
                value={profile.name}
                onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                placeholder="Ex: Navo Barber & Club"
                className="w-full bg-surface-base border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-content-muted uppercase tracking-wider block mb-1">
                Nome da Unidade
              </label>
              <input
                type="text"
                value={profile.unitName}
                onChange={e => setProfile(p => ({ ...p, unitName: e.target.value }))}
                placeholder="Ex: Unidade Jardins"
                className="w-full bg-surface-base border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-content-muted uppercase tracking-wider block mb-1">
              Slogan / Subtítulo da Barbearia
            </label>
            <input
              type="text"
              value={profile.slogan}
              onChange={e => setProfile(p => ({ ...p, slogan: e.target.value }))}
              placeholder="Ex: Estilo, Tradição e Excelência na Medida Certa"
              className="w-full bg-surface-base border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-content-muted uppercase tracking-wider block mb-1">
              Descrição / Sobre a Unidade
            </label>
            <textarea
              rows={3}
              value={profile.description}
              onChange={e => setProfile(p => ({ ...p, description: e.target.value }))}
              placeholder="Apresente sua barbearia para os clientes no aplicativo..."
              className="w-full bg-surface-base border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base resize-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-content-muted uppercase tracking-wider block mb-1">
              URL da Logomarca ou Imagem Principal
            </label>
            <input
              type="text"
              value={profile.logoUrl || ''}
              onChange={e => setProfile(p => ({ ...p, logoUrl: e.target.value }))}
              placeholder="https://suaimagem.com/logo.png"
              className="w-full bg-surface-base border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base"
            />
            <span className="text-[10px] text-content-muted mt-1 block">
              Se deixado em branco, a plataforma usará o ícone padrão estilizado.
            </span>
          </div>
        </form>
      )}

      {/* TAB CONTENT: HORÁRIOS */}
      {activeTab === 'hours' && (
        <form className="bg-surface-card border border-border-subtle p-5 rounded-lg space-y-5" onKeyDown={handleEnterAsTab} onSubmit={e => e.preventDefault()}>
          <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gold-base" />
              <h2 className="text-sm font-serif font-bold text-content-base">Horários de Funcionamento Semanal</h2>
            </div>
            <div className="text-[11px] text-content-muted bg-surface-base px-2.5 py-1 rounded-xl border border-border-subtle">
              Slot de atendimento: <strong className="text-gold-base font-mono">30 minutos</strong>
            </div>
          </div>

          <div className="bg-surface-base/80 p-3.5 rounded-xl border border-border-subtle text-xs text-content-muted flex items-start gap-2.5">
            <Info className="w-4 h-4 text-gold-base shrink-0 mt-0.5" />
            <p>
              Os horários definidos aqui controlam diretamente as opções de agendamento exibidas para os clientes, a grade de horários do Admin e a disponibilidade automática da agenda.
            </p>
          </div>

          {/* GENERAL DEFAULT OPEN & CLOSE TIMES */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-surface-base p-4 rounded-xl border border-border-subtle">
            <div>
              <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block mb-1">
                Horário Padrão de Abertura
              </label>
              <input
                type="time"
                value={profile.openTime || '09:00'}
                onChange={e => setProfile(p => ({ ...p, openTime: e.target.value }))}
                className="w-full bg-surface-card border border-border-subtle rounded-xl p-2 text-xs font-mono text-content-base focus:outline-none focus:border-gold-base"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block mb-1">
                Horário Padrão de Fechamento
              </label>
              <input
                type="time"
                value={profile.closeTime || '20:00'}
                onChange={e => setProfile(p => ({ ...p, closeTime: e.target.value }))}
                className="w-full bg-surface-card border border-border-subtle rounded-xl p-2 text-xs font-mono text-content-base focus:outline-none focus:border-gold-base"
              />
            </div>
          </div>

          {/* TOGGLE: HORÁRIO FORA DE EXPEDIENTE COM APROVAÇÃO */}
          <div className={`p-4 rounded-xl border transition-all flex items-start justify-between gap-4 ${
            profile.allowOutsideHoursApproval
              ? 'bg-amber-500/10 border-amber-500/40'
              : 'bg-surface-base border-border-subtle'
          }`}>
            <div className="flex items-start gap-3">
              <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${profile.allowOutsideHoursApproval ? 'text-amber-400' : 'text-content-muted'}`} />
              <div>
                <div className="text-xs font-bold text-content-base">
                  Permitir solicitação fora do expediente
                </div>
                <p className="text-[11px] text-content-muted mt-1 max-w-md">
                  Quando ativado, o cliente pode solicitar um horário cujo atendimento
                  ultrapasse o fechamento — o agendamento fica pendente de aprovação do
                  barbeiro. Quando desativado (padrão), esses horários simplesmente não
                  são oferecidos ao cliente.
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={!!profile.allowOutsideHoursApproval}
                onChange={e => setProfile(p => ({ ...p, allowOutsideHoursApproval: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-stone-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-gold-base"></div>
            </label>
          </div>

          {/* DAY BY DAY SCHEDULE TABLE */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-content-base uppercase tracking-wider">
              Grade de Horários por Dia da Semana
            </h3>

            <div className="space-y-2">
              {daysOfWeekMap.map(dayItem => {
                const sch = profile.operatingSchedule?.[dayItem.key] || { active: true, open: '09:00', close: '20:00' };

                return (
                  <div 
                    key={dayItem.key}
                    className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                      sch.active 
                        ? 'bg-surface-base border-border-subtle' 
                        : 'bg-surface-base/40 border-border-subtle/50 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3 shrink-0">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sch.active}
                          onChange={e => updateScheduleDay(dayItem.key, 'active', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-stone-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-gold-base"></div>
                      </label>
                      <div className="w-28 font-bold text-xs text-content-base">
                        {dayItem.label}
                      </div>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-xl ${
                        sch.active ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30' : 'bg-red-950/60 text-red-400 border border-red-500/30'
                      }`}>
                        {sch.active ? 'Aberto' : 'Fechado'}
                      </span>
                    </div>

                    {sch.active ? (
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
                          <span className="text-[10px] text-content-muted">Abre:</span>
                          <input
                            type="time"
                            value={sch.open || '09:00'}
                            onChange={e => updateScheduleDay(dayItem.key, 'open', e.target.value)}
                            className="bg-surface-card border border-border-subtle rounded-xl px-2 py-1 text-xs font-mono text-content-base focus:outline-none focus:border-gold-base"
                          />
                        </div>

                        <span className="text-content-muted text-xs">até</span>

                        <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
                          <span className="text-[10px] text-content-muted">Fecha:</span>
                          <input
                            type="time"
                            value={sch.close || '20:00'}
                            onChange={e => updateScheduleDay(dayItem.key, 'close', e.target.value)}
                            className="bg-surface-card border border-border-subtle rounded-xl px-2 py-1 text-xs font-mono text-content-base focus:outline-none focus:border-gold-base"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-content-muted italic">
                        Sem agendamentos neste dia
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* SAMPLE SLOTS GENERATED */}
          <div className="pt-3 border-t border-border-subtle">
            <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block mb-1">
              Amostra dos Horários Gerados Automaticamente ({sampleSlots.length} horários)
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-surface-base rounded-xl border border-border-subtle custom-scrollbar">
              {sampleSlots.length > 0 ? (
                sampleSlots.map(slot => (
                  <span key={slot} className="px-2 py-1 bg-surface-card border border-border-subtle rounded-xl text-[10px] font-mono font-bold text-gold-base">
                    {slot}
                  </span>
                ))
              ) : (
                <span className="text-xs text-content-muted italic">Nenhum horário disponível para a configuração atual.</span>
              )}
            </div>
          </div>
        </form>
      )}

      {/* TAB CONTENT: ENDEREÇO & CONTATOS */}
      {activeTab === 'address' && (
        <form className="bg-surface-card border border-border-subtle p-5 rounded-lg space-y-5" onKeyDown={handleEnterAsTab} onSubmit={e => e.preventDefault()}>
          <div className="flex items-center gap-2 pb-3 border-b border-border-subtle">
            <MapPin className="w-4 h-4 text-gold-base" />
            <h2 className="text-sm font-serif font-bold text-content-base">Endereço & Canais de Comunicação</h2>
          </div>

          <div>
            <label className="text-[11px] font-bold text-content-muted uppercase tracking-wider block mb-1">
              Endereço Completo da Barbearia
            </label>
            <input
              type="text"
              value={profile.address}
              onChange={e => setProfile(p => ({ ...p, address: e.target.value }))}
              placeholder="Ex: Rua Augusta, 1420 - Jardins, São Paulo - SP"
              className="w-full bg-surface-base border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-content-muted uppercase tracking-wider block mb-1">
              Link de Localização (Google Maps / Waze)
            </label>
            <input
              type="text"
              value={profile.mapsUrl}
              onChange={e => setProfile(p => ({ ...p, mapsUrl: e.target.value }))}
              placeholder="https://maps.google.com/?q=..."
              className="w-full bg-surface-base border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold text-content-muted uppercase tracking-wider block mb-1">
                Telefone Principal
              </label>
              <input
                type="text"
                value={profile.phone}
                onChange={e => setProfile(p => ({ ...p, phone: formatPhone(e.target.value) }))}
                placeholder="(11) 99999-8888"
                className="w-full bg-surface-base border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-content-muted uppercase tracking-wider block mb-1">
                WhatsApp de Atendimento
              </label>
              <input
                type="text"
                value={profile.whatsapp}
                onChange={e => setProfile(p => ({ ...p, whatsapp: formatPhone(e.target.value) }))}
                placeholder="5511999998888"
                className="w-full bg-surface-base border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-content-muted uppercase tracking-wider block mb-1">
              Perfil no Instagram
            </label>
            <input
              type="text"
              value={profile.instagram}
              onChange={e => setProfile(p => ({ ...p, instagram: e.target.value }))}
              placeholder="@barbearianavo"
              className="w-full bg-surface-base border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base"
            />
          </div>
        </form>
      )}

      {/* TAB CONTENT: PREVISUALIZAR */}
      {activeTab === 'preview' && (
        <div className="bg-surface-card border border-border-subtle p-5 rounded-lg space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border-subtle">
            <Sparkles className="w-4 h-4 text-gold-base" />
            <h2 className="text-sm font-serif font-bold text-content-base">Previsualização do Cartão do App</h2>
          </div>

          <div className="max-w-md mx-auto bg-stone-900 border border-stone-800 rounded-xl p-5 text-white space-y-4 shadow-2xl">
            {/* Header / Brand */}
            <div className="text-center space-y-1">
              {profile.logoUrl ? (
                <img src={profile.logoUrl} alt="Logo" className="w-12 h-12 rounded-full mx-auto object-cover border border-amber-400/40" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-amber-400/10 border border-amber-400/30 text-amber-400 flex items-center justify-center mx-auto mb-1">
                  <Scissors className="w-5 h-5" />
                </div>
              )}
              <h3 className="text-lg font-bold font-serif uppercase tracking-wide text-amber-400">{profile.name}</h3>
              <p className="text-xs font-semibold text-stone-300 uppercase tracking-widest">{profile.unitName}</p>
              <p className="text-[11px] text-stone-400 italic">"{profile.slogan}"</p>
            </div>

            {/* Address & Hours Card */}
            <div className="bg-stone-950 p-3.5 rounded-lg border border-stone-800 space-y-2.5 text-xs">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span className="text-stone-200">{profile.address}</span>
              </div>

              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="text-stone-200 font-bold block mb-1">Funcionamento:</span>
                  {daysOfWeekMap.map(d => {
                    const sch = profile.operatingSchedule?.[d.key];
                    if (!sch || !sch.active) return null;
                    return (
                      <div key={d.key} className="flex justify-between gap-4 text-[11px] text-stone-400">
                        <span>{d.label}:</span>
                        <span className="font-mono text-stone-200">{sch.open} às {sch.close}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1 border-t border-stone-800 text-[11px] text-stone-400">
                <Phone className="w-3.5 h-3.5 text-amber-400" />
                <span>{profile.phone}</span>
                <span className="ml-auto font-mono text-amber-400/90">{profile.instagram}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button className="h-9 rounded-xl bg-amber-400 text-stone-950 font-bold text-xs flex items-center justify-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>Agendar Horário</span>
              </button>
              <button className="h-9 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER SAVE ACTION */}
      <div className="pt-4 border-t border-border-subtle flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="h-11 px-6 bg-gold-base hover:bg-gold-hover text-surface-base rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50 w-full sm:w-auto"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Salvando...' : 'Salvar Perfil da Barbearia'}</span>
        </button>
      </div>
    </div>
  );
};
