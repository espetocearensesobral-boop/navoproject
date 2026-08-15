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
  fetchServicesFromSupabase,
  fetchProductsFromSupabase,
  fetchLoyaltyConfig,
  saveLoyaltyConfig,
  fetchAdminLoyaltyTiers,
  saveAdminLoyaltyTiers,
  fetchAdminLoyaltyCatalog,
  createLoyaltyBenefit,
  updateLoyaltyBenefit,
  archiveLoyaltyBenefit,
  createLoyaltyPlan,
  updateLoyaltyPlan,
  archiveLoyaltyPlan
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
  const [tiers, setTiers] = useState<any[]>([]);
  const [benefits, setBenefits] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [savingTiers, setSavingTiers] = useState(false);
  const [savingCatalogItem, setSavingCatalogItem] = useState(false);
  const [showBenefitModal, setShowBenefitModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingBenefit, setEditingBenefit] = useState<any | null>(null);
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [benefitDraft, setBenefitDraft] = useState<any>({ name: '', description: '', benefitType: 'custom', valueAmount: null, valueText: '', serviceId: '', productId: '', usageLimit: null, validityDays: null, displayOrder: 0, isActive: true, tierIds: [] });
  const [planDraft, setPlanDraft] = useState<any>({ name: '', description: '', price: 0, billingPeriod: 'none', pointsBonus: 0, status: 'draft', displayOrder: 0, isFeatured: false, benefitIds: [] });
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
      const [dashRes, rwdRes, clientList, serviceList, productList, cfgRes, tiersRes, catalogRes] = await Promise.all([
        fetchNavoRewardsAdminDashboard(),
        fetchRewardsList(),
        fetchClientsFromSupabase(),
        fetchServicesFromSupabase().catch(() => []),
        fetchProductsFromSupabase().catch(() => []),
        fetchLoyaltyConfig().catch(() => null),
        fetchAdminLoyaltyTiers().catch(() => []),
        fetchAdminLoyaltyCatalog().catch(() => ({ benefits: [], plans: [] }))
      ]);
      setData(dashRes);
      setRewardsList(rwdRes);
      setClients(clientList || []);
      setServices(serviceList || []);
      setProducts(productList || []);
      if (clientList && clientList.length > 0) {
        setRefClient(clientList[0]);
        setEvalClient(clientList[0]);
      }
      if (cfgRes) {
        setConfig(cfgRes);
      }
      setTiers(Array.isArray(tiersRes) ? tiersRes : []);
      setBenefits(Array.isArray(catalogRes?.benefits) ? catalogRes.benefits : []);
      setPlans(Array.isArray(catalogRes?.plans) ? catalogRes.plans : []);
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

  const handleSaveTiers = async () => {
    setSavingTiers(true);
    try {
      await saveAdminLoyaltyTiers(tiers);
      setConfigSuccessMsg('Níveis salvos com sucesso!');
      await loadData();
      setTimeout(() => setConfigSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar níveis.');
    } finally {
      setSavingTiers(false);
    }
  };

  const resetBenefitDraft = () => setBenefitDraft({ name: '', description: '', benefitType: 'custom', valueAmount: null, valueText: '', serviceId: '', productId: '', usageLimit: null, validityDays: null, displayOrder: 0, isActive: true, tierIds: [] });
  const resetPlanDraft = () => setPlanDraft({ name: '', description: '', price: 0, billingPeriod: 'none', pointsBonus: 0, status: 'draft', displayOrder: 0, isFeatured: false, benefitIds: [] });

  const handleSaveBenefit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCatalogItem(true);
    try {
      const payload = { ...benefitDraft, valueAmount: benefitDraft.valueAmount === '' ? null : benefitDraft.valueAmount, serviceId: benefitDraft.serviceId || null, productId: benefitDraft.productId || null };
      if (editingBenefit?.id) await updateLoyaltyBenefit(editingBenefit.id, payload);
      else await createLoyaltyBenefit(payload);
      setShowBenefitModal(false);
      setEditingBenefit(null);
      resetBenefitDraft();
      setConfigSuccessMsg('Benefício salvo com sucesso!');
      await loadData();
      setTimeout(() => setConfigSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar benefício.');
    } finally {
      setSavingCatalogItem(false);
    }
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCatalogItem(true);
    try {
      const payload = { ...planDraft, price: Number(planDraft.price || 0), pointsBonus: Number(planDraft.pointsBonus || 0) };
      if (editingPlan?.id) await updateLoyaltyPlan(editingPlan.id, payload);
      else await createLoyaltyPlan(payload);
      setShowPlanModal(false);
      setEditingPlan(null);
      resetPlanDraft();
      setConfigSuccessMsg('Plano salvo com sucesso!');
      await loadData();
      setTimeout(() => setConfigSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar plano.');
    } finally {
      setSavingCatalogItem(false);
    }
  };

  const openBenefitEditor = (benefit?: any) => {
    setEditingBenefit(benefit || null);
    setBenefitDraft(benefit ? { ...benefit, valueAmount: benefit.valueAmount ?? null, serviceId: benefit.serviceId || '', productId: benefit.productId || '', tierIds: benefit.tierIds || [] } : { name: '', description: '', benefitType: 'custom', valueAmount: null, valueText: '', serviceId: '', productId: '', usageLimit: null, validityDays: null, displayOrder: 0, isActive: true, tierIds: [] });
    setShowBenefitModal(true);
  };

  const openPlanEditor = (plan?: any) => {
    setEditingPlan(plan || null);
    setPlanDraft(plan ? { ...plan, benefitIds: plan.benefitIds || [] } : { name: '', description: '', price: 0, billingPeriod: 'none', pointsBonus: 0, status: 'draft', displayOrder: 0, isFeatured: false, benefitIds: [] });
    setShowPlanModal(true);
  };

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
                  <p className="text-[9px] text-content-muted mt-1 font-medium truncate">{tiers.find((tier) => tier.name === 'Bronze')?.multiplier || 1}x mult</p>
                </div>

                <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider truncate">Prata</span>
                    <div className="w-6 h-6 rounded-lg bg-slate-400/10 flex items-center justify-center shrink-0">
                      <Crown className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <p className="text-lg font-black text-content-base tabular-nums truncate">{data?.tierDistribution?.Prata || 0}</p>
                  <p className="text-[9px] text-content-muted mt-1 font-medium truncate">{tiers.find((tier) => tier.name === 'Prata')?.multiplier || 1.2}x mult</p>
                </div>

                <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
                  <div className="flex items-center justify-between text-gold-base mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider truncate">Ouro</span>
                    <div className="w-6 h-6 rounded-lg bg-gold-base/10 flex items-center justify-center shrink-0">
                      <Crown className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <p className="text-lg font-black text-content-base tabular-nums truncate">{data?.tierDistribution?.Ouro || 0}</p>
                  <p className="text-[9px] text-content-muted mt-1 font-medium truncate">{tiers.find((tier) => tier.name === 'Ouro')?.multiplier || 1.5}x mult</p>
                </div>

                <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
                  <div className="flex items-center justify-between text-cyan-400 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider truncate">Diamante</span>
                    <div className="w-6 h-6 rounded-lg bg-cyan-400/10 flex items-center justify-center shrink-0">
                      <Crown className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <p className="text-lg font-black text-content-base tabular-nums truncate">{data?.tierDistribution?.Diamante || 0}</p>
                  <p className="text-[9px] text-content-muted mt-1 font-medium truncate">{tiers.find((tier) => tier.name === 'Diamante')?.multiplier || 2}x mult</p>
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

            <div className="pt-2 text-xs text-content-muted">
              Os limites e multiplicadores dos níveis são mantidos na seção de níveis persistidos abaixo. As alterações passam por validação no servidor e afetam novos créditos, sem recalcular saldos históricos.
            </div>
          </form>

          <div className="bg-surface-card p-4 sm:p-5 rounded-xl border border-border-subtle space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold text-content-base uppercase tracking-wider flex items-center gap-2"><Crown className="w-4 h-4 text-gold-base" /> Níveis VIP reais</h3>
                <p className="text-[11px] text-content-muted mt-1">Defina o mínimo de pontos e o multiplicador usado no próximo checkout confirmado.</p>
              </div>
              <div className="flex gap-2"><button type="button" onClick={() => setTiers((current) => [...current, { name: 'Novo nível', minimumPoints: 0, multiplier: 1, displayOrder: current.length, color: '#D4AF5A', isActive: true }])} className="h-9 px-3 rounded-xl border border-border-subtle text-content-base font-bold text-xs flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Novo nível</button><button type="button" onClick={handleSaveTiers} disabled={savingTiers || tiers.length === 0} className="h-9 px-4 rounded-xl bg-gold-base text-surface-base font-bold text-xs disabled:opacity-50">{savingTiers ? 'Salvando...' : 'Salvar níveis'}</button></div>
            </div>
            <div className="space-y-2">
              {tiers.map((tier, index) => (
                <div key={tier.id || index} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_120px_100px_82px_70px_auto] gap-2 items-center rounded-xl border border-border-subtle bg-surface-base p-2.5">
                  <input value={tier.name} onChange={(e) => setTiers((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: e.target.value } : item))} className="min-w-0 bg-surface-card border border-border-subtle rounded-lg p-2 text-xs font-bold text-content-base" aria-label={`Nome do nível ${index + 1}`} />
                  <input type="number" min="0" step="1" value={tier.minimumPoints} onChange={(e) => setTiers((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, minimumPoints: Number(e.target.value) } : item))} className="bg-surface-card border border-border-subtle rounded-lg p-2 text-xs text-content-base num-tabular" aria-label={`Pontos mínimos do nível ${index + 1}`} />
                  <input type="number" min="0.1" max="20" step="0.1" value={tier.multiplier} onChange={(e) => setTiers((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, multiplier: Number(e.target.value) } : item))} className="bg-surface-card border border-border-subtle rounded-lg p-2 text-xs text-content-base num-tabular" aria-label={`Multiplicador do nível ${index + 1}`} />
                  <input type="number" min="0" step="1" value={tier.displayOrder} onChange={(e) => setTiers((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, displayOrder: Number(e.target.value) } : item))} className="bg-surface-card border border-border-subtle rounded-lg p-2 text-xs text-content-base num-tabular" aria-label={`Ordem do nível ${index + 1}`} />
                  <input type="color" value={tier.color || '#D4AF5A'} onChange={(e) => setTiers((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, color: e.target.value } : item))} className="w-full h-9 bg-surface-card border border-border-subtle rounded-lg p-1" aria-label={`Cor do nível ${index + 1}`} />
                  <label className="flex items-center gap-2 text-[11px] text-content-muted"><input type="checkbox" checked={Boolean(tier.isActive)} onChange={(e) => setTiers((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, isActive: e.target.checked } : item))} /> Ativo</label>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-surface-card p-4 sm:p-5 rounded-xl border border-border-subtle space-y-3 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold text-content-base uppercase tracking-wider">Benefícios do Club</h3>
                  <p className="text-[11px] text-content-muted mt-1">Crie vantagens, descontos, cortes, produtos e regras de uso.</p>
                </div>
                <button type="button" onClick={() => openBenefitEditor()} className="h-9 px-3 rounded-xl bg-gold-base text-surface-base font-bold text-xs flex items-center gap-1.5 shrink-0"><Plus className="w-3.5 h-3.5" /> Novo benefício</button>
              </div>
              <div className="space-y-2">
                {benefits.length === 0 ? <p className="text-xs text-content-muted py-5 text-center">Nenhum benefício cadastrado.</p> : benefits.map((benefit) => (
                  <div key={benefit.id} className="p-3 rounded-xl border border-border-subtle bg-surface-base flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-xs text-content-base">{benefit.name}</span>
                        {!benefit.isActive && <span className="text-[9px] rounded-full px-2 py-0.5 bg-status-error/10 text-status-error font-bold">INATIVO</span>}
                      </div>
                      <p className="text-[10px] text-content-muted mt-1 line-clamp-2">{benefit.description}</p>
                      <p className="text-[10px] text-gold-base mt-1 font-bold">{benefit.benefitType} {benefit.valueAmount !== null && benefit.valueAmount !== undefined ? `• R$ ${Number(benefit.valueAmount).toFixed(2).replace('.', ',')}` : ''} {benefit.tierIds?.length ? `• ${benefit.tierIds.length} nível(is)` : ''}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button type="button" onClick={() => openBenefitEditor(benefit)} className="h-8 px-2.5 rounded-lg border border-border-subtle text-content-base text-[10px] font-bold">Editar</button>
                      {benefit.isActive && <button type="button" onClick={async () => { if (!confirm('Desativar este benefício?')) return; try { await archiveLoyaltyBenefit(benefit.id); await loadData(); } catch (err: any) { alert(err.message || 'Erro ao desativar benefício.'); } }} className="h-8 w-8 rounded-lg border border-border-subtle text-status-error flex items-center justify-center" title="Desativar benefício"><Trash2 className="w-3.5 h-3.5" /></button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-surface-card p-4 sm:p-5 rounded-xl border border-border-subtle space-y-3 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold text-content-base uppercase tracking-wider">Planos do Club</h3>
                  <p className="text-[11px] text-content-muted mt-1">Defina nome, preço, periodicidade, bônus e benefícios. Ainda sem cobrança automática.</p>
                </div>
                <button type="button" onClick={() => openPlanEditor()} className="h-9 px-3 rounded-xl bg-gold-base text-surface-base font-bold text-xs flex items-center gap-1.5 shrink-0"><Plus className="w-3.5 h-3.5" /> Novo plano</button>
              </div>
              <div className="space-y-2">
                {plans.length === 0 ? <p className="text-xs text-content-muted py-5 text-center">Nenhum plano cadastrado.</p> : plans.map((plan) => (
                  <div key={plan.id} className="p-3 rounded-xl border border-border-subtle bg-surface-base flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-xs text-content-base">{plan.name}</span>
                        <span className={`text-[9px] rounded-full px-2 py-0.5 font-bold ${plan.status === 'active' ? 'bg-status-success/10 text-status-success' : 'bg-surface-card text-content-muted'}`}>{plan.status.toUpperCase()}</span>
                        {plan.isFeatured && <span className="text-[9px] rounded-full px-2 py-0.5 bg-gold-base/10 text-gold-base font-bold">DESTAQUE</span>}
                      </div>
                      <p className="text-[10px] text-content-muted mt-1 line-clamp-2">{plan.description}</p>
                      <p className="text-[10px] text-gold-base mt-1 font-bold">R$ {Number(plan.price || 0).toFixed(2).replace('.', ',')} {plan.billingPeriod !== 'none' ? `• ${plan.billingPeriod}` : '• único'} {plan.pointsBonus ? `• +${plan.pointsBonus} pts` : ''}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button type="button" onClick={() => openPlanEditor(plan)} className="h-8 px-2.5 rounded-lg border border-border-subtle text-content-base text-[10px] font-bold">Editar</button>
                      {plan.status !== 'archived' && <button type="button" onClick={async () => { if (!confirm('Arquivar este plano?')) return; try { await archiveLoyaltyPlan(plan.id); await loadData(); } catch (err: any) { alert(err.message || 'Erro ao arquivar plano.'); } }} className="h-8 w-8 rounded-lg border border-border-subtle text-status-error flex items-center justify-center" title="Arquivar plano"><Trash2 className="w-3.5 h-3.5" /></button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {showBenefitModal && (
            <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-surface-base/80 backdrop-blur-md">
              <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-surface-card rounded-2xl border border-border-subtle p-5 sm:p-6 shadow-2xl">
                <div className="mb-4"><h3 className="text-base font-serif font-bold text-content-base">{editingBenefit ? 'Editar benefício' : 'Novo benefício'}</h3><p className="text-xs text-content-muted mt-1">O benefício é cadastrado no banco e pode ser vinculado a um ou mais níveis.</p></div>
                <form onKeyDown={handleEnterAsTab} onSubmit={handleSaveBenefit} className="space-y-3 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="space-y-1"><span className="block text-[10px] font-bold text-content-muted uppercase">Nome</span><input autoFocus required value={benefitDraft.name} onChange={(e) => setBenefitDraft({ ...benefitDraft, name: e.target.value })} className="w-full bg-surface-base border border-border-subtle rounded-xl p-2.5 text-content-base" /></label>
                    <label className="space-y-1"><span className="block text-[10px] font-bold text-content-muted uppercase">Tipo</span><select value={benefitDraft.benefitType} onChange={(e) => setBenefitDraft({ ...benefitDraft, benefitType: e.target.value })} className="w-full bg-surface-base border border-border-subtle rounded-xl p-2.5 text-content-base"><option value="discount_percent">Desconto percentual</option><option value="discount_fixed">Desconto fixo</option><option value="free_service">Serviço grátis</option><option value="free_product">Produto grátis</option><option value="points_bonus">Bônus de pontos</option><option value="priority_queue">Prioridade na fila</option><option value="custom">Personalizado</option></select></label>
                  </div>
                  <label className="space-y-1 block"><span className="block text-[10px] font-bold text-content-muted uppercase">Descrição</span><textarea required value={benefitDraft.description} onChange={(e) => setBenefitDraft({ ...benefitDraft, description: e.target.value })} className="w-full min-h-[72px] bg-surface-base border border-border-subtle rounded-xl p-2.5 text-content-base" /></label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="space-y-1"><span className="block text-[10px] font-bold text-content-muted uppercase">Valor numérico</span><input type="number" min="0" step="0.01" value={benefitDraft.valueAmount ?? ''} onChange={(e) => setBenefitDraft({ ...benefitDraft, valueAmount: e.target.value === '' ? null : Number(e.target.value) })} className="w-full bg-surface-base border border-border-subtle rounded-xl p-2.5 text-content-base" placeholder="Ex.: 10" /></label>
                    <label className="space-y-1"><span className="block text-[10px] font-bold text-content-muted uppercase">Texto do valor</span><input value={benefitDraft.valueText || ''} onChange={(e) => setBenefitDraft({ ...benefitDraft, valueText: e.target.value })} className="w-full bg-surface-base border border-border-subtle rounded-xl p-2.5 text-content-base" placeholder="Ex.: 10% OFF" /></label>
                    <label className="space-y-1"><span className="block text-[10px] font-bold text-content-muted uppercase">Validade (dias)</span><input type="number" min="1" value={benefitDraft.validityDays ?? ''} onChange={(e) => setBenefitDraft({ ...benefitDraft, validityDays: e.target.value === '' ? null : Number(e.target.value) })} className="w-full bg-surface-base border border-border-subtle rounded-xl p-2.5 text-content-base" placeholder="Opcional" /></label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="space-y-1"><span className="block text-[10px] font-bold text-content-muted uppercase">Serviço relacionado</span><select value={benefitDraft.serviceId || ''} onChange={(e) => setBenefitDraft({ ...benefitDraft, serviceId: e.target.value })} className="w-full bg-surface-base border border-border-subtle rounded-xl p-2.5 text-content-base"><option value="">Todos os serviços</option>{services.map((service) => <option key={service.id} value={service.id}>{service.title} — R$ {Number(service.price || 0).toFixed(2).replace('.', ',')}</option>)}</select></label>
                    <label className="space-y-1"><span className="block text-[10px] font-bold text-content-muted uppercase">Produto relacionado</span><select value={benefitDraft.productId || ''} onChange={(e) => setBenefitDraft({ ...benefitDraft, productId: e.target.value })} className="w-full bg-surface-base border border-border-subtle rounded-xl p-2.5 text-content-base"><option value="">Todos os produtos</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} — R$ {Number(product.price || 0).toFixed(2).replace('.', ',')}</option>)}</select></label>
                  </div>
                  <div><span className="block text-[10px] font-bold text-content-muted uppercase mb-2">Níveis elegíveis</span><div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{tiers.map((tier) => <label key={tier.id} className="flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-base p-2 text-[11px] text-content-base"><input type="checkbox" disabled={!tier.id} checked={Boolean(tier.id && (benefitDraft.tierIds || []).includes(tier.id))} onChange={(e) => setBenefitDraft({ ...benefitDraft, tierIds: e.target.checked ? [...(benefitDraft.tierIds || []), tier.id] : (benefitDraft.tierIds || []).filter((id: string) => id !== tier.id) })} />{tier.name}{!tier.id && <span className="text-[9px] text-content-muted">(salve primeiro)</span>}</label>)}</div></div>
                  <div className="flex gap-2 pt-2"><button type="button" onClick={() => { setShowBenefitModal(false); setEditingBenefit(null); }} className="flex-1 h-10 rounded-xl border border-border-subtle text-content-muted font-bold">Cancelar</button><button type="submit" disabled={savingCatalogItem} className="flex-1 h-10 rounded-xl bg-gold-base text-surface-base font-bold disabled:opacity-50">{savingCatalogItem ? 'Salvando...' : 'Salvar benefício'}</button></div>
                </form>
              </div>
            </div>
          )}

          {showPlanModal && (
            <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-surface-base/80 backdrop-blur-md">
              <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-surface-card rounded-2xl border border-border-subtle p-5 sm:p-6 shadow-2xl">
                <div className="mb-4"><h3 className="text-base font-serif font-bold text-content-base">{editingPlan ? 'Editar plano' : 'Novo plano'}</h3><p className="text-xs text-content-muted mt-1">O valor é salvo como catálogo. Nenhuma cobrança ou assinatura é criada nesta etapa.</p></div>
                <form onKeyDown={handleEnterAsTab} onSubmit={handleSavePlan} className="space-y-3 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><label className="space-y-1"><span className="block text-[10px] font-bold text-content-muted uppercase">Nome</span><input autoFocus required value={planDraft.name} onChange={(e) => setPlanDraft({ ...planDraft, name: e.target.value })} className="w-full bg-surface-base border border-border-subtle rounded-xl p-2.5 text-content-base" /></label><label className="space-y-1"><span className="block text-[10px] font-bold text-content-muted uppercase">Preço (R$)</span><input type="number" min="0" step="0.01" value={planDraft.price} onChange={(e) => setPlanDraft({ ...planDraft, price: Number(e.target.value) })} className="w-full bg-surface-base border border-border-subtle rounded-xl p-2.5 text-content-base" /></label></div>
                  <label className="space-y-1 block"><span className="block text-[10px] font-bold text-content-muted uppercase">Descrição</span><textarea required value={planDraft.description} onChange={(e) => setPlanDraft({ ...planDraft, description: e.target.value })} className="w-full min-h-[72px] bg-surface-base border border-border-subtle rounded-xl p-2.5 text-content-base" /></label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><label className="space-y-1"><span className="block text-[10px] font-bold text-content-muted uppercase">Periodicidade</span><select value={planDraft.billingPeriod} onChange={(e) => setPlanDraft({ ...planDraft, billingPeriod: e.target.value })} className="w-full bg-surface-base border border-border-subtle rounded-xl p-2.5 text-content-base"><option value="none">Pagamento único / catálogo</option><option value="monthly">Mensal</option><option value="quarterly">Trimestral</option><option value="annual">Anual</option></select></label><label className="space-y-1"><span className="block text-[10px] font-bold text-content-muted uppercase">Bônus de pontos</span><input type="number" min="0" value={planDraft.pointsBonus} onChange={(e) => setPlanDraft({ ...planDraft, pointsBonus: Number(e.target.value) })} className="w-full bg-surface-base border border-border-subtle rounded-xl p-2.5 text-content-base" /></label><label className="space-y-1"><span className="block text-[10px] font-bold text-content-muted uppercase">Status</span><select value={planDraft.status} onChange={(e) => setPlanDraft({ ...planDraft, status: e.target.value })} className="w-full bg-surface-base border border-border-subtle rounded-xl p-2.5 text-content-base"><option value="draft">Rascunho</option><option value="active">Ativo</option><option value="archived">Arquivado</option></select></label></div>
                  <label className="flex items-center gap-2 text-[11px] text-content-base"><input type="checkbox" checked={Boolean(planDraft.isFeatured)} onChange={(e) => setPlanDraft({ ...planDraft, isFeatured: e.target.checked })} /> Destacar este plano para o cliente</label>
                  <div><span className="block text-[10px] font-bold text-content-muted uppercase mb-2">Benefícios incluídos</span><div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto">{benefits.filter((benefit) => benefit.isActive).map((benefit) => <label key={benefit.id} className="flex items-start gap-2 rounded-xl border border-border-subtle bg-surface-base p-2 text-[11px] text-content-base"><input type="checkbox" checked={(planDraft.benefitIds || []).includes(benefit.id)} onChange={(e) => setPlanDraft({ ...planDraft, benefitIds: e.target.checked ? [...(planDraft.benefitIds || []), benefit.id] : (planDraft.benefitIds || []).filter((id: string) => id !== benefit.id) })} /><span><strong>{benefit.name}</strong><span className="block text-content-muted mt-0.5">{benefit.description}</span></span></label>)}</div></div>
                  <div className="flex gap-2 pt-2"><button type="button" onClick={() => { setShowPlanModal(false); setEditingPlan(null); }} className="flex-1 h-10 rounded-xl border border-border-subtle text-content-muted font-bold">Cancelar</button><button type="submit" disabled={savingCatalogItem} className="flex-1 h-10 rounded-xl bg-gold-base text-surface-base font-bold disabled:opacity-50">{savingCatalogItem ? 'Salvando...' : 'Salvar plano'}</button></div>
                </form>
              </div>
            </div>
          )}

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
                    className="h-9 px-3 bg-whatsapp text-whatsapp-on font-bold text-xs rounded-xl hover:opacity-90 shrink-0 flex items-center gap-1"
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


