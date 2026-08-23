import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  FileText,
  Info,
  Loader2,
  Printer,
  QrCode,
  ReceiptText,
  Share2,
  Tag,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import { handleEnterAsTab } from "../../utils/formUtils";
import { useDialogFocus } from "../../hooks/useDialogFocus";
import { useModalScrollLock } from "../../hooks/useModalScrollLock";
import {
  createReceiptInSupabase,
  receiveReceiptInSupabase,
  type ReceiptItem,
  type ReceiptPaymentMethod,
} from "../../services/supabaseDataService";
import {
  defaultPrintSettings,
  fetchPrintSettings,
} from "../../services/printSettingsService";
import { escapePrintHtml, openPrintWindow } from "../../utils/printUtils";

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

type CheckoutStep = "decision" | 1 | 2;
type AdjustmentMode = "percent" | "amount";

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0);

const parseMoney = (value: string) => {
  const normalized = value.replace(",", ".").replace(/[^\d.]/g, "");
  return Math.max(0, Number(normalized) || 0);
};

const paymentOptions: {
  id: ReceiptPaymentMethod;
  label: string;
  icon: React.ElementType;
}[] = [
  { id: "pix", label: "PIX", icon: QrCode },
  { id: "credit_card", label: "Crédito", icon: CreditCard },
  { id: "debit_card", label: "Débito", icon: WalletCards },
  { id: "cash", label: "Dinheiro", icon: Banknote },
  { id: "other", label: "Outro", icon: ReceiptText },
];

const paymentLabel: Record<ReceiptPaymentMethod, string> = {
  pix: "PIX",
  credit_card: "Cartão de Crédito",
  debit_card: "Cartão de Débito",
  cash: "Dinheiro",
  other: "Outro meio",
};

export const ReceiptCheckoutModal: React.FC<ReceiptCheckoutModalProps> = ({
  source,
  initialReceipt = null,
  onClose,
  onPending,
  onReceived,
}) => {
  const originalAmount = Math.max(0, Number(source.servicePrice || 0));
  const [step, setStep] = useState<CheckoutStep>(
    initialReceipt ? 1 : "decision",
  );
  const [receipt, setReceipt] = useState<ReceiptItem | null>(initialReceipt);
  const [observations, setObservations] = useState(
    initialReceipt?.observations || "",
  );
  const [discountMode, setDiscountMode] = useState<AdjustmentMode>("percent");
  const [discountValue, setDiscountValue] = useState(
    initialReceipt ? initialReceipt.discountPercent.toFixed(2) : "0",
  );
  const [surchargeMode, setSurchargeMode] = useState<AdjustmentMode>("percent");
  const [surchargeValue, setSurchargeValue] = useState(
    initialReceipt ? initialReceipt.surchargePercent.toFixed(2) : "0",
  );
  const [paymentMethod, setPaymentMethod] = useState<ReceiptPaymentMethod>(
    initialReceipt?.paymentMethod || "pix",
  );
  const [cashReceived, setCashReceived] = useState(
    (initialReceipt?.amountReceived || originalAmount).toFixed(2),
  );
  const [isCreating, setIsCreating] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(true, dialogRef);
  useModalScrollLock(true);

  const calculation = useMemo(() => {
    const entered = Math.max(
      0,
      Number(initialReceipt?.enteredAmount ?? originalAmount),
    );
    const discountRaw = parseMoney(discountValue);
    const surchargeRaw = parseMoney(surchargeValue);
    const discountPercent =
      discountMode === "percent"
        ? Math.min(100, discountRaw)
        : entered > 0
          ? (discountRaw / entered) * 100
          : 0;
    const discountAmount =
      discountMode === "percent"
        ? entered * (discountPercent / 100)
        : Math.min(entered, discountRaw);
    const surchargePercent =
      surchargeMode === "percent"
        ? surchargeRaw
        : entered > 0
          ? (surchargeRaw / entered) * 100
          : 0;
    const surchargeAmount =
      surchargeMode === "percent"
        ? entered * (surchargePercent / 100)
        : surchargeRaw;
    const total = Math.max(0, entered - discountAmount + surchargeAmount);
    const amountReceived =
      paymentMethod === "cash" ? parseMoney(cashReceived) : total;

    return {
      entered,
      discountPercent,
      discountAmount,
      surchargePercent,
      surchargeAmount,
      total,
      amountReceived,
      change: Math.max(0, amountReceived - total),
      isCashShort: paymentMethod === "cash" && amountReceived < total,
    };
  }, [
    cashReceived,
    discountMode,
    discountValue,
    initialReceipt?.enteredAmount,
    originalAmount,
    paymentMethod,
    surchargeMode,
    surchargeValue,
  ]);

  useEffect(() => {
    if (paymentMethod !== "cash") {
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
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível criar a pendência de recebimento.";
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
      const settings = await fetchPrintSettings().catch(
        () => defaultPrintSettings,
      );
      const contextRows = [
        settings.showClientData
          ? `<p><strong>Cliente:</strong> ${escapePrintHtml(receipt.clientName)}</p>`
          : "",
        settings.showService
          ? `<p><strong>Serviço:</strong> ${escapePrintHtml(receipt.serviceTitle)}</p>`
          : "",
        settings.showProfessional
          ? `<p><strong>Profissional:</strong> ${escapePrintHtml(receipt.professionalName || "Não informado")}</p>`
          : "",
        `<p><strong>Data:</strong> ${escapePrintHtml(new Date(receipt.receivedAt || Date.now()).toLocaleString("pt-BR"))}</p>`,
      ].join("");
      const valueRows = [
        ["Valor original", money(receipt.originalAmount)],
        ["Valor base", money(receipt.enteredAmount)],
        ...(receipt.discountAmount > 0
          ? [["Desconto", `- ${money(receipt.discountAmount)}`]]
          : []),
        ...(receipt.surchargeAmount > 0
          ? [["Acréscimo", `+ ${money(receipt.surchargeAmount)}`]]
          : []),
        ["Total recebido", money(receipt.totalAmount)],
        ...(settings.showPayment
          ? [
              [
                "Forma de pagamento",
                receipt.paymentMethod
                  ? paymentLabel[receipt.paymentMethod]
                  : "Não informada",
              ],
            ]
          : []),
        ...(settings.showPayment && receipt.paymentMethod === "cash"
          ? [
              ["Valor entregue", money(receipt.amountReceived)],
              ["Troco", money(receipt.changeAmount)],
            ]
          : []),
      ]
        .map(
          ([label, value]) =>
            `<div class="print-row"><span>${escapePrintHtml(label)}</span><strong>${escapePrintHtml(value)}</strong></div>`,
        )
        .join("");
      const bodyHtml = `${settings.showLogo ? '<h1 class="print-center">Navo Barber &amp; Club</h1>' : ""}<h2 class="print-center">Comprovante de Pagamento</h2><hr class="print-divider">${contextRows}<hr class="print-divider">${valueRows}${settings.showObservations && receipt.observations ? `<hr class="print-divider"><p><strong>Observações:</strong> ${escapePrintHtml(receipt.observations)}</p>` : ""}`;
      if (
        !openPrintWindow({
          title: "Comprovante de Pagamento",
          settings,
          format: settings.receiptFormat,
          bodyHtml,
        })
      ) {
        setError(
          "A impressão foi bloqueada pelo navegador. Permita pop-ups e tente novamente.",
        );
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível preparar o comprovante de impressão.",
      );
    }
  };

  const handleShareWhatsApp = () => {
    if (!receipt) return;
    const clientName = receipt.clientName || source.clientName;
    const phone = (source.clientPhone || "").replace(/\D/g, "");
    const totalFormatted = money(receipt.totalAmount);
    const dateFormatted = new Date(
      receipt.receivedAt || Date.now(),
    ).toLocaleString("pt-BR");
    const methodStr = paymentLabel[receipt.paymentMethod || "other"];

    const msg = `*Navo Barber & Club - Comprovante de Pagamento*\n\nOlá, ${clientName}!\nConfirmamos o pagamento referente ao serviço *${receipt.serviceTitle}*.\n\n*Detalhes:*\n• Profissional: ${receipt.professionalName || "Profissional"}\n• Forma: ${methodStr}\n• Valor: *${totalFormatted}*\n• Data: ${dateFormatted}\n\nAgradecemos a preferência e até a próxima!`;

    const targetUrl = phone
      ? `https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;

    window.open(targetUrl, "_blank");
  };

  const handleConfirmReceipt = async () => {
    if (!receipt) return;
    if (calculation.isCashShort) {
      setError(
        "O valor recebido em dinheiro é menor que o total da comanda/serviço.",
      );
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
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível confirmar o recebimento.",
      );
    } finally {
      setIsConfirming(false);
    }
  };

  const isConfirmed = receipt?.status === "received";

  const getHeaderTitle = () => {
    if (isConfirmed) return "Recebimento confirmado";
    if (step === "decision") return "Conclusão de atendimento";
    if (step === 1) return "Finalizar recebimento";
    return "Revisão e confirmação";
  };

  const getHeaderSubtitle = () => {
    if (isConfirmed) return `Código #${receipt?.id.slice(-8).toUpperCase()}`;
    return `${source.clientName} · ${source.serviceTitle}`;
  };

  return createPortal(
    <div
      className="receipt-v2-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-dialog-title"
    >
      <div ref={dialogRef} tabIndex={-1} className="receipt-v2-dialog">
        {/* HEADER FIXO */}
        <header className="receipt-v2-header">
          <div className="receipt-v2-title-group">
            <span className="receipt-v2-header-icon">
              {isConfirmed ? (
                <CheckCircle2 className="text-status-success" aria-hidden="true" />
              ) : step === 2 ? (
                <ClipboardCheck aria-hidden="true" />
              ) : (
                <CreditCard aria-hidden="true" />
              )}
            </span>
            <div className="receipt-v2-title-copy">
              <p className="receipt-v2-label">
                {isConfirmed
                  ? "Comprovante emitido"
                  : step === "decision"
                    ? "Etapa inicial"
                    : `Etapa ${step} de 2`}
              </p>
              <h2 id="receipt-dialog-title" className="receipt-v2-title">
                {getHeaderTitle()}
              </h2>
              <p className="text-xs text-[var(--admin-text-muted)] truncate max-w-[260px] sm:max-w-xs mt-0.5">
                {getHeaderSubtitle()}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="receipt-v2-close"
            aria-label="Fechar modal"
          >
            <X aria-hidden="true" />
          </button>
        </header>

        {/* PROGRESS BAR FIXO */}
        {!isConfirmed && step !== "decision" && (
          <div className="receipt-v2-progress px-5 sm:px-6 mb-3">
            <div className="flex items-center gap-2">
              <div
                className={`flex-1 h-1.5 rounded-full transition-all ${
                  step >= 1 ? "bg-[var(--admin-accent)]" : "bg-[var(--admin-border)]"
                }`}
              />
              <div
                className={`flex-1 h-1.5 rounded-full transition-all ${
                  step >= 2 ? "bg-[var(--admin-accent)]" : "bg-[var(--admin-border)]"
                }`}
              />
            </div>
          </div>
        )}

        {/* CORPO COM ROLAGEM SUAVE */}
        <div className="receipt-v2-scroll">
          {error && (
            <div
              className="mb-4 rounded-xl border border-status-error/30 bg-status-error/10 p-3 text-xs font-semibold text-status-error flex items-start gap-2"
              role="alert"
            >
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* PASSO: DECISÃO INICIAL (FILA) */}
          {step === "decision" && !isConfirmed && (
            <div className="space-y-4">
              <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-2xl p-4 sm:p-5 text-center space-y-2 shadow-xs">
                <div className="w-12 h-12 rounded-full bg-status-success/15 text-status-success mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-[var(--admin-text-main)]">
                  Atendimento finalizado com sucesso!
                </h3>
                <p className="text-xs text-[var(--admin-text-muted)] max-w-sm mx-auto">
                  O atendimento de <strong>{source.clientName}</strong> ({source.serviceTitle}) está concluído.
                </p>
                <div className="pt-2 text-2xl font-serif font-bold text-[var(--admin-accent)]">
                  {money(originalAmount)}
                </div>
              </div>

              <div className="bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-xl p-3.5 text-xs text-[var(--admin-text-muted)] space-y-1">
                <p className="font-bold text-[var(--admin-text-main)]">
                  O que deseja fazer agora?
                </p>
                <p>
                  • <strong>Registrar agora:</strong> Define forma de pagamento, descontos e confirma o recebimento imediatamente no extrato.
                </p>
                <p>
                  • <strong>Registrar depois:</strong> Mantém como pendência na aba <em>Financeiro › Recebimentos</em> para acerto posterior.
                </p>
              </div>
            </div>
          )}

          {/* PASSO 1: VALORES, DESCONTOS & PAGAMENTO */}
          {step === 1 && !isConfirmed && (
            <form
              id="checkout-step-1-form"
              onKeyDown={handleEnterAsTab}
              onSubmit={(e) => {
                e.preventDefault();
                if (calculation.isCashShort) {
                  setError("O valor recebido em dinheiro deve ser maior ou igual ao total.");
                  return;
                }
                setError(null);
                setStep(2);
              }}
              className="space-y-4"
            >
              {/* CARD HERO DE ATENDIMENTO */}
              <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-[var(--admin-text-muted)]">
                  <span>Valor base do serviço</span>
                  <span className="font-semibold text-[var(--admin-text-main)]">{source.serviceTitle}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <div className="text-2xl font-serif font-bold text-[var(--admin-text-main)]">
                    {money(originalAmount)}
                  </div>
                  <div className="text-xs text-[var(--admin-text-muted)] flex items-center gap-1">
                    <UserRound className="w-3.5 h-3.5" />
                    <span>{source.professionalName || "Profissional padrão"}</span>
                  </div>
                </div>
              </div>

              {/* AJUSTES: DESCONTO E ACRÉSCIMO */}
              <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--admin-text-muted)]">
                  <Tag className="w-3.5 h-3.5 text-[var(--admin-accent)]" />
                  <span>Ajustes de Valor</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* DESCONTO */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[var(--admin-text-muted)]">Desconto</span>
                      <span className="font-bold text-status-error text-[11px]">
                        {calculation.discountAmount > 0 ? `− ${money(calculation.discountAmount)}` : "R$ 0,00"}
                      </span>
                    </div>
                    <div className="flex rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)] overflow-hidden focus-within:border-[var(--admin-accent)]">
                      <div className="flex border-r border-[var(--admin-border)] bg-[var(--admin-surface)]">
                        <button
                          type="button"
                          onClick={() => setDiscountMode("percent")}
                          className={`px-2.5 py-1.5 text-xs font-bold transition-colors ${
                            discountMode === "percent"
                              ? "bg-[var(--admin-accent)] text-[var(--admin-accent-text)]"
                              : "text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)]"
                          }`}
                        >
                          %
                        </button>
                        <button
                          type="button"
                          onClick={() => setDiscountMode("amount")}
                          className={`px-2.5 py-1.5 text-xs font-bold transition-colors ${
                            discountMode === "amount"
                              ? "bg-[var(--admin-accent)] text-[var(--admin-accent-text)]"
                              : "text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)]"
                          }`}
                        >
                          R$
                        </button>
                      </div>
                      <input
                        type="number"
                        min="0"
                        max={discountMode === "percent" ? 100 : undefined}
                        step="0.01"
                        value={discountValue}
                        onChange={(e) => setDiscountValue(e.target.value)}
                        placeholder="0,00"
                        className="w-full bg-transparent px-3 py-2 text-xs font-bold text-[var(--admin-text-main)] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* ACRÉSCIMO */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[var(--admin-text-muted)]">Acréscimo / Taxa</span>
                      <span className="font-bold text-status-success text-[11px]">
                        {calculation.surchargeAmount > 0 ? `+ ${money(calculation.surchargeAmount)}` : "R$ 0,00"}
                      </span>
                    </div>
                    <div className="flex rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)] overflow-hidden focus-within:border-[var(--admin-accent)]">
                      <div className="flex border-r border-[var(--admin-border)] bg-[var(--admin-surface)]">
                        <button
                          type="button"
                          onClick={() => setSurchargeMode("percent")}
                          className={`px-2.5 py-1.5 text-xs font-bold transition-colors ${
                            surchargeMode === "percent"
                              ? "bg-[var(--admin-accent)] text-[var(--admin-accent-text)]"
                              : "text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)]"
                          }`}
                        >
                          %
                        </button>
                        <button
                          type="button"
                          onClick={() => setSurchargeMode("amount")}
                          className={`px-2.5 py-1.5 text-xs font-bold transition-colors ${
                            surchargeMode === "amount"
                              ? "bg-[var(--admin-accent)] text-[var(--admin-accent-text)]"
                              : "text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)]"
                          }`}
                        >
                          R$
                        </button>
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={surchargeValue}
                        onChange={(e) => setSurchargeValue(e.target.value)}
                        placeholder="0,00"
                        className="w-full bg-transparent px-3 py-2 text-xs font-bold text-[var(--admin-text-main)] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* FORMA DE PAGAMENTO */}
              <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--admin-text-muted)]">
                    Forma de Pagamento
                  </span>
                  <span className="text-xs font-bold text-[var(--admin-accent)]">
                    {paymentLabel[paymentMethod]}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {paymentOptions.map((opt) => {
                    const Icon = opt.icon;
                    const isSelected = paymentMethod === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setPaymentMethod(opt.id)}
                        className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all text-left ${
                          isSelected
                            ? "border-[var(--admin-accent)] bg-[var(--admin-accent)]/15 text-[var(--admin-accent)] shadow-xs"
                            : "border-[var(--admin-border)] bg-[var(--admin-bg)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:border-[var(--admin-border-strong)]"
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="text-xs font-bold truncate">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* CASO DINHEIRO: VALOR RECEBIDO E TROCO */}
                {paymentMethod === "cash" && (
                  <div className="mt-3 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                      <Banknote className="w-4 h-4" />
                      <span>Cálculo de Troco em Dinheiro</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <div>
                        <label className="block text-[11px] font-medium text-[var(--admin-text-muted)] mb-1">
                          Valor entregue pelo cliente (R$)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={cashReceived}
                          onChange={(e) => setCashReceived(e.target.value)}
                          className="w-full h-9 rounded-lg bg-[var(--admin-surface)] border border-[var(--admin-border)] px-3 text-sm font-bold text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)]"
                        />
                      </div>
                      <div className="flex flex-col justify-center bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-lg p-2.5">
                        <span className="text-[10px] uppercase font-bold text-[var(--admin-text-muted)]">
                          Troco a devolver
                        </span>
                        <strong
                          className={`text-base font-bold tabular-nums ${
                            calculation.isCashShort
                              ? "text-status-error text-xs font-normal"
                              : "text-status-success"
                          }`}
                        >
                          {calculation.isCashShort
                            ? "Valor insuficiente"
                            : money(calculation.change)}
                        </strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* OBSERVAÇÕES */}
              <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-2xl p-4 space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--admin-text-muted)]">
                  Observações adicionais (opcional)
                </label>
                <input
                  type="text"
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Ex: pago no PIX da empresa / desconto acordado"
                  className="w-full h-9 rounded-xl bg-[var(--admin-bg)] border border-[var(--admin-border)] px-3 text-xs text-[var(--admin-text-main)] placeholder:text-[var(--admin-text-muted)] focus:outline-none focus:border-[var(--admin-accent)]"
                />
              </div>

              {/* TOTAL EM DESTAQUE */}
              <div className="bg-gradient-to-r from-[var(--admin-surface)] to-[var(--admin-bg)] border border-[var(--admin-accent)]/30 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs uppercase font-bold text-[var(--admin-text-muted)] block">
                    Total Final a Receber
                  </span>
                  <span className="text-[11px] text-[var(--admin-text-muted)]">
                    {calculation.discountAmount > 0 || calculation.surchargeAmount > 0
                      ? "Com ajustes aplicados"
                      : "Sem ajustes adicionais"}
                  </span>
                </div>
                <div className="text-2xl font-serif font-bold text-[var(--admin-accent)]">
                  {money(calculation.total)}
                </div>
              </div>
            </form>
          )}

          {/* PASSO 2: REVISÃO & CONFIRMAÇÃO */}
          {step === 2 && !isConfirmed && (
            <div className="space-y-4">
              {/* HERO REVISÃO */}
              <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-2xl p-4 text-center space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--admin-text-muted)]">
                  Confirmar recebimento de
                </span>
                <div className="text-3xl font-serif font-bold text-[var(--admin-accent)]">
                  {money(calculation.total)}
                </div>
                <div className="text-xs text-[var(--admin-text-muted)]">
                  Via <strong>{paymentLabel[paymentMethod]}</strong>
                </div>
              </div>

              {/* DETALHES CONSOLIDADOS */}
              <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-2xl p-4 space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-[var(--admin-border)]">
                  <span className="text-[var(--admin-text-muted)]">Cliente</span>
                  <strong className="text-[var(--admin-text-main)]">{source.clientName}</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-[var(--admin-border)]">
                  <span className="text-[var(--admin-text-muted)]">Serviço</span>
                  <span className="text-[var(--admin-text-main)] font-semibold">{source.serviceTitle}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[var(--admin-border)]">
                  <span className="text-[var(--admin-text-muted)]">Profissional</span>
                  <span className="text-[var(--admin-text-main)]">{source.professionalName || "Não informado"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[var(--admin-border)]">
                  <span className="text-[var(--admin-text-muted)]">Valor original</span>
                  <span className="text-[var(--admin-text-main)]">{money(originalAmount)}</span>
                </div>
                {calculation.discountAmount > 0 && (
                  <div className="flex justify-between py-1 border-b border-[var(--admin-border)] text-status-error font-medium">
                    <span>Desconto</span>
                    <span>− {money(calculation.discountAmount)}</span>
                  </div>
                )}
                {calculation.surchargeAmount > 0 && (
                  <div className="flex justify-between py-1 border-b border-[var(--admin-border)] text-status-success font-medium">
                    <span>Acréscimo</span>
                    <span>+ {money(calculation.surchargeAmount)}</span>
                  </div>
                )}
                {paymentMethod === "cash" && (
                  <>
                    <div className="flex justify-between py-1 border-b border-[var(--admin-border)]">
                      <span className="text-[var(--admin-text-muted)]">Valor entregue</span>
                      <span className="text-[var(--admin-text-main)]">{money(calculation.amountReceived)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[var(--admin-border)] text-status-success font-bold">
                      <span>Troco</span>
                      <span>{money(calculation.change)}</span>
                    </div>
                  </>
                )}
                {observations.trim() && (
                  <div className="pt-1">
                    <span className="text-[var(--admin-text-muted)] block mb-0.5">Observações:</span>
                    <p className="italic text-[var(--admin-text-main)] bg-[var(--admin-bg)] p-2 rounded-lg">
                      {observations}
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-xl p-3 flex items-start gap-2 text-xs text-[var(--admin-text-muted)]">
                <Info className="w-4 h-4 text-[var(--admin-accent)] shrink-0 mt-0.5" />
                <span>
                  Ao confirmar, o status passará para <strong>Recebido</strong> e o lançamento entrará automaticamente no fluxo de caixa.
                </span>
              </div>
            </div>
          )}

          {/* PASSO FINAL: RECEBIMENTO CONFIRMADO (COMPROVANTE) */}
          {isConfirmed && receipt && (
            <div className="space-y-4">
              <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-2xl p-5 text-center space-y-2 shadow-xs">
                <div className="w-12 h-12 rounded-full bg-status-success/20 text-status-success mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-[var(--admin-text-main)]">
                  Recebimento Confirmado!
                </h3>
                <p className="text-xs text-[var(--admin-text-muted)]">
                  Lançamento efetuado com sucesso no Extrato Financeiro.
                </p>
                <div className="pt-2 text-3xl font-serif font-bold text-status-success">
                  {money(receipt.totalAmount)}
                </div>
              </div>

              {/* CARD DE COMPROVANTE */}
              <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-[var(--admin-border)]">
                  <span className="font-bold flex items-center gap-1.5 text-[var(--admin-text-main)]">
                    <FileText className="w-4 h-4 text-[var(--admin-accent)]" />
                    Comprovante
                  </span>
                  <span className="font-mono font-bold text-[var(--admin-accent)]">
                    #{receipt.id.slice(-8).toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[var(--admin-text-muted)]">Cliente:</span>
                  <strong className="text-[var(--admin-text-main)]">{receipt.clientName}</strong>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[var(--admin-text-muted)]">Serviço:</span>
                  <span className="text-[var(--admin-text-main)]">{receipt.serviceTitle}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[var(--admin-text-muted)]">Profissional:</span>
                  <span className="text-[var(--admin-text-main)]">{receipt.professionalName || "Não informado"}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[var(--admin-text-muted)]">Forma:</span>
                  <span className="text-[var(--admin-text-main)] font-semibold">
                    {paymentLabel[receipt.paymentMethod || "other"]}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[var(--admin-text-muted)]">Data/Hora:</span>
                  <span className="text-[var(--admin-text-main)]">
                    {new Date(receipt.receivedAt || Date.now()).toLocaleString("pt-BR")}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RODAPÉ FIXO INABALÁVEL (SEMPRE VISÍVEL FORA DA ROLAGEM) */}
        <footer className="receipt-v2-footer">
          {/* AÇÕES PARA: DECISÃO INICIAL */}
          {step === "decision" && !isConfirmed && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRegisterLater}
                disabled={isCreating}
                className="flex-1 min-h-[44px] px-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] text-xs font-bold text-[var(--admin-text-muted)] hover:bg-[var(--admin-bg)] hover:text-[var(--admin-text-main)] transition-colors"
              >
                {isCreating ? "Salvando…" : "Registrar depois"}
              </button>
              <button
                type="button"
                onClick={handleRegisterNow}
                disabled={isCreating}
                className="flex-[1.5] min-h-[44px] px-4 rounded-xl bg-[var(--admin-accent)] text-[var(--admin-accent-text)] text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[var(--admin-accent-hover)] transition-all shadow-xs"
              >
                {isCreating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CreditCard className="w-4 h-4" />
                )}
                <span>Registrar agora</span>
              </button>
            </div>
          )}

          {/* AÇÕES PARA: ETAPA 1 (VALORES & FORMA DE PAGAMENTO) */}
          {step === 1 && !isConfirmed && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 min-h-[44px] px-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] text-xs font-bold text-[var(--admin-text-muted)] hover:bg-[var(--admin-bg)] hover:text-[var(--admin-text-main)] transition-colors flex items-center justify-center gap-1"
              >
                <X className="w-4 h-4" />
                <span>Cancelar</span>
              </button>
              <button
                type="submit"
                form="checkout-step-1-form"
                disabled={calculation.isCashShort}
                className="flex-[1.8] min-h-[44px] px-4 rounded-xl bg-[var(--admin-accent)] text-[var(--admin-accent-text)] text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[var(--admin-accent-hover)] disabled:opacity-50 transition-all shadow-xs"
              >
                <span>Revisar ({money(calculation.total)})</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* AÇÕES PARA: ETAPA 2 (REVISÃO & CONFIRMAÇÃO) */}
          {step === 2 && !isConfirmed && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={isConfirming}
                className="flex-1 min-h-[44px] px-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] text-xs font-bold text-[var(--admin-text-muted)] hover:bg-[var(--admin-bg)] hover:text-[var(--admin-text-main)] transition-colors flex items-center justify-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </button>
              <button
                type="button"
                onClick={handleConfirmReceipt}
                disabled={isConfirming}
                className="flex-[2] min-h-[44px] px-4 rounded-xl bg-status-success hover:opacity-95 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
              >
                {isConfirming ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Confirmando…</span>
                  </>
                ) : (
                  <>
                    <ClipboardCheck className="w-4 h-4" />
                    <span>Confirmar recebimento</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* AÇÕES PARA: RECEBIMENTO CONFIRMADO */}
          {isConfirmed && receipt && (
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="min-h-[44px] px-2 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[11px] font-bold text-status-success hover:bg-[var(--admin-bg)] transition-colors flex items-center justify-center gap-1"
                title="Compartilhar no WhatsApp"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">WhatsApp</span>
                <span className="sm:hidden">Whats</span>
              </button>
              <button
                type="button"
                onClick={handlePrintReceipt}
                className="min-h-[44px] px-2 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[11px] font-bold text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-bg)] transition-colors flex items-center justify-center gap-1"
                title="Imprimir Comprovante"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-3 rounded-xl bg-[var(--admin-accent)] text-[var(--admin-accent-text)] text-xs font-bold flex items-center justify-center gap-1 hover:bg-[var(--admin-accent-hover)] transition-all shadow-xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Concluir</span>
              </button>
            </div>
          )}
        </footer>
      </div>
    </div>,
    document.body,
  );
};

