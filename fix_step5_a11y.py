import re

with open('src/components/client/BookingStep5Confirmation.tsx', 'r') as f:
    content = f.read()

# Fix the concatenation by adding a screen reader space and fixing aria-labels
old_btn = r'<button\s+type="button"\s+onClick=\{handleCopyVoucher\}\s+className="p-2 rounded-xl bg-gold-base/20 hover:bg-gold-base/30 text-gold-base active:scale-95 transition-all flex items-center gap-1 text-xs font-bold"\s+title="Copiar Código"\s*>'
new_btn = r'<span className="sr-only"> </span><button type="button" onClick={handleCopyVoucher} aria-label={copied ? "Código copiado" : "Copiar código"} className="p-2 rounded-xl bg-gold-base/20 hover:bg-gold-base/30 text-gold-base active:scale-95 transition-all flex items-center gap-1 text-xs font-bold" title="Copiar Código">'

content = re.sub(old_btn, new_btn, content)

# Make the internal text aria-hidden so the screen reader uses the aria-label
content = content.replace('<span className="text-status-success text-[10px]">Copiado</span>', '<span className="text-status-success text-[10px]" aria-hidden="true">Copiado</span>')
content = content.replace('<span className="text-[10px]">Copiar</span>', '<span className="text-[10px]" aria-hidden="true">Copiar</span>')

with open('src/components/client/BookingStep5Confirmation.tsx', 'w') as f:
    f.write(content)
