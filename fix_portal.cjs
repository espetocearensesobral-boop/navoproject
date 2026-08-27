const fs = require('fs');
const path = require('path');

const filePath = path.join('src', 'components', 'admin', 'FollowUpActionModal.tsx');
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes('createPortal')) {
  content = content.replace(/import React, \{ useState \} from "react";/, 'import React, { useState } from "react";\nimport { createPortal } from "react-dom";');
}

content = content.replace(/return \(\n\s*<div className="fixed inset-0/, 'return createPortal(\n    <div className="fixed inset-0');

// add closing paren for createPortal
content = content.replace(/    <\/div>\n  \);\n\};\n?$/, '    </div>,\n    document.body\n  );\n};\n');

fs.writeFileSync(filePath, content);
console.log('Fixed portal');
