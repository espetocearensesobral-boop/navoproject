import React, { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { AdminPageHeader } from "./shared/AdminPageHeader";
import { AdminFab } from "./shared/AdminFab";
import { AdminTabs } from "./shared/AdminTabs";
import { handleEnterAsTab } from "../../utils/formUtils";
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
  archiveLoyaltyPlan,
  updateAdminReviewFollowup,
} from "../../services/supabaseDataService";
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
  Send,
} from "lucide-react";

type NavoRewardsTab =
  "dashboard" | "loyalty" | "rewards" | "referrals" | "reviews";

interface NavoRewardsAdminProps {
  initialTab?: NavoRewardsTab;
}

const rewardsPageTitles: Record<NavoRewardsTab, string> = {
  dashboard: "Dashboard Geral",
  loyalty: "Clube de Fidelidade & Níveis",
  rewards: "Prêmios & Cupons de Desconto",
  referrals: "Motor de Indicações",
  reviews: "Avaliações & NPS",
};

const reviewStatusLabels: Record<string, string> = {
  new: "Nova",
  in_review: "Em análise",
  resolved: "Tratada",
  archived: "Arquivada",
};

const reviewPriorityLabels: Record<string, string> = {
  low: "Baixa",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
};

export const NavoRewardsAdmin: React.FC<NavoRewardsAdminProps> = ({
  initialTab,
}) => {
  const [activeTab, setActiveTab] = useState<NavoRewardsTab>(
    initialTab || "dashboard",
  );
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
    title: "",
    pointsRequired: 500,
    rewardType: "upgrade",
    valueDescription: "",
    icon: "Sparkles",
  });

  // Manual points state
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [manualPointsAmount, setManualPointsAmount] = useState(100);
  const [manualPointsReason, setManualPointsReason] = useState("");
  const [manualSuccessMsg, setManualSuccessMsg] = useState<string | null>(null);

  // Voucher validation state
  const [voucherCodeInput, setVoucherCodeInput] = useState("");
  const [voucherValidationResult, setVoucherValidationResult] = useState<
    string | null
  >(null);

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
  const [benefitDraft, setBenefitDraft] = useState<any>({
    name: "",
    description: "",
    benefitType: "custom",
    valueAmount: null,
    valueText: "",
    serviceId: "",
    productId: "",
    usageLimit: null,
    validityDays: null,
    displayOrder: 0,
    isActive: true,
    tierIds: [],
  });
  const [planDraft, setPlanDraft] = useState<any>({
    name: "",
    description: "",
    price: 0,
    billingPeriod: "none",
    pointsBonus: 0,
    status: "draft",
    displayOrder: 0,
    isFeatured: false,
    benefitIds: [],
  });
  const [config, setConfig] = useState<any>({
    currencyPerPoint: 1.0,
    pointsValidityDays: 365,
    tierMultipliers: {
      Bronze: 1.0,
      Prata: 1.2,
      Ouro: 1.5,
      Diamante: 2.0,
    },
    referralPoints: {
      referrerBonus: 100,
      referredBonus: 50,
      milestoneCount: 5,
      milestoneBonus: 1000,
    },
    reviewPoints: {
      baseReview: 20,
      withPhotoBonus: 30,
      fiveStarBonus: 10,
    },
    birthdayBonus: 100,
  });

  const [savingConfig, setSavingConfig] = useState(false);
  const [configSuccessMsg, setConfigSuccessMsg] = useState<string | null>(null);

  // REFERRAL LINK GENERATOR STATE
  const [refClient, setRefClient] = useState<any | null>(null);
  const [customRefMsg, setCustomRefMsg] = useState(
    "Olá! Te convido para conhecer a Barbearia Navo. Agende seu primeiro corte usando meu link e ganhe 50 pontos bônus no clube de fidelidade:",
  );
  const [copiedLink, setCopiedLink] = useState(false);

  // EVALUATION LINK / QR CODE STATE
  const [evalClient, setEvalClient] = useState<any | null>(null);
  const [customEvalMsg, setCustomEvalMsg] = useState(
    "Olá! Como foi sua experiência hoje na Barbearia Navo? Avalie em 1 minuto e ganhe pontos extras na sua carteira:",
  );
  const [copiedEvalLink, setCopiedEvalLink] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  // REVIEW FOLLOW-UP STATE
  const [reviewStatusFilter, setReviewStatusFilter] = useState("all");
  const [reviewPriorityFilter, setReviewPriorityFilter] = useState("all");
  const [selectedReview, setSelectedReview] = useState<any | null>(null);
  const [reviewDraft, setReviewDraft] = useState({
    managementStatus: "new",
    priority: "normal",
    internalNotes: "",
  });
  const [savingReviewFollowup, setSavingReviewFollowup] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [
        dashRes,
        rwdRes,
        clientList,
        serviceList,
        productList,
        cfgRes,
        tiersRes,
        catalogRes,
      ] = await Promise.all([
        fetchNavoRewardsAdminDashboard(),
        fetchRewardsList(),
        fetchClientsFromSupabase(),
        fetchServicesFromSupabase().catch(() => []),
        fetchProductsFromSupabase().catch(() => []),
        fetchLoyaltyConfig().catch(() => null),
        fetchAdminLoyaltyTiers().catch(() => []),
        fetchAdminLoyaltyCatalog().catch(() => ({ benefits: [], plans: [] })),
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
      setBenefits(
        Array.isArray(catalogRes?.benefits) ? catalogRes.benefits : [],
      );
      setPlans(Array.isArray(catalogRes?.plans) ? catalogRes.plans : []);
    } catch (e) {
      console.error("Erro ao carregar dados do Navo Rewards:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleRefresh = () => loadData();
    window.addEventListener("adminRefresh", handleRefresh);
    return () => window.removeEventListener("adminRefresh", handleRefresh);
  }, []);

  const handleSaveTiers = async () => {
    setSavingTiers(true);
    try {
      await saveAdminLoyaltyTiers(tiers);
      setConfigSuccessMsg("Níveis salvos com sucesso!");
      await loadData();
      setTimeout(() => setConfigSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || "Erro ao salvar níveis.");
    } finally {
      setSavingTiers(false);
    }
  };

  const resetBenefitDraft = () =>
    setBenefitDraft({
      name: "",
      description: "",
      benefitType: "custom",
      valueAmount: null,
      valueText: "",
      serviceId: "",
      productId: "",
      usageLimit: null,
      validityDays: null,
      displayOrder: 0,
      isActive: true,
      tierIds: [],
    });
  const resetPlanDraft = () =>
    setPlanDraft({
      name: "",
      description: "",
      price: 0,
      billingPeriod: "none",
      pointsBonus: 0,
      status: "draft",
      displayOrder: 0,
      isFeatured: false,
      benefitIds: [],
    });

  const handleSaveBenefit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCatalogItem(true);
    try {
      const payload = {
        ...benefitDraft,
        valueAmount:
          benefitDraft.valueAmount === "" ? null : benefitDraft.valueAmount,
        serviceId: benefitDraft.serviceId || null,
        productId: benefitDraft.productId || null,
      };
      if (editingBenefit?.id)
        await updateLoyaltyBenefit(editingBenefit.id, payload);
      else await createLoyaltyBenefit(payload);
      setShowBenefitModal(false);
      setEditingBenefit(null);
      resetBenefitDraft();
      setConfigSuccessMsg("Benefício salvo com sucesso!");
      await loadData();
      setTimeout(() => setConfigSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || "Erro ao salvar benefício.");
    } finally {
      setSavingCatalogItem(false);
    }
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCatalogItem(true);
    try {
      const payload = {
        ...planDraft,
        price: Number(planDraft.price || 0),
        pointsBonus: Number(planDraft.pointsBonus || 0),
      };
      if (editingPlan?.id) await updateLoyaltyPlan(editingPlan.id, payload);
      else await createLoyaltyPlan(payload);
      setShowPlanModal(false);
      setEditingPlan(null);
      resetPlanDraft();
      setConfigSuccessMsg("Plano salvo com sucesso!");
      await loadData();
      setTimeout(() => setConfigSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || "Erro ao salvar plano.");
    } finally {
      setSavingCatalogItem(false);
    }
  };

  const openBenefitEditor = (benefit?: any) => {
    setEditingBenefit(benefit || null);
    setBenefitDraft(
      benefit
        ? {
            ...benefit,
            valueAmount: benefit.valueAmount ?? null,
            serviceId: benefit.serviceId || "",
            productId: benefit.productId || "",
            tierIds: benefit.tierIds || [],
          }
        : {
            name: "",
            description: "",
            benefitType: "custom",
            valueAmount: null,
            valueText: "",
            serviceId: "",
            productId: "",
            usageLimit: null,
            validityDays: null,
            displayOrder: 0,
            isActive: true,
            tierIds: [],
          },
    );
    setShowBenefitModal(true);
  };

  const openPlanEditor = (plan?: any) => {
    setEditingPlan(plan || null);
    setPlanDraft(
      plan
        ? { ...plan, benefitIds: plan.benefitIds || [] }
        : {
            name: "",
            description: "",
            price: 0,
            billingPeriod: "none",
            pointsBonus: 0,
            status: "draft",
            displayOrder: 0,
            isFeatured: false,
            benefitIds: [],
          },
    );
    setShowPlanModal(true);
  };

  const handleSaveConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingConfig(true);
    try {
      const res = await saveLoyaltyConfig(config);
      setConfigSuccessMsg(res.message || "Configurações salvas!");
      setTimeout(() => setConfigSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || "Erro ao salvar configurações.");
    } finally {
      setSavingConfig(false);
    }
  };

  const handleTriggerCampaign = async () => {
    if (
      !confirm(
        "Deseja creditar +100 pontos para todos os clientes ativos como incentivo de retorno?",
      )
    )
      return;
    setCampaignLoading(true);
    try {
      const res = await triggerInactiveClientsCampaign();
      setCampaignMsg(res.message);
      await loadData();
      setTimeout(() => setCampaignMsg(null), 5000);
    } catch (err: any) {
      alert(err.message || "Erro ao disparar campanha");
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
        title: "",
        pointsRequired: 500,
        rewardType: "upgrade",
        valueDescription: "",
        icon: "Sparkles",
      });
      await loadData();
    } catch (err: any) {
      alert(err.message || "Erro ao criar recompensa.");
    }
  };

  const handleDeleteReward = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover esta recompensa?")) return;
    try {
      await deleteAdminReward(id);
      await loadData();
    } catch (err: any) {
      alert(err.message || "Erro ao remover recompensa.");
    }
  };

  const handleManualPointsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) {
      alert("Selecione um cliente.");
      return;
    }
    try {
      const res = await manuallyAdjustPoints(
        selectedClient,
        Number(manualPointsAmount),
        manualPointsReason,
      );
      setManualSuccessMsg(res.message);
      setManualPointsReason("");
      await loadData();
      setTimeout(() => setManualSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || "Erro ao ajustar pontos.");
    }
  };

  const handleValidateVoucher = () => {
    if (!voucherCodeInput.trim()) return;
    if (voucherCodeInput.toUpperCase().startsWith("NAV-RWD-")) {
      setVoucherValidationResult(
        `✅ VOUCHER VÁLIDO: Código ${voucherCodeInput.toUpperCase()} confirmado! Pode conceder o prêmio ao cliente.`,
      );
    } else {
      setVoucherValidationResult(
        `Voucher inválido ou código incorreto. Verifique com o cliente.`,
      );
    }
  };

  const baseUrl = window.location.origin;
  const currentRefCode =
    refClient?.referralCode ||
    `NAV-${refClient?.name ? refClient.name.split(" ")[0].toUpperCase() : "GUEST"}100`;
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
    const cleanPhone = (phone || "").replace(/\D/g, "");
    const encodedText = encodeURIComponent(text);
    const whatsappUrl = cleanPhone
      ? `https://wa.me/55${cleanPhone}?text=${encodedText}`
      : `https://wa.me/?text=${encodedText}`;
    window.open(whatsappUrl, "_blank");
  };

  const openReviewFollowup = (review: any) => {
    setSelectedReview(review);
    setReviewDraft({
      managementStatus: review.managementStatus || "new",
      priority: review.priority || "normal",
      internalNotes: review.internalNotes || "",
    });
  };

  const handleSaveReviewFollowup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedReview) return;
    setSavingReviewFollowup(true);
    try {
      const result = await updateAdminReviewFollowup(selectedReview.id, {
        managementStatus: reviewDraft.managementStatus,
        priority: reviewDraft.priority,
        internalNotes: reviewDraft.internalNotes.trim() || null,
      });
      setData((current: any) =>
        current
          ? {
              ...current,
              reviewsList: (current.reviewsList || []).map((review: any) =>
                review.id === selectedReview.id
                  ? { ...review, ...result.review }
                  : review,
              ),
            }
          : current,
      );
      setSelectedReview(null);
    } catch (error: any) {
      alert(error.message || "Não foi possível salvar o acompanhamento.");
    } finally {
      setSavingReviewFollowup(false);
    }
  };

  const reviewsList = Array.isArray(data?.reviewsList) ? data.reviewsList : [];
  const filteredReviews = reviewsList.filter(
    (review: any) =>
      (reviewStatusFilter === "all" ||
        (review.managementStatus || "new") === reviewStatusFilter) &&
      (reviewPriorityFilter === "all" ||
        (review.priority || "normal") === reviewPriorityFilter),
  );

  if (loading) {
    return (
      <div className="p-8 text-center space-y-3">
        <div className="w-8 h-8 border-2 border-[var(--admin-accent)] border-t-transparent rounded-[var(--admin-radius-full)] animate-spin mx-auto" />
        <p className="text-xs text-[var(--admin-text-muted)]">
          Carregando painel Navo Rewards...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in text-[var(--admin-text-main)] min-w-0">
      {/* Header (desktop) */}
      <AdminPageHeader
        icon={Award}
        title={rewardsPageTitles[activeTab]}
        stats={[
          { label: "score NPS", value: data?.npsScore ?? 0, tone: "gold" },
        ]}
        action={{
          label: "Atualizar",
          onClick: loadData,
          icon: RefreshCw,
          disabled: loading,
        }}
      />

      {/* Ação (mobile) */}

      {activeTab === "dashboard" && (
        <>
          {/* 2. KPIS (Sempre no topo, logo abaixo do Header) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3 bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-xl)] flex flex-col justify-between">
              <div className="flex items-center justify-between text-[var(--admin-text-muted)] mb-1">
                <span className="text-xs font-bold uppercase tracking-wider truncate">
                  Score NPS
                </span>
                <div className="w-6 h-6 rounded-[var(--admin-radius-md)] bg-[var(--admin-accent)]/10 text-[var(--admin-accent)] flex items-center justify-center shrink-0">
                  <Star className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className="text-lg font-black text-[var(--admin-accent)] tabular-nums truncate">
                {data?.npsScore ?? 0}{" "}
                <span className="text-xs text-status-success">/ 100</span>
              </p>
              <p className="text-xs text-[var(--admin-text-muted)] mt-1 font-medium truncate">
                {data?.promoters || 0} prom / {data?.detractors || 0} detr
              </p>
            </div>

            <div className="p-3 bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-xl)] flex flex-col justify-between">
              <div className="flex items-center justify-between text-[var(--admin-text-muted)] mb-1">
                <span className="text-xs font-bold uppercase tracking-wider truncate">
                  Pts Emitidos
                </span>
                <div className="w-6 h-6 rounded-[var(--admin-radius-md)] bg-[var(--admin-bg)] border border-[var(--admin-border)] flex items-center justify-center shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-[var(--admin-accent)]" />
                </div>
              </div>
              <p className="text-lg font-black text-[var(--admin-text-main)] tabular-nums truncate">
                +{data?.totalIssued || 0}
              </p>
              <p className="text-xs text-status-success mt-1 font-medium truncate">
                Cortes e indicações
              </p>
            </div>

            <div className="p-3 bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-xl)] flex flex-col justify-between">
              <div className="flex items-center justify-between text-[var(--admin-text-muted)] mb-1">
                <span className="text-xs font-bold uppercase tracking-wider truncate">
                  Pts Resgatados
                </span>
                <div className="w-6 h-6 rounded-[var(--admin-radius-md)] bg-status-error/10 text-status-error flex items-center justify-center shrink-0">
                  <Gift className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className="text-lg font-black text-status-error tabular-nums truncate">
                -{data?.totalRedeemed || 0}
              </p>
              <p className="text-xs text-[var(--admin-text-muted)] mt-1 font-medium truncate">
                Cupons gerados
              </p>
            </div>

            <div className="p-3 bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-xl)] flex flex-col justify-between">
              <div className="flex items-center justify-between text-[var(--admin-text-muted)] mb-1">
                <span className="text-xs font-bold uppercase tracking-wider truncate">
                  Avaliações
                </span>
                <div className="w-6 h-6 rounded-[var(--admin-radius-md)] bg-[var(--admin-bg)] border border-[var(--admin-border)] flex items-center justify-center shrink-0">
                  <MessageSquare className="w-3.5 h-3.5 text-[var(--admin-accent)]" />
                </div>
              </div>
              <p className="text-lg font-black text-[var(--admin-text-main)] tabular-nums truncate">
                {data?.totalReviews || 0}
              </p>
              <p className="text-xs text-[var(--admin-accent)] mt-1 font-medium truncate">
                Média {data?.averageRating ?? 0}/5 · {data?.promoters ?? 0}{" "}
                prom.
              </p>
            </div>
          </div>

          {/* 3. LINHA DE CAMPANHA (com botão com verbo curto "Disparar", 1 linha) */}
          <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] p-3.5 rounded-[var(--admin-radius-lg)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-[var(--admin-radius-lg)] bg-[var(--admin-accent)]/10 border border-[var(--admin-accent)]/30 text-[var(--admin-accent)] flex items-center justify-center shrink-0">
                <Megaphone className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold text-[var(--admin-text-main)] block admin-safe-wrap">
                  Campanha de Re-engajamento
                </span>
                <p className="text-xs text-[var(--admin-text-muted)] admin-safe-wrap">
                  Creditar +100 pontos para clientes inativos para incentivar
                  retornos.
                </p>
              </div>
            </div>

            <button
              onClick={handleTriggerCampaign}
              disabled={campaignLoading}
              className="h-9 px-4 rounded-[var(--admin-radius-lg)] bg-[var(--admin-accent)] text-[var(--admin-accent-text)] hover:bg-[var(--admin-accent)]/90 transition-all text-xs font-bold flex items-center justify-center gap-2 shrink-0 whitespace-nowrap active:scale-95 disabled:opacity-50"
            >
              <Megaphone className="w-3.5 h-3.5" />
              <span>{campaignLoading ? "Disparando..." : "Disparar"}</span>
            </button>
          </div>

          {campaignMsg && (
            <div className="p-3 bg-status-success/10 border border-status-success/30 text-status-success text-xs font-bold rounded-[var(--admin-radius-lg)] animate-fade-in">
              {campaignMsg}
            </div>
          )}
        </>
      )}

      {configSuccessMsg && (
        <div className="p-3 bg-status-success/10 border border-status-success/30 text-status-success text-xs font-bold rounded-[var(--admin-radius-lg)] animate-fade-in">
          {configSuccessMsg}
        </div>
      )}

      {/* 4. TABS SECUNDÁRIAS — mantidas apenas para compatibilidade quando o componente é usado sem rota própria. */}
      {!initialTab && (
        <AdminTabs
          tabs={[
            { id: "dashboard", label: "Dashboard Geral", icon: TrendingUp },
            {
              id: "loyalty",
              label: "Clube de Fidelidade & Níveis",
              icon: Crown,
            },
            { id: "rewards", label: "Prêmios & Cupons Desconto", icon: Gift },
            { id: "referrals", label: "Motor de Indicações", icon: Users },
            { id: "reviews", label: "Avaliações & NPS", icon: Star },
          ]}
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as NavoRewardsTab)}
        />
      )}

      {/* 5. CONTEÚDO DA INTERFACE */}
      {/* TAB 1: DASHBOARD GERAL */}
      {activeTab === "dashboard" && (
        <div className="space-y-4 min-w-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Distribuição por Nível VIP */}
            <div className="bg-[var(--admin-surface)] p-4 sm:p-5 rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] space-y-3">
              <h3 className="text-xs font-bold text-[var(--admin-text-main)] uppercase tracking-wider flex items-center gap-2">
                <Crown className="w-4 h-4 text-[var(--admin-accent)]" />
                <span>Distribuição por Nível VIP</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <div className="p-3 bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-xl)] flex flex-col justify-between">
                  <div className="flex items-center justify-between text-amber-700 mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider truncate">
                      Bronze
                    </span>
                    <div className="w-6 h-6 rounded-[var(--admin-radius-md)] bg-amber-700/10 flex items-center justify-center shrink-0">
                      <Crown className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <p className="text-lg font-black text-[var(--admin-text-main)] tabular-nums truncate">
                    {data?.tierDistribution?.Bronze || 0}
                  </p>
                  <p className="text-xs text-[var(--admin-text-muted)] mt-1 font-medium truncate">
                    {tiers.find((tier) => tier.name === "Bronze")?.multiplier ||
                      1}
                    x mult
                  </p>
                </div>

                <div className="p-3 bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-xl)] flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider truncate">
                      Prata
                    </span>
                    <div className="w-6 h-6 rounded-[var(--admin-radius-md)] bg-slate-400/10 flex items-center justify-center shrink-0">
                      <Crown className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <p className="text-lg font-black text-[var(--admin-text-main)] tabular-nums truncate">
                    {data?.tierDistribution?.Prata || 0}
                  </p>
                  <p className="text-xs text-[var(--admin-text-muted)] mt-1 font-medium truncate">
                    {tiers.find((tier) => tier.name === "Prata")?.multiplier ||
                      1.2}
                    x mult
                  </p>
                </div>

                <div className="p-3 bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-xl)] flex flex-col justify-between">
                  <div className="flex items-center justify-between text-[var(--admin-accent)] mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider truncate">
                      Ouro
                    </span>
                    <div className="w-6 h-6 rounded-[var(--admin-radius-md)] bg-[var(--admin-accent)]/10 flex items-center justify-center shrink-0">
                      <Crown className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <p className="text-lg font-black text-[var(--admin-text-main)] tabular-nums truncate">
                    {data?.tierDistribution?.Ouro || 0}
                  </p>
                  <p className="text-xs text-[var(--admin-text-muted)] mt-1 font-medium truncate">
                    {tiers.find((tier) => tier.name === "Ouro")?.multiplier ||
                      1.5}
                    x mult
                  </p>
                </div>

                <div className="p-3 bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-xl)] flex flex-col justify-between">
                  <div className="flex items-center justify-between text-cyan-400 mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider truncate">
                      Diamante
                    </span>
                    <div className="w-6 h-6 rounded-[var(--admin-radius-md)] bg-cyan-400/10 flex items-center justify-center shrink-0">
                      <Crown className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <p className="text-lg font-black text-[var(--admin-text-main)] tabular-nums truncate">
                    {data?.tierDistribution?.Diamante || 0}
                  </p>
                  <p className="text-xs text-[var(--admin-text-muted)] mt-1 font-medium truncate">
                    {tiers.find((tier) => tier.name === "Diamante")
                      ?.multiplier || 2}
                    x mult
                  </p>
                </div>
              </div>
            </div>

            {/* Maiores Embaixadores */}
            <div className="bg-[var(--admin-surface)] p-4 sm:p-5 rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] space-y-3">
              <h3 className="text-xs font-bold text-[var(--admin-text-main)] uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-[var(--admin-accent)]" />
                <span>Top embaixadores</span>
              </h3>

              {data?.ambassadors && data.ambassadors.length > 0 ? (
                <div className="space-y-2 text-xs divide-y divide-[var(--admin-border)]">
                  {data.ambassadors.map((amb: any, idx: number) => (
                    <div
                      key={amb.id || idx}
                      className="pt-2 flex items-center justify-between min-w-0"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <span
                          className={`w-6 h-6 rounded-[var(--admin-radius-lg)] font-bold text-xs flex items-center justify-center shrink-0 ${
                            idx === 0
                              ? "bg-[var(--admin-accent)] text-[var(--admin-accent-text)]"
                              : "bg-[var(--admin-bg)] text-[var(--admin-text-muted)] border border-[var(--admin-border)]"
                          }`}
                        >
                          #{idx + 1}
                        </span>
                        <div className="min-w-0">
                          <span className="text-[var(--admin-text-main)] font-bold block admin-clamp-2">
                            {amb.name}
                          </span>
                          <span className="text-xs text-[var(--admin-text-muted)] admin-safe-wrap block">
                            Nível {amb.tier} • {amb.points} pts
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold text-[var(--admin-accent)] num-tabular block">
                          {amb.totalReferrals} amigos
                        </span>
                        <span className="text-xs text-status-success font-semibold">
                          100% convertidos
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--admin-text-muted)] py-6 text-center">
                  Nenhum embaixador nesta semana.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CLUBE DE FIDELIDADE & NÍVEIS */}
      {activeTab === "loyalty" && (
        <div className="space-y-4 min-w-0">
          <form
            onKeyDown={handleEnterAsTab}
            onSubmit={handleSaveConfig}
            className="bg-[var(--admin-surface)] p-4 sm:p-5 rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] space-y-4"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[var(--admin-border)]">
              <div>
                <h3 className="text-sm font-serif font-bold text-[var(--admin-text-main)] flex items-center gap-2">
                  <Crown className="w-4 h-4 text-[var(--admin-accent)]" />
                  <span>Pontos e validade</span>
                </h3>
                <p className="text-xs text-[var(--admin-text-muted)] mt-0.5">
                  Ajuste a taxa de conversão, multiplicadores e expiração.
                </p>
              </div>

              <button
                type="submit"
                disabled={savingConfig}
                className="h-9 px-4 rounded-[var(--admin-radius-lg)] bg-[var(--admin-accent)] text-[var(--admin-accent-text)] font-bold text-xs flex items-center gap-2 hover:bg-[var(--admin-accent)]/90 active:scale-95 disabled:opacity-50 whitespace-nowrap"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingConfig ? "Salvando..." : "Salvar Regras"}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-[var(--admin-bg)] rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] space-y-2">
                <label className="text-xs font-bold text-[var(--admin-accent)] uppercase tracking-wider flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5" /> Razão de Conversão
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--admin-text-muted)] font-bold">
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={config.currencyPerPoint}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        currencyPerPoint: Number(e.target.value),
                      })
                    }
                    className="w-full bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-2 text-[var(--admin-text-main)] text-xs font-bold focus:outline-none focus:border-[var(--admin-accent)] num-tabular"
                  />
                  <span className="text-[var(--admin-text-muted)] font-bold whitespace-nowrap">
                    = 1 Pts
                  </span>
                </div>
              </div>

              <div className="p-3 bg-[var(--admin-bg)] rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] space-y-2">
                <label className="text-xs font-bold text-[var(--admin-accent)] uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Validade (Dias)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={config.pointsValidityDays}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        pointsValidityDays: Number(e.target.value),
                      })
                    }
                    className="w-full bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-2 text-[var(--admin-text-main)] text-xs font-bold focus:outline-none focus:border-[var(--admin-accent)] num-tabular"
                  />
                  <span className="text-[var(--admin-text-muted)] font-bold">
                    dias
                  </span>
                </div>
              </div>

              <div className="p-3 bg-[var(--admin-bg)] rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] space-y-2">
                <label className="text-xs font-bold text-[var(--admin-accent)] uppercase tracking-wider flex items-center gap-1">
                  <Gift className="w-3.5 h-3.5" /> Bônus Aniversário
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={config.birthdayBonus}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        birthdayBonus: Number(e.target.value),
                      })
                    }
                    className="w-full bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-2 text-[var(--admin-text-main)] text-xs font-bold focus:outline-none focus:border-[var(--admin-accent)] num-tabular"
                  />
                  <span className="text-[var(--admin-text-muted)] font-bold">
                    pts
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2 text-xs text-[var(--admin-text-muted)]">
              Os limites e multiplicadores dos níveis são mantidos na seção de
              níveis persistidos abaixo. As alterações passam por validação no
              servidor e afetam novos créditos, sem recalcular saldos
              históricos.
            </div>
          </form>

          <div className="bg-[var(--admin-surface)] p-4 sm:p-5 rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold text-[var(--admin-text-main)] uppercase tracking-wider flex items-center gap-2">
                  <Crown className="w-4 h-4 text-[var(--admin-accent)]" />{" "}
                  Níveis VIP reais
                </h3>
                <p className="text-xs text-[var(--admin-text-muted)] mt-1">
                  Defina o mínimo de pontos e o multiplicador usado no próximo
                  checkout confirmado.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setTiers((current) => [
                      ...current,
                      {
                        name: "Novo nível",
                        minimumPoints: 0,
                        multiplier: 1,
                        displayOrder: current.length,
                        color: "#D4AF5A",
                        isActive: true,
                      },
                    ])
                  }
                  className="admin-btn admin-btn-sm admin-btn-secondary font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Novo nível
                </button>
                <button
                  type="button"
                  onClick={handleSaveTiers}
                  disabled={savingTiers || tiers.length === 0}
                  className="admin-btn admin-btn-sm admin-btn-primary font-bold text-xs disabled:opacity-50 cursor-pointer"
                >
                  {savingTiers ? "Salvando..." : "Salvar níveis"}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {tiers.map((tier, index) => (
                <div
                  key={tier.id || index}
                  className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_120px_100px_82px_70px_auto] gap-2 items-center rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] bg-[var(--admin-bg)] p-2.5"
                >
                  <input
                    value={tier.name}
                    onChange={(e) =>
                      setTiers((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, name: e.target.value }
                            : item,
                        ),
                      )
                    }
                    className="min-w-0 bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-md)] p-2 text-xs font-bold text-[var(--admin-text-main)]"
                    aria-label={`Nome do nível ${index + 1}`}
                  />
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={tier.minimumPoints}
                    onChange={(e) =>
                      setTiers((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, minimumPoints: Number(e.target.value) }
                            : item,
                        ),
                      )
                    }
                    className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-md)] p-2 text-xs text-[var(--admin-text-main)] num-tabular"
                    aria-label={`Pontos mínimos do nível ${index + 1}`}
                  />
                  <input
                    type="number"
                    min="0.1"
                    max="20"
                    step="0.1"
                    value={tier.multiplier}
                    onChange={(e) =>
                      setTiers((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, multiplier: Number(e.target.value) }
                            : item,
                        ),
                      )
                    }
                    className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-md)] p-2 text-xs text-[var(--admin-text-main)] num-tabular"
                    aria-label={`Multiplicador do nível ${index + 1}`}
                  />
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={tier.displayOrder}
                    onChange={(e) =>
                      setTiers((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, displayOrder: Number(e.target.value) }
                            : item,
                        ),
                      )
                    }
                    className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-md)] p-2 text-xs text-[var(--admin-text-main)] num-tabular"
                    aria-label={`Ordem do nível ${index + 1}`}
                  />
                  <input
                    type="color"
                    value={tier.color || "#D4AF5A"}
                    onChange={(e) =>
                      setTiers((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, color: e.target.value }
                            : item,
                        ),
                      )
                    }
                    className="w-full h-9 bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-md)] p-1"
                    aria-label={`Cor do nível ${index + 1}`}
                  />
                  <label className="flex items-center gap-2 text-xs text-[var(--admin-text-muted)]">
                    <input
                      type="checkbox"
                      checked={Boolean(tier.isActive)}
                      onChange={(e) =>
                        setTiers((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, isActive: e.target.checked }
                              : item,
                          ),
                        )
                      }
                    />{" "}
                    Ativo
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-[var(--admin-surface)] p-4 sm:p-5 rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] space-y-3 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold text-[var(--admin-text-main)] uppercase tracking-wider">
                    Benefícios do Club
                  </h3>
                  <p className="text-xs text-[var(--admin-text-muted)] mt-1">
                    Crie vantagens, descontos, cortes, produtos e regras de uso.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openBenefitEditor()}
                  className="admin-btn admin-btn-sm admin-btn-primary font-bold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Novo benefício
                </button>
              </div>
              <div className="space-y-2">
                {benefits.length === 0 ? (
                  <p className="text-xs text-[var(--admin-text-muted)] py-5 text-center">
                    Nenhum benefício cadastrado.
                  </p>
                ) : (
                  benefits.map((benefit) => (
                    <div
                      key={benefit.id}
                      className="p-3 rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] bg-[var(--admin-bg)] flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-xs text-[var(--admin-text-main)]">
                            {benefit.name}
                          </span>
                          {!benefit.isActive && (
                            <span className="text-xs rounded-[var(--admin-radius-full)] px-2 py-0.5 bg-status-error/10 text-status-error font-bold">
                              INATIVO
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--admin-text-muted)] mt-1 line-clamp-2">
                          {benefit.description}
                        </p>
                        <p className="text-xs text-[var(--admin-accent)] mt-1 font-bold">
                          {benefit.benefitType}{" "}
                          {benefit.valueAmount !== null &&
                          benefit.valueAmount !== undefined
                            ? `• R$ ${Number(benefit.valueAmount).toFixed(2).replace(".", ",")}`
                            : ""}{" "}
                          {benefit.tierIds?.length
                            ? `• ${benefit.tierIds.length} nível(is)`
                            : ""}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openBenefitEditor(benefit)}
                          className="h-8 px-2.5 rounded-[var(--admin-radius-md)] border border-[var(--admin-border)] text-[var(--admin-text-main)] text-xs font-bold"
                        >
                          Editar
                        </button>
                        {benefit.isActive && (
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm("Desativar este benefício?")) return;
                              try {
                                await archiveLoyaltyBenefit(benefit.id);
                                await loadData();
                              } catch (err: any) {
                                alert(
                                  err.message || "Erro ao desativar benefício.",
                                );
                              }
                            }}
                            className="h-8 w-8 rounded-[var(--admin-radius-md)] border border-[var(--admin-border)] text-status-error flex items-center justify-center"
                            title="Desativar benefício"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-[var(--admin-surface)] p-4 sm:p-5 rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] space-y-3 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold text-[var(--admin-text-main)] uppercase tracking-wider">
                    Planos do Club
                  </h3>
                  <p className="text-xs text-[var(--admin-text-muted)] mt-1">
                    Defina nome, preço, periodicidade, bônus e benefícios. Ainda
                    sem cobrança automática.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openPlanEditor()}
                  className="admin-btn admin-btn-sm admin-btn-primary font-bold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Novo plano
                </button>
              </div>
              <div className="space-y-2">
                {plans.length === 0 ? (
                  <p className="text-xs text-[var(--admin-text-muted)] py-5 text-center">
                    Nenhum plano cadastrado.
                  </p>
                ) : (
                  plans.map((plan) => (
                    <div
                      key={plan.id}
                      className="p-3 rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] bg-[var(--admin-bg)] flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-xs text-[var(--admin-text-main)]">
                            {plan.name}
                          </span>
                          <span
                            className={`text-xs rounded-[var(--admin-radius-full)] px-2 py-0.5 font-bold ${plan.status === "active" ? "bg-status-success/10 text-status-success" : "bg-[var(--admin-surface)] text-[var(--admin-text-muted)]"}`}
                          >
                            {plan.status.toUpperCase()}
                          </span>
                          {plan.isFeatured && (
                            <span className="text-xs rounded-[var(--admin-radius-full)] px-2 py-0.5 bg-[var(--admin-accent)]/10 text-[var(--admin-accent)] font-bold">
                              DESTAQUE
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--admin-text-muted)] mt-1 line-clamp-2">
                          {plan.description}
                        </p>
                        <p className="text-xs text-[var(--admin-accent)] mt-1 font-bold">
                          R${" "}
                          {Number(plan.price || 0)
                            .toFixed(2)
                            .replace(".", ",")}{" "}
                          {plan.billingPeriod !== "none"
                            ? `• ${plan.billingPeriod}`
                            : "• único"}{" "}
                          {plan.pointsBonus ? `• +${plan.pointsBonus} pts` : ""}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openPlanEditor(plan)}
                          className="h-8 px-2.5 rounded-[var(--admin-radius-md)] border border-[var(--admin-border)] text-[var(--admin-text-main)] text-xs font-bold"
                        >
                          Editar
                        </button>
                        {plan.status !== "archived" && (
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm("Arquivar este plano?")) return;
                              try {
                                await archiveLoyaltyPlan(plan.id);
                                await loadData();
                              } catch (err: any) {
                                alert(err.message || "Erro ao arquivar plano.");
                              }
                            }}
                            className="h-8 w-8 rounded-[var(--admin-radius-md)] border border-[var(--admin-border)] text-status-error flex items-center justify-center"
                            title="Arquivar plano"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {showBenefitModal && (
            <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-[var(--admin-bg)]/80 backdrop-blur-md">
              <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-[var(--admin-surface)] rounded-[var(--admin-radius-xl)] border border-[var(--admin-border)] p-5 sm:p-6 shadow-2xl">
                <div className="mb-4">
                  <h3 className="text-base font-serif font-bold text-[var(--admin-text-main)]">
                    {editingBenefit ? "Editar benefício" : "Novo benefício"}
                  </h3>
                  <p className="text-xs text-[var(--admin-text-muted)] mt-1">
                    O benefício é cadastrado no banco e pode ser vinculado a um
                    ou mais níveis.
                  </p>
                </div>
                <form
                  onKeyDown={handleEnterAsTab}
                  onSubmit={handleSaveBenefit}
                  className="space-y-3 text-xs"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="space-y-1">
                      <span className="block text-xs font-bold text-[var(--admin-text-muted)] uppercase">
                        Nome
                      </span>
                      <input
                        autoFocus
                        required
                        value={benefitDraft.name}
                        onChange={(e) =>
                          setBenefitDraft({
                            ...benefitDraft,
                            name: e.target.value,
                          })
                        }
                        className="w-full bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-2.5 text-[var(--admin-text-main)]"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="block text-xs font-bold text-[var(--admin-text-muted)] uppercase">
                        Tipo
                      </span>
                      <select
                        value={benefitDraft.benefitType}
                        onChange={(e) =>
                          setBenefitDraft({
                            ...benefitDraft,
                            benefitType: e.target.value,
                          })
                        }
                        className="w-full bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-2.5 text-[var(--admin-text-main)]"
                      >
                        <option value="discount_percent">
                          Desconto percentual
                        </option>
                        <option value="discount_fixed">Desconto fixo</option>
                        <option value="free_service">Serviço grátis</option>
                        <option value="free_product">Produto grátis</option>
                        <option value="points_bonus">Bônus de pontos</option>
                        <option value="priority_queue">
                          Prioridade na fila
                        </option>
                        <option value="custom">Personalizado</option>
                      </select>
                    </label>
                  </div>
                  <label className="space-y-1 block">
                    <span className="block text-xs font-bold text-[var(--admin-text-muted)] uppercase">
                      Descrição
                    </span>
                    <textarea
                      required
                      value={benefitDraft.description}
                      onChange={(e) =>
                        setBenefitDraft({
                          ...benefitDraft,
                          description: e.target.value,
                        })
                      }
                      className="w-full min-h-[72px] bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-2.5 text-[var(--admin-text-main)]"
                    />
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="space-y-1">
                      <span className="block text-xs font-bold text-[var(--admin-text-muted)] uppercase">
                        Valor numérico
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={benefitDraft.valueAmount ?? ""}
                        onChange={(e) =>
                          setBenefitDraft({
                            ...benefitDraft,
                            valueAmount:
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
                          })
                        }
                        className="w-full bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-2.5 text-[var(--admin-text-main)]"
                        placeholder="Ex.: 10"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="block text-xs font-bold text-[var(--admin-text-muted)] uppercase">
                        Texto do valor
                      </span>
                      <input
                        value={benefitDraft.valueText || ""}
                        onChange={(e) =>
                          setBenefitDraft({
                            ...benefitDraft,
                            valueText: e.target.value,
                          })
                        }
                        className="w-full bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-2.5 text-[var(--admin-text-main)]"
                        placeholder="Ex.: 10% OFF"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="block text-xs font-bold text-[var(--admin-text-muted)] uppercase">
                        Validade (dias)
                      </span>
                      <input
                        type="number"
                        min="1"
                        value={benefitDraft.validityDays ?? ""}
                        onChange={(e) =>
                          setBenefitDraft({
                            ...benefitDraft,
                            validityDays:
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
                          })
                        }
                        className="w-full bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-2.5 text-[var(--admin-text-main)]"
                        placeholder="Opcional"
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="space-y-1">
                      <span className="block text-xs font-bold text-[var(--admin-text-muted)] uppercase">
                        Serviço relacionado
                      </span>
                      <select
                        value={benefitDraft.serviceId || ""}
                        onChange={(e) =>
                          setBenefitDraft({
                            ...benefitDraft,
                            serviceId: e.target.value,
                          })
                        }
                        className="w-full bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-2.5 text-[var(--admin-text-main)]"
                      >
                        <option value="">Todos os serviços</option>
                        {services.map((service) => (
                          <option key={service.id} value={service.id}>
                            {service.title} — R${" "}
                            {Number(service.price || 0)
                              .toFixed(2)
                              .replace(".", ",")}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="block text-xs font-bold text-[var(--admin-text-muted)] uppercase">
                        Produto relacionado
                      </span>
                      <select
                        value={benefitDraft.productId || ""}
                        onChange={(e) =>
                          setBenefitDraft({
                            ...benefitDraft,
                            productId: e.target.value,
                          })
                        }
                        className="w-full bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-2.5 text-[var(--admin-text-main)]"
                      >
                        <option value="">Todos os produtos</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name} — R${" "}
                            {Number(product.price || 0)
                              .toFixed(2)
                              .replace(".", ",")}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-[var(--admin-text-muted)] uppercase mb-2">
                      Níveis elegíveis
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      {tiers.map((tier) => (
                        <label
                          key={tier.id}
                          className="flex items-start gap-2 rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] bg-[var(--admin-bg)] p-2 text-xs text-[var(--admin-text-main)]"
                        >
                          <input
                            type="checkbox"
                            disabled={!tier.id}
                            checked={Boolean(
                              tier.id &&
                              (benefitDraft.tierIds || []).includes(tier.id),
                            )}
                            onChange={(e) =>
                              setBenefitDraft({
                                ...benefitDraft,
                                tierIds: e.target.checked
                                  ? [...(benefitDraft.tierIds || []), tier.id]
                                  : (benefitDraft.tierIds || []).filter(
                                      (id: string) => id !== tier.id,
                                    ),
                              })
                            }
                          />
                          {tier.name}
                          {!tier.id && (
                            <span className="text-xs text-[var(--admin-text-muted)]">
                              (salve primeiro)
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowBenefitModal(false);
                        setEditingBenefit(null);
                      }}
                      className="flex-1 h-10 rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] text-[var(--admin-text-muted)] font-bold"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={savingCatalogItem}
                      className="flex-1 h-10 rounded-[var(--admin-radius-lg)] bg-[var(--admin-accent)] text-[var(--admin-accent-text)] font-bold disabled:opacity-50"
                    >
                      {savingCatalogItem ? "Salvando..." : "Salvar benefício"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {showPlanModal && (
            <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-[var(--admin-bg)]/80 backdrop-blur-md">
              <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-[var(--admin-surface)] rounded-[var(--admin-radius-xl)] border border-[var(--admin-border)] p-5 sm:p-6 shadow-2xl">
                <div className="mb-4">
                  <h3 className="text-base font-serif font-bold text-[var(--admin-text-main)]">
                    {editingPlan ? "Editar plano" : "Novo plano"}
                  </h3>
                  <p className="text-xs text-[var(--admin-text-muted)] mt-1">
                    O valor é salvo como catálogo. Nenhuma cobrança ou
                    assinatura é criada nesta etapa.
                  </p>
                </div>
                <form
                  onKeyDown={handleEnterAsTab}
                  onSubmit={handleSavePlan}
                  className="space-y-3 text-xs"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="space-y-1">
                      <span className="block text-xs font-bold text-[var(--admin-text-muted)] uppercase">
                        Nome
                      </span>
                      <input
                        autoFocus
                        required
                        value={planDraft.name}
                        onChange={(e) =>
                          setPlanDraft({ ...planDraft, name: e.target.value })
                        }
                        className="w-full bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-2.5 text-[var(--admin-text-main)]"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="block text-xs font-bold text-[var(--admin-text-muted)] uppercase">
                        Preço (R$)
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={planDraft.price}
                        onChange={(e) =>
                          setPlanDraft({
                            ...planDraft,
                            price: Number(e.target.value),
                          })
                        }
                        className="w-full bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-2.5 text-[var(--admin-text-main)]"
                      />
                    </label>
                  </div>
                  <label className="space-y-1 block">
                    <span className="block text-xs font-bold text-[var(--admin-text-muted)] uppercase">
                      Descrição
                    </span>
                    <textarea
                      required
                      value={planDraft.description}
                      onChange={(e) =>
                        setPlanDraft({
                          ...planDraft,
                          description: e.target.value,
                        })
                      }
                      className="w-full min-h-[72px] bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-2.5 text-[var(--admin-text-main)]"
                    />
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="space-y-1">
                      <span className="block text-xs font-bold text-[var(--admin-text-muted)] uppercase">
                        Periodicidade
                      </span>
                      <select
                        value={planDraft.billingPeriod}
                        onChange={(e) =>
                          setPlanDraft({
                            ...planDraft,
                            billingPeriod: e.target.value,
                          })
                        }
                        className="w-full bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-2.5 text-[var(--admin-text-main)]"
                      >
                        <option value="none">Pagamento único / catálogo</option>
                        <option value="monthly">Mensal</option>
                        <option value="quarterly">Trimestral</option>
                        <option value="annual">Anual</option>
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="block text-xs font-bold text-[var(--admin-text-muted)] uppercase">
                        Bônus de pontos
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={planDraft.pointsBonus}
                        onChange={(e) =>
                          setPlanDraft({
                            ...planDraft,
                            pointsBonus: Number(e.target.value),
                          })
                        }
                        className="w-full bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-2.5 text-[var(--admin-text-main)]"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="block text-xs font-bold text-[var(--admin-text-muted)] uppercase">
                        Status
                      </span>
                      <select
                        value={planDraft.status}
                        onChange={(e) =>
                          setPlanDraft({ ...planDraft, status: e.target.value })
                        }
                        className="w-full bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-2.5 text-[var(--admin-text-main)]"
                      >
                        <option value="draft">Rascunho</option>
                        <option value="active">Ativo</option>
                        <option value="archived">Arquivado</option>
                      </select>
                    </label>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-[var(--admin-text-main)]">
                    <input
                      type="checkbox"
                      checked={Boolean(planDraft.isFeatured)}
                      onChange={(e) =>
                        setPlanDraft({
                          ...planDraft,
                          isFeatured: e.target.checked,
                        })
                      }
                    />{" "}
                    Destacar este plano para o cliente
                  </label>
                  <div>
                    <span className="block text-xs font-bold text-[var(--admin-text-muted)] uppercase mb-2">
                      Benefícios incluídos
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                      {benefits
                        .filter((benefit) => benefit.isActive)
                        .map((benefit) => (
                          <label
                            key={benefit.id}
                            className="flex items-start gap-2 rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] bg-[var(--admin-bg)] p-2 text-xs text-[var(--admin-text-main)]"
                          >
                            <input
                              type="checkbox"
                              checked={(planDraft.benefitIds || []).includes(
                                benefit.id,
                              )}
                              onChange={(e) =>
                                setPlanDraft({
                                  ...planDraft,
                                  benefitIds: e.target.checked
                                    ? [
                                        ...(planDraft.benefitIds || []),
                                        benefit.id,
                                      ]
                                    : (planDraft.benefitIds || []).filter(
                                        (id: string) => id !== benefit.id,
                                      ),
                                })
                              }
                            />
                            <span>
                              <strong>{benefit.name}</strong>
                              <span className="block text-[var(--admin-text-muted)] mt-0.5">
                                {benefit.description}
                              </span>
                            </span>
                          </label>
                        ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPlanModal(false);
                        setEditingPlan(null);
                      }}
                      className="flex-1 h-10 rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] text-[var(--admin-text-muted)] font-bold"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={savingCatalogItem}
                      className="flex-1 h-10 rounded-[var(--admin-radius-lg)] bg-[var(--admin-accent)] text-[var(--admin-accent-text)] font-bold disabled:opacity-50"
                    >
                      {savingCatalogItem ? "Salvando..." : "Salvar plano"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Ajuste Manual */}
          <div className="bg-[var(--admin-surface)] p-4 sm:p-5 rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] space-y-3">
            <h3 className="text-xs font-bold text-[var(--admin-text-main)] uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-[var(--admin-accent)]" />
              <span>Ajuste Manual de Pontuação de Clientes</span>
            </h3>

            <form
              onKeyDown={handleEnterAsTab}
              onSubmit={handleManualPointsSubmit}
              className="space-y-3 w-full text-xs"
            >
              <div>
                <label className="block text-xs font-bold text-[var(--admin-text-muted)] uppercase tracking-wider mb-1">
                  Selecione o Cliente
                </label>
                <select
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                  className="w-full bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-2.5 text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)]"
                >
                  <option value="">-- Escolha o cliente --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone || "Sem tel"}) - Atual:{" "}
                      {c.loyaltyPoints || 0} pts
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--admin-text-muted)] uppercase tracking-wider mb-1">
                    Pontos (Ex: +100 ou -50)
                  </label>
                  <input
                    type="number"
                    value={manualPointsAmount}
                    onChange={(e) =>
                      setManualPointsAmount(Number(e.target.value))
                    }
                    className="w-full bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-2.5 text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)] num-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--admin-text-muted)] uppercase tracking-wider mb-1">
                    Motivo
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Cortesia VIP"
                    value={manualPointsReason}
                    onChange={(e) => setManualPointsReason(e.target.value)}
                    className="w-full bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-2.5 text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)]"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="h-9 px-4 bg-[var(--admin-accent)] text-[var(--admin-accent-text)] font-bold rounded-[var(--admin-radius-lg)] hover:bg-[var(--admin-accent)]/90 text-xs active:scale-95"
              >
                Aplicar Ajuste de Pontos
              </button>

              {manualSuccessMsg && (
                <div className="p-2.5 bg-status-success/10 border border-status-success/30 text-status-success text-xs font-bold rounded-[var(--admin-radius-lg)]">
                  {manualSuccessMsg}
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* TAB 3: CATÁLOGO DE PRÊMIOS & CUPONS */}
      {activeTab === "rewards" && (
        <div className="space-y-4 min-w-0">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-[var(--admin-surface)] p-4 rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)]">
            <div>
              <h3 className="text-sm font-serif font-bold text-[var(--admin-text-main)]">
                Prêmios e cupons
              </h3>
              <p className="text-xs text-[var(--admin-text-muted)] mt-0.5">
                Ofertas para trocar pontos.
              </p>
            </div>

            <button
              onClick={() => setShowAddRewardModal(true)}
              className="h-9 px-3.5 rounded-[var(--admin-radius-lg)] bg-[var(--admin-accent)] text-[var(--admin-accent-text)] font-bold text-xs flex items-center gap-1.5 shrink-0 hover:bg-[var(--admin-accent)]/90 active:scale-95 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova oferta</span>
            </button>
          </div>

          {/* Validador de Voucher */}
          <div className="bg-[var(--admin-surface)] p-4 rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] space-y-2.5 w-full">
            <h4 className="text-xs font-bold uppercase text-[var(--admin-accent)] tracking-wider flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Validar Código de Voucher
              do Cliente
            </h4>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Ex: NAV-RWD-123456"
                value={voucherCodeInput}
                onChange={(e) => setVoucherCodeInput(e.target.value)}
                className="flex-1 bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-2 text-xs text-[var(--admin-text-main)] font-mono uppercase focus:outline-none focus:border-[var(--admin-accent)] min-w-0"
              />
              <button
                onClick={handleValidateVoucher}
                className="h-10 sm:h-9 w-full sm:w-auto px-4 bg-[var(--admin-accent)] text-[var(--admin-accent-text)] font-bold text-xs rounded-[var(--admin-radius-lg)] hover:bg-[var(--admin-accent)]/90 active:scale-95 shrink-0 whitespace-nowrap"
              >
                Validar Voucher
              </button>
            </div>
            {voucherValidationResult && (
              <div className="p-2.5 bg-[var(--admin-bg)] border border-[var(--admin-accent)]/30 text-[var(--admin-text-main)] text-xs font-medium rounded-[var(--admin-radius-lg)]">
                {voucherValidationResult}
              </div>
            )}
          </div>

          {/* Lista de Prêmios */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {rewardsList.map((rw) => (
              <div
                key={rw.id}
                className="bg-[var(--admin-surface)] p-4 rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] flex items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--admin-radius-lg)] bg-[var(--admin-accent)]/10 text-[var(--admin-accent)] text-xs font-bold border border-[var(--admin-accent)]/30">
                    <Gift className="w-3 h-3" />
                    <span>{rw.pointsRequired} PONTOS</span>
                  </div>
                  <h4 className="font-bold text-[var(--admin-text-main)] text-xs admin-clamp-2">
                    {rw.title}
                  </h4>
                  <p className="text-xs text-[var(--admin-text-muted)] admin-clamp-2">
                    {rw.valueDescription}
                  </p>
                </div>

                <button
                  onClick={() => handleDeleteReward(rw.id)}
                  className="w-8 h-8 rounded-[var(--admin-radius-lg)] bg-[var(--admin-bg)] text-status-error border border-[var(--admin-border)] hover:border-status-error/50 shrink-0 flex items-center justify-center active:scale-95"
                  title="Remover oferta"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Modal Adicionar Oferta */}
          {showAddRewardModal && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-[var(--admin-bg)]/80 backdrop-blur-sm">
              <div className="w-full max-w-md bg-[var(--admin-surface)] rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] p-5 space-y-4 shadow-lg">
                <h3 className="text-sm font-serif font-bold text-[var(--admin-text-main)]">
                  Adicionar Oferta ou Cupom
                </h3>

                <form
                  onKeyDown={handleEnterAsTab}
                  onSubmit={handleCreateReward}
                  className="space-y-3 text-xs"
                >
                  <div>
                    <label className="block text-xs font-bold text-[var(--admin-text-muted)] uppercase tracking-wider mb-1">
                      Título
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: 15% OFF no Próximo Corte"
                      value={newReward.title}
                      onChange={(e) =>
                        setNewReward({ ...newReward, title: e.target.value })
                      }
                      className="w-full bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-2.5 text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--admin-text-muted)] uppercase tracking-wider mb-1">
                      Pontos Necessários
                    </label>
                    <input
                      type="number"
                      required
                      min={50}
                      value={newReward.pointsRequired}
                      onChange={(e) =>
                        setNewReward({
                          ...newReward,
                          pointsRequired: Number(e.target.value),
                        })
                      }
                      className="w-full bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-2.5 text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)] num-tabular"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--admin-text-muted)] uppercase tracking-wider mb-1">
                      Tipo da Oferta
                    </label>
                    <select
                      value={newReward.rewardType}
                      onChange={(e) =>
                        setNewReward({
                          ...newReward,
                          rewardType: e.target.value,
                        })
                      }
                      className="w-full bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-2.5 text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)]"
                    >
                      <option value="upgrade">Upgrade de Serviço</option>
                      <option value="product">Produto Físico</option>
                      <option value="free_cut">Corte Grátis</option>
                      <option value="vip_status">
                        Status VIP / Desconto Permanente
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--admin-text-muted)] uppercase tracking-wider mb-1">
                      Descrição do Benefício
                    </label>
                    <textarea
                      required
                      placeholder="Ex: Válido para qualquer serviço de barba ou produto."
                      value={newReward.valueDescription}
                      onChange={(e) =>
                        setNewReward({
                          ...newReward,
                          valueDescription: e.target.value,
                        })
                      }
                      className="w-full bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-2.5 text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)] min-h-[60px]"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddRewardModal(false)}
                      className="flex-1 h-9 rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] text-[var(--admin-text-muted)] font-bold text-xs"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="flex-1 h-9 rounded-[var(--admin-radius-lg)] bg-[var(--admin-accent)] text-[var(--admin-accent-text)] font-bold text-xs"
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
      {activeTab === "referrals" && (
        <div className="space-y-4 min-w-0">
          <form
            onKeyDown={handleEnterAsTab}
            onSubmit={handleSaveConfig}
            className="bg-[var(--admin-surface)] p-4 sm:p-5 rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] space-y-4"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[var(--admin-border)]">
              <div>
                <h3 className="text-sm font-serif font-bold text-[var(--admin-text-main)] flex items-center gap-2">
                  <Users className="w-4 h-4 text-[var(--admin-accent)]" />
                  <span>Configuração do Motor de Indicações</span>
                </h3>
                <p className="text-xs text-[var(--admin-text-muted)] mt-0.5">
                  Defina os bônus para quem indica e quem é indicado.
                </p>
              </div>

              <button
                type="submit"
                disabled={savingConfig}
                className="h-9 px-4 rounded-[var(--admin-radius-lg)] bg-[var(--admin-accent)] text-[var(--admin-accent-text)] font-bold text-xs flex items-center gap-2 hover:bg-[var(--admin-accent)]/90 active:scale-95 disabled:opacity-50 whitespace-nowrap"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingConfig ? "Salvando..." : "Salvar Regras"}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-[var(--admin-bg)] rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] space-y-1.5">
                <span className="text-xs font-bold uppercase text-[var(--admin-accent)] block admin-safe-wrap">
                  Bônus de Quem Indica
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={config.referralPoints?.referrerBonus || 100}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        referralPoints: {
                          ...config.referralPoints,
                          referrerBonus: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-2 text-[var(--admin-text-main)] font-bold text-xs num-tabular"
                  />
                  <span className="text-[var(--admin-text-muted)] font-bold">
                    pts
                  </span>
                </div>
              </div>

              <div className="p-3 bg-[var(--admin-bg)] rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] space-y-1.5">
                <span className="text-xs font-bold uppercase text-[var(--admin-accent)] block admin-safe-wrap">
                  Bônus do Amigo Indicado
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={config.referralPoints?.referredBonus || 50}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        referralPoints: {
                          ...config.referralPoints,
                          referredBonus: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-2 text-[var(--admin-text-main)] font-bold text-xs num-tabular"
                  />
                  <span className="text-[var(--admin-text-muted)] font-bold">
                    pts
                  </span>
                </div>
              </div>

              <div className="p-3 bg-[var(--admin-bg)] rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] space-y-1.5">
                <span className="text-xs font-bold uppercase text-[var(--admin-accent)] block admin-safe-wrap">
                  Meta Amigos (Milestone)
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={config.referralPoints?.milestoneCount || 5}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        referralPoints: {
                          ...config.referralPoints,
                          milestoneCount: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-2 text-[var(--admin-text-main)] font-bold text-xs num-tabular"
                  />
                  <span className="text-[var(--admin-text-muted)] font-bold">
                    amigos
                  </span>
                </div>
              </div>

              <div className="p-3 bg-[var(--admin-bg)] rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] space-y-1.5">
                <span className="text-xs font-bold uppercase text-[var(--admin-accent)] block admin-safe-wrap">
                  Bônus Milestone
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={config.referralPoints?.milestoneBonus || 1000}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        referralPoints: {
                          ...config.referralPoints,
                          milestoneBonus: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-2 text-[var(--admin-text-main)] font-bold text-xs num-tabular"
                  />
                  <span className="text-[var(--admin-text-muted)] font-bold">
                    pts
                  </span>
                </div>
              </div>
            </div>
          </form>

          {/* Gerador de Link de Indicação */}
          <div className="bg-[var(--admin-surface)] p-4 sm:p-5 rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] space-y-3">
            <h3 className="text-xs font-bold text-[var(--admin-text-main)] uppercase tracking-wider flex items-center gap-2">
              <Share2 className="w-4 h-4 text-[var(--admin-accent)]" />
              <span>Link de indicação</span>
            </h3>

            <div className="space-y-3 w-full text-xs">
              <div>
                <label className="block text-xs font-bold text-[var(--admin-text-muted)] uppercase tracking-wider mb-1">
                  Cliente remetente
                </label>
                <select
                  value={refClient?.id || ""}
                  onChange={(e) => {
                    const found = clients.find((c) => c.id === e.target.value);
                    if (found) setRefClient(found);
                  }}
                  className="w-full bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-2.5 text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)]"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} - Código: {c.referralCode || "Sem código"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--admin-text-muted)] uppercase tracking-wider mb-1">
                  Mensagem do WhatsApp
                </label>
                <textarea
                  value={customRefMsg}
                  onChange={(e) => setCustomRefMsg(e.target.value)}
                  className="w-full bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-2.5 text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)] min-h-[60px]"
                />
              </div>

              <div className="p-3 bg-[var(--admin-bg)] rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] space-y-2">
                <span className="text-xs font-bold uppercase text-[var(--admin-text-muted)] block">
                  Link Único Gerado
                </span>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedRefUrl}
                    className="flex-1 bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-2 text-xs font-mono text-[var(--admin-accent)] min-w-0"
                  />
                  <button
                    onClick={() => copyToClipboard(generatedRefUrl)}
                    className="h-10 sm:h-9 w-full sm:w-auto px-3 bg-[var(--admin-accent)] text-[var(--admin-accent-text)] font-bold text-xs rounded-[var(--admin-radius-lg)] hover:bg-[var(--admin-accent)]/90 shrink-0 flex items-center justify-center gap-1"
                  >
                    {copiedLink ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedLink ? "Copiado!" : "Copiar"}</span>
                  </button>
                  <button
                    onClick={() =>
                      shareViaWhatsapp(
                        refClient?.phone || "",
                        `${customRefMsg} ${generatedRefUrl}`,
                      )
                    }
                    className="h-10 sm:h-9 w-full sm:w-auto px-3 bg-whatsapp text-whatsapp-on font-bold text-xs rounded-[var(--admin-radius-lg)] hover:opacity-90 shrink-0 flex items-center justify-center gap-1"
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
      {activeTab === "reviews" && (
        <div className="space-y-4 min-w-0">
          <div className="bg-[var(--admin-surface)] p-4 sm:p-5 rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-bold text-[var(--admin-text-main)] uppercase tracking-wider flex items-center gap-2">
                <QrCode className="w-4 h-4 text-[var(--admin-accent)]" />
                <span>
                  Link & QR Code para Pesquisas de Avaliação pós-serviço
                </span>
              </h3>
              <button
                onClick={() => setShowQrModal(true)}
                className="h-8 px-3 rounded-[var(--admin-radius-lg)] bg-[var(--admin-bg)] border border-[var(--admin-border)] text-[var(--admin-accent)] hover:text-[var(--admin-text-main)] text-xs font-bold flex items-center gap-1.5 active:scale-95"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Ver QR Code</span>
              </button>
            </div>

            <div className="p-3 bg-[var(--admin-bg)] rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] space-y-2 w-full">
              <span className="text-xs font-bold uppercase text-[var(--admin-text-muted)] block">
                Link Público da Pesquisa NPS
              </span>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  readOnly
                  value={generatedEvalUrl}
                  className="flex-1 bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-2 text-xs font-mono text-[var(--admin-accent)] min-w-0"
                />
                <button
                  onClick={() => copyToClipboard(generatedEvalUrl, true)}
                  className="h-10 sm:h-9 w-full sm:w-auto px-3 bg-[var(--admin-accent)] text-[var(--admin-accent-text)] font-bold text-xs rounded-[var(--admin-radius-lg)] hover:bg-[var(--admin-accent)]/90 shrink-0 flex items-center justify-center gap-1"
                >
                  {copiedEvalLink ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedEvalLink ? "Copiado!" : "Copiar"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Feed de Avaliações */}
          <div className="bg-[var(--admin-surface)] p-4 sm:p-5 rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h4 className="text-xs font-bold text-[var(--admin-text-main)] uppercase tracking-wider flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[var(--admin-accent)]" />
                <span>Feed de Pesquisas de Pós-Atendimento</span>
              </h4>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <select
                  value={reviewStatusFilter}
                  onChange={(event) =>
                    setReviewStatusFilter(event.target.value)
                  }
                  className="h-9 rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] bg-[var(--admin-bg)] px-2 text-xs font-semibold text-[var(--admin-text-main)] focus:border-[var(--admin-accent)] focus:outline-none"
                  aria-label="Filtrar status das avaliações"
                >
                  <option value="all">Todos os status</option>
                  {Object.entries(reviewStatusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <select
                  value={reviewPriorityFilter}
                  onChange={(event) =>
                    setReviewPriorityFilter(event.target.value)
                  }
                  className="h-9 rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] bg-[var(--admin-bg)] px-2 text-xs font-semibold text-[var(--admin-text-main)] focus:border-[var(--admin-accent)] focus:outline-none"
                  aria-label="Filtrar prioridade das avaliações"
                >
                  <option value="all">Todas as prioridades</option>
                  {Object.entries(reviewPriorityLabels).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>

            {filteredReviews.length > 0 ? (
              <div className="admin-table-container">
                <div className="admin-table-wrap">
                  <table className="admin-table admin-review-table">
                    <caption className="sr-only">
                      Pesquisas de pós-atendimento recebidas
                    </caption>
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Cliente</th>
                        <th>Avaliação</th>
                        <th>Serviço / profissional</th>
                        <th>Respostas</th>
                        <th>Status</th>
                        <th>Prioridade</th>
                        <th className="text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReviews.map((rev: any) => {
                        const statusKey = rev.managementStatus || "new";
                        const priorityKey = rev.priority || "normal";
                        const statusClass =
                          statusKey === "resolved"
                            ? "admin-badge admin-badge-success"
                            : statusKey === "in_review"
                              ? "admin-badge admin-badge-gold"
                              : statusKey === "archived"
                                ? "admin-badge admin-badge-neutral"
                                : "admin-badge admin-badge-warning";
                        const priorityClass =
                          priorityKey === "urgent"
                            ? "admin-badge admin-badge-error"
                            : priorityKey === "high"
                              ? "admin-badge admin-badge-gold"
                              : "admin-badge admin-badge-neutral";
                        const clientLabel = rev.clientName || "Cliente anônimo";

                        return (
                          <tr
                            key={rev.id}
                            tabIndex={0}
                            className="cursor-pointer"
                            aria-label={`Abrir avaliação de ${clientLabel}`}
                            onClick={() => openReviewFollowup(rev)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                openReviewFollowup(rev);
                              }
                            }}
                          >
                            <td className="whitespace-nowrap text-[var(--admin-text-muted)] num-tabular">
                              {new Date(rev.createdAt).toLocaleDateString("pt-BR")}
                            </td>
                            <td>
                              <div className="min-w-[11rem]">
                                <span className="block font-semibold text-[var(--admin-text-main)]">
                                  {clientLabel}
                                </span>
                                {rev.isAnonymous && (
                                  <span className="mt-1 inline-flex rounded-[var(--admin-radius-full)] border border-[var(--admin-border)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--admin-text-muted)]">
                                    Anônimo
                                  </span>
                                )}
                                <p
                                  className="mt-1 max-w-[18rem] truncate text-xs italic text-[var(--admin-text-muted)]"
                                  title={rev.comment || "Sem observações adicionais."}
                                >
                                  “{rev.comment || "Sem observações adicionais."}”
                                </p>
                              </div>
                            </td>
                            <td>
                              <div
                                className="flex items-center gap-1"
                                aria-label={`${rev.rating || 0} de 5 estrelas`}
                              >
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    className={`h-3.5 w-3.5 ${star <= Number(rev.rating || 0) ? "fill-gold-base text-[var(--admin-accent)]" : "text-border-subtle"}`}
                                  />
                                ))}
                                <span className="ml-1 text-xs font-semibold text-[var(--admin-text-main)]">
                                  {Number(rev.rating || 0).toFixed(1)}
                                </span>
                              </div>
                            </td>
                            <td>
                              <div className="min-w-[12rem] space-y-1">
                                <span className="block max-w-[16rem] truncate font-semibold text-[var(--admin-accent)]">
                                  {rev.serviceTitle || "Serviço não informado"}
                                </span>
                                <span className="block max-w-[16rem] truncate text-xs text-[var(--admin-text-muted)]">
                                  {rev.professionalName || "Profissional não informado"}
                                </span>
                              </div>
                            </td>
                            <td>
                              <div className="admin-review-responses min-w-[14rem] space-y-1 text-xs text-[var(--admin-text-muted)]">
                                <p>
                                  <span className="font-semibold text-[var(--admin-text-main)]">Resultado:</span>{" "}
                                  {rev.understoodRequest || "Não informado"}
                                </p>
                                <p>
                                  <span className="font-semibold text-[var(--admin-text-main)]">Espera:</span>{" "}
                                  {rev.waitTimeAcceptable || "Não informado"}
                                </p>
                                <p>
                                  <span className="font-semibold text-[var(--admin-text-main)]">Experiência:</span>{" "}
                                  {rev.serviceExperience || "Não informado"}
                                </p>
                                <p>
                                  <span className="font-semibold text-[var(--admin-text-main)]">Recomendaria:</span>{" "}
                                  {rev.wouldRecommend || "Não informado"}
                                </p>
                              </div>
                            </td>
                            <td>
                              <span className={statusClass}>
                                {reviewStatusLabels[statusKey] || "Nova"}
                              </span>
                            </td>
                            <td>
                              <span className={priorityClass}>
                                {reviewPriorityLabels[priorityKey] || "Normal"}
                              </span>
                            </td>
                            <td className="text-right">
                              <button
                                type="button"
                                className="admin-btn admin-btn-secondary admin-btn-sm"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openReviewFollowup(rev);
                                }}
                              >
                                Abrir
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="py-6 text-center text-xs text-[var(--admin-text-muted)]">
                Nenhuma avaliação encontrada para os filtros atuais.
              </p>
            )}
          </div>

          {selectedReview && (
            <div
              className="fixed inset-0 z-[160] flex items-center justify-center bg-[var(--admin-bg)]/80 p-4 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
              aria-labelledby="review-followup-title"
            >
              <form
                onSubmit={handleSaveReviewFollowup}
                className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[var(--admin-radius-xl)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-2xl sm:p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--admin-accent)]">
                      Acompanhamento interno
                    </p>
                    <h3
                      id="review-followup-title"
                      className="mt-1 text-lg font-serif font-bold text-[var(--admin-text-main)]"
                    >
                      Avaliação de{" "}
                      {selectedReview.clientName || "cliente anônimo"}
                    </h3>
                    <p className="mt-1 text-xs text-[var(--admin-text-muted)]">
                      {selectedReview.serviceTitle || "Serviço não informado"} ·{" "}
                      {selectedReview.professionalName ||
                        "Profissional não informado"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedReview(null)}
                    className="rounded-[var(--admin-radius-full)] px-3 py-1.5 text-xs font-bold text-[var(--admin-text-muted)] hover:bg-[var(--admin-bg)] hover:text-[var(--admin-text-main)]"
                  >
                    Fechar
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] bg-[var(--admin-bg)] p-3">
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-[var(--admin-text-muted)]">
                      Nota
                    </span>
                    <span className="mt-1 block text-lg font-black text-[var(--admin-accent)]">
                      {selectedReview.rating}/5
                    </span>
                  </div>
                  <div className="rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] bg-[var(--admin-bg)] p-3">
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-[var(--admin-text-muted)]">
                      Recomendação
                    </span>
                    <span className="mt-1 block text-xs font-bold text-[var(--admin-text-main)]">
                      {selectedReview.wouldRecommend || "Não informado"}
                    </span>
                  </div>
                  <div className="rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] bg-[var(--admin-bg)] p-3">
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-[var(--admin-text-muted)]">
                      Recebida em
                    </span>
                    <span className="mt-1 block text-xs font-bold text-[var(--admin-text-main)]">
                      {new Date(selectedReview.createdAt).toLocaleString(
                        "pt-BR",
                      )}
                    </span>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="space-y-1.5 text-xs font-bold text-[var(--admin-text-muted)]">
                    <span>Status do acompanhamento</span>
                    <select
                      autoFocus
                      value={reviewDraft.managementStatus}
                      onChange={(event) =>
                        setReviewDraft({
                          ...reviewDraft,
                          managementStatus: event.target.value,
                        })
                      }
                      className="w-full rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] bg-[var(--admin-bg)] p-3 text-xs font-semibold text-[var(--admin-text-main)] focus:border-[var(--admin-accent)] focus:outline-none"
                    >
                      {Object.entries(reviewStatusLabels).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  <label className="space-y-1.5 text-xs font-bold text-[var(--admin-text-muted)]">
                    <span>Prioridade</span>
                    <select
                      value={reviewDraft.priority}
                      onChange={(event) =>
                        setReviewDraft({
                          ...reviewDraft,
                          priority: event.target.value,
                        })
                      }
                      className="w-full rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] bg-[var(--admin-bg)] p-3 text-xs font-semibold text-[var(--admin-text-main)] focus:border-[var(--admin-accent)] focus:outline-none"
                    >
                      {Object.entries(reviewPriorityLabels).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                </div>

                <label className="mt-4 block space-y-1.5 text-xs font-bold text-[var(--admin-text-muted)]">
                  <span>Observação interna</span>
                  <textarea
                    value={reviewDraft.internalNotes}
                    onChange={(event) =>
                      setReviewDraft({
                        ...reviewDraft,
                        internalNotes: event.target.value,
                      })
                    }
                    maxLength={2000}
                    rows={4}
                    placeholder="Registre uma ação, retorno necessário ou contexto operacional..."
                    className="w-full resize-y rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] bg-[var(--admin-bg)] p-3 text-xs font-medium text-[var(--admin-text-main)] placeholder:text-[var(--admin-text-muted)] focus:border-[var(--admin-accent)] focus:outline-none"
                  />
                  <span className="block text-right text-[10px] font-normal text-[var(--admin-text-muted)]">
                    {reviewDraft.internalNotes.length}/2000
                  </span>
                </label>

                {selectedReview.followupHistory?.length > 0 && (
                  <div className="mt-4 space-y-2 rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] bg-[var(--admin-bg)] p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--admin-text-muted)]">
                      Histórico de acompanhamento
                    </p>
                    <div className="max-h-32 space-y-2 overflow-y-auto">
                      {selectedReview.followupHistory.map((event: any) => (
                        <div
                          key={event.id}
                          className="border-l-2 border-[var(--admin-accent)]/50 pl-2 text-xs"
                        >
                          <p className="font-semibold text-[var(--admin-text-main)]">
                            {event.toStatus
                              ? reviewStatusLabels[event.toStatus] ||
                                event.toStatus
                              : "Atualização registrada"}
                            {event.toPriority
                              ? ` · ${reviewPriorityLabels[event.toPriority] || event.toPriority}`
                              : ""}
                          </p>
                          <p className="text-[var(--admin-text-muted)]">
                            {new Date(event.createdAt).toLocaleString("pt-BR")}
                            {event.note ? ` · ${event.note}` : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedReview(null)}
                    className="h-10 rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] px-4 text-xs font-bold text-[var(--admin-text-muted)] hover:bg-[var(--admin-bg)]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingReviewFollowup}
                    className="h-10 rounded-[var(--admin-radius-lg)] bg-[var(--admin-accent)] px-5 text-xs font-bold text-[var(--admin-accent-text)] hover:bg-[var(--admin-accent)]/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingReviewFollowup
                      ? "Salvando..."
                      : "Salvar acompanhamento"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Modal QR Code */}
          {showQrModal && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-[var(--admin-bg)]/80 backdrop-blur-sm">
              <div className="w-full max-w-xs bg-[var(--admin-surface)] rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] p-5 space-y-3 text-center shadow-lg">
                <h3 className="text-sm font-serif font-bold text-[var(--admin-text-main)]">
                  QR Code para Mesas & Espelhos
                </h3>

                <div className="p-3 bg-white rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] inline-block mx-auto">
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

                <div className="text-xs font-mono text-[var(--admin-text-muted)] break-all">
                  {generatedEvalUrl}
                </div>

                <button
                  onClick={() => setShowQrModal(false)}
                  className="w-full h-9 bg-[var(--admin-accent)] text-[var(--admin-accent-text)] font-bold rounded-[var(--admin-radius-lg)] text-xs"
                >
                  Fechar QR Code
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "rewards" && (
        <AdminFab
          onClick={() => setShowAddRewardModal(true)}
          label="Nova Oferta"
          icon={Plus}
        />
      )}
    </div>
  );
};
