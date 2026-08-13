with open('src/components/ui/Toast.tsx', 'r') as f:
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
    'text-content-inverse/70'
)
content = content.replace(
    'hover:bg-white/5',
    'hover:bg-content-inverse/10'
)

with open('src/components/ui/Toast.tsx', 'w') as f:
    f.write(content)
