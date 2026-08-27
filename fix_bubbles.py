import re

with open('src/components/admin/WhatsAppInboxManagement.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

replacement = """className={`max-w-[85%] rounded-[var(--admin-radius-lg)] p-2.5 text-xs ${
                              isInbound
                                ? "bg-[var(--admin-bg)] border border-[var(--admin-border)] text-[var(--admin-text-main)]"
                                : "bg-[var(--admin-accent)]/10 border border-[var(--admin-accent)]/20 text-[var(--admin-text-main)] font-medium"
                            }`}"""

# regex matching the target exactly, ignoring whitespace
target = re.compile(r'className=\{`max-w-\[85%\] rounded-\[var\(--admin-radius-lg\)\] p-2\.5 text-xs \$\{\s*isInbound\s*\?\s*"bg-\[var\(--admin-bg\)\] border border-\[var\(--admin-border\)\] text-\[var\(--admin-text-main\)\]"\s*:\s*"bg-\[var\(--admin-accent\)\] text-\[var\(--admin-accent-text\)\] font-medium"\s*\}`\}')

content = target.sub(replacement, content)

target2 = re.compile(r'className=\{`text-\[9px\] mt-1 text-right \$\{\s*isInbound\s*\?\s*"text-\[var\(--admin-text-muted\)\]"\s*:\s*"opacity-70"\s*\}`\}')
replacement2 = 'className="text-[9px] mt-1 text-right text-[var(--admin-text-muted)]"'
content = target2.sub(replacement2, content)

with open('src/components/admin/WhatsAppInboxManagement.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
