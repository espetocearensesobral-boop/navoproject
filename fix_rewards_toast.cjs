const fs = require('fs');
const path = require('path');

const filePath = path.join('src', 'components', 'admin', 'NavoRewardsAdmin.tsx');
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes('import { useToast } from')) {
  content = content.replace(/import React, \{ useState, useEffect \} from "react";/, 'import React, { useState, useEffect } from "react";\nimport { useToast } from "../ui/Toast";');
}

// Inside the component we need to get `showToast`. We will insert it at the beginning of the component.
// `export function NavoRewardsAdmin({ initialTab }: { initialTab?: AdminTab }) {`
content = content.replace(
  /export function NavoRewardsAdmin\(\{ initialTab \}: \{ initialTab\?: AdminTab \}\) \{/,
  'export function NavoRewardsAdmin({ initialTab }: { initialTab?: AdminTab }) {\n  const { showToast } = useToast();'
);

// Replace all setConfigSuccessMsg("...") and setCampaignMsg("...") and setManualSuccessMsg("...") with showToast("success", "...", "")
content = content.replace(/setConfigSuccessMsg\((.*?)\);/g, 'showToast("success", "Sucesso", $1);');
content = content.replace(/setTimeout\(\(\) => setConfigSuccessMsg\(null\), 4000\);/g, '');

content = content.replace(/setCampaignMsg\((.*?)\);/g, 'showToast("success", "Sucesso", $1);');
content = content.replace(/setTimeout\(\(\) => setCampaignMsg\(null\), 5000\);/g, '');

content = content.replace(/setManualSuccessMsg\((.*?)\);/g, 'showToast("success", "Sucesso", $1);');
content = content.replace(/setTimeout\(\(\) => setManualSuccessMsg\(null\), 4000\);/g, '');

content = content.replace(/alert\((.*?)\);/g, 'showToast("error", "Erro", $1);');

// Remove the rendering of these messages
content = content.replace(/\{campaignMsg && \([\s\S]*?\{campaignMsg\}\n\s*<\/div>\n\s*\)\}/g, '');
content = content.replace(/\{configSuccessMsg && \([\s\S]*?\{configSuccessMsg\}\n\s*<\/div>\n\s*\)\}/g, '');
content = content.replace(/\{manualSuccessMsg && \([\s\S]*?\{manualSuccessMsg\}\n\s*<\/div>\n\s*\)\}/g, '');

fs.writeFileSync(filePath, content);
console.log('Fixed rewards toast');
