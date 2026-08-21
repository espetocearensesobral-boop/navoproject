import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  CreditCard,
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

  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;
    const adminMain = document.querySelector<HTMLElement>('.admin-shell main');
    const previous = {
      bodyOverflow: body.style.overflow,
      bodyOverscroll: body.style.overscrollBehavior,
      htmlOverflow: html.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
      mainOverflow: adminMain?.style.overflow || '',
      mainOverscroll: adminMain?.style.overscrollBehavior || '',
      mainTouchAction: adminMain?.style.touchAction || '',
    };

    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';
    html.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';
    if (adminMain) {
      adminMain.style.overflow = 'hidden';
      adminMain.style.overscrollBehavior = 'none';
      adminMain.style.touchAction = 'none';
    }

    return () => {
      body.style.overflow = previous.bodyOverflow;
      body.style.overscrollBehavior = previous.bodyOverscroll;
      html.style.overflow = previous.htmlOverflow;
      html.style.overscrollBehavior = previous.htmlOverscroll;
      if (adminMain) {
        adminMain.style.overflow = previous.mainOverflow;
        adminMain.style.overscrollBehavior = previous.mainOverscroll;
        adminMain.style.touchAction = previous.mainTouchAction;
      }
    };
  }, []);

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

  return createPortal(
    <div className="receipt-v2-overlay" role="dialog" aria-modal="true" aria-labelledby="receipt-dialog-title">
      <div ref={dialogRef} tabIndex={-1} className="receipt-v2-dialog">
        <header className="receipt-v2-header">
          <div className="receipt-v2-title-group">
            <span className="receipt-v2-header-icon"><Clock3 aria-hidden="true" /></span>
            <div className="receipt-v2-title-copy">
              <p className="receipt-v2-label">{stepLabel}</p>
              <h2 id="receipt-dialog-title" className="receipt-v2-title">{isConfirmed ? 'Recebimento confirmado' : 'Finalizar recebimento'}</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} className="receipt-v2-close" aria-label="Fechar modal"><X aria-hidden="true" /></button>
        </header>

        {!isConfirmed && <CheckoutProgress step={step} />}

        <div className="receipt-v2-scroll">
          {error && <div className="receipt-v2-error" role="alert">{error}</div>}

          {step === 'decision' && (
            <div className="receipt-v2-content receipt-v2-decision">
              <div className="receipt-v2-decision-card">
                <span className="receipt-v2-decision-icon"><CheckCircle2 aria-hidden="true" /></span>
                <div>
                  <strong>Atendimento concluído.</strong>
                  <p>{source.serviceTitle} · {money(originalAmount)}</p>
                </div>
              </div>
              <div className="receipt-v2-decision-copy">
                <h3>Registrar agora?</h3>
                <p>Depois, ficará pendente em <strong>Financeiro › Recebimentos</strong>.</p>
              </div>
              <div className="receipt-v2-decision-actions">
                <button type="button" onClick={handleRegisterLater} disabled={isCreating} className="receipt-v2-secondary">{isCreating ? 'Criando…' : 'Registrar depois'}</button>
                <button type="button" onClick={handleRegisterNow} disabled={isCreating} className="receipt-v2-primary">{isCreating ? <Loader2 className="receipt-v2-button-icon receipt-v2-spin" /> : <ReceiptText className="receipt-v2-button-icon" />}Registrar agora</button>
              </div>
            </div>
          )}

          {step === 1 && !isConfirmed && (
            <form className="receipt-v2-content" onKeyDown={handleEnterAsTab} onSubmit={(event) => { event.preventDefault(); setStep(2); }}>
              <CheckoutHero label="Valor do serviço" value={money(originalAmount)} meta={source.clientPhone ? `${source.clientName} · ${source.clientPhone}` : source.clientName} />
              <ServiceSummary title={source.serviceTitle} value={money(originalAmount)} />
              <label className="receipt-v2-notes-field">
                <span className="receipt-v2-field-label">Observações</span>
                <input value={observations} onChange={(event) => setObservations(event.target.value)} placeholder="Ex.: pagar no próximo atendimento" className="receipt-v2-minimal-input" />
              </label>
              <InlineNotice>Ao confirmar, o recebimento será marcado como recebido e entrará no extrato financeiro. Esta ação não poderá ser repetida.</InlineNotice>
              <CheckoutNav onBack={onClose} primaryLabel="Revisar valores" primaryIcon={<ArrowRight aria-hidden="true" />} />
            </form>
          )}

          {step === 2 && !isConfirmed && (
            <form className="receipt-v2-content" onKeyDown={handleEnterAsTab} onSubmit={(event) => { event.preventDefault(); setStep(3); }}>
              <CheckoutHero label="Valor do serviço" value={money(originalAmount)} meta={source.clientName} />
              <details className="receipt-v2-accordion">
                <summary className="receipt-v2-accordion-summary">
                  <span>Ajustes do valor</span>
                  <span className="receipt-v2-summary-right"><span>{adjustmentSummary}</span><ChevronDown aria-hidden="true" /></span>
                </summary>
                <div className="receipt-v2-accordion-body">
                  <div className="receipt-v2-adjust-grid">
                    <AdjustmentControl label="Desconto" mode={discountMode} value={discountValue} onModeChange={setDiscountMode} onValueChange={setDiscountValue} calculated={calculation.discountAmount} tone="negative" />
                    <AdjustmentControl label="Acréscimo" mode={surchargeMode} value={surchargeValue} onModeChange={setSurchargeMode} onValueChange={setSurchargeValue} calculated={calculation.surchargeAmount} tone="positive" />
                  </div>
                </div>
              </details>
              <div className="receipt-v2-total"><span>Valor total</span><strong>{money(calculation.total)}</strong></div>
              <div className="receipt-v2-payment">
                <span className="receipt-v2-field-label">Forma de pagamento</span>
                <div className="receipt-v2-payment-scroll" role="radiogroup" aria-label="Forma de pagamento">
                  {paymentOptions.map((option) => {
                    const Icon = option.icon;
                    const selected = paymentMethod === option.id;
                    return <button key={option.id} type="button" role="radio" aria-checked={selected} onClick={() => setPaymentMethod(option.id)} className={`receipt-v2-payment-chip ${selected ? 'is-selected' : ''}`}><Icon aria-hidden="true" /><span>{option.label}</span></button>;
                  })}
                </div>
              </div>
              {paymentMethod === 'cash' && (
                <div className="receipt-v2-cash">
                  <p><Banknote aria-hidden="true" />Dinheiro e troco</p>
                  <div className="receipt-v2-cash-grid">
                    <label><span>Valor recebido</span><input type="number" min="0" step="0.01" value={cashReceived} onChange={(event) => setCashReceived(event.target.value)} /></label>
                    <div><span>Troco</span><strong>{money(calculation.change)}</strong></div>
                  </div>
                </div>
              )}
              <InlineNotice>Ao confirmar, o recebimento entra no Extrato Financeiro e não poderá ser confirmado novamente.</InlineNotice>
              <CheckoutNav onBack={() => setStep(1)} primaryLabel="Revisar pagamento" primaryIcon={<ArrowRight aria-hidden="true" />} />
            </form>
          )}

          {step === 3 && !isConfirmed && (
            <div className="receipt-v2-content">
              <CheckoutHero label="Valor a receber" value={money(calculation.total)} meta={`${source.clientName} · ${paymentLabel[paymentMethod]}`} />
              <div className="receipt-v2-review">
                <ReviewRow label="Cliente" value={source.clientName} />
                <ReviewRow label="Serviço" value={source.serviceTitle} />
                <ReviewRow label="Forma de pagamento" value={paymentLabel[paymentMethod]} />
                <ReviewRow label="Valor base" value={money(calculation.entered)} />
                {calculation.discountAmount > 0 && <ReviewRow label="Desconto" value={`− ${money(calculation.discountAmount)}`} tone="negative" />}
                {calculation.surchargeAmount > 0 && <ReviewRow label="Acréscimo" value={`+ ${money(calculation.surchargeAmount)}`} tone="positive" />}
                {paymentMethod === 'cash' && <ReviewRow label="Troco" value={money(calculation.change)} tone="positive" />}
                <div className="receipt-v2-review-total"><ReviewRow label="Valor total" value={money(calculation.total)} tone="positive" strong /></div>
              </div>
              <InlineNotice>Ao confirmar, o recebimento será marcado como recebido. Esta ação não poderá ser repetida para este atendimento.</InlineNotice>
              <CheckoutNav onBack={() => setStep(2)} primaryLabel={isConfirming ? 'Confirmando…' : 'Confirmar pagamento'} primaryIcon={isConfirming ? <Loader2 className="receipt-v2-spin" aria-hidden="true" /> : <ClipboardCheck aria-hidden="true" />} onPrimary={handleConfirmReceipt} disabled={isConfirming} />
            </div>
          )}

          {isConfirmed && receipt && (
            <div className="receipt-v2-content">
              <div className="receipt-v2-success"><CheckCircle2 aria-hidden="true" /><strong>Recebimento confirmado</strong></div>
              <CheckoutHero label="Valor recebido" value={money(receipt.totalAmount)} meta={`${receipt.clientName} · ${paymentLabel[receipt.paymentMethod || 'other']}`} />
              <div className="receipt-v2-review">
                <div className="receipt-v2-receipt-heading"><span><FileText aria-hidden="true" />Comprovante</span><strong>{receipt.id.slice(-8).toUpperCase()}</strong></div>
                <ReviewRow label="Cliente" value={receipt.clientName} />
                <ReviewRow label="Serviço" value={receipt.serviceTitle} />
                <ReviewRow label="Profissional" value={receipt.professionalName || 'Não informado'} />
                <ReviewRow label="Pagamento" value={paymentLabel[receipt.paymentMethod || 'other']} />
                <ReviewRow label="Total recebido" value={money(receipt.totalAmount)} tone="positive" strong />
                <ReviewRow label="Confirmado em" value={new Date(receipt.receivedAt || Date.now()).toLocaleString('pt-BR')} />
                {receipt.observations && <div className="receipt-v2-observations"><span>Observações</span><p>{receipt.observations}</p></div>}
              </div>
              <div className="receipt-v2-actions">
                <button type="button" onClick={handlePrintReceipt} className="receipt-v2-secondary"><Printer aria-hidden="true" />Imprimir</button>
                <button type="button" onClick={onClose} className="receipt-v2-primary">Fechar</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

const CheckoutNav: React.FC<{
  onBack: () => void;
  primaryLabel: string;
  primaryIcon?: React.ReactNode;
  onPrimary?: () => void;
  disabled?: boolean;
}> = ({ onBack, primaryLabel, primaryIcon, onPrimary, disabled = false }) => (
  <div className="receipt-v2-actions">
    <button type="button" onClick={onBack} disabled={disabled} className="receipt-v2-secondary"><ArrowLeft aria-hidden="true" />Voltar</button>
    <button type={onPrimary ? 'button' : 'submit'} onClick={onPrimary} disabled={disabled} className="receipt-v2-primary">{primaryLabel}{primaryIcon}</button>
  </div>
);

const ReviewRow: React.FC<{ label: string; value: string; tone?: 'positive' | 'negative'; strong?: boolean }> = ({ label, value, tone, strong }) => (
  <div className="receipt-v2-review-row">
    <span className={strong ? 'is-strong' : ''}>{label}</span>
    <strong className={`${strong ? 'is-strong' : ''} ${tone === 'positive' ? 'is-positive' : tone === 'negative' ? 'is-negative' : ''}`}>{value}</strong>
  </div>
);

const CheckoutHero: React.FC<{ label: string; value: string; meta: string }> = ({ label, value, meta }) => (
  <div className="receipt-v2-hero">
    <span className="receipt-v2-hero-label">{label}</span>
    <strong className="receipt-v2-hero-value">{value}</strong>
    <span className="receipt-v2-hero-meta"><UserRound aria-hidden="true" />{meta}</span>
  </div>
);

const ServiceSummary: React.FC<{ title: string; value: string }> = ({ title, value }) => (
  <div className="receipt-v2-service">
    <span className="receipt-v2-service-icon"><ReceiptText aria-hidden="true" /></span>
    <div>
      <strong>{title}</strong>
      <span>Serviço · <b>{value}</b></span>
    </div>
  </div>
);

const InlineNotice: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="receipt-v2-notice" role="note"><Info aria-hidden="true" /><span>{children}</span></div>
);

const CheckoutProgress: React.FC<{ step: CheckoutStep }> = ({ step }) => {
  if (typeof step !== 'number') return null;
  return (
    <div className="receipt-v2-progress" aria-label={`Etapa ${step} de 3`}>
      {[1, 2, 3].map((item, index) => (
        <React.Fragment key={item}>
          <span className={`receipt-v2-progress-dot ${step >= item ? 'is-done' : ''} ${step === item ? 'is-active' : ''}`} aria-label={['Dados', 'Valores', 'Confirmar'][index]} />
          {index < 2 && <span className={`receipt-v2-progress-line ${step > item ? 'is-done' : ''}`} aria-hidden="true" />}
        </React.Fragment>
      ))}
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
  <div className="receipt-v2-adjustment">
    <div className="receipt-v2-adjustment-label"><span>{label}</span><b className={tone === 'negative' ? 'is-negative' : 'is-positive'}>{tone === 'negative' ? '−' : '+'} {money(calculated)}</b></div>
    <div className="receipt-v2-adjustment-input">
      <div className="receipt-v2-mode-toggle">
        <button type="button" onClick={() => onModeChange('percent')} aria-pressed={mode === 'percent'}>%</button>
        <button type="button" onClick={() => onModeChange('amount')} aria-pressed={mode === 'amount'}>R$</button>
      </div>
      <input aria-label={`${label} em ${mode === 'percent' ? 'percentual' : 'valor'}`} type="number" min="0" max={mode === 'percent' ? 100 : undefined} step="0.01" value={value} onChange={(event) => onValueChange(event.target.value)} />
    </div>
  </div>
);
