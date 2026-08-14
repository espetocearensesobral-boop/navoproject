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
  Navigation,
  Info,
  AlertTriangle,
  Upload,
  Scissors,
  Trash2,
  Image as ImageIcon,
  Palette,
  Check,
  Mail,
  Link as LinkIcon,
  MessageSquare
} from 'lucide-react';
import { PALETTES, useTheme } from '../../contexts/ThemeContext';
import { AdminPageHeader } from './shared/AdminPageHeader';
import { AdminTabs } from './shared/AdminTabs';
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
  const [savedProfile, setSavedProfile] = useState<ShopProfile>(defaultShopProfile);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'hours' | 'contacts' | 'links' | 'appearance'>('info');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    const data = await fetchShopProfile(true);
    setProfile(data);
    setSavedProfile(data);
    setLoading(false);
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      showToast('A imagem da logo deve ter no máximo 3MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setProfile(p => ({ ...p, logoUrl: result }));
        showToast('Logo carregada! Clique em "Salvar Alterações" para salvar.');
      }
    };
    reader.readAsDataURL(file);
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
      setSavedProfile(updated);
      showToast('Perfil e horários da barbearia atualizados com sucesso!');
    } catch (err: any) {
      showToast(err?.message || 'Erro ao salvar perfil da barbearia.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setProfile({
      ...savedProfile,
      operatingDays: [...savedProfile.operatingDays],
      operatingSchedule: { ...savedProfile.operatingSchedule },
    });
    showToast('Alterações descartadas.');
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
      <AdminPageHeader icon={Store} title="Perfil & Unidade" />

      {/* TOAST MESSAGE */}
      {toastMsg && (
        <div className="bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 p-3.5 rounded-xl flex items-center gap-2.5 text-xs font-bold animate-fade-in shadow-md">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* NAVIGATION TABS */}
      <AdminTabs
        tabs={[
          { id: 'info', label: 'Identidade e Dados', icon: Store },
          { id: 'hours', label: 'Horários de Funcionamento', icon: Clock },
          { id: 'contacts', label: 'Canais de Contato', icon: Phone },
          { id: 'links', label: 'Links & Redes', icon: LinkIcon },
          { id: 'appearance', label: 'Aparência e Paleta', icon: Palette },
        ]}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as typeof activeTab)}
      />

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
                placeholder="Ex: Unidade Expectativa"
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

          {/* LOGO DA BARBEARIA / IDENTIDADE VISUAL */}
          <div className="bg-surface-base border border-border-subtle rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-[11px] font-bold text-content-base uppercase tracking-wider block">
                  Logomarca Oficial da Unidade
                </label>
                <p className="text-[10px] text-content-muted mt-0.5">
                  Exibida na Landing Page (no anel circular estilo Instagram), nos comprovantes de agendamento e no cabeçalho do app.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 pt-1">
              {/* Preview Circular estilo Instagram com Anel Gradiente Dourado */}
              <div className="flex flex-col items-center shrink-0">
                <div className="relative p-[3px] rounded-full bg-gradient-to-tr from-amber-600 via-gold-base to-amber-300 shadow-lg">
                  <div className="p-[2px] bg-[#0a0a0a] rounded-full">
                    <div className="w-[100px] h-[100px] rounded-full overflow-hidden bg-neutral-900 flex items-center justify-center relative shadow-inner">
                      {profile.logoUrl ? (
                        <img 
                          src={profile.logoUrl} 
                          alt="Pré-visualização da Logo" 
                          className="w-full h-full object-cover rounded-full"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                            if (e.currentTarget.parentElement) {
                              const fb = e.currentTarget.parentElement.querySelector('.admin-logo-fallback');
                              if (fb) fb.classList.remove('hidden');
                            }
                          }}
                        />
                      ) : null}
                      <div className={`admin-logo-fallback ${profile.logoUrl ? 'hidden' : ''} flex flex-col items-center justify-center w-full h-full bg-neutral-900 text-gold-base`}>
                        <Scissors className="w-9 h-9 text-gold-base stroke-[1.8]" />
                      </div>
                    </div>
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 bg-gradient-to-tr from-amber-600 via-gold-base to-amber-300 p-1.5 rounded-full text-surface-base shadow-md border border-[#0a0a0a]">
                    <Instagram className="w-3 h-3" />
                  </div>
                </div>
                <span className="text-[10px] font-bold text-content-muted uppercase tracking-wider mt-2">
                  Pré-visualização
                </span>
              </div>

              {/* Upload & Link Controls */}
              <div className="flex-1 w-full space-y-3 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="cursor-pointer h-9 px-3.5 bg-gold-base hover:opacity-90 text-surface-base rounded-xl text-xs font-bold flex items-center gap-2 transition-all active:scale-95 shadow-sm">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Carregar Imagem do Dispositivo</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleLogoFileUpload} 
                      className="hidden" 
                    />
                  </label>

                  {profile.logoUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setProfile(p => ({ ...p, logoUrl: '' }));
                        showToast('Logo removida. Clique em "Salvar Alterações" para confirmar.');
                      }}
                      className="h-9 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remover</span>
                    </button>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block mb-1">
                    Ou Cole o Link Direto da Imagem (URL HTTPS)
                  </label>
                  <input
                    type="text"
                    value={profile.logoUrl || ''}
                    onChange={e => setProfile(p => ({ ...p, logoUrl: e.target.value }))}
                    placeholder="https://exemplo.com/sua-logomarca.png"
                    className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base"
                  />
                  <span className="text-[10px] text-content-muted mt-1 block">
                    Formatos suportados: PNG, JPG, WEBP ou SVG (Recomendado: Imagem quadrada com fundo escuro ou transparente).
                  </span>
                </div>
              </div>
            </div>
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

      {/* TAB CONTENT: CANAIS DE CONTATO */}
      {activeTab === 'contacts' && (
        <form className="bg-surface-card border border-border-subtle p-5 rounded-lg space-y-5" onKeyDown={handleEnterAsTab} onSubmit={e => e.preventDefault()}>
          <div className="flex items-center gap-2 pb-3 border-b border-border-subtle">
            <Phone className="w-4 h-4 text-gold-base" />
            <h2 className="text-sm font-serif font-bold text-content-base">Canais de Contato & Endereço</h2>
          </div>

          <div>
            <label className="text-[11px] font-bold text-content-muted uppercase tracking-wider block mb-1">
              Endereço Completo da Barbearia
            </label>
            <input
              type="text"
              value={profile.address}
              onChange={e => setProfile(p => ({ ...p, address: e.target.value }))}
              placeholder="Ex: Rua Fortaleza, 1420 - Expectativa, Sobral - CE"
              className="w-full bg-surface-base border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold text-content-muted uppercase tracking-wider block mb-1">
                Telefone Principal / Celular
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
                WhatsApp Oficial de Atendimento
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold text-content-muted uppercase tracking-wider block mb-1">
                Telefone Fixo da Recepção
              </label>
              <input
                type="text"
                value={profile.landline || ''}
                onChange={e => setProfile(p => ({ ...p, landline: formatPhone(e.target.value) }))}
                placeholder="(11) 3211-0000"
                className="w-full bg-surface-base border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-content-muted uppercase tracking-wider block mb-1">
                E-mail de Suporte e Atendimento
              </label>
              <input
                type="email"
                value={profile.email || ''}
                onChange={e => setProfile(p => ({ ...p, email: e.target.value }))}
                placeholder="contato@barbearianavo.com.br"
                className="w-full bg-surface-base border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base"
              />
            </div>
          </div>
        </form>
      )}

      {/* TAB CONTENT: LINKS & REDES SOCIAIS */}
      {activeTab === 'links' && (
        <form className="bg-surface-card border border-border-subtle p-5 rounded-lg space-y-5" onKeyDown={handleEnterAsTab} onSubmit={e => e.preventDefault()}>
          <div className="flex items-center gap-2 pb-3 border-b border-border-subtle">
            <LinkIcon className="w-4 h-4 text-gold-base" />
            <h2 className="text-sm font-serif font-bold text-content-base">Redes Sociais & Links Externos</h2>
          </div>

          <div>
            <label className="text-[11px] font-bold text-content-muted uppercase tracking-wider block mb-1">
              Perfil no Instagram (@usuario)
            </label>
            <div className="flex min-w-0">
              <span className="bg-surface-base border border-r-0 border-border-subtle rounded-l-xl px-3 py-2.5 text-content-muted font-bold text-xs shrink-0 flex items-center">
                @
              </span>
              <input
                type="text"
                value={(profile.instagram || '').replace(/^@/, '')}
                onChange={e => setProfile(p => ({ ...p, instagram: `@${e.target.value.replace(/^@/, '')}` }))}
                placeholder="barbearianavo"
                className="flex-1 min-w-0 bg-surface-base border border-border-subtle rounded-r-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-content-muted uppercase tracking-wider block mb-1">
              Página do Facebook (URL)
            </label>
            <input
              type="text"
              value={profile.facebookUrl || ''}
              onChange={e => setProfile(p => ({ ...p, facebookUrl: e.target.value }))}
              placeholder="https://facebook.com/barbearianavo"
              className="w-full bg-surface-base border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-content-muted uppercase tracking-wider block mb-1">
              Link de Localização e Avaliações (Google Maps)
            </label>
            <input
              type="text"
              value={profile.mapsUrl}
              onChange={e => setProfile(p => ({ ...p, mapsUrl: e.target.value }))}
              placeholder="https://maps.google.com/?q=..."
              className="w-full bg-surface-base border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base"
            />
          </div>
        </form>
      )}

      {/* TAB CONTENT: APARÊNCIA E PALETA */}
      {activeTab === 'appearance' && (
        <AppearanceTabContent />
      )}

      {/* Ações finais: um único ponto de persistência para todas as abas do perfil. */}
      <div className="pt-5 mt-2 border-t border-border-subtle flex flex-col sm:flex-row sm:justify-end gap-2">
        <button
          type="button"
          onClick={handleCancel}
          disabled={isSaving}
          className="h-11 px-6 rounded-xl border border-border-subtle bg-surface-card text-content-muted hover:text-content-base hover:bg-surface-base text-xs font-bold transition-colors disabled:opacity-50 w-full sm:w-auto"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="h-11 px-6 bg-gold-base hover:bg-gold-hover text-surface-base rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50 w-full sm:w-auto"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Salvando...' : 'Salvar Alterações'}</span>
        </button>
      </div>
    </div>
  );
};

const AppearanceTabContent: React.FC = () => {
  const { palette, setPalette } = useTheme();

  return (
    <div className="bg-surface-card border border-border-subtle p-5 rounded-xl space-y-6 text-xs min-w-0">
      <div>
        <div className="flex items-center gap-2 pb-2 border-b border-border-subtle mb-3">
          <Palette className="w-4 h-4 text-gold-base" />
          <h2 className="text-sm font-serif font-bold text-content-base">Paleta e Identidade Visual do Sistema</h2>
        </div>
        <p className="text-[11px] text-content-muted max-w-xl">
          Personalize a cor de destaque da sua unidade sem alterar o contraste e legibilidade. A escolha é salva neste dispositivo e aplicada instantaneamente a todo o sistema e aplicativo dos clientes.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {PALETTES.map((item) => {
          const selected = palette === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setPalette(item.id)}
              aria-pressed={selected}
              className={`group text-left rounded-xl border p-3 transition-all active:scale-[0.98] ${selected ? 'border-gold-base bg-gold-base/10 shadow-sm' : 'border-border-subtle bg-surface-base hover:border-gold-base/50 hover:bg-surface-elevated'}`}
            >
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-8 h-8 rounded-xl shrink-0 border border-white/10 shadow-inner" style={{ background: `linear-gradient(135deg, ${item.accentSoft}, ${item.deep})` }} />
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-content-base truncate">{item.name}</span>
                    <span className="block text-[10px] text-content-muted truncate">{item.description}</span>
                  </span>
                </div>
                {selected && <span className="w-5 h-5 rounded-full flex items-center justify-center bg-gold-base text-surface-base"><Check className="w-3 h-3" /></span>}
              </div>
              <div className="flex gap-1.5" aria-hidden="true">
                <span className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: item.deep }} />
                <span className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: item.accent }} />
                <span className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: item.accentSoft }} />
              </div>
            </button>
          );
        })}
      </div>

      <div className="pt-4 border-t border-border-subtle flex items-start gap-2 text-[11px] text-content-muted">
        <Palette className="w-4 h-4 text-gold-base shrink-0 mt-0.5" />
        <p>O Dourado Heritage permanece como padrão original. As demais opções alteram os elementos de realce (botões, ícones, seleções) mantendo a estrutura limpa e fluida da plataforma.</p>
      </div>
    </div>
  );
};
