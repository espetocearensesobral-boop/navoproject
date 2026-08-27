const fs = require('fs');
const path = require('path');

const filePath = path.join('src', 'components', 'client', 'BookingStep2Barbers.tsx');
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes('import { motion } from')) {
  content = content.replace(/import React, /, 'import React, ');
  content = content.replace(/import \{ useTheme \} from/, 'import { motion } from "motion/react";\nimport { useTheme } from');
}

// Convert the list item cards
content = content.replace(/<div\n\s*key=\{barber\.id\}\n\s*role="button"/g, '<motion.div\n                whileTap={{ scale: 0.95 }}\n                whileHover={{ scale: 1.02 }}\n                key={barber.id}\n                role="button"');

content = content.replace(/scale-\[1\.01\]/g, '');

content = content.replace(/<\/div>\n\s*\);\n\s*\}\)\}/g, '</motion.div>\n            );\n          })}');

fs.writeFileSync(filePath, content);
console.log('Fixed barbers');
