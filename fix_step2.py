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
# <div onClick={() => ...} className={`...
content = re.sub(
    r"<div(\s+onClick=\{\(\) => onSelectProfessional\(barber\.id\)\}\s+className=)",
    r'<button type="button" aria-pressed={selectedBarberId === barber.id} tabIndex={0}\1',
    content
)

# Fix closing div
# Wait, replacing closing </div> for the barber card needs to be precise.
# It might be easier to use `role="button"` instead of replacing `<div` with `<button` because of `</div>`.
