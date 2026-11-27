import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Package,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import {
  FIELD_LIMITS,
  LOW_STOCK_THRESHOLD,
  type Product,
  type ProductInput,
} from '../types/crm';
import { formatCurrencyExact } from '../utils/formatters';

interface ProductsViewProps {
  products: Product[];
  seeding: boolean;
  focusFormTrigger: number;
  onCreateProduct: (input: ProductInput) => Promise<void>;
  onUpdateProduct: (
    productId: string,
    input: Pick<ProductInput, 'name' | 'sku' | 'unitPrice' | 'minStock' | 'notes'>,
  ) => Promise<void>;
  onDeleteProduct: (productId: string) => Promise<void>;
  onGoToInventory: () => void;
  onSeedSampleInventory: () => Promise<void>;
}

export function ProductsView({
  products,
  seeding,
  focusFormTrigger,
  onCreateProduct,
  onUpdateProduct,
  onDeleteProduct,
  onGoToInventory,
  onSeedSampleInventory,
}: ProductsViewProps) {
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [unitPriceStr, setUnitPriceStr] = useState('');
  const [initialStockStr, setInitialStockStr] = useState('10');
  const [minStockStr, setMinStockStr] = useState(String(LOW_STOCK_THRESHOLD));
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (focusFormTrigger > 0) {
      resetForm();
      nameInputRef.current?.focus();
    }
  }, [focusFormTrigger]);

  function resetForm() {
    setEditingProduct(null);
    setName('');
    setSku('');
    setUnitPriceStr('');
    setInitialStockStr('10');
    setMinStockStr(String(LOW_STOCK_THRESHOLD));
    setNotes('');
    setFormError(null);
  }

  function startEditing(product: Product) {
    setEditingProduct(product);
    setName(product.name);
    setSku(product.sku);
    setUnitPriceStr(String(product.unitPrice));
    setInitialStockStr(String(product.stockQuantity));
    setMinStockStr(String(product.minStock));
    setNotes(product.notes);
    setFormError(null);
    setSuccessMsg(null);
    nameInputRef.current?.focus();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Informe o nome do produto.');
      return;
    }

    const parsedPrice = Number(unitPriceStr.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
    const parsedStock = Math.max(0, Math.trunc(Number(initialStockStr) || 0));
    const parsedMinStock = Math.max(0, Math.trunc(Number(minStockStr) || LOW_STOCK_THRESHOLD));

    setSaving(true);
    setFormError(null);
    setSuccessMsg(null);

    try {
      if (editingProduct) {
        await onUpdateProduct(editingProduct.id, {
          name: name.trim(),
          sku: sku.trim(),
          unitPrice: parsedPrice,
          minStock: parsedMinStock,
          notes: notes.trim(),
        });
        setSuccessMsg(`Produto "${name.trim()}" atualizado com sucesso.`);
      } else {
        await onCreateProduct({
          name: name.trim(),
          sku: sku.trim(),
          unitPrice: parsedPrice,
          stockQuantity: parsedStock,
          minStock: parsedMinStock,
          notes: notes.trim(),
        });
        setSuccessMsg(`Produto "${name.trim()}" cadastrado e salvo no banco de dados.`);
      }
      resetForm();
      window.setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao salvar produto.');
    } finally {
      setSaving(false);
    }
  }

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.notes.toLowerCase().includes(q),
    );
  }, [products, searchQuery]);

  const catalogValue = useMemo(
    () => products.reduce((acc, p) => acc + p.unitPrice * p.stockQuantity, 0),
    [products],
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Left Column: Product Registration / Edit Form */}
      <section
        aria-labelledby="product-form-heading"
        className="xl:col-span-4 bg-white border border-[#E5E7EB] rounded-xl p-6 xl:sticky xl:top-24"
      >
        <div className="flex items-center justify-between gap-2 pb-4 mb-4 border-b border-[#E5E7EB]">
          <div>
            <h2 id="product-form-heading" className="text-base font-semibold text-[#111827]">
              {editingProduct ? 'Editar Produto' : 'Cadastrar Novo Produto'}
            </h2>
            <p className="text-xs text-[#6B7280] mt-0.5">
              {editingProduct
                ? 'Atualize os dados do catálogo. Para alterar quantidades, use Estoque.'
                : 'O produto ficará disponível imediatamente em Pedidos e Estoque.'}
            </p>
          </div>
          {editingProduct && (
            <button
              type="button"
              onClick={resetForm}
              aria-label="Cancelar edição"
              className="p-1.5 text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] rounded-lg cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {formError}
            </div>
          )}

          {successMsg && (
            <div
              role="status"
              className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-[#15803D] flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">
              Nome do produto *
            </label>
            <input
              ref={nameInputRef}
              type="text"
              required
              maxLength={FIELD_LIMITS.productName}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Impressora Térmica 80mm"
              className="w-full px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/15"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">Código SKU</label>
              <input
                type="text"
                maxLength={FIELD_LIMITS.sku}
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="Ex.: IMP-80T"
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#1D4ED8]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">
                Preço unitário (R$) *
              </label>
              <input
                type="number"
                required
                min={0}
                step="0.01"
                value={unitPriceStr}
                onChange={(e) => setUnitPriceStr(e.target.value)}
                placeholder="0,00"
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#1D4ED8]"
              />
            </div>

            {!editingProduct && (
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1.5">
                  Estoque inicial *
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  max={FIELD_LIMITS.maxStock}
                  step={1}
                  value={initialStockStr}
                  onChange={(e) => setInitialStockStr(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                />
              </div>
            )}

            <div className={editingProduct ? 'sm:col-span-2' : ''}>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">
                Alerta mínimo (un.)
              </label>
              <input
                type="number"
                min={1}
                max={FIELD_LIMITS.maxMinStock}
                step={1}
                value={minStockStr}
                onChange={(e) => setMinStockStr(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#1D4ED8]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">
              Descrição / Observações
            </label>
            <textarea
              rows={3}
              maxLength={FIELD_LIMITS.productNotes}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalhes técnicos, fornecedor ou garantia..."
              className="w-full px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#1D4ED8] resize-none"
            />
          </div>

          <div className="pt-2 flex items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-[#1D4ED8] hover:bg-[#1E40AF] disabled:opacity-60 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              {saving
                ? 'Salvando...'
                : editingProduct
                  ? 'Salvar Alterações'
                  : 'Cadastrar Produto'}
            </button>
            {editingProduct && (
              <button
                type="button"
                onClick={resetForm}
                className="px-3.5 py-2.5 text-sm font-medium text-[#374151] bg-white border border-[#D1D5DB] hover:bg-[#F9FAFB] rounded-lg cursor-pointer whitespace-nowrap"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>

      {/* Right Column: Registered Products List */}
      <section className="xl:col-span-8 space-y-4">
        <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E5E7EB] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[#111827]">
                Produtos Cadastrados ({products.length})
              </h2>
              <p className="text-xs text-[#6B7280] mt-0.5 font-mono tabular-nums">
                Valor total em inventário: {formatCurrencyExact(catalogValue)}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar produto ou SKU..."
                  className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-[#E5E7EB] rounded-lg text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#1D4ED8]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Limpar busca"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#374151] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={onGoToInventory}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#374151] bg-white border border-[#D1D5DB] hover:bg-[#F9FAFB] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Package className="w-3.5 h-3.5" />
                Movimentar Estoque
              </button>
            </div>
          </div>

          {products.length === 0 ? (
            <div className="py-12 px-6 text-center">
              <Tag className="w-8 h-8 text-[#9CA3AF] mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-[#111827] mb-1">
                Nenhum produto cadastrado ainda
              </h3>
              <p className="text-xs text-[#6B7280] max-w-md mx-auto leading-relaxed mb-5">
                Use o formulário ao lado para cadastrar seu primeiro produto ou carregue produtos e
                pedidos de demonstração no banco de dados.
              </p>
              <button
                type="button"
                onClick={() => void onSeedSampleInventory()}
                disabled={seeding}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-[#374151] bg-white border border-[#D1D5DB] hover:bg-[#F9FAFB] disabled:opacity-60 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#1D4ED8]" />
                {seeding ? 'Carregando exemplos...' : 'Carregar produtos de exemplo'}
              </button>
            </div>
          ) : filteredProducts.length === 0 ? (
            <p className="py-10 px-6 text-center text-sm text-[#6B7280]">
              Nenhum produto encontrado para &quot;{searchQuery}&quot;.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA] text-xs font-medium text-[#6B7280]">
                    <th className="py-3 px-5">Produto</th>
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4 text-right">Preço Unit.</th>
                    <th className="py-3 px-4 text-right">Estoque</th>
                    <th className="py-3 px-5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB] text-sm">
                  {filteredProducts.map((product) => {
                    const threshold = Math.max(
                      LOW_STOCK_THRESHOLD,
                      product.minStock || LOW_STOCK_THRESHOLD,
                    );
                    const isLow = product.stockQuantity < threshold;
                    const isEditingThis = editingProduct?.id === product.id;

                    return (
                      <tr
                        key={product.id}
                        className={`transition-colors ${
                          isEditingThis ? 'bg-[#EFF6FF]/60' : 'hover:bg-[#F9FAFB]'
                        }`}
                      >
                        <td className="py-3.5 px-5 max-w-xs">
                          <p className="font-medium text-[#111827]">{product.name}</p>
                          {product.notes && (
                            <p className="text-xs text-[#6B7280] truncate mt-0.5">
                              {product.notes}
                            </p>
                          )}
                        </td>

                        <td className="py-3.5 px-4 font-mono text-xs text-[#6B7280] whitespace-nowrap">
                          {product.sku || '—'}
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#111827] whitespace-nowrap">
                          {formatCurrencyExact(product.unitPrice)}
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            {isLow && (
                              <AlertTriangle
                                className="w-3.5 h-3.5 text-[#B91C1C]"
                                aria-label="Estoque baixo"
                              />
                            )}
                            <span
                              className={`font-mono tabular-nums font-semibold text-xs ${
                                isLow ? 'text-[#B91C1C]' : 'text-[#15803D]'
                              }`}
                            >
                              {product.stockQuantity} un.
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-5 whitespace-nowrap text-right">
                          {confirmDeleteId === product.id ? (
                            <div className="inline-flex items-center gap-2 justify-end">
                              <span className="text-xs text-[#B91C1C] font-medium">Excluir?</span>
                              <button
                                type="button"
                                onClick={() => {
                                  if (editingProduct?.id === product.id) resetForm();
                                  void onDeleteProduct(product.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="px-2.5 py-1 text-xs font-medium text-white bg-[#B91C1C] hover:bg-red-800 rounded-md cursor-pointer"
                              >
                                Sim
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1 text-xs text-[#4B5563] hover:bg-[#F3F4F6] rounded-md cursor-pointer"
                              >
                                Não
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1 justify-end">
                              <button
                                type="button"
                                onClick={() => startEditing(product)}
                                title="Editar produto"
                                aria-label="Editar produto"
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#374151] hover:text-[#1D4ED8] hover:bg-[#EFF6FF] rounded-md transition-colors cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(product.id)}
                                title="Excluir produto"
                                aria-label="Excluir produto"
                                className="p-1.5 text-[#9CA3AF] hover:text-[#B91C1C] hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
