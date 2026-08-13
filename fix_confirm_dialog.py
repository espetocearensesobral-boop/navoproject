with open('src/components/ui/ConfirmDialog.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    'bg-[#1a1a1a] border border-white/10',
    'bg-surface-inverse border border-content-inverse/10'
)
content = content.replace(
    'text-white',
    'text-content-inverse'
)
content = content.replace(
    'text-neutral-400',
    'text-content-inverse/60'
)
content = content.replace(
    'hover:bg-white/5',
    'hover:bg-content-inverse/10'
)
content = content.replace(
    "bg-[#d4a853]/10 text-[#d4a853] border border-[#d4a853]/20",
    "bg-accent-solid/10 text-accent-solid border border-accent-solid/20"
)

with open('src/components/ui/ConfirmDialog.tsx', 'w') as f:
    f.write(content)
