const fs = require('fs');
let code = fs.readFileSync('src/components/admin/AuditLogsManagement.tsx', 'utf8');

code = code.replace(
  /const \[logs, setLogs\] = useState<AuditLogItem\[\]>\(\(\) => \{[\s\S]*?\n  \}\);/,
  `const [logs, setLogs] = useState<AuditLogItem[]>([]);\n\n  useEffect(() => {\n    const fetchLogs = async () => {\n      try {\n        const res = await fetch('/api/audit');\n        if (res.ok) {\n          const data = await res.json();\n          // Map DB structure to AuditLogItem\n          const mapped = data.map((d: any) => ({\n            id: d.id,\n            timestamp: d.createdAt,\n            operatorName: d.user,\n            category: d.type,\n            action: d.action,\n            details: d.details,\n            status: 'success',\n            ipAddress: '127.0.0.1'\n          }));\n          setLogs(mapped);\n        }\n      } catch (e) {}\n    };\n    fetchLogs();\n  }, []);`
);

if (!code.includes('useEffect')) {
  code = code.replace(/import React, \{ useState \}/, 'import React, { useState, useEffect }');
}

fs.writeFileSync('src/components/admin/AuditLogsManagement.tsx', code);
