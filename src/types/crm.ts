import type { Timestamp } from 'firebase/firestore';

export type LeadStage = 'novo' | 'contato' | 'proposta' | 'fechado';

export type InteractionType = 'ligacao' | 'email' | 'reuniao' | 'whatsapp' | 'nota';

export type TaskPriority = 'baixa' | 'media' | 'alta';

export type TaskStatus = 'pendente' | 'concluida';

export const FIELD_LIMITS = {
  id: 128,
  displayName: 120,
  leadName: 120,
  company: 120,
  phone: 40,
  email: 160,
  notes: 1000,
  interactionSummary: 2000,
  taskTitle: 200,
  dateString: 25,
  productName: 120,
  sku: 60,
  productNotes: 500,
  customerName: 120,
  orderNotes: 500,
  movementReason: 300,
  maxValue: 1_000_000_000,
  maxPosition: 1_000_000,
  maxStock: 1_000_000,
  maxMinStock: 100_000,
} as const;

export const LOW_STOCK_THRESHOLD = 5;

export type OrderStatus = 'pendente' | 'pago' | 'entregue';

export type StockMovementType = 'entrada' | 'saida' | 'saida_pedido';

export interface Product {
  id: string;
  ownerId: string;
  name: string;
  sku: string;
  unitPrice: number;
  stockQuantity: number;
  minStock: number;
  notes: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface ProductInput {
  name: string;
  sku: string;
  unitPrice: number;
  stockQuantity: number;
  minStock: number;
  notes: string;
}

export interface StockMovement {
  id: string;
  ownerId: string;
  productId: string;
  productName: string;
  type: StockMovementType;
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  orderId: string;
  createdAt?: Timestamp | null;
}

export interface Order {
  id: string;
  ownerId: string;
  customerName: string;
  leadId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalValue: number;
  status: OrderStatus;
  notes: string;
  orderMonth: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface OrderInput {
  customerName: string;
  leadId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  totalValue: number;
  status: OrderStatus;
  notes: string;
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pendente: 'Pendente',
  pago: 'Pago',
  entregue: 'Entregue',
};

export const MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  entrada: 'Entrada',
  saida: 'Saída manual',
  saida_pedido: 'Saída por pedido',
};

export const MONTH_REGEX = /^[0-9]{4}-[0-9]{2}$/;

export interface UserProfile {
  ownerId: string;
  displayName: string;
  monthlyGoal: number;
  updatedAt?: Timestamp | null;
}

export interface Lead {
  id: string;
  ownerId: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  stage: LeadStage;
  value: number;
  notes: string;
  position: number;
  createdMonth: string;
  closedMonth: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface LeadInput {
  name: string;
  company: string;
  phone: string;
  email: string;
  stage: LeadStage;
  value: number;
  notes: string;
  createdMonth?: string;
  closedMonth?: string;
}

export interface Interaction {
  id: string;
  ownerId: string;
  leadId: string;
  type: InteractionType;
  summary: string;
  interactionDate: string;
  createdAt?: Timestamp | null;
}

export interface InteractionInput {
  type: InteractionType;
  summary: string;
  interactionDate: string;
}

export interface FollowUpTask {
  id: string;
  ownerId: string;
  leadId: string;
  leadName: string;
  title: string;
  notes: string;
  dueDate: string;
  priority: TaskPriority;
  status: TaskStatus;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface TaskInput {
  leadId: string;
  leadName: string;
  title: string;
  notes: string;
  dueDate: string;
  priority: TaskPriority;
}

export interface StageConfig {
  id: LeadStage;
  label: string;
  description: string;
  dotColor: string;
  textColor: string;
}

export const STAGES: StageConfig[] = [
  {
    id: 'novo',
    label: 'Novo',
    description: 'Leads recém-chegados aguardando triagem',
    dotColor: '#64748B',
    textColor: 'text-slate-700',
  },
  {
    id: 'contato',
    label: 'Contato',
    description: 'Primeiro contato e qualificação em andamento',
    dotColor: '#1D4ED8',
    textColor: 'text-blue-700',
  },
  {
    id: 'proposta',
    label: 'Proposta',
    description: 'Proposta comercial enviada e em negociação',
    dotColor: '#B45309',
    textColor: 'text-amber-700',
  },
  {
    id: 'fechado',
    label: 'Fechado',
    description: 'Negócios ganhos e contabilizados na receita',
    dotColor: '#15803D',
    textColor: 'text-emerald-700',
  },
];

export const STAGE_LABELS: Record<LeadStage, string> = {
  novo: 'Novo',
  contato: 'Contato',
  proposta: 'Proposta',
  fechado: 'Fechado',
};

export const INTERACTION_LABELS: Record<InteractionType, string> = {
  ligacao: 'Ligação',
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  reuniao: 'Reunião',
  nota: 'Nota interna',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
};

export interface MonthlyReportRow {
  monthKey: string;
  monthLabel: string;
  shortLabel: string;
  newLeadsCount: number;
  closedDealsCount: number;
  closedRevenue: number;
  conversionRate: number;
  avgTicket: number;
  goal: number;
}
