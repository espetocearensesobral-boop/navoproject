import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Edit3, Package, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { ProductItem } from '../../types';
import {
  deleteProductInSupabase,
  fetchProductsFromSupabase,
  saveProductInSupabase,
} from '../../services/supabaseDataService';
import { AdminPageHeader } from './shared/AdminPageHeader';

const defaultProduct: ProductItem = {
  id: '',
  name: '',
  category: 'Produto',
  brand: '',
  price: 0,
  cost_price: 0,
  stock_quantity: 0,
  min_stock_alert: 5,
  commission_percentage: 0,
  image_url: '',
};

const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const ProductsManagement: React.FC = () => {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<ProductItem>(defaultProduct);

  const loadProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      setProducts(await fetchProductsFromSupabase({ strict: true }));
    } catch (err: any) {
      setProducts([]);
      setError(err?.message || 'Não foi possível carregar o estoque real.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
    const handleRefresh = () => loadProducts();
    window.addEventListener('adminRefresh', handleRefresh);
    return () => window.removeEventListener('adminRefresh', handleRefresh);
  }, []);

  const categories = useMemo(() => {
    const values = new Set<string>(products.map((product) => product.category).filter(Boolean));
    values.add('Produto');
    return Array.from(values).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [products]);

  const lowStockCount = products.filter((product) => product.stock_quantity <= product.min_stock_alert).length;
  const filteredProducts = products.filter((product) => {
    const query = search.trim().toLowerCase();
    const matchesQuery = !query || [product.name, product.brand, product.category].some((value) => value.toLowerCase().includes(query));
    const matchesStock = !onlyLowStock || product.stock_quantity <= product.min_stock_alert;
    return matchesQuery && matchesStock;
  });

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3500);
  };

  const openCreate = () => {
    setEditingProduct(null);
    setForm({ ...defaultProduct });
    setIsModalOpen(true);
  };

  const openEdit = (product: ProductItem) => {
    setEditingProduct(product);
    setForm({ ...product });
    setIsModalOpen(true);
  };

  const updateForm = <K extends keyof ProductItem>(key: K, value: ProductItem[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || !form.category.trim() || !form.brand.trim()) {
      setError('Preencha nome, categoria e marca.');
      return;
    }
    if (form.price < 0 || form.cost_price < 0 || form.stock_quantity < 0 || form.min_stock_alert < 0) {
      setError('Preço, custo e estoque não podem ser negativos.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updated = await saveProductInSupabase({
        ...form,
        id: editingProduct?.id || `prod_${Date.now()}`,
        name: form.name.trim(),
        category: form.category.trim(),
        brand: form.brand.trim(),
        price: Number(form.price),
        cost_price: Number(form.cost_price),
        stock_quantity: Math.trunc(Number(form.stock_quantity)),
        min_stock_alert: Math.trunc(Number(form.min_stock_alert)),
        commission_percentage: Math.trunc(Number(form.commission_percentage)),
        image_url: form.image_url?.trim() || undefined,
      }, Boolean(editingProduct));
      setProducts(updated);
      setEditingProduct(null);
      setIsModalOpen(false);
      showToast(editingProduct ? 'Produto atualizado no estoque.' : 'Produto criado no estoque.');
    } catch (err: any) {
      setError(err?.message || 'Não foi possível salvar o produto.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (product: ProductItem) => {
    if (!window.confirm(`Excluir ${product.name} do catálogo de produtos?`)) return;
    try {
      setProducts(await deleteProductInSupabase(product.id));
      showToast('Produto removido do estoque.');
    } catch (err: any) {
      setError(err?.message || 'Não foi possível excluir o produto.');
    }
  };

  return (
    <div className="space-y-4 animate-fade-in text-content-base min-w-0">
      <AdminPageHeader
        icon={Package}
        title="Produtos & Estoque"
        stats={[
          { label: 'produtos', value: products.length, tone: 'gold' },
          { label: 'estoque baixo', value: lowStockCount, tone: lowStockCount > 0 ? 'warning' : 'success' },
        ]}
        action={{ label: 'Novo produto', onClick: openCreate, icon: Plus }}
      />

      <div className="md:hidden">
        <button type="button" onClick={openCreate} className="w-full h-10 rounded-xl bg-gold-base text-surface-base font-bold text-xs flex items-center justify-center gap-2 active:scale-95">
          <Plus className="w-4 h-4" /> Novo produto
        </button>
      </div>

      {toast && <div className="rounded-xl border border-status-success/30 bg-status-success/10 p-3 text-xs font-semibold text-status-success">{toast}</div>}
      {error && (
        <div className="rounded-xl border border-status-error/30 bg-status-error/10 p-3 text-xs font-semibold text-status-error flex items-center justify-between gap-3">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Fechar aviso"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar produto, marca ou categoria" className="w-full h-10 rounded-xl border border-border-subtle bg-surface-card pl-9 pr-3 text-xs text-content-base outline-none focus:border-gold-base" />
        </div>
        <button type="button" onClick={() => setOnlyLowStock((value) => !value)} className={`h-10 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 ${onlyLowStock ? 'border-amber-400/50 bg-amber-500/15 text-amber-300' : 'border-border-subtle bg-surface-card text-content-muted'}`}>
          <AlertTriangle className="w-3.5 h-3.5" /> Estoque baixo ({lowStockCount})
        </button>
        <button type="button" onClick={loadProducts} className="h-10 w-10 rounded-xl border border-border-subtle bg-surface-card text-content-muted flex items-center justify-center" aria-label="Atualizar estoque">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border-subtle bg-surface-card p-10 text-center text-xs text-content-muted">Carregando estoque real...</div>
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-subtle bg-surface-card p-10 text-center text-xs text-content-muted">Nenhum produto encontrado no estoque real.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredProducts.map((product) => {
            const isLowStock = product.stock_quantity <= product.min_stock_alert;
            return (
              <article key={product.id} className="rounded-2xl border border-border-subtle bg-surface-card p-4 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gold-base truncate">{product.category}</p>
                    <h2 className="mt-1 text-sm font-bold text-content-base truncate">{product.name}</h2>
                    <p className="text-[11px] text-content-muted truncate">{product.brand}</p>
                  </div>
                  {isLowStock && <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-1 text-[10px] font-bold text-amber-300">Baixo</span>}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-surface-base p-2"><p className="text-[10px] text-content-muted">Preço</p><p className="font-bold text-content-base">{money(product.price)}</p></div>
                  <div className="rounded-xl bg-surface-base p-2"><p className="text-[10px] text-content-muted">Estoque</p><p className={`font-bold ${isLowStock ? 'text-amber-300' : 'text-status-success'}`}>{product.stock_quantity} un.</p></div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => openEdit(product)} className="flex-1 h-9 rounded-xl border border-border-subtle text-content-muted hover:text-content-base text-xs font-semibold flex items-center justify-center gap-1.5"><Edit3 className="w-3.5 h-3.5" /> Editar</button>
                  <button type="button" onClick={() => handleDelete(product)} className="h-9 w-9 rounded-xl border border-status-error/25 text-status-error flex items-center justify-center" aria-label={`Excluir ${product.name}`}><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-border-subtle bg-surface-card p-4 sm:p-6 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div><h2 className="text-base font-bold text-content-base">{editingProduct ? 'Editar produto' : 'Novo produto'}</h2><p className="text-[11px] text-content-muted">Dados persistidos no catálogo do PDV.</p></div>
              <button type="button" onClick={() => { setEditingProduct(null); setIsModalOpen(false); }} className="h-9 w-9 rounded-xl text-content-muted flex items-center justify-center" aria-label="Fechar formulário"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-content-muted">Nome<input required value={form.name} onChange={(event) => updateForm('name', event.target.value)} className="mt-1 w-full h-10 rounded-xl border border-border-subtle bg-surface-base px-3 text-xs text-content-base outline-none focus:border-gold-base" /></label>
                <label className="text-xs font-semibold text-content-muted">Marca<input required value={form.brand} onChange={(event) => updateForm('brand', event.target.value)} className="mt-1 w-full h-10 rounded-xl border border-border-subtle bg-surface-base px-3 text-xs text-content-base outline-none focus:border-gold-base" /></label>
                <label className="text-xs font-semibold text-content-muted">Categoria<select value={form.category} onChange={(event) => updateForm('category', event.target.value)} className="mt-1 w-full h-10 rounded-xl border border-border-subtle bg-surface-base px-3 text-xs text-content-base outline-none focus:border-gold-base">{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
                <label className="text-xs font-semibold text-content-muted">Preço de venda<input required type="number" min="0" step="0.01" value={form.price} onChange={(event) => updateForm('price', Number(event.target.value))} className="mt-1 w-full h-10 rounded-xl border border-border-subtle bg-surface-base px-3 text-xs text-content-base outline-none focus:border-gold-base" /></label>
                <label className="text-xs font-semibold text-content-muted">Custo<input type="number" min="0" step="0.01" value={form.cost_price} onChange={(event) => updateForm('cost_price', Number(event.target.value))} className="mt-1 w-full h-10 rounded-xl border border-border-subtle bg-surface-base px-3 text-xs text-content-base outline-none focus:border-gold-base" /></label>
                <label className="text-xs font-semibold text-content-muted">Estoque atual<input required type="number" min="0" step="1" value={form.stock_quantity} onChange={(event) => updateForm('stock_quantity', Number(event.target.value))} className="mt-1 w-full h-10 rounded-xl border border-border-subtle bg-surface-base px-3 text-xs text-content-base outline-none focus:border-gold-base" /></label>
                <label className="text-xs font-semibold text-content-muted">Alerta mínimo<input required type="number" min="0" step="1" value={form.min_stock_alert} onChange={(event) => updateForm('min_stock_alert', Number(event.target.value))} className="mt-1 w-full h-10 rounded-xl border border-border-subtle bg-surface-base px-3 text-xs text-content-base outline-none focus:border-gold-base" /></label>
                <label className="text-xs font-semibold text-content-muted">Comissão (%)<input type="number" min="0" max="100" step="1" value={form.commission_percentage} onChange={(event) => updateForm('commission_percentage', Number(event.target.value))} className="mt-1 w-full h-10 rounded-xl border border-border-subtle bg-surface-base px-3 text-xs text-content-base outline-none focus:border-gold-base" /></label>
              </div>
              <label className="text-xs font-semibold text-content-muted">Imagem (URL opcional)<input type="url" value={form.image_url || ''} onChange={(event) => updateForm('image_url', event.target.value)} className="mt-1 w-full h-10 rounded-xl border border-border-subtle bg-surface-base px-3 text-xs text-content-base outline-none focus:border-gold-base" /></label>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => { setEditingProduct(null); setIsModalOpen(false); }} className="flex-1 h-10 rounded-xl border border-border-subtle text-content-muted text-xs font-semibold">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 h-10 rounded-xl bg-gold-base text-surface-base text-xs font-bold disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar produto'}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ProductsManagement;
