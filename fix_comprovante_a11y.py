import re

with open('src/components/client/AppointmentDetailsModal.tsx', 'r') as f:
    content = f.read()

# 1. Replace the voucher ID with booking_code
content = re.sub(
    r"VOUCHER #\{currentApt\.id\.replace\('apt_', ''\)\.substring\(0, 8\)\.toUpperCase\(\)\}",
    r"VOUCHER #{currentApt.booking_code || currentApt.id.replace('apt_', '').substring(0, 8).toUpperCase()}",
    content
)
# Also fix the WhatsApp URL
content = re.sub(
    r"\*Voucher:\* #\$\{currentApt\.id\.replace\('apt_', ''\)\.substring\(0, 8\)\}",
    r"*Voucher:* #${currentApt.booking_code || currentApt.id.replace('apt_', '').substring(0, 8)}",
    content
)

# 2. Add role="dialog" and aria-modal="true" to the main modal container
# Look for the outer div: <div className="fixed inset-0 z-[100] ... ">
old_outer_div = r'(<div className="fixed inset-0 z-\[100\] flex items-center justify-center.*?">)'
new_outer_div = r'<div role="dialog" aria-modal="true" aria-labelledby="receipt-title" tabIndex={-1} className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-surface-inverse/70 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto outline-none" onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>'
content = re.sub(old_outer_div, new_outer_div, content, count=1)

# Ensure the title has id="receipt-title"
content = re.sub(r'<h3 className="text-lg sm:text-xl font-serif font-black', r'<h3 id="receipt-title" className="text-lg sm:text-xl font-serif font-black', content)

# Handle focus management for the main modal using useEffect and a ref
# Check if modalRef is defined
if 'const modalRef = useRef<HTMLDivElement>(null);' not in content:
    if 'import React, { useState, useEffect, useRef } from' not in content:
        content = re.sub(r"import React, (\{[^}]+\}) from 'react';", r"import React, { useState, useEffect, useRef, Suspense } from 'react';", content)
    
    # Insert modalRef and useEffect inside the component
    content = re.sub(
        r'const \[showRescheduleModal, setShowRescheduleModal\] = useState\(false\);',
        r'const [showRescheduleModal, setShowRescheduleModal] = useState(false);\n  const modalRef = useRef<HTMLDivElement>(null);\n  useEffect(() => { if (isOpen) { setTimeout(() => modalRef.current?.focus(), 50); } }, [isOpen]);',
        content
    )
    
    # Attach modalRef to the outer div we just modified
    content = content.replace(
        '<div role="dialog" aria-modal="true" aria-labelledby="receipt-title" tabIndex={-1} className="fixed',
        '<div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="receipt-title" tabIndex={-1} className="fixed'
    )


# 3. Add role="dialog" and aria-modal="true" to the reschedule modal
# The reschedule modal is: <div className="fixed inset-0 z-[120] flex items-center justify-center ... ">
old_reschedule_div = r'(<div className="fixed inset-0 z-\[120\] flex items-center justify-center.*?">)'
new_reschedule_div = r'<div role="dialog" aria-modal="true" aria-labelledby="reschedule-title" tabIndex={-1} className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-surface-inverse/80 backdrop-blur-sm animate-in fade-in duration-200 outline-none" onKeyDown={(e) => { if (e.key === "Escape") setShowRescheduleModal(false); }} ref={rescheduleModalRef}>'
content = re.sub(old_reschedule_div, new_reschedule_div, content)

# Add reschedule-title id
content = content.replace(
    '<h3 className="text-xl font-black text-content-base tracking-tight">',
    '<h3 id="reschedule-title" className="text-xl font-black text-content-base tracking-tight">'
)

# Insert rescheduleModalRef and focus logic
if 'const rescheduleModalRef = useRef<HTMLDivElement>(null);' not in content:
    content = re.sub(
        r'const \[showRescheduleModal, setShowRescheduleModal\] = useState\(false\);',
        r'const [showRescheduleModal, setShowRescheduleModal] = useState(false);\n  const rescheduleModalRef = useRef<HTMLDivElement>(null);\n  useEffect(() => { if (showRescheduleModal) { setTimeout(() => rescheduleModalRef.current?.focus(), 50); } else if (isOpen) { setTimeout(() => modalRef.current?.focus(), 50); } }, [showRescheduleModal, isOpen]);',
        content
    )

with open('src/components/client/AppointmentDetailsModal.tsx', 'w') as f:
    f.write(content)

