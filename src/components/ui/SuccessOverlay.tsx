import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';

interface SuccessOverlayProps {
  isVisible: boolean;
  title: string;
  subtitle?: string;
  duration?: number;
  onClose: () => void;
}

export const SuccessOverlay: React.FC<SuccessOverlayProps> = ({
  isVisible,
  title,
  subtitle,
  duration = 2500,
  onClose,
}) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShow(true);
      const timer = setTimeout(() => {
        setShow(false);
        setTimeout(() => onClose(), 300);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration]);

  if (!isVisible && !show) return null;

  return (
    <div className={`
      fixed inset-0 z-[210] flex items-center justify-center p-4
      transition-opacity duration-300
      ${show ? 'opacity-100' : 'opacity-0'}
    `}>
      <div className="absolute inset-0 bg-surface-inverse/90 backdrop-blur-md" />
      
      <div className="relative flex flex-col items-center text-center max-w-sm">
        {/* Animated Check Circle */}
        <div className="animate-success-pop">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#4ade80] to-[#22c55e] flex items-center justify-center shadow-[0_0_60px_rgba(74,222,128,0.4)]">
            <svg className="w-12 h-12 text-content-inverse" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 13l4 4L19 7"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  strokeDasharray: 100,
                  animation: 'check-draw 0.6s ease-out 0.3s both'
                }}
              />
            </svg>
          </div>
        </div>

        {/* Text */}
        <h3 className="mt-6 text-2xl font-bold text-content-inverse animate-fade-in" style={{ animationDelay: '0.4s' }}>
          {title}
        </h3>
        {subtitle && (
          <p className="mt-2 text-sm text-content-inverse/70 animate-fade-in" style={{ animationDelay: '0.5s' }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
};
