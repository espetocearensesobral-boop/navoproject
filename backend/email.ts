import express from 'express';
import nodemailer from 'nodemailer';

/**
 * Serviço de e-mail transacional (confirmação/cancelamento de agendamento).
 *
 * Usa SMTP genérico via nodemailer — funciona de graça com qualquer provedor
 * que ofereça SMTP, por exemplo:
 *   - Gmail (smtp.gmail.com:587) com uma "Senha de app" (não a senha normal
 *     da conta — precisa ativar verificação em 2 etapas primeiro);
 *   - Brevo/Sendinblue (smtp-relay.brevo.com:587), plano grátis ~300 e-mails/dia;
 *   - Zoho Mail (smtp.zoho.com:587), plano grátis.
 * Nenhuma dessas opções exige cartão de crédito. As credenciais são
 * cadastradas pelo admin em Configurações do Sistema > E-mail e ficam
 * guardadas na tabela `email_settings` (nunca no código/ambiente).
 */

let cachedTransporter: any = null;
let cachedConfigSignature = '';

function buildTransporter(cfg: any) {
  const signature = JSON.stringify([cfg.smtpHost, cfg.smtpPort, cfg.smtpSecure, cfg.smtpUser, cfg.smtpPassword]);
  if (cachedTransporter && cachedConfigSignature === signature) {
    return cachedTransporter;
  }
  cachedTransporter = nodemailer.createTransport({
    host: cfg.smtpHost,
    port: cfg.smtpPort,
    secure: !!cfg.smtpSecure, // true = TLS implícito (porta 465); false = STARTTLS (587/25)
    auth: cfg.smtpUser ? { user: cfg.smtpUser, pass: cfg.smtpPassword } : undefined,
  });
  cachedConfigSignature = signature;
  return cachedTransporter;
}

/** Chamado sempre que a config é salva, pra não continuar usando uma conexão com credenciais antigas. */
export function invalidateEmailTransporterCache() {
  cachedTransporter = null;
  cachedConfigSignature = '';
}

function isConfigComplete(cfg: any): boolean {
  return !!(cfg && cfg.smtpHost && cfg.smtpUser && cfg.smtpPassword && cfg.fromEmail);
}

/**
 * getDb: função que retorna a instância atual do Drizzle. Usamos uma função
 * (em vez de receber `db` direto) porque no momento em que este módulo é
 * carregado a conexão ainda pode não ter sido inicializada — precisamos ler
 * o valor mais recente a cada chamada, não o valor capturado no import.
 */
export function createEmailModule(getDb: () => any, schema: any, eq: any) {
  async function getEmailSettings(): Promise<any | null> {
    const db = getDb();
    if (!db) return null;
    const rows = await db.select().from(schema.emailSettings).where(eq(schema.emailSettings.id, 'default'));
    return rows[0] || null;
  }

  /**
   * Envia um e-mail transacional. Retorna false silenciosamente (sem lançar)
   * se o envio de e-mail estiver desativado ou mal configurado — mesmo
   * comportamento do sendWhatsAppMessage, pra nunca travar o fluxo principal
   * (ex.: criação de agendamento) por causa de um canal de notificação opcional.
   */
  async function sendEmail(to: string, subject: string, html: string, text?: string, kind?: 'booking' | 'reschedule' | 'cancel'): Promise<boolean> {
    if (!to) return false;
    try {
      const cfg = await getEmailSettings();
      if (!cfg || !cfg.enabled) {
        return false;
      }
      if (kind === 'booking' && cfg.notifyOnBooking === false) return false;
      if (kind === 'reschedule' && cfg.notifyOnReschedule === false) return false;
      if (kind === 'cancel' && cfg.notifyOnCancel === false) return false;
      if (!isConfigComplete(cfg)) {
        console.warn(`[Email] Configuração SMTP incompleta. E-mail para ${to} não enviado.`);
        return false;
      }

      const transporter = buildTransporter(cfg);
      await transporter.sendMail({
        from: `"${cfg.fromName || 'Navo Barber & Club'}" <${cfg.fromEmail}>`,
        to,
        replyTo: cfg.replyTo || cfg.fromEmail,
        subject,
        html,
        text: text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      });

      console.log(`[Email] Enviado para ${to}: "${subject}"`);
      return true;
    } catch (err: any) {
      console.error(`[Email] Falha ao enviar para ${to}:`, err?.message || err);
      return false;
    }
  }

  const router = express.Router();

  // Status público (sem credenciais) — usado pelo front pra saber se o canal
  // está ativo, mesmo padrão de GET /api/whatsapp/status.
  router.get('/status', async (req, res) => {
    try {
      const cfg = await getEmailSettings();
      const configured = !!(cfg && cfg.enabled && isConfigComplete(cfg));
      res.json({
        configured,
        message: configured
          ? 'Envio de e-mails configurado.'
          : 'Envio de e-mails desativado ou dados SMTP incompletos.',
      });
    } catch (e) {
      res.json({ configured: false, message: 'Não foi possível verificar a configuração de e-mail.' });
    }
  });

  // Config completa — somente admin. A senha SMTP nunca é devolvida em texto puro.
  router.get('/config', async (req: any, res: any) => {
    try {
      const cfg = await getEmailSettings();
      if (!cfg) {
        return res.json({
          enabled: false, smtpHost: '', smtpPort: 587, smtpSecure: false,
          smtpUser: '', hasPassword: false, fromName: 'Navo Barber & Club',
          fromEmail: '', replyTo: '', notificationEmail: '', notifyOnBooking: true, notifyOnReschedule: true, notifyOnCancel: true,
        });
      }
      const { smtpPassword, ...rest } = cfg;
      res.json({ ...rest, hasPassword: !!smtpPassword });
    } catch (e: any) {
      res.status(500).json({ error: 'Falha ao carregar configuração de e-mail.' });
    }
  });

  router.put('/config', async (req: any, res: any) => {
    try {
      const db = getDb();
      if (!db) return res.status(503).json({ error: 'Banco de dados indisponível no momento.' });

      const data = req.body || {};
      const existing = await getEmailSettings();

      const port = Number(data.smtpPort);
      const payload: any = {
        id: 'default',
        enabled: !!data.enabled,
        smtpHost: (data.smtpHost || '').trim(),
        smtpPort: Number.isFinite(port) && port > 0 ? port : (existing?.smtpPort || 587),
        smtpSecure: !!data.smtpSecure,
        smtpUser: (data.smtpUser || '').trim(),
        // Placeholder mascarado ("••••••••") vindo do front = "não alterar a senha salva".
        // Campo omitido também preserva. Só uma string vazia explícita apaga a senha.
        smtpPassword: (data.smtpPassword === undefined || data.smtpPassword === '••••••••')
          ? (existing?.smtpPassword || '')
          : data.smtpPassword,
        fromName: (data.fromName || 'Navo Barber & Club').trim(),
        fromEmail: (data.fromEmail || '').trim(),
        replyTo: (data.replyTo || '').trim(),
        notificationEmail: data.notificationEmail !== undefined
          ? (data.notificationEmail || '').trim().toLowerCase()
          : (existing?.notificationEmail || '').trim().toLowerCase(),
        notifyOnBooking: data.notifyOnBooking !== undefined ? !!data.notifyOnBooking : (existing?.notifyOnBooking ?? true),
        notifyOnReschedule: data.notifyOnReschedule !== undefined ? !!data.notifyOnReschedule : (existing?.notifyOnReschedule ?? true),
        notifyOnCancel: data.notifyOnCancel !== undefined ? !!data.notifyOnCancel : (existing?.notifyOnCancel ?? true),
        updatedAt: new Date(),
      };

      if (payload.notificationEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.notificationEmail)) {
        return res.status(400).json({ error: 'Informe um e-mail administrativo válido ou deixe o campo em branco.' });
      }
      if (payload.enabled && !isConfigComplete(payload)) {
        return res.status(400).json({ error: 'Preencha host, usuário, senha e e-mail de envio antes de ativar o envio de e-mails.' });
      }

      if (existing) {
        await db.update(schema.emailSettings).set(payload).where(eq(schema.emailSettings.id, 'default'));
      } else {
        await db.insert(schema.emailSettings).values(payload);
      }
      invalidateEmailTransporterCache();

      const [saved] = await db.select().from(schema.emailSettings).where(eq(schema.emailSettings.id, 'default'));
      const { smtpPassword, ...rest } = saved;
      res.json({ success: true, config: { ...rest, hasPassword: !!smtpPassword }, message: 'Configurações de e-mail salvas com sucesso!' });
    } catch (e: any) {
      console.error('[Email] Erro ao salvar configuração:', e);
      res.status(500).json({ error: 'Falha ao salvar configuração de e-mail.' });
    }
  });

  router.post('/test', async (req: any, res: any) => {
    try {
      const to = (req.body?.to || '').trim();
      if (!to) return res.status(400).json({ error: 'Informe um e-mail de destino para o teste.' });

      const cfg = await getEmailSettings();
      if (!isConfigComplete(cfg)) {
        return res.status(400).json({ error: 'Configure e salve os dados SMTP antes de enviar um teste.' });
      }

      // Envia mesmo com "enabled" desligado, pra permitir validar antes de ativar de vez.
      const transporter = buildTransporter(cfg);
      await transporter.sendMail({
        from: `"${cfg.fromName || 'Navo Barber & Club'}" <${cfg.fromEmail}>`,
        to,
        replyTo: cfg.replyTo || cfg.fromEmail,
        subject: 'Teste de envio — Navo Barber & Club',
        html: '<p>Este é um e-mail de teste do painel administrativo do Navo Barber &amp; Club.</p>'
          + '<p>Se você recebeu esta mensagem, a configuração SMTP está funcionando corretamente. ✅</p>',
      });

      res.json({ success: true, message: `E-mail de teste enviado para ${to}.` });
    } catch (e: any) {
      console.error('[Email] Falha no envio de teste:', e?.message || e);
      res.status(400).json({ error: `Falha ao enviar e-mail de teste: ${e?.message || 'erro desconhecido'}. Verifique host, porta, usuário e senha.` });
    }
  });

  return { router, sendEmail, getEmailSettings };
}
