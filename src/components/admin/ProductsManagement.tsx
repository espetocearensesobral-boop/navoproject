import React, { useEffect, useMemo, useState } from"react";
import { showToast } from "../ui/Toast";
import {
 AlertTriangle,
 Boxes,
 ChevronDown,
 ChevronUp,
 DollarSign,
 Edit3,
 Package,
 Plus,
 Search,
 Trash2,
 X,
} from"lucide-react";
import { ProductItem } from"../../types";
import {
 deleteProductInSupabase,
 fetchProductsFromSupabase,
 saveProductInSupabase,
} from"../../services/supabaseDataService";
import { AdminPageHeader } from"./shared/AdminPageHeader";
import { AdminFab } from"./shared/AdminFab";
import { AdminModalV2 } from"./shared/AdminModalV2";
import { handleEnterAsTab } from"../../utils/formUtils";

const defaultProduct: ProductItem = {
 id:"",
 name:"",
 category:"Produto",
 brand:"",
 price: 0,
 cost_price: 0,
 stock_quantity: 0,
 min_stock_alert: 5,
 commission_percentage: 0,
 image_url:"",
};

const money = (value: number) =>
 value.toLocaleString("pt-BR", { style:"currency", currency:"BRL"});

export const ProductsManagement: React.FC = () => {
 const [products, setProducts] = useState<ProductItem[]>([]);
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [toast, setToast] = useState<string | null>(null);
 const [search, setSearch] = useState("");
 const [onlyLowStock, setOnlyLowStock] = useState(false);
 const [categoryFilter, setCategoryFilter] = useState("all");
 const [editingProduct, setEditingProduct] = useState<ProductItem | null>(
 null,
 );
 const [expandedProductId, setExpandedProductId] = useState<string | null>(
 null,
 );
 const [isModalOpen, setIsModalOpen] = useState(false);
 const [form, setForm] = useState<ProductItem>(defaultProduct);

 const loadProducts = async () => {
 setLoading(true);
 setError(null);
 try {
 setProducts(await fetchProductsFromSupabase({ strict: true }));
 } catch (err: any) {
 setProducts([]);
 setError(err?.message ||"Não foi possível carregar o estoque real.");
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 loadProducts();
 const handleRefresh = () => loadProducts();
 window.addEventListener("adminRefresh", handleRefresh);
 return () => window.removeEventListener("adminRefresh", handleRefresh);
 }, []);

 const categories = useMemo(() => {
 const values = new Set<string>(
 products.map((product) => product.category).filter(Boolean),
 );
 values.add("Produto");
 return Array.from(values).sort((a, b) => a.localeCompare(b,"pt-BR"));
 }, [products]);

 const lowStockCount = products.filter(
 (product) => product.stock_quantity <= product.min_stock_alert,
 ).length;
 const filteredProducts = products.filter((product) => {
 const query = search.trim().toLowerCase();
 const matchesQuery =
 !query ||
 [product.name, product.brand, product.category].some((value) =>
 value.toLowerCase().includes(query),
 );
 const matchesStock =
 !onlyLowStock || product.stock_quantity <= product.min_stock_alert;
 const matchesCategory =
 categoryFilter ==="all"|| product.category === categoryFilter;
 return matchesQuery && matchesStock && matchesCategory;
 });

 
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

 const updateForm = <K extends keyof ProductItem>(
 key: K,
 value: ProductItem[K],
 ) => {
 setForm((previous) => ({ ...previous, [key]: value }));
 };

 const handleSave = async (event: React.FormEvent) => {
 event.preventDefault();
 if (!form.name.trim() || !form.category.trim() || !form.brand.trim()) {
 setError("Preencha nome, categoria e marca.");
 return;
 }
 if (
 form.price < 0 ||
 form.cost_price < 0 ||
 form.stock_quantity < 0 ||
 form.min_stock_alert < 0
 ) {
 setError("Preço, custo e estoque não podem ser negativos.");
 return;
 }

 setSaving(true);
 setError(null);
 try {
 const updated = await saveProductInSupabase(
 {
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
 },
 Boolean(editingProduct),
 );
 setProducts(updated);
 setEditingProduct(null);
 setIsModalOpen(false);
 showToast(
 editingProduct
 ?"Produto atualizado no estoque."
 :"Produto criado no estoque.",
 );
 } catch (err: any) {
 setError(err?.message ||"Não foi possível salvar o produto.");
 } finally {
 setSaving(false);
 }
 };

 const handleDelete = async (product: ProductItem) => {
 if (!window.confirm(`Excluir ${product.name} do catálogo de produtos?`))
 return;
 try {
 setProducts(await deleteProductInSupabase(product.id));
 showToast("Produto removido do estoque.");
 } catch (err: any) {
 setError(err?.message ||"Não foi possível excluir o produto.");
 }
 };

 return (
 <div className="space-y-4 animate-fade-in text-[var(--admin-text-main)] min-w-0">
 <AdminPageHeader
 icon={Package}
 title="Produtos"
 stats={[
 { label:"produtos", value: products.length, tone:"gold"},
 {
 label:"baixo estoque",
 value: lowStockCount,
 tone: lowStockCount > 0 ?"warning":"success",
 },
 ]}
 />

 
 {error && (
 <div className="rounded-[var(--admin-radius-lg)] border border-status-error/30 bg-status-error/10 p-3 text-xs font-semibold text-status-error flex items-center justify-between gap-3">
 <span>{error}</span>
 <button
 type="button"
 onClick={() => setError(null)}
 aria-label="Fechar aviso"
 >
 <X className="w-4 h-4"/>
 </button>
 </div>
 )}

 {/* MOBILE SEARCH + FILTERS */}
 <div className="md:hidden space-y-2">
 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--admin-text-muted)]"/>
 <input
 value={search}
 onChange={(event) => setSearch(event.target.value)}
 placeholder="Produto, marca ou categoria"
 className="w-full h-10 rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] bg-[var(--admin-surface)] pl-9 pr-3 text-sm text-[var(--admin-text-main)] outline-none focus:border-[var(--admin-accent)]"
 />
 </div>
 <div
 data-gesture-scroll="horizontal"
 className="admin-category-scroll flex items-center gap-2 overflow-x-auto no-scrollbar pb-1"
 >
 <button
 type="button"
 onClick={() => {
 setCategoryFilter("all");
 setOnlyLowStock(false);
 }}
 className={`shrink-0 min-h-11 px-4 py-2 rounded-[var(--admin-radius-full)] text-sm font-semibold whitespace-nowrap transition-colors ${categoryFilter ==="all"&& !onlyLowStock ?"bg-[var(--admin-accent)] text-[var(--admin-accent-text)]":"bg-[var(--admin-surface)] text-[var(--admin-text-muted)] border border-[var(--admin-border)]"}`}
 >
 Todos ({products.length})
 </button>
 {categories.map((category) => (
 <button
 key={category}
 type="button"
 onClick={() => {
 setCategoryFilter(category);
 setOnlyLowStock(false);
 }}
 className={`shrink-0 min-h-11 px-4 py-2 rounded-[var(--admin-radius-full)] text-sm font-semibold whitespace-nowrap transition-colors ${categoryFilter === category && !onlyLowStock ?"bg-[var(--admin-accent)] text-[var(--admin-accent-text)]":"bg-[var(--admin-surface)] text-[var(--admin-text-muted)] border border-[var(--admin-border)]"}`}
 >
 {category}
 </button>
 ))}
 <button
 type="button"
 onClick={() => setOnlyLowStock((value) => !value)}
 className={`shrink-0 min-h-11 px-4 py-2 rounded-[var(--admin-radius-full)] text-sm font-semibold whitespace-nowrap flex items-center gap-1.5 transition-colors ${onlyLowStock ?"bg-amber-500 text-amber-950":"bg-[var(--admin-surface)] text-[var(--admin-text-muted)] border border-[var(--admin-border)]"}`}
 >
 <AlertTriangle className="w-3.5 h-3.5"/> Baixo estoque (
 {lowStockCount})
 </button>
 </div>
 </div>

 {/* DESKTOP SEARCH + FILTERS; atualização ocorre pelo pull-to-refresh global */}
 <div className="hidden md:flex flex-col sm:flex-row gap-2">
 <div className="relative flex-1">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--admin-text-muted)]"/>
 <input
 value={search}
 onChange={(event) => setSearch(event.target.value)}
 placeholder="Produto, marca ou categoria"
 className="w-full h-10 rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] bg-[var(--admin-surface)] pl-9 pr-3 text-xs text-[var(--admin-text-main)] outline-none focus:border-[var(--admin-accent)]"
 />
 </div>
 <button
 type="button"
 onClick={() => setOnlyLowStock((value) => !value)}
 className={`h-10 px-3 rounded-[var(--admin-radius-lg)] border text-xs font-semibold flex items-center justify-center gap-2 ${onlyLowStock ?"border-status-warning/30 bg-status-warning/10 text-status-warning":"border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-text-muted)]"}`}
 >
 <AlertTriangle className="w-3.5 h-3.5"/> Baixo estoque (
 {lowStockCount})
 </button>
 </div>

 {loading ? (
 <div className="rounded-[var(--admin-radius-xl)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-10 text-center text-xs text-[var(--admin-text-muted)]">
 Carregando estoque...
 </div>
 ) : filteredProducts.length === 0 ? (
 <div className="rounded-[var(--admin-radius-xl)] border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] p-10 text-center text-xs text-[var(--admin-text-muted)]">
 Nenhum produto encontrado.
 </div>
 ) : (
 <div className="admin-table-container">
 {/* DESKTOP TABLE VIEW */}
 <div className="hidden md:block">
 <table className="admin-table">
 <thead>
 <tr>
 <th className="w-12">Img</th>
 <th>Produto</th>
 <th>Categoria / Marca</th>
 <th>Preço / Custo</th>
 <th>Estoque / Alerta</th>
 <th>Comissão</th>
 <th className="text-right">Ações</th>
 </tr>
 </thead>
 <tbody>
 {filteredProducts.map((product) => {
 const isLowStock = product.stock_quantity <= product.min_stock_alert;
 return (
 <tr key={product.id}>
 <td>
 <div className="w-10 h-10 rounded border border-[var(--admin-border)] bg-[var(--admin-bg)] flex items-center justify-center overflow-hidden">
 {product.image_url ? (
 <img src={product.image_url} alt=""className="w-full h-full object-cover"/>
 ) : (
 <Package className="w-5 h-5 text-[var(--admin-text-muted)]"/>
 )}
 </div>
 </td>
 <td className="font-bold text-[var(--admin-text-main)]">
 {product.name}
 {isLowStock && (
 <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] bg-status-warning/10 text-status-warning border border-status-warning/20 uppercase tracking-wider font-bold">
 Baixo
 </span>
 )}
 </td>
 <td className="text-[var(--admin-text-muted)]">
 <div className="text-xs font-bold text-[var(--admin-accent)] uppercase tracking-wider">{product.category}</div>
 <div className="text-xs mt-0.5">{product.brand}</div>
 </td>
 <td>
 <div className="font-mono font-bold text-[var(--admin-text-main)]">{money(product.price)}</div>
 <div className="font-mono text-xs text-status-error">Custo: {money(product.cost_price)}</div>
 </td>
 <td>
 <div className={`font-bold ${isLowStock ?"text-status-warning":"text-[var(--admin-text-main)]"}`}>
 {product.stock_quantity} un.
 </div>
 <div className="text-xs text-[var(--admin-text-muted)]">Mín: {product.min_stock_alert}</div>
 </td>
 <td className="text-[var(--admin-text-main)] font-mono">
 {product.commission_percentage}%
 </td>
 <td>
 <div className="flex items-center justify-end gap-2">
 <button
 type="button"
 onClick={() => openEdit(product)}
 className="admin-btn-icon-sm rounded text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-surface)]"
 title="Editar"
 >
 <Edit3 className="w-4 h-4"/>
 </button>
 <button
 type="button"
 onClick={() => handleDelete(product)}
 className="admin-btn-icon-sm rounded text-[var(--admin-text-muted)] hover:text-status-error hover:bg-status-error/10"
 title="Excluir"
 >
 <Trash2 className="w-4 h-4"/>
 </button>
 </div>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>

 {/* MOBILE LIST VIEW */}
 <div className="md:hidden divide-y divide-[var(--admin-border)]">
 {filteredProducts.map((product) => {
 const isLowStock = product.stock_quantity <= product.min_stock_alert;
 const isExpanded = expandedProductId === product.id;
 return (
 <article key={product.id} className="bg-[var(--admin-surface)] overflow-hidden transition-colors">
 <button
 type="button"
 onClick={() => setExpandedProductId(isExpanded ? null : product.id)}
 aria-expanded={isExpanded}
 className="w-full min-h-[76px] p-3.5 text-left flex items-center gap-3 hover:bg-[var(--admin-bg)]/40"
 >
 <div className="w-11 h-11 rounded-[var(--admin-radius-lg)] bg-[var(--admin-bg)] border border-[var(--admin-border)] overflow-hidden flex items-center justify-center shrink-0">
 {product.image_url ? (
 <img src={product.image_url} alt=""className="w-full h-full object-cover"/>
 ) : (
 <Package className="w-5 h-5 text-[var(--admin-accent)]/70"/>
 )}
 </div>
 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-2 min-w-0">
 <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--admin-accent)] admin-clamp-2">
 {product.category}
 </p>
 {isLowStock && (
 <span className="shrink-0 rounded px-1.5 py-0.5 bg-status-warning/10 text-status-warning border border-status-warning/20 text-[10px] font-bold uppercase tracking-wider">
 Baixo
 </span>
 )}
 </div>
 <h2 className="mt-0.5 text-sm font-bold text-[var(--admin-text-main)] admin-clamp-2">
 {product.name}
 </h2>
 <p className="text-xs text-[var(--admin-text-muted)] admin-safe-wrap">
 {product.brand}
 </p>
 </div>
 <div className="text-right shrink-0 min-w-[58px]">
 <p className="text-[10px] uppercase tracking-wider text-[var(--admin-text-muted)]">
 Estoque
 </p>
 <p className={`text-sm font-bold mt-0.5 ${isLowStock ?"text-status-warning":"text-status-success"}`}>
 {product.stock_quantity}
 </p>
 </div>
 {isExpanded ? (
 <ChevronUp className="w-4 h-4 text-[var(--admin-accent)] shrink-0 ml-1"/>
 ) : (
 <ChevronDown className="w-4 h-4 text-[var(--admin-text-muted)] shrink-0 ml-1"/>
 )}
 </button>
 {isExpanded && (
 <div className="border-t border-[var(--admin-border)] bg-[var(--admin-bg)]/35 p-3.5 space-y-3">
 <div className="grid grid-cols-2 gap-3 text-xs">
 <div>
 <p className="text-[10px] uppercase tracking-wider text-[var(--admin-text-muted)]">Preço</p>
 <p className="font-bold font-mono text-[var(--admin-text-main)] mt-0.5">{money(product.price)}</p>
 </div>
 <div>
 <p className="text-[10px] uppercase tracking-wider text-[var(--admin-text-muted)]">Custo</p>
 <p className="font-bold font-mono text-status-error mt-0.5">{money(product.cost_price)}</p>
 </div>
 <div>
 <p className="text-[10px] uppercase tracking-wider text-[var(--admin-text-muted)]">Alerta min.</p>
 <p className="font-bold text-[var(--admin-text-main)] mt-0.5">{product.min_stock_alert} un.</p>
 </div>
 <div>
 <p className="text-[10px] uppercase tracking-wider text-[var(--admin-text-muted)]">Comissão</p>
 <p className="font-bold text-[var(--admin-text-main)] mt-0.5">{product.commission_percentage}%</p>
 </div>
 </div>
 <div className="flex gap-2 pt-2 border-t border-[var(--admin-border)]">
 <button
 type="button"
 onClick={() => openEdit(product)}
 className="flex-1 min-h-10 rounded-[var(--admin-radius-md)] border border-[var(--admin-border)] text-[var(--admin-text-main)] hover:bg-[var(--admin-surface)] text-xs font-bold flex items-center justify-center gap-1.5"
 >
 <Edit3 className="w-4 h-4"/> Editar
 </button>
 <button
 type="button"
 onClick={() => handleDelete(product)}
 className="w-10 h-10 shrink-0 rounded-[var(--admin-radius-md)] border border-status-error/25 text-status-error hover:bg-status-error/10 flex items-center justify-center"
 >
 <Trash2 className="w-4 h-4"/>
 </button>
 </div>
 </div>
 )}
 </article>
 );
 })}
 </div>
 </div>
 )}

 {isModalOpen ? (
 <AdminModalV2
 icon={Package}
 eyebrow="Estoque & Vendas"
 title={editingProduct ? `Editar Produto: ${editingProduct.name}` :"Novo Produto no Estoque"}
 subtitle={
 editingProduct
 ? `SKU / Identificador: ${editingProduct.id}`
 :"Cadastre cosméticos, pomadas, lâminas e produtos para venda no balcão e controle de estoque."
 }
 onClose={() => {
 setEditingProduct(null);
 setIsModalOpen(false);
 }}
 size="fullscreen"
 footer={
 <div className="flex items-center justify-between w-full">
 <button
 type="button"
 onClick={() => {
 setEditingProduct(null);
 setIsModalOpen(false);
 }}
 className="admin-btn admin-btn-secondary h-11 px-5 text-sm font-bold"
 >
 Cancelar
 </button>
 <button
 type="submit"
 form="product-form"
 disabled={saving}
 className="admin-btn admin-btn-primary h-11 px-6 text-sm font-bold disabled:opacity-50"
 >
 {saving ?"Salvando...":"Salvar Produto"}
 </button>
 </div>
 }
 >
 <form
 id="product-form"
 onKeyDown={handleEnterAsTab}
 onSubmit={handleSave}
 className="space-y-6"
 >
 {/* Section 1: Basic Info */}
 <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-xl)] p-6 sm:p-8 space-y-5 shadow-xs">
 <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--admin-accent)] flex items-center gap-2">
 <Package className="w-4 h-4"/>
 <span>1. Identificação do Produto</span>
 </h2>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
 <div className="md:col-span-2">
 <label className="block">
 <span className="block text-xs font-bold uppercase tracking-wider text-[var(--admin-text-muted)] mb-2">
 Nome do Produto *
 </span>
 <input
 required
 autoFocus
 value={form.name}
 onChange={(event) => updateForm("name", event.target.value)}
 placeholder="Ex: Pomada Modeladora Efeito Matte 150g"
 className="w-full h-11 rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] bg-[var(--admin-bg)] px-4 text-sm text-[var(--admin-text-main)] outline-none focus:border-[var(--admin-accent)] transition-colors font-medium"
 />
 </label>
 </div>

 <div>
 <label className="block">
 <span className="block text-xs font-bold uppercase tracking-wider text-[var(--admin-text-muted)] mb-2">
 Marca / Fabricante *
 </span>
 <input
 required
 value={form.brand}
 onChange={(event) => updateForm("brand", event.target.value)}
 placeholder="Ex: BarberX Professional"
 className="w-full h-11 rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] bg-[var(--admin-bg)] px-4 text-sm text-[var(--admin-text-main)] outline-none focus:border-[var(--admin-accent)] transition-colors"
 />
 </label>
 </div>

 <div>
 <label className="block">
 <span className="block text-xs font-bold uppercase tracking-wider text-[var(--admin-text-muted)] mb-2">
 Categoria *
 </span>
 <select
 value={form.category}
 onChange={(event) =>
 updateForm("category", event.target.value)
 }
 className="w-full h-11 rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] bg-[var(--admin-bg)] px-4 text-sm text-[var(--admin-text-main)] outline-none focus:border-[var(--admin-accent)] transition-colors"
 >
 {categories.map((category) => (
 <option key={category} value={category}>
 {category}
 </option>
 ))}
 </select>
 </label>
 </div>

 <div className="md:col-span-2">
 <label className="block">
 <span className="block text-xs font-bold uppercase tracking-wider text-[var(--admin-text-muted)] mb-2">
 URL da Imagem do Produto (Opcional)
 </span>
 <div className="flex items-center gap-3">
 <div className="w-11 h-11 rounded-[var(--admin-radius-lg)] bg-[var(--admin-bg)] border border-[var(--admin-border)] overflow-hidden flex items-center justify-center shrink-0">
 {form.image_url ? (
 <img src={form.image_url} alt="Preview"className="w-full h-full object-cover"/>
 ) : (
 <Package className="w-5 h-5 text-[var(--admin-text-muted)]"/>
 )}
 </div>
 <input
 type="url"
 value={form.image_url ||""}
 onChange={(event) =>
 updateForm("image_url", event.target.value)
 }
 placeholder="https://exemplo.com/fotos/pomada.jpg"
 className="w-full h-11 rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] bg-[var(--admin-bg)] px-4 text-sm text-[var(--admin-text-main)] outline-none focus:border-[var(--admin-accent)] transition-colors"
 />
 </div>
 </label>
 </div>
 </div>
 </div>

 {/* Section 2: Pricing & Commissions */}
 <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-xl)] p-6 sm:p-8 space-y-5 shadow-xs">
 <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--admin-accent)] flex items-center gap-2">
 <DollarSign className="w-4 h-4"/>
 <span>2. Precificação & Margem de Lucro</span>
 </h2>

 <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
 <div>
 <label className="block">
 <span className="block text-xs font-bold uppercase tracking-wider text-[var(--admin-text-muted)] mb-2">
 Preço de Venda ao Cliente (R$) *
 </span>
 <input
 required
 type="number"
 min="0"
 step="0.01"
 value={form.price}
 onChange={(event) =>
 updateForm("price", Number(event.target.value))
 }
 className="w-full h-11 rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] bg-[var(--admin-bg)] px-4 text-base font-mono font-bold text-status-success outline-none focus:border-[var(--admin-accent)] transition-colors"
 />
 </label>
 </div>

 <div>
 <label className="block">
 <span className="block text-xs font-bold uppercase tracking-wider text-[var(--admin-text-muted)] mb-2">
 Preço de Custo / Compra (R$)
 </span>
 <input
 type="number"
 min="0"
 step="0.01"
 value={form.cost_price}
 onChange={(event) =>
 updateForm("cost_price", Number(event.target.value))
 }
 className="w-full h-11 rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] bg-[var(--admin-bg)] px-4 text-base font-mono text-status-error outline-none focus:border-[var(--admin-accent)] transition-colors"
 />
 </label>
 </div>

 <div>
 <label className="block">
 <span className="block text-xs font-bold uppercase tracking-wider text-[var(--admin-text-muted)] mb-2">
 Comissão do Barbeiro (%)
 </span>
 <div className="relative">
 <input
 type="number"
 min="0"
 max="100"
 step="1"
 value={form.commission_percentage}
 onChange={(event) =>
 updateForm(
"commission_percentage",
 Number(event.target.value),
 )
 }
 className="w-full h-11 rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] bg-[var(--admin-bg)] px-4 text-base font-mono font-bold text-[var(--admin-text-main)] outline-none focus:border-[var(--admin-accent)] transition-colors"
 />
 <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-[var(--admin-text-muted)]">
 %
 </span>
 </div>
 </label>
 </div>
 </div>

 {/* Profit simulator */}
 {form.price > 0 && (
 <div className="p-4 bg-[var(--admin-bg)] rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] flex flex-col sm:flex-row items-center justify-between gap-4">
 <div>
 <span className="text-xs text-[var(--admin-text-muted)] uppercase tracking-wider font-bold block">
 Margem Bruta por Unidade:
 </span>
 <span className="text-base font-bold text-[var(--admin-text-main)]">
 Lucro de R$ {(form.price - (form.cost_price || 0)).toFixed(2)} por produto vendido
 </span>
 </div>
 <div className="text-right">
 <span className="text-xs text-[var(--admin-text-muted)] uppercase tracking-wider font-bold block">
 Repasse Barbeiro:
 </span>
 <span className="text-base font-black text-status-success">
 R$ {((form.price * (form.commission_percentage || 0)) / 100).toFixed(2)} ({form.commission_percentage || 0}%)
 </span>
 </div>
 </div>
 )}
 </div>

 {/* Section 3: Stock Control */}
 <div className="bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-[var(--admin-radius-xl)] p-6 sm:p-8 space-y-5 shadow-xs">
 <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--admin-accent)] flex items-center gap-2">
 <Boxes className="w-4 h-4"/>
 <span>3. Gestão e Controle de Estoque</span>
 </h2>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
 <div>
 <label className="block">
 <span className="block text-xs font-bold uppercase tracking-wider text-[var(--admin-text-muted)] mb-2">
 Quantidade Atual em Estoque (Unidades) *
 </span>
 <input
 required
 type="number"
 min="0"
 step="1"
 value={form.stock_quantity}
 onChange={(event) =>
 updateForm("stock_quantity", Number(event.target.value))
 }
 className="w-full h-11 rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] bg-[var(--admin-bg)] px-4 text-base font-bold text-[var(--admin-text-main)] outline-none focus:border-[var(--admin-accent)] transition-colors"
 />
 </label>
 </div>

 <div>
 <label className="block">
 <span className="block text-xs font-bold uppercase tracking-wider text-[var(--admin-text-muted)] mb-2">
 Alerta de Estoque Mínimo (Reposição) *
 </span>
 <input
 required
 type="number"
 min="0"
 step="1"
 value={form.min_stock_alert}
 onChange={(event) =>
 updateForm("min_stock_alert", Number(event.target.value))
 }
 className="w-full h-11 rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] bg-[var(--admin-bg)] px-4 text-base text-[var(--admin-text-main)] outline-none focus:border-[var(--admin-accent)] transition-colors"
 />
 </label>
 </div>
 </div>
 </div>
 </form>
 </AdminModalV2>
 ) : null}

 <AdminFab
 onClick={openCreate}
 label="Novo Produto"
 icon={Plus}
 />
 </div>
 );
};

export default ProductsManagement;
