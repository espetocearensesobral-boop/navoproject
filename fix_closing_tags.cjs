const fs = require('fs');
const path = require('path');

const filePath = path.join('src', 'components', 'client', 'BookingStep1Services.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// I need to change the closing tag of those elements to </motion.div>
// The elements have key={service.id} ... className={`...

content = content.replace(/<motion\.div([\s\S]*?)<\/div>\s*<\/div>\s*\);\s*\}\)\}/g, function(match, p1) {
  // We want to replace the last </div> before ); with </motion.div>
  const replaced = match.replace(/<\/div>\s*\)\;/, '</motion.div>\n                      );');
  return replaced;
});

fs.writeFileSync(filePath, content);
console.log('Fixed closing tags in services');
