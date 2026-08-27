const fs = require('fs');
const path = require('path');

const filePath = path.join('src', 'components', 'client', 'BookingStep1Services.tsx');
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes('import { motion } from')) {
  content = content.replace(/import React, /, 'import React, ');
  content = content.replace(/import \{ useTheme \} from/, 'import { motion } from "motion/react";\nimport { useTheme } from');
}

// Convert netflix carousel cards
content = content.replace(/<div\s+key=\{service\.id\}\s+role="button"/g, '<motion.div\n                          whileTap={{ scale: 0.95 }}\n                          whileHover={{ scale: 1.02 }}\n                          key={service.id}\n                          role="button"');
content = content.replace(/hover:scale-\[1\.02\]/g, ''); // remove tailwind scale on those classes

fs.writeFileSync(filePath, content);
console.log('Fixed services');
