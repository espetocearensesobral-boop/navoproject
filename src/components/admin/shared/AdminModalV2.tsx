import React, { useRef } from"react";
import { createPortal } from"react-dom";
import { X } from"lucide-react";
import { useDialogFocus } from"../../../hooks/useDialogFocus";
import { useModalScrollLock } from"../../../hooks/useModalScrollLock";

export interface AdminModalV2Props {
 /** Small icon shown inside the circular header badge. */
 icon: React.ElementType;
 /** Uppercase eyebrow label above the title (e.g."Aviso WhatsApp"). */
 eyebrow: string;
 /** Dialog title. */
 title: string;
 /** Optional short line under the title, shown inside the header (e.g. client name). */
 subtitle?: string;
 onClose: () => void;
 /** 'sm' matches receipt checkout (420px). 'md' fits dialogs (560px). 'lg' fits grids (720px). 'fullscreen' fills entire screen. */
 size?:"sm"|"md"|"lg"|"fullscreen";
 /** Tint applied to the header icon badge — defaults to gold. */
 accent?:"gold"|"whatsapp"|"neutral";
 children: React.ReactNode;
 /** Sticky footer, typically the action buttons. Rendered outside the scroll area. */
 footer?: React.ReactNode;
 labelledBy?: string;
}

/**
 * Shared shell for admin dialogs. Reuses the same visual language introduced by
 * the receipt-v2 checkout (rounded card, centered overlay, circular header icon,
 * scrollable body, sticky action row) so every modal in /admin looks like one
 * product instead of several one-off Tailwind dialogs.
 */
export const AdminModalV2: React.FC<AdminModalV2Props> = ({
 icon: Icon,
 eyebrow,
 title,
 subtitle,
 onClose,
 size ="sm",
 accent ="gold",
 children,
 footer,
 labelledBy ="admin-modal-v2-title",
}) => {
 const dialogRef = useRef<HTMLDivElement>(null);
 useDialogFocus(true, dialogRef);
 useModalScrollLock(true);

 const isFullscreen = size ==="fullscreen";

 return createPortal(
 <div
 className={`admin-modal-v2-overlay ${isFullscreen ?"admin-modal-v2-overlay--fullscreen":""} admin-shell`}
 role="dialog"
 aria-modal="true"
 aria-labelledby={labelledBy}
 >
 <div
 ref={dialogRef}
 tabIndex={-1}
 className={`admin-modal-v2-dialog admin-modal-v2-dialog--${size}`}
 >
 <header className="admin-modal-v2-header">
 <div className={`${isFullscreen ?"max-w-6xl mx-auto w-full flex items-center justify-between":"flex items-center justify-between w-full"}`}>
 <div className="admin-modal-v2-title-group">
 <span
 className={`admin-modal-v2-header-icon admin-modal-v2-header-icon--${accent}`}
 >
 <Icon aria-hidden="true"/>
 </span>
 <div className="admin-modal-v2-title-copy">
 <p className="admin-modal-v2-label">{eyebrow}</p>
 <h2 id={labelledBy} className="admin-modal-v2-title">
 {title}
 </h2>
 {subtitle && (
 <p className="admin-modal-v2-subtitle">{subtitle}</p>
 )}
 </div>
 </div>
 <button
 type="button"
 onClick={onClose}
 className="admin-modal-v2-close"
 aria-label="Fechar"
 >
 <X aria-hidden="true"/>
 </button>
 </div>
 </header>

 <div className="admin-modal-v2-scroll">
 <div className={isFullscreen ?"max-w-6xl mx-auto w-full pb-8":"w-full"}>
 {children}
 </div>
 </div>

 {footer && (
 <div className="admin-modal-v2-footer">
 <div className={isFullscreen ?"max-w-6xl mx-auto w-full":"w-full"}>
 {footer}
 </div>
 </div>
 )}
 </div>
 </div>,
 document.body,
 );
};
