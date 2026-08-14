import React, { useState, useEffect } from 'react';
import { handleEnterAsTab } from '../../utils/formUtils';
import { 
  Wallet, 
  DollarSign, 
  PlusCircle, 
  MinusCircle, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  User, 
  FileText, 
  Printer, 
  History, 
  ArrowUpRight, 
  ArrowDownRight, 
  RefreshCw,
  Lock,
  Unlock,
  X
} from 'lucide-react';
import { AdminPageHeader } from './shared/AdminPageHeader';

export interface CaixaSession {
  id: string;
  openedAt: string;
  closedAt?: string;
  operatorName: string;
  initialBalance: number;
  cashInSales: number;
  pixSales: number;
  cardSales: number;
  supplies: number; // Suprimentos
  withdrawals: number; // Sangrias
  expectedCash: number;
  declaredCash?: number;
  difference?: number;
  notes?: string;
  status: 'open' | 'closed';
}

export interface CaixaMovement {
  id: string;
  type: 'suprimento' | 'sangria';
  amount: number;
  description: string;
  timestamp: string;
  operatorName: string;
}

export const CaixaManagement: React.FC = () => {
  // Saved Caixa State
  const [currentSession, setCurrentSession] = useState<CaixaSession | null>(() => {
    const saved = localStorage.getItem('navo_caixa_session_v1');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    // Default open session for demonstration
    return {
      id: 'cx_20260809',
      openedAt: new Date(Date.now() - 5 * 3600000).toISOString(),
      operatorName: 'Gerente Carlos',
      initialBalance: 200,
      cashInSales: 350,
      pixSales: 820,
      cardSales: 640,
      supplies: 50,
      withdrawals: 30,
      expectedCash: 570, // 200 + 350 + 50 - 30
      status: 'open'
    };
  });

  const [movements, setMovements] = useState<CaixaMovement[]>(() => {
    const saved = localStorage.getItem('navo_caixa_movements_v1');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return [
      { id: 'm1', type: 'suprimento', amount: 50, description: 'Troco adicional fornecido pelo cofre', timestamp: new Date(Date.now() - 3 * 3600000).toISOString(), operatorName: 'Gerente Carlos' },
      { id: 'm2', type: 'sangria', amount: 30, description: 'Pagamento de entregador de produtos', timestamp: new Date(Date.now() - 1 * 3600000).toISOString(), operatorName: 'Gerente Carlos' }
    ];
  });

  const [history, setHistory] = useState<CaixaSession[]>(() => {
    const saved = localStorage.getItem('navo_caixa_history_v1');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return [
      {
        id: 'cx_20260808',
        openedAt: new Date(Date.now() - 29 * 3600000).toISOString(),
        closedAt: new Date(Date.now() - 18 * 3600000).toISOString(),
        operatorName: 'Gerente Carlos',
        initialBalance: 150,
        cashInSales: 480,
        pixSales: 1200,
        cardSales: 950,
        supplies: 0,
        withdrawals: 50,
        expectedCash: 580,
        declaredCash: 580,
        difference: 0,
        notes: 'Caixa fechado sem divergências.',
        status: 'closed'
      }
    ];
  });

  // Modal & Form States
  const [isOpeningModalOpen, setIsOpeningModalOpen] = useState(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);

  // Form Inputs
  const [openInitialBalance, setOpenInitialBalance] = useState<number>(200);
  const [openOperatorName, setOpenOperatorName] = useState('Gerente Carlos');

  const [movType, setMovType] = useState<'suprimento' | 'sangria'>('sangria');
  const [movAmount, setMovAmount] = useState<string>('');
  const [movDescription, setMovDescription] = useState<string>('');

  const [closeDeclaredCash, setCloseDeclaredCash] = useState<string>('');
  const [closeNotes, setCloseNotes] = useState<string>('');
  const [receiptSession, setReceiptSession] = useState<CaixaSession | null>(null);

  // Sync to localStorage
  useEffect(() => {
    if (currentSession) {
      localStorage.setItem('navo_caixa_session_v1', JSON.stringify(currentSession));
    } else {
      localStorage.removeItem('navo_caixa_session_v1');
    }
  }, [currentSession]);

  useEffect(() => {
    localStorage.setItem('navo_caixa_movements_v1', JSON.stringify(movements));
  }, [movements]);

  useEffect(() => {
    localStorage.setItem('navo_caixa_history_v1', JSON.stringify(history));
  }, [history]);

  // Open Caixa
  const handleConfirmOpenCaixa = (e: React.FormEvent) => {
    e.preventDefault();
    const newSess: CaixaSession = {
      id: `cx_${Date.now()}`,
      openedAt: new Date().toISOString(),
      operatorName: openOperatorName.trim() || 'Operador',
      initialBalance: Number(openInitialBalance || 0),
      cashInSales: 0,
      pixSales: 0,
      cardSales: 0,
      supplies: 0,
      withdrawals: 0,
      expectedCash: Number(openInitialBalance || 0),
      status: 'open'
    };
    setCurrentSession(newSess);
    setMovements([]);
    setIsOpeningModalOpen(false);
  };

  // Add Suprimento / Sangria
  const handleConfirmMovement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSession || !movAmount || Number(movAmount) <= 0) return;

    const amt = Number(movAmount);
    const newMov: CaixaMovement = {
      id: `mov_${Date.now()}`,
      type: movType,
      amount: amt,
      description: movDescription.trim() || (movType === 'suprimento' ? 'Entrada de troco' : 'Retirada de caixa'),
      timestamp: new Date().toISOString(),
      operatorName: currentSession.operatorName
    };

    const updatedMovements = [newMov, ...movements];
    setMovements(updatedMovements);

    const updatedSupplies = movType === 'suprimento' ? currentSession.supplies + amt : currentSession.supplies;
    const updatedWithdrawals = movType === 'sangria' ? currentSession.withdrawals + amt : currentSession.withdrawals;
    const updatedExpected = currentSession.initialBalance + currentSession.cashInSales + updatedSupplies - updatedWithdrawals;

    setCurrentSession({
      ...currentSession,
      supplies: updatedSupplies,
      withdrawals: updatedWithdrawals,
      expectedCash: updatedExpected
    });

    setMovAmount('');
    setMovDescription('');
    setIsMovementModalOpen(false);
  };

  // Close Caixa
  const handleConfirmCloseCaixa = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSession) return;

    const declared = Number(closeDeclaredCash || 0);
    const expected = currentSession.expectedCash;
    const diff = declared - expected;

    const closedSess: CaixaSession = {
      ...currentSession,
      closedAt: new Date().toISOString(),
      declaredCash: declared,
      difference: diff,
      notes: closeNotes.trim() || (diff === 0 ? 'Fechamento perfeito sem divergências.' : `Divergência de R$ ${diff.toFixed(2)}`),
      status: 'closed'
    };

    setHistory([closedSess, ...history]);
    setCurrentSession(null);
    setIsClosingModalOpen(false);
    setReceiptSession(closedSess);
  };

  return (
    <div className="space-y-4 animate-fade-in text-content-base min-w-0">
      {/* Header (desktop) */}
      <AdminPageHeader
        icon={Wallet}
        title="Gestão & Controle de Caixa"
        stats={[
          { label: currentSession ? 'caixa aberto' : 'caixa fechado', value: '', tone: currentSession ? 'success' : 'muted' },
        ]}
        action={
          !currentSession
            ? { label: 'Abrir Caixa do Dia', onClick: () => setIsOpeningModalOpen(true), icon: Unlock }
            : { label: 'Fechar Caixa', onClick: () => setIsClosingModalOpen(true), icon: Lock }
        }
      >
        {currentSession && (
          <button
            onClick={() => setIsMovementModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-surface-base border border-border-subtle hover:border-gold-base/50 text-content-base text-xs font-bold flex items-center gap-1.5 transition-all"
          >
            <PlusCircle className="w-3.5 h-3.5 text-gold-base" />
            <span>Suprimento / Sangria</span>
          </button>
        )}
      </AdminPageHeader>

      {/* Ações (mobile) */}
      <div className="md:hidden">
        {!currentSession ? (
          <button
            onClick={() => setIsOpeningModalOpen(true)}
            className="w-full bg-gold-base hover:bg-gold-hover text-surface-base px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
          >
            <Unlock className="w-4 h-4" />
            <span>Abrir Caixa do Dia</span>
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMovementModalOpen(true)}
              className="flex-1 bg-surface-base border border-border-subtle hover:border-gold-base/50 text-content-base px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
            >
              <PlusCircle className="w-4 h-4 text-gold-base" />
              <span>Suprimento</span>
            </button>

            <button
              onClick={() => setIsClosingModalOpen(true)}
              className="flex-1 bg-status-error/10 hover:bg-status-error/20 text-status-error border border-status-error/30 px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95"
            >
              <Lock className="w-4 h-4" />
              <span>Fechar Caixa</span>
            </button>
          </div>
        )}
      </div>

      {/* ACTIVE CAIXA DASHBOARD */}
      {currentSession ? (
        <div className="space-y-4">
          {/* Main Caixa Balance Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-content-muted mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider truncate">Saldo Inicial</span>
                <div className="w-6 h-6 rounded-lg bg-surface-base border border-border-subtle flex items-center justify-center shrink-0">
                  <User className="w-3.5 h-3.5 text-gold-base" />
                </div>
              </div>
              <p className="text-lg font-black finance-positive tabular-nums truncate">R$ {currentSession.initialBalance.toFixed(2)}</p>
              <p className="text-[9px] text-content-muted mt-1 font-medium truncate">{currentSession.operatorName}</p>
            </div>

            <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-content-muted mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider truncate">Em Dinheiro</span>
                <div className="w-6 h-6 rounded-lg bg-status-success/10 text-status-success flex items-center justify-center shrink-0">
                  <DollarSign className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className="text-lg font-black finance-positive tabular-nums truncate">+ R$ {currentSession.cashInSales.toFixed(2)}</p>
              <p className="text-[9px] text-content-muted mt-1 font-medium truncate">Espécie na gaveta</p>
            </div>

            <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-content-muted mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider truncate">Suprim. / Sangrias</span>
                <div className="w-6 h-6 rounded-lg bg-gold-base/10 text-gold-base flex items-center justify-center shrink-0">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className={`text-lg font-black tabular-nums truncate ${currentSession.supplies - currentSession.withdrawals >= 0 ? 'finance-positive' : 'finance-negative'}`}>R$ {(currentSession.supplies - currentSession.withdrawals).toFixed(2)}</p>
              <p className="text-[9px] text-content-muted mt-1 font-medium truncate">+{currentSession.supplies.toFixed(0)} / -{currentSession.withdrawals.toFixed(0)}</p>
            </div>

            <div className="p-3 bg-surface-card border border-gold-base/50 rounded-2xl bg-gold-base/5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-gold-base mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider truncate">Esperado</span>
                <div className="w-6 h-6 rounded-lg bg-gold-base/15 flex items-center justify-center shrink-0">
                  <Wallet className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className="text-lg font-black finance-positive tabular-nums truncate">R$ {currentSession.expectedCash.toFixed(2)}</p>
              <p className="text-[9px] text-content-muted mt-1 font-medium truncate">Conferência no fechamento</p>
            </div>
          </div>

          {/* Secondary Payment Methods Breakdown */}
          <div className="bg-surface-card border border-border-subtle rounded-2xl p-4 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-content-base uppercase tracking-wider">
              Entradas Totais por Forma de Pagamento no Caixa
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-surface-base p-3 rounded-xl border border-border-subtle flex justify-between items-center">
                <span className="text-content-muted font-bold">PIX Digital:</span>
                <span className="font-bold finance-positive tabular-nums">R$ {currentSession.pixSales.toFixed(2)}</span>
              </div>
              <div className="bg-surface-base p-3 rounded-xl border border-border-subtle flex justify-between items-center">
                <span className="text-content-muted font-bold">Cartões (Crédito/Débito):</span>
                <span className="font-bold finance-positive tabular-nums">R$ {currentSession.cardSales.toFixed(2)}</span>
              </div>
              <div className="bg-surface-base p-3 rounded-xl border border-border-subtle flex justify-between items-center">
                <span className="text-content-muted font-bold">Dinheiro (Espécie):</span>
                <span className="font-bold finance-positive tabular-nums">R$ {currentSession.cashInSales.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Movements History */}
          <div className="bg-surface-card border border-border-subtle rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-content-base uppercase tracking-wider">
                Movimentações de Sangria & Suprimento
              </h3>
              <button
                onClick={() => setIsMovementModalOpen(true)}
                className="text-xs text-gold-base font-bold hover:underline flex items-center gap-1"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Lançar Movimentação</span>
              </button>
            </div>

            {movements.length === 0 ? (
              <p className="text-xs text-content-muted py-3 text-center">Nenhuma sangria ou suprimento lançado neste caixa.</p>
            ) : (
              <div className="space-y-2">
                {movements.map((m) => (
                  <div key={m.id} className="flex justify-between items-center bg-surface-base p-2.5 rounded-xl border border-border-subtle/80 text-xs">
                    <div className="flex items-center gap-2">
                      {m.type === 'suprimento' ? (
                        <span className="w-6 h-6 rounded-lg bg-status-success/15 text-status-success flex items-center justify-center shrink-0">
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </span>
                      ) : (
                        <span className="w-6 h-6 rounded-lg bg-status-error/15 text-status-error flex items-center justify-center shrink-0">
                          <ArrowDownRight className="w-3.5 h-3.5" />
                        </span>
                      )}
                      <div>
                        <span className="font-bold text-content-base capitalize">{m.type}: {m.description}</span>
                        <span className="text-[10px] text-content-muted block font-mono">
                          {new Date(m.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • {m.operatorName}
                        </span>
                      </div>
                    </div>
                    <span className={`font-bold tabular-nums ${m.type === 'suprimento' ? 'finance-positive' : 'finance-negative'}`}>
                      {m.type === 'suprimento' ? '+' : '-'} R$ {m.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* CLOSED CAIXA WARNING CARD */
        <div className="bg-surface-card border border-border-subtle rounded-2xl p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-status-error/10 border border-status-error/30 text-status-error flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-content-base">O Caixa da Barbearia está Fechado</h3>
          <p className="text-xs text-content-muted max-w-sm mx-auto">
            Abra o caixa para iniciar as operações do dia, registrar fundos de troco e conferir entradas em dinheiro.
          </p>
          <button
            onClick={() => setIsOpeningModalOpen(true)}
            className="bg-gold-base text-surface-base px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 hover:bg-gold-hover transition-all shadow-md"
          >
            <Unlock className="w-4 h-4" />
            <span>Abrir Caixa Agora</span>
          </button>
        </div>
      )}

      {/* PAST CAIXA SESSIONS HISTORY */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl p-4 shadow-xs space-y-3">
        <h3 className="text-xs font-bold text-content-base uppercase tracking-wider flex items-center gap-2">
          <History className="w-4 h-4 text-gold-base" />
          <span>Histórico de Fechamentos Anteriores</span>
        </h3>

        {history.length === 0 ? (
          <p className="text-xs text-content-muted py-3 text-center">Nenhum histórico de fechamento gravado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[880px]">
              <thead className="bg-surface-base border-b border-border-subtle text-content-muted uppercase font-bold text-[10px]">
                <tr className="whitespace-nowrap">
                  <th className="p-3">Data Fechamento</th>
                  <th className="p-3">Operador</th>
                  <th className="p-3 text-right">Fundo Inicial</th>
                  <th className="p-3 text-right">Dinheiro Esperado</th>
                  <th className="p-3 text-right">Dinheiro Declarado</th>
                  <th className="p-3 text-right">Divergência</th>
                  <th className="p-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/60 text-content-base">
                {history.map((h) => {
                  const diff = h.difference || 0;
                  return (
                    <tr key={h.id} className="hover:bg-surface-base/50 transition-colors">
                      <td className="p-3 font-semibold">
                        {h.closedAt ? new Date(h.closedAt).toLocaleString('pt-BR') : '-'}
                      </td>
                      <td className="p-3 text-content-muted">{h.operatorName}</td>
                      <td className="p-3 text-right tabular-nums finance-positive">R$ {h.initialBalance.toFixed(2)}</td>
                      <td className="p-3 text-right tabular-nums finance-positive">R$ {h.expectedCash.toFixed(2)}</td>
                      <td className="p-3 text-right tabular-nums font-bold finance-positive">
                        R$ {(h.declaredCash || 0).toFixed(2)}
                      </td>
                      <td className={`p-3 text-right tabular-nums font-bold ${
                        diff >= 0 ? 'finance-positive' : 'finance-negative'
                      }`}>
                        {diff === 0 ? 'Exato (R$ 0)' : `${diff > 0 ? '+' : ''} R$ ${diff.toFixed(2)}`}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => setReceiptSession(h)}
                          className="p-1.5 rounded-lg border border-border-subtle hover:bg-surface-base text-content-muted hover:text-gold-base transition-colors"
                          title="Ver Relatório de Fechamento"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: OPEN CAIXA */}
      {isOpeningModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onKeyDown={handleEnterAsTab} onSubmit={handleConfirmOpenCaixa} className="bg-surface-card border border-border-subtle rounded-2xl w-full max-w-sm p-5 text-content-base space-y-4 relative shadow-2xl animate-fade-in">
            <button
              type="button"
              onClick={() => setIsOpeningModalOpen(false)}
              className="absolute top-4 right-4 text-content-muted hover:text-content-base p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-border-subtle pb-3">
              <div className="w-10 h-10 rounded-xl bg-gold-base/15 text-gold-base flex items-center justify-center shrink-0">
                <Unlock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-content-base">Abertura de Caixa</h3>
                <p className="text-xs text-content-muted">Defina o saldo inicial de troco para a gaveta.</p>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-content-muted uppercase block mb-1">Nome do Operador</label>
              <input
                type="text"
                required
                value={openOperatorName}
                onChange={(e) => setOpenOperatorName(e.target.value)}
                className="w-full bg-surface-base border border-border-subtle rounded-xl px-3 py-2 text-xs text-content-base focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-content-muted uppercase block mb-1">Fundo de Troco Inicial (R$)</label>
              <input
                type="number"
                required
                min="0"
                step="10"
                value={openInitialBalance}
                onChange={(e) => setOpenInitialBalance(Number(e.target.value))}
                className="w-full bg-surface-base border border-border-subtle rounded-xl px-3 py-2 text-xs text-content-base focus:outline-none font-bold text-gold-base"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsOpeningModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-content-muted hover:text-content-base"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-gold-base hover:bg-gold-hover text-surface-base px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
              >
                Confirmar & Abrir
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: MOVEMENT (SUPRIMENTO / SANGRIA) */}
      {isMovementModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onKeyDown={handleEnterAsTab} onSubmit={handleConfirmMovement} className="bg-surface-card border border-border-subtle rounded-2xl w-full max-w-sm p-5 text-content-base space-y-4 relative shadow-2xl animate-fade-in">
            <button
              type="button"
              onClick={() => setIsMovementModalOpen(false)}
              className="absolute top-4 right-4 text-content-muted hover:text-content-base p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-border-subtle pb-3">
              <div className="w-10 h-10 rounded-xl bg-gold-base/15 text-gold-base flex items-center justify-center shrink-0">
                <PlusCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-content-base">Lançar Movimentação</h3>
                <p className="text-xs text-content-muted">Entrada de troco ou retirada de caixa.</p>
              </div>
            </div>

            <div className="flex bg-surface-base p-1 rounded-xl border border-border-subtle">
              <button
                type="button"
                onClick={() => setMovType('sangria')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  movType === 'sangria' ? 'bg-status-error text-surface-base shadow-xs' : 'text-content-muted'
                }`}
              >
                Sangria (Retirada)
              </button>
              <button
                type="button"
                onClick={() => setMovType('suprimento')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  movType === 'suprimento' ? 'bg-status-success text-surface-base shadow-xs' : 'text-content-muted'
                }`}
              >
                Suprimento (Entrada)
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-content-muted uppercase block mb-1">Valor (R$)</label>
              <input
                type="number"
                required
                min="1"
                step="0.50"
                placeholder="0.00"
                value={movAmount}
                onChange={(e) => setMovAmount(e.target.value)}
                className="w-full bg-surface-base border border-border-subtle rounded-xl px-3 py-2 text-xs text-content-base focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-content-muted uppercase block mb-1">Motivo / Descrição</label>
              <input
                type="text"
                required
                placeholder="Ex: Troco de cofre / Pagamento de entregador"
                value={movDescription}
                onChange={(e) => setMovDescription(e.target.value)}
                className="w-full bg-surface-base border border-border-subtle rounded-xl px-3 py-2 text-xs text-content-base focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsMovementModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-content-muted hover:text-content-base"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-gold-base hover:bg-gold-hover text-surface-base px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
              >
                Confirmar Lançamento
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: CLOSE CAIXA */}
      {isClosingModalOpen && currentSession && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onKeyDown={handleEnterAsTab} onSubmit={handleConfirmCloseCaixa} className="bg-surface-card border border-border-subtle rounded-2xl w-full max-w-sm p-5 text-content-base space-y-4 relative shadow-2xl animate-fade-in">
            <button
              type="button"
              onClick={() => setIsClosingModalOpen(false)}
              className="absolute top-4 right-4 text-content-muted hover:text-content-base p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-border-subtle pb-3">
              <div className="w-10 h-10 rounded-xl bg-status-error/15 text-status-error flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-content-base">Fechamento do Caixa</h3>
                <p className="text-xs text-content-muted">Conferência final de valores em gaveta.</p>
              </div>
            </div>

            <div className="bg-surface-base p-3 rounded-xl border border-border-subtle space-y-1 text-xs">
              <div className="flex justify-between text-content-muted">
                <span>Dinheiro Esperado na Gaveta:</span>
                <span className="font-bold finance-positive tabular-nums">R$ {currentSession.expectedCash.toFixed(2)}</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-content-muted uppercase block mb-1">Dinheiro Contado na Gaveta (R$)</label>
              <input
                type="number"
                required
                min="0"
                step="0.5"
                placeholder="Digite o valor exato contado..."
                value={closeDeclaredCash}
                onChange={(e) => setCloseDeclaredCash(e.target.value)}
                className="w-full bg-surface-base border border-border-subtle rounded-xl px-3 py-2 text-sm font-bold text-content-base focus:outline-none"
              />
            </div>

            {closeDeclaredCash && (
              <div className={`p-2.5 rounded-xl border text-xs font-bold ${
                Number(closeDeclaredCash) === currentSession.expectedCash
                  ? 'bg-status-success/15 border-status-success/30 text-status-success'
                  : 'bg-status-error/15 border-status-error/30 text-status-error'
              }`}>
                {Number(closeDeclaredCash) === currentSession.expectedCash ? (
                  <span>✓ Caixa Perfeito! Nenhuma divergência encontrada.</span>
                ) : (
                  <span>
                    Divergência: {Number(closeDeclaredCash) - currentSession.expectedCash > 0 ? 'Sobra de' : 'Quebra de'} R$ {Math.abs(Number(closeDeclaredCash) - currentSession.expectedCash).toFixed(2)}
                  </span>
                )}
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-content-muted uppercase block mb-1">Observações / Justificativa</label>
              <textarea
                rows={2}
                placeholder="Insira notas do fechamento se houver divergência..."
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                className="w-full bg-surface-base border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsClosingModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-content-muted hover:text-content-base"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-status-error hover:bg-status-error/90 text-surface-base px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
              >
                Fechar Caixa Oficialmente
              </button>
            </div>
          </form>
        </div>
      )}

      {/* REPORT RECEIPT MODAL */}
      {receiptSession && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-card border border-border-subtle rounded-2xl w-full max-w-sm p-6 text-content-base space-y-4 relative shadow-2xl font-serif">
            <button
              onClick={() => setReceiptSession(null)}
              className="absolute top-4 right-4 text-content-muted hover:text-content-base p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center border-b border-border-subtle pb-4 space-y-1">
              <h2 className="text-lg font-bold text-content-base tracking-widest uppercase">NAVO PREMIUM</h2>
              <p className="text-[10px] text-gold-base font-bold uppercase tracking-widest">Relatório Z de Fechamento de Caixa</p>
              <p className="text-[10px] text-content-muted font-sans">Sessão #{receiptSession.id}</p>
            </div>

            <div className="text-xs font-sans space-y-1.5 border-b border-border-subtle pb-3">
              <p><strong>Operador:</strong> {receiptSession.operatorName}</p>
              <p><strong>Abertura:</strong> {new Date(receiptSession.openedAt).toLocaleString('pt-BR')}</p>
              <p><strong>Fechamento:</strong> {receiptSession.closedAt ? new Date(receiptSession.closedAt).toLocaleString('pt-BR') : 'Aberto'}</p>
            </div>

            <div className="font-sans space-y-1.5 text-xs">
              <div className="flex justify-between text-content-muted">
                <span>Fundo Inicial:</span>
                <span className="finance-positive">R$ {receiptSession.initialBalance.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-content-muted">
                <span>Vendas em Dinheiro:</span>
                <span className="finance-positive">+ R$ {receiptSession.cashInSales.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-content-muted">
                <span>Suprimentos:</span>
                <span className="finance-positive">+ R$ {receiptSession.supplies.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-content-muted">
                <span>Sangrias:</span>
                <span className="finance-negative">- R$ {receiptSession.withdrawals.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-content-base border-t border-border-subtle/60 pt-1">
                <span>Esperado em Gaveta:</span>
                <span className="finance-positive">R$ {receiptSession.expectedCash.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold finance-positive">
                <span>Declarado Contado:</span>
                <span className="finance-positive">R$ {(receiptSession.declaredCash || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold border-t border-border-subtle/80 pt-1">
                <span>Divergência:</span>
                <span className={(receiptSession.difference || 0) >= 0 ? 'finance-positive' : 'finance-negative'}>
                  R$ {(receiptSession.difference || 0).toFixed(2)}
                </span>
              </div>
            </div>

            {receiptSession.notes && (
              <p className="text-[10px] font-sans text-content-muted bg-surface-base p-2 rounded-xl border border-border-subtle">
                <strong>Notas:</strong> {receiptSession.notes}
              </p>
            )}

            <div className="pt-2 flex items-center justify-center font-sans">
              <button
                onClick={() => { window.print(); }}
                className="bg-gold-base text-surface-base px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Relatório Z</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
