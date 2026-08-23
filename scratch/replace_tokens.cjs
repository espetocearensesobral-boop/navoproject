const fs = require('fs');
const path = require('path');

const adminDir = path.join(__dirname, '..', 'src', 'components', 'admin');
const sharedDir = path.join(adminDir, 'shared');

function getFiles(dir) {
  const dirents = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const dirent of dirents) {
    const res = path.join(dir, dirent.name);
    if (dirent.isDirectory()) {
      if (dirent.name === 'shared') {
        files = files.concat(getFiles(res));
      }
    } else if (res.endsWith('.tsx') || res.endsWith('.ts')) {
      files.push(res);
    }
  }
  return files;
}

const filesToProcess = getFiles(adminDir);

const replacements = {
  'text-content-base': 'text-[var(--admin-text-main)]',
  'text-content-muted': 'text-[var(--admin-text-muted)]',
  'bg-surface-card': 'bg-[var(--admin-surface)]',
  'bg-surface-base': 'bg-[var(--admin-bg)]',
  'border-border-subtle': 'border-[var(--admin-border)]',
  'bg-gold-base': 'bg-[var(--admin-accent)]',
  'text-gold-base': 'text-[var(--admin-accent)]',
  'text-gold-hover': 'text-[var(--admin-accent)]',
  'border-gold-base': 'border-[var(--admin-accent)]',
  'text-content-on-accent': 'text-[var(--admin-accent-text)]',
  'focus:border-gold-base': 'focus:border-[var(--admin-accent)]',
  'divide-border-subtle': 'divide-[var(--admin-border)]',
  'ring-gold-base': 'ring-[var(--admin-accent)]',
  'hover:text-content-base': 'hover:text-[var(--admin-text-main)]',
  'hover:bg-surface-base': 'hover:bg-[var(--admin-bg)]',
  'hover:border-gold-base': 'hover:border-[var(--admin-accent)]',
  'hover:text-gold-base': 'hover:text-[var(--admin-accent)]',
  'from-surface-card': 'from-[var(--admin-surface)]',
  'to-surface-base': 'to-[var(--admin-bg)]',
  'bg-border-subtle': 'bg-[var(--admin-border)]',
};

filesToProcess.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  
  for (const [key, value] of Object.entries(replacements)) {
    const regex = new RegExp(key, 'g');
    content = content.replace(regex, value);
  }
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated tokens in ${path.basename(filePath)}`);
  }
});
