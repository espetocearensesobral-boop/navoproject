import re

with open('src/components/client/BookingStep1Services.tsx', 'r') as f:
    content = f.read()

# Fix toFixed(2)
content = re.sub(
    r"toFixed\(2\)",
    r"toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })",
    content
)

# Fix Service Divs to Buttons
# They are mapped like:
# <div onClick={() => openServiceDetails(service)} className={`...`}>
# We need to add role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openServiceDetails(service); }}
content = re.sub(
    r"<div(\s+onClick=\{\(\) => openServiceDetails\(service\)\}\s+className=)",
    r'<div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openServiceDetails(service); } }} aria-pressed={isSelected(service.id)}\1',
    content
)

content = re.sub(
    r"<div(\s+onClick=\{\(\) => openServiceDetails\(modalService\)\}\s+className=)",
    r'<div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openServiceDetails(modalService); } }}\1',
    content
)


with open('src/components/client/BookingStep1Services.tsx', 'w') as f:
    f.write(content)

