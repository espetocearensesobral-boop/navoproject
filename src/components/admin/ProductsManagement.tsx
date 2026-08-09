import React, { useState, useEffect } from 'react';
import { ProductItem } from '../../types';
import { fetchProductsFromSupabase, saveProductInSupabase, deleteProductInSupabase } from '../../services/supabaseDataService';
import { Package, Plus, Edit2, Trash2, AlertTriangle, CheckCircle2, DollarSign, X, Save, Search, Filter, TrendingUp, Layers } from 'lucide-react';

export const ProductsManagement: React.FC = () => {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<ProductItem>>({
    name: '',
    category: 'Finalizadores',
    brand: 'Navo Pro',
    price: 45,
    cost_price: 20,
    stock_quantity: 25,
    min_stock_alert: 5,
    commission_percentage: 15,
    image_url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=75&w=300'
  });

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    const data = await fetchProductsFromSupabase();
    setProducts(data);
    setLoading(false);
  };

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      category: 'Finalizadores',
      brand: 'Navo Pro',
      price: 45,
      cost_price: 20,
      stock_quantity: 25,
      min_stock_alert: 5,
      commission_percentage: 15,
      image_url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=75&w=300'
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (prod: ProductItem) => {
    setEditingProduct(prod);
    setFormData({ ...prod });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Tem certeza que deseja excluir o produto "${name}" do estoque?`)) {
      const updated = await deleteProductInSupabase(id);
      setProducts(updated);
      showNotification('Produto removido com sucesso!');
    }
  };

  const handleAdjustStock = async (prod: ProductItem, delta: number) => {
    const updatedProd: ProductItem = {
      ...prod,
      stock_quantity: Math.max(0, prod.stock_quantity + delta)
    };
    const list = await saveProductInSupabase(updatedProd);
    setProducts(list);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.price || formData.stock_quantity === undefined) {
      alert('Por favor, preencha o nome do produto, preço e quantidade em estoque.');
      return;
    }

    const itemToSave: ProductItem = {
      id: editingProduct?.id || `prod_${Date.now()}`,
      name: formData.name || '',
      category: formData.category || 'Geral',
      brand: formData.brand || 'BarberX',
      price: Number(formData.price),
      cost_price: Number(formData.cost_price || 0),
      stock_quantity: Number(formData.stock_quantity),
      min_stock_alert: Number(formData.min_stock_alert || 5),
      commission_percentage: Number(formData.commission_percentage || 10),
      image_url: formData.image_url || undefined
    };

    const updatedList = await saveProductInSupabase(itemToSave, Boolean(editingProduct));
    setProducts(updatedList);
    setIsModalOpen(false);
    showNotification(editingProduct ? 'Produto atualizado!' : 'Novo produto cadastrado!');
  };

  const showNotification = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  // Get Unique Categories
  const categoriesList = Array.from(new Set(products.map(p => p.category))).filter(Boolean);

  // Filter Logic
  const filteredProducts = products.filter((prod) => {
    const matchesSearch = prod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          prod.brand.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || prod.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // KPI Calculations
  const totalItems = products.reduce((acc, p) => acc + p.stock_quantity, 0);
  const totalStockValue = products.reduce((acc, p) => acc + (p.price * p.stock_quantity), 0);
  const lowStockCount = products.filter(p => p.stock_quantity <= p.min_stock_alert).length;
  const avgMargin = products.length > 0 
    ? (products.reduce((acc, p) => acc + (p.price > 0 ? ((p.price - p.cost_price) / p.price) * 100 : 0), 0) / products.length).toFixed(0)
    : '0';

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* HEADER & ACTION BUTTON */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-serif text-content-base font-semibold tracking-tight flex items-center gap-2">
            <span>Gestão de Estoque & Produtos</span>
            <span className="text-[10px] bg-gold-base/15 text-gold-hover border border-[#FFFFFF]/30 px-2 py-0.5 rounded-full uppercase font-bold">
              {products.length} itens
            </span>
          </h1>
          <p className="text-content-muted text-xs mt-0.5">
            Controle entradas/saídas, margens de lucro, comissões de venda e alertas de estoque baixo
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="bg-gold-base text-surface-base px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 hover:bg-gold-base/80 transition-all shadow-md active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Produto</span>
        </button>
      </div>

      {/* SUCCESS NOTIFICATION */}
      {successMsg && (
        <div className="bg-status-success/10 border border-status-success/30 text-status-success p-3 rounded-xl flex items-center gap-2 text-xs font-bold animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* KPI METRICS GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-content-muted mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Itens no Estoque</span>
            <div className="w-6 h-6 rounded-lg bg-gold-base/10 text-gold-hover flex items-center justify-center">
              <Package className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-mono num-tabular text-content-base font-semibold">{totalItems} <span className="text-xs text-content-muted font-normal">unidades</span></p>
          <p className="text-[9px] text-content-muted mt-1 font-medium truncate">{products.length} produtos cadastrados</p>
        </div>

        <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-content-muted mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Valor em Estoque</span>
            <div className="w-6 h-6 rounded-lg bg-status-success/10 text-status-success flex items-center justify-center">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-black text-status-success">R$ {totalStockValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          <p className="text-[9px] text-content-muted mt-1 font-medium truncate">Preço total de venda</p>
        </div>

        <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-content-muted mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Estoque Baixo</span>
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${lowStockCount > 0 ? 'bg-amber-500/10 text-amber-400' : 'bg-gray-500/10 text-gray-400'}`}>
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className={`text-lg font-black ${lowStockCount > 0 ? 'text-amber-400' : 'text-content-base'}`}>{lowStockCount}</p>
          <p className="text-[9px] text-content-muted mt-1 font-medium truncate">Abaixo do limite mínimo</p>
        </div>

        <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-content-muted mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Margem Média</span>
            <div className="w-6 h-6 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-black text-purple-400">{avgMargin}%</p>
          <p className="text-[9px] text-content-muted mt-1 font-medium truncate">Lucro sobre preço final</p>
        </div>
      </div>

      {/* LOW STOCK ALERT BANNER IF APPLICABLE */}
      {lowStockCount > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl flex items-center justify-between text-xs text-amber-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Atenção:</strong> Existem <strong>{lowStockCount} produto(s)</strong> com estoque igual ou abaixo do limite configurado.
            </span>
          </div>
        </div>
      )}

      {/* FILTER & SEARCH BAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-surface-card p-2.5 rounded-xl border border-border-subtle">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome ou marca..."
            className="w-full bg-surface-card border border-border-subtle rounded-xl pl-8 pr-3 py-1.5 text-xs text-content-base focus:outline-none focus:border-[#FFFFFF]"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-surface-card px-2.5 py-1 rounded-xl border border-border-subtle shrink-0">
            <Filter className="w-3 h-3 text-gold-hover" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-transparent text-[11px] text-content-base font-semibold outline-none cursor-pointer"
            >
              <option value="all" className="bg-surface-card text-content-base">Todas as Categorias</option>
              {categoriesList.map((cat) => (
                <option key={cat} value={cat} className="bg-surface-card text-content-base">{cat}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* MOBILE PRODUCTS CARDS FEED */}
      <div className="block md:hidden space-y-2.5">
        {loading ? (
          <div className="p-8 text-center bg-surface-card rounded-2xl border border-border-subtle text-content-muted text-xs">
            Carregando produtos...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-8 text-center bg-surface-card rounded-2xl border border-border-subtle text-content-muted text-xs">
            Nenhum produto encontrado.
          </div>
        ) : (
          filteredProducts.map((prod) => {
            const isLowStock = prod.stock_quantity <= prod.min_stock_alert;
            const profitMargin = prod.price > 0 ? (((prod.price - prod.cost_price) / prod.price) * 100).toFixed(0) : '0';

            return (
              <div key={prod.id} className="bg-surface-card border border-border-subtle rounded-2xl p-3.5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {prod.image_url ? (
                      <img
                        src={prod.image_url}
                        alt={prod.name}
                        className="w-10 h-10 rounded-xl object-cover border border-border-subtle shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-surface-card border border-border-subtle flex items-center justify-center text-gold-hover shrink-0">
                        <Package className="w-5 h-5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <h4 className="font-serif text-content-base font-semibold text-xs truncate">{prod.name}</h4>
                      <p className="text-[10px] text-content-muted truncate">{prod.brand} • <span className="text-gold-hover">{prod.category}</span></p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleOpenEdit(prod)}
                      className="p-1.5 rounded-lg bg-surface-card text-content-muted hover:text-content-base border border-border-subtle"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(prod.id, prod.name)}
                      className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-surface-card p-2.5 rounded-xl border border-border-subtle text-center">
                  <div>
                    <span className="text-[9px] text-content-muted font-bold uppercase block">Venda</span>
                    <span className="text-xs font-mono num-tabular text-content-base font-semibold">R$ {prod.price.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-content-muted font-bold uppercase block">Margem</span>
                    <span className="text-xs font-black text-status-success">{profitMargin}%</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-content-muted font-bold uppercase block">Comissão</span>
                    <span className="text-xs font-black text-gold-hover">{prod.commission_percentage}%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-[#1C1C1C]">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-extrabold ${isLowStock ? 'text-amber-400' : 'text-content-base'}`}>
                      Estoque: {prod.stock_quantity} un.
                    </span>
                    {isLowStock && (
                      <span className="text-[9px] bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded font-bold">Baixo</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleAdjustStock(prod, -1)}
                      className="w-7 h-7 rounded-lg bg-surface-card text-content-base font-bold text-xs flex items-center justify-center border border-border-subtle active:scale-95"
                    >
                      -
                    </button>
                    <button
                      onClick={() => handleAdjustStock(prod, 1)}
                      className="w-7 h-7 rounded-lg bg-surface-card text-content-base font-bold text-xs flex items-center justify-center border border-border-subtle active:scale-95"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* PRODUCTS DESKTOP TABLE */}
      <div className="hidden md:block bg-surface-card border border-border-subtle rounded-2xl overflow-hidden p-1 shadow-lg">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-surface-base text-content-muted border-b border-border-subtle">
              <tr>
                <th className="p-3 font-bold uppercase text-[10px]">Produto & Marca</th>
                <th className="p-3 font-bold uppercase text-[10px]">Categoria</th>
                <th className="p-3 font-bold uppercase text-[10px]">Estoque</th>
                <th className="p-3 font-bold uppercase text-[10px]">Custo Unit.</th>
                <th className="p-3 font-bold uppercase text-[10px]">Preço Venda</th>
                <th className="p-3 font-bold uppercase text-[10px] text-center">Margem</th>
                <th className="p-3 font-bold uppercase text-[10px] text-center">Comissão</th>
                <th className="p-3 font-bold uppercase text-[10px] text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-content-muted">
                    Carregando produtos...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-content-muted">
                    Nenhum produto encontrado.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((prod) => {
                  const isLowStock = prod.stock_quantity <= prod.min_stock_alert;
                  const profitMargin = prod.price > 0 ? (((prod.price - prod.cost_price) / prod.price) * 100).toFixed(0) : '0';

                  return (
                    <tr key={prod.id} className="hover:bg-surface-card transition-colors group">
                      {/* PRODUCT & BRAND */}
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          {prod.image_url ? (
                            <img
                              src={prod.image_url}
                              alt={prod.name}
                              className="w-8 h-8 rounded-lg object-cover border border-border-subtle group-hover:border-[#FFFFFF] transition-colors shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-surface-card border border-border-subtle flex items-center justify-center text-gold-hover shrink-0">
                              <Package className="w-4 h-4" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="font-bold text-content-base text-xs block group-hover:text-gold-hover transition-colors truncate">
                              {prod.name}
                            </span>
                            <span className="text-[10px] text-content-muted block truncate">
                              Marca: {prod.brand}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* CATEGORY */}
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-md bg-surface-card text-gold-hover text-[10px] font-semibold border border-border-subtle">
                          {prod.category}
                        </span>
                      </td>

                      {/* STOCK CONTROL */}
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div>
                            <span className={`text-xs font-bold block ${isLowStock ? 'text-amber-400' : 'text-content-base'}`}>
                              {prod.stock_quantity} un.
                            </span>
                            <span className={`text-[9px] font-medium block ${isLowStock ? 'text-amber-400' : 'text-status-success'}`}>
                              {isLowStock ? `Baixo (≤${prod.min_stock_alert})` : 'Normal'}
                            </span>
                          </div>

                          <div className="flex items-center gap-0.5 ml-1">
                            <button
                              onClick={() => handleAdjustStock(prod, -1)}
                              className="w-5 h-5 rounded bg-surface-card hover:bg-surface-card text-content-base font-bold text-xs flex items-center justify-center border border-border-subtle active:scale-95"
                              title="Diminuir 1"
                            >
                              -
                            </button>
                            <button
                              onClick={() => handleAdjustStock(prod, 1)}
                              className="w-5 h-5 rounded bg-surface-card hover:bg-surface-card text-content-base font-bold text-xs flex items-center justify-center border border-border-subtle active:scale-95"
                              title="Aumentar 1"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* COST */}
                      <td className="p-3 text-content-muted font-medium">
                        R$ {prod.cost_price.toFixed(2)}
                      </td>

                      {/* PRICE */}
                      <td className="p-3 font-bold text-content-base">
                        R$ {prod.price.toFixed(2)}
                      </td>

                      {/* MARGIN */}
                      <td className="p-3 text-center">
                        <span className="px-1.5 py-0.5 rounded bg-status-success/15 text-status-success text-[10px] font-bold">
                          {profitMargin}%
                        </span>
                      </td>

                      {/* COMMISSION */}
                      <td className="p-3 text-center">
                        <span className="text-gold-hover font-bold text-xs">
                          {prod.commission_percentage}%
                        </span>
                      </td>

                      {/* ACTIONS */}
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(prod)}
                            className="p-1.5 rounded-lg bg-surface-card text-content-muted hover:text-content-base border border-border-subtle"
                            title="Editar"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(prod.id, prod.name)}
                            className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-surface-base/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4">
          <div className="bg-surface-card border border-border-subtle sm:border-[#FFFFFF]/30 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col animate-fade-in">
            <div className="p-3.5 bg-surface-base border-b border-border-subtle flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gold-base/10 text-gold-hover flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <h2 className="text-xs font-bold text-content-base">
                  {editingProduct ? 'Editar Produto' : 'Novo Produto no Estoque'}
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-surface-card text-content-muted hover:text-content-base flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-3 text-xs max-h-[80vh] overflow-y-auto">
              <div>
                <label className="text-[10px] font-bold text-content-muted uppercase block mb-1">
                  Nome do Produto *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Pomada Efeito Matte BarberX"
                  className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-[#FFFFFF]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-content-muted uppercase block mb-1">
                    Categoria
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="Finalizadores, Barba..."
                    className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-[#FFFFFF]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-content-muted uppercase block mb-1">
                    Marca / Linha
                  </label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="BarberX Pro"
                    className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-[#FFFFFF]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-content-muted uppercase block mb-1">
                    Preço Venda (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                    placeholder="45.00"
                    className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-[#FFFFFF]"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-content-muted uppercase block mb-1">
                    Custo Unitário (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.cost_price}
                    onChange={(e) => setFormData({ ...formData, cost_price: Number(e.target.value) })}
                    placeholder="20.00"
                    className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-[#FFFFFF]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-content-muted uppercase block mb-1">
                    Estoque *
                  </label>
                  <input
                    type="number"
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData({ ...formData, stock_quantity: Number(e.target.value) })}
                    placeholder="25"
                    className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-[#FFFFFF]"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-content-muted uppercase block mb-1">
                    Alerta Mín.
                  </label>
                  <input
                    type="number"
                    value={formData.min_stock_alert}
                    onChange={(e) => setFormData({ ...formData, min_stock_alert: Number(e.target.value) })}
                    placeholder="5"
                    className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-[#FFFFFF]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-content-muted uppercase block mb-1">
                    Comissão (%)
                  </label>
                  <input
                    type="number"
                    value={formData.commission_percentage}
                    onChange={(e) => setFormData({ ...formData, commission_percentage: Number(e.target.value) })}
                    placeholder="15"
                    className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-[#FFFFFF]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-content-muted uppercase block mb-1">
                  URL da Imagem
                </label>
                <input
                  type="url"
                  value={formData.image_url || ''}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-content-base focus:outline-none focus:border-[#FFFFFF]"
                />
              </div>

              <div className="pt-3 border-t border-border-subtle flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl bg-surface-card text-content-muted hover:text-content-base text-xs font-bold"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-gold-base text-surface-base text-xs font-extrabold flex items-center gap-1.5 shadow hover:bg-gold-base/80"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Salvar Produto</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

