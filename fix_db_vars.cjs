const fs = require('fs');
let code = fs.readFileSync('backend/index.ts', 'utf8');

const insertCode = `
export let db: any = null;
export let isDbConnected = false;
export let dbReadyPromise: any = null;

const MAX_INIT_ATTEMPTS = 5;
let dbInitAttempts = 0;

export async function initializeDb(): Promise<void> {
  try {
    const dbUrl = process.env.DATABASE_URL;
    const sqlHost = process.env.SQL_HOST;

    if (dbUrl || sqlHost) {
      const connectionString = dbUrl || \`postgres://\${process.env.SQL_USER}:\${process.env.SQL_PASSWORD}@\${sqlHost}:5432/\${process.env.SQL_DB_NAME}\`;
      const sqlClient = postgres(connectionString, { max: 5 });
      db = drizzle(sqlClient, { schema });
      isDbConnected = true;
      console.log('[API] ✅ Conexão com Supabase estabelecida com sucesso.');
    } else {
      throw new Error('Variáveis de ambiente do banco de dados não estão configuradas.');
    }
  } catch (err: any) {
    console.error('[API] ❌ Falha ao conectar ao banco:', err.message);
    if (dbInitAttempts < MAX_INIT_ATTEMPTS) {
      dbInitAttempts++;
      const delay = dbInitAttempts * 1000;
      console.log(\`[API] Tentativa \${dbInitAttempts}/\${MAX_INIT_ATTEMPTS} de reconexão em \${delay}ms...\`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return initializeDb();
    }
    db = null;
    isDbConnected = false;
    console.error('[API] ❌ Não foi possível conectar ao banco de dados Supabase.');
  }
}

dbReadyPromise = initializeDb();
`;

code = code.replace(
/if \(!process\.env\.DATABASE_URL && !process\.env\.SQL_HOST\) \{\n  console\.warn\("NOTICE: DATABASE_URL or SQL_HOST not defined\. Ensure Supabase credentials are configured\."\);\n\}/,
`if (!process.env.DATABASE_URL && !process.env.SQL_HOST) {
  console.warn("NOTICE: DATABASE_URL or SQL_HOST not defined. Ensure Supabase credentials are configured.");
}
${insertCode}`
);

fs.writeFileSync('backend/index.ts', code);
