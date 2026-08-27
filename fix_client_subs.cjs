const fs = require('fs');
let code = fs.readFileSync('src/components/client/ClientSubscriptions.tsx', 'utf8');

code = code.replace(
  /import \{ SUBSCRIPTION_PLANS, DEFAULT_USER_SUBSCRIPTION \} from '\.\.\/\.\.\/data\/constants';/,
  `import { DEFAULT_USER_SUBSCRIPTION } from '../../data/constants';\nimport { useEffect } from 'react';`
);

code = code.replace(
  /const \[userSub, setUserSub\] = useState\(DEFAULT_USER_SUBSCRIPTION\);\n  const \[selectedPlanId, setSelectedPlanId\] = useState<string>\('plan_gold'\);/,
  `const [userSub, setUserSub] = useState(DEFAULT_USER_SUBSCRIPTION);\n  const [selectedPlanId, setSelectedPlanId] = useState<string>('');\n  const [subscriptionPlans, setSubscriptionPlans] = useState<any[]>([]);\n\n  useEffect(() => {\n    const fetchPlans = async () => {\n      try {\n        const res = await fetch('/api/subscriptions/plans');\n        if (res.ok) {\n          const data = await res.json();\n          setSubscriptionPlans(data);\n          if (data.length > 0) setSelectedPlanId(data[0].id);\n        }\n      } catch (e) {}\n    };\n    fetchPlans();\n  }, []);`
);

code = code.replace(
  /\{SUBSCRIPTION_PLANS\.map/g,
  `{subscriptionPlans.map`
);

fs.writeFileSync('src/components/client/ClientSubscriptions.tsx', code);
