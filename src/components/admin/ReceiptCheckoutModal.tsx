import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  FileText,
  Loader2,
  Percent,
  Printer,
  QrCode,
  ReceiptText,
  UserRound,
  WalletCards,
  X,
} from 'lucide-react';
import { handleEnterAsTab } from '../../utils/formUtils';
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
      const message = requestError instanceof Error ? requestError.message : 'Não foi possível criar o recebimento pendente.';
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
      const bodyHtml = `${settings.showLogo ? '<h1 class="print-center">Navo Barber &amp; Club</h1>' : ''}<h2 class="print-center">Comprovante de recebimento</h2><hr class="print-divider">${contextRows}<hr class="print-divider">${valueRows}${settings.showObservations && receipt.observations ? `<hr class="print-divider"><p><strong>Observações:</strong> ${escapePrintHtml(receipt.observations)}</p>` : ''}`;
      if (!openPrintWindow({ title: 'Comprovante de recebimento', settings, format: settings.receiptFormat, bodyHtml })) {
        setError('O comprovante foi bloqueado pelo navegador. Permita pop-ups para este site e tente novamente.');
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível preparar o comprovante para impressão.');
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
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível confirmar o recebimento.');
    } finally {
      setIsConfirming(false);
    }
  };

  const stepLabel = step === 'decision' ? 'Conclusão do atendimento' : `Recebimento · Etapa ${step} de 3`;
  const isConfirmed = receipt?.status === 'received';

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-5" role="dialog" aria-modal="true" aria-label="Registrar recebimento">
      <div className="admin-modal w-full max-w-5xl h-[100dvh] sm:h-auto sm:max-h-[94dvh] bg-surface-card border border-border-subtle rounded-none sm:rounded-2xl shadow-2xl overflow-y-auto flex flex-col">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 p-5 sm:p-6 bg-surface-card border-b border-border-subtle">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-gold-base">{stepLabel}</p>
            <h2 className="mt-1 text-lg sm:text-xl font-serif font-bold text-content-base">{isConfirmed ? 'Recebimento confirmado' : 'Finalizar recebimento'}</h2>
          </div>
          <button type="button" onClick={onClose} className="w-10 h-10 rounded-xl flex items-center justify-center text-content-muted hover:text-content-base hover:bg-surface-base transition-colors" aria-label="Fechar modal">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && <div className="mx-5 sm:mx-6 mt-5 p-3 rounded-xl border border-status-error/30 bg-status-error/10 text-status-error text-sm font-semibold">{error}</div>}

        {step === 'decision' && (
          <div className="p-5 sm:p-6 space-y-5">
            <div className="p-4 rounded-xl bg-surface-base border border-border-subtle flex gap-3">
              <div className="w-10 h-10 rounded-xl bg-status-success/10 text-status-success flex items-center justify-center shrink-0"><CheckCircle2 className="w-5 h-5" /></div>
              <div className="min-w-0">
                <p className="font-bold text-content-base">Atendimento de {source.clientName} concluído.</p>
                <p className="mt-1 text-sm text-content-muted truncate">{source.serviceTitle} · {money(originalAmount)}</p>
              </div>
            </div>
            <div>
              <h3 className="text-base font-bold text-content-base">Deseja registrar o recebimento agora?</h3>
              <p className="mt-1 text-sm text-content-muted">Caso deixe para depois, o atendimento será enviado para <strong className="text-content-base">Financeiro › Recebimentos</strong> como pendente.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button type="button" onClick={handleRegisterLater} disabled={isCreating} className="min-h-12 px-4 rounded-xl border border-border-subtle bg-surface-base text-content-base font-bold text-sm hover:bg-surface-elevated transition-colors disabled:opacity-50">
                {isCreating ? 'Criando pendência…' : 'Registrar depois'}
              </button>
              <button type="button" onClick={handleRegisterNow} disabled={isCreating} className="min-h-12 px-4 rounded-xl bg-gold-base text-surface-base font-bold text-sm flex items-center justify-center gap-2 hover:bg-gold-hover transition-colors active:scale-[0.98] disabled:opacity-50">
                {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ReceiptText className="w-4 h-4" />}
                Registrar agora
              </button>
            </div>
          </div>
        )}

        {step === 1 && !isConfirmed && (
          <form className="p-5 sm:p-8 space-y-6" onKeyDown={handleEnterAsTab} onSubmit={(event) => { event.preventDefault(); setStep(2); }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-surface-base border border-border-subtle">
                <span className="text-xs font-bold uppercase tracking-wider text-content-muted flex items-center gap-1.5"><UserRound className="w-3.5 h-3.5 text-gold-base" /> Cliente</span>
                <p className="mt-2 text-sm font-bold text-content-base truncate">{source.clientName}</p>
                {source.clientPhone && <p className="mt-0.5 text-xs text-content-muted">{source.clientPhone}</p>}
              </div>
              <div className="p-4 rounded-xl bg-surface-base border border-border-subtle">
                <span className="text-xs font-bold uppercase tracking-wider text-content-muted flex items-center gap-1.5"><ReceiptText className="w-3.5 h-3.5 text-gold-base" /> Serviço concluído</span>
                <p className="mt-2 text-sm font-bold text-content-base truncate">{source.serviceTitle}</p>
                <p className="mt-0.5 text-xs finance-positive font-bold">{money(originalAmount)}</p>
              </div>
            </div>
            <div>
              <label className="text-sm font-bold text-content-base block mb-2">Observações do recebimento</label>
              <textarea value={observations} onChange={(event) => setObservations(event.target.value)} rows={4} placeholder="Ex.: cliente pagará junto ao próximo atendimento" className="w-full rounded-xl bg-surface-base border border-border-subtle px-3 py-3 text-sm text-content-base placeholder:text-content-muted focus:outline-none focus:border-gold-base resize-none" />
            </div>
            <div className="pt-4 border-t border-border-subtle flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
              <button type="button" onClick={onClose} className="h-11 px-5 rounded-xl text-sm font-bold text-content-muted hover:text-content-base">Fechar</button>
              <button type="submit" className="h-11 px-5 rounded-xl bg-gold-base text-surface-base text-sm font-bold flex items-center justify-center gap-2"><span>Revisar valores</span><ArrowRight className="w-4 h-4" /></button>
            </div>
          </form>
        )}

        {step === 2 && !isConfirmed && (
          <form className="p-5 sm:p-8 space-y-6" onKeyDown={handleEnterAsTab} onSubmit={(event) => { event.preventDefault(); setStep(3); }}>
            <div className="p-5 rounded-2xl bg-surface-base border border-border-subtle flex items-center justify-between gap-4">
              <div><span className="text-xs font-bold uppercase tracking-wider text-content-muted">Valor do serviço</span><p className="mt-1 text-sm text-content-muted">Base usada para os ajustes do recebimento</p></div>
              <span className="text-2xl font-mono font-bold finance-positive shrink-0">{money(originalAmount)}</span>
            </div>

            <div>
              <div className="flex items-center justify-between gap-3 mb-3"><h3 className="text-sm font-bold text-content-base">Ajustes do valor</h3><span className="text-xs text-content-muted">Aplicados sobre o valor do serviço</span></div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <AdjustmentControl label="Desconto" mode={discountMode} value={discountValue} onModeChange={setDiscountMode} onValueChange={setDiscountValue} calculated={calculation.discountAmount} tone="negative" />
              <AdjustmentControl label="Acréscimo" mode={surchargeMode} value={surchargeValue} onModeChange={setSurchargeMode} onValueChange={setSurchargeValue} calculated={calculation.surchargeAmount} tone="positive" />
            </div>

            </div>

            <div className="p-5 rounded-2xl border border-gold-base/30 bg-gold-base/10 flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-content-base">Valor total</span>
              <span className="text-2xl font-mono font-bold finance-positive">{money(calculation.total)}</span>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-bold text-content-base">Forma de pagamento</p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {paymentOptions.map((option) => {
                  const Icon = option.icon;
                  const selected = paymentMethod === option.id;
                  return <button key={option.id} type="button" onClick={() => setPaymentMethod(option.id)} className={`min-h-16 rounded-xl border flex flex-col items-center justify-center gap-1.5 text-xs font-bold transition-colors ${selected ? 'border-gold-base bg-gold-base/10 text-gold-hover' : 'border-border-subtle bg-surface-base text-content-muted hover:text-content-base'}`}><Icon className="w-4 h-4" />{option.label}</button>;
                })}
              </div>
            </div>

            {paymentMethod === 'cash' && (
              <div className="p-4 rounded-xl bg-surface-base border border-border-subtle space-y-3">
                <p className="text-sm font-bold text-content-base flex items-center gap-2"><Banknote className="w-4 h-4 text-gold-base" /> Dinheiro e troco</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label><span className="text-xs font-bold text-content-muted block mb-1.5">Valor recebido</span><input type="number" min="0" step="0.01" value={cashReceived} onChange={(event) => setCashReceived(event.target.value)} className="w-full h-11 rounded-xl bg-surface-card border border-border-subtle px-3 text-sm font-mono font-bold text-content-base focus:outline-none focus:border-gold-base" /></label>
                  <div><span className="text-xs font-bold text-content-muted block mb-1.5">Troco</span><div className="h-11 rounded-xl bg-surface-card border border-border-subtle px-3 flex items-center text-sm font-mono font-bold finance-positive">{money(calculation.change)}</div></div>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-border-subtle flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
              <button type="button" onClick={() => setStep(1)} className="h-11 px-5 rounded-xl text-sm font-bold text-content-muted hover:text-content-base flex items-center justify-center gap-2"><ArrowLeft className="w-4 h-4" />Voltar</button>
              <button type="submit" className="h-11 px-5 rounded-xl bg-gold-base text-surface-base text-sm font-bold flex items-center justify-center gap-2">Revisar confirmação<ArrowRight className="w-4 h-4" /></button>
            </div>
          </form>
        )}

        {step === 3 && !isConfirmed && (
          <div className="p-5 sm:p-6 space-y-5">
            <div className="p-4 rounded-xl bg-surface-base border border-border-subtle space-y-3">
              <div className="flex items-center justify-between gap-3"><span className="text-sm font-bold text-content-base">{source.clientName}</span><span className="text-sm font-bold finance-positive">{money(calculation.total)}</span></div>
              <p className="text-sm text-content-muted">{source.serviceTitle} · {paymentLabel[paymentMethod]}</p>
              <div className="pt-3 border-t border-border-subtle grid grid-cols-2 gap-y-2 text-xs"><span className="text-content-muted">Valor base</span><strong className="text-right text-content-base">{money(calculation.entered)}</strong>{calculation.discountAmount > 0 && <><span className="text-content-muted">Desconto</span><strong className="text-right finance-negative">- {money(calculation.discountAmount)}</strong></>}{calculation.surchargeAmount > 0 && <><span className="text-content-muted">Acréscimo</span><strong className="text-right finance-positive">+ {money(calculation.surchargeAmount)}</strong></>}{paymentMethod === 'cash' && <><span className="text-content-muted">Troco</span><strong className="text-right finance-positive">{money(calculation.change)}</strong></>}</div>
            </div>
            <p className="text-sm text-content-muted">Ao confirmar, o recebimento será marcado como recebido e entrará no extrato financeiro. Esta ação não poderá ser repetida para este atendimento.</p>
            <div className="pt-4 border-t border-border-subtle flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
              <button type="button" onClick={() => setStep(2)} disabled={isConfirming} className="h-11 px-5 rounded-xl text-sm font-bold text-content-muted hover:text-content-base">Voltar</button>
              <button type="button" onClick={handleConfirmReceipt} disabled={isConfirming} className="h-11 px-5 rounded-xl bg-status-success text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">{isConfirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}{isConfirming ? 'Confirmando…' : 'Confirmar recebimento'}</button>
            </div>
          </div>
        )}

        {isConfirmed && receipt && (
          <div className="p-5 sm:p-6 space-y-5">
            <div className="text-center py-3"><span className="mx-auto w-14 h-14 rounded-full bg-status-success/15 text-status-success flex items-center justify-center"><CheckCircle2 className="w-7 h-7" /></span><h3 className="mt-3 text-lg font-bold text-content-base">Recebimento fechado</h3><p className="mt-1 text-sm text-content-muted">{money(receipt.totalAmount)} registrado em {paymentLabel[receipt.paymentMethod || 'other']}.</p></div>
            <div className="p-5 rounded-2xl bg-surface-base border border-border-subtle text-sm space-y-3"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><FileText className="w-4 h-4 text-gold-base" /><span className="font-bold text-content-base">Comprovante de recebimento</span></div><strong className="text-content-muted font-mono text-xs">{receipt.id.slice(-8).toUpperCase()}</strong></div><div className="pt-3 border-t border-border-subtle grid grid-cols-1 sm:grid-cols-2 gap-2"><div><span className="text-xs text-content-muted">Cliente</span><p className="font-bold text-content-base">{receipt.clientName}</p></div><div><span className="text-xs text-content-muted">Serviço</span><p className="font-bold text-content-base">{receipt.serviceTitle}</p></div><div><span className="text-xs text-content-muted">Profissional</span><p className="font-bold text-content-base">{receipt.professionalName || 'Não informado'}</p></div><div><span className="text-xs text-content-muted">Pagamento</span><p className="font-bold text-content-base">{paymentLabel[receipt.paymentMethod || 'other']}</p></div><div><span className="text-xs text-content-muted">Total recebido</span><p className="font-mono font-bold finance-positive">{money(receipt.totalAmount)}</p></div><div><span className="text-xs text-content-muted">Confirmado em</span><p className="font-bold text-content-base">{new Date(receipt.receivedAt || Date.now()).toLocaleString('pt-BR')}</p></div></div>{receipt.observations && <div className="pt-3 border-t border-border-subtle"><span className="text-xs text-content-muted">Observações</span><p className="mt-1 text-content-base">{receipt.observations}</p></div>}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2"><button type="button" onClick={handlePrintReceipt} className="h-11 rounded-xl border border-border-subtle bg-surface-base text-content-base text-sm font-bold flex items-center justify-center gap-2"><Printer className="w-4 h-4" />Imprimir comprovante</button><button type="button" onClick={onClose} className="h-11 rounded-xl bg-gold-base text-surface-base text-sm font-bold">Fechar</button></div>
          </div>
        )}
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
  <div className="p-4 rounded-xl bg-surface-base border border-border-subtle space-y-3">
    <div className="flex items-center justify-between gap-2"><span className="text-sm font-bold text-content-base flex items-center gap-1.5"><Percent className={`w-4 h-4 ${tone === 'negative' ? 'text-status-error' : 'text-status-success'}`} />{label}</span><span className={`text-xs font-bold ${tone === 'negative' ? 'finance-negative' : 'finance-positive'}`}>{tone === 'negative' ? '-' : '+'} {money(calculated)}</span></div>
    <div className="grid grid-cols-[auto_1fr] gap-2"><div className="flex rounded-lg border border-border-subtle overflow-hidden"><button type="button" onClick={() => onModeChange('percent')} className={`w-9 text-xs font-bold ${mode === 'percent' ? 'bg-gold-base text-surface-base' : 'text-content-muted hover:bg-surface-card'}`}>%</button><button type="button" onClick={() => onModeChange('amount')} className={`w-9 text-xs font-bold border-l border-border-subtle ${mode === 'amount' ? 'bg-gold-base text-surface-base' : 'text-content-muted hover:bg-surface-card'}`}>R$</button></div><input type="number" min="0" max={mode === 'percent' ? 100 : undefined} step="0.01" value={value} onChange={(event) => onValueChange(event.target.value)} className="h-10 rounded-lg bg-surface-card border border-border-subtle px-3 text-sm font-mono font-bold text-content-base focus:outline-none focus:border-gold-base" /></div>
  </div>
);
