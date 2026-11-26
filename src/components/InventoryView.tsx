import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle2,
  Package,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  FIELD_LIMITS,
  LOW_STOCK_THRESHOLD,
  MOVEMENT_TYPE_LABELS,
  type Product,
  type ProductInput,
  type StockMovement,
} from '../types/crm';
import { formatCurrencyExact, formatFirestoreTimestamp } from '../utils/formatters';

interface InventoryViewProps {
  products: Product[];
  movements: StockMovement[];
  seeding: boolean;
  openCreateModalTrigger: number;
  onCreateProduct: (input: ProductInput) => Promise<void>;
  onUpdateProduct: (
    productId: string,
    input: Pick<ProductInput, 'name' | 'sku' | 'unitPrice' | 'minStock' | 'notes'>,
  ) => Promise<void>;
  onRegisterMovement: (
    productId: string,
    type: 'entrada' | 'saida',
    quantity: number,
    reason: string,
  ) => Promise<void>;
  onDeleteProduct: (productId: string) => Promise<void>;
  onSeedSampleInventory: () => Promise<void>;
}

type InventoryTab = 'produtos' | 'movimentacoes';
type StockFilter = 'todos' | 'baixo' | 'normal';

export function InventoryView({
  products,
  movements,
  seeding,
  openCreateModalTrigger,
  onCreateProduct,
  onUpdateProduct,
  onRegisterMovement,
  onDeleteProduct,
  onSeedSampleInventory,
}: InventoryViewProps) {
  const [activeTab, setActiveTab] = useState<InventoryTab>('produtos');
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('todos');

  // Product create/edit modal state
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [prodName, setProdName] = useState('');
  const [prodSku, setProdSku] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodStock, setProdStock] = useState('10');
  const [prodMinStock, setProdMinStock] = useState(String(LOW_STOCK_THRESHOLD));
  const [prodNotes, setProdNotes] = useState('');
  const [savingProduct, setSavingProduct] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);

  // Stock movement modal state
  const [movementTarget, setMovementTarget] = useState<{
    product: Product;
    type: 'entrada' | 'saida';
  } | null>(null);
  const [movQty, setMovQty] = useState('1');
  const [movReason, setMovReason] = useState('');
  const [savingMovement, setSavingMovement] = useState(false);
  const [movementError, setMovementError] = useState<string | null>(null);

  // Inline delete confirm
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Open new product modal when triggered from Top Bar CTA
  React.useEffect(() => {
    if (openCreateModalTrigger > 0) {
      openNewProductModal();
    }
  }, [openCreateModalTrigger]);

  function openNewProductModal() {
    setEditingProduct(null);
    setProdName('');
    setProdSku('');
    setProdPrice('');
    setProdStock('10');
    setProdMinStock(String(LOW_STOCK_THRESHOLD));
    setProdNotes('');
    setProductError(null);
    setProductModalOpen(true);
  }

  function openEditProductModal(product: Product) {
    setEditingProduct(product);
    setProdName(product.name);
    setProdSku(product.sku);
    setProdPrice(String(product.unitPrice));
    setProdStock(String(product.stockQuantity));
    setProdMinStock(String(product.minStock));
    setProdNotes(product.notes);
    setProductError(null);
    setProductModalOpen(true);
  }

  function openMovementModal(product: Product, type: 'entrada' | 'saida') {
    setMovementTarget({ product, type });
    setMovQty('1');
    setMovReason('');
    setMovementError(null);
  }

  const lowStockProducts = useMemo(
    () =>
      products.filter(
        (p) => p.stockQuantity < Math.max(LOW_STOCK_THRESHOLD, p.minStock || LOW_STOCK_THRESHOLD),
      ),
    [products],
  );

  const summary = useMemo(() => {
    let totalUnits = 0;
    let totalValue = 0;
    for (const p of products) {
      totalUnits += p.stockQuantity;
      totalValue += p.stockQuantity * p.unitPrice;
    }
    return {
      productCount: products.length,
      totalUnits,
      totalValue,
      lowStockCount: lowStockProducts.length,
    };
  }, [products, lowStockProducts.length]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      const isLow =
        p.stockQuantity < Math.max(LOW_STOCK_THRESHOLD, p.minStock || LOW_STOCK_THRESHOLD);
      if (stockFilter === 'baixo' && !isLow) return false;
      if (stockFilter === 'normal' && isLow) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.notes.toLowerCase().includes(q)
      );
    });
  }, [products, searchQuery, stockFilter]);

  async function handleSubmitProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!prodName.trim()) {
      setProductError('Informe o nome do produto.');
      return;
    }

    const parsedPrice = Number(prodPrice.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
    const parsedStock = Math.max(0, Math.trunc(Number(prodStock) || 0));
    const parsedMin = Math.max(0, Math.trunc(Number(prodMinStock) || LOW_STOCK_THRESHOLD));

    setSavingProduct(true);
    setProductError(null);
    try {
      if (editingProduct) {
        await onUpdateProduct(editingProduct.id, {
          name: prodName.trim(),
          sku: prodSku.trim(),
          unitPrice: parsedPrice,
          minStock: parsedMin,
          notes: prodNotes.trim(),
        });
      } else {
        await onCreateProduct({
          name: prodName.trim(),
          sku: prodSku.trim(),
          unitPrice: parsedPrice,
          stockQuantity: parsedStock,
          minStock: parsedMin,
          notes: prodNotes.trim(),
        });
      }
      setProductModalOpen(false);
    } catch (err) {
      setProductError(err instanceof Error ? err.message : 'Erro ao salvar produto.');
    } finally {
      setSavingProduct(false);
    }
  }

  async function handleSubmitMovement(e: React.FormEvent) {
    e.preventDefault();
    if (!movementTarget) return;

    const qty = Math.trunc(Number(movQty) || 0);
    if (qty < 1) {
      setMovementError('Informe uma quantidade válida (mínimo 1 unidade).');
      return;
    }

    if (movementTarget.type === 'saida' && qty > movementTarget.product.stockQuantity) {
      setMovementError(
        `Quantidade maior que o estoque disponível (${movementTarget.product.stockQuantity} un.).`,
      );
      return;
    }

    setSavingMovement(true);
    setMovementError(null);
    try {
      await onRegisterMovement(
        movementTarget.product.id,
        movementTarget.type,
        qty,
        movReason.trim(),
      );
      setMovementTarget(null);
    } catch (err) {
      setMovementError(err instanceof Error ? err.message : 'Erro ao movimentar estoque.');
    } finally {
      setSavingMovement(false);
    }
  }

  const parsedMovQty = Math.max(0, Math.trunc(Number(movQty) || 0));
  const previewNewStock = movementTarget
    ? movementTarget.type === 'entrada'
      ? movementTarget.product.stockQuantity + parsedMovQty
      : movementTarget.product.stockQuantity - parsedMovQty
    : 0;

  return (
    <div className="space-y-6">
      {/* Low Stock Alert Banner (< 5 units) */}
      {lowStockProducts.length > 0 && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#B91C1C] shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-[#991B1B]">
                Alerta de Estoque Baixo — {lowStockProducts.length}{' '}
                {lowStockProducts.length === 1
                  ? 'produto abaixo de 5 unidades'
                  : 'produtos abaixo de 5 unidades'}
              </h2>
              <p className="text-xs text-[#991B1B]/80 mt-0.5">
                Reposição recomendada para evitar bloqueio na criação de novos pedidos.
              </p>
            </div>
          </div>

          <div className="divide-y divide-red-200/80 border-t border-red-200/80">
            {lowStockProducts.map((item) => (
              <div
                key={item.id}
                className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="text-xs text-[#7F1D1D] flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{item.name}</span>
                  {item.sku && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{item.sku}</span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums font-semibold">
                    {item.stockQuantity === 0
                      ? '0 unidades (Esgotado)'
                      : `${item.stockQuantity} ${item.stockQuantity === 1 ? 'unidade restante' : 'unidades restantes'}`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => openMovementModal(item, 'entrada')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#991B1B] bg-white border border-red-200 hover:bg-red-100/50 rounded-lg transition-colors cursor-pointer whitespace-nowrap self-start sm:self-auto"
                >
                  <ArrowUpCircle className="w-3.5 h-3.5" />
                  Registrar entrada
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
          <span className="text-xs font-medium text-[#6B7280]">Produtos cadastrados</span>
          <p className="text-2xl font-mono tabular-nums font-semibold text-[#111827] mt-2">
            {summary.productCount}
          </p>
          <p className="text-xs text-[#6B7280] mt-1.5">Itens ativos no catálogo</p>
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
          <span className="text-xs font-medium text-[#6B7280]">Unidades disponíveis</span>
          <p className="text-2xl font-mono tabular-nums font-semibold text-[#111827] mt-2">
            {summary.totalUnits}
          </p>
          <p className="text-xs text-[#6B7280] mt-1.5">Soma de todo o inventário</p>
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
          <span className="text-xs font-medium text-[#6B7280]">Valor total em estoque</span>
          <p className="text-2xl font-mono tabular-nums font-semibold text-[#111827] mt-2">
            {formatCurrencyExact(summary.totalValue)}
          </p>
          <p className="text-xs text-[#6B7280] mt-1.5">Baseado no preço unitário</p>
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
          <span className="text-xs font-medium text-[#6B7280]">Abaixo de 5 unidades</span>
          <p
            className={`text-2xl font-mono tabular-nums font-semibold mt-2 ${
              summary.lowStockCount > 0 ? 'text-[#B91C1C]' : 'text-[#15803D]'
            }`}
          >
            {summary.lowStockCount}
          </p>
          <p className="text-xs text-[#6B7280] mt-1.5">
            {summary.lowStockCount > 0
              ? 'Itens em alerta de reposição'
              : 'Todos os produtos em nível seguro'}
          </p>
        </div>
      </div>

      {/* Empty State */}
      {products.length === 0 ? (
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-10 max-w-2xl mx-auto text-center">
          <Package className="w-8 h-8 text-[#9CA3AF] mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-[#111827] mb-2">
            Nenhum produto cadastrado no estoque
          </h2>
          <p className="text-sm text-[#4B5563] max-w-md mx-auto leading-relaxed mb-6">
            Cadastre seus produtos com quantidade inicial para registrar entradas, saídas manuais e
            permitir a baixa automática ao emitir pedidos.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={openNewProductModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#1D4ED8] hover:bg-[#1E40AF] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Cadastrar primeiro produto
            </button>
            <button
              type="button"
              onClick={() => void onSeedSampleInventory()}
              disabled={seeding}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[#374151] bg-white border border-[#D1D5DB] hover:bg-[#F9FAFB] disabled:opacity-60 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4 text-[#1D4ED8]" />
              {seeding ? 'Carregando exemplos...' : 'Carregar produtos e pedidos de exemplo'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Section Switcher & Toolbar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#E5E7EB]">
            <div className="flex flex-wrap items-center gap-4">
              <div
                role="tablist"
                aria-label="Visualização do estoque"
                className="inline-flex items-center gap-1 p-1 bg-[#F3F4F6] rounded-lg"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'produtos'}
                  onClick={() => setActiveTab('produtos')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    activeTab === 'produtos'
                      ? 'bg-white text-[#111827] shadow-xs'
                      : 'text-[#4B5563] hover:text-[#111827]'
                  }`}
                >
                  Produtos ({products.length})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'movimentacoes'}
                  onClick={() => setActiveTab('movimentacoes')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    activeTab === 'movimentacoes'
                      ? 'bg-white text-[#111827] shadow-xs'
                      : 'text-[#4B5563] hover:text-[#111827]'
                  }`}
                >
                  Movimentações ({movements.length})
                </button>
              </div>

              {activeTab === 'produtos' && (
                <div className="inline-flex items-center gap-1 p-1 bg-[#F3F4F6] rounded-lg">
                  {(
                    [
                      { id: 'todos', label: 'Todos' },
                      { id: 'baixo', label: 'Estoque baixo (< 5)' },
                      { id: 'normal', label: 'Normal' },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setStockFilter(f.id)}
                      className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                        stockFilter === f.id
                          ? 'bg-white text-[#111827] shadow-xs'
                          : 'text-[#4B5563] hover:text-[#111827]'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {activeTab === 'produtos' && (
              <div className="relative w-full lg:w-72">
                <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nome ou SKU..."
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
            )}
          </div>

          {/* Products Table */}
          {activeTab === 'produtos' && (
            <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
              {filteredProducts.length === 0 ? (
                <p className="py-10 px-6 text-center text-sm text-[#6B7280]">
                  Nenhum produto corresponde ao filtro atual.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA] text-xs font-medium text-[#6B7280]">
                        <th className="py-3 px-5">Produto</th>
                        <th className="py-3 px-4 text-right">Preço Unit.</th>
                        <th className="py-3 px-4 text-right">Saldo Atual</th>
                        <th className="py-3 px-4">Situação</th>
                        <th className="py-3 px-5 text-right">Movimentar e Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB] text-sm">
                      {filteredProducts.map((product) => {
                        const threshold = Math.max(
                          LOW_STOCK_THRESHOLD,
                          product.minStock || LOW_STOCK_THRESHOLD,
                        );
                        const isOut = product.stockQuantity === 0;
                        const isLow = product.stockQuantity < threshold;

                        return (
                          <tr key={product.id} className="hover:bg-[#F9FAFB] transition-colors">
                            <td className="py-3.5 px-5 max-w-sm">
                              <p className="font-medium text-[#111827]">{product.name}</p>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B7280] mt-0.5">
                                {product.sku && <span className="font-mono">{product.sku}</span>}
                                {product.sku && product.notes && <span aria-hidden="true">·</span>}
                                {product.notes && (
                                  <span className="truncate max-w-xs">{product.notes}</span>
                                )}
                              </div>
                            </td>

                            <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#374151] whitespace-nowrap">
                              {formatCurrencyExact(product.unitPrice)}
                            </td>

                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <span
                                className={`font-mono tabular-nums font-semibold ${
                                  isLow ? 'text-[#B91C1C]' : 'text-[#111827]'
                                }`}
                              >
                                {product.stockQuantity} un.
                              </span>
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap text-xs">
                              {isOut ? (
                                <span className="inline-flex items-center gap-1 font-semibold text-[#B91C1C]">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  Esgotado
                                </span>
                              ) : isLow ? (
                                <span className="inline-flex items-center gap-1 font-semibold text-[#B91C1C]">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  Abaixo de {threshold} un.
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 font-medium text-[#15803D]">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Normal
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 px-5 whitespace-nowrap text-right">
                              {confirmDeleteId === product.id ? (
                                <div className="inline-flex items-center gap-2 justify-end">
                                  <span className="text-xs text-[#B91C1C] font-medium">
                                    Excluir produto?
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
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
                                    Cancelar
                                  </button>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1.5 justify-end">
                                  <button
                                    type="button"
                                    onClick={() => openMovementModal(product, 'entrada')}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#15803D] bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors cursor-pointer whitespace-nowrap"
                                  >
                                    <ArrowUpCircle className="w-3.5 h-3.5" />
                                    Entrada
                                  </button>
                                  <button
                                    type="button"
                                    disabled={product.stockQuantity === 0}
                                    onClick={() => openMovementModal(product, 'saida')}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#B45309] bg-amber-50 hover:bg-amber-100 disabled:opacity-40 rounded-md transition-colors cursor-pointer whitespace-nowrap"
                                  >
                                    <ArrowDownCircle className="w-3.5 h-3.5" />
                                    Saída
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openEditProductModal(product)}
                                    title="Editar produto"
                                    aria-label="Editar produto"
                                    className="p-1.5 text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] rounded-md transition-colors cursor-pointer"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
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
          )}

          {/* Stock Movements Audit History */}
          {activeTab === 'movimentacoes' && (
            <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
              {movements.length === 0 ? (
                <p className="py-10 px-6 text-center text-sm text-[#6B7280]">
                  Nenhuma movimentação registrada até o momento.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA] text-xs font-medium text-[#6B7280]">
                        <th className="py-3 px-5">Data e Hora</th>
                        <th className="py-3 px-4">Produto</th>
                        <th className="py-3 px-4">Tipo</th>
                        <th className="py-3 px-4 text-right">Qtd.</th>
                        <th className="py-3 px-4 text-right">Saldo (Antes → Depois)</th>
                        <th className="py-3 px-5">Motivo / Origem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB] text-sm">
                      {movements.map((mov) => {
                        const isEntry = mov.type === 'entrada';
                        return (
                          <tr key={mov.id} className="hover:bg-[#F9FAFB]">
                            <td className="py-3 px-5 text-xs font-mono tabular-nums text-[#6B7280] whitespace-nowrap">
                              {formatFirestoreTimestamp(mov.createdAt)}
                            </td>
                            <td className="py-3 px-4 font-medium text-[#111827]">
                              {mov.productName}
                            </td>
                            <td className="py-3 px-4 text-xs whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 font-medium ${
                                  isEntry
                                    ? 'text-[#15803D]'
                                    : mov.type === 'saida_pedido'
                                      ? 'text-[#1D4ED8]'
                                      : 'text-[#B45309]'
                                }`}
                              >
                                {isEntry ? (
                                  <ArrowUpCircle className="w-3.5 h-3.5" />
                                ) : (
                                  <ArrowDownCircle className="w-3.5 h-3.5" />
                                )}
                                {MOVEMENT_TYPE_LABELS[mov.type]}
                              </span>
                            </td>
                            <td
                              className={`py-3 px-4 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                                isEntry ? 'text-[#15803D]' : 'text-[#B91C1C]'
                              }`}
                            >
                              {isEntry ? `+${mov.quantity}` : `-${mov.quantity}`}
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-[#4B5563] whitespace-nowrap">
                              {mov.previousStock} →{' '}
                              <strong className="text-[#111827]">{mov.newStock}</strong>
                            </td>
                            <td className="py-3 px-5 text-xs text-[#4B5563] max-w-xs truncate">
                              {mov.reason || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal: Create / Edit Product */}
      {productModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#111827]/40 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-modal-title"
        >
          <div className="bg-white border border-[#E5E7EB] rounded-xl w-full max-w-lg overflow-hidden shadow-lg">
            <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
              <h2 id="product-modal-title" className="text-base font-semibold text-[#111827]">
                {editingProduct ? 'Editar Produto' : 'Novo Produto no Estoque'}
              </h2>
              <button
                type="button"
                onClick={() => setProductModalOpen(false)}
                aria-label="Fechar janela"
                className="p-1.5 text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitProduct} className="p-6 space-y-4">
              {productError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  {productError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-[#374151] mb-1.5">
                    Nome do produto *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={FIELD_LIMITS.productName}
                    value={prodName}
                    onChange={(e) => setProdName(e.target.value)}
                    placeholder="Ex.: Impressora Térmica 80mm"
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1.5">
                    Código SKU
                  </label>
                  <input
                    type="text"
                    maxLength={FIELD_LIMITS.sku}
                    value={prodSku}
                    onChange={(e) => setProdSku(e.target.value)}
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
                    value={prodPrice}
                    onChange={(e) => setProdPrice(e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                  />
                </div>

                {!editingProduct && (
                  <div>
                    <label className="block text-xs font-medium text-[#374151] mb-1.5">
                      Quantidade inicial em estoque *
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      max={FIELD_LIMITS.maxStock}
                      step={1}
                      value={prodStock}
                      onChange={(e) => setProdStock(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                    />
                  </div>
                )}

                <div className={editingProduct ? 'sm:col-span-2' : ''}>
                  <label className="block text-xs font-medium text-[#374151] mb-1.5">
                    Alerta de estoque baixo (unidades)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={FIELD_LIMITS.maxMinStock}
                    step={1}
                    value={prodMinStock}
                    onChange={(e) => setProdMinStock(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1.5">
                  Observações
                </label>
                <textarea
                  rows={2}
                  maxLength={FIELD_LIMITS.productNotes}
                  value={prodNotes}
                  onChange={(e) => setProdNotes(e.target.value)}
                  placeholder="Fornecedor, especificações ou localização no depósito..."
                  className="w-full px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#1D4ED8] resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setProductModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-[#374151] bg-white border border-[#D1D5DB] hover:bg-[#F9FAFB] rounded-lg cursor-pointer whitespace-nowrap"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="px-4 py-2 text-sm font-medium text-white bg-[#1D4ED8] hover:bg-[#1E40AF] disabled:opacity-60 rounded-lg cursor-pointer whitespace-nowrap"
                >
                  {savingProduct
                    ? 'Salvando...'
                    : editingProduct
                      ? 'Salvar Alterações'
                      : 'Cadastrar Produto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Register Entry or Exit Movement */}
      {movementTarget && (
        <div
          className="fixed inset-0 z-50 bg-[#111827]/40 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="movement-modal-title"
        >
          <div className="bg-white border border-[#E5E7EB] rounded-xl w-full max-w-md overflow-hidden shadow-lg">
            <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
              <h2 id="movement-modal-title" className="text-base font-semibold text-[#111827]">
                {movementTarget.type === 'entrada'
                  ? 'Registrar Entrada de Estoque'
                  : 'Registrar Saída de Estoque'}
              </h2>
              <button
                type="button"
                onClick={() => setMovementTarget(null)}
                aria-label="Fechar janela"
                className="p-1.5 text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitMovement} className="p-6 space-y-4">
              {movementError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  {movementError}
                </div>
              )}

              <div className="bg-[#F8F9FA] border border-[#E5E7EB] rounded-lg p-3.5">
                <p className="text-sm font-semibold text-[#111827]">
                  {movementTarget.product.name}
                </p>
                <div className="mt-1.5 flex items-center justify-between text-xs text-[#6B7280]">
                  <span>Saldo atual</span>
                  <span className="font-mono tabular-nums font-semibold text-[#111827]">
                    {movementTarget.product.stockQuantity} un.
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-[#6B7280]">
                  <span>Saldo previsto após movimentação</span>
                  <span
                    className={`font-mono tabular-nums font-semibold ${
                      previewNewStock < 0 || previewNewStock < LOW_STOCK_THRESHOLD
                        ? 'text-[#B91C1C]'
                        : 'text-[#15803D]'
                    }`}
                  >
                    {previewNewStock} un.
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1.5">
                  Quantidade (unidades) *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={
                    movementTarget.type === 'saida'
                      ? movementTarget.product.stockQuantity
                      : FIELD_LIMITS.maxStock
                  }
                  step={1}
                  value={movQty}
                  onChange={(e) => setMovQty(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1.5">
                  Motivo / Referência
                </label>
                <input
                  type="text"
                  maxLength={FIELD_LIMITS.movementReason}
                  value={movReason}
                  onChange={(e) => setMovReason(e.target.value)}
                  placeholder={
                    movementTarget.type === 'entrada'
                      ? 'Ex.: Reposição NF 4821 — Fornecedor Alpha'
                      : 'Ex.: Ajuste de inventário ou uso interno'
                  }
                  className="w-full px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setMovementTarget(null)}
                  className="px-4 py-2 text-sm font-medium text-[#374151] bg-white border border-[#D1D5DB] hover:bg-[#F9FAFB] rounded-lg cursor-pointer whitespace-nowrap"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingMovement}
                  className={`px-4 py-2 text-sm font-medium text-white disabled:opacity-60 rounded-lg cursor-pointer whitespace-nowrap ${
                    movementTarget.type === 'entrada'
                      ? 'bg-[#15803D] hover:bg-emerald-800'
                      : 'bg-[#B45309] hover:bg-amber-800'
                  }`}
                >
                  {savingMovement
                    ? 'Registrando...'
                    : movementTarget.type === 'entrada'
                      ? 'Confirmar Entrada'
                      : 'Confirmar Saída'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
