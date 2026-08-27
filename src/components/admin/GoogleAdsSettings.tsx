import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Link2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Target,
} from "lucide-react";
import { AdminPageHeader } from "./shared/AdminPageHeader";
import { AdminListSkeleton } from "./shared/AdminSkeleton";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import {
  disconnectGoogleAds,
  getGoogleAdsAssets,
  getGoogleAdsStatus,
  saveGoogleAdsCustomer,
  startGoogleAdsOAuth,
  type GoogleAdsConnection,
  type GoogleAdsCustomer,
} from "../../services/googleAdsService";
import {
  CAMPAIGNS_DEMO_MODE,
  demoGoogleConnection,
  demoGoogleCustomers,
} from "../../services/campaignDemoData";

interface GoogleAdsSettingsProps {
  onOpenCampaigns?: (provider?: "meta" | "google") => void;
}

export const GoogleAdsSettings: React.FC<GoogleAdsSettingsProps> = ({
  onOpenCampaigns,
}) => {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{
    configured: boolean;
    apiVersion: string;
    connection: GoogleAdsConnection | null;
  } | null>(null);
  const [customers, setCustomers] = useState<GoogleAdsCustomer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [disconnectOpen, setDisconnectOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    setMessage(null);
    if (CAMPAIGNS_DEMO_MODE) {
      setStatus({
        configured: true,
        apiVersion: "v25",
        connection: { ...demoGoogleConnection },
      });
      setCustomerId(demoGoogleConnection.customerId || "");
      setCustomers([...demoGoogleCustomers]);
      setLoading(false);
      return;
    }
    try {
      const nextStatus = await getGoogleAdsStatus();
      setStatus(nextStatus);
      setCustomerId(nextStatus.connection?.customerId || "");
      if (nextStatus.connection?.status === "connected") {
        const assets = await getGoogleAdsAssets();
        setCustomers(assets.customers);
        setStatus((previous) =>
          previous ? { ...previous, connection: assets.connection } : previous,
        );
      } else {
        setCustomers([]);
      }
    } catch (error: any) {
      const text =
        error?.message || "Não foi possível carregar a integração Google Ads.";
      setLoadError(text);
      setMessage({ type: "error", text });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const params = new URLSearchParams(window.location.search);
    const result = params.get("google_ads_result");
    const reason = params.get("reason");
    if (result === "connected")
      setMessage({
        type: "success",
        text: "Conta Google autorizada. Confirme a conta de anúncios abaixo.",
      });
    if (result === "error")
      setMessage({
        type: "error",
        text: reason || "A autorização Google não foi concluída.",
      });
    if (result) window.history.replaceState({}, "", "/admin");
  }, []);

  const connect = async () => {
    setBusy(true);
    setMessage(null);
    if (CAMPAIGNS_DEMO_MODE) {
      setMessage({
        type: "success",
        text: "A conexão Google é apenas demonstrativa. Nenhuma autorização foi iniciada.",
      });
      setBusy(false);
      return;
    }
    try {
      const response = await startGoogleAdsOAuth();
      window.location.assign(response.url);
    } catch (error: any) {
      setMessage({
        type: "error",
        text:
          error?.message || "Não foi possível iniciar a conexão Google Ads.",
      });
      setBusy(false);
    }
  };

  const refreshAssets = async () => {
    setBusy(true);
    setMessage(null);
    if (CAMPAIGNS_DEMO_MODE) {
      setCustomers([...demoGoogleCustomers]);
      setStatus((previous) =>
        previous
          ? {
              ...previous,
              connection: {
                ...demoGoogleConnection,
                lastSyncedAt: new Date().toISOString(),
              },
            }
          : previous,
      );
      setMessage({
        type: "success",
        text: "Contas demonstrativas atualizadas. Nenhuma conta externa foi consultada.",
      });
      setBusy(false);
      return;
    }
    try {
      const response = await getGoogleAdsAssets();
      setCustomers(response.customers);
      setStatus((previous) =>
        previous ? { ...previous, connection: response.connection } : previous,
      );
      setMessage({ type: "success", text: "Contas Google Ads atualizadas." });
    } catch (error: any) {
      setMessage({
        type: "error",
        text:
          error?.message || "Não foi possível atualizar as contas Google Ads.",
      });
    } finally {
      setBusy(false);
    }
  };

  const saveCustomer = async () => {
    if (!customerId) {
      setMessage({ type: "error", text: "Selecione uma conta Google Ads." });
      return;
    }
    setBusy(true);
    setMessage(null);
    if (CAMPAIGNS_DEMO_MODE) {
      const customer = demoGoogleCustomers.find(
        (item) => item.customerId === customerId,
      );
      setStatus((previous) =>
        previous
          ? {
              ...previous,
              connection: {
                ...demoGoogleConnection,
                customerId: customer?.customerId || customerId,
                customerName:
                  customer?.name || demoGoogleConnection.customerName,
              },
            }
          : previous,
      );
      setMessage({
        type: "success",
        text: "Conta atualizada apenas na demonstração. Nenhuma conta Google foi alterada.",
      });
      setBusy(false);
      return;
    }
    try {
      const response = await saveGoogleAdsCustomer(customerId);
      setStatus((previous) =>
        previous ? { ...previous, connection: response.connection } : previous,
      );
      setLoadError(null);
      setMessage({
        type: "success",
        text: "Conta Google Ads salva. O módulo Campanhas já pode usar esta conta.",
      });
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Não foi possível salvar a conta Google Ads.",
      });
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      if (CAMPAIGNS_DEMO_MODE) {
        setStatus((previous) =>
          previous
            ? {
                ...previous,
                connection: {
                  ...demoGoogleConnection,
                  status: "disconnected",
                  customerId: null,
                },
              }
            : previous,
        );
        setCustomers([]);
        setCustomerId("");
        setMessage({
          type: "success",
          text: "Conexão demonstrativa removida apenas desta tela. Nenhum token ou ativo real foi alterado.",
        });
        return;
      }
      await disconnectGoogleAds();
      setStatus((previous) =>
        previous ? { ...previous, connection: null } : previous,
      );
      setCustomers([]);
      setCustomerId("");
      setMessage({
        type: "success",
        text: "Conexão removida do Navo. O histórico local de campanhas foi preservado.",
      });
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Não foi possível remover a conexão.",
      });
    } finally {
      setBusy(false);
      setDisconnectOpen(false);
    }
  };

  if (loading)
    return (
      <div className="space-y-4">
        <AdminPageHeader icon={Target} title="Google Ads" />
        <AdminListSkeleton rows={5} />
      </div>
    );

  const connection = status?.connection;
  const connected = connection?.status === "connected";

  return (
    <div className="space-y-4 min-w-0">
      <AdminPageHeader
        icon={Target}
        title="Google Ads"
        stats={[
          {
            label: "conexão",
            value: connected
              ? CAMPAIGNS_DEMO_MODE
                ? "Demo"
                : "Ativa"
              : "Não conectada",
            tone: connected ? "success" : "muted",
          },
        ]}
        action={
          connected
            ? {
                label: "Abrir campanhas",
                icon: Target,
                onClick: () => onOpenCampaigns?.("google"),
              }
            : undefined
        }
      />

      {CAMPAIGNS_DEMO_MODE && (
        <div
          className="rounded-[var(--admin-radius-md)] border border-blue-400/25 bg-blue-500/10 px-3 py-2 text-xs text-blue-700 dark:text-blue-200"
          role="status"
        >
          <strong>Configuração demonstrativa:</strong> conexão, conta e ações
          abaixo são ilustrativas. OAuth, banco e contas reais ficam reservados
          para ativação futura.
        </div>
      )}

      {message && (
        <div
          className={`flex items-start gap-2 rounded-[var(--admin-radius-md)] border px-3 py-2.5 text-sm ${message.type === "success" ? "border-status-success/30 bg-status-success/10 text-status-success" : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"}`}
          role="status"
        >
          <span>
            {message.type === "success" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
          </span>
          <span>{message.text}</span>
        </div>
      )}

      {loadError && (
        <section className="rounded-[var(--admin-radius-lg)] border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-[var(--admin-text-main)]">
                Configuração ainda não carregada
              </h2>
              <p className="mt-1 break-words text-sm leading-relaxed text-[var(--admin-text-muted)]">
                {loadError}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-[var(--admin-radius-lg)] border border-amber-400/30 px-3 text-xs font-bold text-amber-700 dark:text-amber-200 hover:bg-amber-500/10 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />{" "}
              Tentar novamente
            </button>
          </div>
        </section>
      )}

      {!status?.configured && (
        <section className="rounded-[var(--admin-radius-lg)] border border-amber-500/30 bg-amber-500/10 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-[var(--admin-text-main)]">
                Integração ainda não configurada no servidor
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-[var(--admin-text-muted)]">
                Defina `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`,
                `GOOGLE_ADS_DEVELOPER_TOKEN` e `GOOGLE_ADS_REDIRECT_URI` no
                backend. Segredos nunca devem ser colocados no frontend ou no
                repositório.
              </p>
              <p className="mt-2 text-xs text-[var(--admin-text-muted)]">
                Callback esperado:{" "}
                <code className="break-all text-amber-700 dark:text-amber-200">
                  /api/google-ads/oauth/callback
                </code>{" "}
                · API: {status?.apiVersion || "v25"}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Cards de Status e Políticas */}
      <section className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
        <div className="rounded-[var(--admin-radius-lg)] bg-[var(--admin-surface)] p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--admin-radius-lg)] bg-blue-500/10 text-blue-700 dark:text-blue-300">
                <Link2 className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-[var(--admin-text-main)]">
                  {CAMPAIGNS_DEMO_MODE
                    ? "Conta ilustrativa"
                    : "Conta conectada"}
                </h2>
                <p className="mt-1 text-xs text-[var(--admin-text-muted)]">
                  {CAMPAIGNS_DEMO_MODE
                    ? "Nenhuma autorização Google foi realizada."
                    : "Autorização usada somente pelo backend do Navo."}
                </p>
              </div>
            </div>
            {connected && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-[var(--admin-radius-full)] bg-status-success/10 px-2 py-1 text-[11px] font-bold text-status-success">
                <CheckCircle2 className="h-3 w-3" />{" "}
                {CAMPAIGNS_DEMO_MODE ? "Demo" : "Ativa"}
              </span>
            )}
          </div>
          {connected ? (
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3 pb-2">
                <span className="text-[var(--admin-text-muted)]">
                  Usuário Google
                </span>
                <strong className="truncate text-[var(--admin-text-main)]">
                  {connection?.googleUserName || "Autorizado"}
                </strong>
              </div>
              <div className="flex justify-between gap-3 pb-2">
                <span className="text-[var(--admin-text-muted)]">
                  Conta selecionada
                </span>
                <strong className="truncate text-[var(--admin-text-main)]">
                  {connection?.customerName || "Selecione abaixo"}
                </strong>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-[var(--admin-text-muted)]">
                  Última sincronização
                </span>
                <strong className="text-[var(--admin-text-main)]">
                  {connection?.lastSyncedAt
                    ? new Date(connection.lastSyncedAt).toLocaleString("pt-BR")
                    : "Ainda não sincronizada"}
                </strong>
              </div>
              {connection?.lastError && (
                <p className="rounded-[var(--admin-radius-lg)] bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                  {connection.lastError}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={refreshAssets}
                  disabled={busy}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-[var(--admin-radius-lg)] bg-[var(--admin-bg)]/70 px-3 text-xs font-bold text-[var(--admin-text-main)] transition-colors hover:bg-[var(--admin-bg)] disabled:opacity-50"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`}
                  />{" "}
                  Atualizar contas
                </button>
                <button
                  type="button"
                  onClick={() => setDisconnectOpen(true)}
                  disabled={busy}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-[var(--admin-radius-lg)] bg-red-500/10 px-3 text-xs font-bold text-red-700 dark:text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                >
                  <LogOut className="h-3.5 w-3.5" /> Desconectar
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-[var(--admin-radius-lg)] bg-[var(--admin-bg)]/70 p-4 text-sm text-[var(--admin-text-muted)]">
              <p>
                {CAMPAIGNS_DEMO_MODE
                  ? "A demonstração foi desconectada apenas localmente. A integração real poderá ser configurada depois."
                  : "Conecte o Google Ads para escolher a conta que será usada nas campanhas."}
              </p>
              <button
                type="button"
                onClick={connect}
                disabled={!status?.configured || busy}
                className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-[var(--admin-radius-lg)] bg-[var(--admin-accent)] px-4 text-sm font-bold text-[var(--admin-accent-text)] transition-colors hover:bg-gold-hover disabled:pointer-events-none disabled:opacity-50"
              >
                <Link2 className="h-4 w-4" /> Conectar Google Ads
              </button>
            </div>
          )}
        </div>
        <div className="rounded-[var(--admin-radius-lg)] bg-[var(--admin-surface)] p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--admin-radius-md)] bg-blue-500/10 text-blue-700 dark:text-blue-300">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--admin-text-main)]">
                Política de operação
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[var(--admin-text-muted)]">
                Controles para criar campanhas simples sem ativação acidental.
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-2.5 text-xs text-[var(--admin-text-muted)]">
            <p className="flex gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-status-success" />{" "}
              Novas campanhas são criadas pausadas.
            </p>
            <p className="flex gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-status-success" />{" "}
              A ativação exige confirmação no módulo Campanhas.
            </p>
            <p className="flex gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-status-success" />{" "}
              {CAMPAIGNS_DEMO_MODE
                ? "Nenhum token é usado na demonstração."
                : "Tokens ficam somente no backend."}
            </p>
            <p className="flex gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-status-success" />{" "}
              O Navo não calcula impostos nem decide o orçamento por conta
              própria.
            </p>
          </div>
          <a
            href="https://developers.google.com/google-ads/api"
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[var(--admin-accent)] hover:text-[var(--admin-accent)]"
          >
            Documentação Google Ads API <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </section>

      {connected && (
        <section className="rounded-[var(--admin-radius-lg)] bg-[var(--admin-surface)] p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-[var(--admin-text-main)]">
                Conta usada pelo Navo
              </h2>
              <p className="mt-1 text-xs text-[var(--admin-text-muted)]">
                {CAMPAIGNS_DEMO_MODE
                  ? "Conta fictícia para visualizar o fluxo. Nenhuma conta real será alterada."
                  : "Escolha explicitamente a conta cliente Google Ads. O Navo não escolhe contas por conta própria."}
              </p>
            </div>
            <button
              type="button"
              onClick={saveCustomer}
              disabled={busy || !customerId}
              className="min-h-9 rounded-[var(--admin-radius-lg)] bg-[var(--admin-accent)] px-3 text-xs font-bold text-[var(--admin-accent-text)] hover:bg-gold-hover disabled:pointer-events-none disabled:opacity-50"
            >
              Salvar seleção
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <label className="block text-xs font-semibold text-[var(--admin-text-muted)]">
              Conta cliente Google Ads
              <select
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
                className="mt-1.5 h-10 w-full rounded-[var(--admin-radius-lg)] bg-[var(--admin-bg)] px-3 text-sm text-[var(--admin-text-main)] outline-none focus:ring-1 focus:ring-[var(--admin-accent)]"
              >
                <option value="">Selecione</option>
                {customers
                  .filter((customer) => !customer.manager)
                  .map((customer) => (
                    <option
                      key={customer.customerId}
                      value={customer.customerId}
                    >
                      {customer.name} · {customer.customerId} ·{" "}
                      {customer.currency || "BRL"}
                    </option>
                  ))}
              </select>
            </label>
            <button
              type="button"
              onClick={refreshAssets}
              disabled={busy}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[var(--admin-radius-lg)] bg-[var(--admin-bg)]/70 px-3 text-xs font-bold text-[var(--admin-text-main)] hover:bg-[var(--admin-bg)] disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`}
              />{" "}
              Atualizar
            </button>
          </div>
          {customers.length === 0 && (
            <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
              O Google não retornou contas acessíveis. Verifique o Customer ID,
              as permissões do usuário e o vínculo com a conta de administrador.
            </p>
          )}
        </section>
      )}

      <ConfirmDialog
        isOpen={disconnectOpen}
        onClose={() => setDisconnectOpen(false)}
        onConfirm={disconnect}
        isLoading={busy}
        title="Desconectar Google Ads?"
        description="O Navo removerá o refresh token armazenado e preservará o histórico local. Campanhas já existentes continuarão sendo administradas no Google Ads até que você as pause por lá."
        confirmText="Desconectar"
        variant="danger"
      />
    </div>
  );
};
