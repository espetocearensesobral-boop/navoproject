import React, { useState } from 'react';
import { Store, Phone, Link as LinkIcon, Save, Camera, CheckCircle2, Globe, Clock, MapPin } from 'lucide-react';

type SettingsTab = 'contacts' | 'links';

export const SettingsManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('contacts');
  const [isSaving, setIsSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      showToast('Configurações salvas com sucesso!');
    }, 600);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'contacts':
        return <ContactSettings onSave={handleSave} isSaving={isSaving} />;
      case 'links':
        return <LinkSettings onSave={handleSave} isSaving={isSaving} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300 min-w-0">
      {/* PAGE HEADER (Action zone fixed at right) */}
      <div className="flex items-center justify-between gap-3 bg-surface-card p-4 rounded-md border border-border-subtle">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base sm:text-xl font-serif text-content-base font-bold tracking-tight truncate">
              Configurações do Sistema
            </h1>
            <span className="text-[10px] bg-gold-base/10 text-gold-base border border-gold-base/30 px-2 py-0.5 rounded uppercase font-bold tracking-wider whitespace-nowrap shrink-0">
              Geral
            </span>
          </div>
          <p className="text-content-muted text-xs mt-0.5 truncate hidden sm:block">
            Gerencie canais de atendimento, integrações e links da plataforma.
          </p>
        </div>

        {/* Action Zone: Header Right Button */}
        <div className="shrink-0 flex items-center justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="h-10 sm:h-9 px-0 sm:px-4 w-10 sm:w-auto bg-gold-base text-surface-base hover:bg-gold-base/90 rounded-md text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 disabled:opacity-50 whitespace-nowrap"
            aria-label="Salvar Alterações"
          >
            <Save className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">{isSaving ? 'Salvando...' : 'Salvar Alterações'}</span>
          </button>
        </div>
      </div>

      {/* TOAST MESSAGE */}
      {toastMsg && (
        <div className="bg-status-success/10 border border-status-success/30 text-status-success p-3 rounded-md flex items-center gap-2 text-xs font-bold animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="truncate">{toastMsg}</span>
        </div>
      )}

      {/* TAB BAR */}
      <div className="bg-surface-card border border-border-subtle rounded-md p-1 flex items-center gap-1 overflow-x-auto custom-scrollbar">
        <TabButton active={activeTab === 'contacts'} onClick={() => setActiveTab('contacts')} icon={Phone} label="Canais de Contato" />
        <TabButton active={activeTab === 'links'} onClick={() => setActiveTab('links')} icon={LinkIcon} label="Links & Redes" />
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="bg-surface-card border border-border-subtle rounded-md p-4 sm:p-6 min-w-0">
        {renderContent()}
      </div>
    </div>
  );
};

const TabButton = ({ active, onClick, icon: Icon, label }: any) => (
  <button
    onClick={onClick}
    className={`
      h-10 sm:h-9 px-3.5 flex items-center justify-center gap-2 text-xs font-bold rounded transition-all whitespace-nowrap shrink-0 active:scale-95
      ${active ? 'bg-gold-base text-surface-base' : 'text-content-muted hover:text-content-base bg-surface-card/60 hover:bg-surface-base'}
    `}
  >
    <Icon className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
    <span>{label}</span>
  </button>
);

// --- Subcomponents for each tab ---

const ProfileSettings = ({ onSave, isSaving }: { onSave: () => void; isSaving: boolean }) => (
  <div className="space-y-6 max-w-2xl text-xs min-w-0">
    <div>
      <h2 className="text-sm font-serif font-bold text-content-base mb-0.5 truncate">Identidade Visual da Barbearia</h2>
      <p className="text-[11px] text-content-muted mb-4 truncate">Atualize a logomarca e o nome exibidos no app do cliente.</p>

      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 bg-surface-base p-3.5 rounded-md border border-border-subtle">
        <div className="w-20 h-20 bg-surface-card rounded-md border border-border-subtle flex items-center justify-center relative group shrink-0 shadow-inner">
          <Store className="w-8 h-8 text-gold-base" />
          <button className="absolute inset-0 bg-surface-base/80 rounded-md opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-content-base text-[10px] font-bold gap-1">
            <Camera className="w-4 h-4" />
            <span>Alterar</span>
          </button>
        </div>
        <div className="flex-1 space-y-2 w-full min-w-0">
          <div>
            <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block mb-1">
              Nome Fantasia / Unidade
            </label>
            <input
              type="text"
              defaultValue="Navo Barber & Club - Unidade Principal"
              className="w-full bg-surface-card border border-border-subtle rounded-md p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base min-w-0"
            />
          </div>
        </div>
      </div>
    </div>

    <hr className="border-border-subtle" />

    <div className="space-y-3">
      <h2 className="text-sm font-serif font-bold text-content-base mb-0.5 truncate">Informações Gerais & Funcionamento</h2>

      <div>
        <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block mb-1">Slogan / Subtítulo</label>
        <input
          type="text"
          defaultValue="Estilo, Tradição e Excelência na Medida Certa"
          className="w-full bg-surface-card border border-border-subtle rounded-md p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base min-w-0"
        />
      </div>

      <div>
        <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block mb-1">
          <MapPin className="w-3 h-3 inline mr-1 text-gold-base" /> Endereço Completo
        </label>
        <input
          type="text"
          defaultValue="Av. Paulista, 1000 - Bela Vista, São Paulo - SP"
          className="w-full bg-surface-card border border-border-subtle rounded-md p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base min-w-0"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block mb-1">
            <Clock className="w-3 h-3 inline mr-1 text-gold-base" /> Abertura
          </label>
          <input
            type="time"
            defaultValue="09:00"
            className="w-full bg-surface-card border border-border-subtle rounded-md p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base min-w-0 num-tabular whitespace-nowrap"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block mb-1">
            <Clock className="w-3 h-3 inline mr-1 text-gold-base" /> Fechamento
          </label>
          <input
            type="time"
            defaultValue="20:00"
            className="w-full bg-surface-card border border-border-subtle rounded-md p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base min-w-0 num-tabular whitespace-nowrap"
          />
        </div>
      </div>
    </div>

    {/* Action Zone: Form Footer (Touch target >= 40px) */}
    <div className="pt-4 border-t border-border-subtle flex justify-end">
      <button
        onClick={onSave}
        disabled={isSaving}
        className="h-11 sm:h-10 w-full sm:w-auto px-5 bg-gold-base text-surface-base hover:bg-gold-base/90 rounded-md text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap"
      >
        <Save className="w-4 h-4" />
        <span>{isSaving ? 'Salvando...' : 'Salvar Alterações do Perfil'}</span>
      </button>
    </div>
  </div>
);

const ContactSettings = ({ onSave, isSaving }: { onSave: () => void; isSaving: boolean }) => (
  <div className="space-y-6 max-w-2xl text-xs min-w-0">
    <div>
      <h2 className="text-sm font-serif font-bold text-content-base mb-0.5 truncate">Canais de Atendimento</h2>
      <p className="text-[11px] text-content-muted mb-4 truncate">
        Defina os contatos oficiais disponíveis no app para suporte aos clientes.
      </p>

      <div className="space-y-3">
        <div>
          <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block mb-1">
            WhatsApp Oficial de Agendamentos
          </label>
          <input
            type="text"
            defaultValue="(11) 99999-8888"
            className="w-full bg-surface-card border border-border-subtle rounded-md p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base min-w-0 num-tabular whitespace-nowrap"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block mb-1">Telefone Fixo da Recepção</label>
          <input
            type="text"
            defaultValue="(11) 3211-0000"
            className="w-full bg-surface-card border border-border-subtle rounded-md p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base min-w-0 num-tabular whitespace-nowrap"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block mb-1">E-mail de Suporte</label>
          <input
            type="email"
            defaultValue="contato@barberclub.com.br"
            className="w-full bg-surface-card border border-border-subtle rounded-md p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base min-w-0"
          />
        </div>
      </div>
    </div>

    {/* Action Zone: Form Footer */}
    <div className="pt-4 border-t border-border-subtle flex justify-end">
      <button
        onClick={onSave}
        disabled={isSaving}
        className="h-11 sm:h-10 w-full sm:w-auto px-5 bg-gold-base text-surface-base hover:bg-gold-base/90 rounded-md text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap"
      >
        <Save className="w-4 h-4" />
        <span>{isSaving ? 'Salvando...' : 'Salvar Contatos'}</span>
      </button>
    </div>
  </div>
);

const LinkSettings = ({ onSave, isSaving }: { onSave: () => void; isSaving: boolean }) => (
  <div className="space-y-6 max-w-2xl text-xs min-w-0">
    <div>
      <h2 className="text-sm font-serif font-bold text-content-base mb-0.5 truncate">Redes Sociais & Links Externos</h2>
      <p className="text-[11px] text-content-muted mb-4 truncate">
        Conecte suas redes sociais e página de localização do Google Maps.
      </p>

      <div className="space-y-3">
        <div>
          <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block mb-1">Instagram (@usuario)</label>
          <div className="flex min-w-0">
            <span className="bg-surface-base border border-r-0 border-border-subtle rounded-l-md px-3 py-2.5 text-content-muted font-bold shrink-0">
              @
            </span>
            <input
              type="text"
              defaultValue="navobarber_oficial"
              className="flex-1 min-w-0 bg-surface-card border border-border-subtle rounded-r-md p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block mb-1">Página do Facebook</label>
          <input
            type="url"
            defaultValue="https://facebook.com/navobarber"
            className="w-full bg-surface-card border border-border-subtle rounded-md p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base min-w-0"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-content-muted uppercase tracking-wider block mb-1">
            <Globe className="w-3 h-3 inline mr-1 text-gold-base" /> Link do Google Maps / Avaliações
          </label>
          <input
            type="url"
            defaultValue="https://maps.google.com/..."
            className="w-full bg-surface-card border border-border-subtle rounded-md p-2.5 text-xs text-content-base focus:outline-none focus:border-gold-base min-w-0"
          />
        </div>
      </div>
    </div>

    {/* Action Zone: Form Footer */}
    <div className="pt-4 border-t border-border-subtle flex justify-end">
      <button
        onClick={onSave}
        disabled={isSaving}
        className="h-11 sm:h-10 w-full sm:w-auto px-5 bg-gold-base text-surface-base hover:bg-gold-base/90 rounded-md text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap"
      >
        <Save className="w-4 h-4" />
        <span>{isSaving ? 'Salvando...' : 'Salvar Links'}</span>
      </button>
    </div>
  </div>
);
