# Navo Project

Aplicação web da **Navo Premium — Heritage Barber & Club**, com fluxo público de agendamento e painel administrativo para operação da barbearia.

**Versão atual:** `0.1.0`

## Stack

O projeto utiliza React 19, Vite 6, TypeScript, Express, Drizzle ORM e PostgreSQL/Supabase. A interface é publicada na Vercel; as APIs ficam sob `/api` e usam o banco configurado em `DATABASE_URL`.

## Execução local

Instale Node.js 20 ou superior e as dependências com o gerenciador definido pelo projeto:

```bash
pnpm install
pnpm dev
```

Para gerar uma versão de produção local:

```bash
pnpm build
pnpm start
```

O arquivo `.env.example` lista as variáveis necessárias. Nunca versionar `.env`, credenciais SMTP, chaves JWT, chaves VAPID ou credenciais do banco.

## Banco de dados

As alterações estruturais são versionadas em `drizzle/` e aplicadas pelo comando:

```bash
pnpm db:migrate
```

O arquivo [`sql/reset_operacoes.sql`](sql/reset_operacoes.sql) é um procedimento **manual e destrutivo**, fora do fluxo de migrações. Ele limpa registros operacionais sem remover paletas, configurações da unidade, configurações de e-mail, catálogo, profissionais, recompensas ou contas de acesso. Revise o arquivo e faça um backup antes de executá-lo no Supabase.

## Verificações

Antes de publicar alterações, execute:

```bash
pnpm lint
pnpm test
pnpm build:vercel
```

O build da Vercel usa `pnpm run build:vercel`, conforme `vercel.json`, com `pnpm install --frozen-lockfile`. O `pnpm-lock.yaml` é o lockfile oficial do projeto; evite alternar o gerenciador de pacotes no deploy.

A sessão do cliente e do painel usa cookie HTTP-only; o frontend não persiste JWT em `localStorage`. Em produção, configure `PUBLIC_APP_ORIGIN` ou `APP_URL` para restringir CORS ao domínio publicado.
