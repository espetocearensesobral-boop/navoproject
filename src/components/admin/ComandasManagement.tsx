import React, { useState, useEffect } from 'react';
import { handleEnterAsTab } from '../../utils/formUtils';
import { 
  fetchAppointmentsFromSupabase, 
  fetchServicesFromSupabase, 
  fetchProductsFromSupabase, 
  fetchProfessionalsFromSupabase 
} from '../../services/supabaseDataService';
import { Appointment, ServiceItem, ProductItem, Professional } from '../../types';
import { defaultPrintSettings, fetchPrintSettings } from '../../services/printSettingsService';
import { escapePrintHtml, openPrintWindow } from '../../utils/printUtils';
import { AdminPageHeader } from './shared/AdminPageHeader';
import { AdminTabs } from './shared/AdminTabs';
import { 
  Receipt, 
  Plus, 
  Search, 
  User, 
  Scissors, 
  ShoppingBag, 
  Trash2, 
  CreditCard, 
  DollarSign, 
  QrCode, 
  Printer, 
  Share2, 
  X, 
  CheckCircle2, 
  Clock, 
  Check, 
  AlertCircle,
  FileText,
  Percent,
  Sparkles
} from 'lucide-react';

import { 
  fetchShopProfile, 
  ShopProfile, 
  defaultShopProfile 
} from '../../services/shopProfileService';

export interface ComandaItem {
  id: string;
  type: 'service' | 'product';
  title: string;
  price: number;
  quantity: number;
  barberId?: string;
  barberName?: string;
}

export interface Comanda {
  id: string;
  code: string;
  clientName: string;
  clientPhone?: string;
  professionalId?: string;
  professionalName?: string;
  items: ComandaItem[];
  subtotal: number;
  discount: number;
  tip: number;
  total: number;
  status: 'open' | 'closed' | 'cancelled';
  paymentMethod?: 'pix' | 'credit_card' | 'debit_card' | 'cash' | 'split';
  createdAt: string;
  closedAt?: string;
  appointmentId?: string;
}

export const ComandasManagement: React.FC = () => {
  const [shopProfile, setShopProfile] = useState<ShopProfile>(defaultShopProfile);

  useEffect(() => {
    fetchShopProfile().then(p => { if (p) setShopProfile(p); });
  }, []);

  const [comandas, setComandas] = useState<Comanda[]>(() => {
    // Load initial comandas from localStorage if present
    const saved = localStorage.getItem('navo_comandas_v1');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    // Default initial comandas
    return [
      {
        id: 'cmd_101',
        code: 'CMD-001',
        clientName: 'Marcos Oliveira',
        clientPhone: '(11) 98822-1144',
        professionalName: 'Lucas Silva',
        professionalId: 'p1',
        items: [
          { id: 's1', type: 'service', title: 'Corte Degradê & Barberia', price: 65, quantity: 1, barberName: 'Lucas Silva' },
          { id: 'p1', type: 'product', title: 'Cerveja Artesanal IPA', price: 15, quantity: 2 }
        ],
        subtotal: 95,
        discount: 5,
        tip: 10,
        total: 100,
        status: 'open',
        createdAt: new Date(Date.now() - 45 * 60000).toISOString()
      },
      {
        id: 'cmd_102',
        code: 'CMD-002',
        clientName: 'Rafael Costa',
        clientPhone: '(11) 97711-3322',
        professionalName: 'Gabriel Santos',
        professionalId: 'p2',
        items: [
          { id: 's2', type: 'service', title: 'Barba Imperial + Toalha Quente', price: 50, quantity: 1, barberName: 'Gabriel Santos' }
        ],
        subtotal: 50,
        discount: 0,
        tip: 0,
        total: 50,
        status: 'open',
        createdAt: new Date(Date.now() - 20 * 60000).toISOString()
      }
    ];
  });

  const [services, setServices] = useState<ServiceItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  // Active View State
  const [activeTab, setActiveTab] = useState<'open' | 'closed' | 'new'>('open');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedComanda, setSelectedComanda] = useState<Comanda | null>(null);
  
  // Checkout Modal State for Closing Comanda
  const [closingComanda, setClosingComanda] = useState<Comanda | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credit_card' | 'debit_card' | 'cash' | 'split'>('pix');
  const [cashGiven, setCashGiven] = useState<string>('');
  const [discountInput, setDiscountInput] = useState<number>(0);
  const [tipInput, setTipInput] = useState<number>(0);
  const [receiptModalComanda, setReceiptModalComanda] = useState<Comanda | null>(null);

  // New Comanda Form State
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newBarberId, setNewBarberId] = useState('');
  const [newCartItems, setNewCartItems] = useState<ComandaItem[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');

  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    loadCatalogData();
  }, []);

  useEffect(() => {
    localStorage.setItem('navo_comandas_v1', JSON.stringify(comandas));
  }, [comandas]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const loadCatalogData = async () => {
    setLoading(true);
    try {
      const [s, p, profs, apts] = await Promise.all([
        fetchServicesFromSupabase().catch(() => []),
        fetchProductsFromSupabase().catch(() => []),
        fetchProfessionalsFromSupabase().catch(() => []),
        fetchAppointmentsFromSupabase().catch(() => [])
      ]);
      setServices(s);
      setProducts(p);
      setProfessionals(profs);
      setAppointments(apts);
    } catch (e) {
      console.error('Erro ao carregar catálogo para comandas:', e);
    } finally {
      setLoading(false);
    }
  };

  // Filtered Comandas
  const openComandas = comandas.filter(c => c.status === 'open' && (
    c.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.clientPhone && c.clientPhone.includes(searchQuery))
  ));

  const closedComandas = comandas.filter(c => c.status === 'closed' && (
    c.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.code.toLowerCase().includes(searchQuery.toLowerCase())
  ));

  // Handle Add Item to New Comanda
  const handleAddServiceToCart = () => {
    if (!selectedServiceId) return;
    const svc = services.find(s => s.id === selectedServiceId);
    if (!svc) return;

    const barber = professionals.find(p => p.id === newBarberId);
    const existingIndex = newCartItems.findIndex(i => i.id === svc.id && i.type === 'service');

    if (existingIndex >= 0) {
      const updated = [...newCartItems];
      updated[existingIndex].quantity += 1;
      setNewCartItems(updated);
    } else {
      setNewCartItems([
        ...newCartItems,
        {
          id: svc.id,
          type: 'service',
          title: svc.title,
          price: svc.price,
          quantity: 1,
          barberId: barber?.id,
          barberName: barber?.name
        }
      ]);
    }
    setSelectedServiceId('');
  };

  const handleAddProductToCart = () => {
    if (!selectedProductId) return;
    const prod = products.find(p => p.id === selectedProductId);
    if (!prod) return;

    const existingIndex = newCartItems.findIndex(i => i.id === prod.id && i.type === 'product');
    if (existingIndex >= 0) {
      const updated = [...newCartItems];
      updated[existingIndex].quantity += 1;
      setNewCartItems(updated);
    } else {
      setNewCartItems([
        ...newCartItems,
        {
          id: prod.id,
          type: 'product',
          title: prod.name,
          price: prod.price,
          quantity: 1
        }
      ]);
    }
    setSelectedProductId('');
  };

  const handleRemoveCartItem = (index: number) => {
    setNewCartItems(newCartItems.filter((_, i) => i !== index));
  };

  // Create Comanda
  const handleCreateComanda = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) {
      alert('Por favor, informe o nome do cliente.');
      return;
    }
    if (newCartItems.length === 0) {
      alert('Adicione ao menos um serviço ou produto à comanda.');
      return;
    }

    const barber = professionals.find(p => p.id === newBarberId);
    const subtotal = newCartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);

    const newCmd: Comanda = {
      id: `cmd_${Date.now()}`,
      code: `CMD-${String(comandas.length + 1).padStart(3, '0')}`,
      clientName: newClientName.trim(),
      clientPhone: newClientPhone.trim() || undefined,
      professionalId: barber?.id,
      professionalName: barber?.name || 'Geral',
      items: newCartItems,
      subtotal,
      discount: 0,
      tip: 0,
      total: subtotal,
      status: 'open',
      createdAt: new Date().toISOString()
    };

    setComandas([newCmd, ...comandas]);
    setNewClientName('');
    setNewClientPhone('');
    setNewBarberId('');
    setNewCartItems([]);
    setActiveTab('open');
    showToast(`Comanda ${newCmd.code} aberta com sucesso!`);
  };

  // Open Comanda from Appointment
  const handleOpenComandaFromAppointment = (apt: Appointment) => {
    const barber = professionals.find(p => p.name === apt.professional_name);
    const svcTitle = apt.services?.[0]?.title || 'Atendimento de Cabelo/Barba';
    const price = apt.final_amount || apt.original_amount || 60;

    const newCmd: Comanda = {
      id: `cmd_apt_${apt.id}`,
      code: `CMD-${String(comandas.length + 1).padStart(3, '0')}`,
      clientName: apt.client_name,
      clientPhone: apt.client_phone,
      professionalId: barber?.id,
      professionalName: apt.professional_name,
      items: [
        {
          id: `svc_${apt.id}`,
          type: 'service',
          title: svcTitle,
          price: price,
          quantity: 1,
          barberId: barber?.id,
          barberName: apt.professional_name
        }
      ],
      subtotal: price,
      discount: 0,
      tip: 0,
      total: price,
      status: 'open',
      createdAt: new Date().toISOString(),
      appointmentId: apt.id
    };

    setComandas([newCmd, ...comandas]);
    showToast(`Comanda gerada para o agendamento de ${apt.client_name}`);
  };

  // Start Closing Modal
  const handleStartCloseComanda = (cmd: Comanda) => {
    setClosingComanda(cmd);
    setDiscountInput(cmd.discount || 0);
    setTipInput(cmd.tip || 0);
    setCashGiven('');
    setPaymentMethod('pix');
  };

  // Confirm Closing Comanda
  const handleConfirmCloseComanda = () => {
    if (!closingComanda) return;

    const subtotal = closingComanda.subtotal;
    const finalTotal = Math.max(0, subtotal - discountInput + tipInput);

    const updatedCmd: Comanda = {
      ...closingComanda,
      discount: discountInput,
      tip: tipInput,
      total: finalTotal,
      status: 'closed',
      paymentMethod,
      closedAt: new Date().toISOString()
    };

    setComandas(comandas.map(c => c.id === updatedCmd.id ? updatedCmd : c));
    setClosingComanda(null);
    setReceiptModalComanda(updatedCmd);
    showToast(`Comanda ${updatedCmd.code} fechada e paga!`);
  };

  const handlePrintComanda = async () => {
    if (!receiptModalComanda) return;
    const settings = await fetchPrintSettings().catch(() => defaultPrintSettings);
    const details = [
      settings.showClientData ? `<p><strong>Cliente:</strong> ${escapePrintHtml(receiptModalComanda.clientName)}</p>` : '',
      settings.showProfessional ? `<p><strong>Profissional:</strong> ${escapePrintHtml(receiptModalComanda.professionalName || 'Geral')}</p>` : '',
      `<p><strong>Data:</strong> ${escapePrintHtml(new Date(receiptModalComanda.closedAt || receiptModalComanda.createdAt).toLocaleString('pt-BR'))}</p>`,
      settings.showPayment ? `<p><strong>Pagamento:</strong> ${escapePrintHtml(receiptModalComanda.paymentMethod)}</p>` : '',
    ].join('');
    const items = settings.showService ? `<h2>Itens consumidos</h2>${receiptModalComanda.items.map((item) => `<div class="print-row"><span>${escapePrintHtml(`${item.quantity}x ${item.title}`)}</span><strong>${escapePrintHtml(`R$ ${(item.price * item.quantity).toFixed(2)}`)}</strong></div>`).join('')}` : '';
    const totals = `<hr class="print-divider"><div class="print-row"><span>Subtotal</span><strong>R$ ${receiptModalComanda.subtotal.toFixed(2)}</strong></div>${receiptModalComanda.discount > 0 ? `<div class="print-row"><span>Desconto</span><strong>- R$ ${receiptModalComanda.discount.toFixed(2)}</strong></div>` : ''}${receiptModalComanda.tip > 0 ? `<div class="print-row"><span>Caixinha / Gorjeta</span><strong>+ R$ ${receiptModalComanda.tip.toFixed(2)}</strong></div>` : ''}<div class="print-row print-total"><span>Total pago</span><strong>R$ ${receiptModalComanda.total.toFixed(2)}</strong></div>`;
    const bodyHtml = `${settings.showLogo ? '<h1 class="print-center">Navo Barber &amp; Club</h1>' : ''}<h2 class="print-center">Comprovante de atendimento</h2><p class="print-center print-muted">#${escapePrintHtml(receiptModalComanda.code)}</p><hr class="print-divider">${details}${items}${totals}`;
    openPrintWindow({ title: 'Comprovante de atendimento', settings, format: settings.receiptFormat, bodyHtml });
  };

  return (
    <div className="space-y-4 animate-fade-in text-content-base min-w-0">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 bg-gold-base text-surface-base px-4 py-2.5 rounded-xl font-bold text-xs shadow-xl flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header (desktop) */}
      <AdminPageHeader
        icon={Receipt}
        title="Comandas"
        stats={[
          { label: 'abertas', value: openComandas.length, tone: 'success' },
        ]}
        action={{ label: 'Nova comanda', onClick: () => setActiveTab('new') }}
      />

      {/* Ação (mobile) */}
      <button
        onClick={() => setActiveTab('new')}
        className="md:hidden w-full bg-gold-base hover:bg-gold-hover text-surface-base px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 shrink-0"
      >
        <Plus className="w-4 h-4 stroke-[2.5]" />
        <span>Nova comanda</span>
      </button>

      {/* Navigation Tabs */}
      <AdminTabs
        tabs={[
          { id: 'open', label: 'Abertas', count: comandas.filter(c => c.status === 'open').length },
          { id: 'closed', label: 'Fechadas', count: comandas.filter(c => c.status === 'closed').length },
          { id: 'new', label: 'Nova', icon: Plus },
        ]}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as typeof activeTab)}
      />

      {/* Search Bar */}
      {activeTab !== 'new' && (
        <div className="relative">
          <Search className="w-4 h-4 text-content-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Número, cliente ou telefone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-card border border-border-subtle rounded-xl pl-10 pr-4 py-2.5 text-xs text-content-base focus:outline-none focus:ring-1 focus:ring-gold-base/50 placeholder:text-content-muted/60"
          />
        </div>
      )}

      {/* VIEW 1: OPEN COMANDAS */}
      {activeTab === 'open' && (
        <div>
          {openComandas.length === 0 ? (
            <div className="bg-surface-card border border-border-subtle rounded-2xl p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-surface-base border border-border-subtle text-content-muted flex items-center justify-center mx-auto">
                <Receipt className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-content-base">Nenhuma comanda aberta</h3>
              <p className="text-xs text-content-muted max-w-sm mx-auto">
                Sem comandas abertas. Crie uma para registrar atendimento ou consumo.
              </p>
              <button
                onClick={() => setActiveTab('new')}
                className="bg-gold-base text-surface-base px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 hover:bg-gold-hover transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Abrir comanda</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {openComandas.map((cmd) => (
                <div
                  key={cmd.id}
                  className="bg-surface-card border border-border-subtle hover:border-gold-base/40 rounded-2xl p-4 shadow-xs transition-all flex flex-col justify-between space-y-3 relative overflow-hidden group"
                >
                  <div className="absolute top-0 right-0 w-2 h-full bg-gold-base" />

                  {/* Comanda Header */}
                  <div>
                    <div className="flex items-center justify-between border-b border-border-subtle/60 pb-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-gold-base bg-gold-base/10 px-2 py-0.5 rounded-xl">
                          {cmd.code}
                        </span>
                        <span className="text-xs text-content-muted flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(cmd.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <span className="text-xs bg-status-success/10 text-status-success font-bold px-2 py-0.5 rounded-xl uppercase">
                        Aberta
                      </span>
                    </div>

                    {/* Client & Professional info */}
                    <div className="space-y-1 mb-3">
                      <div className="flex items-center gap-2 text-sm font-bold text-content-base">
                        <User className="w-4 h-4 text-gold-base shrink-0" />
                        <span className="truncate">{cmd.clientName}</span>
                      </div>
                      {cmd.professionalName && (
                        <div className="flex items-center gap-2 text-xs text-content-muted">
                          <Scissors className="w-3.5 h-3.5 text-content-muted shrink-0" />
                          <span>Profissional: <strong className="text-content-base">{cmd.professionalName}</strong></span>
                        </div>
                      )}
                    </div>

                    {/* Items List */}
                    <div className="bg-surface-base rounded-xl p-2.5 border border-border-subtle/80 space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                      <span className="text-xs font-bold uppercase text-content-muted tracking-wider block mb-1">
                        Consumo na Comanda
                      </span>
                      {cmd.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs">
                          <div className="flex items-center gap-1.5 min-w-0 pr-2">
                            <span className="font-bold text-gold-base">{item.quantity}x</span>
                            <span className="text-content-base truncate">{item.title}</span>
                          </div>
                          <span className="font-bold finance-positive tabular-nums shrink-0">
                            R$ {(item.price * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Total & Action */}
                  <div className="border-t border-border-subtle/80 pt-3 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-content-muted uppercase font-bold block">Total Parcial</span>
                      <span className="text-lg font-bold finance-positive tabular-nums">
                        R$ {cmd.subtotal.toFixed(2)}
                      </span>
                    </div>

                    <button
                      onClick={() => handleStartCloseComanda(cmd)}
                      className="bg-gold-base hover:bg-gold-hover text-surface-base px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
                    >
                      <Receipt className="w-4 h-4" />
                      <span>Fechar Conta</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: CLOSED COMANDAS */}
      {activeTab === 'closed' && (
        <div className="space-y-3">
          {closedComandas.length === 0 ? (
            <div className="bg-surface-card border border-border-subtle rounded-2xl p-8 text-center text-content-muted text-xs">
              Nenhuma comanda fechada encontrada no histórico.
            </div>
          ) : (
            <div className="bg-surface-card border border-border-subtle rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[760px]">
                  <thead className="bg-surface-base border-b border-border-subtle text-content-muted uppercase font-bold text-xs">
                    <tr className="whitespace-nowrap">
                      <th className="p-3">Código</th>
                      <th className="p-3">Cliente</th>
                      <th className="p-3">Profissional</th>
                      <th className="p-3">Itens</th>
                      <th className="p-3">Pagamento</th>
                      <th className="p-3 text-right">Valor Pago</th>
                      <th className="p-3 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/60 text-content-base">
                    {closedComandas.map((cmd) => (
                      <tr key={cmd.id} className="hover:bg-surface-base/50 transition-colors">
                        <td className="p-3 font-mono font-bold text-gold-base">{cmd.code}</td>
                        <td className="p-3 font-semibold">{cmd.clientName}</td>
                        <td className="p-3 text-content-muted">{cmd.professionalName || 'Geral'}</td>
                        <td className="p-3 text-content-muted max-w-xs truncate">
                          {cmd.items.map(i => `${i.quantity}x ${i.title}`).join(', ')}
                        </td>
                        <td className="p-3 uppercase font-bold text-xs text-content-muted">
                          {cmd.paymentMethod === 'pix' ? 'PIX' : cmd.paymentMethod === 'credit_card' ? 'Cartão Crédito' : cmd.paymentMethod === 'cash' ? 'Dinheiro' : 'Débito'}
                        </td>
                        <td className="p-3 text-right font-bold finance-positive tabular-nums">
                          R$ {cmd.total.toFixed(2)}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => setReceiptModalComanda(cmd)}
                            className="p-1.5 rounded-lg border border-border-subtle hover:bg-surface-base text-content-muted hover:text-gold-base transition-colors"
                            title="Ver Comprovante"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: NEW COMANDA FORM */}
      {activeTab === 'new' && (
        <form onKeyDown={handleEnterAsTab} onSubmit={handleCreateComanda} className="bg-surface-card border border-border-subtle rounded-2xl p-5 space-y-5 shadow-xs max-w-2xl mx-auto">
          <div className="border-b border-border-subtle pb-3">
            <h2 className="text-base font-bold text-content-base flex items-center gap-2">
              <Plus className="w-5 h-5 text-gold-base" />
              <span>Nova comanda</span>
            </h2>
            <p className="text-xs text-content-muted mt-0.5">
              Cliente, barbeiro, serviços e produtos.
            </p>
          </div>

          {/* Client Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-content-muted uppercase tracking-wider block mb-1">
                Nome do Cliente *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Carlos Eduardo"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                className="w-full bg-surface-base border border-border-subtle rounded-xl px-3 py-2 text-xs text-content-base focus:outline-none focus:ring-1 focus:ring-gold-base"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-content-muted uppercase tracking-wider block mb-1">
                WhatsApp / Telefone
              </label>
              <input
                type="text"
                placeholder="(11) 99999-8888"
                value={newClientPhone}
                onChange={(e) => setNewClientPhone(e.target.value)}
                className="w-full bg-surface-base border border-border-subtle rounded-xl px-3 py-2 text-xs text-content-base focus:outline-none focus:ring-1 focus:ring-gold-base"
              />
            </div>
          </div>

          {/* Professional Selection */}
          <div>
            <label className="text-xs font-bold text-content-muted uppercase tracking-wider block mb-1">
              Profissional Responsável
            </label>
            <select
              value={newBarberId}
              onChange={(e) => setNewBarberId(e.target.value)}
              className="w-full bg-surface-base border border-border-subtle rounded-xl px-3 py-2 text-xs text-content-base focus:outline-none focus:ring-1 focus:ring-gold-base"
            >
              <option value="">Barbeiro (opcional)</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
              ))}
            </select>
          </div>

          {/* Add Items to Comanda */}
          <div className="space-y-3 bg-surface-base p-4 rounded-xl border border-border-subtle">
            <span className="text-xs font-bold text-content-base uppercase tracking-wider block">
              Adicionar Consumo
            </span>

            {/* Select Service */}
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <select
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs text-content-base focus:outline-none"
                >
                  <option value="">+ Serviço</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.title} — R$ {s.price.toFixed(2)}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={handleAddServiceToCart}
                className="bg-gold-base text-surface-base px-3 py-2 rounded-xl text-xs font-bold hover:bg-gold-hover transition-colors shrink-0"
              >
                Adicionar
              </button>
            </div>

            {/* Select Product */}
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs text-content-base focus:outline-none"
                >
                  <option value="">+ Produto</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} — R$ {p.price.toFixed(2)} (Estoque: {p.stock_quantity})</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={handleAddProductToCart}
                className="bg-gold-base text-surface-base px-3 py-2 rounded-xl text-xs font-bold hover:bg-gold-hover transition-colors shrink-0"
              >
                Adicionar
              </button>
            </div>

            {/* Current Items List */}
            {newCartItems.length > 0 && (
              <div className="pt-2 border-t border-border-subtle/80 space-y-2">
                <span className="text-xs font-bold text-content-muted uppercase tracking-wider block">
                  Itens na Comanda ({newCartItems.length})
                </span>
                {newCartItems.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-surface-card p-2.5 rounded-xl border border-border-subtle/60 text-xs">
                    <div>
                      <span className="font-bold text-content-base">{item.quantity}x {item.title}</span>
                      <span className="text-xs text-content-muted block uppercase">
                        {item.type === 'service' ? 'Serviço' : 'Produto'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold finance-positive tabular-nums">
                        R$ {(item.price * item.quantity).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveCartItem(idx)}
                        className="text-status-error hover:opacity-80 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setActiveTab('open')}
              className="px-4 py-2 rounded-xl text-xs font-bold text-content-muted hover:text-content-base transition-colors"
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="bg-gold-base hover:bg-gold-hover text-surface-base px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
            >
              Abrir comanda
            </button>
          </div>
        </form>
      )}

      {/* CLOSING COMANDA MODAL */}
      {closingComanda && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-card border border-border-subtle rounded-2xl w-full max-w-md p-5 text-content-base space-y-4 relative shadow-2xl animate-fade-in">
            <button
              onClick={() => setClosingComanda(null)}
              className="absolute top-4 right-4 text-content-muted hover:text-content-base p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-border-subtle pb-3">
              <div className="w-10 h-10 rounded-xl bg-gold-base/15 text-gold-base flex items-center justify-center shrink-0">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-content-base">Fechar conta</h3>
                <p className="text-xs text-content-muted font-mono">{closingComanda.code} • {closingComanda.clientName}</p>
              </div>
            </div>

            {/* Calculations */}
            <div className="space-y-3 bg-surface-base p-3.5 rounded-xl border border-border-subtle text-xs">
              <div className="flex justify-between items-center text-content-muted">
                <span>Subtotal dos Itens:</span>
                <span className="font-bold finance-positive tabular-nums">R$ {closingComanda.subtotal.toFixed(2)}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border-subtle/60">
                <div>
                  <label className="text-xs font-bold text-content-muted uppercase block mb-1">Desconto (R$)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={discountInput}
                    onChange={(e) => setDiscountInput(Number(e.target.value))}
                    className="w-full bg-surface-card border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-content-base focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-content-muted uppercase block mb-1">Gorjeta / Caixinha (R$)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={tipInput}
                    onChange={(e) => setTipInput(Number(e.target.value))}
                    className="w-full bg-surface-card border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-content-base focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center text-sm font-bold border-t border-border-subtle/80 pt-2 finance-positive">
                <span>Total a Pagar:</span>
                <span className="text-base tabular-nums">
                  R$ {Math.max(0, closingComanda.subtotal - discountInput + tipInput).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-content-muted uppercase tracking-wider block">
                Forma de Pagamento
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'pix', label: 'PIX', icon: QrCode },
                  { id: 'credit_card', label: 'Crédito', icon: CreditCard },
                  { id: 'debit_card', label: 'Débito', icon: CreditCard },
                  { id: 'cash', label: 'Dinheiro', icon: DollarSign },
                  { id: 'split', label: 'Dividido', icon: Percent }
                ].map((pm) => {
                  const Icon = pm.icon;
                  const isSel = paymentMethod === pm.id;
                  return (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setPaymentMethod(pm.id as any)}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all ${
                        isSel
                          ? 'bg-gold-base/15 border-gold-base text-gold-base shadow-xs'
                          : 'bg-surface-base border-border-subtle text-content-muted hover:border-gold-base/30'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{pm.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                onClick={() => setClosingComanda(null)}
                className="px-4 py-2 text-xs font-bold text-content-muted hover:text-content-base"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmCloseComanda}
                className="bg-gold-base hover:bg-gold-hover text-surface-base px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 flex items-center gap-1.5"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Confirmar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECEIPT MODAL */}
      {receiptModalComanda && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-card border border-border-subtle rounded-2xl w-full max-w-sm p-6 text-content-base space-y-4 relative shadow-2xl font-serif">
            <button
              onClick={() => setReceiptModalComanda(null)}
              className="absolute top-4 right-4 text-content-muted hover:text-content-base p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center border-b border-border-subtle pb-4 space-y-1">
              {shopProfile.logoUrl ? (
                <div className="w-14 h-14 rounded-full p-[2px] bg-gradient-to-tr from-amber-600 via-gold-base to-amber-300 mx-auto mb-2 shadow-md overflow-hidden flex items-center justify-center">
                  <img 
                    src={shopProfile.logoUrl} 
                    alt={shopProfile.name || 'Logo'} 
                    className="w-full h-full object-cover rounded-full bg-neutral-900" 
                    onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                  />
                </div>
              ) : null}
              <h2 className="text-lg font-bold text-content-base tracking-widest uppercase">{shopProfile.name || 'NAVO PREMIUM'}</h2>
              <p className="text-xs text-gold-base font-bold uppercase tracking-widest">{shopProfile.slogan || 'Heritage Barber & Club'}</p>
              <p className="text-xs text-content-muted font-sans">Comprovante de Atendimento #{receiptModalComanda.code}</p>
            </div>

            <div className="text-xs font-sans space-y-1.5 border-b border-border-subtle pb-3">
              <p><strong>Cliente:</strong> {receiptModalComanda.clientName}</p>
              <p><strong>Profissional:</strong> {receiptModalComanda.professionalName || 'Geral'}</p>
              <p><strong>Data:</strong> {new Date(receiptModalComanda.closedAt || receiptModalComanda.createdAt).toLocaleString('pt-BR')}</p>
              <p className="uppercase"><strong>Pagamento:</strong> {receiptModalComanda.paymentMethod}</p>
            </div>

            <div className="font-sans space-y-2">
              <span className="text-xs font-bold uppercase text-content-muted block">Itens Consumidos</span>
              {receiptModalComanda.items.map((item, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span>{item.quantity}x {item.title}</span>
                  <span className="font-bold finance-positive tabular-nums">R$ {(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-border-subtle pt-3 font-sans space-y-1 text-xs">
              <div className="flex justify-between text-content-muted">
                <span>Subtotal:</span>
                <span className="finance-positive">R$ {receiptModalComanda.subtotal.toFixed(2)}</span>
              </div>
              {receiptModalComanda.discount > 0 && (
                <div className="flex justify-between finance-negative">
                  <span>Desconto:</span>
                  <span>- R$ {receiptModalComanda.discount.toFixed(2)}</span>
                </div>
              )}
              {receiptModalComanda.tip > 0 && (
                <div className="flex justify-between finance-positive">
                  <span>Caixinha / Gorjeta:</span>
                  <span>+ R$ {receiptModalComanda.tip.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-content-base border-t border-border-subtle/80 pt-1">
                <span>TOTAL PAGO:</span>
                <span className="finance-positive tabular-nums">R$ {receiptModalComanda.total.toFixed(2)}</span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-center gap-2 font-sans">
              <button
                onClick={handlePrintComanda}
                className="px-3 py-2 rounded-xl border border-border-subtle hover:bg-surface-base text-xs font-bold flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir</span>
              </button>
              <button
                onClick={() => {
                  const msg = `Olá! Segue o comprovante da comanda ${receiptModalComanda.code} no Navo Premium no valor de R$ ${receiptModalComanda.total.toFixed(2)}. Obrigado pela preferência!`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                }}
                className="bg-status-success text-surface-base px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                <Share2 className="w-4 h-4" />
                <span>Enviar Whats</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
