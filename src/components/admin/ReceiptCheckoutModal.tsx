import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  CreditCard,
  ChevronDown,
  FileText,
  Info,
  Loader2,
  Printer,
  QrCode,
  ReceiptText,
  UserRound,
  WalletCards,
  X,
} from 'lucide-react';
import { handleEnterAsTab } from '../../utils/formUtils';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import {
  createReceiptInSupabase,
  receiveReceiptInSupabase,
  type ReceiptItem,
  type ReceiptPaymentMethod,
} from '../../services/supabaseDataService';
import { defaultPrintSettings, fetchPrintSettings } from '../../services/printSettingsService';
import { escapePrintHtml, openPrintWindow } from '../../utils/printUtils';

export interface ReceiptCheckoutSource {
  appointmentId?: string;
  clientId?: string;
  clientName: string;
  clientPhone?: string;
  professionalId?: string;
  professionalName?: string;
  serviceTitle: string;
  servicePrice?: number;
}

interface ReceiptCheckoutModalProps {
  source: ReceiptCheckoutSource;
  initialReceipt?: ReceiptItem | null;
  onClose: () => void;
  onPending: (receipt: ReceiptItem) => void;
  onReceived: (receipt: ReceiptItem) => void;
}

type CheckoutStep = 'decision' | 1 | 2 | 3;
type AdjustmentMode = 'percent' | 'amount';

const money = (value: number) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
}).format(Number.isFinite(value) ? value : 0);

const parseMoney = (value: string) => {
  const normalized = value.replace(',', '.').replace(/[^\d.]/g, '');
  return Math.max(0, Number(normalized) || 0);
};

const paymentOptions: { id: ReceiptPaymentMethod; label: string; icon: React.ElementType }[] = [
  { id: 'pix', label: 'PIX', icon: QrCode },
  { id: 'credit_card', label: 'Crédito', icon: CreditCard },
  { id: 'debit_card', label: 'Débito', icon: WalletCards },
  { id: 'cash', label: 'Dinheiro', icon: Banknote },
  { id: 'other', label: 'Outro', icon: ReceiptText },
];

const paymentLabel: Record<ReceiptPaymentMethod, string> = {
  pix: 'PIX',
  credit_card: 'Cartão de crédito',
  debit_card: 'Cartão de débito',
  cash: 'Dinheiro',
  other: 'Outro meio',
};

export const ReceiptCheckoutModal: React.FC<ReceiptCheckoutModalProps> = ({
  source,
  initialReceipt = null,
  onClose,
  onPending,
  onReceived,
}) => {
  const originalAmount = Math.max(0, Number(source.servicePrice || 0));
  const [step, setStep] = useState<CheckoutStep>(initialReceipt ? 1 : 'decision');
  const [receipt, setReceipt] = useState<ReceiptItem | null>(initialReceipt);
  const [observations, setObservations] = useState(initialReceipt?.observations || '');
  const [discountMode, setDiscountMode] = useState<AdjustmentMode>('percent');
  const [discountValue, setDiscountValue] = useState(initialReceipt ? initialReceipt.discountPercent.toFixed(2) : '0');
  const [surchargeMode, setSurchargeMode] = useState<AdjustmentMode>('percent');
  const [surchargeValue, setSurchargeValue] = useState(initialReceipt ? initialReceipt.surchargePercent.toFixed(2) : '0');
  const [paymentMethod, setPaymentMethod] = useState<ReceiptPaymentMethod>(initialReceipt?.paymentMethod || 'pix');
  const [cashReceived, setCashReceived] = useState((initialReceipt?.amountReceived || originalAmount).toFixed(2));
  const [isCreating, setIsCreating] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(true, dialogRef);

  const calculation = useMemo(() => {
    const entered = Math.max(0, Number(initialReceipt?.enteredAmount ?? originalAmount));
    const discountRaw = parseMoney(discountValue);
    const surchargeRaw = parseMoney(surchargeValue);
    const discountPercent = discountMode === 'percent' ? Math.min(100, discountRaw) : (entered > 0 ? (discountRaw / entered) * 100 : 0);
    const discountAmount = discountMode === 'percent' ? entered * (discountPercent / 100) : Math.min(entered, discountRaw);
    const surchargePercent = surchargeMode === 'percent' ? surchargeRaw : (entered > 0 ? (surchargeRaw / entered) * 100 : 0);
    const surchargeAmount = surchargeMode === 'percent' ? entered * (surchargePercent / 100) : surchargeRaw;
    const total = Math.max(0, entered - discountAmount + surchargeAmount);
    const amountReceived = paymentMethod === 'cash' ? parseMoney(cashReceived) : total;

    return {
      entered,
      discountPercent,
      discountAmount,
      surchargePercent,
      surchargeAmount,
      total,
      amountReceived,
      change: Math.max(0, amountReceived - total),
    };
  }, [cashReceived, discountMode, discountValue, initialReceipt?.enteredAmount, originalAmount, paymentMethod, surchargeMode, surchargeValue]);

  useEffect(() => {
    if (paymentMethod !== 'cash') {
      setCashReceived(calculation.total.toFixed(2));
    }
  }, [calculation.total, paymentMethod]);

  const ensurePendingReceipt = async () => {
    if (receipt) return receipt;
    setIsCreating(true);
    setError(null);
    try {
      const created = await createReceiptInSupabase({
        appointmentId: source.appointmentId || null,
        clientId: source.clientId || null,
        clientName: source.clientName,
        clientPhone: source.clientPhone || null,
        professionalId: source.professionalId || null,
        professionalName: source.professionalName || null,
        serviceTitle: source.serviceTitle,
        originalAmount,
        enteredAmount: originalAmount,
      });
      setReceipt(created);
      onPending(created);
      return created;
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Não foi possível criar a pendência.';
      setError(message);
      return null;
    } finally {
      setIsCreating(false);
    }
  };

  const handleRegisterLater = async () => {
    const pending = await ensurePendingReceipt();
    if (pending) onClose();
  };

  const handleRegisterNow = async () => {
    const pending = await ensurePendingReceipt();
    if (pending) setStep(1);
  };

  const handlePrintReceipt = async () => {
    if (!receipt) return;
    setError(null);
    try {
      const settings = await fetchPrintSettings().catch(() => defaultPrintSettings);
      const contextRows = [
        settings.showClientData ? `<p><strong>Cliente:</strong> ${escapePrintHtml(receipt.clientName)}</p>` : '',
        settings.showService ? `<p><strong>Serviço:</strong> ${escapePrintHtml(receipt.serviceTitle)}</p>` : '',
        settings.showProfessional ? `<p><strong>Profissional:</strong> ${escapePrintHtml(receipt.professionalName || 'Não informado')}</p>` : '',
        `<p><strong>Data:</strong> ${escapePrintHtml(new Date(receipt.receivedAt || Date.now()).toLocaleString('pt-BR'))}</p>`,
      ].join('');
      const valueRows = [
        ['Valor original', money(receipt.originalAmount)],
        ['Valor base', money(receipt.enteredAmount)],
        ...(receipt.discountAmount > 0 ? [['Desconto', `- ${money(receipt.discountAmount)}`]] : []),
        ...(receipt.surchargeAmount > 0 ? [['Acréscimo', `+ ${money(receipt.surchargeAmount)}`]] : []),
        ['Total recebido', money(receipt.totalAmount)],
        ...(settings.showPayment ? [['Forma de pagamento', receipt.paymentMethod ? paymentLabel[receipt.paymentMethod] : 'Não informada']] : []),
        ...(settings.showPayment && receipt.paymentMethod === 'cash' ? [['Valor entregue', money(receipt.amountReceived)], ['Troco', money(receipt.changeAmount)]] : []),
      ].map(([label, value]) => `<div class="print-row"><span>${escapePrintHtml(label)}</span><strong>${escapePrintHtml(value)}</strong></div>`).join('');
      const bodyHtml = `${settings.showLogo ? '<h1 class="print-center">Navo Barber &amp; Club</h1>' : ''}<h2 class="print-center">Comprovante</h2><hr class="print-divider">${contextRows}<hr class="print-divider">${valueRows}${settings.showObservations && receipt.observations ? `<hr class="print-divider"><p><strong>Observações:</strong> ${escapePrintHtml(receipt.observations)}</p>` : ''}`;
      if (!openPrintWindow({ title: 'Comprovante', settings, format: settings.receiptFormat, bodyHtml })) {
        setError('A impressão foi bloqueada. Permita pop-ups e tente novamente.');
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível preparar a impressão.');
    }
  };

  const handleConfirmReceipt = async () => {
    if (!receipt) return;
    if (paymentMethod === 'cash' && calculation.amountReceived < calculation.total) {
      setError('O valor recebido deve ser igual ou superior ao total para pagamento em dinheiro.');
      return;
    }

    setIsConfirming(true);
    setError(null);
    try {
      const confirmed = await receiveReceiptInSupabase(receipt.id, {
        enteredAmount: calculation.entered,
        discountPercent: calculation.discountPercent,
        discountAmount: calculation.discountAmount,
        surchargePercent: calculation.surchargePercent,
        surchargeAmount: calculation.surchargeAmount,
        totalAmount: calculation.total,
        paymentMethod,
        amountReceived: calculation.amountReceived,
        changeAmount: calculation.change,
        observations: observations.trim() || null,
      });
      setReceipt(confirmed);
      onReceived(confirmed);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível confirmar.');
    } finally {
      setIsConfirming(false);
    }
  };

  const stepLabel = step === 'decision' ? 'Recebimento' : `Recebimento · Etapa ${step} de 3`;
  const isConfirmed = receipt?.status === 'received';
  const adjustmentSummary = calculation.discountAmount > 0 || calculation.surchargeAmount > 0
    ? [
        calculation.discountAmount > 0 ? `− ${money(calculation.discountAmount)}` : '',
        calculation.surchargeAmount > 0 ? `+ ${money(calculation.surchargeAmount)}` : '',
      ].filter(Boolean).join(' · ')
    : 'Sem ajustes';

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-5" role="dialog" aria-modal="true" aria-labelledby="receipt-dialog-title">
      <div ref={dialogRef} tabIndex={-1} className="admin-modal receipt-checkout-modal admin-preserve-depth w-full max-w-[420px] h-[100dvh] sm:h-auto sm:max-h-[90vh] bg-surface-card rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col">
        <div className="receipt-modal-header sticky top-0 z-10 shrink-0 flex items-start justify-between gap-4 p-6 pb-0 bg-surface-card">
          <div className="receipt-modal-title-group">
            <span className="receipt-modal-icon"><Clock3 className="h-[18px] w-[18px]" aria-hidden="true" /></span>
            <div className="min-w-0">
              <p className="receipt-modal-label">{stepLabel}</p>
              <h2 id="receipt-dialog-title" className="receipt-modal-title">{isConfirmed ? 'Recebimento confirmado' : 'Finalizar recebimento'}</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} className="receipt-close-button" aria-label="Fechar modal">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && <div className="mx-4 sm:mx-6 mt-4 p-3 rounded-xl border border-status-error/30 bg-status-error/10 text-status-error text-sm font-semibold" role="alert">{error}</div>}

        {!isConfirmed && <CheckoutProgress step={step} />}

        {step === 'decision' && (
          <div className="receipt-checkout-body min-h-0 flex-1 overflow-y-auto p-6 pt-5">
            <div className="p-4 rounded-xl bg-surface-base border border-border-subtle flex gap-3">
              <div className="w-10 h-10 rounded-xl bg-status-success/10 text-status-success flex items-center justify-center shrink-0"><CheckCircle2 className="w-5 h-5" /></div>
              <div className="min-w-0">
                <p className="font-bold text-content-base">Atendimento concluído.</p>
                <p className="mt-1 text-sm text-content-muted truncate">{source.serviceTitle} · {money(originalAmount)}</p>
              </div>
            </div>
            <div>
              <h3 className="text-base font-bold text-content-base">Registrar agora?</h3>
              <p className="mt-1 text-sm text-content-muted">Depois, ficará pendente em <strong className="text-content-base">Financeiro › Recebimentos</strong>.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button type="button" onClick={handleRegisterLater} disabled={isCreating} className="min-h-12 px-4 rounded-xl border border-border-subtle bg-surface-base text-content-base font-bold text-sm hover:bg-surface-elevated transition-colors disabled:opacity-50">
                {isCreating ? 'Criando…' : 'Registrar depois'}
              </button>
              <button type="button" onClick={handleRegisterNow} disabled={isCreating} className="min-h-12 px-4 rounded-xl bg-gold-base text-surface-base font-bold text-sm flex items-center justify-center gap-2 hover:bg-gold-hover transition-colors active:scale-[0.98] disabled:opacity-50">
                {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ReceiptText className="w-4 h-4" />}
                Registrar agora
              </button>
            </div>
          </div>
        )}

        {step === 1 && !isConfirmed && (
          <form className="receipt-checkout-body min-h-0 flex-1 overflow-y-auto p-6 pt-5" onKeyDown={handleEnterAsTab} onSubmit={(event) => { event.preventDefault(); setStep(2); }}>
            <CheckoutHero label="Valor do serviço" value={money(originalAmount)} meta={source.clientPhone ? `${source.clientName} · ${source.clientPhone}` : source.clientName} />
            <ServiceSummary title={source.serviceTitle} value={money(originalAmount)} />
            <label className="receipt-notes-field block">
              <span className="receipt-field-label">Observações</span>
              <input value={observations} onChange={(event) => setObservations(event.target.value)} placeholder="Ex.: pagar no próximo atendimento" className="receipt-minimal-input" />
            </label>
            <InlineNotice>Ao confirmar, o recebimento será marcado como recebido e entrará no extrato financeiro. Esta ação não poderá ser repetida.</InlineNotice>
            <div className="receipt-nav-row">
              <button type="button" onClick={onClose} className="receipt-nav-button">Voltar</button>
              <button type="submit" className="receipt-primary-button"><span>Revisar valores</span><ArrowRight className="w-4 h-4" /></button>
            </div>
          </form>
        )}

        {step === 2 && !isConfirmed && (
          <form className="receipt-checkout-body min-h-0 flex-1 overflow-y-auto p-6 pt-5" onKeyDown={handleEnterAsTab} onSubmit={(event) => { event.preventDefault(); setStep(3); }}>
            <CheckoutHero label="Valor do serviço" value={money(originalAmount)} meta={source.clientName} />

            <details open className="receipt-accordion">
              <summary className="receipt-accordion-summary">
                <span>Ajustes do valor</span>
                <span className="receipt-accordion-status"><span>{adjustmentSummary}</span><ChevronDown className="w-4 h-4" aria-hidden="true" /></span>
              </summary>
              <div className="receipt-accordion-body">
                <div className="receipt-adjust-grid">
                  <AdjustmentControl label="Desconto" mode={discountMode} value={discountValue} onModeChange={setDiscountMode} onValueChange={setDiscountValue} calculated={calculation.discountAmount} tone="negative" />
                  <AdjustmentControl label="Acréscimo" mode={surchargeMode} value={surchargeValue} onModeChange={setSurchargeMode} onValueChange={setSurchargeValue} calculated={calculation.surchargeAmount} tone="positive" />
                </div>
              </div>
            </details>

            <div className="receipt-total-bar"><span className="receipt-total-label">Valor total</span><strong className="receipt-total-value">{money(calculation.total)}</strong></div>

            <div className="receipt-payment-section">
              <div className="receipt-field-label">Forma de pagamento</div>
              <div role="radiogroup" aria-label="Forma de pagamento" className="receipt-payment-scroll">
                {paymentOptions.map((option) => {
                  const Icon = option.icon;
                  const selected = paymentMethod === option.id;
                  return <button key={option.id} type="button" role="radio" aria-checked={selected} onClick={() => setPaymentMethod(option.id)} className={`receipt-payment-chip min-h-10 rounded-full border px-3 flex items-center justify-center gap-1.5 text-xs font-bold transition-colors active:scale-[0.98] ${selected ? 'border-gold-base bg-gold-base/10 text-gold-hover' : 'border-border-subtle bg-surface-card text-content-muted hover:text-content-base'}`}><Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /><span className="truncate">{option.label}</span></button>;
                })}
              </div>
            </div>

            {paymentMethod === 'cash' && (
              <div className="receipt-cash-section">
                <p className="text-xs font-bold text-content-base flex items-center gap-2"><Banknote className="w-4 h-4 text-gold-base" /> Dinheiro e troco</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label><span className="text-xs font-bold text-content-muted block mb-1.5">Valor recebido</span><input type="number" min="0" step="0.01" value={cashReceived} onChange={(event) => setCashReceived(event.target.value)} className="w-full h-11 rounded-xl bg-surface-card border border-border-subtle px-3 text-sm font-mono font-bold text-content-base focus:outline-none focus:border-gold-base" /></label>
                  <div><span className="text-xs font-bold text-content-muted block mb-1.5">Troco</span><div className="h-11 rounded-xl bg-surface-card border border-border-subtle px-3 flex items-center text-sm font-mono font-bold finance-positive">{money(calculation.change)}</div></div>
                </div>
              </div>
            )}

            <InlineNotice>Ao confirmar, o recebimento entra no Extrato Financeiro e não poderá ser confirmado novamente.</InlineNotice>

            <div className="receipt-nav-row">
              <button type="button" onClick={() => setStep(1)} className="receipt-nav-button"><ArrowLeft className="w-4 h-4" />Voltar</button>
              <button type="submit" className="receipt-primary-button">Revisar pagamento<ArrowRight className="w-4 h-4" /></button>
            </div>
          </form>
        )}

        {step === 3 && !isConfirmed && (
          <div className="receipt-checkout-body min-h-0 flex-1 overflow-y-auto p-6 pt-5">
            <CheckoutHero label="Valor a receber" value={money(calculation.total)} meta={`${source.clientName} · ${paymentLabel[paymentMethod]}`} />
            <div className="receipt-review-card text-sm">
              <ReviewRow label="Cliente" value={source.clientName} />
              <ReviewRow label="Serviço" value={source.serviceTitle} />
              <ReviewRow label="Forma de pagamento" value={paymentLabel[paymentMethod]} />
              <ReviewRow label="Valor base" value={money(calculation.entered)} />
              {calculation.discountAmount > 0 && <ReviewRow label="Desconto" value={`− ${money(calculation.discountAmount)}`} tone="negative" />}
              {calculation.surchargeAmount > 0 && <ReviewRow label="Acréscimo" value={`+ ${money(calculation.surchargeAmount)}`} tone="positive" />}
              {paymentMethod === 'cash' && <ReviewRow label="Troco" value={money(calculation.change)} tone="positive" />}
              <div className="mt-2 border-t-2 border-border-subtle pt-2"><ReviewRow label="Valor total" value={money(calculation.total)} tone="positive" strong /></div>
            </div>
            <InlineNotice>Ao confirmar, o recebimento será marcado como recebido e entrará no extrato financeiro. Esta ação não poderá ser repetida para este atendimento.</InlineNotice>
            <div className="receipt-nav-row">
              <button type="button" onClick={() => setStep(2)} disabled={isConfirming} className="receipt-nav-button">Voltar</button>
              <button type="button" onClick={handleConfirmReceipt} disabled={isConfirming} className="receipt-primary-button bg-status-success disabled:opacity-50">{isConfirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}{isConfirming ? 'Confirmando…' : 'Confirmar pagamento'}</button>
            </div>
          </div>
        )}

        {isConfirmed && receipt && (
          <div className="receipt-checkout-body min-h-0 flex-1 overflow-y-auto p-6 pt-5">
            <div className="flex items-center justify-center gap-2 py-1 text-status-success"><CheckCircle2 className="h-5 w-5" aria-hidden="true" /><span className="text-sm font-bold">Recebimento confirmado</span></div>
            <CheckoutHero label="Valor recebido" value={money(receipt.totalAmount)} meta={`${receipt.clientName} · ${paymentLabel[receipt.paymentMethod || 'other']}`} />
            <div className="receipt-review-card text-sm">
              <div className="mb-1 flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-gold-base" aria-hidden="true" /><span className="font-bold text-content-base">Comprovante</span></div><strong className="shrink-0 text-xs font-mono text-content-muted">{receipt.id.slice(-8).toUpperCase()}</strong></div>
              <ReviewRow label="Cliente" value={receipt.clientName} />
              <ReviewRow label="Serviço" value={receipt.serviceTitle} />
              <ReviewRow label="Profissional" value={receipt.professionalName || 'Não informado'} />
              <ReviewRow label="Pagamento" value={paymentLabel[receipt.paymentMethod || 'other']} />
              <ReviewRow label="Total recebido" value={money(receipt.totalAmount)} tone="positive" strong />
              <ReviewRow label="Confirmado em" value={new Date(receipt.receivedAt || Date.now()).toLocaleString('pt-BR')} />
              {receipt.observations && <div className="mt-2 border-t border-border-subtle pt-2"><span className="text-xs text-content-muted">Observações</span><p className="mt-1 whitespace-pre-wrap text-sm text-content-base admin-safe-wrap">{receipt.observations}</p></div>}
            </div>
            <div className="receipt-nav-row">
              <button type="button" onClick={handlePrintReceipt} className="receipt-nav-button"><Printer className="w-4 h-4" />Imprimir</button>
              <button type="button" onClick={onClose} className="receipt-primary-button">Fechar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ReviewRow: React.FC<{ label: string; value: string; tone?: 'positive' | 'negative'; strong?: boolean }> = ({ label, value, tone, strong }) => (
  <div className="flex items-center justify-between gap-3 border-b border-border-subtle/70 py-2 last:border-b-0">
    <span className={`min-w-0 admin-safe-wrap ${strong ? 'font-bold text-content-base' : 'text-content-muted'}`}>{label}</span>
    <strong className={`shrink-0 text-right ${strong ? 'text-base' : 'text-sm'} ${tone === 'positive' ? 'finance-positive' : tone === 'negative' ? 'finance-negative' : 'text-content-base'}`}>{value}</strong>
  </div>
);

const CheckoutHero: React.FC<{ label: string; value: string; meta: string }> = ({ label, value, meta }) => (
  <div className="receipt-hero">
    <span className="receipt-hero-label">{label}</span>
    <strong className="receipt-hero-value">{value}</strong>
    <span className="receipt-hero-meta"><UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{meta}</span>
  </div>
);

const ServiceSummary: React.FC<{ title: string; value: string }> = ({ title, value }) => (
  <div className="receipt-service-row">
    <span className="receipt-service-icon"><ReceiptText className="w-4 h-4" aria-hidden="true" /></span>
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-bold text-content-base">{title}</p>
      <p className="mt-0.5 text-xs text-content-muted">Serviço · <span className="finance-positive font-bold">{value}</span></p>
    </div>
  </div>
);

const InlineNotice: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="receipt-inline-notice" role="note">
    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-warning" aria-hidden="true" />
    <span>{children}</span>
  </div>
);

const CheckoutProgress: React.FC<{ step: CheckoutStep }> = ({ step }) => {
  if (typeof step !== 'number') return null;
  const items = [
    { id: 1, label: 'Dados' },
    { id: 2, label: 'Valores' },
    { id: 3, label: 'Confirmar' },
  ];

  return (
    <div className="receipt-progress" aria-label={`Etapa ${step} de 3`}>
      <div className="flex items-center gap-2">
        {items.map((item, index) => (
          <React.Fragment key={item.id}>
            <span className={`receipt-progress-dot ${step >= item.id ? 'is-done' : ''} ${step === item.id ? 'is-active' : ''}`} aria-label={item.label} />
            {index < items.length - 1 && <span className={`receipt-progress-line ${step > item.id ? 'is-done' : ''}`} aria-hidden="true" />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

interface AdjustmentControlProps {
  label: string;
  mode: AdjustmentMode;
  value: string;
  calculated: number;
  tone: 'positive' | 'negative';
  onModeChange: (mode: AdjustmentMode) => void;
  onValueChange: (value: string) => void;
}

const AdjustmentControl: React.FC<AdjustmentControlProps> = ({ label, mode, value, calculated, tone, onModeChange, onValueChange }) => (
  <div className="receipt-adjust-control min-w-0 space-y-2">
    <div className="flex items-center justify-between gap-2"><span className="min-w-0 truncate text-xs text-content-muted">{label}</span><span className={`shrink-0 text-[11px] font-medium ${tone === 'negative' ? 'finance-negative' : 'finance-positive'}`}>{tone === 'negative' ? '-' : '+'} {money(calculated)}</span></div>
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2"><div className="flex h-9 rounded-lg border border-border-subtle overflow-hidden"><button type="button" onClick={() => onModeChange('percent')} aria-pressed={mode === 'percent'} className={`w-9 text-xs font-bold transition-colors ${mode === 'percent' ? 'bg-gold-base text-surface-base' : 'text-content-muted hover:bg-surface-card'}`}>%</button><button type="button" onClick={() => onModeChange('amount')} aria-pressed={mode === 'amount'} className={`w-9 text-xs font-bold border-l border-border-subtle transition-colors ${mode === 'amount' ? 'bg-gold-base text-surface-base' : 'text-content-muted hover:bg-surface-card'}`}>R$</button></div><input aria-label={`${label} em ${mode === 'percent' ? 'percentual' : 'valor'}`} type="number" min="0" max={mode === 'percent' ? 100 : undefined} step="0.01" value={value} onChange={(event) => onValueChange(event.target.value)} className="h-9 min-w-0 rounded-lg bg-surface-card border border-border-subtle px-2.5 text-sm font-mono font-bold text-content-base focus:outline-none focus:border-gold-base" /></div>
  </div>
);
