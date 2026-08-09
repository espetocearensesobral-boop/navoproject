const fs = require('fs');

function addImports(file, imports) {
    let content = fs.readFileSync(file, 'utf8');
    const importLines = imports.filter(imp => !content.includes(imp.check)).map(imp => imp.line);
    
    if (importLines.length > 0) {
        content = content.replace(/(import .*;\n)+/, match => match + importLines.join('\n') + '\n');
        fs.writeFileSync(file, content);
        console.log("Updated", file);
    }
}

addImports('src/components/admin/BarbershopProfileManagement.tsx', [
    { check: 'handleEnterAsTab', line: "import { handleEnterAsTab } from '../../utils/formUtils';" },
    { check: 'formatPhone', line: "import { formatPhone } from '../../utils/masks';" }
]);

addImports('src/components/admin/AccountsPayableManagement.tsx', [
    { check: 'handleEnterAsTab', line: "import { handleEnterAsTab } from '../../utils/formUtils';" }
]);

