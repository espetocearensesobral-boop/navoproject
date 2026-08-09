import React, { useState, useEffect } from 'react';
import { authFetch } from '../../lib/api';
import { AdminPageHeader } from './shared/AdminPageHeader';
import { 
  fetchAppointmentsFromSupabase, 
  fetchServicesFromSupabase, 
  fetchProductsFromSupabase, 
  fetchProfessionalsFromSupabase,
  getQueueFromSupabase
} from '../../services/supabaseDataService';
import { Appointment, ServiceItem, ProductItem, Professional, WaitingQueueItem } from '../../types';
import { 
  Receipt, 
  CreditCard, 
  DollarSign, 
  QrCode, 
  ShoppingBag, 
  Plus, 
  Minus, 
  Trash2, 
  CheckCircle2, 
  Search, 
  User, 
  Scissors, 
  Percent, 
  Clock, 
  AlertCircle, 
  RefreshCw, 
  Printer, 
  Share2, 
  Sparkles, 
  Wallet, 
  Check, 
  X,
  Phone,
  Calendar,
  Gift,
  ArrowRight
} from 'lucide-react';

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

  // PDV Active Sale State
  const [activeTab, setActiveTab] = useState<'agendamentos' | 'servicos' | 'produtos' | 'fila'>('agendamentos');
  const [searchQuery, setSearchQuery] = useState('');
  
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
  const todayStr = new Date().toISOString().split('T')[0];
  const pendingAppointments = appointments.filter(a => 
    (a.date === todayStr || a.status === 'confirmed' || a.status === 'in_service' || a.status === 'in_queue') &&
    a.status !== 'cancelled' &&
    a.status !== 'completed'
  );

  // Select Appointment for Checkout
  const handleSelectAppointmentForCheckout = (apt: Appointment) => {
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
  };

  // Select Queue Item for Checkout
  const handleSelectQueueItemForCheckout = (qItem: WaitingQueueItem) => {
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
  
  // Barber Commission Estimation
  const estimatedCommission = cart.reduce((acc, item) => {
    if (item.type === 'service') {
      const rate = selectedBarber?.commission_rate || 0.40;
      return acc + (item.price * item.quantity * rate);
    } else {
      return acc + (item.price * item.quantity * 0.10);
    }
  }, 0);

  // Troco Calculation
  const cashNum = parseFloat(cashAmountGiven.replace(',', '.')) || 0;
  const changeAmount = cashNum > finalTotal ? cashNum - finalTotal : 0;

  // Preset cash setter
  const handleSetCashPreset = (value: number) => {
    setCashAmountGiven(value.toFixed(2));
  };

  const handleAddCashPreset = (addValue: number) => {
    const current = parseFloat(cashAmountGiven.replace(',', '.')) || 0;
    setCashAmountGiven((current + addValue).toFixed(2));
  };

  // Checkout Completion
  const handleFinalizeSale = async () => {
    if (cart.length === 0) return;

    const tx: PdvTransaction = {
      id: `TX-${Date.now().toString().slice(-6)}`,
      clientName: selectedClientName || 'Cliente Avulso',
      clientPhone: selectedClientPhone,
      professionalName: selectedBarber?.name || 'Profissional',
      items: [...cart],
      subtotal,
      discount: discountAmount,
      tip: tipAmount,
      total: finalTotal,
      paymentMethod,
      paymentDetails: paymentMethod === 'cash' ? `Recebido R$ ${cashNum.toFixed(2)} (Troco R$ ${changeAmount.toFixed(2)})` : undefined,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      appointmentId: linkedAppointmentId || undefined
    };

    try {
      const response = await authFetch('/api/cash-transactions', {
        method: 'POST',
        body: JSON.stringify({
          id: tx.id,
          type: 'income',
          description: tx.clientName,
          amount: tx.total.toFixed(2),
          category: 'pdv',
          paymentMethod: tx.paymentMethod,
          date: new Date().toISOString().split('T')[0],
          status: 'completed',
          professionalName: tx.professionalName,
          notes: JSON.stringify(tx.items)
        })
      });
      if (!response.ok) throw new Error('Não foi possível gravar a venda no banco.');
      const updatedSales = [tx, ...todaysSales];
      setTodaysSales(updatedSales);
    } catch (error) {
      console.error('Erro ao gravar venda no banco:', error);
      return;
    }

    if (linkedAppointmentId) {
      setAppointments(prev => prev.map(a => a.id === linkedAppointmentId ? { ...a, status: 'completed' } : a));
    }

    setLastTransaction(tx);
    setShowReceiptModal(true);
    handleClearCart();
  };

  // Print Receipt Handler
  const handlePrintReceipt = (tx: PdvTransaction) => {
    const paymentMap: Record<string, string> = {
      pix: 'PIX (Instantâneo)',
      credit_card: 'Cartão de Crédito',
      debit_card: 'Cartão de Débito',
      cash: 'Dinheiro',
      split: 'Pagamento Misto'
    };

    const itemsRows = tx.items.map(it => `
      <tr style="border-bottom: 1px dashed #d6d3d1;">
        <td style="padding: 5px 0; text-align: left; vertical-align: top;">
          <div style="font-weight: 700;">${it.quantity}x ${it.title}</div>
        </td>
        <td style="padding: 5px 0; text-align: right; font-weight: 700; font-family: monospace; vertical-align: top; white-space: nowrap;">
          R$ ${(it.price * it.quantity).toFixed(2)}
        </td>
      </tr>
    `).join('');

    const receiptHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Comprovante de Venda - Barbearia Navo</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          * { box-sizing: border-box; }
          body {
            font-family: 'JetBrains Mono', 'Courier New', Courier, monospace;
            width: 280px;
            margin: 0 auto;
            padding: 16px 12px;
            color: #1c1917;
            background: #ffffff;
            font-size: 11px;
            line-height: 1.35;
          }
          .text-center { text-align: center; }
          .header { border-bottom: 2px dashed #1c1917; padding-bottom: 8px; margin-bottom: 10px; text-align: center; }
          .brand { font-size: 16px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 2px; }
          .subbrand { font-size: 9px; text-transform: uppercase; font-weight: 600; color: #44403c; }
          .badge { display: inline-block; padding: 2px 8px; background: #1c1917; color: #ffffff; font-size: 9px; font-weight: bold; margin-top: 6px; letter-spacing: 1px; }
          .info-box { font-size: 11px; line-height: 1.4; margin: 8px 0; }
          .info-row { display: flex; justify-content: space-between; margin-bottom: 2px; }
          .divider { border-top: 1px dashed #1c1917; margin: 8px 0; }
          .items-table { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 11px; }
          .totals-box { margin-top: 6px; font-size: 11px; }
          .total-final { font-size: 15px; font-weight: 900; border-top: 2px solid #1c1917; border-bottom: 2px solid #1c1917; padding: 6px 0; margin-top: 6px; display: flex; justify-content: space-between; }
          .footer { margin-top: 15px; text-align: center; font-size: 9px; border-top: 1px dashed #1c1917; padding-top: 8px; }
          .barcode { font-size: 18px; letter-spacing: 3px; font-weight: bold; margin-top: 8px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand">BARBEARIA NAVO</div>
          <div class="subbrand">Unidade Jardins • São Paulo / SP</div>
          <div style="font-size: 8px; margin-top: 2px; color: #57534e;">CNPJ: 45.892.102/0001-90 | TEL: (11) 99999-8888</div>
          <div class="badge">COMPROVANTE DE VENDA</div>
        </div>

        <div class="info-box">
          <div class="info-row"><span>COMPROVANTE:</span> <strong>#${tx.id}</strong></div>
          <div class="info-row"><span>DATA/HORA:</span> <strong>${new Date().toLocaleDateString('pt-BR')} ${tx.timestamp}</strong></div>
          <div class="info-row"><span>CLIENTE:</span> <strong>${tx.clientName}</strong></div>
          ${tx.clientPhone ? `<div class="info-row"><span>TELEFONE:</span> <span>${tx.clientPhone}</span></div>` : ''}
          <div class="info-row"><span>ATENDENTE:</span> <strong>${tx.professionalName}</strong></div>
        </div>

        <div class="divider"></div>

        <table class="items-table">
          <thead>
            <tr style="border-bottom: 1px solid #1c1917; font-size: 10px; text-align: left;">
              <th style="padding-bottom: 4px;">QTD ITEM</th>
              <th style="padding-bottom: 4px; text-align: right;">VALOR (R$)</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <div class="divider"></div>

        <div class="totals-box">
          <div class="info-row"><span>Subtotal:</span> <span>R$ ${tx.subtotal.toFixed(2)}</span></div>
          ${tx.discount > 0 ? `<div class="info-row" style="color: #059669;"><span>Desconto:</span> <span>- R$ ${tx.discount.toFixed(2)}</span></div>` : ''}
          ${tx.tip > 0 ? `<div class="info-row" style="color: #d97706;"><span>Gorjeta:</span> <span>+ R$ ${tx.tip.toFixed(2)}</span></div>` : ''}
          
          <div class="total-final">
            <span>TOTAL PAGO</span>
            <span>R$ ${tx.total.toFixed(2)}</span>
          </div>

          <div style="margin-top: 8px;">
            <div class="info-row"><span>Forma de Pagamento:</span> <strong>${paymentMap[tx.paymentMethod] || tx.paymentMethod.toUpperCase()}</strong></div>
            ${tx.paymentDetails ? `<div style="font-size: 10px; color: #57534e; margin-top: 2px;">${tx.paymentDetails}</div>` : ''}
          </div>
        </div>

        <div class="footer">
          <div style="font-weight: bold; font-size: 11px; margin-bottom: 2px;">OBRIGADO PELA PREFERÊNCIA!</div>
          <div>Corte, Barba e Estilo com Tradição</div>
          <div class="barcode">|||| ||||| ||| |||||||</div>
          <div style="font-size: 8px; margin-top: 2px; color: #78716c;">AUTENTICAÇÃO: ${tx.id}-${Date.now().toString().slice(-4)}</div>
          <div style="font-size: 9px; margin-top: 6px; font-weight: bold;">www.barbearianavo.com.br</div>
        </div>

        <script>
          window.onload = function() {
            window.focus();
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    try {
      const existingFrame = document.getElementById('pdv-print-frame');
      if (existingFrame) existingFrame.remove();

      const printFrame = document.createElement('iframe');
      printFrame.id = 'pdv-print-frame';
      printFrame.style.position = 'fixed';
      printFrame.style.right = '0';
      printFrame.style.bottom = '0';
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
          if (printFrame.contentWindow) {
            printFrame.contentWindow.focus();
            printFrame.contentWindow.print();
          }
        }, 300);
      }
    } catch (e) {
      console.error('Erro ao imprimir via iframe:', e);
      window.print();
    }
  };

  // WhatsApp Share Handler
  const handleShareWhatsApp = (tx: PdvTransaction) => {
    const cleanPhone = (tx.clientPhone || '').replace(/\D/g, '');
    const itemsText = tx.items.map(i => `• ${i.quantity}x ${i.title} (R$ ${(i.price * i.quantity).toFixed(2)})`).join('\n');
    
    const message = 
      `💈 *BARBEARIA NAVO - COMPROVANTE DE VENDA*\n\n` +
      `*Comprovante:* #${tx.id}\n` +
      `*Data:* ${new Date().toLocaleDateString('pt-BR')} ${tx.timestamp}\n` +
      `*Cliente:* ${tx.clientName}\n` +
      `*Atendente:* ${tx.professionalName}\n\n` +
      `*ITENS DO ATENDIMENTO:*\n${itemsText}\n\n` +
      `--------------------------------\n` +
      `*TOTAL PAGO:* R$ ${tx.total.toFixed(2)} (${tx.paymentMethod.toUpperCase()})\n` +
      `--------------------------------\n\n` +
      `Obrigado pela preferência! Agende seu próximo horário em navobarber.com.br ✂️`;

    const url = cleanPhone 
      ? `https://api.whatsapp.com/send?phone=55${cleanPhone}&text=${encodeURIComponent(message)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

    window.open(url, '_blank');
  };

  const totalRevenueToday = todaysSales.reduce((acc, sale) => acc + sale.total, 0);

  return (
    <div className="space-y-4 pb-28 md:pb-6 animate-fade-in text-content-base min-w-0">
      {/* Header (desktop) */}
      <AdminPageHeader
        icon={Receipt}
        title="PDV Inteligente"
        stats={[
          { label: isCaixaOpen ? 'caixa aberto' : 'caixa fechado', value: '', tone: isCaixaOpen ? 'success' : 'muted' },
        ]}
        action={{
          label: isCaixaOpen ? 'Fechar Caixa' : 'Abrir Caixa',
          onClick: () => setIsCaixaOpen(!isCaixaOpen),
        }}
      >
        <button
          onClick={() => setShowSalesHistory(true)}
          className="h-9 px-3 rounded-xl bg-surface-base border border-border-subtle hover:bg-surface-card text-content-base text-xs font-bold flex items-center gap-2 transition-all shrink-0 active:scale-95"
        >
          <Receipt className="w-3.5 h-3.5 text-gold-hover" />
          <span>Vendas Hoje ({todaysSales.length})</span>
        </button>
      </AdminPageHeader>

      {/* Ações (mobile) */}
      <div className="md:hidden flex items-center gap-2">
        <button
          onClick={() => setShowSalesHistory(true)}
          className="flex-1 h-10 rounded-xl bg-surface-base border border-border-subtle hover:bg-surface-card text-content-base text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
        >
          <Receipt className="w-3.5 h-3.5 text-gold-hover" />
          <span>Vendas ({todaysSales.length})</span>
        </button>

        <button
          onClick={() => setIsCaixaOpen(!isCaixaOpen)}
          className={`flex-1 h-10 rounded-xl text-xs font-bold transition-all active:scale-95 ${
            isCaixaOpen 
              ? 'bg-status-error/10 hover:bg-status-error/20 text-status-error border border-status-error/30' 
              : 'bg-status-success/10 hover:bg-status-success/20 text-status-success border border-status-success/30'
          }`}
        >
          {isCaixaOpen ? 'Fechar Caixa' : 'Abrir Caixa'}
        </button>
      </div>

      {/* Quick Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider truncate">Hoje</span>
            <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-black text-content-base tabular-nums truncate">R$ {totalRevenueToday.toFixed(2)}</p>
        </div>

        <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-blue-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider truncate">Checkouts</span>
            <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-black text-content-base tabular-nums truncate">{todaysSales.length} vendas</p>
        </div>

        <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider truncate">Pendentes</span>
            <div className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-black text-content-base tabular-nums truncate">{pendingAppointments.length} horários</p>
        </div>

        <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-purple-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider truncate">Produtos</span>
            <div className="w-6 h-6 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-black text-content-base tabular-nums truncate">{products.length} itens</p>
        </div>
      </div>

      {/* MAIN WORKSPACE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* LEFT CATALOG & PENDING APPOINTMENTS (7 COLS) */}
        <div className="lg:col-span-7 space-y-3 min-w-0">
          
          {/* Tabs & Search */}
          <div className="bg-surface-card rounded-xl border border-border-subtle p-3 space-y-2.5 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle pb-2.5">
              <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar no-scrollbar min-w-0">
                <button
                  onClick={() => setActiveTab('agendamentos')}
                  className={`h-8 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    activeTab === 'agendamentos'
                      ? 'bg-gold-base text-surface-base shadow-sm'
                      : 'text-content-muted hover:text-content-base hover:bg-surface-base'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Hoje ({pendingAppointments.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('servicos')}
                  className={`h-8 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    activeTab === 'servicos'
                      ? 'bg-gold-base text-surface-base shadow-sm'
                      : 'text-content-muted hover:text-content-base hover:bg-surface-base'
                  }`}
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span>Serviços ({services.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('produtos')}
                  className={`h-8 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    activeTab === 'produtos'
                      ? 'bg-gold-base text-surface-base shadow-sm'
                      : 'text-content-muted hover:text-content-base hover:bg-surface-base'
                  }`}
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Produtos ({products.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('fila')}
                  className={`h-8 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    activeTab === 'fila'
                      ? 'bg-gold-base text-surface-base shadow-sm'
                      : 'text-content-muted hover:text-content-base hover:bg-surface-base'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Fila ({queue.length})</span>
                </button>
              </div>

              <button
                onClick={loadData}
                className="w-8 h-8 rounded-xl text-content-muted hover:text-content-base hover:bg-surface-base transition-colors flex items-center justify-center shrink-0"
                title="Atualizar dados"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-content-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar cliente, serviço ou produto..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-surface-base border border-border-subtle rounded-xl pl-8 pr-8 py-1.5 text-xs text-content-base placeholder:text-content-muted focus:outline-none focus:border-gold-base transition-colors"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-content-muted hover:text-content-base"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* TAB CONTENT PANELS */}
          <div className="bg-surface-card rounded-xl border border-border-subtle p-3 min-h-[360px] max-h-[500px] overflow-y-auto custom-scrollbar no-scrollbar min-w-0">
            
            {/* TAB 1: AGENDAMENTOS DO DIA */}
            {activeTab === 'agendamentos' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] text-content-muted font-bold uppercase tracking-wider mb-1">
                  <span>Agendamentos Pendentes de Cobrança</span>
                  <span>{pendingAppointments.length} itens</span>
                </div>

                {pendingAppointments.length === 0 ? (
                  <div className="text-center py-12 text-content-muted space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-status-success mx-auto opacity-80" />
                    <p className="text-xs font-bold text-content-base">Nenhum agendamento pendente para hoje!</p>
                    <p className="text-[11px]">Todos os agendamentos já foram liquidados ou inicie uma venda avulsa.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {pendingAppointments
                      .filter(a => 
                        a.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        a.professional_name.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map(apt => (
                        <div
                          key={apt.id}
                          className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 min-w-0 ${
                            linkedAppointmentId === apt.id
                              ? 'bg-gold-base/10 border-gold-base shadow-sm'
                              : 'bg-surface-base border-border-subtle hover:border-gold-base/50'
                          }`}
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="px-1.5 py-0.5 rounded-xl bg-gold-base/20 text-gold-hover font-bold text-[10px] shrink-0 font-mono">
                                {apt.time_slot}
                              </span>
                              <h3 className="font-bold text-content-base text-xs truncate min-w-0">{apt.client_name}</h3>
                              {apt.client_phone && (
                                <span className="text-[10px] text-content-muted shrink-0 hidden sm:inline">({apt.client_phone})</span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-content-muted min-w-0">
                              <span className="flex items-center gap-1 font-medium text-content-base shrink-0">
                                <Scissors className="w-3 h-3 text-gold-hover" />
                                {apt.professional_name}
                              </span>
                              <span>•</span>
                              <span className="truncate">{(apt.services || []).map(s => s.title).join(', ')}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-border-subtle">
                            <div className="text-right whitespace-nowrap">
                              <span className="block text-[9px] text-content-muted font-bold uppercase">Total</span>
                              <span className="text-xs font-bold text-status-success font-mono num-tabular">
                                R$ {apt.final_amount.toFixed(2)}
                              </span>
                            </div>

                            <button
                              onClick={() => handleSelectAppointmentForCheckout(apt)}
                              className={`h-8 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 active:scale-95 ${
                                linkedAppointmentId === apt.id
                                  ? 'bg-gold-base text-surface-base shadow'
                                  : 'bg-gold-base/10 text-gold-hover hover:bg-gold-base hover:text-surface-base'
                              }`}
                            >
                              <span>{linkedAppointmentId === apt.id ? 'Carregado' : 'Carregar'}</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: CATÁLOGO DE SERVIÇOS (Formatado com valores fixos à direita) */}
            {activeTab === 'servicos' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {services
                  .filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(srv => (
                    <div
                      key={srv.id}
                      onClick={() => handleAddServiceToCart(srv)}
                      className="p-3 rounded-xl bg-surface-base border border-border-subtle hover:border-gold-base/60 transition-all cursor-pointer flex items-center justify-between gap-3 group active:scale-[0.99] min-w-0"
                    >
                      <div className="min-w-0 flex-1 pr-1">
                        <h4 className="font-bold text-content-base text-xs group-hover:text-gold-hover transition-colors truncate">
                          {srv.title}
                        </h4>
                        <p className="text-[10px] text-content-muted truncate">
                          {srv.duration_minutes} min • {srv.description || 'Serviço de alta precisão'}
                        </p>
                      </div>

                      <div className="shrink-0 text-right whitespace-nowrap">
                        <span className="block font-bold text-status-success text-xs font-mono num-tabular">
                          R$ {srv.price.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-gold-hover font-bold inline-flex items-center gap-0.5">
                          <Plus className="w-3 h-3" /> Add
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* TAB 3: CATÁLOGO DE PRODUTOS */}
            {activeTab === 'produtos' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {products
                  .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.brand.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(prod => (
                    <div
                      key={prod.id}
                      onClick={() => handleAddProductToCart(prod)}
                      className="p-3 rounded-xl bg-surface-base border border-border-subtle hover:border-gold-base/60 transition-all cursor-pointer flex items-center justify-between gap-3 group active:scale-[0.99] min-w-0"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-xl bg-gold-base/10 text-gold-hover flex items-center justify-center font-bold text-xs shrink-0">
                          <ShoppingBag className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-[9px] font-bold text-content-muted uppercase tracking-wider block truncate">
                            {prod.brand}
                          </span>
                          <h4 className="font-bold text-content-base text-xs group-hover:text-gold-hover transition-colors truncate">
                            {prod.name}
                          </h4>
                          <span className="text-[10px] text-content-muted block truncate">Estoque: {prod.stock_quantity} un</span>
                        </div>
                      </div>

                      <div className="shrink-0 text-right whitespace-nowrap">
                        <span className="block font-bold text-status-success text-xs font-mono num-tabular">
                          R$ {prod.price.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-gold-hover font-bold inline-flex items-center gap-0.5">
                          <Plus className="w-3 h-3" /> Add
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* TAB 4: FILA DE ESPERA */}
            {activeTab === 'fila' && (
              <div className="space-y-2">
                {queue.length === 0 ? (
                  <div className="text-center py-10 text-content-muted text-xs">
                    Nenhum cliente na fila de espera no momento.
                  </div>
                ) : (
                  queue.map(q => (
                    <div
                      key={q.id}
                      className="p-3 rounded-xl bg-surface-base border border-border-subtle flex items-center justify-between gap-3 min-w-0"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <h4 className="font-bold text-content-base text-xs truncate">{q.client_name}</h4>
                          <span className="px-1.5 py-0.5 rounded-xl text-[10px] font-bold bg-amber-500/10 text-amber-400 shrink-0">
                            Fila
                          </span>
                        </div>
                        <p className="text-[11px] text-content-muted mt-0.5 truncate">
                          {q.service_title} • Barbeiro: {q.professional_name}
                        </p>
                      </div>

                      <button
                        onClick={() => handleSelectQueueItemForCheckout(q)}
                        className="h-8 px-3 rounded-xl bg-gold-base/10 hover:bg-gold-base text-gold-hover hover:text-surface-base text-xs font-bold transition-all shrink-0 active:scale-95 whitespace-nowrap"
                      >
                        Cobrar
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

          </div>
        </div>

        {/* RIGHT PANEL: CARRINHO E CHECKOUT DO CAIXA (5 COLS) */}
        <div className="lg:col-span-5 space-y-3 min-w-0">
          <div className="bg-surface-card rounded-xl border border-border-subtle p-3.5 sm:p-4 shadow-sm flex flex-col justify-between min-h-[540px] min-w-0">
            
            {/* Header / Client & Barber Selector */}
            <div className="space-y-2.5 pb-2.5 border-b border-border-subtle">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-gold-hover" />
                  <h2 className="font-serif font-bold text-content-base text-sm">Checkout de Caixa</h2>
                </div>
                {cart.length > 0 && (
                  <button
                    onClick={handleClearCart}
                    className="text-[11px] text-status-error hover:underline font-bold"
                  >
                    Limpar
                  </button>
                )}
              </div>

              {/* Client Name Input */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-content-muted uppercase tracking-wider mb-1">
                    Cliente
                  </label>
                  <input
                    type="text"
                    value={selectedClientName}
                    onChange={e => setSelectedClientName(e.target.value)}
                    placeholder="Nome do cliente"
                    className="w-full bg-surface-base border border-border-subtle rounded-xl p-2 text-xs font-bold text-content-base focus:outline-none focus:border-gold-base"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-content-muted uppercase tracking-wider mb-1">
                    Telefone
                  </label>
                  <input
                    type="text"
                    value={selectedClientPhone}
                    onChange={e => setSelectedClientPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="w-full bg-surface-base border border-border-subtle rounded-xl p-2 text-xs text-content-base focus:outline-none focus:border-gold-base"
                  />
                </div>
              </div>

              {/* Professional Barbeiro Selector */}
              <div>
                <label className="block text-[10px] font-bold text-content-muted uppercase tracking-wider mb-1">
                  Profissional Atendente
                </label>
                <select
                  value={selectedBarber?.id || ''}
                  onChange={e => {
                    const prof = professionals.find(p => p.id === e.target.value);
                    if (prof) setSelectedBarber(prof);
                  }}
                  className="w-full bg-surface-base border border-border-subtle rounded-xl p-2 text-xs font-bold text-content-base focus:outline-none focus:border-gold-base"
                >
                  {professionals.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.nickname || p.role}) — {Math.round(p.commission_rate * 100)}% comissão
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* CART ITEMS LIST */}
            <div className="flex-1 py-2 my-1 overflow-y-auto max-h-[200px] space-y-2 custom-scrollbar no-scrollbar min-w-0">
              {cart.length === 0 ? (
                <div className="text-center py-8 text-content-muted space-y-1.5">
                  <ShoppingBag className="w-7 h-7 mx-auto opacity-50 text-gold-hover" />
                  <p className="text-xs font-bold text-content-base">Seu carrinho está vazio.</p>
                  <p className="text-[10px]">Selecione um agendamento do dia ou adicione itens ao lado.</p>
                </div>
              ) : (
                cart.map(item => (
                  <div
                    key={item.id}
                    className="p-2 rounded-xl bg-surface-base border border-border-subtle flex items-center justify-between gap-2 min-w-0"
                  >
                    <div className="min-w-0 flex-1 pr-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.type === 'service' ? 'bg-gold-hover' : 'bg-emerald-400'}`} />
                        <h4 className="font-bold text-content-base text-xs truncate min-w-0">{item.title}</h4>
                      </div>
                      <span className="text-[10px] text-content-muted block font-mono num-tabular truncate">
                        R$ {item.price.toFixed(2)} cada
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="flex items-center gap-1 bg-surface-card border border-border-subtle rounded-xl p-0.5">
                        <button
                          onClick={() => handleQuantityChange(item.id, -1)}
                          className="w-5 h-5 rounded-xl hover:bg-white/10 flex items-center justify-center text-content-muted active:scale-95"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold text-content-base px-1 font-mono num-tabular">{item.quantity}</span>
                        <button
                          onClick={() => handleQuantityChange(item.id, 1)}
                          className="w-5 h-5 rounded-xl hover:bg-white/10 flex items-center justify-center text-content-muted active:scale-95"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <span className="text-xs font-bold text-content-base w-16 text-right whitespace-nowrap font-mono num-tabular">
                        R$ {(item.price * item.quantity).toFixed(2)}
                      </span>

                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-content-muted hover:text-status-error transition-colors p-1 rounded-xl"
                        title="Remover"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* FINANCIAL BREAKDOWN & DISCOUNTS */}
            <div className="pt-2.5 border-t border-border-subtle space-y-2 text-xs">
              
              {/* Discounts & Tip controls */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-content-muted uppercase mb-1">
                    Desconto (R$)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={discountAmount || ''}
                    onChange={e => setDiscountAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="0.00"
                    className="w-full bg-surface-base border border-border-subtle rounded-xl p-1.5 text-xs font-bold text-content-base focus:outline-none focus:border-gold-base num-tabular"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-content-muted uppercase mb-1">
                    Gorjeta Barbeiro
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={tipAmount || ''}
                    onChange={e => setTipAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="0.00"
                    className="w-full bg-surface-base border border-border-subtle rounded-xl p-1.5 text-xs font-bold text-content-base focus:outline-none focus:border-gold-base num-tabular"
                  />
                </div>
              </div>

              {/* Subtotal, Discount & Total Row */}
              <div className="space-y-1 py-1">
                <div className="flex justify-between text-content-muted text-xs">
                  <span>Subtotal</span>
                  <span className="font-mono num-tabular">R$ {subtotal.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-status-success text-xs font-semibold">
                    <span>Desconto Aplicado</span>
                    <span className="font-mono num-tabular">- R$ {discountAmount.toFixed(2)}</span>
                  </div>
                )}
                {tipAmount > 0 && (
                  <div className="flex justify-between text-gold-hover text-xs font-semibold">
                    <span>Gorjeta Profissional</span>
                    <span className="font-mono num-tabular">+ R$ {tipAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-content-muted text-[10px] italic">
                  <span>Comissão est. ({selectedBarber?.name.split(' ')[0]})</span>
                  <span className="font-mono num-tabular">R$ {estimatedCommission.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center text-sm font-bold text-content-base pt-2 border-t border-border-subtle">
                  <span>TOTAL FINAL</span>
                  <span className="text-lg font-bold text-status-success font-mono num-tabular">
                    R$ {finalTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* PAYMENT METHOD KEYBOARD (Touch-friendly & fast selection) */}
              <div className="space-y-1.5 pt-1">
                <label className="block text-[10px] font-bold text-content-muted uppercase tracking-wider">
                  Forma de Pagamento Rápida
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    onClick={() => setPaymentMethod('pix')}
                    className={`h-11 rounded-xl text-xs font-bold border flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 ${
                      paymentMethod === 'pix'
                        ? 'bg-gold-base/15 text-gold-hover border-gold-base'
                        : 'bg-surface-base border-border-subtle text-content-muted hover:text-content-base'
                    }`}
                  >
                    <QrCode className="w-4 h-4" />
                    <span>PIX</span>
                  </button>

                  <button
                    onClick={() => setPaymentMethod('credit_card')}
                    className={`h-11 rounded-xl text-xs font-bold border flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 ${
                      paymentMethod === 'credit_card'
                        ? 'bg-gold-base/15 text-gold-hover border-gold-base'
                        : 'bg-surface-base border-border-subtle text-content-muted hover:text-content-base'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Crédito</span>
                  </button>

                  <button
                    onClick={() => setPaymentMethod('debit_card')}
                    className={`h-11 rounded-xl text-xs font-bold border flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 ${
                      paymentMethod === 'debit_card'
                        ? 'bg-gold-base/15 text-gold-hover border-gold-base'
                        : 'bg-surface-base border-border-subtle text-content-muted hover:text-content-base'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Débito</span>
                  </button>

                  <button
                    onClick={() => setPaymentMethod('cash')}
                    className={`h-11 rounded-xl text-xs font-bold border flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 ${
                      paymentMethod === 'cash'
                        ? 'bg-gold-base/15 text-gold-hover border-gold-base'
                        : 'bg-surface-base border-border-subtle text-content-muted hover:text-content-base'
                    }`}
                  >
                    <DollarSign className="w-4 h-4" />
                    <span>Dinheiro</span>
                  </button>
                </div>
              </div>

              {/* CASH TROCO CALCULATOR & QUICK KEYPAD */}
              {paymentMethod === 'cash' && (
                <div className="p-2.5 rounded-xl bg-surface-base border border-border-subtle space-y-2 animate-fade-in">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-content-muted">Valor Recebido (R$):</span>
                    <input
                      type="text"
                      value={cashAmountGiven}
                      onChange={e => setCashAmountGiven(e.target.value)}
                      placeholder={finalTotal.toFixed(2)}
                      className="w-28 bg-surface-card border border-border-subtle rounded-xl p-1.5 text-xs font-bold text-right text-content-base focus:outline-none focus:border-gold-base font-mono num-tabular"
                    />
                  </div>

                  {/* Teclado rápido de cédulas */}
                  <div className="grid grid-cols-5 gap-1 pt-1">
                    <button
                      type="button"
                      onClick={() => handleSetCashPreset(finalTotal)}
                      className="h-8 rounded-xl bg-surface-card border border-border-subtle text-[10px] font-bold text-gold-hover hover:border-gold-base/50 active:scale-95 truncate"
                    >
                      Exato
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetCashPreset(50)}
                      className="h-8 rounded-xl bg-surface-card border border-border-subtle text-[10px] font-bold text-content-base hover:border-gold-base/50 active:scale-95"
                    >
                      R$ 50
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetCashPreset(100)}
                      className="h-8 rounded-xl bg-surface-card border border-border-subtle text-[10px] font-bold text-content-base hover:border-gold-base/50 active:scale-95"
                    >
                      R$ 100
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetCashPreset(150)}
                      className="h-8 rounded-xl bg-surface-card border border-border-subtle text-[10px] font-bold text-content-base hover:border-gold-base/50 active:scale-95"
                    >
                      R$ 150
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetCashPreset(200)}
                      className="h-8 rounded-xl bg-surface-card border border-border-subtle text-[10px] font-bold text-content-base hover:border-gold-base/50 active:scale-95"
                    >
                      R$ 200
                    </button>
                  </div>

                  {cashNum > 0 && (
                    <div className="flex justify-between items-center text-xs font-bold pt-1 border-t border-border-subtle">
                      <span className="text-content-muted">Troco a devolver:</span>
                      <span className={changeAmount >= 0 ? 'text-status-success font-bold font-mono num-tabular' : 'text-status-error font-mono num-tabular'}>
                        R$ {changeAmount.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* FINAL CHECKOUT ACTION BUTTON (DESKTOP) */}
              <button
                onClick={handleFinalizeSale}
                disabled={cart.length === 0 || !isCaixaOpen}
                className="hidden md:flex w-full h-11 px-4 rounded-xl bg-gold-base hover:bg-gold-hover disabled:opacity-40 text-surface-base font-bold text-xs items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer whitespace-nowrap"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>FINALIZAR E EMITIR RECIBO (R$ {finalTotal.toFixed(2)})</span>
              </button>

            </div>
          </div>
        </div>

      </div>

      {/* FIXED MOBILE BOTTOM CHECKOUT SUMMARY BAR (Acima da Bottom Bar no Mobile) */}
      <div className="fixed bottom-16 left-0 right-0 z-40 bg-surface-card border-t border-border-subtle p-3 shadow-2xl md:hidden animate-fade-in flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span className="text-[10px] text-content-muted font-bold uppercase block truncate">
            {cart.length} {cart.length === 1 ? 'item selecionado' : 'itens selecionados'}
          </span>
          <div className="text-base font-bold text-status-success font-mono num-tabular truncate">
            R$ {finalTotal.toFixed(2)}
          </div>
        </div>

        <button
          onClick={handleFinalizeSale}
          disabled={cart.length === 0 || !isCaixaOpen}
          className="h-11 px-4 bg-gold-base text-surface-base font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shrink-0 hover:bg-gold-hover active:scale-95 disabled:opacity-40 shadow-lg whitespace-nowrap"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Finalizar Venda</span>
        </button>
      </div>

      {/* RECEIPT / COMPROVANTE MODAL */}
      {showReceiptModal && lastTransaction && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="w-full max-w-sm my-auto bg-stone-900 rounded-lg p-3 sm:p-4 border border-stone-800 shadow-2xl space-y-3 relative">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2 border-b border-stone-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-serif font-bold text-stone-200">Venda Finalizada</h3>
              </div>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="w-7 h-7 rounded-xl bg-stone-800 hover:bg-stone-700 flex items-center justify-center text-stone-400 hover:text-white transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* REALISTIC THERMAL PAPER TICKET */}
            <div className="bg-[#FAF8F5] text-stone-900 p-4 rounded-lg shadow-inner font-mono text-xs space-y-3 relative overflow-hidden border border-stone-200 select-text">
              
              {/* Serrated Top Edge simulation */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-stone-300 border-b border-dashed border-stone-400 opacity-60" />

              {/* Receipt Header */}
              <div className="text-center pt-1 border-b-2 border-dashed border-stone-800 pb-3 space-y-1">
                <div className="w-8 h-8 rounded-xl bg-stone-900 text-amber-400 flex items-center justify-center mx-auto mb-1">
                  <Scissors className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold font-serif tracking-wider text-stone-900 uppercase">BARBEARIA NAVO</h2>
                <p className="text-[9px] uppercase tracking-widest text-stone-600">Unidade Jardins • São Paulo/SP</p>
                <p className="text-[8px] text-stone-500">CNPJ: 45.892.102/0001-90 | TEL: (11) 99999-8888</p>
                <div className="inline-block mt-1 px-2 py-0.5 bg-stone-900 text-stone-100 text-[9px] font-bold tracking-widest uppercase rounded-lg">
                  COMPROVANTE DE VENDA
                </div>
              </div>

              {/* Transaction Metadata */}
              <div className="space-y-1 text-[11px] py-1 border-b border-dashed border-stone-400">
                <div className="flex justify-between">
                  <span className="text-stone-600">Comprovante:</span>
                  <span className="font-bold">#{lastTransaction.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600">Data/Hora:</span>
                  <span>{new Date().toLocaleDateString('pt-BR')} {lastTransaction.timestamp}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600">Cliente:</span>
                  <span className="font-bold truncate max-w-[170px] text-right">{lastTransaction.clientName}</span>
                </div>
                {lastTransaction.clientPhone && (
                  <div className="flex justify-between">
                    <span className="text-stone-600">Telefone:</span>
                    <span>{lastTransaction.clientPhone}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-stone-600">Atendente:</span>
                  <span className="font-bold">{lastTransaction.professionalName}</span>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="space-y-1.5 py-1">
                <div className="flex justify-between text-[10px] font-bold text-stone-600 uppercase border-b border-stone-800 pb-1">
                  <span>Qtd Item</span>
                  <span>Valor</span>
                </div>

                {lastTransaction.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between items-start text-[11px] gap-2">
                    <span className="truncate pr-1">{it.quantity}x {it.title}</span>
                    <span className="font-bold shrink-0 font-mono">R$ {(it.price * it.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Totals & Financial Breakdown */}
              <div className="border-t-2 border-dashed border-stone-800 pt-2 space-y-1 text-[11px]">
                <div className="flex justify-between text-stone-600">
                  <span>Subtotal:</span>
                  <span>R$ {lastTransaction.subtotal.toFixed(2)}</span>
                </div>

                {lastTransaction.discount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>Desconto:</span>
                    <span>- R$ {lastTransaction.discount.toFixed(2)}</span>
                  </div>
                )}

                {lastTransaction.tip > 0 && (
                  <div className="flex justify-between text-amber-700 font-semibold">
                    <span>Gorjeta Barbeiro:</span>
                    <span>+ R$ {lastTransaction.tip.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center text-sm font-bold pt-2 border-t-2 border-stone-900 border-b-2 py-1 my-1">
                  <span>TOTAL PAGO</span>
                  <span className="text-base text-emerald-800 font-mono font-black">
                    R$ {lastTransaction.total.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between pt-1">
                  <span className="text-stone-600">Forma Pagto:</span>
                  <span className="font-bold uppercase">{lastTransaction.paymentMethod}</span>
                </div>

                {lastTransaction.paymentDetails && (
                  <div className="text-[10px] text-stone-600 italic text-right">
                    {lastTransaction.paymentDetails}
                  </div>
                )}
              </div>

              {/* Receipt Footer */}
              <div className="text-center pt-3 border-t border-dashed border-stone-400 space-y-1">
                <p className="font-bold text-[10px] text-stone-900 uppercase tracking-wider">OBRIGADO PELA PREFERÊNCIA!</p>
                <p className="text-[9px] text-stone-600">Corte, Barba e Estilo com Tradição</p>
                <div className="font-mono text-xs tracking-[0.3em] font-bold pt-1 select-none opacity-80">
                  |||| ||||| ||| |||||||
                </div>
                <p className="text-[8px] text-stone-500 tracking-wider font-mono">
                  AUT: {lastTransaction.id}-{Date.now().toString().slice(-4)}
                </p>
              </div>

              {/* Serrated Bottom Edge simulation */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-stone-300 border-t border-dashed border-stone-400 opacity-60" />
            </div>

            {/* ACTION BUTTONS (IMPRIMIR, WHATSAPP, CONCLUIR) */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                onClick={() => handlePrintReceipt(lastTransaction)}
                className="h-10 rounded-xl bg-gold-base hover:bg-gold-hover text-surface-base font-bold text-xs flex items-center justify-center gap-1.5 shadow active:scale-95 transition-all cursor-pointer"
                title="Imprimir Comprovante"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir</span>
              </button>

              <button
                onClick={() => handleShareWhatsApp(lastTransaction)}
                className="h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow active:scale-95 transition-all cursor-pointer"
                title="Enviar por WhatsApp"
              >
                <Share2 className="w-4 h-4" />
                <span>WhatsApp</span>
              </button>

              <button
                onClick={() => setShowReceiptModal(false)}
                className="h-10 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer"
              >
                <span>Concluir</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* HISTÓRICO DE VENDAS DO DIA MODAL */}
      {showSalesHistory && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-surface-base/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl bg-surface-card border border-border-subtle rounded-xl p-4 sm:p-5 shadow-2xl space-y-3 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-2.5 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-gold-hover" />
                <h3 className="font-serif font-bold text-content-base text-sm">Vendas e Recebimentos de Hoje</h3>
              </div>
              <button
                onClick={() => setShowSalesHistory(false)}
                className="w-7 h-7 rounded-xl bg-surface-base border border-border-subtle flex items-center justify-center text-content-muted hover:text-content-base"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar no-scrollbar min-w-0">
              {todaysSales.length === 0 ? (
                <div className="text-center py-12 text-content-muted text-xs">
                  Nenhuma venda realizada hoje ainda.
                </div>
              ) : (
                todaysSales.map((sale) => (
                  <div
                    key={sale.id}
                    className="p-3 rounded-xl bg-surface-base border border-border-subtle flex items-center justify-between gap-3 min-w-0"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-xl bg-gold-base/15 text-gold-hover font-mono shrink-0">
                          {sale.timestamp}
                        </span>
                        <h4 className="font-bold text-content-base text-xs truncate min-w-0">{sale.clientName}</h4>
                        <span className="text-[10px] text-content-muted shrink-0 hidden sm:inline">({sale.professionalName})</span>
                      </div>
                      <p className="text-[11px] text-content-muted truncate">
                        {sale.items.map(i => `${i.quantity}x ${i.title}`).join(', ')}
                      </p>
                    </div>

                    <div className="text-right shrink-0 whitespace-nowrap">
                      <span className="block font-bold text-status-success text-xs font-mono num-tabular">
                        R$ {sale.total.toFixed(2)}
                      </span>
                      <span className="text-[10px] font-bold text-content-muted uppercase">
                        {sale.paymentMethod}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2.5 border-t border-border-subtle flex justify-between items-center text-xs">
              <span className="text-content-muted">{todaysSales.length} transação(ões)</span>
              <span className="font-bold text-content-base">Faturamento: <strong className="text-status-success text-xs font-mono font-bold num-tabular">R$ {totalRevenueToday.toFixed(2)}</strong></span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
