import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  QrCode,
  Printer,
  Copy,
  Check,
  ExternalLink,
  Share2,
  AlertCircle,
} from "lucide-react";
import { AdminPageHeader } from "./shared/AdminPageHeader";
import {
  defaultPrintSettings,
  fetchPrintSettings,
} from "../../services/printSettingsService";

export const QrCodeManagement: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const bookingUrl = `${window.location.origin}/?booking=1`;

  const handlePrintTotem = async () => {
    const settings = await fetchPrintSettings().catch(
      () => defaultPrintSettings,
    );
    document.body.dataset.qrPrintFormat = settings.qrFormat;
    document.body.dataset.qrPrintWidth = String(settings.thermalWidthMm);
    document.body.dataset.qrPrintOrientation = settings.a4Orientation;
    document.body.dataset.qrShowLogo = String(settings.showLogo);
    document.body.dataset.qrShowCode = String(settings.showQr);
    document.body.dataset.qrShowFooter = String(settings.showFooter);
    document.body.style.setProperty(
      "--qr-print-font-size",
      `${settings.fontSize}px`,
    );
    document.body.style.setProperty(
      "--qr-print-margin",
      `${settings.marginMm}mm`,
    );
    document.body.style.setProperty(
      "--qr-print-density",
      settings.density === "compact"
        ? "4px"
        : settings.density === "spacious"
          ? "14px"
          : "8px",
    );
    const cleanup = () => {
      delete document.body.dataset.qrPrintFormat;
      delete document.body.dataset.qrPrintWidth;
      delete document.body.dataset.qrPrintOrientation;
      delete document.body.dataset.qrShowLogo;
      delete document.body.dataset.qrShowCode;
      delete document.body.dataset.qrShowFooter;
      document.body.style.removeProperty("--qr-print-font-size");
      document.body.style.removeProperty("--qr-print-margin");
      document.body.style.removeProperty("--qr-print-density");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 5000);
  };

  const handleCopy = async () => {
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(bookingUrl);
    } catch {
      const helper = document.createElement("textarea");
      helper.value = bookingUrl;
      helper.style.position = "fixed";
      helper.style.opacity = "0";
      document.body.appendChild(helper);
      helper.focus();
      helper.select();
      const copiedWithFallback = document.execCommand("copy");
      helper.remove();
      if (!copiedWithFallback) {
        setCopyError(true);
        return;
      }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4 animate-fade-in text-[var(--admin-text-main)] min-w-0">
      {/* Header (desktop) */}
      <AdminPageHeader
        icon={QrCode}
        title="QR do agendamento"
        action={{
          label: "Imprimir totem",
          onClick: handlePrintTotem,
          icon: Printer,
        }}
      />

      {/* Ação (mobile) */}
      <button
        onClick={handlePrintTotem}
        className="md:hidden w-full bg-[var(--admin-accent)] hover:bg-gold-hover text-[var(--admin-accent-text)] px-4 py-2.5 rounded-[var(--admin-radius-lg)] text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all shrink-0"
      >
        <Printer className="w-4 h-4" />
        <span>Imprimir totem</span>
      </button>

      {/* Main Container */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Printable Card Totem */}
        <div className="qr-print-sheet bg-[var(--admin-surface)] rounded-[var(--admin-radius-xl)] p-6 text-center space-y-4 font-serif relative overflow-hidden">
          <div className="qr-print-brand space-y-1">
            <h2 className="text-2xl font-bold tracking-widest uppercase text-[var(--admin-text-main)]">
              NAVO PREMIUM
            </h2>
            <p className="text-xs font-sans text-[var(--admin-accent)] font-bold uppercase tracking-wider">
              Agende pelo celular
            </p>
          </div>

          {/* QR Code Container */}
          <div className="qr-print-code bg-[var(--admin-bg)]/80 p-4 rounded-[var(--admin-radius-xl)] inline-block mx-auto">
            <QRCodeSVG
              value={bookingUrl}
              size={220}
              level="M"
              includeMargin
              fgColor="#111111"
              bgColor="#ffffff"
              className="mx-auto rounded-[var(--admin-radius-md)]"
            />
          </div>

          <div className="qr-print-footer space-y-1 text-xs font-sans">
            <p className="text-[var(--admin-text-main)] font-bold">
              Aponte a câmera para agendar
            </p>
            <p className="text-[var(--admin-text-muted)] text-xs">
              Abre a escolha do serviço.
            </p>
          </div>
        </div>

        {/* Link & Digital Sharing Options */}
        <div className="qr-print-exclude bg-[var(--admin-surface)] rounded-[var(--admin-radius-xl)] p-6 space-y-5 flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-[var(--admin-text-main)] flex items-center gap-2">
              <Share2 className="w-4 h-4 text-[var(--admin-accent)]" />
              <span>Link de agendamento</span>
            </h3>
            <p className="text-xs text-[var(--admin-text-muted)] leading-relaxed">
              Cole na bio, no WhatsApp ou envie aos clientes.
            </p>

            <div className="flex items-center gap-2 bg-[var(--admin-bg)]/80 p-2.5 rounded-[var(--admin-radius-lg)]">
              <input
                type="text"
                readOnly
                value={bookingUrl}
                className="bg-transparent text-xs text-[var(--admin-text-main)] font-mono flex-1 focus:outline-none"
              />
              <button
                onClick={handleCopy}
                className="bg-[var(--admin-accent)]/15 text-[var(--admin-accent)] hover:bg-[var(--admin-accent)] hover:text-[var(--admin-accent-text)] px-3 py-1.5 rounded-[var(--admin-radius-md)] text-xs font-bold transition-all flex items-center gap-1 shrink-0"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copied ? "Copiado!" : "Copiar"}</span>
              </button>
            </div>
            {copyError && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-status-error">
                <AlertCircle className="h-3.5 w-3.5" /> Não foi possível copiar.
                Copie o link manualmente.
              </p>
            )}
          </div>

          <div className="pt-4 space-y-2">
            <span className="text-xs font-bold uppercase text-[var(--admin-text-muted)] block">
              Ações rápidas
            </span>
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-[var(--admin-bg)]/80 hover:bg-[var(--admin-bg)] text-[var(--admin-text-main)] p-2.5 rounded-[var(--admin-radius-lg)] text-xs font-bold flex items-center justify-center gap-2 transition-all"
            >
              <ExternalLink className="w-4 h-4 text-[var(--admin-accent)]" />
              <span>Testar Link do Cliente</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
