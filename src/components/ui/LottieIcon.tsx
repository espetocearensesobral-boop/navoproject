import React, { useEffect, useState } from 'react';
import Lottie from 'lottie-react';
import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';

interface LottieIconProps {
  animationUrl?: string; // URL para o JSON do Lottie
  animationData?: any; // Objeto JSON do Lottie importado localmente
  fallbackIcon?: React.ReactNode;
  className?: string;
  loop?: boolean;
}

export const LottieIcon: React.FC<LottieIconProps> = ({ 
  animationUrl, 
  animationData, 
  fallbackIcon,
  className = "w-6 h-6",
  loop = true 
}) => {
  const [data, setData] = useState<any>(animationData);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (animationUrl && !animationData) {
      fetch(animationUrl)
        .then(res => res.json())
        .then(json => setData(json))
        .catch(() => setError(true));
    }
  }, [animationUrl, animationData]);

  if (error || (!data && !animationUrl)) {
    return (
      <div className={className + " flex items-center justify-center"}>
        {fallbackIcon || (
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
          >
            <Sparkles className="w-full h-full text-gold-base" />
          </motion.div>
        )}
      </div>
    );
  }

  if (!data) {
    // Loading state for remote lottie
    return <div className={className + " animate-pulse bg-border-subtle rounded-full"} />;
  }

  return (
    <div className={className + " flex items-center justify-center"}>
      <Lottie animationData={data} loop={loop} className="w-full h-full" />
    </div>
  );
};
