const fs = require('fs');
const path = require('path');
const data = JSON.parse(fs.readFileSync('sources.json'));

data.sources.forEach((sourcePath, index) => {
  if (sourcePath.startsWith('../server-api/')) {
    const realPath = sourcePath.replace('../server-api/', 'backend/');
    const content = data.contents[index];
    const dir = path.dirname(realPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(realPath, content);
    console.log('Restored', realPath);
  }
});
