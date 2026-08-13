import React, { useState, useEffect } from 'react';
import { authFetch } from '../../lib/api';
import { AdminPageHeader } from './shared/AdminPageHeader';
import { AdminTabs } from './shared/AdminTabs';
import { 
  fetchAppointmentsFromSupabase, 
  fetchServicesFromSupabase, 
  fetchProductsFromSupabase, 
  fetchProfessionalsFromSupabase,
  getQueueFromSupabase
} from '../../services/supabaseDataService';
import { Appointment, ServiceItem, ProductItem, Professional, WaitingQueueItem } from '../../types';
import { 
  Receipt, CreditCard, DollarSign, QrCode, ShoppingBag, Plus, Minus, Trash2, CheckCircle2, Check,
  Search, User, Scissors, Percent, Clock, AlertCircle, RefreshCw, Printer, Share2, Wallet, X, Calendar, ChevronRight, ChevronLeft, HandCoins, ArrowRight
} from 'lucide-react';
import { fetchShopProfile, ShopProfile, defaultShopProfile } from '../../services/shopProfileService';
import { getTodayStringBRT } from '../../utils/dateUtils';

export interface CartItem {
  id: string;
  type: 'service' | 'product';
  title: string;
  price: number;
  quantity: number;
  barberId?: string;
  barberName?: string;
}

export interface PdvTransaction {
  id: string;
  clientName: string;
  clientPhone?: string;
  professionalName: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  tip: number;
  total: number;
  paymentMethod: 'pix' | 'credit_card' | 'debit_card' | 'cash' | 'split';
  paymentDetails?: string;
  timestamp: string;
  appointmentId?: string;
}

export const PdvInteligente: React.FC = () => {
  // Global Data
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [queue, setQueue] = useState<WaitingQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [shopProfile, setShopProfile] = useState<ShopProfile>(defaultShopProfile);

  useEffect(() => {
    fetchShopProfile().then(p => { if (p) setShopProfile(p); });
  }, []);

  // Step-by-Step State
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // PDV Active Sale State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCatalog, setSearchCatalog] = useState('');
  
  // Cart State
  const [selectedClientName, setSelectedClientName] = useState('Cliente Avulso');
  const [selectedClientPhone, setSelectedClientPhone] = useState('');
  const [selectedBarber, setSelectedBarber] = useState<Professional | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [tipAmount, setTipAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credit_card' | 'debit_card' | 'cash' | 'split'>('pix');
  const [cashAmountGiven, setCashAmountGiven] = useState<string>('');
  const [linkedAppointmentId, setLinkedAppointmentId] = useState<string | null>(null);

  // Modals & UI States
  const [isCaixaOpen, setIsCaixaOpen] = useState(true);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<PdvTransaction | null>(null);
  const [todaysSales, setTodaysSales] = useState<PdvTransaction[]>([]);
  const [showSalesHistory, setShowSalesHistory] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

  // Load Data
  const loadData = async () => {
    setLoading(true);
    try {
      const [apts, srvs, prods, profs, q] = await Promise.all([
        fetchAppointmentsFromSupabase(),
        fetchServicesFromSupabase(),
        fetchProductsFromSupabase(),
        fetchProfessionalsFromSupabase(),
        getQueueFromSupabase()
      ]);
      setAppointments(apts);
      setServices(srvs);
      setProducts(prods);
      setProfessionals(profs);
      setQueue(q);
      if (profs.length > 0 && !selectedBarber) {
        setSelectedBarber(profs[0]);
      }
    } catch (err) {
      console.error('Erro ao carregar dados do PDV:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    authFetch('/api/cash-transactions')
      .then((res) => res.ok ? res.json() : [])
      .then((rows) => setTodaysSales((rows || []).map((row: any) => {
        let parsedItems: CartItem[] = [];
        try { parsedItems = row.notes ? JSON.parse(row.notes) : []; } catch { parsedItems = []; }
        return {
          id: row.id,
          clientName: row.description || 'Cliente',
          clientPhone: '',
          professionalName: row.professionalName || 'Profissional',
          items: parsedItems,
          subtotal: Number(row.amount || 0), discount: 0, tip: 0,
          total: Number(row.amount || 0),
          paymentMethod: row.paymentMethod || 'pix',
          timestamp: row.createdAt ? new Date(row.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        } as PdvTransaction;
      })))
      .catch((error) => console.error('Erro ao carregar vendas do banco:', error));
  }, []);

  // Filter Today's Pending Appointments
  const todayStr = getTodayStringBRT();
  const pendingAppointments = appointments.filter(a => 
    (a.date === todayStr || a.status === 'confirmed' || a.status === 'in_service' || a.status === 'in_queue') &&
    a.status !== 'cancelled' &&
    a.status !== 'completed'
  );

  // Flow Handlers
  const handleStartFromAppointment = (apt: Appointment) => {
    setLinkedAppointmentId(apt.id);
    setSelectedClientName(apt.client_name || 'Cliente');
    setSelectedClientPhone(apt.client_phone || '');
    
    const prof = professionals.find(p => p.id === apt.professional_id || p.name === apt.professional_name);
    if (prof) setSelectedBarber(prof);

    const items: CartItem[] = (apt.services || []).map(s => ({
      id: s.id,
      type: 'service',
      title: s.title,
      price: s.price,
      quantity: 1,
      barberId: prof?.id,
      barberName: prof?.name || apt.professional_name
    }));

    setCart(items);
    setDiscountAmount(apt.discount_amount || 0);
    setCurrentStep(2);
  };

  const handleStartFromQueue = (qItem: WaitingQueueItem) => {
    setSelectedClientName(qItem.client_name || 'Cliente');
    setSelectedClientPhone(qItem.client_phone || '');
    
    const prof = professionals.find(p => p.id === qItem.professional_id || p.name === qItem.professional_name);
    if (prof) setSelectedBarber(prof);

    const item: CartItem = {
      id: `q_srv_${Date.now()}`,
      type: 'service',
      title: qItem.service_title,
      price: qItem.service_price || 85,
      quantity: 1,
      barberId: prof?.id,
      barberName: prof?.name || qItem.professional_name
    };

    setCart([item]);
    setCurrentStep(2);
  };

  const handleStartAvulso = () => {
    handleClearCart();
    setCurrentStep(2);
  };

  // Cart Handlers
  const handleAddServiceToCart = (srv: ServiceItem) => {
    const existing = cart.find(i => i.id === srv.id);
    if (existing) {
      setCart(cart.map(i => i.id === srv.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setCart([...cart, {
        id: srv.id,
        type: 'service',
        title: srv.title,
        price: srv.price,
        quantity: 1,
        barberId: selectedBarber?.id,
        barberName: selectedBarber?.name
      }]);
    }
  };

  const handleAddProductToCart = (prod: ProductItem) => {
    const existing = cart.find(i => i.id === prod.id);
    if (existing) {
      setCart(cart.map(i => i.id === prod.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setCart([...cart, {
        id: prod.id,
        type: 'product',
        title: prod.name,
        price: prod.price,
        quantity: 1,
        barberId: selectedBarber?.id,
        barberName: selectedBarber?.name
      }]);
    }
  };

  const handleQuantityChange = (id: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : null;
      }
      return item;
    }).filter(Boolean) as CartItem[]);
  };

  const handleRemoveItem = (id: string) => {
    setCart(cart.filter(i => i.id !== id));
  };

  const handleClearCart = () => {
    setCart([]);
    setSelectedClientName('Cliente Avulso');
    setSelectedClientPhone('');
    setDiscountAmount(0);
    setTipAmount(0);
    setCashAmountGiven('');
    setLinkedAppointmentId(null);
  };

  // Calculations
  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const finalTotal = Math.max(0, subtotal - discountAmount + tipAmount);
  
  const estimatedCommission = cart.reduce((acc, item) => {
    if (item.type === 'service') {
      const rate = selectedBarber?.commission_rate || 0.40;
      return acc + (item.price * item.quantity * rate);
    } else {
      return acc + (item.price * item.quantity * 0.10);
    }
  }, 0);

  const cashNum = parseFloat(cashAmountGiven.replace(',', '.')) || 0;
  const changeAmount = cashNum > finalTotal ? cashNum - finalTotal : 0;

  const handleSetCashPreset = (value: number) => {
    setCashAmountGiven(value.toFixed(2));
  };

  const handleAddCashPreset = (addValue: number) => {
    const current = parseFloat(cashAmountGiven.replace(',', '.')) || 0;
    setCashAmountGiven((current + addValue).toFixed(2));
  };

  // Checkout Completion
  const handleFinalizeSale = async () => {
    if (cart.length === 0) return alert('O carrinho está vazio.');
    if (!isCaixaOpen) return alert('O caixa está fechado.');
    if (isFinalizing) return;

    setIsFinalizing(true);
    const tx: PdvTransaction = {
      id: `TRX-${Date.now().toString().slice(-6)}`,
      clientName: selectedClientName || 'Cliente Avulso',
      clientPhone: selectedClientPhone,
      professionalName: selectedBarber?.name || 'Não Informado',
      items: [...cart],
      subtotal,
      discount: discountAmount,
      tip: tipAmount,
      total: finalTotal,
      paymentMethod,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      appointmentId: linkedAppointmentId || undefined
    };

    try {
      const response = await authFetch('/api/cash-transactions', {
        method: 'POST',
        body: JSON.stringify({
          id: tx.id,
          amount: tx.total,
          type: 'income',
          description: tx.clientName,
          category: 'Serviços/Produtos',
          paymentMethod: tx.paymentMethod,
          date: todayStr,
          status: 'completed',
          professionalId: selectedBarber?.id,
          professionalName: tx.professionalName,
          notes: JSON.stringify(tx.items)
        })
      });

      if (response.ok) {
        const updatedSales = [tx, ...todaysSales];
        setTodaysSales(updatedSales);
        setLastTransaction(tx);
        setShowReceiptModal(true);
        handleClearCart();
        setCurrentStep(1); // Go back to start
        loadData(); // Refresh queue/appointments
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(errorData.error || 'Erro ao registrar venda. Tente novamente.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao finalizar venda.');
    } finally {
      setIsFinalizing(false);
    }
  };

  const handlePrintReceipt = (tx: PdvTransaction) => {
    const paymentMap: Record<string, string> = {
      'pix': 'PIX',
      'credit_card': 'Cartão de Crédito',
      'debit_card': 'Cartão de Débito',
      'cash': 'Dinheiro',
      'split': 'Dividido'
    };

    const itemsRows = tx.items.map(it => `
      <tr>
        <td style="padding: 4px 0; border-bottom: 1px dashed #ccc;">${it.quantity}x ${it.title}</td>
        <td style="padding: 4px 0; border-bottom: 1px dashed #ccc; text-align: right;">R$ ${(it.price * it.quantity).toFixed(2)}</td>
      </tr>
    `).join('');

    const receiptHtml = `
      <html>
        <head>
          <title>Comprovante de Venda</title>
          <style>
            body { font-family: 'Courier New', Courier, monospace; font-size: 12px; margin: 0; padding: 20px; color: #000; width: 300px; }
            h2 { font-size: 16px; margin: 0 0 5px 0; text-align: center; text-transform: uppercase; }
            p { margin: 2px 0; }
            .divider { border-bottom: 1px dashed #000; margin: 10px 0; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
            .totals { font-weight: bold; }
            .center { text-align: center; }
            .right { text-align: right; }
          </style>
        </head>
        <body>
          <h2>${shopProfile.name}</h2>
          <p class="center">${shopProfile.address || ''}</p>
          <p class="center">${shopProfile.phone || ''}</p>
          <div class="divider"></div>
          <p><strong>Recibo:</strong> ${tx.id}</p>
          <p><strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')} ${tx.timestamp}</p>
          <p><strong>Cliente:</strong> ${tx.clientName}</p>
          <p><strong>Profissional:</strong> ${tx.professionalName}</p>
          <div class="divider"></div>
          <table>
            <thead>
              <tr>
                <th style="text-align: left; border-bottom: 1px solid #000;">Item</th>
                <th style="text-align: right; border-bottom: 1px solid #000;">Valor</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>
          <div class="right totals">
            <p>Subtotal: R$ ${tx.subtotal.toFixed(2)}</p>
            ${tx.discount > 0 ? `<p>Desconto: - R$ ${tx.discount.toFixed(2)}</p>` : ''}
            ${tx.tip > 0 ? `<p>Gorjeta: + R$ ${tx.tip.toFixed(2)}</p>` : ''}
            <p style="font-size: 14px; margin-top: 5px;">TOTAL: R$ ${tx.total.toFixed(2)}</p>
          </div>
          <div class="divider"></div>
          <p><strong>Forma de Pagto:</strong> ${paymentMap[tx.paymentMethod]}</p>
          <div class="divider"></div>
          <p class="center">Obrigado pela preferência!</p>
          <p class="center">Volte sempre.</p>
        </body>
      </html>
    `;

    try {
      const existingFrame = document.getElementById('pdv-print-frame');
      if (existingFrame) existingFrame.remove();

      const printFrame = document.createElement('iframe');
      printFrame.id = 'pdv-print-frame';
      printFrame.style.position = 'absolute';
      printFrame.style.width = '0px';
      printFrame.style.height = '0px';
      printFrame.style.border = 'none';
      document.body.appendChild(printFrame);

      const doc = printFrame.contentWindow?.document || printFrame.contentDocument;
      if (doc) {
        doc.open();
        doc.write(receiptHtml);
        doc.close();
        setTimeout(() => {
          printFrame.contentWindow?.focus();
          printFrame.contentWindow?.print();
        }, 500);
      }
    } catch (e) {
      console.error('Print falhou:', e);
      alert('Não foi possível iniciar a impressão. Verifique se o navegador bloqueou o pop-up.');
    }
  };

  const handleShareWhatsApp = (tx: PdvTransaction) => {
    const cleanPhone = (tx.clientPhone || '').replace(/\D/g, '');
    const itemsText = tx.items.map(i => `• ${i.quantity}x ${i.title} (R$ ${(i.price * i.quantity).toFixed(2)})`).join('\n');
    
    const message = 
`*${shopProfile.name} - Comprovante*
Recibo: ${tx.id}
Data: ${new Date().toLocaleDateString('pt-BR')} ${tx.timestamp}

*Itens:*
${itemsText}

*Total Pago: R$ ${tx.total.toFixed(2)}*
Forma: ${tx.paymentMethod.toUpperCase()}
Profissional: ${tx.professionalName}

Obrigado pela preferência!`;

    const url = cleanPhone 
      ? `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
      
    window.open(url, '_blank');
  };

  const totalRevenueToday = todaysSales.reduce((acc, sale) => acc + sale.total, 0);

  return (
    <div className="flex flex-col h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in space-y-6">
      <AdminPageHeader
        title="PDV Rápido"
        icon={Wallet}
        stats={[
          { label: 'Caixa', value: isCaixaOpen ? 'ABERTO' : 'FECHADO', tone: isCaixaOpen ? 'success' : 'warning' },
          { label: 'Faturamento', value: `R$ ${totalRevenueToday.toFixed(2)}`, tone: 'success' },
        ]}
        action={{
          label: 'Histórico de Hoje',
          icon: Receipt,
          onClick: () => setShowSalesHistory(true)
        }}
      />

      <AdminTabs
        tabs={[
          { id: '1', label: '1. Origem', icon: Calendar },
          { id: '2', label: '2. Carrinho', icon: ShoppingBag },
          { id: '3', label: '3. Pagamento', icon: CreditCard },
        ]}
        activeId={currentStep.toString()}
        onChange={(id) => setCurrentStep(Number(id) as 1 | 2 | 3)}
      />

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 bg-transparent flex flex-col">
        
        {/* STEP 1: ORIGEM DA VENDA */}
        {currentStep === 1 && (
          <div className="flex-1 flex flex-col space-y-6 overflow-y-auto custom-scrollbar p-6 bg-surface-card border border-border-subtle rounded-2xl shadow-sm">
            
            {/* Header Action */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-content-base">Iniciar Nova Venda</h2>
                <p className="text-xs text-content-muted">Selecione de onde importar os itens ou inicie avulsa.</p>
              </div>
              <button 
                onClick={handleStartAvulso}
                className="h-10 px-5 bg-gold-base hover:bg-gold-hover text-surface-base rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Venda Avulsa
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Coluna Agendamentos */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                  <h3 className="text-xs font-bold text-content-base uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-gold-base" /> Agendamentos do Dia
                  </h3>
                  <span className="text-[10px] bg-surface-base px-2 py-0.5 rounded-full text-content-muted font-bold">{pendingAppointments.length}</span>
                </div>
                
                {pendingAppointments.length === 0 ? (
                  <div className="py-8 text-center text-content-muted border border-dashed border-border-subtle rounded-xl bg-surface-base/50">
                    <p className="text-xs">Nenhum agendamento pendente.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingAppointments.map(apt => (
                      <div key={apt.id} className="p-3 bg-surface-base border border-border-subtle rounded-xl flex items-center justify-between hover:border-gold-base/50 transition-colors">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono bg-surface-card px-1.5 py-0.5 rounded border border-border-subtle text-content-muted">{apt.time_slot}</span>
                            <span className="text-xs font-bold text-content-base truncate">{apt.client_name}</span>
                          </div>
                          <p className="text-[11px] text-content-muted mt-1 truncate">{apt.professional_name} • {(apt.services||[]).map(s=>s.title).join(', ')}</p>
                        </div>
                        <button 
                          onClick={() => handleStartFromAppointment(apt)}
                          className="ml-3 h-8 px-3 bg-gold-base/10 text-gold-hover hover:bg-gold-base hover:text-surface-base rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors shrink-0"
                        >
                          Importar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Coluna Fila */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                  <h3 className="text-xs font-bold text-content-base uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-gold-base" /> Fila de Espera
                  </h3>
                  <span className="text-[10px] bg-surface-base px-2 py-0.5 rounded-full text-content-muted font-bold">{queue.length}</span>
                </div>

                {queue.length === 0 ? (
                  <div className="py-8 text-center text-content-muted border border-dashed border-border-subtle rounded-xl bg-surface-base/50">
                    <p className="text-xs">Ninguém na fila de espera.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {queue.map(q => (
                      <div key={q.id} className="p-3 bg-surface-base border border-border-subtle rounded-xl flex items-center justify-between hover:border-gold-base/50 transition-colors">
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-bold text-content-base block truncate">{q.client_name}</span>
                          <p className="text-[11px] text-content-muted mt-0.5 truncate">{q.service_title}</p>
                        </div>
                        <button 
                          onClick={() => handleStartFromQueue(q)}
                          className="ml-3 h-8 px-3 bg-gold-base/10 text-gold-hover hover:bg-gold-base hover:text-surface-base rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors shrink-0"
                        >
                          Importar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: CARRINHO E SERVIÇOS */}
        {currentStep === 2 && (
          <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
            {/* Esquerda: Adicionar Itens */}
            <div className="flex-1 flex flex-col min-h-0 border border-border-subtle rounded-2xl bg-surface-card shadow-sm">
              <div className="p-3 border-b border-border-subtle flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
                  <input 
                    type="text" 
                    placeholder="Buscar serviço ou produto..."
                    value={searchCatalog}
                    onChange={e => setSearchCatalog(e.target.value)}
                    className="w-full bg-surface-card border border-border-subtle rounded-xl pl-9 pr-3 py-2 text-xs text-content-base focus:outline-none focus:border-gold-base transition-colors"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
                {/* Serviços */}
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-content-muted mb-2">Serviços Disponíveis</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {services.filter(s => s.title.toLowerCase().includes(searchCatalog.toLowerCase())).map(s => (
                      <div key={s.id} onClick={() => handleAddServiceToCart(s)} className="p-2 border border-border-subtle rounded-lg flex items-center justify-between cursor-pointer hover:border-gold-base hover:bg-surface-card transition-colors">
                        <span className="text-xs font-bold text-content-base truncate flex-1">{s.title}</span>
                        <span className="text-[10px] font-bold text-gold-hover font-mono bg-gold-base/10 px-1.5 py-0.5 rounded">R$ {s.price.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Produtos */}
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-content-muted mb-2">Produtos</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {products.filter(p => p.name.toLowerCase().includes(searchCatalog.toLowerCase())).map(p => (
                      <div key={p.id} onClick={() => handleAddProductToCart(p)} className="p-2 border border-border-subtle rounded-lg flex items-center justify-between cursor-pointer hover:border-gold-base hover:bg-surface-card transition-colors">
                        <span className="text-xs font-bold text-content-base truncate flex-1">{p.name}</span>
                        <span className="text-[10px] font-bold text-gold-hover font-mono bg-gold-base/10 px-1.5 py-0.5 rounded">R$ {p.price.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Direita: Carrinho */}
            <div className="w-full lg:w-96 flex flex-col min-h-0 bg-surface-card border border-border-subtle rounded-2xl shadow-sm">
              <div className="p-4 border-b border-border-subtle flex flex-col space-y-3">
                <h3 className="text-sm font-bold text-content-base flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-gold-base" /> Carrinho da Venda
                </h3>
                <div className="space-y-2">
                  <input 
                    type="text" 
                    placeholder="Nome do Cliente (Opcional)"
                    value={selectedClientName}
                    onChange={e => setSelectedClientName(e.target.value)}
                    className="w-full bg-surface-card border border-border-subtle rounded-lg px-3 py-1.5 text-xs text-content-base"
                  />
                  <select 
                    value={selectedBarber?.id || ''}
                    onChange={(e) => {
                      const prof = professionals.find(p => p.id === e.target.value);
                      setSelectedBarber(prof || null);
                      // Update items with new barber
                      if (prof) {
                        setCart(cart.map(i => ({ ...i, barberId: prof.id, barberName: prof.name })));
                      }
                    }}
                    className="w-full bg-surface-card border border-border-subtle rounded-lg px-3 py-1.5 text-xs text-content-base focus:outline-none focus:border-gold-base"
                  >
                    <option value="" disabled>Selecionar Profissional Padrão</option>
                    {professionals.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-content-muted p-4 text-center">
                    <ShoppingBag className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-xs">Carrinho vazio.</p>
                  </div>
                ) : (
                  cart.map(item => (
                    <div key={item.id} className="p-2 bg-surface-card border border-border-subtle rounded-lg flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-content-base truncate">{item.title}</p>
                        <p className="text-[10px] text-content-muted">R$ {item.price.toFixed(2)} un.</p>
                      </div>
                      <div className="flex items-center gap-2 bg-surface-base rounded-lg border border-border-subtle p-0.5">
                        <button onClick={() => handleQuantityChange(item.id, -1)} className="w-6 h-6 flex items-center justify-center text-content-muted hover:text-content-base rounded"><Minus className="w-3 h-3"/></button>
                        <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                        <button onClick={() => handleQuantityChange(item.id, 1)} className="w-6 h-6 flex items-center justify-center text-content-muted hover:text-content-base rounded"><Plus className="w-3 h-3"/></button>
                      </div>
                      <div className="text-right shrink-0 min-w-[50px]">
                        <p className="text-xs font-bold text-content-base">R$ {(item.price * item.quantity).toFixed(2)}</p>
                      </div>
                      <button onClick={() => handleRemoveItem(item.id)} className="w-6 h-6 flex items-center justify-center text-status-error/70 hover:text-status-error hover:bg-status-error/10 rounded transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
                    </div>
                  ))
                )}
              </div>
              
              <div className="p-4 border-t border-border-subtle bg-surface-card rounded-b-xl space-y-3">
                <div className="flex justify-between items-center font-bold text-content-base">
                  <span className="text-xs">Subtotal:</span>
                  <span className="text-sm font-mono text-status-success">R$ {subtotal.toFixed(2)}</span>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setCurrentStep(1)}
                    className="flex-1 h-10 rounded-xl border border-border-subtle text-content-muted hover:text-content-base text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" /> Voltar
                  </button>
                  <button 
                    onClick={() => {
                      if (cart.length === 0) return alert('Adicione itens ao carrinho primeiro.');
                      if (!selectedBarber) return alert('Selecione um profissional.');
                      setCurrentStep(3);
                    }}
                    className="flex-[2] h-10 rounded-xl bg-gold-base hover:bg-gold-hover text-surface-base text-xs font-bold flex items-center justify-center gap-1 transition-colors shadow-sm active:scale-95 disabled:opacity-50"
                  >
                    Avançar Pagamento <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: PAGAMENTO E FINALIZAÇÃO */}
        {currentStep === 3 && (
          <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
            {/* Esquerda: Ajustes de Valores e Metodos */}
            <div className="flex-[2] flex flex-col space-y-4 overflow-y-auto custom-scrollbar p-6 bg-surface-card border border-border-subtle rounded-2xl shadow-sm">
              <h3 className="text-sm font-bold text-content-base mb-2">Finalização e Pagamento</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Desconto */}
                <div className="p-4 bg-surface-base border border-border-subtle rounded-xl space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted flex items-center gap-1.5">
                    <Percent className="w-3.5 h-3.5 text-gold-base" /> Desconto (R$)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={discountAmount || ''}
                    onChange={(e) => setDiscountAmount(Number(e.target.value))}
                    placeholder="0.00"
                    className="w-full bg-surface-card border border-border-subtle rounded-lg px-3 py-2 text-sm text-content-base font-mono focus:outline-none focus:border-gold-base"
                  />
                </div>

                {/* Gorjeta */}
                <div className="p-4 bg-surface-base border border-border-subtle rounded-xl space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted flex items-center gap-1.5">
                    <HandCoins className="w-3.5 h-3.5 text-amber-500" /> Gorjeta / Adicional (R$)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={tipAmount || ''}
                    onChange={(e) => setTipAmount(Number(e.target.value))}
                    placeholder="0.00"
                    className="w-full bg-surface-card border border-border-subtle rounded-lg px-3 py-2 text-sm text-content-base font-mono focus:outline-none focus:border-gold-base"
                  />
                </div>
              </div>

              {/* Forma de Pagamento */}
              <div className="space-y-3">
                <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted">Forma de Pagamento Principal</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { id: 'pix', label: 'PIX', icon: QrCode },
                    { id: 'credit_card', label: 'Crédito', icon: CreditCard },
                    { id: 'debit_card', label: 'Débito', icon: CreditCard },
                    { id: 'cash', label: 'Dinheiro', icon: DollarSign },
                  ].map(method => (
                    <button
                      key={method.id}
                      onClick={() => setPaymentMethod(method.id as any)}
                      className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-colors ${
                        paymentMethod === method.id 
                          ? 'bg-gold-base/10 border-gold-base text-gold-hover shadow-sm' 
                          : 'bg-surface-base border-border-subtle text-content-muted hover:text-content-base hover:border-border-strong'
                      }`}
                    >
                      <method.icon className="w-5 h-5" />
                      <span className="text-[11px] font-bold">{method.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Troco (Apenas Dinheiro) */}
              {paymentMethod === 'cash' && (
                <div className="p-4 bg-surface-base border border-border-subtle rounded-xl space-y-4 animate-fade-in">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-content-muted">Cálculo de Troco</label>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <span className="text-[10px] text-content-muted block mb-1">Valor Recebido (R$)</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={cashAmountGiven}
                        onChange={(e) => setCashAmountGiven(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-surface-card border border-border-subtle rounded-lg px-3 py-2 text-sm text-content-base font-mono focus:outline-none focus:border-gold-base"
                      />
                    </div>
                    <div className="flex-1">
                      <span className="text-[10px] text-content-muted block mb-1">Troco (R$)</span>
                      <div className={`w-full bg-surface-card border rounded-lg px-3 py-2 text-sm font-mono font-bold ${changeAmount > 0 ? 'text-amber-500 border-amber-500/30' : 'text-content-muted border-border-subtle'}`}>
                        {changeAmount > 0 ? changeAmount.toFixed(2) : '0.00'}
                      </div>
                    </div>
                  </div>
                  {/* Presets */}
                  <div className="flex flex-wrap gap-2">
                    {[10, 20, 50, 100, 200].map(val => (
                      <button
                        key={val}
                        onClick={() => handleSetCashPreset(val)}
                        className="px-3 py-1 rounded-lg bg-surface-card border border-border-subtle text-[11px] font-bold text-content-base hover:bg-gold-base/10 hover:border-gold-base hover:text-gold-hover transition-colors"
                      >
                        R$ {val}
                      </button>
                    ))}
                    <button
                      onClick={() => handleSetCashPreset(finalTotal)}
                      className="px-3 py-1 rounded-lg bg-surface-card border border-border-subtle text-[11px] font-bold text-status-success hover:bg-status-success/10 hover:border-status-success transition-colors ml-auto"
                    >
                      Valor Exato
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Direita: Resumo */}
            <div className="flex-1 flex flex-col min-h-0 bg-surface-card border border-border-subtle rounded-2xl shadow-sm p-6">
              <h3 className="text-sm font-bold text-content-base mb-4 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-gold-base" /> Resumo da Venda
              </h3>
              
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-xs text-content-base">
                  <span>Subtotal ({cart.reduce((a,b)=>a+b.quantity,0)} itens)</span>
                  <span className="font-mono">R$ {subtotal.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-xs text-status-error font-medium">
                    <span>Desconto</span>
                    <span className="font-mono">- R$ {discountAmount.toFixed(2)}</span>
                  </div>
                )}
                {tipAmount > 0 && (
                  <div className="flex justify-between text-xs text-amber-500 font-medium">
                    <span>Gorjeta / Extra</span>
                    <span className="font-mono">+ R$ {tipAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="pt-3 border-t border-dashed border-border-subtle flex justify-between items-center">
                  <span className="font-bold text-content-base">TOTAL A PAGAR</span>
                  <span className="text-xl font-black text-status-success font-mono">
                    R$ {finalTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="mt-auto space-y-2">
                <button
                  onClick={handleFinalizeSale}
                  disabled={isFinalizing || !isCaixaOpen}
                  className="w-full h-12 rounded-xl bg-status-success hover:bg-[#168a48] text-white font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 shadow-md"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  {isFinalizing ? 'Registrando...' : 'Finalizar Venda'}
                </button>
                <button
                  onClick={() => setCurrentStep(2)}
                  disabled={isFinalizing}
                  className="w-full h-10 rounded-xl bg-transparent border border-border-subtle text-content-muted hover:text-content-base font-bold text-xs flex items-center justify-center transition-colors"
                >
                  Voltar para o Carrinho
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* RECEIPT MODAL */}
      {showReceiptModal && lastTransaction && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-surface-base/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-surface-card border border-border-subtle rounded-2xl shadow-2xl p-5 flex flex-col gap-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-gold-base via-amber-500 to-gold-base" />
            
            <div className="text-center space-y-1 pt-2">
              <div className="w-12 h-12 bg-status-success/20 text-status-success rounded-full flex items-center justify-center mx-auto mb-2 shadow-inner">
                <Check className="w-6 h-6" />
              </div>
              <h3 className="font-serif font-bold text-content-base text-lg">Venda Concluída!</h3>
              <p className="text-xs text-content-muted">Recibo <strong>{lastTransaction.id}</strong> gerado com sucesso.</p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-4 border-t border-border-subtle">
              <button
                onClick={() => handlePrintReceipt(lastTransaction)}
                className="h-10 rounded-xl bg-gold-base hover:bg-gold-hover text-surface-base font-bold text-xs flex items-center justify-center gap-1.5 shadow active:scale-95 transition-all"
              >
                <Printer className="w-4 h-4" />
                Imprimir
              </button>
              <button
                onClick={() => handleShareWhatsApp(lastTransaction)}
                className="h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow active:scale-95 transition-all"
              >
                <Share2 className="w-4 h-4" />
                WhatsApp
              </button>
            </div>
            
            <button
              onClick={() => setShowReceiptModal(false)}
              className="w-full h-10 rounded-xl border border-border-subtle text-content-base hover:bg-surface-base font-bold text-xs flex items-center justify-center transition-colors"
            >
              Nova Venda
            </button>
          </div>
        </div>
      )}

      {/* HISTÓRICO DE VENDAS MODAL */}
      {showSalesHistory && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-surface-base/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl bg-surface-card border border-border-subtle rounded-xl p-4 sm:p-5 shadow-2xl flex flex-col h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle mb-3 shrink-0">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-gold-base" />
                <h3 className="font-bold text-content-base text-sm">Vendas de Hoje</h3>
              </div>
              <button onClick={() => setShowSalesHistory(false)} className="text-content-muted hover:text-content-base"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2 min-h-0">
              {todaysSales.length === 0 ? (
                <div className="text-center py-12 text-content-muted text-xs border border-dashed border-border-subtle rounded-xl">
                  Nenhuma venda realizada hoje.
                </div>
              ) : (
                todaysSales.map((sale) => (
                  <div key={sale.id} className="p-3 rounded-xl bg-surface-base border border-border-subtle flex items-center justify-between gap-3">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gold-base/10 text-gold-hover font-mono shrink-0">{sale.timestamp}</span>
                        <h4 className="font-bold text-content-base text-xs truncate">{sale.clientName}</h4>
                      </div>
                      <p className="text-[11px] text-content-muted truncate">{sale.professionalName} • {sale.items.map(i => `${i.quantity}x ${i.title}`).join(', ')}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="block font-bold text-status-success text-sm font-mono">R$ {sale.total.toFixed(2)}</span>
                      <span className="text-[10px] font-bold text-content-muted uppercase">{sale.paymentMethod}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-border-subtle flex justify-between items-center text-xs shrink-0 mt-3">
              <span className="text-content-muted font-bold">{todaysSales.length} vendas</span>
              <span className="font-bold text-content-base">Total Faturado: <strong className="text-status-success text-sm font-mono">R$ {totalRevenueToday.toFixed(2)}</strong></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
