const fs = require('fs');
const files = [
    'src/components/admin/GoogleAdsSettings.tsx',
    'src/components/admin/CampaignsWorkspace.tsx',
    'src/components/admin/MetaAdsSettings.tsx'
];

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/text-blue-100/g, 'text-blue-700 dark:text-blue-200');
    fs.writeFileSync(file, content);
}
console.log('Fixed text-blue-100 in 3 files');
