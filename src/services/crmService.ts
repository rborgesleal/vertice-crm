import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  FIELD_LIMITS,
  MONTH_REGEX,
  type FollowUpTask,
  type Interaction,
  type InteractionInput,
  type Lead,
  type LeadInput,
  type LeadStage,
  type TaskInput,
  type UserProfile,
} from '../types/crm';
import {
  clampString,
  getCurrentMonthKey,
  getMonthKeyOffset,
  sanitizeNumber,
  toLocalDatetimeInputValue,
} from '../utils/formatters';

export const DEFAULT_MONTHLY_GOAL = 50000;

export function subscribeUserProfile(
  uid: string,
  onData: (profile: UserProfile | null) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const path = `users/${uid}`;
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      if (snap.exists()) {
        onData(snap.data() as UserProfile);
      } else {
        onData(null);
      }
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    },
  );
}

export async function saveUserProfile(
  uid: string,
  displayName: string,
  monthlyGoal: number,
  exists: boolean,
): Promise<void> {
  const path = `users/${uid}`;
  const cleanName = clampString(displayName || 'Usuário', FIELD_LIMITS.displayName);
  const cleanGoal = sanitizeNumber(monthlyGoal, 0, FIELD_LIMITS.maxValue);
  try {
    if (exists) {
      await updateDoc(doc(db, 'users', uid), {
        displayName: cleanName,
        monthlyGoal: cleanGoal,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'users', uid), {
        ownerId: uid,
        displayName: cleanName,
        monthlyGoal: cleanGoal,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, exists ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export function subscribeLeads(
  uid: string,
  onData: (leads: Lead[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const path = 'leads';
  const q = query(collection(db, path), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: Lead[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Lead, 'id'>),
      }));
      items.sort((a, b) => a.position - b.position);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    },
  );
}

export async function createLead(
  uid: string,
  input: LeadInput,
  position: number,
): Promise<string> {
  const path = 'leads';
  const currentMonth = getCurrentMonthKey();
  const createdMonth =
    input.createdMonth && MONTH_REGEX.test(input.createdMonth)
      ? input.createdMonth
      : currentMonth;
  const closedMonth =
    input.stage === 'fechado'
      ? input.closedMonth && MONTH_REGEX.test(input.closedMonth)
        ? input.closedMonth
        : currentMonth
      : '';

  const payload = {
    ownerId: uid,
    name: clampString(input.name, FIELD_LIMITS.leadName) || 'Lead sem nome',
    company: clampString(input.company, FIELD_LIMITS.company),
    phone: clampString(input.phone, FIELD_LIMITS.phone),
    email: clampString(input.email, FIELD_LIMITS.email),
    stage: input.stage,
    value: sanitizeNumber(input.value, 0, FIELD_LIMITS.maxValue),
    notes: clampString(input.notes, FIELD_LIMITS.notes),
    position: sanitizeNumber(position, 0, FIELD_LIMITS.maxPosition),
    createdMonth,
    closedMonth,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const ref = await addDoc(collection(db, path), payload);
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function moveLeadStage(
  leadId: string,
  targetStage: LeadStage,
  targetPosition: number,
  existingClosedMonth: string,
): Promise<void> {
  const path = `leads/${leadId}`;
  const closedMonth =
    targetStage === 'fechado'
      ? existingClosedMonth && MONTH_REGEX.test(existingClosedMonth)
        ? existingClosedMonth
        : getCurrentMonthKey()
      : '';

  try {
    await updateDoc(doc(db, 'leads', leadId), {
      stage: targetStage,
      position: sanitizeNumber(targetPosition, 0, FIELD_LIMITS.maxPosition),
      closedMonth,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateLeadDetails(
  lead: Lead,
  input: LeadInput,
  pendingTasksForLead: FollowUpTask[],
): Promise<void> {
  const path = `leads/${lead.id}`;
  const cleanName = clampString(input.name, FIELD_LIMITS.leadName) || lead.name;
  const closedMonth =
    input.stage === 'fechado'
      ? input.closedMonth && MONTH_REGEX.test(input.closedMonth)
        ? input.closedMonth
        : lead.closedMonth || getCurrentMonthKey()
      : '';

  try {
    await updateDoc(doc(db, 'leads', lead.id), {
      name: cleanName,
      company: clampString(input.company, FIELD_LIMITS.company),
      phone: clampString(input.phone, FIELD_LIMITS.phone),
      email: clampString(input.email, FIELD_LIMITS.email),
      stage: input.stage,
      value: sanitizeNumber(input.value, 0, FIELD_LIMITS.maxValue),
      notes: clampString(input.notes, FIELD_LIMITS.notes),
      closedMonth,
      updatedAt: serverTimestamp(),
    });

    if (cleanName !== lead.name && pendingTasksForLead.length > 0) {
      await Promise.all(
        pendingTasksForLead.map((t) =>
          updateDoc(doc(db, 'tasks', t.id), {
            leadName: cleanName,
            updatedAt: serverTimestamp(),
          }),
        ),
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteLeadCascade(
  uid: string,
  leadId: string,
  tasksForLead: FollowUpTask[],
): Promise<void> {
  const interactionsPath = `leads/${leadId}/interactions`;
  try {
    // Delete interactions first while parent lead still exists (Master Gate requirement)
    const intQuery = query(
      collection(db, 'leads', leadId, 'interactions'),
      where('ownerId', '==', uid),
    );
    const intSnap = await getDocs(intQuery);
    await Promise.all(intSnap.docs.map((d) => deleteDoc(d.ref)));

    // Delete linked tasks
    await Promise.all(tasksForLead.map((t) => deleteDoc(doc(db, 'tasks', t.id))));

    // Finally delete the lead
    await deleteDoc(doc(db, 'leads', leadId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, interactionsPath);
  }
}

export function subscribeInteractions(
  uid: string,
  leadId: string,
  onData: (interactions: Interaction[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const path = `leads/${leadId}/interactions`;
  const q = query(collection(db, 'leads', leadId, 'interactions'), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: Interaction[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Interaction, 'id'>),
      }));
      items.sort((a, b) => b.interactionDate.localeCompare(a.interactionDate));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    },
  );
}

export async function addInteraction(
  uid: string,
  leadId: string,
  input: InteractionInput,
): Promise<string> {
  const path = `leads/${leadId}/interactions`;
  const summary = clampString(input.summary, FIELD_LIMITS.interactionSummary);
  if (!summary) {
    throw new Error('O resumo da interação é obrigatório.');
  }
  const interactionDate = clampString(
    input.interactionDate || toLocalDatetimeInputValue(),
    FIELD_LIMITS.dateString,
  );

  try {
    const ref = await addDoc(collection(db, 'leads', leadId, 'interactions'), {
      ownerId: uid,
      leadId,
      type: input.type,
      summary,
      interactionDate,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteInteraction(leadId: string, interactionId: string): Promise<void> {
  const path = `leads/${leadId}/interactions/${interactionId}`;
  try {
    await deleteDoc(doc(db, 'leads', leadId, 'interactions', interactionId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeTasks(
  uid: string,
  onData: (tasks: FollowUpTask[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const path = 'tasks';
  const q = query(collection(db, path), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: FollowUpTask[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<FollowUpTask, 'id'>),
      }));
      items.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    },
  );
}

export async function createTask(uid: string, input: TaskInput): Promise<string> {
  const path = 'tasks';
  const title = clampString(input.title, FIELD_LIMITS.taskTitle);
  if (!title) {
    throw new Error('O título da tarefa é obrigatório.');
  }
  const dueDate = clampString(
    input.dueDate || toLocalDatetimeInputValue(),
    FIELD_LIMITS.dateString,
  );

  try {
    const ref = await addDoc(collection(db, path), {
      ownerId: uid,
      leadId: input.leadId,
      leadName: clampString(input.leadName, FIELD_LIMITS.leadName) || 'Lead',
      title,
      notes: clampString(input.notes, FIELD_LIMITS.notes),
      dueDate,
      priority: input.priority,
      status: 'pendente',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function completeTask(taskId: string): Promise<void> {
  const path = `tasks/${taskId}`;
  try {
    await updateDoc(doc(db, 'tasks', taskId), {
      status: 'concluida',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function rescheduleTask(taskId: string, newDueDate: string): Promise<void> {
  const path = `tasks/${taskId}`;
  try {
    await updateDoc(doc(db, 'tasks', taskId), {
      dueDate: clampString(newDueDate, FIELD_LIMITS.dateString),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateTaskDetails(
  taskId: string,
  input: Pick<TaskInput, 'title' | 'notes' | 'dueDate' | 'priority'>,
): Promise<void> {
  const path = `tasks/${taskId}`;
  try {
    await updateDoc(doc(db, 'tasks', taskId), {
      title: clampString(input.title, FIELD_LIMITS.taskTitle),
      notes: clampString(input.notes, FIELD_LIMITS.notes),
      dueDate: clampString(input.dueDate, FIELD_LIMITS.dateString),
      priority: input.priority,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteTask(taskId: string): Promise<void> {
  const path = `tasks/${taskId}`;
  try {
    await deleteDoc(doc(db, 'tasks', taskId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function seedSampleCrmData(
  uid: string,
  displayName: string,
  hasProfile: boolean,
): Promise<void> {
  const m0 = getMonthKeyOffset(0);
  const m1 = getMonthKeyOffset(1);
  const m2 = getMonthKeyOffset(2);
  const m3 = getMonthKeyOffset(3);
  const m4 = getMonthKeyOffset(4);
  const m5 = getMonthKeyOffset(5);

  const sampleLeads: Array<{
    lead: LeadInput;
    position: number;
    interactions: InteractionInput[];
    task?: Omit<TaskInput, 'leadId' | 'leadName'>;
  }> = [
    {
      lead: {
        name: 'Mariana Oliveira',
        company: 'Norte Logística S.A.',
        phone: '(11) 98421-3310',
        email: 'mariana.oliveira@nortelogistica.com.br',
        stage: 'novo',
        value: 18500,
        notes: 'Solicitou demonstração da plataforma pelo formulário comercial.',
        createdMonth: m0,
        closedMonth: '',
      },
      position: 0,
      interactions: [
        {
          type: 'email',
          summary: 'Lead inbound recebido via formulário. Enviada apresentação institucional.',
          interactionDate: toLocalDatetimeInputValue(new Date(Date.now() - 1000 * 60 * 60 * 5)),
        },
      ],
      task: {
        title: 'Realizar ligação de qualificação inicial',
        notes: 'Validar número de vendedores na operação e prazo de implantação.',
        dueDate: toLocalDatetimeInputValue(new Date(Date.now() + 1000 * 60 * 45)),
        priority: 'alta',
      },
    },
    {
      lead: {
        name: 'Henrique Bastos',
        company: 'Clínica Vida Plena',
        phone: '(21) 99104-7721',
        email: 'henrique@vidaplena.med.br',
        stage: 'novo',
        value: 9200,
        notes: 'Indicação de cliente atual. Busca organizar atendimento de pacientes particulares.',
        createdMonth: m0,
        closedMonth: '',
      },
      position: 1,
      interactions: [
        {
          type: 'whatsapp',
          summary: 'Primeiro oi via WhatsApp. Confirmou interesse para reunião esta semana.',
          interactionDate: toLocalDatetimeInputValue(new Date(Date.now() - 1000 * 60 * 60 * 18)),
        },
      ],
    },
    {
      lead: {
        name: 'Camila Ferreira',
        company: 'Atlas Energia Solar',
        phone: '(31) 98750-1190',
        email: 'camila.ferreira@atlassolar.com.br',
        stage: 'contato',
        value: 26000,
        notes: 'Equipe comercial com 12 consultores. Precisa de relatórios por vendedor.',
        createdMonth: m0,
        closedMonth: '',
      },
      position: 0,
      interactions: [
        {
          type: 'ligacao',
          summary: 'Conversa de 20 minutos com a diretora comercial. Mapeamos gargalos no follow-up.',
          interactionDate: toLocalDatetimeInputValue(new Date(Date.now() - 1000 * 60 * 60 * 30)),
        },
        {
          type: 'reuniao',
          summary: 'Reunião de diagnóstico técnico com TI e Comercial. Aprovou avanço para proposta.',
          interactionDate: toLocalDatetimeInputValue(new Date(Date.now() - 1000 * 60 * 60 * 6)),
        },
      ],
      task: {
        title: 'Enviar proposta revisada com plano anual',
        notes: 'Incluir condição de pagamento parcelado e treinamento de onboarding.',
        dueDate: toLocalDatetimeInputValue(new Date(Date.now() - 1000 * 60 * 35)),
        priority: 'alta',
      },
    },
    {
      lead: {
        name: 'Rafael Mendes',
        company: 'Construtora Horizonte',
        phone: '(41) 99612-8840',
        email: 'rafael.mendes@horizontecorp.com.br',
        stage: 'contato',
        value: 14800,
        notes: 'Interessado no controle de corretores e histórico de propostas.',
        createdMonth: m1,
        closedMonth: '',
      },
      position: 1,
      interactions: [
        {
          type: 'ligacao',
          summary: 'Alinhamos requisitos básicos. Ficou de envolver o gerente de vendas.',
          interactionDate: toLocalDatetimeInputValue(new Date(Date.now() - 1000 * 60 * 60 * 72)),
        },
      ],
      task: {
        title: 'Confirmar presença do gerente na demonstração',
        notes: 'Enviar link da chamada com 1 hora de antecedência.',
        dueDate: toLocalDatetimeInputValue(new Date(Date.now() + 1000 * 60 * 60 * 24)),
        priority: 'media',
      },
    },
    {
      lead: {
        name: 'Juliana Alencar',
        company: 'Grupo Alvorada Alimentos',
        phone: '(11) 97230-5504',
        email: 'juliana.alencar@alvoradaalimentos.com.br',
        stage: 'proposta',
        value: 34000,
        notes: 'Proposta enviada no valor de R$ 34.000/ano. Aguardando validação do financeiro.',
        createdMonth: m0,
        closedMonth: '',
      },
      position: 0,
      interactions: [
        {
          type: 'reuniao',
          summary: 'Apresentação executiva da proposta comercial para diretoria.',
          interactionDate: toLocalDatetimeInputValue(new Date(Date.now() - 1000 * 60 * 60 * 48)),
        },
        {
          type: 'email',
          summary: 'Enviada minuta contratual e cronograma de implantação em 15 dias.',
          interactionDate: toLocalDatetimeInputValue(new Date(Date.now() - 1000 * 60 * 60 * 20)),
        },
      ],
      task: {
        title: 'Fazer follow-up da aprovação jurídica e financeira',
        notes: 'Verificar se restou alguma dúvida sobre cláusula de SLA.',
        dueDate: toLocalDatetimeInputValue(new Date(Date.now() + 1000 * 60 * 60 * 3)),
        priority: 'alta',
      },
    },
    {
      lead: {
        name: 'Eduardo Peixoto',
        company: 'Vanguarda Indústria Metalúrgica',
        phone: '(51) 98119-2030',
        email: 'eduardo@vanguardametal.com.br',
        stage: 'proposta',
        value: 22500,
        notes: 'Comparando com um concorrente local. Destacar agilidade de suporte.',
        createdMonth: m1,
        closedMonth: '',
      },
      position: 1,
      interactions: [
        {
          type: 'whatsapp',
          summary: 'Cliente pediu detalhamento da migração de planilhas antigas.',
          interactionDate: toLocalDatetimeInputValue(new Date(Date.now() - 1000 * 60 * 60 * 26)),
        },
      ],
      task: {
        title: 'Retornar com comparativo de implantação',
        notes: 'Reforçar que a importação inicial é assistida sem custo extra.',
        dueDate: toLocalDatetimeInputValue(new Date(Date.now() + 1000 * 60 * 60 * 48)),
        priority: 'media',
      },
    },
    {
      lead: {
        name: 'Patrícia Nogueira',
        company: 'FarmaSul Distribuidora',
        phone: '(48) 99934-1208',
        email: 'patricia@farmasul.com.br',
        stage: 'fechado',
        value: 29000,
        notes: 'Contrato assinado neste mês. Plano Corporativo anual.',
        createdMonth: m0,
        closedMonth: m0,
      },
      position: 0,
      interactions: [
        {
          type: 'reuniao',
          summary: 'Fechamento confirmado e contrato assinado digitalmente.',
          interactionDate: toLocalDatetimeInputValue(new Date(Date.now() - 1000 * 60 * 60 * 96)),
        },
      ],
    },
    {
      lead: {
        name: 'Gustavo Rezende',
        company: 'Prime Automação Industrial',
        phone: '(19) 98341-6690',
        email: 'gustavo.rezende@primeautomacao.com.br',
        stage: 'fechado',
        value: 19500,
        notes: 'Fechado após 3 reuniões técnicas. Implantação concluída.',
        createdMonth: m1,
        closedMonth: m0,
      },
      position: 1,
      interactions: [
        {
          type: 'email',
          summary: 'Pedido de compra recebido e faturamento liberado.',
          interactionDate: toLocalDatetimeInputValue(new Date(Date.now() - 1000 * 60 * 60 * 140)),
        },
      ],
    },
    {
      lead: {
        name: 'Fernanda Lacerda',
        company: 'Estúdio K Arquitetura',
        phone: '(11) 99512-4091',
        email: 'fernanda@estudiok.arq.br',
        stage: 'fechado',
        value: 38000,
        notes: 'Conta fechada no mês anterior.',
        createdMonth: m1,
        closedMonth: m1,
      },
      position: 2,
      interactions: [],
    },
    {
      lead: {
        name: 'Lucas Cavalcanti',
        company: 'Cavalcanti Transportes',
        phone: '(81) 98821-7300',
        email: 'lucas@cavalcantitransportes.com.br',
        stage: 'fechado',
        value: 44000,
        notes: 'Contrato anual fechado com 18 licenças.',
        createdMonth: m2,
        closedMonth: m2,
      },
      position: 3,
      interactions: [],
    },
    {
      lead: {
        name: 'Beatriz Sampaio',
        company: 'Sampaio Têxtil Ltda.',
        phone: '(47) 99180-3322',
        email: 'beatriz@sampaiotextil.com.br',
        stage: 'fechado',
        value: 31500,
        notes: 'Renovação + expansão de licenças.',
        createdMonth: m3,
        closedMonth: m3,
      },
      position: 4,
      interactions: [],
    },
    {
      lead: {
        name: 'Rodrigo Vasconcelos',
        company: 'AgroTech Cerrado',
        phone: '(62) 99402-1818',
        email: 'rodrigo@agrotechcerrado.com.br',
        stage: 'fechado',
        value: 27000,
        notes: 'Implantação comercial para equipe externa.',
        createdMonth: m4,
        closedMonth: m4,
      },
      position: 5,
      interactions: [],
    },
    {
      lead: {
        name: 'Aline Teixeira',
        company: 'Teixeira Engenharia',
        phone: '(31) 99208-5144',
        email: 'aline@teixeiraengenharia.com.br',
        stage: 'fechado',
        value: 24000,
        notes: 'Primeiro contrato fechado do semestre.',
        createdMonth: m5,
        closedMonth: m5,
      },
      position: 6,
      interactions: [],
    },
  ];

  // Ensure user profile has a realistic monthly goal if not yet configured
  if (!hasProfile) {
    await saveUserProfile(uid, displayName, DEFAULT_MONTHLY_GOAL, false);
  }

  // Step 1: Create all leads first so parent documents exist for Master Gate security checks
  for (const item of sampleLeads) {
    const leadId = await createLead(uid, item.lead, item.position);

    // Step 2: Add interactions for this lead
    for (const interaction of item.interactions) {
      await addInteraction(uid, leadId, interaction);
    }

    // Step 3: Add follow-up task for this lead if defined
    if (item.task) {
      await createTask(uid, {
        leadId,
        leadName: item.lead.name,
        ...item.task,
      });
    }
  }
}
