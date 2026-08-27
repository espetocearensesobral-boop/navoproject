#!/bin/bash
sed -i "s/import { whatsappRouter } from '.\/whatsapp.js';/import whatsappRouter from '.\/whatsapp.js';/" backend/index.ts

sed -i "s/import { emailRouter } from '.\/email.js';/import { createEmailModule } from '.\/email.js';\nconst emailModule = createEmailModule(() => db, schema, eq);\nconst emailRouter = emailModule.router;\n/" backend/index.ts

sed -i "s/import { evolutionApiRouter } from '.\/evolution-api.js';/import { createEvolutionApiModule } from '.\/evolution-api.js';\nconst evolutionApiModule = createEvolutionApiModule({ getDb: () => db, schema, eq, onWebhook: undefined, onInactivitySweep: undefined });\nconst evolutionApiRouter = evolutionApiModule.router;\n/" backend/index.ts

sed -i "/export const notifyClientByEmail/d" backend/index.ts
sed -i "/console.log('notifyClientByEmail'/d" backend/index.ts
sed -i "/export const notifyShopByEmail/d" backend/index.ts
sed -i "/console.log('notifyShopByEmail'/d" backend/index.ts
sed -i "/};/d" backend/index.ts

echo "export const notifyClientByEmail = emailModule.notifyClientByEmail;" >> backend/index.ts
echo "export const notifyShopByEmail = emailModule.notifyShopByEmail;" >> backend/index.ts

