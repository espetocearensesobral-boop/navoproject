const fs = require('fs');
const path = require('path');

const regexes = [
    [/text-blue-[0-9]{3} dark:text-blue-[0-9]{3}/g, 'text-status-info'],
    [/text-amber-[0-9]{3} dark:text-amber-[0-9]{3}/g, 'text-status-warning'],
    [/text-red-[0-9]{3} dark:text-red-[0-9]{3}/g, 'text-status-error'],
    [/text-emerald-[0-9]{3} dark:text-emerald-[0-9]{3}/g, 'text-status-success'],
    [/bg-blue-500\/[0-9]+/g, 'bg-status-info/10'],
    [/bg-amber-500\/[0-9]+/g, 'bg-status-warning/10'],
    [/bg-red-500\/[0-9]+/g, 'bg-status-error/10'],
    [/bg-emerald-500\/[0-9]+/g, 'bg-status-success/10'],
    [/border-blue-[0-9]{3}\/[0-9]+/g, 'border-status-info/30'],
    [/border-amber-[0-9]{3}\/[0-9]+/g, 'border-status-warning/30'],
    [/border-red-[0-9]{3}\/[0-9]+/g, 'border-status-error/30'],
    [/border-emerald-[0-9]{3}\/[0-9]+/g, 'border-status-success/30'],
    [/dark:bg-emerald-[0-9]{3}\/[0-9]+/g, ''],
    [/dark:bg-red-[0-9]{3}\/[0-9]+/g, ''],
    [/dark:bg-blue-[0-9]{3}\/[0-9]+/g, ''],
    [/dark:text-blue-[0-9]{3}/g, 'text-status-info'],
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
            
            for (const [regex, replacement] of regexes) {
                content = content.replace(regex, replacement);
            }
            // Fix double spaces
            content = content.replace(/  +/g, ' ').replace(/ \"/g, '"').replace(/\" /g, '"');
            
            if (content !== original) {
                fs.writeFileSync(fullPath, content);
                console.log('Fixed', fullPath);
            }
        }
    }
}
processDir('src/components/admin');
