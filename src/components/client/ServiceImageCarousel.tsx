import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Scissors } from 'lucide-react';
import { hapticLight } from '../../lib/haptics';
import { optimizeImageUrl } from '../../lib/imageUtils';

interface ServiceImageCarouselProps {
  images?: string[];
  fallbackUrl?: string;
  title: string;
  heightClass?: string;
}

export const ServiceImageCarousel: React.FC<ServiceImageCarouselProps> = ({
  images,
  fallbackUrl,
  title,
  heightClass = 'h-32'
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const samplePool = [
    'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&q=75&w=600',
    'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&q=75&w=600',
    'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&q=75&w=600',
    'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&q=75&w=600',
    'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&q=75&w=600',
    'https://images.unsplash.com/photo-1517832606299-7ae9b720a186?auto=format&fit=crop&q=75&w=600',
    'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=75&w=600',
    'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=75&w=600'
  ];

  let basePhotos: string[] = Array.isArray(images) && images.length > 0
    ? [...images]
    : fallbackUrl
    ? [fallbackUrl]
    : [];

  if (basePhotos.length > 0 && basePhotos.length < 5) {
    for (const sample of samplePool) {
      if (basePhotos.length >= 5) break;
      if (!basePhotos.includes(sample)) {
        basePhotos.push(sample);
      }
    }
  }

  const photoList = basePhotos.slice(0, 5).map((url) => optimizeImageUrl(url, 600, 75));
  const totalPhotos = photoList.length;

  // Auto-play interval
  useEffect(() => {
    if (totalPhotos <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev === totalPhotos - 1 ? 0 : prev + 1));
    }, 4000);
    return () => clearInterval(timer);
  }, [totalPhotos]);

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (totalPhotos <= 1) return;
    hapticLight();
    setCurrentIndex((prev) => (prev === 0 ? totalPhotos - 1 : prev - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (totalPhotos <= 1) return;
    hapticLight();
    setCurrentIndex((prev) => (prev === totalPhotos - 1 ? 0 : prev + 1));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diffX = touchStartX - touchEndX;

    if (Math.abs(diffX) > 30) {
      if (diffX > 0) {
        if (totalPhotos > 1) {
          setCurrentIndex((prev) => (prev === totalPhotos - 1 ? 0 : prev + 1));
        }
      } else {
        if (totalPhotos > 1) {
          setCurrentIndex((prev) => (prev === 0 ? totalPhotos - 1 : prev - 1));
        }
      }
    }
    setTouchStartX(null);
  };

  if (totalPhotos === 0) {
    return (
      <div className={`w-full ${heightClass} bg-surface-card flex items-center justify-center text-content-base`}>
        <Scissors className="w-8 h-8 opacity-40" />
      </div>
    );
  }

  return (
    <div
      className={`relative w-full ${heightClass} bg-surface-card overflow-hidden group/carousel select-none`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Current Photo with smooth transition */}
      <img
        key={currentIndex}
        src={photoList[currentIndex]}
        alt={`${title} - foto ${currentIndex + 1}`}
        className="w-full h-full object-cover transition-all duration-500 ease-out animate-in fade-in group-hover/carousel:scale-105"
      />

      {/* Navigation arrows (shown if totalPhotos > 1) */}
      {totalPhotos > 1 && (
        <>
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-1.5 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-surface-base/50 hover:bg-surface-base/80 backdrop-blur-md text-content-base/90 flex items-center justify-center border border-border-subtle transition-all opacity-0 group-hover/carousel:opacity-100 active:scale-90"
            title="Foto anterior"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-surface-base/50 hover:bg-surface-base/80 backdrop-blur-md text-content-base/90 flex items-center justify-center border border-border-subtle transition-all opacity-0 group-hover/carousel:opacity-100 active:scale-90"
            title="Próxima foto"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Minimalist Dots Indicator */}
          <div className="absolute bottom-2 inset-x-0 z-10 flex justify-center items-center space-x-1 pointer-events-none">
            {photoList.map((_, idx) => (
              <span
                key={idx}
                className={`h-1 rounded-full transition-all duration-500 ${
                  idx === currentIndex
                    ? 'w-4 bg-white opacity-100 shadow-md'
                    : 'w-1.5 bg-white opacity-40'
                }`}
              />
            ))}
          </div>

          {/* Counter pill */}
          <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 rounded-md bg-surface-base/60 backdrop-blur-md text-[9px] font-bold text-content-base/90 border border-border-subtle opacity-0 group-hover/carousel:opacity-100 transition-opacity">
            {currentIndex + 1}/{totalPhotos}
          </div>
        </>
      )}
    </div>
  );
};
