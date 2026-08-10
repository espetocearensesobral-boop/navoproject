import React, { useState } from 'react';
import { Appointment } from '../../types';
import { submitPostServiceReview } from '../../services/supabaseDataService';
import { X, Star, Loader2, CheckCircle2, Camera, Gift, Sparkles } from 'lucide-react';
import { hapticSuccess } from '../../lib/haptics';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment;
  onSuccess: (appointmentId: string) => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({ isOpen, onClose, appointment, onSuccess }) => {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [understoodRequest, setUnderstoodRequest] = useState<string>('Sim, perfeitamente');
  const [waitTimeAcceptable, setWaitTimeAcceptable] = useState<string>('Sim');
  const [wouldRecommend, setWouldRecommend] = useState<string>('Com certeza');
  const [comment, setComment] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [hasPhoto, setHasPhoto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(20);

  React.useEffect(() => {
    if (!isOpen) {
      setRating(5);
      setComment('');
      setPhotoUrl('');
      setHasPhoto(false);
      setError(null);
      setSuccess(false);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await submitPostServiceReview({
        appointmentId: appointment.id,
        professionalId: appointment.professional_id,
        rating,
        understoodRequest,
        waitTimeAcceptable,
        wouldRecommend,
        comment,
        hasPhoto,
        photoUrl: photoUrl || undefined
      });

      setPointsEarned(res.pointsAwarded || 20);
      setSuccess(true);
      hapticSuccess();
      setTimeout(() => {
        onSuccess(appointment.id);
      }, 2200);
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar avaliação.');
      setIsSubmitting(false);
    }
  };

  const calculatedPoints = 20 + (hasPhoto || photoUrl ? 30 : 0) + (rating === 5 ? 10 : 0);

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-surface-base/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-surface-card rounded-2xl border border-border-subtle shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-surface-base rounded-full text-content-muted hover:text-content-base focus:outline-none"
        >
          <X className="w-5 h-5" />
        </button>

        {success ? (
          <div className="py-8 text-center space-y-4 animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 rounded-full bg-gold-base/20 border border-gold-base/30 text-gold-base mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-gold-base" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-content-base">Avaliação Enviada!</h3>
              <p className="text-sm text-gold-base font-bold mt-1">🎉 Você ganhou +{pointsEarned} pontos Navo!</p>
              <p className="text-xs text-content-muted mt-2">Obrigado por apoiar a qualidade e o crescimento da Navo.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="text-center mb-5">
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-gold-base/10 border border-gold-base/30 text-gold-base text-xs font-bold mb-2">
                <Gift className="w-3.5 h-3.5" />
                <span>Ganhe até +60 Pontos</span>
              </div>
              <h2 className="text-xl font-serif font-bold text-content-base">Avaliar Atendimento</h2>
              <p className="text-xs text-content-muted mt-0.5">Como foi seu serviço com {appointment.professional_name}?</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Star Rating */}
              <div className="bg-surface-base/60 p-4 rounded-xl border border-border-subtle text-center space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-content-muted block">Sua nota geral</span>
                <div className="flex justify-center space-x-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="focus:outline-none p-1 transition-transform hover:scale-110"
                    >
                      <Star 
                        className={`w-8 h-8 ${
                          star <= (hoverRating || rating) 
                            ? 'fill-gold-base text-gold-base drop-shadow-[0_0_8px_rgba(201,169,110,0.4)]' 
                            : 'fill-transparent text-border-subtle'
                        } transition-colors duration-200`} 
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Specific Questions */}
              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-content-base block mb-1.5">1. O barbeiro entendeu o que você queria?</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['Sim, perfeitamente', 'Quase', 'Não'].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setUnderstoodRequest(opt)}
                        className={`p-2 rounded-xl text-center font-medium border transition-all ${
                          understoodRequest === opt
                            ? 'bg-gold-base text-surface-base border-gold-base font-bold'
                            : 'bg-surface-base text-content-muted border-border-subtle hover:text-content-base'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="font-bold text-content-base block mb-1.5">2. O tempo de espera foi aceitável?</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['Sim', 'Um pouco', 'Não'].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setWaitTimeAcceptable(opt)}
                        className={`p-2 rounded-xl text-center font-medium border transition-all ${
                          waitTimeAcceptable === opt
                            ? 'bg-gold-base text-surface-base border-gold-base font-bold'
                            : 'bg-surface-base text-content-muted border-border-subtle hover:text-content-base'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="font-bold text-content-base block mb-1.5">3. Você indicaria a Navo para um amigo?</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['Com certeza', 'Talvez', 'Não'].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setWouldRecommend(opt)}
                        className={`p-2 rounded-xl text-center font-medium border transition-all ${
                          wouldRecommend === opt
                            ? 'bg-gold-base text-surface-base border-gold-base font-bold'
                            : 'bg-surface-base text-content-muted border-border-subtle hover:text-content-base'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Photo Bonus Option */}
              <div className="bg-surface-base/80 p-3.5 rounded-xl border border-gold-base/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Camera className="w-4 h-4 text-gold-base" />
                    <span className="text-xs font-bold text-content-base">Adicionar foto do resultado</span>
                  </div>
                  <span className="text-[10px] bg-gold-base/20 text-gold-base font-extrabold px-2 py-0.5 rounded-full border border-gold-base/30">
                    +30 PONTOS EXTRAS
                  </span>
                </div>
                <input
                  type="url"
                  placeholder="URL da foto no Instagram/Imgur (opcional)"
                  value={photoUrl}
                  onChange={(e) => {
                    setPhotoUrl(e.target.value);
                    setHasPhoto(Boolean(e.target.value));
                  }}
                  className="w-full bg-surface-card border border-border-subtle rounded-lg p-2 text-xs text-content-base placeholder:text-content-muted focus:border-gold-base focus:outline-none"
                />
              </div>

              {/* Comment */}
              <div>
                <label className="block text-xs font-bold text-content-muted mb-1.5">O que podemos melhorar? (opcional)</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Escreva seu feedback aqui..."
                  className="w-full bg-surface-base border border-border-subtle rounded-xl p-3 text-xs text-content-base placeholder:text-content-muted focus:border-gold-base focus:outline-none min-h-[70px] resize-none"
                  maxLength={500}
                />
              </div>

              {/* Points Earn Preview */}
              <div className="flex items-center justify-between px-3 py-2 bg-gold-base/10 rounded-xl border border-gold-base/20 text-xs">
                <span className="text-content-muted font-medium flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-gold-base" /> Recompensa ao enviar:
                </span>
                <span className="font-extrabold text-gold-base text-sm">+{calculatedPoints} PONTOS NAVO</span>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-status-error/10 border border-status-error/20 text-status-error text-xs font-medium">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || rating === 0}
                className="w-full py-3 rounded-xl bg-gold-base text-surface-base font-bold transition-all flex items-center justify-center disabled:opacity-50 active:scale-95 hover:opacity-95 shadow-lg shadow-gold-base/20"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Enviando e creditando pontos...
                  </>
                ) : (
                  `Enviar Avaliação (+${calculatedPoints} pts)`
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

