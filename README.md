<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# BarberX App

This contains the BarberX application.

## Run Locally

**Prerequisites:**  Node.js (v18+)

1. Install dependencies:
   `npm install`
2. Configure `.env.example` / `.env` with the following variables:
   ```env
   # API Keys & Secrets
   GEMINI_API_KEY=your_gemini_api_key
   JWT_SECRET=your_jwt_secret
   ENCRYPTION_KEY=your_encryption_key
   CRON_SECRET=your_cron_secret

   # Database (PostgreSQL)
   DATABASE_URL=postgres://user:pass@host:5432/db
   ```
3. Run the app:
   `npm run dev`

## Deploying

Se você for fazer o deploy na Vercel ou outro ambiente Serverless, lembre-se:
- **Banco de Dados:** Configurar o `DATABASE_URL` conectando a um banco Postgres de verdade (Supabase, Neon, Cloud SQL, etc).
- **WhatsApp:** A integração do WhatsApp incluída neste repositório suporta disparo de mensagens configurado com os serviços de gateway e fallback seguro.
- **Pagamentos:** Os botões de pagamento e PIX registram o método escolhido de forma persistente.

## Database Migrations
O sistema utiliza Drizzle ORM com migrações automáticas e seed inicial no boot do servidor. Para rodar as migrações manualmente:
`npx tsx migrate.ts`

