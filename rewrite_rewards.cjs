const fs = require('fs');
const path = require('path');

const filePath = path.join('src', 'components', 'admin', 'NavoRewardsAdmin.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// First: "box inside a box" syndrome on Loyalty Settings
content = content.replace(/<div className="p-3 bg-\[var\(--admin-bg\)\] rounded-\[var\(--admin-radius-lg\)\] border border-\[var\(--admin-border\)\] space-y-2">/g, '<div className="space-y-2">');

content = content.replace(/<div className="p-3 bg-\[var\(--admin-bg\)\] rounded-\[var\(--admin-radius-lg\)\] border border-\[var\(--admin-border\)\] space-y-1\.5">/g, '<div className="space-y-1.5">');

// On Referral configuration block
content = content.replace(/<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">/g, '<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 text-xs pt-2">');

// Remove redundant wrappers on inputs
// On Loyalty config:
content = content.replace(/className="w-full bg-\[var\(--admin-surface\)\] border border-\[var\(--admin-border\)\] rounded-\[var\(--admin-radius-lg\)\] p-2 text-\[var\(--admin-text-main\)\] text-xs font-bold focus:outline-none focus:border-\[var\(--admin-accent\)\] num-tabular"/g, 'className="w-full bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-2.5 text-[var(--admin-text-main)] text-sm sm:text-xs font-bold focus:outline-none focus:border-[var(--admin-accent)] num-tabular"');

// On Referral config:
content = content.replace(/className="w-full bg-\[var\(--admin-surface\)\] border border-\[var\(--admin-border\)\] rounded-\[var\(--admin-radius-lg\)\] p-2 text-\[var\(--admin-text-main\)\] font-bold text-xs num-tabular"/g, 'className="w-full bg-[var(--admin-bg)] border border-[var(--admin-border)] rounded-[var(--admin-radius-lg)] p-2.5 text-[var(--admin-text-main)] font-bold text-sm sm:text-xs num-tabular focus:outline-none focus:border-[var(--admin-accent)]"');

// Fix buttons layout on Loyalty levels list
content = content.replace(/<div className="grid grid-cols-1 sm:grid-cols-\[minmax\(0,1fr\)_120px_100px_82px_70px_auto\] gap-2 items-center rounded-\[var\(--admin-radius-lg\)\] border border-\[var\(--admin-border\)\] bg-\[var\(--admin-bg\)\] p-2\.5"/g, '<div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_120px_100px_82px_70px_auto] gap-3 sm:gap-2 items-center rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] bg-[var(--admin-bg)] p-3 sm:p-2.5"');

// Fix spacing on the list headers for loyalty
content = content.replace(/<div className="hidden sm:grid grid-cols-\[minmax\(0,1fr\)_120px_100px_82px_70px_auto\] gap-2 px-2\.5 pb-1 text-\[10px\] font-bold uppercase tracking-wider text-\[var\(--admin-text-muted\)\]">/g, '<div className="hidden sm:grid grid-cols-[minmax(0,1fr)_120px_100px_82px_70px_auto] gap-2 px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--admin-text-muted)]">');

fs.writeFileSync(filePath, content);
console.log('Fixed box inside box');
