const fs = require('fs');
let code = fs.readFileSync('src/components/admin/SubscriptionsManagement.tsx', 'utf8');

// Replace state initialization for plans
code = code.replace(
  /const \[plans, setPlans\] = useState<SubscriptionPlan\[\]>\(\(\) => \{[\s\S]*?\n  \}\);/,
  `const [plans, setPlans] = useState<SubscriptionPlan[]>([]);\n  const [isLoading, setIsLoading] = useState(true);\n\n  const fetchPlans = async () => {\n    try {\n      const res = await fetch('/api/subscriptions/plans');\n      if (res.ok) {\n        const data = await res.json();\n        setPlans(data);\n      }\n    } catch (error) {\n      console.error(error);\n    }\n  };\n\n  useEffect(() => {\n    fetchPlans();\n  }, []);`
);

// Replace state initialization for members
code = code.replace(
  /const \[members, setMembers\] = useState<SubscriberMember\[\]>\(\(\) => \{[\s\S]*?\n  \}\);/,
  `const [members, setMembers] = useState<SubscriberMember[]>([]);\n\n  const fetchMembers = async () => {\n    try {\n      const res = await fetch('/api/subscriptions/members');\n      if (res.ok) {\n        const data = await res.json();\n        setMembers(data);\n      }\n      setIsLoading(false);\n    } catch (error) {\n      console.error(error);\n      setIsLoading(false);\n    }\n  };\n\n  useEffect(() => {\n    fetchMembers();\n  }, []);`
);

// Remove useEffect for local storage
code = code.replace(
  /React\.useEffect\(\(\) => \{\n    localStorage\.setItem\("navo_sub_plans_v1", JSON\.stringify\(plans\)\);\n  \}, \[plans\]\);/g,
  ''
);

// Modify handleSavePlan
code = code.replace(
  /const handleSavePlan = \(\) => \{[\s\S]*?setPlans\(updated\);\n      setEditingPlanId\(null\);\n    \} else \{[\s\S]*?setPlans\(\(prev\) => \[\.\.\.prev, newPlan\]\);\n    \}[\s\S]*?setIsFormOpen\(false\);\n  \};/,
  `const handleSavePlan = async () => {
    if (!formPlanName.trim()) return;
    const planData = {
      name: formPlanName,
      price: formPrice,
      billingCycle: formBillingCycle,
      includedServices: formIncludedServices.split(',').map(s => s.trim()).filter(Boolean),
      productDiscountPct: formProductDiscount,
      barberPerCutFee: formBarberFee,
      activeSubscribersCount: 0,
      popular: false,
    };
    try {
      if (editingPlanId) {
        await fetch(\`/api/subscriptions/plans/\${editingPlanId}\`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(planData)
        });
      } else {
        await fetch('/api/subscriptions/plans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(planData)
        });
      }
      await fetchPlans();
      setIsFormOpen(false);
      setEditingPlanId(null);
    } catch(e) {}
  };`
);

// Modify handleDeletePlan
code = code.replace(
  /const handleDeletePlan = \(id: string\) => \{[\s\S]*?setPlans\(\(prev\) => prev\.filter\(\(p\) => p\.id !== id\)\);\n    \}\n  \};/,
  `const handleDeletePlan = async (id: string) => {
    if (confirm("Tem certeza que deseja remover este plano? Assinantes ativos serão afetados.")) {
      try {
        await fetch(\`/api/subscriptions/plans/\${id}\`, { method: 'DELETE' });
        await fetchPlans();
      } catch(e) {}
    }
  };`
);

// Add useEffect import if not present
if (!code.includes('useEffect')) {
  code = code.replace(/import React, \{ useState \}/, 'import React, { useState, useEffect }');
}

fs.writeFileSync('src/components/admin/SubscriptionsManagement.tsx', code);
