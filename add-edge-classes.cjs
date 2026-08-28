const fs = require('fs');

function applyEdgeClass(filePaths) {
  filePaths.forEach(path => {
    if (!fs.existsSync(path)) return;
    let code = fs.readFileSync(path, 'utf8');
    
    // Replace section...
    code = code.replace(/<section className="order-1 flex min-h-0([^"]*)"/g, '<section className="admin-mobile-edge order-1 flex min-h-0$1"');
    code = code.replace(/<section className="order-2 flex min-h-0([^"]*)"/g, '<section className="admin-mobile-edge order-2 flex min-h-0$1"');

    // Receipts management edge cases?
    
    fs.writeFileSync(path, code);
  });
}

applyEdgeClass([
  'src/components/admin/WaitingQueue.tsx'
]);
