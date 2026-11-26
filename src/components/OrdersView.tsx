import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  CreditCard,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Sparkles,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import {
  FIELD_LIMITS,
  LOW_STOCK_THRESHOLD,
  ORDER_STATUS_LABELS,
  type Lead,
  type Order,
  type OrderInput,
  type OrderStatus,
  type Product,
} from '../types/crm';
import { formatCurrencyExact, formatFirestoreTimestamp } from '../utils/formatters';

interface OrdersViewProps {
  orders: Order[];
  products: Product[];
  leads: Lead[];
  seeding: boolean;
  openCreateModalTrigger: number;
  onCreateOrder: (
    input: OrderInput,
  ) => Promise<{ orderId: string; newStock: number; productName: string }>;
  onUpdateOrderStatus: (orderId: string, nextStatus: OrderStatus) => Promise<void>;
  onDeleteOrder: (orderId: string) => Promise<void>;
  onGoToInventory: () => void;
  onSeedSampleInventory: () => Promise<void>;
}

type StatusFilter = 'todos' | OrderStatus;

export function OrdersView({
  orders,
  products,
  leads,
  seeding,
  openCreateModalTrigger,
  onCreateOrder,
  onUpdateOrderStatus,
  onDeleteOrder,
  onGoToInventory,
  onSeedSampleInventory,
}: OrdersViewProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  // Order creation form state
  const [customerMode, setCustomerMode] = useState<'lead' | 'manual'>('manual');
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantityStr, setQuantityStr] = useState('1');
  const [totalValueStr, setTotalValueStr] = useState('');
  const [manualValueEdited, setManualValueEdited] = useState(false);
  const [status, setStatus] = useState<OrderStatus>('pendente');
  const [notes, setNotes] = useState('');
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  // Post-order feedback banner
  const [lastOrderFeedback, setLastOrderFeedback] = useState<{
    productName: string;
    deducted: number;
    newStock: number;
  } | null>(null);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const availableProducts = useMemo(
    () => products.filter((p) => p.stockQuantity > 0),
    [products],
  );

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) ?? null,
    [products, selectedProductId],
  );

  function openNewOrderModal() {
    const defaultProd = availableProducts[0] ?? products[0] ?? null;
    const hasLeads = leads.length > 0;
    setCustomerMode(hasLeads ? 'lead' : 'manual');
    setSelectedLeadId(hasLeads ? leads[0].id : '');
    setCustomerName(hasLeads ? leads[0].name : '');
    setSelectedProductId(defaultProd ? defaultProd.id : '');
    setQuantityStr('1');
    setTotalValueStr(defaultProd ? String(defaultProd.unitPrice) : '0');
    setManualValueEdited(false);
    setStatus('pendente');
    setNotes('');
    setOrderError(null);
    setModalOpen(true);
  }

  useEffect(() => {
    if (openCreateModalTrigger > 0) {
      openNewOrderModal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCreateModalTrigger]);

  // Auto-calculate order total when product or quantity changes (unless user manually overrode total)
  useEffect(() => {
    if (!selectedProduct || manualValueEdited) return;
    const qty = Math.max(1, Math.trunc(Number(quantityStr) || 1));
    setTotalValueStr(String(Math.round(selectedProduct.unitPrice * qty * 100) / 100));
  }, [selectedProduct, quantityStr, manualValueEdited]);

  const metrics = useMemo(() => {
    let totalRevenue = 0;
    let pendenteCount = 0;
    let pagoCount = 0;
    let entregueCount = 0;

    for (const o of orders) {
      totalRevenue += o.totalValue || 0;
      if (o.status === 'pendente') pendenteCount++;
      else if (o.status === 'pago') pagoCount++;
      else if (o.status === 'entregue') entregueCount++;
    }

    return {
      totalCount: orders.length,
      totalRevenue,
      pendenteCount,
      pagoCount,
      entregueCount,
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== 'todos' && o.status !== statusFilter) return false;
      if (!q) return true;
      return (
        o.customerName.toLowerCase().includes(q) ||
        o.productName.toLowerCase().includes(q) ||
        o.notes.toLowerCase().includes(q)
      );
    });
  }, [orders, statusFilter, searchQuery]);

  async function handleSubmitOrder(e: React.FormEvent) {
    e.preventDefault();
    const resolvedName =
      customerMode === 'lead'
        ? leads.find((l) => l.id === selectedLeadId)?.name || customerName.trim()
        : customerName.trim();

    if (!resolvedName) {
      setOrderError('Informe ou selecione o cliente do pedido.');
      return;
    }

    if (!selectedProduct) {
      setOrderError('Selecione um produto cadastrado no estoque.');
      return;
    }

    const qty = Math.trunc(Number(quantityStr) || 0);
    if (qty < 1) {
      setOrderError('A quantidade deve ser de pelo menos 1 unidade.');
      return;
    }

    if (qty > selectedProduct.stockQuantity) {
      setOrderError(
        `Estoque insuficiente para "${selectedProduct.name}". Disponível: ${selectedProduct.stockQuantity} un.`,
      );
      return;
    }

    const totalValue = Number(totalValueStr.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;

    setSavingOrder(true);
    setOrderError(null);
    try {
      const result = await onCreateOrder({
        customerName: resolvedName,
        leadId: customerMode === 'lead' ? selectedLeadId : '',
        productId: selectedProduct.id,
        quantity: qty,
        unitPrice: selectedProduct.unitPrice,
        totalValue,
        status,
        notes: notes.trim(),
      });
      setLastOrderFeedback({
        productName: result.productName,
        deducted: qty,
        newStock: result.newStock,
      });
      setModalOpen(false);
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : 'Não foi possível criar o pedido.');
    } finally {
      setSavingOrder(false);
    }
  }

  const parsedQty = Math.max(0, Math.trunc(Number(quantityStr) || 0));
  const projectedStock = selectedProduct ? selectedProduct.stockQuantity - parsedQty : 0;

  return (
    <div className="space-y-6">
      {/* Automatic Stock Deduction Confirmation Banner */}
      {lastOrderFeedback && (
        <div
          role="status"
          className={`rounded-xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            lastOrderFeedback.newStock < LOW_STOCK_THRESHOLD
              ? 'bg-amber-50 border-amber-200'
              : 'bg-emerald-50 border-emerald-200'
          }`}
        >
          <div className="flex items-start sm:items-center gap-2.5 text-xs">
            {lastOrderFeedback.newStock < LOW_STOCK_THRESHOLD ? (
              <AlertTriangle className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5 sm:mt-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5 sm:mt-0" />
            )}
            <p className="text-[#111827]">
              Pedido registrado e{' '}
              <strong className="font-mono tabular-nums">
                {lastOrderFeedback.deducted} un.
              </strong>{' '}
              baixadas automaticamente de <strong>{lastOrderFeedback.productName}</strong>. Saldo
              atual:{' '}
              <strong className="font-mono tabular-nums">
                {lastOrderFeedback.newStock} un.
              </strong>
              {lastOrderFeedback.newStock < LOW_STOCK_THRESHOLD && (
                <span className="text-[#B91C1C] font-semibold">
                  {' '}
                  — Alerta: estoque abaixo de {LOW_STOCK_THRESHOLD} unidades!
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {lastOrderFeedback.newStock < LOW_STOCK_THRESHOLD && (
              <button
                type="button"
                onClick={onGoToInventory}
                className="px-3 py-1 text-xs font-medium text-[#92400E] bg-white border border-amber-300 hover:bg-amber-100/50 rounded-md cursor-pointer whitespace-nowrap"
              >
                Ver Estoque
              </button>
            )}
            <button
              type="button"
              onClick={() => setLastOrderFeedback(null)}
              aria-label="Fechar aviso"
              className="p-1 text-[#4B5563] hover:text-[#111827] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
          <span className="text-xs font-medium text-[#6B7280]">Total de pedidos</span>
          <p className="text-2xl font-mono tabular-nums font-semibold text-[#111827] mt-2">
            {metrics.totalCount}
          </p>
          <p className="text-xs text-[#6B7280] mt-1.5">Pedidos salvos no banco</p>
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
          <span className="text-xs font-medium text-[#6B7280]">Volume total em pedidos</span>
          <p className="text-2xl font-mono tabular-nums font-semibold text-[#111827] mt-2">
            {formatCurrencyExact(metrics.totalRevenue)}
          </p>
          <p className="text-xs text-[#6B7280] mt-1.5">Soma de todos os pedidos</p>
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
          <span className="text-xs font-medium text-[#6B7280]">Pendentes / Pagos</span>
          <p className="text-2xl font-mono tabular-nums font-semibold text-[#111827] mt-2">
            {metrics.pendenteCount}{' '}
            <span className="text-base font-normal text-[#9CA3AF]">/</span> {metrics.pagoCount}
          </p>
          <p className="text-xs text-[#6B7280] mt-1.5">Aguardando pagamento ou despacho</p>
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
          <span className="text-xs font-medium text-[#6B7280]">Pedidos entregues</span>
          <p className="text-2xl font-mono tabular-nums font-semibold text-[#15803D] mt-2">
            {metrics.entregueCount}
          </p>
          <p className="text-xs text-[#6B7280] mt-1.5">Concluídos e entregues ao cliente</p>
        </div>
      </div>

      {/* Empty state if no products in stock yet */}
      {products.length === 0 ? (
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-10 max-w-2xl mx-auto text-center">
          <Package className="w-8 h-8 text-[#9CA3AF] mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-[#111827] mb-2">
            Cadastre produtos no estoque para criar pedidos
          </h2>
          <p className="text-sm text-[#4B5563] max-w-md mx-auto leading-relaxed mb-6">
            Cada pedido baixa automaticamente a quantidade vendida do módulo de Estoque. Cadastre
            um produto ou carregue a base de exemplo para testar agora.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onGoToInventory}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#1D4ED8] hover:bg-[#1E40AF] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <Package className="w-4 h-4" />
              Ir para Estoque
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
          {/* Filter & Search Toolbar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#E5E7EB]">
            <div
              role="group"
              aria-label="Filtrar pedidos por status"
              className="inline-flex items-center gap-1 p-1 bg-[#F3F4F6] rounded-lg overflow-x-auto"
            >
              {(
                [
                  { id: 'todos', label: 'Todos', count: metrics.totalCount },
                  { id: 'pendente', label: 'Pendente', count: metrics.pendenteCount },
                  { id: 'pago', label: 'Pago', count: metrics.pagoCount },
                  { id: 'entregue', label: 'Entregue', count: metrics.entregueCount },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    statusFilter === tab.id
                      ? 'bg-white text-[#111827] shadow-xs'
                      : 'text-[#4B5563] hover:text-[#111827]'
                  }`}
                >
                  {tab.label}{' '}
                  <span className="font-mono tabular-nums text-[#6B7280] ml-1">{tab.count}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2.5">
              <div className="relative flex-1 lg:w-64">
                <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar cliente ou produto..."
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
                onClick={openNewOrderModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-[#1D4ED8] hover:bg-[#1E40AF] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Novo Pedido
              </button>
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
            {filteredOrders.length === 0 ? (
              <div className="py-12 px-6 text-center">
                <ShoppingCart className="w-7 h-7 text-[#9CA3AF] mx-auto mb-2.5" />
                <p className="text-sm font-medium text-[#111827]">Nenhum pedido encontrado</p>
                <p className="text-xs text-[#6B7280] mt-1">
                  Clique em &quot;Novo Pedido&quot; para registrar uma venda com baixa automática no
                  estoque.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA] text-xs font-medium text-[#6B7280]">
                      <th className="py-3 px-5">Cliente</th>
                      <th className="py-3 px-4">Produto</th>
                      <th className="py-3 px-4 text-right">Qtd.</th>
                      <th className="py-3 px-4 text-right">Valor Total</th>
                      <th className="py-3 px-4">Data</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB] text-sm">
                    {filteredOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-[#F9FAFB] transition-colors">
                        <td className="py-3.5 px-5 max-w-[220px]">
                          <p className="font-medium text-[#111827] truncate">
                            {order.customerName}
                          </p>
                          {order.notes && (
                            <p className="text-xs text-[#6B7280] truncate mt-0.5">{order.notes}</p>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-[#374151] max-w-[220px] truncate">
                          {order.productName}
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#111827] whitespace-nowrap">
                          {order.quantity} un.
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-[#111827] whitespace-nowrap">
                          {formatCurrencyExact(order.totalValue)}
                        </td>

                        <td className="py-3.5 px-4 text-xs font-mono tabular-nums text-[#6B7280] whitespace-nowrap">
                          {formatFirestoreTimestamp(order.createdAt)}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap text-xs">
                          {order.status === 'pendente' && (
                            <span className="inline-flex items-center gap-1 font-medium text-[#B45309]">
                              <Clock className="w-3.5 h-3.5" />
                              {ORDER_STATUS_LABELS.pendente}
                            </span>
                          )}
                          {order.status === 'pago' && (
                            <span className="inline-flex items-center gap-1 font-medium text-[#1D4ED8]">
                              <CreditCard className="w-3.5 h-3.5" />
                              {ORDER_STATUS_LABELS.pago}
                            </span>
                          )}
                          {order.status === 'entregue' && (
                            <span className="inline-flex items-center gap-1 font-medium text-[#15803D]">
                              <Truck className="w-3.5 h-3.5" />
                              {ORDER_STATUS_LABELS.entregue}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-5 whitespace-nowrap text-right">
                          {confirmDeleteId === order.id ? (
                            <div className="inline-flex items-center gap-2 justify-end">
                              <span className="text-xs text-[#B91C1C] font-medium">Excluir?</span>
                              <button
                                type="button"
                                onClick={() => {
                                  void onDeleteOrder(order.id);
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
                            <div className="inline-flex items-center gap-1.5 justify-end">
                              {order.status === 'pendente' && (
                                <button
                                  type="button"
                                  onClick={() => void onUpdateOrderStatus(order.id, 'pago')}
                                  className="px-2.5 py-1 text-xs font-medium text-[#1D4ED8] bg-[#EFF6FF] hover:bg-blue-100 rounded-md transition-colors cursor-pointer whitespace-nowrap"
                                >
                                  Marcar Pago
                                </button>
                              )}
                              {order.status !== 'entregue' && (
                                <button
                                  type="button"
                                  onClick={() => void onUpdateOrderStatus(order.id, 'entregue')}
                                  className="px-2.5 py-1 text-xs font-medium text-[#15803D] bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors cursor-pointer whitespace-nowrap"
                                >
                                  Marcar Entregue
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(order.id)}
                                title="Excluir pedido"
                                aria-label="Excluir pedido"
                                className="p-1.5 text-[#9CA3AF] hover:text-[#B91C1C] hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal: Create Order with Automatic Stock Deduction */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#111827]/40 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-order-modal-title"
        >
          <div className="bg-white border border-[#E5E7EB] rounded-xl w-full max-w-lg overflow-hidden shadow-lg">
            <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
              <h2 id="new-order-modal-title" className="text-base font-semibold text-[#111827]">
                Cadastrar Novo Pedido
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Fechar janela"
                className="p-1.5 text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitOrder} className="p-6 space-y-4">
              {orderError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  {orderError}
                </div>
              )}

              {/* Customer Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-[#374151]">Cliente *</label>
                  {leads.length > 0 && (
                    <div className="inline-flex items-center gap-1 p-0.5 bg-[#F3F4F6] rounded-md">
                      <button
                        type="button"
                        onClick={() => {
                          setCustomerMode('lead');
                          const first = leads[0];
                          if (first) {
                            setSelectedLeadId(first.id);
                            setCustomerName(first.name);
                          }
                        }}
                        className={`px-2 py-0.5 text-[11px] font-medium rounded cursor-pointer ${
                          customerMode === 'lead'
                            ? 'bg-white text-[#111827] shadow-xs'
                            : 'text-[#6B7280]'
                        }`}
                      >
                        Lead do CRM
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomerMode('manual');
                          setSelectedLeadId('');
                          setCustomerName('');
                        }}
                        className={`px-2 py-0.5 text-[11px] font-medium rounded cursor-pointer ${
                          customerMode === 'manual'
                            ? 'bg-white text-[#111827] shadow-xs'
                            : 'text-[#6B7280]'
                        }`}
                      >
                        Digitar nome
                      </button>
                    </div>
                  )}
                </div>

                {customerMode === 'lead' && leads.length > 0 ? (
                  <select
                    required
                    value={selectedLeadId}
                    onChange={(e) => {
                      setSelectedLeadId(e.target.value);
                      const found = leads.find((l) => l.id === e.target.value);
                      if (found) setCustomerName(found.name);
                    }}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                  >
                    {leads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} {l.company ? `— ${l.company}` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    maxLength={FIELD_LIMITS.customerName}
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Ex.: Distribuidora Central Ltda."
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                    autoFocus
                  />
                )}
              </div>

              {/* Product Selector */}
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1.5">
                  Produto (Estoque) *
                </label>
                <select
                  required
                  value={selectedProductId}
                  onChange={(e) => {
                    setSelectedProductId(e.target.value);
                    setManualValueEdited(false);
                  }}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id} disabled={p.stockQuantity === 0}>
                      {p.name} — {formatCurrencyExact(p.unitPrice)} ({p.stockQuantity}{' '}
                      {p.stockQuantity === 1 ? 'un.' : 'un.'} disponíveis
                      {p.stockQuantity === 0 ? ' — Sem estoque' : ''})
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity & Value */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1.5">
                    Quantidade *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={selectedProduct ? selectedProduct.stockQuantity : FIELD_LIMITS.maxStock}
                    step={1}
                    value={quantityStr}
                    onChange={(e) => {
                      setQuantityStr(e.target.value);
                      setManualValueEdited(false);
                    }}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1.5">
                    Valor total (R$) *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    step="0.01"
                    value={totalValueStr}
                    onChange={(e) => {
                      setTotalValueStr(e.target.value);
                      setManualValueEdited(true);
                    }}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                  />
                </div>
              </div>

              {/* Live Automatic Stock Deduction Preview */}
              {selectedProduct && (
                <div
                  className={`rounded-lg border px-3.5 py-2.5 text-xs ${
                    projectedStock < 0
                      ? 'bg-red-50 border-red-200 text-[#991B1B]'
                      : projectedStock < LOW_STOCK_THRESHOLD
                        ? 'bg-amber-50 border-amber-200 text-[#92400E]'
                        : 'bg-[#F8F9FA] border-[#E5E7EB] text-[#374151]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span>Baixa automática no estoque:</span>
                    <span className="font-mono tabular-nums font-semibold">
                      {selectedProduct.stockQuantity} un. → {projectedStock} un.
                    </span>
                  </div>
                  {projectedStock < 0 && (
                    <p className="mt-1 font-medium">
                      Quantidade solicitada excede o estoque disponível.
                    </p>
                  )}
                  {projectedStock >= 0 && projectedStock < LOW_STOCK_THRESHOLD && (
                    <p className="mt-1 font-medium">
                      Atenção: este pedido deixará o estoque abaixo de {LOW_STOCK_THRESHOLD}{' '}
                      unidades.
                    </p>
                  )}
                </div>
              )}

              {/* Status Selector */}
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1.5">
                  Status do pedido
                </label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#F3F4F6] rounded-lg">
                  {(['pendente', 'pago', 'entregue'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatus(st)}
                      className={`py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                        status === st
                          ? 'bg-white text-[#111827] shadow-xs'
                          : 'text-[#4B5563] hover:text-[#111827]'
                      }`}
                    >
                      {ORDER_STATUS_LABELS[st]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1.5">
                  Observações
                </label>
                <textarea
                  rows={2}
                  maxLength={FIELD_LIMITS.orderNotes}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Forma de pagamento, endereço ou prazo de entrega..."
                  className="w-full px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#1D4ED8] resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-[#374151] bg-white border border-[#D1D5DB] hover:bg-[#F9FAFB] rounded-lg cursor-pointer whitespace-nowrap"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingOrder || !selectedProduct || projectedStock < 0}
                  className="px-4 py-2 text-sm font-medium text-white bg-[#1D4ED8] hover:bg-[#1E40AF] disabled:opacity-50 rounded-lg cursor-pointer whitespace-nowrap"
                >
                  {savingOrder ? 'Registrando...' : 'Criar Pedido e Baixar Estoque'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
