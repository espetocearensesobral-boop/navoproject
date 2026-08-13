import os
import re

replacements = {
    r"isLight\s*\?\s*'bg-zinc-900 border-zinc-800 text-white'\s*:\s*'bg-white border-stone-200 text-stone-900'": "'bg-surface-inverse border-border-strong text-content-inverse'",
    
    r"isLight\s*\?\s*'bg-gold-base/20 text-gold-base'\s*:\s*'bg-gold-base/20 text-gold-deep'": "'bg-accent-solid/20 text-accent-text'",
    
    r"isLight\s*\?\s*'text-zinc-400'\s*:\s*'text-stone-500'": "'text-content-inverse/60'",
    
    r"isLight\s*\?\s*'text-white'\s*:\s*'text-stone-900'": "'text-content-inverse'",
    
    r"isLight\s*\?\s*'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-300 hover:text-red-400'\s*:\s*'bg-stone-100 hover:bg-stone-200 border-stone-300 text-stone-700 hover:text-red-500'": "'bg-content-inverse/10 hover:bg-content-inverse/20 border-content-inverse/20 text-content-inverse/70 hover:text-status-error'",

    r"isLight\s*\?\s*'text-zinc-200'\s*:\s*'text-stone-800'": "'text-content-inverse/90'",

    r"isLight\s*\?\s*'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'\s*:\s*'bg-stone-100 hover:bg-stone-200 text-stone-700'": "'bg-content-inverse/10 hover:bg-content-inverse/20 text-content-inverse/80'",

    r"isLight\s*\?\s*'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-white'\s*:\s*'bg-stone-100 hover:bg-stone-200 border-stone-300 text-stone-900'": "'bg-content-inverse/10 hover:bg-content-inverse/20 border-content-inverse/20 text-content-inverse'",

    r"isLight\s*\?\s*'text-zinc-500'\s*:\s*'text-stone-400'": "'text-content-inverse/50'",
    
    r"isLight\s*\?\s*'bg-zinc-800 text-zinc-600 cursor-not-allowed opacity-50'\s*:\s*'bg-stone-200 text-stone-400 cursor-not-allowed opacity-50'": "'bg-content-inverse/10 text-content-inverse/40 cursor-not-allowed opacity-50'",
    
    # In some places it's multiline
    r"isLight\n\s*\?\s*'bg-zinc-900 border-zinc-800 text-white'\n\s*:\s*'bg-white border-stone-200 text-stone-900'": "'bg-surface-inverse border-border-strong text-content-inverse'",
    r"isLight\n\s*\?\s*'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-300 hover:text-red-400'\n\s*:\s*'bg-stone-100 hover:bg-stone-200 border-stone-300 text-stone-700 hover:text-red-500'": "'bg-content-inverse/10 hover:bg-content-inverse/20 border-content-inverse/20 text-content-inverse/70 hover:text-status-error'"
}

files = [
    'src/components/client/BookingStep1Services.tsx',
    'src/components/client/BookingStep2Barbers.tsx',
    'src/components/client/BookingStep3DateTime.tsx',
    'src/components/client/BookingStep4Review.tsx'
]

for file in files:
    with open(file, 'r') as f:
        content = f.read()
    
    for pattern, replacement in replacements.items():
        content = re.sub(pattern, replacement, content)
        
    # Remove unused `const isLight = theme === 'light';`
    content = re.sub(r"const isLight = theme === 'light';\n\s*", "", content)
    
    with open(file, 'w') as f:
        f.write(content)
        
print("Booking steps updated.")
