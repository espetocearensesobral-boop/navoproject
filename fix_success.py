with open('src/components/ui/SuccessOverlay.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    'bg-black/80',
    'bg-surface-inverse/90'
)
content = content.replace(
    'text-white',
    'text-content-inverse'
)
content = content.replace(
    'text-white/70',
    'text-content-inverse/70'
)

with open('src/components/ui/SuccessOverlay.tsx', 'w') as f:
    f.write(content)
