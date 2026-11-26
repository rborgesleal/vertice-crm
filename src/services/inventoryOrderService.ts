import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  FIELD_LIMITS,
  LOW_STOCK_THRESHOLD,
  type Order,
  type OrderInput,
  type OrderStatus,
  type Product,
  type ProductInput,
  type StockMovement,
} from '../types/crm';
import {
  clampString,
  getCurrentMonthKey,
  sanitizeInt,
  sanitizeNumber,
} from '../utils/formatters';

function tsMillis(ts: { toMillis?: () => number } | null | undefined): number {
  return ts && typeof ts.toMillis === 'function' ? ts.toMillis() : Date.now();
}

export function subscribeProducts(
  uid: string,
  onData: (products: Product[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const path = 'products';
  const q = query(collection(db, path), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: Product[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Product, 'id'>),
      }));
      items.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) onError(wrapped);
      }
    },
  );
}

export async function createProduct(uid: string, input: ProductInput): Promise<string> {
  const path = 'products';
  const name = clampString(input.name, FIELD_LIMITS.productName);
  if (!name) {
    throw new Error('O nome do produto é obrigatório.');
  }
  const initialStock = sanitizeInt(input.stockQuantity, 0, FIELD_LIMITS.maxStock);
  const minStock = sanitizeInt(
    Number.isFinite(input.minStock) ? input.minStock : LOW_STOCK_THRESHOLD,
    0,
    FIELD_LIMITS.maxMinStock,
  );

  const productRef = doc(collection(db, path));
  const batch = writeBatch(db);

  batch.set(productRef, {
    ownerId: uid,
    name,
    sku: clampString(input.sku, FIELD_LIMITS.sku),
    unitPrice: sanitizeNumber(input.unitPrice, 0, FIELD_LIMITS.maxValue),
    stockQuantity: initialStock,
    minStock,
    notes: clampString(input.notes, FIELD_LIMITS.productNotes),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (initialStock > 0) {
    const movRef = doc(collection(db, 'stockMovements'));
    batch.set(movRef, {
      ownerId: uid,
      productId: productRef.id,
      productName: name,
      type: 'entrada',
      quantity: initialStock,
      previousStock: 0,
      newStock: initialStock,
      reason: 'Estoque inicial no cadastro',
      orderId: '',
      createdAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
    return productRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateProductMetadata(
  productId: string,
  input: Pick<ProductInput, 'name' | 'sku' | 'unitPrice' | 'minStock' | 'notes'>,
): Promise<void> {
  const path = `products/${productId}`;
  const name = clampString(input.name, FIELD_LIMITS.productName);
  if (!name) throw new Error('O nome do produto é obrigatório.');

  try {
    await updateDoc(doc(db, 'products', productId), {
      name,
      sku: clampString(input.sku, FIELD_LIMITS.sku),
      unitPrice: sanitizeNumber(input.unitPrice, 0, FIELD_LIMITS.maxValue),
      minStock: sanitizeInt(input.minStock, 0, FIELD_LIMITS.maxMinStock),
      notes: clampString(input.notes, FIELD_LIMITS.productNotes),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function registerStockMovement(
  uid: string,
  productId: string,
  type: 'entrada' | 'saida',
  rawQuantity: number,
  reason: string,
): Promise<{ previousStock: number; newStock: number }> {
  const path = `products/${productId}`;
  const quantity = sanitizeInt(rawQuantity, 1, FIELD_LIMITS.maxStock);
  if (quantity < 1) {
    throw new Error('A quantidade deve ser de pelo menos 1 unidade.');
  }

  try {
    return await runTransaction(db, async (tx) => {
      const productRef = doc(db, 'products', productId);
      const snap = await tx.get(productRef);
      if (!snap.exists()) {
        throw new Error('Produto não encontrado no estoque.');
      }

      const data = snap.data() as Omit<Product, 'id'>;
      const previousStock = sanitizeInt(data.stockQuantity, 0, FIELD_LIMITS.maxStock);

      if (type === 'saida' && previousStock < quantity) {
        throw new Error(
          `Estoque insuficiente para saída. Disponível: ${previousStock} ${previousStock === 1 ? 'unidade' : 'unidades'}.`,
        );
      }

      const newStock = type === 'entrada' ? previousStock + quantity : previousStock - quantity;
      if (newStock > FIELD_LIMITS.maxStock) {
        throw new Error('O limite máximo de estoque foi excedido.');
      }

      tx.update(productRef, {
        stockQuantity: newStock,
        updatedAt: serverTimestamp(),
      });

      const movRef = doc(collection(db, 'stockMovements'));
      tx.set(movRef, {
        ownerId: uid,
        productId,
        productName: clampString(data.name, FIELD_LIMITS.productName) || 'Produto',
        type,
        quantity,
        previousStock,
        newStock,
        reason: clampString(
          reason || (type === 'entrada' ? 'Entrada manual de estoque' : 'Saída manual de estoque'),
          FIELD_LIMITS.movementReason,
        ),
        orderId: '',
        createdAt: serverTimestamp(),
      });

      return { previousStock, newStock };
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('Estoque insuficiente') ||
        error.message.includes('Produto não encontrado') ||
        error.message.includes('limite máximo'))
    ) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteProduct(productId: string): Promise<void> {
  const path = `products/${productId}`;
  try {
    await deleteDoc(doc(db, 'products', productId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeStockMovements(
  uid: string,
  onData: (movements: StockMovement[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const path = 'stockMovements';
  const q = query(collection(db, path), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: StockMovement[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<StockMovement, 'id'>),
      }));
      items.sort((a, b) => tsMillis(b.createdAt) - tsMillis(a.createdAt));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) onError(wrapped);
      }
    },
  );
}

export function subscribeOrders(
  uid: string,
  onData: (orders: Order[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const path = 'orders';
  const q = query(collection(db, path), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: Order[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Order, 'id'>),
      }));
      items.sort((a, b) => tsMillis(b.createdAt) - tsMillis(a.createdAt));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) onError(wrapped);
      }
    },
  );
}

export async function createOrderWithStockDeduction(
  uid: string,
  input: OrderInput,
): Promise<{ orderId: string; newStock: number; productName: string }> {
  const path = 'orders';
  const customerName = clampString(input.customerName, FIELD_LIMITS.customerName);
  if (!customerName) {
    throw new Error('Informe o nome do cliente.');
  }
  const quantity = sanitizeInt(input.quantity, 1, FIELD_LIMITS.maxStock);
  if (quantity < 1) {
    throw new Error('A quantidade do pedido deve ser maior que zero.');
  }

  try {
    return await runTransaction(db, async (tx) => {
      const productRef = doc(db, 'products', input.productId);
      const productSnap = await tx.get(productRef);
      if (!productSnap.exists()) {
        throw new Error('O produto selecionado não existe mais no estoque.');
      }

      const productData = productSnap.data() as Omit<Product, 'id'>;
      const previousStock = sanitizeInt(productData.stockQuantity, 0, FIELD_LIMITS.maxStock);

      if (previousStock < quantity) {
        throw new Error(
          `Estoque insuficiente para "${productData.name}". Disponível: ${previousStock} un., solicitado: ${quantity} un.`,
        );
      }

      const newStock = previousStock - quantity;
      const orderRef = doc(collection(db, 'orders'));
      const movRef = doc(collection(db, 'stockMovements'));
      const cleanProductName = clampString(productData.name, FIELD_LIMITS.productName);

      // 1. Automatically deduct stock from product
      tx.update(productRef, {
        stockQuantity: newStock,
        updatedAt: serverTimestamp(),
      });

      // 2. Create the order document
      tx.set(orderRef, {
        ownerId: uid,
        customerName,
        leadId: clampString(input.leadId || '', FIELD_LIMITS.id),
        productId: input.productId,
        productName: cleanProductName,
        quantity,
        unitPrice: sanitizeNumber(input.unitPrice, 0, FIELD_LIMITS.maxValue),
        totalValue: sanitizeNumber(input.totalValue, 0, FIELD_LIMITS.maxValue),
        status: input.status,
        notes: clampString(input.notes, FIELD_LIMITS.orderNotes),
        orderMonth: getCurrentMonthKey(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 3. Log auditable automatic stock deduction movement
      tx.set(movRef, {
        ownerId: uid,
        productId: input.productId,
        productName: cleanProductName,
        type: 'saida_pedido',
        quantity,
        previousStock,
        newStock,
        reason: clampString(`Baixa automática — Pedido de ${customerName}`, FIELD_LIMITS.movementReason),
        orderId: orderRef.id,
        createdAt: serverTimestamp(),
      });

      return { orderId: orderRef.id, newStock, productName: cleanProductName };
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('Estoque insuficiente') ||
        error.message.includes('não existe mais'))
    ) {
      throw error;
    }
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
  const path = `orders/${orderId}`;
  try {
    await updateDoc(doc(db, 'orders', orderId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteOrder(orderId: string): Promise<void> {
  const path = `orders/${orderId}`;
  try {
    await deleteDoc(doc(db, 'orders', orderId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function seedSampleInventoryAndOrders(uid: string): Promise<void> {
  const sampleProducts: ProductInput[] = [
    {
      name: 'Kit Terminal PDV Compacto',
      sku: 'PDV-2026-A',
      unitPrice: 1890,
      stockQuantity: 14,
      minStock: LOW_STOCK_THRESHOLD,
      notes: 'Terminal completo com leitor óptico e fonte bivolt.',
    },
    {
      name: 'Leitor de Código de Barras Sem Fio',
      sku: 'LCB-410',
      unitPrice: 420,
      stockQuantity: 6,
      minStock: LOW_STOCK_THRESHOLD,
      notes: 'Bluetooth 5.0 com base carregadora USB.',
    },
    {
      name: 'Impressora Térmica 80mm',
      sku: 'IMP-80T',
      unitPrice: 780,
      stockQuantity: 5,
      minStock: LOW_STOCK_THRESHOLD,
      notes: 'Corte automático e conexão Ethernet/USB.',
    },
    {
      name: 'Roteador Industrial Dual-SIM',
      sku: 'ROT-IND-2S',
      unitPrice: 1350,
      stockQuantity: 9,
      minStock: LOW_STOCK_THRESHOLD,
      notes: 'Failover automático 4G para operações contínuas.',
    },
    {
      name: 'Nobreak Senoidal 1200VA',
      sku: 'NBR-1200',
      unitPrice: 950,
      stockQuantity: 3,
      minStock: LOW_STOCK_THRESHOLD,
      notes: 'Bateria interna selada para proteção de caixa.',
    },
  ];

  const createdIds: Array<{ id: string; product: ProductInput }> = [];
  for (const prod of sampleProducts) {
    const id = await createProduct(uid, prod);
    createdIds.push({ id, product: prod });
  }

  // Create sample orders that automatically deduct from stock (pushing Leitor and Impressora below 5 units!)
  const sampleOrders: Array<{
    productIdx: number;
    customerName: string;
    quantity: number;
    status: OrderStatus;
    notes: string;
  }> = [
    {
      productIdx: 0,
      customerName: 'FarmaSul Distribuidora',
      quantity: 3,
      status: 'entregue',
      notes: 'Entrega realizada via transportadora com NF emitida.',
    },
    {
      productIdx: 1,
      customerName: 'Grupo Alvorada Alimentos',
      quantity: 3,
      status: 'pago',
      notes: 'Pagamento confirmado via PIX. Separação para despacho.',
    },
    {
      productIdx: 2,
      customerName: 'Norte Logística S.A.',
      quantity: 2,
      status: 'pendente',
      notes: 'Aguardando compensação do boleto bancário.',
    },
    {
      productIdx: 3,
      customerName: 'Atlas Energia Solar',
      quantity: 2,
      status: 'pago',
      notes: 'Pedido aprovado pelo setor de compras.',
    },
  ];

  for (const ord of sampleOrders) {
    const target = createdIds[ord.productIdx];
    if (!target) continue;
    await createOrderWithStockDeduction(uid, {
      customerName: ord.customerName,
      leadId: '',
      productId: target.id,
      quantity: ord.quantity,
      unitPrice: target.product.unitPrice,
      totalValue: target.product.unitPrice * ord.quantity,
      status: ord.status,
      notes: ord.notes,
    });
  }
}
