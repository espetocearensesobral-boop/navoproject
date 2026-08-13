import React, { useEffect, useRef, useState } from 'react';
import { X, FileText, ShieldCheck } from 'lucide-react';

interface TermsAndPrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'terms' | 'privacy';
}

export const TermsAndPrivacyModal: React.FC<TermsAndPrivacyModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'terms',
}) => {
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>(defaultTab);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previousActive = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => modalRef.current?.focus(), 0);
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleEscape);
      previousActive?.focus?.();
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-modal-title"
        className="bg-surface-card border border-border-subtle rounded-2xl w-full max-w-2xl h-[85vh] max-h-[700px] flex flex-col shadow-2xl overflow-hidden relative outline-none"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-border-subtle flex items-center justify-between shrink-0 bg-surface-base">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gold-base/15 text-gold-base border border-gold-base/30 flex items-center justify-center">
              {activeTab === 'terms' ? <FileText className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
            </div>
            <div>
              <h2 id="terms-modal-title" className="text-sm font-serif font-bold text-content-base">
                {activeTab === 'terms' ? 'Termos de Serviço' : 'Política de Privacidade'}
              </h2>
              <p className="text-[10px] text-content-muted">Navo Barber & Club — Última atualização: 10 de agosto de 2026</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-surface-card hover:bg-surface-elevated text-content-muted hover:text-content-base flex items-center justify-center transition-colors border border-border-subtle"
            aria-label="Fechar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="px-4 pt-3 pb-1 border-b border-border-subtle bg-surface-card flex items-center gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('terms')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'terms'
                ? 'bg-gold-base text-surface-base shadow-xs'
                : 'text-content-muted hover:text-content-base hover:bg-surface-base'
            }`}
          >
            Termos de Serviço
          </button>
          <button
            onClick={() => setActiveTab('privacy')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'privacy'
                ? 'bg-gold-base text-surface-base shadow-xs'
                : 'text-content-muted hover:text-content-base hover:bg-surface-base'
            }`}
          >
            Política de Privacidade
          </button>
        </div>

        {/* Modal Content Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs text-content-base leading-relaxed custom-scrollbar">
          {activeTab === 'terms' ? (
            <div className="space-y-4">
              <p className="text-content-muted">
                Estes Termos de Serviço (&quot;Termos&quot;) regem o uso da plataforma de agendamentos e gestão de barbearias (&quot;Plataforma&quot;), fornecida por <strong>Navo Barber & Club</strong> (&quot;nós&quot;, &quot;nosso&quot; ou &quot;Plataforma&quot;).
              </p>
              <p className="text-content-muted">
                Ao criar uma conta, acessar ou utilizar nossa Plataforma, você (&quot;Usuário&quot;, &quot;Barbearia&quot; ou &quot;Cliente&quot;) concorda expressamente com estes Termos. Se você não concordar com alguma disposição, não deverá utilizar nossos serviços.
              </p>

              <hr className="border-border-subtle my-3" />

              <div className="space-y-2">
                <h3 className="font-bold text-sm text-gold-base">1. Objeto do Serviço</h3>
                <p className="text-content-muted">
                  1.1. Nossa Plataforma oferece um sistema completo de gestão e agendamento online voltado para o setor de barbearias, incluindo funcionalidades como agenda digital, controle de clientes, envio de notificações/lembretes (WhatsApp/E-mail), programa de fidelidade e relatórios.
                </p>
                <p className="text-content-muted">
                  1.2. O serviço é fornecido na modalidade de software como serviço (SaaS), sendo acessível via web e/ou dispositivos móveis.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-sm text-gold-base">2. Cadastro e Conta do Usuário</h3>
                <p className="text-content-muted">
                  2.1. Para utilizar a Plataforma, o Usuário deve fornecer informações verdadeiras, completas e atualizadas (como nome, telefone e e-mail) durante o cadastro.
                </p>
                <p className="text-content-muted">
                  2.2. O Usuário é o único responsável pela segurança de sua senha/credenciais e por todas as atividades realizadas em sua conta.
                </p>
                <p className="text-content-muted">
                  2.3. A Plataforma não se responsabiliza por prejuízos decorrentes de acesso não autorizado à conta do usuário por negligência na guarda de credenciais.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-sm text-gold-base">3. Agendamentos, Cancelamentos e Conduta</h3>
                <p className="text-content-muted">
                  3.1. Os agendamentos realizados pela Plataforma estão sujeitos à disponibilidade de horários e profissionais cadastrados.
                </p>
                <p className="text-content-muted">
                  3.2. Cancelamentos e remarcações devem respeitar a política de horários estipulada pela barbearia.
                </p>
                <p className="text-content-muted">
                  3.3. O Usuário compromete-se a não utilizar a Plataforma para fins ilegais, não autorizados ou inserção de dados falsos.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-sm text-gold-base">4. Propriedade Intelectual</h3>
                <p className="text-content-muted">
                  4.1. Todos os direitos de propriedade intelectual relacionados à Plataforma (código-fonte, design, logotipos, marcas, textos e funcionalidades) pertencem exclusivamente ao <strong>Navo Barber & Club</strong>.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-sm text-gold-base">5. Disponibilidade e Suporte</h3>
                <p className="text-content-muted">
                  5.1. Empenhamo-nos para manter a Plataforma disponível de forma contínua, ressalvadas manutenções programadas ou instabilidades de infraestrutura de terceiros.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-sm text-gold-base">6. Alterações dos Termos</h3>
                <p className="text-content-muted">
                  Reservamo-nos o direito de alterar estes Termos a qualquer momento. Alterações significativas serão comunicadas através da Plataforma. O uso continuado após as alterações implica na aceitação dos novos termos.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-content-muted">
                Esta Política de Privacidade descreve como o <strong>Navo Barber & Club</strong> coleta, usa, armazena e protege as informações dos usuários e clientes finais, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).
              </p>

              <hr className="border-border-subtle my-3" />

              <div className="space-y-2">
                <h3 className="font-bold text-sm text-gold-base">1. Informações que Coletamos</h3>
                <p className="text-content-muted">Coletamos os seguintes dados necessários para a prestação do serviço:</p>
                <ul className="list-disc pl-5 space-y-1 text-content-muted">
                  <li><strong>Dados Cadastrais do Cliente:</strong> Nome completo, e-mail, número de telefone/WhatsApp.</li>
                  <li><strong>Dados de Atendimento e Histórico:</strong> Serviços agendados, datas, horários, profissional escolhido, histórico de visitas e pontuação no programa de fidelidade.</li>
                  <li><strong>Dados de Pagamento:</strong> Informações de transações e comandas (quando aplicável).</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-sm text-gold-base">2. Como Utilizamos os Dados</h3>
                <p className="text-content-muted">Utilizamos as informações coletadas para:</p>
                <ul className="list-disc pl-5 space-y-1 text-content-muted">
                  <li>Fornecer, operar e manter a Plataforma e suas funcionalidades de agendamento;</li>
                  <li>Enviar notificações transacionais, como confirmações e lembretes de agendamento via WhatsApp ou e-mail;</li>
                  <li>Gerenciar seu histórico e benefícios do clube de fidelidade;</li>
                  <li>Prestar suporte técnico e responder a solicitações;</li>
                  <li>Garantir a segurança e integridade do sistema.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-sm text-gold-base">3. Compartilhamento de Dados</h3>
                <p className="text-content-muted">
                  Não comercializamos seus dados pessoais. O compartilhamento ocorre estritamente com provedores de infraestrutura (como servidores em nuvem e gateways de envio de mensagens/e-mail) necessários para o funcionamento do sistema ou por determinação legal/judicial.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-sm text-gold-base">4. Segurança da Informação</h3>
                <p className="text-content-muted">
                  Adotamos medidas técnicas e administrativas aptas a proteger os dados pessoais contra acessos não autorizados, destruição, perda ou alteração, incluindo criptografia e controle restrito de acesso aos bancos de dados.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-sm text-gold-base">5. Direitos dos Titulares (LGPD)</h3>
                <p className="text-content-muted">
                  Nos termos da LGPD, você possui o direito de confirmar a existência do tratamento, acessar seus dados, solicitar a correção de dados incompletos ou inexatos, ou solicitar a exclusão de sua conta e dados associados.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-sm text-gold-base">6. Contato</h3>
                <p className="text-content-muted">
                  Para dúvidas sobre esta Política de Privacidade ou solicitações relativas aos seus dados pessoais, entre em contato através do nosso canal de atendimento oficial.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border-subtle bg-surface-base flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-6 bg-gold-base hover:bg-gold-base/90 text-surface-base font-bold text-xs rounded-xl transition-all active:scale-95 shadow-xs"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
