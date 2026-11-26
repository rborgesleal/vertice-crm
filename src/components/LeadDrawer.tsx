import React, { useEffect, useState } from 'react';
import {
  BellRing,
  CheckCircle2,
  Clock,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Trash2,
  Users,
  FileText,
  X,
} from 'lucide-react';
import {
  FIELD_LIMITS,
  INTERACTION_LABELS,
  PRIORITY_LABELS,
  STAGES,
  type FollowUpTask,
  type Interaction,
  type InteractionInput,
  type InteractionType,
  type Lead,
  type LeadInput,
  type LeadStage,
  type TaskInput,
  type TaskPriority,
} from '../types/crm';
import {
  addInteraction,
  completeTask,
  createTask,
  deleteInteraction,
  deleteTask,
  rescheduleTask,
  subscribeInteractions,
} from '../services/crmService';
import {
  addHoursToLocalDatetime,
  formatCurrency,
  formatDateTime,
  formatRelativeDue,
  isTaskOverdue,
  toLocalDatetimeInputValue,
} from '../utils/formatters';

interface LeadDrawerProps {
  uid: string;
  lead: Lead;
  tasks: FollowUpTask[];
  onClose: () => void;
  onUpdateLead: (lead: Lead, input: LeadInput, pendingTasks: FollowUpTask[]) => Promise<void>;
  onDeleteLead: (lead: Lead, allLeadTasks: FollowUpTask[]) => Promise<void>;
  onQuickMoveStage: (lead: Lead, stage: LeadStage) => Promise<void>;
}

type DrawerTab = 'interacoes' | 'followups' | 'dados';

const INTERACTION_TYPES: InteractionType[] = ['ligacao', 'whatsapp', 'email', 'reuniao', 'nota'];

function InteractionIcon({ type }: { type: InteractionType }) {
  switch (type) {
    case 'ligacao':
      return <Phone className="w-3.5 h-3.5 text-[#1D4ED8]" />;
    case 'whatsapp':
      return <MessageSquare className="w-3.5 h-3.5 text-[#15803D]" />;
    case 'email':
      return <Mail className="w-3.5 h-3.5 text-[#4B5563]" />;
    case 'reuniao':
      return <Users className="w-3.5 h-3.5 text-[#B45309]" />;
    default:
      return <FileText className="w-3.5 h-3.5 text-[#6B7280]" />;
  }
}

export function LeadDrawer({
  uid,
  lead,
  tasks,
  onClose,
  onUpdateLead,
  onDeleteLead,
  onQuickMoveStage,
}: LeadDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>('interacoes');
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loadingInteractions, setLoadingInteractions] = useState(true);

  // New interaction form state
  const [intType, setIntType] = useState<InteractionType>('ligacao');
  const [intSummary, setIntSummary] = useState('');
  const [intDate, setIntDate] = useState(() => toLocalDatetimeInputValue());
  const [savingInt, setSavingInt] = useState(false);

  // New follow-up task form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskNotes, setTaskNotes] = useState('');
  const [taskDue, setTaskDue] = useState(() =>
    toLocalDatetimeInputValue(new Date(Date.now() + 1000 * 60 * 60 * 24)),
  );
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('media');
  const [savingTask, setSavingTask] = useState(false);

  // Editable lead details state
  const [editName, setEditName] = useState(lead.name);
  const [editCompany, setEditCompany] = useState(lead.company);
  const [editPhone, setEditPhone] = useState(lead.phone);
  const [editEmail, setEditEmail] = useState(lead.email);
  const [editValue, setEditValue] = useState(String(lead.value));
  const [editStage, setEditStage] = useState<LeadStage>(lead.stage);
  const [editNotes, setEditNotes] = useState(lead.notes);
  const [savingLead, setSavingLead] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletingLead, setDeletingLead] = useState(false);

  const leadTasks = tasks.filter((t) => t.leadId === lead.id);
  const pendingLeadTasks = leadTasks.filter((t) => t.status === 'pendente');

  useEffect(() => {
    setEditName(lead.name);
    setEditCompany(lead.company);
    setEditPhone(lead.phone);
    setEditEmail(lead.email);
    setEditValue(String(lead.value));
    setEditStage(lead.stage);
    setEditNotes(lead.notes);
    setConfirmDelete(false);
  }, [lead]);

  useEffect(() => {
    setLoadingInteractions(true);
    const unsub = subscribeInteractions(uid, lead.id, (items) => {
      setInteractions(items);
      setLoadingInteractions(false);
    });
    return () => unsub();
  }, [uid, lead.id]);

  async function handleAddInteraction(e: React.FormEvent) {
    e.preventDefault();
    if (!intSummary.trim()) return;
    setSavingInt(true);
    try {
      const payload: InteractionInput = {
        type: intType,
        summary: intSummary.trim(),
        interactionDate: intDate || toLocalDatetimeInputValue(),
      };
      await addInteraction(uid, lead.id, payload);
      setIntSummary('');
      setIntDate(toLocalDatetimeInputValue());
    } finally {
      setSavingInt(false);
    }
  }

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    setSavingTask(true);
    try {
      const payload: TaskInput = {
        leadId: lead.id,
        leadName: lead.name,
        title: taskTitle.trim(),
        notes: taskNotes.trim(),
        dueDate: taskDue || toLocalDatetimeInputValue(),
        priority: taskPriority,
      };
      await createTask(uid, payload);
      setTaskTitle('');
      setTaskNotes('');
      setTaskDue(toLocalDatetimeInputValue(new Date(Date.now() + 1000 * 60 * 60 * 24)));
    } finally {
      setSavingTask(false);
    }
  }

  async function handleSaveLead(e: React.FormEvent) {
    e.preventDefault();
    if (!editName.trim()) return;
    setSavingLead(true);
    try {
      const numericVal = Number(editValue.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
      await onUpdateLead(
        lead,
        {
          name: editName.trim(),
          company: editCompany.trim(),
          phone: editPhone.trim(),
          email: editEmail.trim(),
          stage: editStage,
          value: numericVal,
          notes: editNotes.trim(),
        },
        pendingLeadTasks,
      );
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 2500);
    } finally {
      setSavingLead(false);
    }
  }

  async function handleConfirmDelete() {
    setDeletingLead(true);
    try {
      await onDeleteLead(lead, leadTasks);
      onClose();
    } finally {
      setDeletingLead(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-[#111827]/35 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={`Detalhes do lead ${lead.name}`}
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <aside className="relative z-10 w-full max-w-xl bg-white h-full border-l border-[#E5E7EB] flex flex-col shadow-xl">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E5E7EB]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-[#111827] truncate">{lead.name}</h2>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B7280] mt-1">
                {lead.company && <span>{lead.company}</span>}
                {lead.company && <span aria-hidden="true">·</span>}
                <span className="font-mono tabular-nums font-medium text-[#111827]">
                  {formatCurrency(lead.value)}
                </span>
                {lead.phone && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{lead.phone}</span>
                  </>
                )}
                {lead.email && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{lead.email}</span>
                  </>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar painel do lead"
              className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Stage Switcher */}
          <div className="mt-4 grid grid-cols-4 gap-1 p-1 bg-[#F3F4F6] rounded-lg">
            {STAGES.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => void onQuickMoveStage(lead, st.id)}
                className={`py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  lead.stage === st.id
                    ? 'bg-white text-[#1D4ED8] shadow-xs'
                    : 'text-[#4B5563] hover:text-[#111827]'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Section Tabs */}
        <div className="px-6 border-b border-[#E5E7EB] flex items-center gap-6">
          <button
            type="button"
            onClick={() => setActiveTab('interacoes')}
            className={`py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'interacoes'
                ? 'border-[#1D4ED8] text-[#1D4ED8]'
                : 'border-transparent text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            Interações ({interactions.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('followups')}
            className={`py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'followups'
                ? 'border-[#1D4ED8] text-[#1D4ED8]'
                : 'border-transparent text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            Follow-ups ({pendingLeadTasks.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('dados')}
            className={`py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'dados'
                ? 'border-[#1D4ED8] text-[#1D4ED8]'
                : 'border-transparent text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            Dados do Lead
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'interacoes' && (
            <div className="space-y-6">
              <form
                onSubmit={handleAddInteraction}
                className="bg-[#F8F9FA] border border-[#E5E7EB] rounded-xl p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1 flex-wrap">
                    {INTERACTION_TYPES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setIntType(t)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                          intType === t
                            ? 'bg-[#1D4ED8] text-white'
                            : 'bg-white text-[#4B5563] border border-[#E5E7EB] hover:text-[#111827]'
                        }`}
                      >
                        {INTERACTION_LABELS[t]}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  rows={3}
                  required
                  maxLength={FIELD_LIMITS.interactionSummary}
                  value={intSummary}
                  onChange={(e) => setIntSummary(e.target.value)}
                  placeholder="Registre o que foi conversado, objeções ou próximos passos..."
                  className="w-full px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/15 resize-none"
                />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <input
                    type="datetime-local"
                    value={intDate}
                    onChange={(e) => setIntDate(e.target.value)}
                    className="px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                  />
                  <button
                    type="submit"
                    disabled={savingInt || !intSummary.trim()}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1D4ED8] hover:bg-[#1E40AF] disabled:opacity-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {savingInt ? 'Registrando...' : 'Registrar Interação'}
                  </button>
                </div>
              </form>

              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-[#6B7280]">Histórico cronológico</h3>
                {loadingInteractions ? (
                  <div className="space-y-3">
                    <div className="h-16 bg-[#F3F4F6] rounded-lg animate-pulse" />
                    <div className="h-16 bg-[#F3F4F6] rounded-lg animate-pulse" />
                  </div>
                ) : interactions.length === 0 ? (
                  <p className="text-sm text-[#6B7280] py-6 text-center border border-dashed border-[#E5E7EB] rounded-lg">
                    Nenhuma interação registrada ainda. Use o formulário acima para registrar o
                    primeiro contato.
                  </p>
                ) : (
                  <ol className="divide-y divide-[#E5E7EB] border-t border-b border-[#E5E7EB]">
                    {interactions.map((item) => (
                      <li key={item.id} className="py-3.5 flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="mt-0.5 p-1.5 rounded-lg bg-[#F8F9FA] border border-[#E5E7EB] shrink-0">
                            <InteractionIcon type={item.type} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                              <span className="font-medium text-[#111827]">
                                {INTERACTION_LABELS[item.type]}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">
                                {formatDateTime(item.interactionDate)}
                              </span>
                            </div>
                            <p className="text-sm text-[#374151] mt-1 leading-relaxed whitespace-pre-wrap break-words">
                              {item.summary}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void deleteInteraction(lead.id, item.id)}
                          title="Excluir registro"
                          aria-label="Excluir registro de interação"
                          className="p-1.5 text-[#9CA3AF] hover:text-[#B91C1C] rounded-md transition-colors cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          )}

          {activeTab === 'followups' && (
            <div className="space-y-6">
              <form
                onSubmit={handleAddTask}
                className="bg-[#F8F9FA] border border-[#E5E7EB] rounded-xl p-4 space-y-3"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-[#111827]">
                  <BellRing className="w-3.5 h-3.5 text-[#1D4ED8]" />
                  <span>Agendar lembrete de follow-up</span>
                </div>

                <input
                  type="text"
                  required
                  maxLength={FIELD_LIMITS.taskTitle}
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Ex.: Retornar ligação sobre proposta enviada"
                  className="w-full px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/15"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-[#4B5563] mb-1">
                      Data e hora do lembrete
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={taskDue}
                      onChange={(e) => setTaskDue(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#4B5563] mb-1">
                      Prioridade
                    </label>
                    <select
                      value={taskPriority}
                      onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                    >
                      <option value="baixa">Baixa</option>
                      <option value="media">Média</option>
                      <option value="alta">Alta</option>
                    </select>
                  </div>
                </div>

                <input
                  type="text"
                  maxLength={FIELD_LIMITS.notes}
                  value={taskNotes}
                  onChange={(e) => setTaskNotes(e.target.value)}
                  placeholder="Detalhes opcionais do lembrete..."
                  className="w-full px-3 py-1.5 text-xs bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                />

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingTask || !taskTitle.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1D4ED8] hover:bg-[#1E40AF] disabled:opacity-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {savingTask ? 'Agendando...' : 'Criar Lembrete'}
                  </button>
                </div>
              </form>

              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-[#6B7280]">
                  Tarefas vinculadas a {lead.name}
                </h3>
                {leadTasks.length === 0 ? (
                  <p className="text-sm text-[#6B7280] py-6 text-center border border-dashed border-[#E5E7EB] rounded-lg">
                    Nenhum follow-up agendado para este lead.
                  </p>
                ) : (
                  <ul className="divide-y divide-[#E5E7EB] border-t border-b border-[#E5E7EB]">
                    {leadTasks.map((task) => {
                      const overdue = isTaskOverdue(task.dueDate, task.status);
                      const rel = formatRelativeDue(task.dueDate);
                      return (
                        <li key={task.id} className="py-3.5 flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p
                              className={`text-sm font-medium ${
                                task.status === 'concluida'
                                  ? 'line-through text-[#9CA3AF]'
                                  : 'text-[#111827]'
                              }`}
                            >
                              {task.title}
                            </p>
                            {task.notes && (
                              <p className="text-xs text-[#6B7280] mt-0.5">{task.notes}</p>
                            )}
                            <div className="flex flex-wrap items-center gap-2 text-xs mt-1.5">
                              <span
                                className={`inline-flex items-center gap-1 font-mono tabular-nums ${
                                  task.status === 'concluida'
                                    ? 'text-[#15803D]'
                                    : overdue
                                      ? 'text-[#B91C1C] font-medium'
                                      : 'text-[#4B5563]'
                                }`}
                              >
                                <Clock className="w-3 h-3" />
                                {task.status === 'concluida' ? 'Concluída' : rel.label}
                              </span>
                              <span aria-hidden="true" className="text-[#9CA3AF]">
                                ·
                              </span>
                              <span className="text-[#6B7280]">
                                Prioridade {PRIORITY_LABELS[task.priority]}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {task.status === 'pendente' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void rescheduleTask(
                                      task.id,
                                      addHoursToLocalDatetime(task.dueDate, 24),
                                    )
                                  }
                                  className="px-2 py-1 text-[11px] font-medium text-[#4B5563] hover:text-[#111827] hover:bg-[#F3F4F6] rounded-md transition-colors cursor-pointer whitespace-nowrap"
                                >
                                  +1 dia
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void completeTask(task.id)}
                                  title="Marcar como concluída"
                                  aria-label="Concluir tarefa"
                                  className="p-1.5 text-[#15803D] hover:bg-emerald-50 rounded-md transition-colors cursor-pointer"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => void deleteTask(task.id)}
                              title="Excluir tarefa"
                              aria-label="Excluir tarefa"
                              className="p-1.5 text-[#9CA3AF] hover:text-[#B91C1C] rounded-md transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}

          {activeTab === 'dados' && (
            <form onSubmit={handleSaveLead} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1.5">Nome *</label>
                <input
                  type="text"
                  required
                  maxLength={FIELD_LIMITS.leadName}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1.5">Empresa</label>
                  <input
                    type="text"
                    maxLength={FIELD_LIMITS.company}
                    value={editCompany}
                    onChange={(e) => setEditCompany(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1.5">
                    Valor da oportunidade (R$)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1.5">
                    Telefone
                  </label>
                  <input
                    type="tel"
                    maxLength={FIELD_LIMITS.phone}
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#374151] mb-1.5">E-mail</label>
                  <input
                    type="email"
                    maxLength={FIELD_LIMITS.email}
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1.5">Estágio</label>
                <select
                  value={editStage}
                  onChange={(e) => setEditStage(e.target.value as LeadStage)}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#1D4ED8]"
                >
                  {STAGES.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1.5">
                  Observações
                </label>
                <textarea
                  rows={4}
                  maxLength={FIELD_LIMITS.notes}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#1D4ED8] resize-none"
                />
              </div>

              <div className="pt-3 flex items-center justify-between gap-3 border-t border-[#E5E7EB]">
                {!confirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#B91C1C] hover:bg-red-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Excluir lead
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#B91C1C] font-medium">Confirmar exclusão?</span>
                    <button
                      type="button"
                      disabled={deletingLead}
                      onClick={() => void handleConfirmDelete()}
                      className="px-2.5 py-1 text-xs font-medium text-white bg-[#B91C1C] hover:bg-red-800 rounded-md cursor-pointer whitespace-nowrap"
                    >
                      {deletingLead ? 'Excluindo...' : 'Sim, excluir'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="px-2.5 py-1 text-xs font-medium text-[#4B5563] hover:bg-[#F3F4F6] rounded-md cursor-pointer whitespace-nowrap"
                    >
                      Cancelar
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  {savedFeedback && (
                    <span className="text-xs font-medium text-[#15803D]">Alterações salvas</span>
                  )}
                  <button
                    type="submit"
                    disabled={savingLead}
                    className="px-4 py-2 text-sm font-medium text-white bg-[#1D4ED8] hover:bg-[#1E40AF] disabled:opacity-60 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {savingLead ? 'Salvando...' : 'Salvar Dados'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </aside>
    </div>
  );
}
