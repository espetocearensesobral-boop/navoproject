const fs = require('fs');
let code = fs.readFileSync('src/components/admin/NavoHomeView.tsx', 'utf8');

code = code.replace("action={{ label: 'Atualizar Dados', onClick: loadData, icon: () => <RefreshCw className={\`w-4 h-4 \${loading ? 'animate-spin' : ''}\`} /> }}", "");
code = code.replace(/<button[^>]*>\s*<RefreshCw[^>]*\/>\s*<span>Atualizar Dados<\/span>\s*<\/button>/g, "");

// Add event listener
code = code.replace("useEffect(() => {\n    loadData();\n  }, []);", "useEffect(() => {\n    loadData();\n    const handleRefresh = () => loadData();\n    window.addEventListener('adminRefresh', handleRefresh);\n    return () => window.removeEventListener('adminRefresh', handleRefresh);\n  }, []);");

fs.writeFileSync('src/components/admin/NavoHomeView.tsx', code);
console.log("Patched NavoHomeView");
