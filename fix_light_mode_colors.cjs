const fs = require('fs');
const path = require('path');

const replacements = [
    [/text-amber-200/g, 'text-amber-700 dark:text-amber-200'],
    [/text-amber-300/g, 'text-amber-700 dark:text-amber-300'],
    [/text-amber-400/g, 'text-amber-700 dark:text-amber-400'],
    [/text-red-300/g, 'text-red-700 dark:text-red-300'],
    [/text-red-400/g, 'text-red-700 dark:text-red-400'],
    [/text-blue-400/g, 'text-blue-700 dark:text-blue-400'],
    [/text-emerald-400/g, 'text-emerald-700 dark:text-emerald-400'],
    [/bg-emerald-950\/40/g, 'bg-emerald-500/10 dark:bg-emerald-950/40'],
    [/bg-emerald-950\/60/g, 'bg-emerald-500/10 dark:bg-emerald-950/60'],
    [/bg-red-950\/30/g, 'bg-red-500/10 dark:bg-red-950/30'],
    [/bg-red-950\/60/g, 'bg-red-500/10 dark:bg-red-950/60'],
    
    // De-duplicate if it was applied twice
    [/text-amber-700 dark:text-amber-700 dark:text-amber/g, 'text-amber-700 dark:text-amber'],
    [/text-red-700 dark:text-red-700 dark:text-red/g, 'text-red-700 dark:text-red'],
    [/text-blue-700 dark:text-blue-700 dark:text-blue/g, 'text-blue-700 dark:text-blue'],
    [/text-emerald-700 dark:text-emerald-700 dark:text-emerald/g, 'text-emerald-700 dark:text-emerald'],
];

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let original = content;
            
            for (const [regex, replacement] of replacements) {
                content = content.replace(regex, replacement);
            }
            
            if (content !== original) {
                fs.writeFileSync(fullPath, content);
                console.log('Fixed', fullPath);
            }
        }
    }
}
processDir('src/components/admin');
