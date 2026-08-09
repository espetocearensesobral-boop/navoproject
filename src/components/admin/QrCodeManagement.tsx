import React, { useState } from 'react';
import { QrCode, Download, Printer, Copy, Check, ExternalLink, Smartphone, Share2, Sparkles } from 'lucide-react';
import { AdminPageHeader } from './shared/AdminPageHeader';

export const QrCodeManagement: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const bookingUrl = window.location.origin;

  const handleCopy = () => {
    navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Generate Google Chart API QR Code image URL for clean rendering
  const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(bookingUrl)}&color=d4af37&bgcolor=141414`;

  return (
    <div className="space-y-4 animate-fade-in text-content-base min-w-0">
      {/* Header (desktop) */}
      <AdminPageHeader
        icon={QrCode}
        title="Divulgação & QR Code do Agendamento"
        action={{ label: 'Imprimir', onClick: () => window.print(), icon: Printer }}
      />

      {/* Ação (mobile) */}
      <button
        onClick={() => window.print()}
        className="md:hidden w-full bg-gold-base hover:bg-gold-hover text-surface-base px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all shrink-0"
      >
        <Printer className="w-4 h-4" />
        <span>Imprimir Totem para Balcão</span>
      </button>

      {/* Main Container */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Printable Card Totem */}
        <div className="bg-surface-card border border-gold-base/40 rounded-2xl p-6 text-center space-y-4 shadow-md bg-gold-base/5 font-serif relative overflow-hidden">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-widest uppercase text-content-base">NAVO PREMIUM</h2>
            <p className="text-xs font-sans text-gold-base font-bold uppercase tracking-wider">Agende seu horário pelo celular</p>
          </div>

          {/* QR Code Container */}
          <div className="bg-surface-base p-4 rounded-2xl border-2 border-gold-base/60 inline-block shadow-inner mx-auto">
            <img
              src={qrCodeImageUrl}
              alt="QR Code de Agendamento NAVO"
              className="w-48 h-48 rounded-xl mx-auto"
            />
          </div>

          <div className="space-y-1 text-xs font-sans">
            <p className="text-content-base font-bold">Aponta a câmera do seu celular para agendar</p>
            <p className="text-content-muted text-[11px]">Rápido, sem filas e 24h por dia disponível.</p>
          </div>
        </div>

        {/* Link & Digital Sharing Options */}
        <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 space-y-5 shadow-xs flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-content-base flex items-center gap-2">
              <Share2 className="w-4 h-4 text-gold-base" />
              <span>Link Direto de Agendamento</span>
            </h3>
            <p className="text-xs text-content-muted leading-relaxed">
              Cole este link na bio do Instagram da barbearia, no WhatsApp Business ou envie diretamente para seus clientes.
            </p>

            <div className="flex items-center gap-2 bg-surface-base p-2.5 rounded-xl border border-border-subtle">
              <input
                type="text"
                readOnly
                value={bookingUrl}
                className="bg-transparent text-xs text-content-base font-mono flex-1 focus:outline-none"
              />
              <button
                onClick={handleCopy}
                className="bg-gold-base/15 text-gold-base hover:bg-gold-base hover:text-surface-base px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copiado!' : 'Copiar'}</span>
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-border-subtle space-y-2">
            <span className="text-[10px] font-bold uppercase text-content-muted block">Ações Rápidas</span>
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-surface-base border border-border-subtle hover:border-gold-base/50 text-content-base p-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all"
            >
              <ExternalLink className="w-4 h-4 text-gold-base" />
              <span>Testar Link do Cliente (Abrir em nova aba)</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
