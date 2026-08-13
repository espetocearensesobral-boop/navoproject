import re

with open('src/components/client/AppointmentDetailsModal.tsx', 'r') as f:
    content = f.read()

# Replace hardcoded colors with tokens
colors = {
    r"bg-\[\#faf8f4\]": "bg-surface-card",
    r"bg-\[\#f5f2ec\]": "bg-surface-base",
    r"text-\[\#2d2a26\]": "text-content-base",
    r"text-\[\#b0a898\]": "text-content-muted",
    r"border-\[\#ede8e0\]": "border-border-subtle",
    r"border-\[\#e0d8c8\]": "border-border-strong",
    r"text-white": "text-content-inverse",
    r"text-black": "text-content-inverse",
    r"bg-black": "bg-surface-inverse",
    r"hover:bg-\[\#1a1a1a\]": "hover:bg-content-inverse/10",
    r"text-\[\#1a1a1a\]": "text-content-base",
    r"bg-\[\#1a1a1a\]": "bg-surface-inverse",
    r"hover:bg-black/90": "hover:bg-surface-inverse/90",
    
    # Fix toFixed(2) -> pt-BR
    r"toFixed\(2\)": "toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })"
}

for pattern, repl in colors.items():
    content = re.sub(pattern, repl, content)

# A11y properties
# Main container:
# <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
# Change to:
# <div role="dialog" aria-modal="true" aria-labelledby="receipt-title" className="fixed inset-0 z-50 flex items-center justify-center p-4" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
content = re.sub(
    r'<div className="fixed inset-0 z-50 flex items-center justify-center p-4">',
    r'<div role="dialog" aria-modal="true" aria-labelledby="receipt-title" tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center p-4 outline-none" onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>',
    content
)

# Header Title
content = content.replace(
    '<h3 className="text-xl font-serif font-black text-content-base tracking-tight mb-1">',
    '<h3 id="receipt-title" className="text-xl font-serif font-black text-content-base tracking-tight mb-1">'
)

# Back/Close button
# <button onClick={onClose} className="p-2 ...
content = re.sub(
    r'<button onClick=\{onClose\} className="(p-2.*?)"',
    r'<button onClick={onClose} aria-label="Fechar comprovante" className="\1"',
    content
)

# Use useEffect for focus trap
# Add it near `useEffect(() => { ... }` or just use autoFocus on the container
import_addition = "import { useEffect, useRef } from 'react';"
if "useRef" not in content:
    content = content.replace("import React, { useState } from 'react';", "import React, { useState, useEffect, useRef } from 'react';")

content = content.replace(
    '<div role="dialog"',
    '<div ref={modalRef} role="dialog"'
)

# Insert the ref declaration
content = re.sub(
    r'(const \[showRescheduleModal, setShowRescheduleModal\] = useState\(false\);)',
    r'\1\n  const modalRef = useRef<HTMLDivElement>(null);\n  useEffect(() => { if (isOpen) modalRef.current?.focus(); }, [isOpen]);',
    content
)

with open('src/components/client/AppointmentDetailsModal.tsx', 'w') as f:
    f.write(content)

