import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Database,
  ListOrdered,
  RefreshCw,
  Save,
  Timer,
  UserRoundCheck,
} from "lucide-react";
import {
  defaultOperationSettings,
  fetchOperationSettings,
  saveOperationSettings,
  type OperationSettings,
} from "../../services/operationSettingsService";

type StatusMessage = { type: "success" | "error"; text: string } | null;

const fieldClass =
  "w-full bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-xl p-3 text-sm text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)] min-w-0 num-tabular";
const labelClass =
  "text-xs font-bold text-[var(--admin-text-muted)] uppercase tracking-wider block mb-1.5";

export const AgendaAvailabilitySettings: React.FC = () => {
  const [settings, setSettings] = useState<OperationSettings>(
    defaultOperationSettings,
  );
  const [savedSettings, setSavedSettings] = useState<OperationSettings>(
    defaultOperationSettings,
  );
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
        if (!cancelled)
          setStatusMsg({
            type: "error",
            text: error.message || "Não foi possível carregar a Agenda.",
          });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = <K extends keyof OperationSettings>(
    key: K,
    value: OperationSettings[K],
  ) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setStatusMsg(null);
  };

  const handleCancel = () => {
    setSettings(savedSettings);
    setStatusMsg({ type: "success", text: "Alterações descartadas." });
  };

  const handleSave = async () => {
    setStatusMsg(null);
    if (
      settings.maximumBookingHorizonDays < 1 ||
      settings.maximumBookingHorizonDays > 730
    ) {
      setStatusMsg({
        type: "error",
        text: "O limite deve ficar entre 1 e 730 dias.",
      });
      return;
    }
    if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(settings.reportsDayStartTime)) {
      setStatusMsg({
        type: "error",
        text: "Informe um início válido entre 00:00 e 23:59.",
      });
      return;
    }
    setIsSaving(true);
    try {
      const saved = await saveOperationSettings(settings);
      setSettings(saved);
      setSavedSettings(saved);
      setStatusMsg({ type: "success", text: "Configurações salvas." });
    } catch (error: any) {
      setStatusMsg({
        type: "error",
        text: error.message || "Não foi possível salvar as configurações.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-sm text-[var(--admin-text-muted)] py-10 text-center">
        Carregando agenda...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl min-w-0">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <CalendarDays className="w-5 h-5 text-[var(--admin-accent)]" />
          <h2 className="text-base sm:text-lg font-serif font-bold text-[var(--admin-text-main)]">
            Agenda e horários
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-[var(--admin-text-muted)] leading-relaxed">
          Defina horários, reservas e intervalos. Agendamentos existentes não
          mudam.
        </p>
      </div>

      {statusMsg && (
        <div
          className={`p-3.5 rounded-xl flex items-start gap-2.5 text-sm font-bold ${statusMsg.type === "success" ? "bg-status-success/10 border border-status-success/30 text-status-success" : "bg-status-error/10 border border-status-error/30 text-status-error"}`}
        >
          {statusMsg.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      <section className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-[var(--admin-border)]">
          <Clock3 className="w-4 h-4 text-[var(--admin-accent)]" />
          <h3 className="text-sm font-bold text-[var(--admin-text-main)]">
            Horários
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Intervalo</label>
            <select
              value={settings.slotIntervalMinutes}
              onChange={(e) =>
                update("slotIntervalMinutes", Number(e.target.value))
              }
              className={fieldClass}
            >
              {[5, 10, 15, 20, 30, 60].map((value) => (
                <option key={value} value={value}>
                  {value} minutos
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-[var(--admin-text-muted)]">
              Define o intervalo exibido para o cliente e no Admin.
            </p>
          </div>

          <div>
            <label className={labelClass}>Antecedência no dia</label>
            <input
              type="number"
              min={0}
              max={1440}
              step={5}
              value={settings.sameDayBookingCutoffMinutes}
              onChange={(e) =>
                update(
                  "sameDayBookingCutoffMinutes",
                  Math.max(0, Number(e.target.value) || 0),
                )
              }
              className={fieldClass}
            />
            <p className="mt-1.5 text-xs text-[var(--admin-text-muted)]">
              Ex.: 60 bloqueia reservas com menos de 1 hora.
            </p>
          </div>

          <div>
            <label className={labelClass}>Antecedência mínima</label>
            <input
              type="number"
              min={0}
              max={10080}
              step={5}
              value={settings.minimumBookingLeadMinutes}
              onChange={(e) =>
                update(
                  "minimumBookingLeadMinutes",
                  Math.max(0, Number(e.target.value) || 0),
                )
              }
              className={fieldClass}
            />
            <p className="mt-1.5 text-xs text-[var(--admin-text-muted)]">
              Regra de segurança para reservas no dia.
            </p>
          </div>

          <div>
            <label className={labelClass}>Horizonte de reserva</label>
            <input
              type="number"
              min={1}
              max={730}
              step={1}
              value={settings.maximumBookingHorizonDays}
              onChange={(e) =>
                update(
                  "maximumBookingHorizonDays",
                  Math.max(1, Number(e.target.value) || 1),
                )
              }
              className={fieldClass}
            />
            <p className="mt-1.5 text-xs text-[var(--admin-text-muted)]">
              Limite de dias para escolher uma data.
            </p>
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass}>Intervalo entre atendimentos</label>
            <div className="relative">
              <Timer className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--admin-text-muted)]" />
              <input
                type="number"
                min={0}
                max={120}
                step={5}
                value={settings.bufferBetweenAppointmentsMinutes}
                onChange={(e) =>
                  update(
                    "bufferBetweenAppointmentsMinutes",
                    Math.max(0, Number(e.target.value) || 0),
                  )
                }
                className={`${fieldClass} pl-10`}
              />
            </div>
            <p className="mt-1.5 text-xs text-[var(--admin-text-muted)]">
              Tempo para organização, limpeza e preparo.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-[var(--admin-border)]">
          <ListOrdered className="w-4 h-4 text-[var(--admin-accent)]" />
          <h3 className="text-sm font-bold text-[var(--admin-text-main)]">
            Fila
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Atualização automática</label>
            <div className="relative">
              <RefreshCw className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--admin-text-muted)]" />
              <input
                type="number"
                min={5}
                max={300}
                step={5}
                value={settings.queueRefreshSeconds}
                onChange={(e) =>
                  update(
                    "queueRefreshSeconds",
                    Math.max(5, Number(e.target.value) || 5),
                  )
                }
                className={`${fieldClass} pl-10`}
              />
            </div>
            <p className="mt-1.5 text-xs text-[var(--admin-text-muted)]">
              Frequência de atualização da fila.
            </p>
          </div>

          <div>
            <label className={labelClass}>Espera base</label>
            <input
              type="number"
              min={1}
              max={240}
              step={5}
              value={settings.queueBaseWaitMinutes}
              onChange={(e) =>
                update(
                  "queueBaseWaitMinutes",
                  Math.max(1, Number(e.target.value) || 1),
                )
              }
              className={fieldClass}
            />
            <p className="mt-1.5 text-xs text-[var(--admin-text-muted)]">
              Estimativa para novos clientes.
            </p>
          </div>

          <div>
            <label className={labelClass}>Limite visível</label>
            <input
              type="number"
              min={1}
              max={20}
              step={1}
              value={settings.queueVisibleLimit}
              onChange={(e) =>
                update(
                  "queueVisibleLimit",
                  Math.max(1, Number(e.target.value) || 1),
                )
              }
              className={fieldClass}
            />
            <p className="mt-1.5 text-xs text-[var(--admin-text-muted)]">
              Mantém a fila compacta; o excesso rola.
            </p>
          </div>

          <div className="sm:col-span-2 space-y-3">
            <label className="flex items-start justify-between gap-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)] p-3.5 cursor-pointer">
              <span className="flex items-start gap-2.5">
                <UserRoundCheck className="w-4 h-4 text-[var(--admin-accent)] mt-0.5 shrink-0" />
                <span>
                  <strong className="block text-sm text-[var(--admin-text-main)]">
                    Permitir encaixe
                  </strong>
                  <span className="block mt-0.5 text-xs text-[var(--admin-text-muted)]">
                    Libera encaixe sem agendamento.
                  </span>
                </span>
              </span>
              <input
                type="checkbox"
                checked={settings.allowWalkIn}
                onChange={(e) => update("allowWalkIn", e.target.checked)}
                className="mt-1 w-4 h-4 accent-gold-base"
              />
            </label>
            <label className="flex items-start justify-between gap-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)] p-3.5 cursor-pointer">
              <span>
                <strong className="block text-sm text-[var(--admin-text-main)]">
                  Exigir barbeiro
                </strong>
                <span className="block mt-0.5 text-xs text-[var(--admin-text-muted)]">
                  Não salva encaixe sem barbeiro.
                </span>
              </span>
              <input
                type="checkbox"
                checked={settings.requireProfessionalForWalkIn}
                onChange={(e) =>
                  update("requireProfessionalForWalkIn", e.target.checked)
                }
                className="mt-1 w-4 h-4 accent-gold-base"
              />
            </label>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-[var(--admin-border)]">
          <BarChart3 className="w-4 h-4 text-[var(--admin-accent)]" />
          <h3 className="text-sm font-bold text-[var(--admin-text-main)]">
            Relatórios
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Início do dia</label>
            <input
              type="time"
              value={settings.reportsDayStartTime}
              onChange={(e) => update("reportsDayStartTime", e.target.value)}
              className={fieldClass}
            />
            <p className="mt-1.5 text-xs text-[var(--admin-text-muted)]">
              Antes disso, vale o dia anterior em BRT.
            </p>
          </div>
          <div>
            <label className={labelClass}>Atualização dos relatórios</label>
            <input
              type="number"
              min={15}
              max={300}
              step={15}
              value={settings.reportsRefreshSeconds}
              onChange={(e) =>
                update(
                  "reportsRefreshSeconds",
                  Math.max(15, Number(e.target.value) || 15),
                )
              }
              className={fieldClass}
            />
            <p className="mt-1.5 text-xs text-[var(--admin-text-muted)]">
              Frequência de consulta do dashboard.
            </p>
          </div>
          <div>
            <label className={labelClass}>Comparação</label>
            <select
              value={settings.reportsComparisonWindow}
              onChange={(e) =>
                update(
                  "reportsComparisonWindow",
                  e.target
                    .value as OperationSettings["reportsComparisonWindow"],
                )
              }
              className={fieldClass}
            >
              <option value="previous_period">Período anterior</option>
              <option value="none">Sem comparação</option>
            </select>
            <p className="mt-1.5 text-xs text-[var(--admin-text-muted)]">
              Cria referência sem mudar os valores.
            </p>
          </div>
          <div className="sm:col-span-2 space-y-3">
            <label className="flex items-start justify-between gap-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)] p-3.5 cursor-pointer">
              <span>
                <strong className="block text-sm text-[var(--admin-text-main)]">
                  Mostrar pendentes
                </strong>
                <span className="block mt-0.5 text-xs text-[var(--admin-text-muted)]">
                  Exibe a receber sem tratar como receita.
                </span>
              </span>
              <input
                type="checkbox"
                checked={settings.reportsShowPendingValues}
                onChange={(e) =>
                  update("reportsShowPendingValues", e.target.checked)
                }
                className="mt-1 w-4 h-4 accent-gold-base"
              />
            </label>
            <label className="flex items-start justify-between gap-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)] p-3.5 cursor-pointer">
              <span>
                <strong className="block text-sm text-[var(--admin-text-main)]">
                  Incluir cancelados
                </strong>
                <span className="block mt-0.5 text-xs text-[var(--admin-text-muted)]">
                  Mostra cancelamentos sem somar receita ou conclusão.
                </span>
              </span>
              <input
                type="checkbox"
                checked={settings.reportsIncludeCancelled}
                onChange={(e) =>
                  update("reportsIncludeCancelled", e.target.checked)
                }
                className="mt-1 w-4 h-4 accent-gold-base"
              />
            </label>
            <label className="flex items-start justify-between gap-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)] p-3.5 cursor-pointer">
              <span>
                <strong className="block text-sm text-[var(--admin-text-main)]">
                  Incluir faltas
                </strong>
                <span className="block mt-0.5 text-xs text-[var(--admin-text-muted)]">
                  Mostra faltas sem contar como concluído.
                </span>
              </span>
              <input
                type="checkbox"
                checked={settings.reportsIncludeNoShow}
                onChange={(e) =>
                  update("reportsIncludeNoShow", e.target.checked)
                }
                className="mt-1 w-4 h-4 accent-gold-base"
              />
            </label>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-[var(--admin-border)]">
          <Database className="w-4 h-4 text-[var(--admin-accent)]" />
          <h3 className="text-sm font-bold text-[var(--admin-text-main)]">
            Atualização técnica
          </h3>
        </div>
        <div>
          <label className={labelClass}>Cache de disponibilidade</label>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <input
              type="number"
              min={5}
              max={300}
              step={5}
              value={settings.availabilityCacheTtlSeconds}
              onChange={(e) =>
                update(
                  "availabilityCacheTtlSeconds",
                  Math.max(5, Number(e.target.value) || 5),
                )
              }
              className={`${fieldClass} sm:max-w-[220px]`}
            />
            <span className="text-sm text-[var(--admin-text-muted)]">
              segundos
            </span>
          </div>
          <p className="mt-1.5 text-xs text-[var(--admin-text-muted)]">
            Controla por quanto tempo uma consulta de horários pode ser
            reaproveitada. Alterações salvas limpam o cache imediatamente.
          </p>
        </div>
      </section>

      <div className="pt-5 border-t border-[var(--admin-border)] flex flex-col sm:flex-row sm:justify-end gap-2">
        <button
          type="button"
          onClick={handleCancel}
          disabled={isSaving}
          className="h-11 sm:h-10 w-full sm:w-auto px-5 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-bg)] text-sm font-bold transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="h-11 sm:h-10 w-full sm:w-auto px-5 bg-[var(--admin-accent)] text-[var(--admin-accent-text)] hover:bg-[var(--admin-accent)]/90 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? "Salvando..." : "Salvar Alterações"}</span>
        </button>
      </div>
    </div>
  );
};
