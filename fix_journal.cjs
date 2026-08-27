const fs = require('fs');
const path = require('path');

const drizzleDir = 'drizzle';
const metaDir = path.join(drizzleDir, 'meta');

const sqlFiles = fs.readdirSync(drizzleDir).filter(f => f.endsWith('.sql') && f.match(/^\d{4}_/)).sort();

const entries = sqlFiles.map((file, idx) => {
    return {
        idx: idx,
        version: "7",
        when: Date.now() + idx,
        tag: file.replace('.sql', ''),
        breakpoints: true
    };
});

const journal = {
    version: "7",
    dialect: "postgresql",
    entries: entries
};

fs.writeFileSync(path.join(metaDir, '_journal.json'), JSON.stringify(journal, null, 2));
console.log('Fixed _journal.json with ' + entries.length + ' entries.');
