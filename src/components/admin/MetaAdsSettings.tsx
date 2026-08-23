import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Link2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Target,
  AlertCircle,
} from "lucide-react";
import { AdminPageHeader } from "./shared/AdminPageHeader";
import { AdminListSkeleton } from "./shared/AdminSkeleton";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import {
  disconnectMetaAds,
  getMetaAdsAssets,
  getMetaAdsStatus,
  saveMetaAdsAssets,
  startMetaAdsOAuth,
  type MetaAdAccount,
  type MetaAdsConnection,
  type MetaPage,
} from "../../services/metaAdsService";
import {
  CAMPAIGNS_DEMO_MODE,
  demoMetaAccounts,
  demoMetaConnection,
  demoMetaPages,
} from "../../services/campaignDemoData";

interface MetaAdsSettingsProps {
  onOpenCampaigns?: (provider?: "meta" | "google") => void;
}

export const MetaAdsSettings: React.FC<MetaAdsSettingsProps> = ({
  onOpenCampaigns,
}) => {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{
    configured: boolean;
    graphApiVersion: string;
    connection: MetaAdsConnection | null;
  } | null>(null);
  const [accounts, setAccounts] = useState<MetaAdAccount[]>([]);
  const [pages, setPages] = useState<MetaPage[]>([]);
  const [accountId, setAccountId] = useState("");
  const [pageId, setPageId] = useState("");
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
        graphApiVersion: "v26.0",
        connection: { ...demoMetaConnection },
      });
      setAccountId(demoMetaConnection.adAccountId || "");
      setPageId(demoMetaConnection.pageId || "");
      setAccounts([...demoMetaAccounts]);
      setPages([...demoMetaPages]);
      setLoading(false);
      return;
    }
    try {
      const nextStatus = await getMetaAdsStatus();
      setStatus(nextStatus);
      setAccountId(nextStatus.connection?.adAccountId || "");
      setPageId(nextStatus.connection?.pageId || "");
      if (nextStatus.connection?.status === "connected") {
        const assets = await getMetaAdsAssets();
        setAccounts(assets.accounts);
        setPages(assets.pages);
      } else {
        setAccounts([]);
        setPages([]);
      }
    } catch (error: any) {
      const text =
        error?.message || "Não foi possível carregar a integração Meta Ads.";
      setLoadError(text);
      setMessage({ type: "error", text });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const params = new URLSearchParams(window.location.search);
    const result = params.get("metaAds");
    const reason = params.get("reason");
    if (result === "connected")
      setMessage({
        type: "success",
        text: "Conta Meta autorizada. Confirme a conta de anúncios e a Página abaixo.",
      });
    if (result === "error")
      setMessage({
        type: "error",
        text: reason || "A autorização Meta não foi concluída.",
      });
    if (result) window.history.replaceState({}, "", "/admin");
  }, []);

  const connect = async () => {
    setBusy(true);
    setMessage(null);
    if (CAMPAIGNS_DEMO_MODE) {
      setMessage({
        type: "success",
        text: "A conexão Meta é apenas demonstrativa. Nenhuma autorização foi iniciada.",
      });
      setBusy(false);
      return;
    }
    try {
      const response = await startMetaAdsOAuth();
      window.location.assign(response.url);
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Não foi possível iniciar a conexão Meta.",
      });
      setBusy(false);
    }
  };

  const refreshAssets = async () => {
    setBusy(true);
    setMessage(null);
    if (CAMPAIGNS_DEMO_MODE) {
      setAccounts([...demoMetaAccounts]);
      setPages([...demoMetaPages]);
      setStatus((previous) =>
        previous
          ? {
              ...previous,
              connection: {
                ...demoMetaConnection,
                lastSyncedAt: new Date().toISOString(),
              },
            }
          : previous,
      );
      setMessage({
        type: "success",
        text: "Ativos demonstrativos atualizados. Nenhuma conta externa foi consultada.",
      });
      setBusy(false);
      return;
    }
    try {
      const response = await getMetaAdsAssets();
      setAccounts(response.accounts);
      setPages(response.pages);
      setStatus((previous) =>
        previous ? { ...previous, connection: response.connection } : previous,
      );
      setMessage({ type: "success", text: "Ativos da Meta atualizados." });
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Não foi possível atualizar os ativos.",
      });
    } finally {
      setBusy(false);
    }
  };

  const saveAssets = async () => {
    if (!accountId || !pageId) {
      setMessage({
        type: "error",
        text: "Selecione uma conta de anúncios e uma Página.",
      });
      return;
    }
    setBusy(true);
    setMessage(null);
    if (CAMPAIGNS_DEMO_MODE) {
      const account = demoMetaAccounts.find((item) => item.id === accountId);
      const page = demoMetaPages.find((item) => item.id === pageId);
      setStatus((previous) =>
        previous
          ? {
              ...previous,
              connection: {
                ...demoMetaConnection,
                adAccountId: account?.id || accountId,
                adAccountName:
                  account?.name || demoMetaConnection.adAccountName,
                pageId: page?.id || pageId,
                pageName: page?.name || demoMetaConnection.pageName,
              },
            }
          : previous,
      );
      setMessage({
        type: "success",
        text: "Seleção atualizada apenas na demonstração. Nenhum ativo Meta foi alterado.",
      });
      setBusy(false);
      return;
    }
    try {
      const response = await saveMetaAdsAssets(accountId, pageId);
      setStatus((previous) =>
        previous ? { ...previous, connection: response.connection } : previous,
      );
      setLoadError(null);
      setMessage({
        type: "success",
        text: "Ativos Meta salvos. O módulo Campanhas já pode usar essa conta.",
      });
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Não foi possível salvar os ativos.",
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
                  ...demoMetaConnection,
                  status: "disconnected",
                  adAccountId: null,
                  pageId: null,
                },
              }
            : previous,
        );
        setAccounts([]);
        setPages([]);
        setAccountId("");
        setPageId("");
        setMessage({
          type: "success",
          text: "Conexão demonstrativa removida apenas desta tela. Nenhum token ou ativo real foi alterado.",
        });
        return;
      }
      await disconnectMetaAds();
      setStatus((previous) =>
        previous ? { ...previous, connection: null } : previous,
      );
      setAccounts([]);
      setPages([]);
      setAccountId("");
      setPageId("");
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
        <AdminPageHeader icon={Target} title="Meta Ads" />
        <AdminListSkeleton rows={5} />
      </div>
    );

  const connection = status?.connection;
  const connected = connection?.status === "connected";

  return (
    <div className="space-y-4 min-w-0">
      <AdminPageHeader
        icon={Target}
        title="Meta Ads"
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
                onClick: () => onOpenCampaigns?.("meta"),
              }
            : undefined
        }
      />

      {CAMPAIGNS_DEMO_MODE && (
        <div
          className="rounded-lg border border-blue-400/25 bg-blue-500/10 px-3 py-2 text-xs text-blue-100"
          role="status"
        >
          <strong>Configuração demonstrativa:</strong> conexão, ativos e ações
          abaixo são ilustrativos. OAuth, banco e contas reais ficam reservados
          para ativação futura.
        </div>
      )}

      {message && (
        <div
          className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${message.type === "success" ? "border-status-success/30 bg-status-success/10 text-status-success" : "border-red-500/30 bg-red-500/10 text-red-300"}`}
          role="status"
        >
          {message.type === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {loadError && (
        <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
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
              className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border border-amber-400/30 px-3 text-xs font-bold text-amber-200 hover:bg-amber-500/10 disabled:opacity-50"
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
        <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-[var(--admin-text-main)]">
                Integração ainda não configurada no servidor
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-[var(--admin-text-muted)]">
                Defina `META_ADS_APP_ID`, `META_ADS_APP_SECRET` e
                `META_ADS_REDIRECT_URI` no ambiente do backend. O App Secret
                nunca deve ser colocado no frontend ou no repositório.
              </p>
              <p className="mt-2 text-xs text-[var(--admin-text-muted)]">
                Callback esperado:{" "}
                <code className="break-all text-amber-200">
                  /api/meta-ads/oauth/callback
                </code>{" "}
                · Graph API: {status?.graphApiVersion || "v26.0"}
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
        <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--admin-accent)]/10 text-[var(--admin-accent)]">
                <Link2 className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-[var(--admin-text-main)]">
                  {CAMPAIGNS_DEMO_MODE
                    ? "Conexão ilustrativa"
                    : "Conta conectada"}
                </h2>
                <p className="mt-1 text-xs text-[var(--admin-text-muted)]">
                  {CAMPAIGNS_DEMO_MODE
                    ? "Nenhuma autorização Meta foi realizada."
                    : "Autorização usada somente pelo backend do Navo."}
                </p>
              </div>
            </div>
            {connected && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-status-success/10 px-2 py-1 text-[11px] font-bold text-status-success">
                <CheckCircle2 className="h-3 w-3" />{" "}
                {CAMPAIGNS_DEMO_MODE ? "Demo" : "Ativa"}
              </span>
            )}
          </div>
          {connected ? (
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3 border-b border-[var(--admin-border)] pb-2">
                <span className="text-[var(--admin-text-muted)]">
                  Usuário Meta
                </span>
                <strong className="truncate text-[var(--admin-text-main)]">
                  {connection?.metaUserName || "Autorizado"}
                </strong>
              </div>
              <div className="flex justify-between gap-3 border-b border-[var(--admin-border)] pb-2">
                <span className="text-[var(--admin-text-muted)]">
                  Conta de anúncios
                </span>
                <strong className="truncate text-[var(--admin-text-main)]">
                  {connection?.adAccountName || "Selecione abaixo"}
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
                <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  {connection.lastError}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={refreshAssets}
                  disabled={busy}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[var(--admin-border)] px-3 text-xs font-bold text-[var(--admin-text-main)] transition-colors hover:bg-[var(--admin-bg)] disabled:opacity-50"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`}
                  />{" "}
                  Atualizar ativos
                </button>
                <button
                  type="button"
                  onClick={() => setDisconnectOpen(true)}
                  disabled={busy}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-red-500/30 px-3 text-xs font-bold text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                >
                  <LogOut className="h-3.5 w-3.5" /> Desconectar
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-[var(--admin-border)] bg-[var(--admin-bg)] p-4 text-sm text-[var(--admin-text-muted)]">
              <p>
                {CAMPAIGNS_DEMO_MODE
                  ? "A demonstração foi desconectada apenas localmente. A integração real poderá ser configurada depois."
                  : "Conecte a conta Meta para escolher a conta de anúncios e a Página que serão usadas nas campanhas."}
              </p>
              <button
                type="button"
                onClick={connect}
                disabled={!status?.configured || busy}
                className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md bg-[var(--admin-accent)] px-4 text-sm font-bold text-[var(--admin-accent-text)] transition-colors hover:bg-gold-hover disabled:pointer-events-none disabled:opacity-50"
              >
                <Link2 className="h-4 w-4" /> Conectar Meta Ads
              </button>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-300">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--admin-text-main)]">
                Política de operação
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[var(--admin-text-muted)]">
                Controles para manter campanhas simples e evitar ativação
                acidental.
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
              Ativação exige confirmação no módulo Campanhas.
            </p>
            <p className="flex gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-status-success" />{" "}
              {CAMPAIGNS_DEMO_MODE
                ? "Nenhum token é usado na demonstração."
                : "Tokens ficam somente no backend."}
            </p>
            <p className="flex gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-status-success" />{" "}
              O Navo mostra erros retornados pela Meta sem ocultá-los.
            </p>
          </div>
          <a
            href="https://www.facebook.com/business/tools/ads-manager"
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[var(--admin-accent)] hover:text-[var(--admin-accent)]"
          >
            Abrir documentação da Meta <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </section>

      {connected && (
        <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-[var(--admin-text-main)]">
                Ativos usados pelo Navo
              </h2>
              <p className="mt-1 text-xs text-[var(--admin-text-muted)]">
                {CAMPAIGNS_DEMO_MODE
                  ? "Ativos fictícios para visualizar o fluxo. Nenhuma conta real será alterada."
                  : "Escolha explicitamente a conta de anúncios e a Página. O Navo não seleciona ativos por conta própria."}
              </p>
            </div>
            <button
              type="button"
              onClick={saveAssets}
              disabled={busy || !accountId || !pageId}
              className="min-h-9 rounded-md bg-[var(--admin-accent)] px-3 text-xs font-bold text-[var(--admin-accent-text)] hover:bg-gold-hover disabled:pointer-events-none disabled:opacity-50"
            >
              Salvar seleção
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="block text-xs font-semibold text-[var(--admin-text-muted)]">
              Conta de anúncios
              <select
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
                className="mt-1.5 h-10 w-full rounded-md border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3 text-sm text-[var(--admin-text-main)] outline-none focus:border-[var(--admin-accent)]"
              >
                <option value="">Selecione</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} · {account.currency || "BRL"}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-[var(--admin-text-muted)]">
              Página do anúncio
              <select
                value={pageId}
                onChange={(event) => setPageId(event.target.value)}
                className="mt-1.5 h-10 w-full rounded-md border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3 text-sm text-[var(--admin-text-main)] outline-none focus:border-[var(--admin-accent)]"
              >
                <option value="">Selecione</option>
                {pages.map((page) => (
                  <option key={page.id} value={page.id}>
                    {page.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {accounts.length === 0 || pages.length === 0 ? (
            <p className="mt-3 text-xs text-amber-300">
              A Meta não retornou todos os ativos. Verifique permissões, acesso
              à conta de anúncios e vínculo da Página.
            </p>
          ) : null}
        </section>
      )}

      <ConfirmDialog
        isOpen={disconnectOpen}
        onClose={() => setDisconnectOpen(false)}
        onConfirm={disconnect}
        isLoading={busy}
        title="Desconectar Meta Ads?"
        description="O Navo removerá o token armazenado e preservará o histórico local. Campanhas já existentes continuarão sendo administradas na Meta até que você as pause por lá."
        confirmText="Desconectar"
        variant="danger"
      />
    </div>
  );
};
