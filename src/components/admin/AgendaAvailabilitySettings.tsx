import React, { useEffect, useState } from 'react';
import { AlertCircle, CalendarDays, CheckCircle2, Clock3, Database, Save, Timer } from 'lucide-react';
import {
  defaultOperationSettings,
  fetchOperationSettings,
  saveOperationSettings,
  type OperationSettings,
} from '../../services/operationSettingsService';

type StatusMessage = { type: 'success' | 'error'; text: string } | null;

const fieldClass = 'w-full bg-surface-card border border-border-subtle rounded-xl p-3 text-sm text-content-base focus:outline-none focus:border-gold-base min-w-0 num-tabular';
const labelClass = 'text-[11px] font-bold text-content-muted uppercase tracking-wider block mb-1.5';

export const AgendaAvailabilitySettings: React.FC = () => {
  const [settings, setSettings] = useState<OperationSettings>(defaultOperationSettings);
  const [savedSettings, setSavedSettings] = useState<OperationSettings>(defaultOperationSettings);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<StatusMessage>(null);

  useEffect(() => {
    let cancelled = false;
    fetchOperationSettings(true)
      .then((data) => {
        if (cancelled) return;
        setSettings(data);
        setSavedSettings(data);
      })
      .catch((error: any) => {
        if (!cancelled) setStatusMsg({ type: 'error', text: error.message || 'Não foi possível carregar a Agenda.' });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const update = <K extends keyof OperationSettings>(key: K, value: OperationSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setStatusMsg(null);
  };

  const handleCancel = () => {
    setSettings(savedSettings);
    setStatusMsg({ type: 'success', text: 'Alterações descartadas.' });
  };

  const handleSave = async () => {
    setStatusMsg(null);
    if (settings.maximumBookingHorizonDays < 1 || settings.maximumBookingHorizonDays > 730) {
      setStatusMsg({ type: 'error', text: 'O horizonte deve ficar entre 1 e 730 dias.' });
      return;
    }
    setIsSaving(true);
    try {
      const saved = await saveOperationSettings(settings);
      setSettings(saved);
      setSavedSettings(saved);
      setStatusMsg({ type: 'success', text: 'Configurações de Agenda salvas com sucesso.' });
    } catch (error: any) {
      setStatusMsg({ type: 'error', text: error.message || 'Não foi possível salvar as configurações.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-content-muted py-10 text-center">Carregando configurações de Agenda...</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl min-w-0">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <CalendarDays className="w-5 h-5 text-gold-base" />
          <h2 className="text-base sm:text-lg font-serif font-bold text-content-base">Agenda e Disponibilidade</h2>
        </div>
        <p className="text-xs sm:text-sm text-content-muted leading-relaxed">
          Ajuste como o sistema cria horários, limita novas reservas e protege a distância entre atendimentos. As mudanças afetam o fluxo público e a grade da Agenda; agendamentos já registrados não são alterados.
        </p>
      </div>

      {statusMsg && (
        <div className={`p-3.5 rounded-xl flex items-start gap-2.5 text-sm font-bold ${statusMsg.type === 'success' ? 'bg-status-success/10 border border-status-success/30 text-status-success' : 'bg-status-error/10 border border-status-error/30 text-status-error'}`}>
          {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      <section className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-border-subtle">
          <Clock3 className="w-4 h-4 text-gold-base" />
          <h3 className="text-sm font-bold text-content-base">Regras de horários</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Intervalo entre horários</label>
            <select value={settings.slotIntervalMinutes} onChange={(e) => update('slotIntervalMinutes', Number(e.target.value))} className={fieldClass}>
              {[5, 10, 15, 20, 30, 60].map((value) => <option key={value} value={value}>{value} minutos</option>)}
            </select>
            <p className="mt-1.5 text-xs text-content-muted">Define de quanto em quanto tempo os horários aparecem para o cliente e no Admin.</p>
          </div>

          <div>
            <label className={labelClass}>Antecedência mínima no mesmo dia</label>
            <input type="number" min={0} max={1440} step={5} value={settings.sameDayBookingCutoffMinutes} onChange={(e) => update('sameDayBookingCutoffMinutes', Math.max(0, Number(e.target.value) || 0))} className={fieldClass} />
            <p className="mt-1.5 text-xs text-content-muted">Ex.: 60 impede reservas para horários que começam em menos de uma hora.</p>
          </div>

          <div>
            <label className={labelClass}>Antecedência mínima geral</label>
            <input type="number" min={0} max={10080} step={5} value={settings.minimumBookingLeadMinutes} onChange={(e) => update('minimumBookingLeadMinutes', Math.max(0, Number(e.target.value) || 0))} className={fieldClass} />
            <p className="mt-1.5 text-xs text-content-muted">Usada como regra de segurança para reservas feitas no dia atual.</p>
          </div>

          <div>
            <label className={labelClass}>Horizonte máximo de agendamento</label>
            <input type="number" min={1} max={730} step={1} value={settings.maximumBookingHorizonDays} onChange={(e) => update('maximumBookingHorizonDays', Math.max(1, Number(e.target.value) || 1))} className={fieldClass} />
            <p className="mt-1.5 text-xs text-content-muted">Impede que o cliente escolha uma data além deste número de dias.</p>
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass}>Margem entre atendimentos</label>
            <div className="relative">
              <Timer className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
              <input type="number" min={0} max={120} step={5} value={settings.bufferBetweenAppointmentsMinutes} onChange={(e) => update('bufferBetweenAppointmentsMinutes', Math.max(0, Number(e.target.value) || 0))} className={`${fieldClass} pl-10`} />
            </div>
            <p className="mt-1.5 text-xs text-content-muted">Reserva esta margem antes e depois de cada atendimento para organização, limpeza e preparação.</p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-border-subtle">
          <Database className="w-4 h-4 text-gold-base" />
          <h3 className="text-sm font-bold text-content-base">Atualização técnica</h3>
        </div>
        <div>
          <label className={labelClass}>Cache de disponibilidade</label>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <input type="number" min={5} max={300} step={5} value={settings.availabilityCacheTtlSeconds} onChange={(e) => update('availabilityCacheTtlSeconds', Math.max(5, Number(e.target.value) || 5))} className={`${fieldClass} sm:max-w-[220px]`} />
            <span className="text-sm text-content-muted">segundos</span>
          </div>
          <p className="mt-1.5 text-xs text-content-muted">Controla por quanto tempo uma consulta de horários pode ser reaproveitada. Alterações salvas limpam o cache imediatamente.</p>
        </div>
      </section>

      <div className="pt-5 border-t border-border-subtle flex flex-col sm:flex-row sm:justify-end gap-2">
        <button type="button" onClick={handleCancel} disabled={isSaving} className="h-11 sm:h-10 w-full sm:w-auto px-5 rounded-xl border border-border-subtle bg-surface-card text-content-muted hover:text-content-base hover:bg-surface-base text-sm font-bold transition-colors disabled:opacity-50">
          Cancelar
        </button>
        <button type="button" onClick={handleSave} disabled={isSaving} className="h-11 sm:h-10 w-full sm:w-auto px-5 bg-gold-base text-surface-base hover:bg-gold-base/90 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap">
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Salvando...' : 'Salvar Alterações'}</span>
        </button>
      </div>
    </div>
  );
};
