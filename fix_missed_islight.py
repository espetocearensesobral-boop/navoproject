import re

files = [
    'src/components/client/BookingStep2Barbers.tsx',
    'src/components/client/BookingStep3DateTime.tsx',
]

for file in files:
    with open(file, 'r') as f:
        content = f.read()
    
    content = re.sub(
        r"isLight\s*\?\s*'text-zinc-400'\s*:\s*'text-stone-400'",
        "'text-content-inverse/60'",
        content
    )
    
    with open(file, 'w') as f:
        f.write(content)

