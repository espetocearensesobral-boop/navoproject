import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Loader2, MessageSquare, Star, X } from 'lucide-react';
import { fetchProfessionalsFromSupabase, fetchServicesFromSupabase, startPublicReviewSession, submitPublicReview } from '../../services/supabaseDataService';
import type { Professional, ServiceItem } from '../../types';
import { hapticSuccess } from '../../lib/haptics';

interface PublicReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ReviewStage = 'selection' | 'survey' | 'success' | 'expired';

const TOTAL_SURVEY_STEPS = 6;

export const PublicReviewModal: React.FC<PublicReviewModalProps> = ({ isOpen, onClose }) => {
  const [stage, setStage] = useState<ReviewStage>('selection');
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [serviceId, setServiceId] = useState('');
  const [professionalId, setProfessionalId] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [surveyStep, setSurveyStep] = useState(0);
  const [rating, setRating] = useState(5);
  const [understoodRequest, setUnderstoodRequest] = useState('Sim, perfeitamente');
  const [waitTimeAcceptable, setWaitTimeAcceptable] = useState('Sim');
  const [serviceExperience, setServiceExperience] = useState('Excelente');
  const [wouldRecommend, setWouldRecommend] = useState('Com certeza');
  const [comment, setComment] = useState('');
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const serviceSelectRef = useRef<HTMLSelectElement | null>(null);
  const stepFocusRef = useRef<HTMLElement | null>(null);
  const submitButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setStage('selection');
    setServiceId('');
    setProfessionalId('');
    setSessionToken('');
    setExpiresAt(0);
    setRemainingSeconds(0);
    setSurveyStep(0);
    setRating(5);
    setUnderstoodRequest('Sim, perfeitamente');
    setWaitTimeAcceptable('Sim');
    setServiceExperience('Excelente');
    setWouldRecommend('Com certeza');
    setComment('');
    setError(null);
    setLoading(false);
    setLoadingOptions(true);

    Promise.all([startPublicReviewSession(), fetchServicesFromSupabase(), fetchProfessionalsFromSupabase()])
      .then(([session, loadedServices, loadedProfessionals]) => {
        if (cancelled) return;
        setSessionToken(session.token);
        setExpiresAt(session.expiresAt);
        setServices(loadedServices.filter((service) => service.id));
        setProfessionals(loadedProfessionals.filter((professional) => professional.id));
      })
      .catch(() => {
        if (!cancelled) setError('Não foi possível iniciar a avaliação agora. Tente novamente.');
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingOptions(false);
          window.setTimeout(() => serviceSelectRef.current?.focus(), 80);
        }
      });

    return () => { cancelled = true; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !expiresAt || stage === 'success') return;
    const updateRemaining = () => {
      const next = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setRemainingSeconds(next);
      if (next <= 0) {
        setStage('expired');
        setSessionToken('');
      }
    };
    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [isOpen, expiresAt, stage]);

  useEffect(() => {
    if (!isOpen || stage !== 'survey') return;
    window.requestAnimationFrame(() => {
      stepFocusRef.current?.focus();
    });
  }, [isOpen, stage, surveyStep]);

  if (!isOpen) return null;

  const selectedService = services.find((service) => service.id === serviceId);
  const selectedProfessional = professionals.find((professional) => professional.id === professionalId);
  const sessionReady = Boolean(sessionToken && remainingSeconds > 0);
  const formattedRemaining = `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, '0')}`;
  const progressPercent = ((surveyStep + 1) / TOTAL_SURVEY_STEPS) * 100;

  const handleSelection = (event: React.FormEvent) => {
    event.preventDefault();
    if (!sessionReady) {
      setStage('expired');
      return;
    }
    if (!serviceId || !professionalId) {
      setError('Escolha o serviço e o profissional para continuar.');
      return;
    }
    setError(null);
    setSurveyStep(0);
    setStage('survey');
  };

  const submitReview = async () => {
    if (!selectedService || !selectedProfessional || !sessionReady) {
      setStage('expired');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await submitPublicReview({
        sessionToken,
        serviceId: selectedService.id,
        serviceTitle: selectedService.title,
        professionalId: selectedProfessional.id,
        rating,
        understoodRequest,
        waitTimeAcceptable,
        serviceExperience,
        wouldRecommend,
        comment: comment.trim() || undefined,
      });
      setStage('success');
      hapticSuccess();
    } catch (submitError: any) {
      const message = String(submitError?.message || '');
      if (message.toLowerCase().includes('expirou')) {
        setSessionToken('');
        setStage('expired');
      } else {
        setError(message.includes('Não foi possível concluir')
          ? 'Não foi possível registrar a avaliação agora. Tente enviar novamente; nenhuma identificação foi solicitada.'
          : message || 'Não foi possível enviar a avaliação.');
        window.setTimeout(() => submitButtonRef.current?.focus(), 0);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSurveyNext = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!sessionReady) {
      setStage('expired');
      return;
    }
    setError(null);
    if (surveyStep < TOTAL_SURVEY_STEPS - 1) {
      setSurveyStep((current) => current + 1);
      return;
    }
    await submitReview();
  };

  const handleSurveyBack = () => {
    setError(null);
    if (surveyStep === 0) {
      setStage('selection');
      return;
    }
    setSurveyStep((current) => current - 1);
  };

  const restartSession = async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await startPublicReviewSession();
      setSessionToken(session.token);
      setExpiresAt(session.expiresAt);
      setRemainingSeconds(Math.ceil((session.expiresAt - Date.now()) / 1000));
      setServiceId('');
      setProfessionalId('');
      setSurveyStep(0);
      setStage('selection');
    } catch (restartError: any) {
      setError(restartError?.message || 'Não foi possível reiniciar a avaliação.');
    } finally {
      setLoading(false);
    }
  };

  const optionClass = (active: boolean) => `flex min-h-14 w-full items-center justify-center rounded-xl border px-3 py-3 text-center text-sm font-semibold transition-colors ${active ? 'border-gold-base bg-gold-base text-surface-base shadow-sm' : 'border-border-subtle bg-surface-base text-content-muted hover:border-gold-base/50 hover:text-content-base'}`;
  const timer = sessionReady && <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-gold-base/30 bg-gold-base/10 px-2.5 py-1.5 text-xs font-bold text-gold-base"><Clock3 className="h-3.5 w-3.5" /> Expira em {formattedRemaining}</span>;

  const renderSurveyStep = () => {
    if (surveyStep === 0) {
      return (
        <div className="space-y-4 text-center">
          <p className="text-sm leading-relaxed text-content-muted">Dê uma nota geral para o atendimento.</p>
          <div className="rounded-2xl border border-border-subtle bg-surface-base p-5">
            <div className="flex justify-center gap-2" role="radiogroup" aria-label="Nota geral">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  ref={star === 1 ? (element) => { stepFocusRef.current = element; } : undefined}
                  type="button"
                  onClick={() => setRating(star)}
                  aria-label={`Dar ${star} estrelas`}
                  aria-pressed={star === rating}
                  className="rounded-xl p-1.5 transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-gold-base"
                >
                  <Star className={`h-10 w-10 ${star <= rating ? 'fill-gold-base text-gold-base' : 'text-border-subtle'}`} />
                </button>
              ))}
            </div>
            <p className="mt-3 text-sm font-bold text-gold-base">{rating} de 5 estrelas</p>
          </div>
        </div>
      );
    }

    if (surveyStep === 1) {
      return <OptionStep number="2" label="O resultado ficou como você esperava?" options={['Sim, perfeitamente', 'Quase', 'Não']} value={understoodRequest} onChange={setUnderstoodRequest} optionClass={optionClass} focusRef={stepFocusRef} />;
    }
    if (surveyStep === 2) {
      return <OptionStep number="3" label="O tempo de espera foi aceitável?" options={['Sim', 'Um pouco', 'Não']} value={waitTimeAcceptable} onChange={setWaitTimeAcceptable} optionClass={optionClass} focusRef={stepFocusRef} />;
    }
    if (surveyStep === 3) {
      return <OptionStep number="4" label="Como você avalia o atendimento?" options={['Excelente', 'Muito bom', 'Bom', 'Pode melhorar']} value={serviceExperience} onChange={setServiceExperience} optionClass={optionClass} focusRef={stepFocusRef} />;
    }
    if (surveyStep === 4) {
      return <OptionStep number="5" label="Você recomendaria a Navo?" options={['Com certeza', 'Talvez', 'Não']} value={wouldRecommend} onChange={setWouldRecommend} optionClass={optionClass} focusRef={stepFocusRef} />;
    }

    return (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-content-muted">Se quiser, compartilhe uma observação final. Esta etapa é opcional.</p>
        <textarea
          ref={(element) => { stepFocusRef.current = element; }}
          data-review-step-focus="true"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          maxLength={2000}
          placeholder="Conte algo que queira compartilhar..."
          className="min-h-40 w-full resize-none rounded-2xl border border-border-subtle bg-surface-base p-4 text-base text-content-base outline-none transition-colors placeholder:text-content-muted focus:border-gold-base"
        />
        <p className="text-right text-xs text-content-muted">{comment.length}/2000</p>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center bg-surface-base/80 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="public-review-title">
      <div className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border-subtle bg-surface-card p-5 shadow-2xl sm:p-7">
        <button type="button" onClick={onClose} aria-label="Fechar avaliação" className="absolute right-4 top-4 rounded-full bg-surface-base p-2 text-content-muted hover:text-content-base"><X className="h-5 w-5" /></button>

        {stage === 'success' ? (
          <div className="space-y-4 py-12 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-gold-base/30 bg-gold-base/10 text-gold-base"><CheckCircle2 className="h-8 w-8" /></div>
            <h2 id="public-review-title" className="text-xl font-serif font-bold text-content-base">Obrigado pela avaliação</h2>
            <p className="text-sm leading-relaxed text-content-muted">Seu feedback foi registrado e ajuda a Navo a melhorar cada atendimento.</p>
            <button type="button" onClick={onClose} className="h-11 w-full rounded-xl bg-gold-base text-sm font-bold text-surface-base">Fechar</button>
          </div>
        ) : stage === 'expired' ? (
          <div className="space-y-4 py-10 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-status-warning/30 bg-status-warning/10 text-status-warning"><Clock3 className="h-8 w-8" /></div>
            <h2 id="public-review-title" className="text-xl font-serif font-bold text-content-base">Esta avaliação expirou</h2>
            <p className="text-sm leading-relaxed text-content-muted">A janela de preenchimento é de 5 minutos. Reinicie pelo mesmo link para começar uma nova avaliação.</p>
            {error && <ErrorMessage text={error} />}
            <button type="button" onClick={restartSession} disabled={loading} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gold-base text-sm font-bold text-surface-base disabled:opacity-60">{loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Reiniciando...</> : 'Iniciar novamente'}</button>
          </div>
        ) : stage === 'selection' ? (
          <form onSubmit={handleSelection} className="space-y-5 pt-4">
            <div className="flex items-start justify-between gap-3 pr-8"><div><div className="mb-2 inline-flex items-center gap-2 rounded-full border border-gold-base/30 bg-gold-base/10 px-3 py-1 text-xs font-bold text-gold-base"><MessageSquare className="h-3.5 w-3.5" /> Avaliação rápida</div><h2 id="public-review-title" className="text-xl font-serif font-bold text-content-base">Como foi sua experiência?</h2></div>{timer}</div>
            <p className="text-sm leading-relaxed text-content-muted">Escolha o serviço e o profissional. Depois, responderemos uma pergunta por vez. Não pedimos nome, telefone ou login.</p>
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-content-muted">Qual serviço você realizou?
                <select ref={serviceSelectRef} value={serviceId} onChange={(event) => setServiceId(event.target.value)} required disabled={loadingOptions || !sessionReady} className="mt-1.5 h-12 w-full rounded-xl border border-border-subtle bg-surface-base px-3 text-sm text-content-base outline-none focus:border-gold-base"><option value="">{loadingOptions ? 'Carregando serviços...' : 'Selecione o serviço'}</option>{services.map((service) => <option key={service.id} value={service.id}>{service.title}</option>)}</select>
              </label>
              <label className="block text-xs font-bold uppercase tracking-wider text-content-muted">Qual profissional realizou o atendimento?
                <select value={professionalId} onChange={(event) => setProfessionalId(event.target.value)} required disabled={loadingOptions || !sessionReady} className="mt-1.5 h-12 w-full rounded-xl border border-border-subtle bg-surface-base px-3 text-sm text-content-base outline-none focus:border-gold-base"><option value="">{loadingOptions ? 'Carregando profissionais...' : 'Selecione o profissional'}</option>{professionals.map((professional) => <option key={professional.id} value={professional.id}>{professional.name}</option>)}</select>
              </label>
            </div>
            {error && <ErrorMessage text={error} />}
            <button type="submit" disabled={loadingOptions || !sessionReady || services.length === 0 || professionals.length === 0} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gold-base text-sm font-bold text-surface-base disabled:opacity-60">Continuar <ChevronRight className="h-4 w-4" /></button>
          </form>
        ) : (
          <form onSubmit={handleSurveyNext} className="space-y-5 pt-4">
            <div className="flex items-start justify-between gap-3 pr-8"><div className="min-w-0"><p className="truncate text-xs font-bold uppercase tracking-wider text-gold-base">{selectedService?.title}</p><h2 id="public-review-title" className="mt-1 text-xl font-serif font-bold text-content-base">Uma pergunta por vez</h2><p className="mt-1 text-sm text-content-muted">Atendimento com {selectedProfessional?.name}.</p></div>{timer}</div>
            <div aria-label={`Progresso: etapa ${surveyStep + 1} de ${TOTAL_SURVEY_STEPS}`} className="space-y-2"><div className="flex items-center justify-between text-xs font-bold text-content-muted"><span>Etapa {surveyStep + 1} de {TOTAL_SURVEY_STEPS}</span><span>{Math.round(progressPercent)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-surface-base"><div className="h-full rounded-full bg-gold-base transition-all duration-200" style={{ width: `${progressPercent}%` }} /></div></div>
            <section className="min-h-[270px] rounded-2xl border border-border-subtle bg-surface-base p-5 sm:p-6" aria-live="polite">{renderSurveyStep()}</section>
            {error && <ErrorMessage text={error} />}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between"><button type="button" onClick={handleSurveyBack} disabled={loading} className="flex h-12 items-center justify-center gap-1 rounded-xl border border-border-subtle px-4 text-sm font-bold text-content-muted"><ChevronLeft className="h-4 w-4" /> Voltar</button><button ref={submitButtonRef} type="submit" disabled={loading || !sessionReady} aria-busy={loading} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-gold-base px-4 text-sm font-bold text-surface-base shadow-sm transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60">{loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</> : surveyStep === TOTAL_SURVEY_STEPS - 1 ? 'Enviar avaliação' : 'Continuar'}{!loading && surveyStep < TOTAL_SURVEY_STEPS - 1 && <ChevronRight className="h-4 w-4" />}</button></div>
          </form>
        )}
      </div>
    </div>
  );
};

const OptionStep: React.FC<{
  number: string;
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  optionClass: (active: boolean) => string;
  focusRef: React.MutableRefObject<HTMLElement | null>;
}> = ({ number, label, options, value, onChange, optionClass, focusRef }) => (
  <div className="space-y-5">
    <div><p className="text-xs font-bold uppercase tracking-wider text-gold-base">Pergunta {number}</p><h3 className="mt-2 text-lg font-bold leading-snug text-content-base">{label}</h3></div>
    <div className="grid gap-2.5" role="radiogroup" aria-label={label}>{options.map((option, index) => <button key={option} ref={index === 0 ? (element) => { focusRef.current = element; } : undefined} type="button" onClick={() => onChange(option)} aria-pressed={value === option} className={optionClass(value === option)}>{option}</button>)}</div>
  </div>
);

const ErrorMessage: React.FC<{ text: string }> = ({ text }) => <div className="flex items-start gap-2 rounded-xl border border-status-error/30 bg-status-error/10 p-3 text-sm font-semibold text-status-error" role="alert"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{text}</span></div>;
