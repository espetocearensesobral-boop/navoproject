with open('src/components/ui/LoadingButton.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "'bg-[#d4a853] text-[#0a0a0a] hover:bg-[#c49a4a] shadow-md'",
    "'bg-accent-solid text-on-accent hover:bg-accent-strong shadow-md'"
)
content = content.replace(
    "'bg-white/5 text-white border border-white/10 hover:bg-white/10'",
    "'bg-content-base/5 text-content-base border border-border-subtle hover:bg-content-base/10'"
)
content = content.replace(
    "'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'",
    "'bg-status-error/10 text-status-error border border-status-error/30 hover:bg-status-error/20'"
)
content = content.replace(
    "'text-neutral-400 hover:text-white hover:bg-white/5'",
    "'text-content-muted hover:text-content-base hover:bg-content-base/5'"
)

with open('src/components/ui/LoadingButton.tsx', 'w') as f:
    f.write(content)
