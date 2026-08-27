const fs = require('fs');
const path = require('path');

const filePath = path.join('src', 'components', 'admin', 'NavoRewardsAdmin.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Fix the nested borders on the levels form.
// Make it a clean card without borders on inputs, or clean background with borders on inputs.
// Let's use `admin-card` and standard inputs.

content = content.replace(
  /className="grid grid-cols-1 sm:grid-cols-\[minmax\(0,1fr\)_120px_100px_82px_70px_auto\] gap-2 items-center rounded-\[var\(--admin-radius-lg\)\] border border-\[var\(--admin-border\)\] bg-\[var\(--admin-bg\)\] p-2\.5"/g,
  'className="flex flex-col sm:grid sm:grid-cols-[minmax(0,1fr)_120px_100px_82px_70px_auto] gap-3 sm:gap-2 items-center rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] bg-[var(--admin-bg)] p-3 sm:p-2"'
);

// Level inputs (remove extra background/borders to flatten the design)
content = content.replace(
  /className="min-w-0 bg-\[var\(--admin-surface\)\] border border-\[var\(--admin-border\)\] rounded-\[var\(--admin-radius-md\)\] p-2 text-xs font-bold text-\[var\(--admin-text-main\)\]"/g,
  'className="w-full sm:min-w-0 bg-transparent border-b sm:border border-[var(--admin-border)] rounded-none sm:rounded-[var(--admin-radius-md)] p-2 text-sm sm:text-xs font-bold text-[var(--admin-text-main)] focus:outline-none focus:border-[var(--admin-accent)]"'
);

content = content.replace(
  /className="bg-\[var\(--admin-surface\)\] border border-\[var\(--admin-border\)\] rounded-\[var\(--admin-radius-md\)\] p-2 text-xs text-\[var\(--admin-text-main\)\] num-tabular"/g,
  'className="w-full bg-[var(--admin-surface)] sm:bg-transparent border border-[var(--admin-border)] sm:border-transparent sm:border-b-border-[var(--admin-border)] rounded-[var(--admin-radius-md)] sm:rounded-none p-2 text-sm sm:text-xs text-[var(--admin-text-main)] num-tabular focus:outline-none focus:border-[var(--admin-accent)]"'
);

// Tweak the headings for mobile layout
content = content.replace(
  /className="hidden sm:grid grid-cols-\[minmax\(0,1fr\)_120px_100px_82px_70px_auto\] gap-2 px-3 pb-2 text-\[10px\] font-bold uppercase tracking-wider text-\[var\(--admin-text-muted\)\]"/g,
  'className="hidden sm:grid grid-cols-[minmax(0,1fr)_120px_100px_82px_70px_auto] gap-2 px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--admin-text-muted)]"'
);

fs.writeFileSync(filePath, content);
console.log('Fixed levels');
