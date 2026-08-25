import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Edit3,
  Package,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { ProductItem } from "../../types";
import {
  deleteProductInSupabase,
  fetchProductsFromSupabase,
  saveProductInSupabase,
} from "../../services/supabaseDataService";
import { AdminPageHeader } from "./shared/AdminPageHeader";
import { AdminFab } from "./shared/AdminFab";
import { handleEnterAsTab } from "../../utils/formUtils";

const defaultProduct: ProductItem = {
  id: "",
  name: "",
  category: "Produto",
  brand: "",
  price: 0,
  cost_price: 0,
  stock_quantity: 0,
  min_stock_alert: 5,
  commission_percentage: 0,
  image_url: "",
};

const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
      setError(err?.message || "Não foi possível carregar o estoque real.");
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
    return Array.from(values).sort((a, b) => a.localeCompare(b, "pt-BR"));
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
      categoryFilter === "all" || product.category === categoryFilter;
    return matchesQuery && matchesStock && matchesCategory;
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
          ? "Produto atualizado no estoque."
          : "Produto criado no estoque.",
      );
    } catch (err: any) {
      setError(err?.message || "Não foi possível salvar o produto.");
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
      setError(err?.message || "Não foi possível excluir o produto.");
    }
  };

  return (
    <div className="space-y-4 animate-fade-in text-[var(--admin-text-main)] min-w-0">
      <AdminPageHeader
        icon={Package}
        title="Produtos"
        stats={[
          { label: "produtos", value: products.length, tone: "gold" },
          {
            label: "baixo estoque",
            value: lowStockCount,
            tone: lowStockCount > 0 ? "warning" : "success",
          },
        ]}
      />

      {toast && (
        <div className="rounded-xl border border-status-success/30 bg-status-success/10 p-3 text-xs font-semibold text-status-success">
          {toast}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-status-error/30 bg-status-error/10 p-3 text-xs font-semibold text-status-error flex items-center justify-between gap-3">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Fechar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* MOBILE SEARCH + FILTERS */}
      <div className="md:hidden space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--admin-text-muted)]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Produto, marca ou categoria"
            className="w-full h-10 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] pl-9 pr-3 text-sm text-[var(--admin-text-main)] outline-none focus:border-[var(--admin-accent)]"
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
            className={`shrink-0 min-h-11 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${categoryFilter === "all" && !onlyLowStock ? "bg-[var(--admin-accent)] text-[var(--admin-accent-text)]" : "bg-[var(--admin-surface)] text-[var(--admin-text-muted)] border border-[var(--admin-border)]"}`}
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
              className={`shrink-0 min-h-11 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${categoryFilter === category && !onlyLowStock ? "bg-[var(--admin-accent)] text-[var(--admin-accent-text)]" : "bg-[var(--admin-surface)] text-[var(--admin-text-muted)] border border-[var(--admin-border)]"}`}
            >
              {category}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setOnlyLowStock((value) => !value)}
            className={`shrink-0 min-h-11 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap flex items-center gap-1.5 transition-colors ${onlyLowStock ? "bg-amber-500 text-white" : "bg-[var(--admin-surface)] text-[var(--admin-text-muted)] border border-[var(--admin-border)]"}`}
          >
            <AlertTriangle className="w-3.5 h-3.5" /> Baixo estoque (
            {lowStockCount})
          </button>
        </div>
      </div>

      {/* DESKTOP SEARCH + FILTERS; atualização ocorre pelo pull-to-refresh global */}
      <div className="hidden md:flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--admin-text-muted)]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Produto, marca ou categoria"
            className="w-full h-10 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] pl-9 pr-3 text-xs text-[var(--admin-text-main)] outline-none focus:border-[var(--admin-accent)]"
          />
        </div>
        <button
          type="button"
          onClick={() => setOnlyLowStock((value) => !value)}
          className={`h-10 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 ${onlyLowStock ? "border-amber-400/50 bg-amber-500/15 text-amber-300" : "border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-text-muted)]"}`}
        >
          <AlertTriangle className="w-3.5 h-3.5" /> Baixo estoque (
          {lowStockCount})
        </button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-10 text-center text-xs text-[var(--admin-text-muted)]">
          Carregando estoque...
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] p-10 text-center text-xs text-[var(--admin-text-muted)]">
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
                            <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-5 h-5 text-[var(--admin-text-muted)]" />
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
                        <div className={`font-bold ${isLowStock ? "text-status-warning" : "text-[var(--admin-text-main)]"}`}>
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
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(product)}
                            className="admin-btn-icon-sm rounded text-[var(--admin-text-muted)] hover:text-status-error hover:bg-status-error/10"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
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
                    <div className="w-11 h-11 rounded-xl bg-[var(--admin-bg)] border border-[var(--admin-border)] overflow-hidden flex items-center justify-center shrink-0">
                      {product.image_url ? (
                        <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-5 h-5 text-[var(--admin-accent)]/70" />
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
                      <p className={`text-sm font-bold mt-0.5 ${isLowStock ? "text-status-warning" : "text-status-success"}`}>
                        {product.stock_quantity}
                      </p>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-[var(--admin-accent)] shrink-0 ml-1" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[var(--admin-text-muted)] shrink-0 ml-1" />
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
                          className="flex-1 min-h-10 rounded-lg border border-[var(--admin-border)] text-[var(--admin-text-main)] hover:bg-[var(--admin-surface)] text-xs font-bold flex items-center justify-center gap-1.5"
                        >
                          <Edit3 className="w-4 h-4" /> Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(product)}
                          className="w-10 h-10 shrink-0 rounded-lg border border-status-error/25 text-status-error hover:bg-status-error/10 flex items-center justify-center"
                        >
                          <Trash2 className="w-4 h-4" />
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
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 sm:p-6 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base font-bold text-[var(--admin-text-main)]">
                  {editingProduct ? "Editar produto" : "Novo produto"}
                </h2>
                <p className="text-xs text-[var(--admin-text-muted)] admin-safe-wrap">
                  Dados do catálogo e estoque.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingProduct(null);
                  setIsModalOpen(false);
                }}
                className="h-9 w-9 rounded-xl text-[var(--admin-text-muted)] flex items-center justify-center"
                aria-label="Fechar formulário"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onKeyDown={handleEnterAsTab}
              onSubmit={handleSave}
              className="space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-[var(--admin-text-muted)]">
                  Nome
                  <input
                    required
                    value={form.name}
                    onChange={(event) => updateForm("name", event.target.value)}
                    className="mt-1 w-full h-10 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3 text-xs text-[var(--admin-text-main)] outline-none focus:border-[var(--admin-accent)]"
                  />
                </label>
                <label className="text-xs font-semibold text-[var(--admin-text-muted)]">
                  Marca
                  <input
                    required
                    value={form.brand}
                    onChange={(event) =>
                      updateForm("brand", event.target.value)
                    }
                    className="mt-1 w-full h-10 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3 text-xs text-[var(--admin-text-main)] outline-none focus:border-[var(--admin-accent)]"
                  />
                </label>
                <label className="text-xs font-semibold text-[var(--admin-text-muted)]">
                  Categoria
                  <select
                    value={form.category}
                    onChange={(event) =>
                      updateForm("category", event.target.value)
                    }
                    className="mt-1 w-full h-10 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3 text-xs text-[var(--admin-text-main)] outline-none focus:border-[var(--admin-accent)]"
                  >
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold text-[var(--admin-text-muted)]">
                  Preço
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(event) =>
                      updateForm("price", Number(event.target.value))
                    }
                    className="mt-1 w-full h-10 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3 text-xs text-[var(--admin-text-main)] outline-none focus:border-[var(--admin-accent)]"
                  />
                </label>
                <label className="text-xs font-semibold text-[var(--admin-text-muted)]">
                  Custo
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.cost_price}
                    onChange={(event) =>
                      updateForm("cost_price", Number(event.target.value))
                    }
                    className="mt-1 w-full h-10 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3 text-xs text-[var(--admin-text-main)] outline-none focus:border-[var(--admin-accent)]"
                  />
                </label>
                <label className="text-xs font-semibold text-[var(--admin-text-muted)]">
                  Estoque atual
                  <input
                    required
                    type="number"
                    min="0"
                    step="1"
                    value={form.stock_quantity}
                    onChange={(event) =>
                      updateForm("stock_quantity", Number(event.target.value))
                    }
                    className="mt-1 w-full h-10 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3 text-xs text-[var(--admin-text-main)] outline-none focus:border-[var(--admin-accent)]"
                  />
                </label>
                <label className="text-xs font-semibold text-[var(--admin-text-muted)]">
                  Alerta mínimo
                  <input
                    required
                    type="number"
                    min="0"
                    step="1"
                    value={form.min_stock_alert}
                    onChange={(event) =>
                      updateForm("min_stock_alert", Number(event.target.value))
                    }
                    className="mt-1 w-full h-10 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3 text-xs text-[var(--admin-text-main)] outline-none focus:border-[var(--admin-accent)]"
                  />
                </label>
                <label className="text-xs font-semibold text-[var(--admin-text-muted)]">
                  Comissão (%)
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
                    className="mt-1 w-full h-10 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3 text-xs text-[var(--admin-text-main)] outline-none focus:border-[var(--admin-accent)]"
                  />
                </label>
              </div>
              <label className="text-xs font-semibold text-[var(--admin-text-muted)]">
                Imagem (URL opcional)
                <input
                  type="url"
                  value={form.image_url || ""}
                  onChange={(event) =>
                    updateForm("image_url", event.target.value)
                  }
                  className="mt-1 w-full h-10 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3 text-xs text-[var(--admin-text-main)] outline-none focus:border-[var(--admin-accent)]"
                />
              </label>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingProduct(null);
                    setIsModalOpen(false);
                  }}
                  className="flex-1 h-10 rounded-xl border border-[var(--admin-border)] text-[var(--admin-text-muted)] text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 h-10 rounded-xl bg-[var(--admin-accent)] text-[var(--admin-accent-text)] text-xs font-bold disabled:opacity-50"
                >
                  {saving ? "Salvando..." : "Salvar produto"}
                </button>
              </div>
            </form>
          </div>
        </div>
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
