import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { AdminPageHeader } from './shared/AdminPageHeader';
import { AdminTabs } from './shared/AdminTabs';
import { handleEnterAsTab } from '../../utils/formUtils';
import {
  fetchNavoRewardsAdminDashboard,
  triggerInactiveClientsCampaign,
  fetchRewardsList,
  createAdminReward,
  deleteAdminReward,
  manuallyAdjustPoints,
  fetchClientsFromSupabase,
  fetchLoyaltyConfig,
  saveLoyaltyConfig
} from '../../services/supabaseDataService';
import {
  Award,
  Gift,
  Star,
  Users,
  TrendingUp,
  Megaphone,
  Sparkles,
  CheckCircle2,
  Crown,
  MessageSquare,
  Plus,
  Trash2,
  Zap,
  Copy,
  ExternalLink,
  Share2,
  Check,
  Clock,
  DollarSign,
  QrCode,
  Save,
  RefreshCw,
  Send
} from 'lucide-react';

type NavoRewardsTab = 'dashboard' | 'loyalty' | 'rewards' | 'referrals' | 'reviews';

interface NavoRewardsAdminProps {
  initialTab?: NavoRewardsTab;
}

const rewardsPageTitles: Record<NavoRewardsTab, string> = {
  dashboard: 'Dashboard Geral',
  loyalty: 'Clube de Fidelidade & Níveis',
  rewards: 'Prêmios & Cupons de Desconto',
  referrals: 'Motor de Indicações',
  reviews: 'Avaliações & NPS',
};

export const NavoRewardsAdmin: React.FC<NavoRewardsAdminProps> = ({ initialTab }) => {
  const [activeTab, setActiveTab] = useState<NavoRewardsTab>(initialTab || 'dashboard');
  const [data, setData] = useState<any | null>(null);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);
  const [loading, setLoading] = useState(true);
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [campaignMsg, setCampaignMsg] = useState<string | null>(null);

  // Rewards catalog state
  const [rewardsList, setRewardsList] = useState<any[]>([]);
  const [showAddRewardModal, setShowAddRewardModal] = useState(false);
  const [newReward, setNewReward] = useState({
    title: '',
    pointsRequired: 500,
    rewardType: 'upgrade',
    valueDescription: '',
    icon: 'Sparkles'
  });

  // Manual points state
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [manualPointsAmount, setManualPointsAmount] = useState(100);
  const [manualPointsReason, setManualPointsReason] = useState('');
  const [manualSuccessMsg, setManualSuccessMsg] = useState<string | null>(null);

  // Voucher validation state
  const [voucherCodeInput, setVoucherCodeInput] = useState('');
  const [voucherValidationResult, setVoucherValidationResult] = useState<string | null>(null);

  // CONFIGURABLE ENGINE SETTINGS STATE
  const [config, setConfig] = useState<any>({
    currencyPerPoint: 1.0,
    pointsValidityDays: 365,
    tierMultipliers: {
      Bronze: 1.0,
      Prata: 1.2,
      Ouro: 1.5,
      Diamante: 2.0
    },
    referralPoints: {
      referrerBonus: 100,
      referredBonus: 50,
      milestoneCount: 5,
      milestoneBonus: 1000
    },
    reviewPoints: {
      baseReview: 20,
      withPhotoBonus: 30,
      fiveStarBonus: 10
    },
    birthdayBonus: 100
  });

  const [savingConfig, setSavingConfig] = useState(false);
  const [configSuccessMsg, setConfigSuccessMsg] = useState<string | null>(null);

  // REFERRAL LINK GENERATOR STATE
  const [refClient, setRefClient] = useState<any | null>(null);
  const [customRefMsg, setCustomRefMsg] = useState(
    'Olá! Te convido para conhecer a Barbearia Navo. Agende seu primeiro corte usando meu link e ganhe 50 pontos bônus no clube de fidelidade:'
  );
  const [copiedLink, setCopiedLink] = useState(false);

  // EVALUATION LINK / QR CODE STATE
  const [evalClient, setEvalClient] = useState<any | null>(null);
  const [customEvalMsg, setCustomEvalMsg] = useState(
    'Olá! Como foi sua experiência hoje na Barbearia Navo? Avalie em 1 minuto e ganhe pontos extras na sua carteira:'
  );
  const [copiedEvalLink, setCopiedEvalLink] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dashRes, rwdRes, clientList, cfgRes] = await Promise.all([
        fetchNavoRewardsAdminDashboard(),
        fetchRewardsList(),
        fetchClientsFromSupabase(),
        fetchLoyaltyConfig().catch(() => null)
      ]);
      setData(dashRes);
      setRewardsList(rwdRes);
      setClients(clientList || []);
      if (clientList && clientList.length > 0) {
        setRefClient(clientList[0]);
        setEvalClient(clientList[0]);
      }
      if (cfgRes) {
        setConfig(cfgRes);
      }
    } catch (e) {
      console.error('Erro ao carregar dados do Navo Rewards:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleRefresh = () => loadData();
    window.addEventListener('adminRefresh', handleRefresh);
    return () => window.removeEventListener('adminRefresh', handleRefresh);
  }, []);

  const handleSaveConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingConfig(true);
    try {
      const res = await saveLoyaltyConfig(config);
      setConfigSuccessMsg(res.message || 'Configurações salvas!');
      setTimeout(() => setConfigSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar configurações.');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleTriggerCampaign = async () => {
    if (!confirm('Deseja creditar +100 pontos para todos os clientes ativos como incentivo de retorno?')) return;
    setCampaignLoading(true);
    try {
      const res = await triggerInactiveClientsCampaign();
      setCampaignMsg(res.message);
      await loadData();
      setTimeout(() => setCampaignMsg(null), 5000);
    } catch (err: any) {
      alert(err.message || 'Erro ao disparar campanha');
    } finally {
      setCampaignLoading(false);
    }
  };

  const handleCreateReward = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createAdminReward(newReward);
      setShowAddRewardModal(false);
      setNewReward({
        title: '',
        pointsRequired: 500,
        rewardType: 'upgrade',
        valueDescription: '',
        icon: 'Sparkles'
      });
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao criar recompensa.');
    }
  };

  const handleDeleteReward = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover esta recompensa?')) return;
    try {
      await deleteAdminReward(id);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao remover recompensa.');
    }
  };

  const handleManualPointsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) {
      alert('Selecione um cliente.');
      return;
    }
    try {
      const res = await manuallyAdjustPoints(selectedClient, Number(manualPointsAmount), manualPointsReason);
      setManualSuccessMsg(res.message);
      setManualPointsReason('');
      await loadData();
      setTimeout(() => setManualSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Erro ao ajustar pontos.');
    }
  };

  const handleValidateVoucher = () => {
    if (!voucherCodeInput.trim()) return;
    if (voucherCodeInput.toUpperCase().startsWith('NAV-RWD-')) {
      setVoucherValidationResult(`✅ VOUCHER VÁLIDO: Código ${voucherCodeInput.toUpperCase()} confirmado! Pode conceder o prêmio ao cliente.`);
    } else {
      setVoucherValidationResult(`⚠️ VOUCHER INVÁLIDO ou CÓDIGO INCORRETO. Verifique com o cliente.`);
    }
  };

  const baseUrl = window.location.origin;
  const currentRefCode = refClient?.referralCode || `NAV-${refClient?.name ? refClient.name.split(' ')[0].toUpperCase() : 'GUEST'}100`;
  const generatedRefUrl = `${baseUrl}?ref=${currentRefCode}`;
  const generatedEvalUrl = `${baseUrl}?review=true`;

  const copyToClipboard = (text: string, isEval = false) => {
    navigator.clipboard.writeText(text);
    if (isEval) {
      setCopiedEvalLink(true);
      setTimeout(() => setCopiedEvalLink(false), 2500);
    } else {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const shareViaWhatsapp = (phone: string, text: string) => {
    const cleanPhone = (phone || '').replace(/\D/g, '');
    const encodedText = encodeURIComponent(text);
    const whatsappUrl = cleanPhone ? `https://wa.me/55${cleanPhone}?text=${encodedText}` : `https://wa.me/?text=${encodedText}`;
    window.open(whatsappUrl, '_blank');
  };

  if (loading) {
    return (
      <div className="p-8 text-center space-y-3">
        <div className="w-8 h-8 border-2 border-gold-base border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-content-muted">Carregando painel Navo Rewards...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in text-content-base min-w-0">
      {/* Header (desktop) */}
      <AdminPageHeader
        icon={Award}
        title={rewardsPageTitles[activeTab]}
        stats={[{ label: 'score NPS', value: data?.npsScore || 100, tone: 'gold' }]}
        action={{ label: 'Atualizar', onClick: loadData, icon: RefreshCw, disabled: loading }}
      />

      {/* Ação (mobile) */}
      

      {activeTab === 'dashboard' && <>
      {/* 2. KPIS (Sempre no topo, logo abaixo do Header) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-content-muted mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider truncate">Score NPS</span>
            <div className="w-6 h-6 rounded-lg bg-gold-base/10 text-gold-base flex items-center justify-center shrink-0">
              <Star className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-black text-gold-base tabular-nums truncate">{data?.npsScore || 100} <span className="text-[10px] text-status-success">/ 100</span></p>
          <p className="text-[9px] text-content-muted mt-1 font-medium truncate">{data?.promoters || 0} prom / {data?.detractors || 0} detr</p>
        </div>

        <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-content-muted mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider truncate">Pts Emitidos</span>
            <div className="w-6 h-6 rounded-lg bg-surface-base border border-border-subtle flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-gold-base" />
            </div>
          </div>
          <p className="text-lg font-black text-content-base tabular-nums truncate">+{data?.totalIssued || 0}</p>
          <p className="text-[9px] text-status-success mt-1 font-medium truncate">Cortes e indicações</p>
        </div>

        <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-content-muted mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider truncate">Pts Resgatados</span>
            <div className="w-6 h-6 rounded-lg bg-status-error/10 text-status-error flex items-center justify-center shrink-0">
              <Gift className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-black text-status-error tabular-nums truncate">-{data?.totalRedeemed || 0}</p>
          <p className="text-[9px] text-content-muted mt-1 font-medium truncate">Cupons gerados</p>
        </div>

        <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-content-muted mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider truncate">Avaliações</span>
            <div className="w-6 h-6 rounded-lg bg-surface-base border border-border-subtle flex items-center justify-center shrink-0">
              <MessageSquare className="w-3.5 h-3.5 text-gold-base" />
            </div>
          </div>
          <p className="text-lg font-black text-content-base tabular-nums truncate">{data?.totalReviews || 0}</p>
          <p className="text-[9px] text-gold-base mt-1 font-medium truncate">100% NPS Ativo</p>
        </div>
      </div>

      {/* 3. LINHA DE CAMPANHA (com botão com verbo curto "Disparar", 1 linha) */}
      <div className="bg-surface-card border border-border-subtle p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-xl bg-gold-base/10 border border-gold-base/30 text-gold-base flex items-center justify-center shrink-0">
            <Megaphone className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-bold text-content-base block truncate">
              Campanha de Re-engajamento
            </span>
            <p className="text-[11px] text-content-muted truncate">
              Creditar +100 pontos para clientes inativos para incentivar retornos.
            </p>
          </div>
        </div>

        <button
          onClick={handleTriggerCampaign}
          disabled={campaignLoading}
          className="h-9 px-4 rounded-xl bg-gold-base text-surface-base hover:bg-gold-base/90 transition-all text-xs font-bold flex items-center justify-center gap-2 shrink-0 whitespace-nowrap active:scale-95 disabled:opacity-50"
        >
          <Megaphone className="w-3.5 h-3.5" />
          <span>{campaignLoading ? 'Disparando...' : 'Disparar'}</span>
        </button>
      </div>

      {campaignMsg && (
        <div className="p-3 bg-status-success/10 border border-status-success/30 text-status-success text-xs font-bold rounded-xl animate-fade-in">
          {campaignMsg}
        </div>
      )}
      </>}

      {configSuccessMsg && (
        <div className="p-3 bg-status-success/10 border border-status-success/30 text-status-success text-xs font-bold rounded-xl animate-fade-in">
          {configSuccessMsg}
        </div>
      )}

      {/* 4. TABS SECUNDÁRIAS — mantidas apenas para compatibilidade quando o componente é usado sem rota própria. */}
      {!initialTab && <AdminTabs
        tabs={[
          { id: 'dashboard', label: 'Dashboard Geral', icon: TrendingUp },
          { id: 'loyalty', label: 'Clube de Fidelidade & Níveis', icon: Crown },
          { id: 'rewards', label: 'Prêmios & Cupons Desconto', icon: Gift },
          { id: 'referrals', label: 'Motor de Indicações', icon: Users },
          { id: 'reviews', label: 'Avaliações & NPS', icon: Star },
        ]}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as NavoRewardsTab)}
      />}

      {/* 5. CONTEÚDO DA INTERFACE */}
      {/* TAB 1: DASHBOARD GERAL */}
      {activeTab === 'dashboard' && (
        <div className="space-y-4 min-w-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Distribuição por Nível VIP */}
            <div className="bg-surface-card p-4 sm:p-5 rounded-xl border border-border-subtle space-y-3">
              <h3 className="text-xs font-bold text-content-base uppercase tracking-wider flex items-center gap-2">
                <Crown className="w-4 h-4 text-gold-base" />
                <span>Distribuição por Nível VIP</span>
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-2.5">
                <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
                  <div className="flex items-center justify-between text-amber-700 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider truncate">Bronze</span>
                    <div className="w-6 h-6 rounded-lg bg-amber-700/10 flex items-center justify-center shrink-0">
                      <Crown className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <p className="text-lg font-black text-content-base tabular-nums truncate">{data?.tierDistribution?.Bronze || 0}</p>
                  <p className="text-[9px] text-content-muted mt-1 font-medium truncate">{config.tierMultipliers?.Bronze || 1.0}x mult</p>
                </div>

                <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider truncate">Prata</span>
                    <div className="w-6 h-6 rounded-lg bg-slate-400/10 flex items-center justify-center shrink-0">
                      <Crown className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <p className="text-lg font-black text-content-base tabular-nums truncate">{data?.tierDistribution?.Prata || 0}</p>
                  <p className="text-[9px] text-content-muted mt-1 font-medium truncate">{config.tierMultipliers?.Prata || 1.2}x mult</p>
                </div>

                <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
                  <div className="flex items-center justify-between text-gold-base mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider truncate">Ouro</span>
                    <div className="w-6 h-6 rounded-lg bg-gold-base/10 flex items-center justify-center shrink-0">
                      <Crown className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <p className="text-lg font-black text-content-base tabular-nums truncate">{data?.tierDistribution?.Ouro || 0}</p>
                  <p className="text-[9px] text-content-muted mt-1 font-medium truncate">{config.tierMultipliers?.Ouro || 1.5}x mult</p>
                </div>

                <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
                  <div className="flex items-center justify-between text-cyan-400 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider truncate">Diamante</span>
                    <div className="w-6 h-6 rounded-lg bg-cyan-400/10 flex items-center justify-center shrink-0">
                      <Crown className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <p className="text-lg font-black text-content-base tabular-nums truncate">{data?.tierDistribution?.Diamante || 0}</p>
                  <p className="text-[9px] text-content-muted mt-1 font-medium truncate">{config.tierMultipliers?.Diamante || 2.0}x mult</p>
                </div>
              </div>
            </div>

            {/* Maiores Embaixadores */}
            <div className="bg-surface-card p-4 sm:p-5 rounded-xl border border-border-subtle space-y-3">
              <h3 className="text-xs font-bold text-content-base uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-gold-base" />
                <span>Maiores Embaixadores (Mural de Indicações)</span>
              </h3>

              {data?.ambassadors && data.ambassadors.length > 0 ? (
                <div className="space-y-2 text-xs divide-y divide-border-subtle">
                  {data.ambassadors.map((amb: any, idx: number) => (
                    <div key={amb.id || idx} className="pt-2 flex items-center justify-between min-w-0">
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <span className={`w-6 h-6 rounded-xl font-bold text-[10px] flex items-center justify-center shrink-0 ${
                          idx === 0 ? 'bg-gold-base text-surface-base' : 'bg-surface-base text-content-muted border border-border-subtle'
                        }`}>
                          #{idx + 1}
                        </span>
                        <div className="min-w-0 truncate">
                          <span className="text-content-base font-bold block truncate">{amb.name}</span>
                          <span className="text-[10px] text-content-muted truncate block">Nível {amb.tier} • {amb.points} pts</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold text-gold-base num-tabular block">{amb.totalReferrals} amigos</span>
                        <span className="text-[10px] text-status-success font-semibold">100% convertidos</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-content-muted py-6 text-center">Nenhum embaixador ativo ainda nesta semana.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CLUBE DE FIDELIDADE & NÍVEIS */}
      {activeTab === 'loyalty' && (
        <div className="space-y-4 min-w-0">
          <form onKeyDown={handleEnterAsTab} onSubmit={handleSaveConfig} className="bg-surface-card p-4 sm:p-5 rounded-xl border border-border-subtle space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-border-subtle">
              <div>
                <h3 className="text-sm font-serif font-bold text-content-base flex items-center gap-2">
                  <Crown className="w-4 h-4 text-gold-base" />
                  <span>Configuração de Pontos & Validade</span>
                </h3>
                <p className="text-[11px] text-content-muted mt-0.5">Ajuste a taxa de conversão, multiplicadores e expiração.</p>
              </div>

              <button
                type="submit"
                disabled={savingConfig}
                className="h-9 px-4 rounded-xl bg-gold-base text-surface-base font-bold text-xs flex items-center gap-2 hover:bg-gold-base/90 active:scale-95 disabled:opacity-50 whitespace-nowrap"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingConfig ? 'Salvando...' : 'Salvar Regras'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-surface-base rounded-xl border border-border-subtle space-y-2">
                <label className="text-[10px] font-bold text-gold-base uppercase tracking-wider flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5" /> Razão de Conversão
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-content-muted font-bold">R$</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={config.currencyPerPoint}
                    onChange={(e) => setConfig({ ...config, currencyPerPoint: Number(e.target.value) })}
                    className="w-full bg-surface-card border border-border-subtle rounded-xl p-2 text-content-base text-xs font-bold focus:outline-none focus:border-gold-base num-tabular"
                  />
                  <span className="text-content-muted font-bold whitespace-nowrap">= 1 Pts</span>
                </div>
              </div>

              <div className="p-3 bg-surface-base rounded-xl border border-border-subtle space-y-2">
                <label className="text-[10px] font-bold text-gold-base uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Validade (Dias)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={config.pointsValidityDays}
                    onChange={(e) => setConfig({ ...config, pointsValidityDays: Number(e.target.value) })}
                    className="w-full bg-surface-card border border-border-subtle rounded-xl p-2 text-content-base text-xs font-bold focus:outline-none focus:border-gold-base num-tabular"
                  />
                  <span className="text-content-muted font-bold">dias</span>
                </div>
              </div>

              <div className="p-3 bg-surface-base rounded-xl border border-border-subtle space-y-2">
                <label className="text-[10px] font-bold text-gold-base uppercase tracking-wider flex items-center gap-1">
                  <Gift className="w-3.5 h-3.5" /> Bônus Aniversário
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={config.birthdayBonus}
                    onChange={(e) => setConfig({ ...config, birthdayBonus: Number(e.target.value) })}
                    className="w-full bg-surface-card border border-border-subtle rounded-xl p-2 text-content-base text-xs font-bold focus:outline-none focus:border-gold-base num-tabular"
                  />
                  <span className="text-content-muted font-bold">pts</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <h4 className="text-[10px] font-bold text-content-muted uppercase tracking-wider">Multiplicadores por Nível VIP</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-2.5 bg-surface-base rounded-xl border border-border-subtle space-y-1">
                  <span className="text-[10px] font-bold uppercase text-amber-700 block truncate">Bronze</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      value={config.tierMultipliers?.Bronze || 1.0}
                      onChange={(e) => setConfig({
                        ...config,
                        tierMultipliers: { ...config.tierMultipliers, Bronze: Number(e.target.value) }
                      })}
                      className="w-16 bg-surface-card border border-border-subtle rounded-xl p-1.5 text-content-base text-xs font-bold num-tabular"
                    />
                    <span className="text-content-muted text-[11px]">x Pts</span>
                  </div>
                </div>

                <div className="p-2.5 bg-surface-base rounded-xl border border-border-subtle space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block truncate">Prata</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      value={config.tierMultipliers?.Prata || 1.2}
                      onChange={(e) => setConfig({
                        ...config,
                        tierMultipliers: { ...config.tierMultipliers, Prata: Number(e.target.value) }
                      })}
                      className="w-16 bg-surface-card border border-border-subtle rounded-xl p-1.5 text-content-base text-xs font-bold num-tabular"
                    />
                    <span className="text-content-muted text-[11px]">x Pts</span>
                  </div>
                </div>

                <div className="p-2.5 bg-surface-base rounded-xl border border-border-subtle space-y-1">
                  <span className="text-[10px] font-bold uppercase text-gold-base block truncate">Ouro</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      value={config.tierMultipliers?.Ouro || 1.5}
                      onChange={(e) => setConfig({
                        ...config,
                        tierMultipliers: { ...config.tierMultipliers, Ouro: Number(e.target.value) }
                      })}
                      className="w-16 bg-surface-card border border-border-subtle rounded-xl p-1.5 text-content-base text-xs font-bold num-tabular"
                    />
                    <span className="text-content-muted text-[11px]">x Pts</span>
                  </div>
                </div>

                <div className="p-2.5 bg-surface-base rounded-xl border border-border-subtle space-y-1">
                  <span className="text-[10px] font-bold uppercase text-cyan-400 block truncate">Diamante</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      value={config.tierMultipliers?.Diamante || 2.0}
                      onChange={(e) => setConfig({
                        ...config,
                        tierMultipliers: { ...config.tierMultipliers, Diamante: Number(e.target.value) }
                      })}
                      className="w-16 bg-surface-card border border-border-subtle rounded-xl p-1.5 text-content-base text-xs font-bold num-tabular"
                    />
                    <span className="text-content-muted text-[11px]">x Pts</span>
                  </div>
                </div>
              </div>
            </div>
          </form>

          {/* Ajuste Manual */}
          <div className="bg-surface-card p-4 sm:p-5 rounded-xl border border-border-subtle space-y-3">
            <h3 className="text-xs font-bold text-content-base uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-gold-base" />
              <span>Ajuste Manual de Pontuação de Clientes</span>
            </h3>

            <form onKeyDown={handleEnterAsTab} onSubmit={handleManualPointsSubmit} className="space-y-3 max-w-xl text-xs">
              <div>
                <label className="block text-[10px] font-bold text-content-muted uppercase tracking-wider mb-1">Selecione o Cliente</label>
                <select
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                  className="w-full bg-surface-base border border-border-subtle rounded-xl p-2.5 text-content-base focus:outline-none focus:border-gold-base"
                >
                  <option value="">-- Escolha o cliente --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone || 'Sem tel'}) - Atual: {c.loyaltyPoints || 0} pts
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-content-muted uppercase tracking-wider mb-1">Pontos (Ex: +100 ou -50)</label>
                  <input
                    type="number"
                    value={manualPointsAmount}
                    onChange={(e) => setManualPointsAmount(Number(e.target.value))}
                    className="w-full bg-surface-base border border-border-subtle rounded-xl p-2.5 text-content-base focus:outline-none focus:border-gold-base num-tabular"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-content-muted uppercase tracking-wider mb-1">Motivo</label>
                  <input
                    type="text"
                    placeholder="Ex: Cortesia VIP"
                    value={manualPointsReason}
                    onChange={(e) => setManualPointsReason(e.target.value)}
                    className="w-full bg-surface-base border border-border-subtle rounded-xl p-2.5 text-content-base focus:outline-none focus:border-gold-base"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="h-9 px-4 bg-gold-base text-surface-base font-bold rounded-xl hover:bg-gold-base/90 text-xs active:scale-95"
              >
                Aplicar Ajuste de Pontos
              </button>

              {manualSuccessMsg && (
                <div className="p-2.5 bg-status-success/10 border border-status-success/30 text-status-success text-xs font-bold rounded-xl">
                  {manualSuccessMsg}
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* TAB 3: CATÁLOGO DE PRÊMIOS & CUPONS */}
      {activeTab === 'rewards' && (
        <div className="space-y-4 min-w-0">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-surface-card p-4 rounded-xl border border-border-subtle">
            <div>
              <h3 className="text-sm font-serif font-bold text-content-base">Catálogo de Prêmios e Cupons</h3>
              <p className="text-xs text-content-muted mt-0.5">Ofertas ativas para troca de pontos e cupons.</p>
            </div>

            <button
              onClick={() => setShowAddRewardModal(true)}
              className="h-9 px-3.5 rounded-xl bg-gold-base text-surface-base font-bold text-xs flex items-center gap-1.5 shrink-0 hover:bg-gold-base/90 active:scale-95 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Criar Oferta / Cupom</span>
            </button>
          </div>

          {/* Validador de Voucher */}
          <div className="bg-surface-card p-4 rounded-xl border border-border-subtle space-y-2.5 max-w-xl">
            <h4 className="text-[10px] font-bold uppercase text-gold-base tracking-wider flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Validar Código de Voucher do Cliente
            </h4>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ex: NAV-RWD-123456"
                value={voucherCodeInput}
                onChange={(e) => setVoucherCodeInput(e.target.value)}
                className="flex-1 bg-surface-base border border-border-subtle rounded-xl p-2 text-xs text-content-base font-mono uppercase focus:outline-none focus:border-gold-base min-w-0"
              />
              <button
                onClick={handleValidateVoucher}
                className="h-9 px-4 bg-gold-base text-surface-base font-bold text-xs rounded-xl hover:bg-gold-base/90 active:scale-95 shrink-0 whitespace-nowrap"
              >
                Validar Voucher
              </button>
            </div>
            {voucherValidationResult && (
              <div className="p-2.5 bg-surface-base border border-gold-base/30 text-content-base text-xs font-medium rounded-xl">
                {voucherValidationResult}
              </div>
            )}
          </div>

          {/* Lista de Prêmios */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {rewardsList.map((rw) => (
              <div
                key={rw.id}
                className="bg-surface-card p-4 rounded-xl border border-border-subtle flex items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xl bg-gold-base/10 text-gold-base text-[10px] font-bold border border-gold-base/30">
                    <Gift className="w-3 h-3" />
                    <span>{rw.pointsRequired} PONTOS</span>
                  </div>
                  <h4 className="font-bold text-content-base text-xs truncate">{rw.title}</h4>
                  <p className="text-[11px] text-content-muted truncate">{rw.valueDescription}</p>
                </div>

                <button
                  onClick={() => handleDeleteReward(rw.id)}
                  className="w-8 h-8 rounded-xl bg-surface-base text-status-error border border-border-subtle hover:border-status-error/50 shrink-0 flex items-center justify-center active:scale-95"
                  title="Remover oferta"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Modal Adicionar Oferta */}
          {showAddRewardModal && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-surface-base/80 backdrop-blur-sm">
              <div className="w-full max-w-md bg-surface-card rounded-xl border border-border-subtle p-5 space-y-4 shadow-lg">
                <h3 className="text-sm font-serif font-bold text-content-base">Adicionar Oferta ou Cupom</h3>

                <form onKeyDown={handleEnterAsTab} onSubmit={handleCreateReward} className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-content-muted uppercase tracking-wider mb-1">Título</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: 15% OFF no Próximo Corte"
                      value={newReward.title}
                      onChange={(e) => setNewReward({ ...newReward, title: e.target.value })}
                      className="w-full bg-surface-base border border-border-subtle rounded-xl p-2.5 text-content-base focus:outline-none focus:border-gold-base"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-content-muted uppercase tracking-wider mb-1">Pontos Necessários</label>
                    <input
                      type="number"
                      required
                      min={50}
                      value={newReward.pointsRequired}
                      onChange={(e) => setNewReward({ ...newReward, pointsRequired: Number(e.target.value) })}
                      className="w-full bg-surface-base border border-border-subtle rounded-xl p-2.5 text-content-base focus:outline-none focus:border-gold-base num-tabular"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-content-muted uppercase tracking-wider mb-1">Tipo da Oferta</label>
                    <select
                      value={newReward.rewardType}
                      onChange={(e) => setNewReward({ ...newReward, rewardType: e.target.value })}
                      className="w-full bg-surface-base border border-border-subtle rounded-xl p-2.5 text-content-base focus:outline-none focus:border-gold-base"
                    >
                      <option value="upgrade">Upgrade de Serviço</option>
                      <option value="product">Produto Físico</option>
                      <option value="free_cut">Corte Grátis</option>
                      <option value="vip_status">Status VIP / Desconto Permanente</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-content-muted uppercase tracking-wider mb-1">Descrição do Benefício</label>
                    <textarea
                      required
                      placeholder="Ex: Válido para qualquer serviço de barba ou produto."
                      value={newReward.valueDescription}
                      onChange={(e) => setNewReward({ ...newReward, valueDescription: e.target.value })}
                      className="w-full bg-surface-base border border-border-subtle rounded-xl p-2.5 text-content-base focus:outline-none focus:border-gold-base min-h-[60px]"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddRewardModal(false)}
                      className="flex-1 h-9 rounded-xl border border-border-subtle text-content-muted font-bold text-xs"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="flex-1 h-9 rounded-xl bg-gold-base text-surface-base font-bold text-xs"
                    >
                      Salvar Oferta
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: MOTOR DE INDICAÇÕES */}
      {activeTab === 'referrals' && (
        <div className="space-y-4 min-w-0">
          <form onKeyDown={handleEnterAsTab} onSubmit={handleSaveConfig} className="bg-surface-card p-4 sm:p-5 rounded-xl border border-border-subtle space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-border-subtle">
              <div>
                <h3 className="text-sm font-serif font-bold text-content-base flex items-center gap-2">
                  <Users className="w-4 h-4 text-gold-base" />
                  <span>Configuração do Motor de Indicações</span>
                </h3>
                <p className="text-[11px] text-content-muted mt-0.5">Defina os bônus para quem indica e quem é indicado.</p>
              </div>

              <button
                type="submit"
                disabled={savingConfig}
                className="h-9 px-4 rounded-xl bg-gold-base text-surface-base font-bold text-xs flex items-center gap-2 hover:bg-gold-base/90 active:scale-95 disabled:opacity-50 whitespace-nowrap"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingConfig ? 'Salvando...' : 'Salvar Regras'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-surface-base rounded-xl border border-border-subtle space-y-1.5">
                <span className="text-[10px] font-bold uppercase text-gold-base block truncate">Bônus de Quem Indica</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={config.referralPoints?.referrerBonus || 100}
                    onChange={(e) => setConfig({
                      ...config,
                      referralPoints: { ...config.referralPoints, referrerBonus: Number(e.target.value) }
                    })}
                    className="w-full bg-surface-card border border-border-subtle rounded-xl p-2 text-content-base font-bold text-xs num-tabular"
                  />
                  <span className="text-content-muted font-bold">pts</span>
                </div>
              </div>

              <div className="p-3 bg-surface-base rounded-xl border border-border-subtle space-y-1.5">
                <span className="text-[10px] font-bold uppercase text-gold-base block truncate">Bônus do Amigo Indicado</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={config.referralPoints?.referredBonus || 50}
                    onChange={(e) => setConfig({
                      ...config,
                      referralPoints: { ...config.referralPoints, referredBonus: Number(e.target.value) }
                    })}
                    className="w-full bg-surface-card border border-border-subtle rounded-xl p-2 text-content-base font-bold text-xs num-tabular"
                  />
                  <span className="text-content-muted font-bold">pts</span>
                </div>
              </div>

              <div className="p-3 bg-surface-base rounded-xl border border-border-subtle space-y-1.5">
                <span className="text-[10px] font-bold uppercase text-gold-base block truncate">Meta Amigos (Milestone)</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={config.referralPoints?.milestoneCount || 5}
                    onChange={(e) => setConfig({
                      ...config,
                      referralPoints: { ...config.referralPoints, milestoneCount: Number(e.target.value) }
                    })}
                    className="w-full bg-surface-card border border-border-subtle rounded-xl p-2 text-content-base font-bold text-xs num-tabular"
                  />
                  <span className="text-content-muted font-bold">amigos</span>
                </div>
              </div>

              <div className="p-3 bg-surface-base rounded-xl border border-border-subtle space-y-1.5">
                <span className="text-[10px] font-bold uppercase text-gold-base block truncate">Bônus Milestone</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={config.referralPoints?.milestoneBonus || 1000}
                    onChange={(e) => setConfig({
                      ...config,
                      referralPoints: { ...config.referralPoints, milestoneBonus: Number(e.target.value) }
                    })}
                    className="w-full bg-surface-card border border-border-subtle rounded-xl p-2 text-content-base font-bold text-xs num-tabular"
                  />
                  <span className="text-content-muted font-bold">pts</span>
                </div>
              </div>
            </div>
          </form>

          {/* Gerador de Link de Indicação */}
          <div className="bg-surface-card p-4 sm:p-5 rounded-xl border border-border-subtle space-y-3">
            <h3 className="text-xs font-bold text-content-base uppercase tracking-wider flex items-center gap-2">
              <Share2 className="w-4 h-4 text-gold-base" />
              <span>Gerador de Link de Indicação para Clientes</span>
            </h3>

            <div className="space-y-3 max-w-2xl text-xs">
              <div>
                <label className="block text-[10px] font-bold text-content-muted uppercase tracking-wider mb-1">Selecione o Cliente Remetente</label>
                <select
                  value={refClient?.id || ''}
                  onChange={(e) => {
                    const found = clients.find(c => c.id === e.target.value);
                    if (found) setRefClient(found);
                  }}
                  className="w-full bg-surface-base border border-border-subtle rounded-xl p-2.5 text-content-base focus:outline-none focus:border-gold-base"
                >
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name} - Código: {c.referralCode || 'Sem código'}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-content-muted uppercase tracking-wider mb-1">Mensagem do WhatsApp</label>
                <textarea
                  value={customRefMsg}
                  onChange={(e) => setCustomRefMsg(e.target.value)}
                  className="w-full bg-surface-base border border-border-subtle rounded-xl p-2.5 text-content-base focus:outline-none focus:border-gold-base min-h-[60px]"
                />
              </div>

              <div className="p-3 bg-surface-base rounded-xl border border-border-subtle space-y-2">
                <span className="text-[10px] font-bold uppercase text-content-muted block">Link Único Gerado</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedRefUrl}
                    className="flex-1 bg-surface-card border border-border-subtle rounded-xl p-2 text-xs font-mono text-gold-base min-w-0"
                  />
                  <button
                    onClick={() => copyToClipboard(generatedRefUrl)}
                    className="h-9 px-3 bg-gold-base text-surface-base font-bold text-xs rounded-xl hover:bg-gold-base/90 shrink-0 flex items-center gap-1"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'Copiado!' : 'Copiar'}</span>
                  </button>
                  <button
                    onClick={() => shareViaWhatsapp(refClient?.phone || '', `${customRefMsg} ${generatedRefUrl}`)}
                    className="h-9 px-3 bg-[#25D366] text-white font-bold text-xs rounded-xl hover:opacity-90 shrink-0 flex items-center gap-1"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: AVALIAÇÕES & NPS */}
      {activeTab === 'reviews' && (
        <div className="space-y-4 min-w-0">
          <div className="bg-surface-card p-4 sm:p-5 rounded-xl border border-border-subtle space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-bold text-content-base uppercase tracking-wider flex items-center gap-2">
                <QrCode className="w-4 h-4 text-gold-base" />
                <span>Link & QR Code para Pesquisas de Avaliação pós-serviço</span>
              </h3>
              <button
                onClick={() => setShowQrModal(true)}
                className="h-8 px-3 rounded-xl bg-surface-base border border-border-subtle text-gold-base hover:text-content-base text-xs font-bold flex items-center gap-1.5 active:scale-95"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Ver QR Code</span>
              </button>
            </div>

            <div className="p-3 bg-surface-base rounded-xl border border-border-subtle space-y-2 max-w-2xl">
              <span className="text-[10px] font-bold uppercase text-content-muted block">Link Público da Pesquisa NPS</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={generatedEvalUrl}
                  className="flex-1 bg-surface-card border border-border-subtle rounded-xl p-2 text-xs font-mono text-gold-base min-w-0"
                />
                <button
                  onClick={() => copyToClipboard(generatedEvalUrl, true)}
                  className="h-9 px-3 bg-gold-base text-surface-base font-bold text-xs rounded-xl hover:bg-gold-base/90 shrink-0 flex items-center gap-1"
                >
                  {copiedEvalLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedEvalLink ? 'Copiado!' : 'Copiar'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Feed de Avaliações */}
          <div className="bg-surface-card p-4 sm:p-5 rounded-xl border border-border-subtle space-y-3">
            <h4 className="text-xs font-bold text-content-base uppercase tracking-wider flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-gold-base" />
              <span>Feed de Pesquisas de Pós-Atendimento</span>
            </h4>

            {data?.reviewsList && data.reviewsList.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {data.reviewsList.map((rev: any) => (
                  <div key={rev.id} className="p-3.5 rounded-xl bg-surface-base border border-border-subtle space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3.5 h-3.5 ${s <= rev.rating ? 'fill-gold-base text-gold-base' : 'text-border-subtle'}`}
                          />
                        ))}
                      </div>
                      <span className="text-[10px] text-content-muted num-tabular">
                        {new Date(rev.createdAt).toLocaleDateString('pt-BR')}
                      </span>
                    </div>

                    {rev.serviceTitle && <p className="text-[10px] text-gold-base font-bold">{rev.serviceTitle}</p>}
                    <p className="text-content-base font-medium italic text-xs">
                      "{rev.comment || 'Sem observações adicionais.'}"
                    </p>

                    <div className="text-[10px] text-content-muted space-y-0.5 pt-2 border-t border-border-subtle">
                      <p>• Resultado: <span className="text-content-base font-bold">{rev.understoodRequest || 'Não informado'}</span></p>
                      <p>• Experiência: <span className="text-content-base font-bold">{rev.serviceExperience || 'Não informado'}</span></p>
                      <p>• Recomendaria: <span className="text-content-base font-bold">{rev.wouldRecommend || 'Com certeza'}</span></p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-content-muted py-6 text-center">Nenhuma avaliação recente registrada.</p>
            )}
          </div>

          {/* Modal QR Code */}
          {showQrModal && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-surface-base/80 backdrop-blur-sm">
              <div className="w-full max-w-xs bg-surface-card rounded-xl border border-border-subtle p-5 space-y-3 text-center shadow-lg">
                <h3 className="text-sm font-serif font-bold text-content-base">QR Code para Mesas & Espelhos</h3>

                <div className="p-3 bg-white rounded-xl border border-border-subtle inline-block mx-auto">
                  <QRCodeSVG
                    value={generatedEvalUrl}
                    size={200}
                    level="M"
                    includeMargin
                    fgColor="#111111"
                    bgColor="#ffffff"
                    aria-label="QR Code de Avaliação Navo"
                    className="mx-auto"
                  />
                </div>

                <div className="text-[10px] font-mono text-content-muted break-all">
                  {generatedEvalUrl}
                </div>

                <button
                  onClick={() => setShowQrModal(false)}
                  className="w-full h-9 bg-gold-base text-surface-base font-bold rounded-xl text-xs"
                >
                  Fechar QR Code
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};


