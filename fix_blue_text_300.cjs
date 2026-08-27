const fs = require('fs');
const path = require('path');

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let original = content;
            
            // Specifically fix the tone="text-blue-300" 
            content = content.replace(/tone = "text-blue-300"/g, 'tone = "text-blue-700 dark:text-blue-300"');
            content = content.replace(/tone="text-blue-300"/g, 'tone="text-blue-700 dark:text-blue-300"');
            
            // Fix bg-blue-500/20 text-blue-300
            content = content.replace(/"bg-blue-500\/20 text-blue-300"/g, '"bg-blue-500/10 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"');
            
            // Fix remaining text-blue-300
            content = content.replace(/text-blue-300/g, 'text-blue-700 dark:text-blue-300');
            
            // Dedup if it created text-blue-700 dark:text-blue-700 dark:text-blue-300
            content = content.replace(/text-blue-700 dark:text-blue-700 dark:text-blue-300/g, 'text-blue-700 dark:text-blue-300');
            
            if (content !== original) {
                fs.writeFileSync(fullPath, content);
                console.log('Fixed', fullPath);
            }
        }
    }
}
processDir('src/components/admin');
