import re

with open('src/components/admin/NavoRewardsAdmin.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace thick nested borders in forms
content = re.sub(
    r'className="bg-\[var\(--admin-surface\)\] p-4 sm:p-5 rounded-\[var\(--admin-radius-lg\)\] border border-\[var\(--admin-border\)\] space-y-4"',
    'className="bg-[var(--admin-surface)] p-5 space-y-5"',
    content
)

content = re.sub(
    r'className="bg-\[var\(--admin-surface\)\] p-4 sm:p-5 rounded-\[var\(--admin-radius-lg\)\] border border-\[var\(--admin-border\)\] space-y-3"',
    'className="bg-[var(--admin-surface)] p-5 space-y-4"',
    content
)

# For nested sections inside forms
content = re.sub(
    r'className="space-y-2"',
    'className="space-y-2.5"',
    content
)
content = re.sub(
    r'className="space-y-1\.5"',
    'className="space-y-2"',
    content
)

with open('src/components/admin/NavoRewardsAdmin.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Lightened UI")
