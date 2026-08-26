import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  fetchLoyaltyInfo,
  fetchRewardsList,
  fetchLoyaltyCatalog,
  redeemReward,
  performInstagramCheckin,
  LoyaltyInfo,
  NavoRewardItem
} from '../../services/supabaseDataService';
import { ReviewModal } from './ReviewModal';
import {
  Award,
  Gift,
  Tag,
  Package,
  Sparkles,
  History,
  Share2,
  Copy,
  Check,
  Instagram,
  Crown,
  Scissors,
  Users,
  ChevronRight,
  Star,
  QrCode,
  Zap,
  Info
} from 'lucide-react';

export const ClientLoyalty: React.FC<{ currentUser: any }> = ({ currentUser }) => {
  const [loyalty, setLoyalty] = useState<LoyaltyInfo | null>(null);
  const [rewards, setRewards] = useState<NavoRewardItem[]>([]);
  const [catalog, setCatalog] = useState<{ benefits: any[]; plans: any[] }>({ benefits: [], plans: [] });
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [redemptionSuccess, setRedemptionSuccess] = useState<{
    code: string;
    title: string;
    description: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [checkinSuccessMsg, setCheckinSuccessMsg] = useState<string | null>(null);
  const [activeReviewAppointment, setActiveReviewAppointment] = useState<any | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [loyaltyData, rewardsData, catalogData] = await Promise.all([
        fetchLoyaltyInfo(),
        fetchRewardsList(),
        fetchLoyaltyCatalog()
      ]);
      setLoyalty(loyaltyData);
      setRewards(rewardsData);
      setCatalog({ benefits: Array.isArray(catalogData?.benefits) ? catalogData.benefits : [], plans: Array.isArray(catalogData?.plans) ? catalogData.plans : [] });
    } catch (e) {
      console.error('Erro ao carregar carteira de fidelidade:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 70,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#C9A96E', '#F2EFE7', '#121212', '#E2B857']
      });
    } catch (e) {
      // fallback
    }
  };

  const handleRedeem = async (reward: NavoRewardItem) => {
    if (!loyalty || loyalty.loyaltyPoints < reward.pointsRequired) return;
    setClaimingId(reward.id);
    try {
      const res = await redeemReward(reward.id);
      triggerConfetti();
      setRedemptionSuccess({
        code: res.redemptionCode,
        title: reward.title,
        description: reward.valueDescription
      });
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao resgatar recompensa.');
    } finally {
      setClaimingId(null);
    }
  };

  const handleCopyReferral = () => {
    if (!loyalty?.referralCode) return;
    const url = `${window.location.origin}?ref=${loyalty.referralCode}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleWhatsAppShare = () => {
    if (!loyalty?.referralCode) return;
    const url = `${window.location.origin}?ref=${loyalty.referralCode}`;
    const text = encodeURIComponent(
      `✂️ Fala parceiro! Te mandei 50 pontos bônus no seu 1º corte na Navo Barbearia!\n\nCadastre-se pelo meu link com o código *${loyalty.referralCode}*:\n${url}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleInstagramCheckin = async () => {
    setCheckinLoading(true);
    try {
      const res = await performInstagramCheckin();
      triggerConfetti();
      setCheckinSuccessMsg(res.message);
      await loadData();
      setTimeout(() => setCheckinSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Erro ao realizar check-in.');
    } finally {
      setCheckinLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center space-y-3">
        <div className="w-10 h-10 border-2 border-gold-base border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-content-muted">Carregando sua carteira Navo Rewards...</p>
      </div>
    );
  }

  const currentPoints = loyalty?.loyaltyPoints || 0;
  const currentTier = loyalty?.currentTier?.name || loyalty?.loyaltyTier || 'Bronze';
  const tierMultiplier = loyalty?.tierMultiplier || loyalty?.currentTier?.multiplier || 1;
  const tierNextGoal = loyalty?.nextTier?.minimumPoints || currentPoints;
  const tierProgress = loyalty?.tierProgress ?? (tierNextGoal > 0 ? Math.min(100, Math.round((currentPoints / tierNextGoal) * 100)) : 100);

  return (
    <div className="space-y-6 pb-8 px-4 max-w-xl mx-auto">
      {/* Review Modal Trigger */}
      {activeReviewAppointment && (
        <ReviewModal
          isOpen={true}
          appointment={activeReviewAppointment}
          onClose={() => setActiveReviewAppointment(null)}
          onSuccess={() => {
            setActiveReviewAppointment(null);
            loadData();
          }}
        />
      )}

      {/* Voucher Redemption Success Modal */}
      {redemptionSuccess && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-surface-base/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-sm bg-surface-card rounded-2xl border border-gold-base/50 p-6 shadow-2xl text-center space-y-4 relative">
            <div className="w-14 h-14 rounded-full bg-gold-base/20 border border-gold-base text-gold-base mx-auto flex items-center justify-center">
              <Gift className="w-7 h-7" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-gold-base block">Voucher Resgatado</span>
              <h3 className="text-lg font-bold text-content-base">{redemptionSuccess.title}</h3>
              <p className="text-xs text-content-muted mt-1">{redemptionSuccess.description}</p>
            </div>

            <div className="bg-surface-base p-4 rounded-xl border border-dashed border-gold-base/40 text-center space-y-1">
              <span className="text-[10px] uppercase text-content-muted block">Apresente este código na recepção</span>
              <span className="text-xl font-mono font-black text-gold-base tracking-wider">{redemptionSuccess.code}</span>
            </div>

            <button
              onClick={() => setRedemptionSuccess(null)}
              className="w-full py-3 rounded-xl bg-gold-base text-surface-base font-bold text-xs uppercase tracking-wider hover:opacity-95"
            >
              Entendido / Salvar Voucher
            </button>
          </div>
        </div>
      )}

      {/* Program Explanation Banner */}
      <div className="bg-surface-card/90 p-4 rounded-2xl border border-gold-base/30 backdrop-blur-md flex items-start gap-3 shadow-lg">
        <div className="w-10 h-10 rounded-xl bg-gold-base/10 border border-gold-base/30 text-gold-base flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h4 className="text-xs font-serif text-content-base font-semibold uppercase tracking-wider">Navo Rewards VIP</h4>
          <p className="text-xs text-content-muted leading-relaxed">
            Cada <strong className="text-gold-base">R$ 1,00 gasto = 1 Ponto</strong>. Acumule pontos, atinja novos níveis VIP e troque por serviços e produtos exclusivos!
          </p>
        </div>
      </div>

      {/* Main VIP Wallet Card */}
      <div className="relative overflow-hidden bg-gradient-to-br from-surface-card via-surface-base to-surface-card p-6 rounded-2xl border border-gold-base/50 shadow-2xl space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] text-content-muted uppercase font-bold tracking-widest block">Nível de Fidelidade</span>
            <div className="flex items-center space-x-2 mt-0.5">
              <span className="text-2xl font-serif font-bold text-gold-base">{currentTier}</span>
              <span className="px-2.5 py-0.5 rounded-full bg-gold-base/20 text-gold-base text-[10px] font-bold border border-gold-base/40 uppercase">
                {`${tierMultiplier}x Pontos`}{currentTier === 'Diamante' ? ' VIP' : ''}
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-3xl font-serif text-content-base font-bold block">{currentPoints}</span>
            <span className="text-[10px] text-gold-base font-extrabold uppercase tracking-wider">Pontos Navo</span>
          </div>
        </div>

        {/* Tier Benefits */}
        <div className="grid grid-cols-2 gap-2 text-[10px] text-content-muted pt-1">
          <div className="bg-surface-base/80 p-2 rounded-lg border border-border-subtle flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-gold-base shrink-0" />
            <span>R$ 1 = 1 Ponto Base</span>
          </div>
          <div className="bg-surface-base/80 p-2 rounded-lg border border-border-subtle flex items-center gap-1.5">
            <Crown className="w-3.5 h-3.5 text-gold-base shrink-0" />
            <span>Prioridade na Fila</span>
          </div>
        </div>

        {/* Progress Bar to Next Level */}
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between text-[11px] text-content-muted font-medium">
            <span>Progresso para próximo Nível</span>
            <span className="text-content-base font-bold">{currentPoints} / {tierNextGoal} pts</span>
          </div>
          <div className="w-full h-3 bg-surface-base rounded-full overflow-hidden p-0.5 border border-border-subtle">
            <div
              className="h-full bg-gradient-to-r from-gold-base to-gold-hover rounded-full transition-all duration-500 shadow-md"
              style={{ width: `${tierProgress}%` }}
            />
          </div>
        </div>
      </div>

      {catalog.plans.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-gold-hover uppercase tracking-wider flex items-center gap-1.5"><Crown className="w-4 h-4 text-gold-base" /> Planos do Club</h3>
          <div className="space-y-3">
            {catalog.plans.map((plan) => {
              const planBenefits = catalog.benefits.filter((benefit) => (plan.benefitIds || []).includes(benefit.id));
              return <div key={plan.id} className={`bg-surface-card p-4 rounded-2xl border ${plan.isFeatured ? 'border-gold-base/60 shadow-lg' : 'border-border-subtle'} space-y-3`}>
                <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h4 className="text-sm font-bold text-content-base">{plan.name}</h4>{plan.isFeatured && <span className="text-[9px] rounded-full px-2 py-0.5 bg-gold-base/15 text-gold-base font-bold">DESTAQUE</span>}</div><p className="text-[11px] text-content-muted mt-1">{plan.description}</p></div><div className="text-right shrink-0"><strong className="text-lg text-gold-base">R$ {Number(plan.price || 0).toFixed(2).replace('.', ',')}</strong><span className="block text-[9px] text-content-muted uppercase">{plan.billingPeriod === 'none' ? 'valor único' : plan.billingPeriod}</span></div></div>
                {plan.pointsBonus > 0 && <div className="text-[10px] text-status-success font-bold">+{plan.pointsBonus} pontos previstos no plano</div>}
                {planBenefits.length > 0 && <div className="grid grid-cols-1 gap-1.5">{planBenefits.map((benefit) => <div key={benefit.id} className="flex items-start gap-2 text-[10px] text-content-muted"><Gift className="w-3.5 h-3.5 text-gold-base shrink-0" /><span><strong className="text-content-base">{benefit.name}</strong> — {benefit.description}</span></div>)}</div>}
              </div>;
            })}
          </div>
        </div>
      )}

      {catalog.benefits.length > 0 && (
        <div className="bg-surface-card p-4 rounded-2xl border border-border-subtle space-y-3">
          <h3 className="text-xs font-bold text-gold-hover uppercase tracking-wider flex items-center gap-1.5"><Gift className="w-4 h-4 text-gold-base" /> Benefícios disponíveis</h3>
          <div className="space-y-2">{catalog.benefits.map((benefit) => <div key={benefit.id} className="flex items-start justify-between gap-3 p-2.5 rounded-xl bg-surface-base border border-border-subtle"><div><strong className="text-xs text-content-base">{benefit.name}</strong><p className="text-[10px] text-content-muted mt-0.5">{benefit.description}</p></div>{benefit.valueText || benefit.valueAmount !== null ? <span className="text-[10px] font-bold text-gold-base shrink-0">{benefit.valueText || `R$ ${Number(benefit.valueAmount).toFixed(2).replace('.', ',')}`}</span> : null}</div>)}</div>
        </div>
      )}

      {/* Pending Reviews Alert Callout */}
      {loyalty?.pendingReviews && loyalty.pendingReviews.length > 0 && (
        <div className="bg-gold-base/10 border border-gold-base/40 p-4 rounded-2xl space-y-3">
          <div className="flex items-center space-x-2 text-gold-base font-bold text-xs uppercase tracking-wider">
            <Star className="w-4 h-4 fill-gold-base text-gold-base" />
            <span>Avaliação Pendente de Atendimento</span>
          </div>
          <p className="text-xs text-content-base">
            Avalie seu último corte com {loyalty.pendingReviews[0].professional_name} e receba de <strong className="text-gold-base">+20 a +60 pontos</strong> na hora!
          </p>
          <button
            onClick={() => setActiveReviewAppointment(loyalty.pendingReviews[0])}
            className="w-full py-2.5 rounded-xl bg-gold-base text-surface-base font-bold text-xs uppercase tracking-wider hover:opacity-95 shadow-md flex items-center justify-center gap-2"
          >
            <Star className="w-4 h-4 fill-surface-base text-surface-base" />
            <span>Avaliar Agora & Resgatar Pontos</span>
          </button>
        </div>
      )}

      {/* Referral Engine (Indique e Ganhe) */}
      <div className="bg-surface-card p-5 rounded-2xl border border-border-subtle shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-gold-base/10 text-gold-base">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-content-base">Indique Amigos & Ganhe +100 Pts</h3>
              <p className="text-[11px] text-content-muted">Seu amigo ganha 50 pts e você ganha 100 pts no 1º corte dele!</p>
            </div>
          </div>
        </div>

        {/* Code & Actions */}
        <div className="bg-surface-base p-3 rounded-xl border border-border-subtle flex items-center justify-between gap-2">
          <div className="space-y-0.5">
            <span className="text-[9px] uppercase text-content-muted font-bold block">Seu Código Único</span>
            <span className="text-sm font-mono font-black text-gold-base">{loyalty?.referralCode || 'NAV-CLIENT'}</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopyReferral}
              className="px-3 py-2 rounded-lg bg-surface-card border border-border-subtle text-content-base font-bold text-xs hover:border-gold-base transition-all flex items-center gap-1.5"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-status-success" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Copiado!' : 'Copiar'}</span>
            </button>

            <button
              onClick={handleWhatsAppShare}
              className="px-3 py-2 rounded-lg bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-500 transition-all flex items-center gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>
          </div>
        </div>

        {/* Referral Stats */}
        <div className="grid grid-cols-3 gap-2 text-center pt-1">
          <div className="p-2.5 rounded-xl bg-surface-base border border-border-subtle">
            <span className="text-xs text-content-muted block">Convidados</span>
            <span className="text-sm font-bold text-content-base">{loyalty?.referralStats.totalInvited || 0}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-surface-base border border-border-subtle">
            <span className="text-xs text-content-muted block">Viraram Clientes</span>
            <span className="text-sm font-bold text-gold-base">{loyalty?.referralStats.completedCount || 0}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-surface-base border border-border-subtle">
            <span className="text-xs text-content-muted block">Pontos Ganhos</span>
            <span className="text-sm font-bold text-content-base">+{loyalty?.referralStats.pointsEarned || 0}</span>
          </div>
        </div>
      </div>

      {/* Instagram Story Check-in Action */}
      <div className="bg-gradient-to-r from-purple-900/30 via-pink-900/20 to-surface-card p-4 rounded-2xl border border-pink-500/30 shadow-lg flex items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white flex items-center justify-center shrink-0">
            <Instagram className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-content-base">Check-in Instagram (+10 pts)</h4>
            <p className="text-[10px] text-content-muted">Poste um Story marcando @navobarber durante o atendimento</p>
          </div>
        </div>

        <button
          onClick={handleInstagramCheckin}
          disabled={checkinLoading}
          className="px-3.5 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold shrink-0 transition-all shadow-md"
        >
          {checkinLoading ? 'Verificando...' : 'Fazer Check-in'}
        </button>
      </div>

      {checkinSuccessMsg && (
        <div className="p-3 rounded-xl bg-status-success/20 border border-status-success/40 text-status-success text-xs font-bold text-center">
          {checkinSuccessMsg}
        </div>
      )}

      {/* Rewards Catalog */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-gold-hover uppercase tracking-wider flex items-center space-x-1.5">
          <Gift className="w-4 h-4 text-gold-base" />
          <span>Resgatar Recompensas & Upgrades</span>
        </h3>

        <div className="space-y-3">
          {rewards.map((reward) => {
            const canAfford = currentPoints >= reward.pointsRequired;
            const isClaiming = claimingId === reward.id;

            return (
              <div
                key={reward.id}
                className="bg-surface-card p-4 rounded-2xl border border-border-subtle flex items-center justify-between gap-3 hover:border-gold-base/40 transition-all shadow-md"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-xl bg-surface-base border border-gold-base/30 flex items-center justify-center text-gold-base shrink-0">
                    {reward.rewardType === 'upgrade' && <Sparkles className="w-6 h-6" />}
                    {reward.rewardType === 'product' && <Package className="w-6 h-6" />}
                    {reward.rewardType === 'free_cut' && <Scissors className="w-6 h-6" />}
                    {reward.rewardType === 'vip_status' && <Crown className="w-6 h-6" />}
                  </div>

                  <div>
                    <h4 className="font-bold text-content-base text-xs">{reward.title}</h4>
                    <span className="text-[10px] text-content-muted block mt-0.5">{reward.valueDescription}</span>
                    <span className="text-[11px] font-extrabold text-gold-base block mt-1">
                      {reward.pointsRequired} PONTOS
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleRedeem(reward)}
                  disabled={!canAfford || isClaiming}
                  className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all shrink-0 ${
                    canAfford
                      ? 'bg-gold-base text-surface-base hover:opacity-95 shadow-md active:scale-95'
                      : 'bg-surface-base text-content-muted border border-border-subtle cursor-not-allowed'
                  }`}
                >
                  {isClaiming ? 'Resgatando...' : canAfford ? 'Resgatar' : 'Faltam Pts'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Point Transaction Ledger */}
      <div className="bg-surface-card p-4 rounded-2xl border border-border-subtle space-y-3 shadow-lg">
        <h4 className="text-xs font-bold text-gold-hover uppercase tracking-wider flex items-center space-x-1.5">
          <History className="w-4 h-4 text-gold-base" />
          <span>Extrato de Pontos</span>
        </h4>

        {loyalty?.transactions && loyalty.transactions.length > 0 ? (
          <div className="space-y-2 text-xs divide-y divide-border-subtle">
            {loyalty.transactions.map((tx) => (
              <div key={tx.id} className="pt-2 flex justify-between items-center">
                <div>
                  <span className="text-content-base font-semibold block">{tx.description}</span>
                  <span className="text-[10px] text-content-muted">
                    {new Date(tx.createdAt).toLocaleDateString('pt-BR')} • {(tx.sourceType || tx.type).toUpperCase()}{tx.expiresAt ? ` • expira em ${new Date(tx.expiresAt).toLocaleDateString('pt-BR')}` : ''}
                  </span>
                </div>
                <span className={`font-bold ${tx.amount > 0 ? 'text-status-success' : 'text-status-error'}`}>
                  {tx.amount > 0 ? `+${tx.amount}` : tx.amount} pts
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-content-muted py-2 text-center">Nenhum histórico de pontos ainda.</p>
        )}
      </div>
    </div>
  );
};
