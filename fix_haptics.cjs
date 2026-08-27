const fs = require('fs');
const path = require('path');

const filePath = path.join('src', 'components', 'client', 'BookingStep2Barbers.tsx');
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes('import { hapticLight }')) {
  content = content.replace(/import \{ optimizeImageUrl \} from '\.\.\/\.\.\/lib\/imageUtils';/, "import { optimizeImageUrl } from '../../lib/imageUtils';\nimport { hapticLight } from '../../lib/haptics';");
}

content = content.replace(/if \('vibrate' in navigator\) navigator\.vibrate\(50\);/g, 'hapticLight();');

fs.writeFileSync(filePath, content);
console.log('Fixed haptics');
