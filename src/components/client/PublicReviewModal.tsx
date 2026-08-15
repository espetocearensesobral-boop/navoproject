import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, MessageSquare, Star, X } from 'lucide-react';
import { lookupPublicReviewAccess, submitPublicReview, type PublicReviewAccess } from '../../services/supabaseDataService';
import { hapticSuccess } from '../../lib/haptics';

interface PublicReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ReviewStage = 'lookup' | 'form' | 'success';

export const PublicReviewModal: React.FC<PublicReviewModalProps> = ({ isOpen, onClose }) => {
  const [stage, setStage] = useState<ReviewStage>('lookup');
  const [access, setAccess] = useState<PublicReviewAccess | null>(null);
  const [bookingCode, setBookingCode] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [rating, setRating] = useState(5);
  const [understoodRequest, setUnderstoodRequest] = useState('Sim, perfeitamente');
  const [waitTimeAcceptable, setWaitTimeAcceptable] = useState('Sim');
  const [wouldRecommend, setWouldRecommend] = useState('Com certeza');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bookingCodeRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setStage('lookup');
    setAccess(null);
    setBookingCode('');
    setClientPhone('');
    setRating(5);
    setUnderstoodRequest('Sim, perfeitamente');
    setWaitTimeAcceptable('Sim');
    setWouldRecommend('Com certeza');
    setComment('');
    setError(null);
    setLoading(false);
    window.setTimeout(() => bookingCodeRef.current?.focus(), 80);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLookup = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await lookupPublicReviewAccess(bookingCode.trim(), clientPhone.trim());
      setAccess(result);
      setStage('form');
    } catch (lookupError: any) {
      setError(lookupError?.message || 'Não foi possível localizar o atendimento.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!access) return;
    setError(null);
    setLoading(true);
    try {
      await submitPublicReview({
        bookingCode: bookingCode.trim(),
        clientPhone: clientPhone.trim(),
        rating,
        understoodRequest,
        waitTimeAcceptable,
        wouldRecommend,
        comment: comment.trim() || undefined,
      });
      setStage('success');
      hapticSuccess();
    } catch (submitError: any) {
      setError(submitError?.message || 'Não foi possível enviar a avaliação.');
    } finally {
      setLoading(false);
    }
  };

  const optionClass = (active: boolean) => `rounded-xl border px-2.5 py-2 text-xs font-semibold transition-colors ${active ? 'border-gold-base bg-gold-base text-surface-base' : 'border-border-subtle bg-surface-base text-content-muted hover:text-content-base'}`;

  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center bg-surface-base/80 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="public-review-title">
      <div className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border-subtle bg-surface-card p-5 shadow-2xl sm:p-7">
        <button type="button" onClick={onClose} aria-label="Fechar avaliação" className="absolute right-4 top-4 rounded-full bg-surface-base p-2 text-content-muted hover:text-content-base">
          <X className="h-5 w-5" />
        </button>

        {stage === 'success' ? (
          <div className="space-y-4 py-12 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-gold-base/30 bg-gold-base/10 text-gold-base">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 id="public-review-title" className="text-xl font-serif font-bold text-content-base">Avaliação enviada</h2>
            <p className="text-sm leading-relaxed text-content-muted">Obrigado pelo feedback. Ele ajuda a Navo a manter a qualidade de cada atendimento.</p>
            <button type="button" onClick={onClose} className="h-11 w-full rounded-xl bg-gold-base text-sm font-bold text-surface-base">Fechar</button>
          </div>
        ) : stage === 'lookup' ? (
          <form onSubmit={handleLookup} className="space-y-5 pt-4">
            <div className="pr-8">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-gold-base/30 bg-gold-base/10 px-3 py-1 text-xs font-bold text-gold-base"><MessageSquare className="h-3.5 w-3.5" /> Avaliação pós-atendimento</div>
              <h2 id="public-review-title" className="text-xl font-serif font-bold text-content-base">Como foi sua experiência?</h2>
              <p className="mt-1 text-sm leading-relaxed text-content-muted">Informe o código do seu agendamento e o telefone usado na reserva. A avaliação só é liberada para atendimentos concluídos.</p>
            </div>
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-content-muted">Código do agendamento
                <input ref={bookingCodeRef} value={bookingCode} onChange={(event) => setBookingCode(event.target.value.toUpperCase())} required minLength={4} maxLength={80} placeholder="Ex.: NAVO7K2P" className="mt-1.5 h-12 w-full rounded-xl border border-border-subtle bg-surface-base px-3 text-sm font-mono text-content-base outline-none focus:border-gold-base" />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wider text-content-muted">Telefone usado na reserva
                <input value={clientPhone} onChange={(event) => setClientPhone(event.target.value)} required minLength={8} maxLength={30} inputMode="tel" placeholder="(88) 99999-9999" className="mt-1.5 h-12 w-full rounded-xl border border-border-subtle bg-surface-base px-3 text-sm text-content-base outline-none focus:border-gold-base" />
              </label>
            </div>
            {error && <ErrorMessage text={error} />}
            <button type="submit" disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gold-base text-sm font-bold text-surface-base disabled:opacity-60">{loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Verificando...</> : 'Continuar para avaliar'}</button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 pt-4">
            <div className="pr-8">
              <p className="text-xs font-bold uppercase tracking-wider text-gold-base">Atendimento localizado</p>
              <h2 id="public-review-title" className="mt-1 text-xl font-serif font-bold text-content-base">Avaliar atendimento</h2>
              <p className="mt-1 text-sm text-content-muted">{access?.serviceTitle} · {access?.professionalName}</p>
            </div>
            <div className="rounded-xl border border-border-subtle bg-surface-base p-4 text-center">
              <p className="text-xs font-bold uppercase tracking-wider text-content-muted">Sua nota geral</p>
              <div className="mt-2 flex justify-center gap-1.5">{[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" onClick={() => setRating(star)} aria-label={`Dar ${star} estrelas`} className="rounded-lg p-1"><Star className={`h-8 w-8 ${star <= rating ? 'fill-gold-base text-gold-base' : 'text-border-subtle'}`} /></button>)}</div>
            </div>
            <Question label="O barbeiro entendeu o que você queria?" options={['Sim, perfeitamente', 'Quase', 'Não']} value={understoodRequest} onChange={setUnderstoodRequest} optionClass={optionClass} />
            <Question label="O tempo de espera foi aceitável?" options={['Sim', 'Um pouco', 'Não']} value={waitTimeAcceptable} onChange={setWaitTimeAcceptable} optionClass={optionClass} />
            <Question label="Você indicaria a Navo para um amigo?" options={['Com certeza', 'Talvez', 'Não']} value={wouldRecommend} onChange={setWouldRecommend} optionClass={optionClass} />
            <label className="block text-xs font-bold text-content-muted">O que podemos melhorar? (opcional)
              <textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={2000} placeholder="Escreva seu feedback..." className="mt-1.5 min-h-24 w-full resize-none rounded-xl border border-border-subtle bg-surface-base p-3 text-sm text-content-base outline-none focus:border-gold-base" />
            </label>
            {error && <ErrorMessage text={error} />}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => { setStage('lookup'); setAccess(null); setError(null); }} disabled={loading} className="h-11 rounded-xl border border-border-subtle px-4 text-sm font-bold text-content-muted">Voltar</button><button type="submit" disabled={loading} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gold-base px-4 text-sm font-bold text-surface-base disabled:opacity-60">{loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</> : 'Enviar avaliação'}</button></div>
          </form>
        )}
      </div>
    </div>
  );
};

const Question: React.FC<{ label: string; options: string[]; value: string; onChange: (value: string) => void; optionClass: (active: boolean) => string }> = ({ label, options, value, onChange, optionClass }) => (
  <div><p className="mb-1.5 text-xs font-bold text-content-base">{label}</p><div className="grid grid-cols-3 gap-2">{options.map((option) => <button key={option} type="button" onClick={() => onChange(option)} className={optionClass(value === option)}>{option}</button>)}</div></div>
);

const ErrorMessage: React.FC<{ text: string }> = ({ text }) => <div className="flex items-start gap-2 rounded-xl border border-status-error/30 bg-status-error/10 p-3 text-sm font-semibold text-status-error"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{text}</span></div>;
