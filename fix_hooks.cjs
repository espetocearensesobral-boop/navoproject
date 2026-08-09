const fs = require('fs');
let code = fs.readFileSync('src/components/admin/AdminLayout.tsx', 'utf8');

const hookCodeRegex = /  const mainRef = useRef<HTMLDivElement>\(null\);\n  const { pullDistance, isRefreshing, handlers: pullToRefreshHandlers } = usePullToRefresh\(\n    mainRef,\n    \{\n      onRefresh: async \(\) => \{\n        window.dispatchEvent\(new CustomEvent\('adminRefresh'\)\);\n        await new Promise\(resolve => setTimeout\(resolve, 800\)\); \/\/ wait a bit for data to load\n      \}\n    \}\n  \);\n/m;

// Remove the hooks from their current location
code = code.replace(hookCodeRegex, '');

// Insert them at the top of the component, just after the other state declarations
const insertTarget = "const [adminName, setAdminName] = useState('Admin');\n";
const hookCode = `  const mainRef = useRef<HTMLElement>(null);
  const { pullDistance, isRefreshing, handlers: pullToRefreshHandlers } = usePullToRefresh(
    mainRef,
    {
      onRefresh: async () => {
        window.dispatchEvent(new CustomEvent('adminRefresh'));
        await new Promise(resolve => setTimeout(resolve, 800)); // wait a bit for data to load
      }
    }
  );
`;

code = code.replace(insertTarget, insertTarget + "\n" + hookCode);

fs.writeFileSync('src/components/admin/AdminLayout.tsx', code);
console.log("Hooks fixed in AdminLayout");
