import re

with open('src/components/client/BookingStep2Barbers.tsx', 'r') as f:
    content = f.read()

# Fix toFixed(2)
content = re.sub(
    r"toFixed\(2\)",
    r"toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })",
    content
)

# Fix Barber Divs to Buttons
content = re.sub(
    r"<div(\s+onClick=\{\(\) => onSelectProfessional\(barber\.id\)\}\s+className=)",
    r'<div role="button" tabIndex={0} aria-pressed={selectedBarberId === barber.id} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelectProfessional(barber.id); } }}\1',
    content
)

content = re.sub(
    r"<div(\s+onClick=\{\(\) => onSelectProfessional\('any'\)\}\s+className=)",
    r'<div role="button" tabIndex={0} aria-pressed={selectedBarberId === "any"} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelectProfessional("any"); } }}\1',
    content
)

with open('src/components/client/BookingStep2Barbers.tsx', 'w') as f:
    f.write(content)

