import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Bell,
  BellOff,
  CheckCircle2,
  Clock,
  ExternalLink,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  FIELD_LIMITS,
  PRIORITY_LABELS,
  type FollowUpTask,
  type Lead,
  type TaskInput,
  type TaskPriority,
} from '../types/crm';
import {
  addHoursToLocalDatetime,
  formatDateTime,
  formatRelativeDue,
  isTaskDueToday,
  isTaskOverdue,
  toLocalDatetimeInputValue,
} from '../utils/formatters';

interface FollowUpsViewProps {
  leads: Lead[];
  tasks: FollowUpTask[];
  nowMs: number;
  notificationsEnabled: boolean;
  onEnableNotifications: () => void;
  onCreateTask: (input: TaskInput) => Promise<void>;
  onCompleteTask: (taskId: string) => Promise<void>;
  onSnoozeTask: (taskId: string, newDueDate: string) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onOpenLead: (leadId: string) => void;
}

type TaskFilter = 'pendentes' | 'atrasadas' | 'hoje' | 'proximas' | 'concluidas';

export function FollowUpsView({
  leads,
  tasks,
  nowMs,
  notificationsEnabled,
  onEnableNotifications,
  onCreateTask,
  onCompleteTask,
  onSnoozeTask,
  onDeleteTask,
  onOpenLead,
}: FollowUpsViewProps) {
  const [filter, setFilter] = useState<TaskFilter>('pendentes');
  const [showForm, setShowForm] = useState(false);

  const [selectedLeadId, setSelectedLeadId] = useState(() => leads[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState(() =>
    toLocalDatetimeInputValue(new Date(Date.now() + 1000 * 60 * 60 * 2)),
  );
  const [priority, setPriority] = useState<TaskPriority>('media');
  const [saving, setSaving] = useState(false);

  const counts = useMemo(() => {
    let pendentes = 0;
    let atrasadas = 0;
    let hoje = 0;
    let proximas = 0;
    let concluidas = 0;

    for (const t of tasks) {
      if (t.status === 'concluida') {
        concluidas++;
        continue;
      }
      pendentes++;
      const overdue = isTaskOverdue(t.dueDate, t.status, nowMs);
      const today = isTaskDueToday(t.dueDate, t.status);
      if (overdue) atrasadas++;
      if (today) hoje++;
      if (!overdue && !today) proximas++;
    }

    return { pendentes, atrasadas, hoje, proximas, concluidas };
  }, [tasks, nowMs]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (filter === 'concluidas') return t.status === 'concluida';
      if (t.status !== 'pendente') return false;
      if (filter === 'pendentes') return true;
      if (filter === 'atrasadas') return isTaskOverdue(t.dueDate, t.status, nowMs);
      if (filter === 'hoje') return isTaskDueToday(t.dueDate, t.status);
      return !isTaskOverdue(t.dueDate, t.status, nowMs) && !isTaskDueToday(t.dueDate, t.status);
    });
  }, [tasks, filter, nowMs]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const targetLeadId = selectedLeadId || leads[0]?.id;
    const lead = leads.find((l) => l.id === targetLeadId);
    if (!lead || !title.trim()) return;

    setSaving(true);
    try {
      await onCreateTask({
        leadId: lead.id,
        leadName: lead.name,
        title: title.trim(),
        notes: notes.trim(),
        dueDate: dueDate || toLocalDatetimeInputValue(),
        priority,
      });
      setTitle('');
      setNotes('');
      setDueDate(toLocalDatetimeInputValue(new Date(Date.now() + 1000 * 60 * 60 * 24)));
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  const filterTabs: Array<{ id: TaskFilter; label: string; count: number }> = [
    { id: 'pendentes', label: 'Pendentes', count: counts.pendentes },
    { id: 'atrasadas', label: 'Atrasadas', count: counts.atrasadas },
    { id: 'hoje', label: 'Hoje', count: counts.hoje },
    { id: 'proximas', label: 'Próximas', count: counts.proximas },
    { id: 'concluidas', label: 'Concluídas', count: counts.concluidas },
  ];

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#E5E7EB]">
        <div
          role="group"
          aria-label="Filtrar tarefas de follow-up"
          className="inline-flex items-center gap-1 p-1 bg-[#F3F4F6] rounded-lg overflow-x-auto"
        >
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filter === tab.id
                  ? 'bg-white text-[#111827] shadow-xs'
                  : 'text-[#4B5563] hover:text-[#111827]'
              }`}
            >
              {tab.label}{' '}
              <span className="font-mono tabular-nums text-[#6B7280] ml-1">{tab.count}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {typeof window !== 'undefined' && 'Notification' in window && (
            <button
              type="button"
              onClick={onEnableNotifications}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#374151] bg-white border border-[#D1D5DB] hover:bg-[#F9FAFB] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              {notificationsEnabled ? (
                <>
                  <Bell className="w-3.5 h-3.5 text-[#15803D]" />
                  Alertas do navegador ativos
                </>
              ) : (
                <>
                  <BellOff className="w-3.5 h-3.5 text-[#6B7280]" />
                  Ativar alertas no navegador
                </>
              )}
            </button>
          )}

          <button
            type="button"
            disabled={leads.length === 0}
            onClick={() => {
              if (!selectedLeadId && leads[0]) setSelectedLeadId(leads[0].id);
              setShowForm((prev) => !prev);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1D4ED8] hover:bg-[#1E40AF] disabled:opacity-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Nova Tarefa
          </button>
        </div>
      </div>

      {/* Inline Task Creator */}
      {showForm && leads.length > 0 && (
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-[#E5E7EB] rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#111827]">Novo lembrete de follow-up</h2>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs text-[#6B7280] hover:text-[#111827] cursor-pointer"
            >
              Fechar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">Lead *</label>
              <select
                required
                value={selectedLeadId || leads[0]?.id || ''}
                onChange={(e) => setSelectedLeadId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#1D4ED8]"
              >
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} {l.company ? `— ${l.company}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">
                Data e hora do lembrete *
              </label>
              <input
                type="datetime-local"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#1D4ED8]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">Prioridade</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#1D4ED8]"
              >
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-[#374151] mb-1.5">
                Ação de follow-up *
              </label>
              <input
                type="text"
                required
                maxLength={FIELD_LIMITS.taskTitle}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Confirmar recebimento da proposta por telefone"
                className="w-full px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#1D4ED8]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">
                Observações
              </label>
              <input
                type="text"
                maxLength={FIELD_LIMITS.notes}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Detalhes rápidos..."
                className="w-full px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#1D4ED8]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-xs font-medium text-[#374151] bg-white border border-[#D1D5DB] hover:bg-[#F9FAFB] rounded-lg cursor-pointer whitespace-nowrap"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="px-4 py-2 text-xs font-medium text-white bg-[#1D4ED8] hover:bg-[#1E40AF] disabled:opacity-50 rounded-lg cursor-pointer whitespace-nowrap"
            >
              {saving ? 'Salvando...' : 'Agendar Follow-up'}
            </button>
          </div>
        </form>
      )}

      {/* Task List Table */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
        {filteredTasks.length === 0 ? (
          <div className="py-12 px-6 text-center">
            <p className="text-sm font-medium text-[#111827] mb-1">
              Nenhuma tarefa encontrada neste filtro
            </p>
            <p className="text-xs text-[#6B7280] max-w-md mx-auto">
              {leads.length === 0
                ? 'Cadastre pelo menos um lead no pipeline para criar lembretes de follow-up.'
                : 'Agende tarefas com data e hora para nunca perder o ritmo de contato com seus clientes.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA] text-xs font-medium text-[#6B7280]">
                  <th className="py-3 px-4">Tarefa e Lead</th>
                  <th className="py-3 px-4">Lembrete</th>
                  <th className="py-3 px-4">Prioridade</th>
                  <th className="py-3 px-4">Situação</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] text-sm">
                {filteredTasks.map((task) => {
                  const overdue = isTaskOverdue(task.dueDate, task.status, nowMs);
                  const today = isTaskDueToday(task.dueDate, task.status);
                  const rel = formatRelativeDue(task.dueDate);

                  return (
                    <tr key={task.id} className="hover:bg-[#F9FAFB] transition-colors">
                      <td className="py-3.5 px-4 max-w-md">
                        <p
                          className={`font-medium ${
                            task.status === 'concluida'
                              ? 'line-through text-[#9CA3AF]'
                              : 'text-[#111827]'
                          }`}
                        >
                          {task.title}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B7280] mt-0.5">
                          <button
                            type="button"
                            onClick={() => onOpenLead(task.leadId)}
                            className="inline-flex items-center gap-1 text-[#1D4ED8] hover:underline cursor-pointer"
                          >
                            <span>{task.leadName}</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                          {task.notes && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="truncate max-w-xs">{task.notes}</span>
                            </>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-mono tabular-nums text-xs text-[#111827]">
                          {formatDateTime(task.dueDate)}
                        </div>
                        {task.status === 'pendente' && (
                          <div
                            className={`text-xs mt-0.5 ${
                              overdue
                                ? 'text-[#B91C1C] font-medium'
                                : today
                                  ? 'text-[#B45309] font-medium'
                                  : 'text-[#6B7280]'
                            }`}
                          >
                            {rel.label}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-xs">
                        <span
                          className={
                            task.priority === 'alta'
                              ? 'font-semibold text-[#B91C1C]'
                              : task.priority === 'media'
                                ? 'font-medium text-[#B45309]'
                                : 'text-[#6B7280]'
                          }
                        >
                          {PRIORITY_LABELS[task.priority]}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-xs">
                        {task.status === 'concluida' ? (
                          <span className="inline-flex items-center gap-1 text-[#15803D] font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Concluída
                          </span>
                        ) : overdue ? (
                          <span className="inline-flex items-center gap-1 text-[#B91C1C] font-medium">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Atrasada
                          </span>
                        ) : today ? (
                          <span className="inline-flex items-center gap-1 text-[#B45309] font-medium">
                            <Clock className="w-3.5 h-3.5" />
                            Para hoje
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[#4B5563]">
                            <Clock className="w-3.5 h-3.5" />
                            Agendada
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          {task.status === 'pendente' && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  void onSnoozeTask(
                                    task.id,
                                    addHoursToLocalDatetime(task.dueDate, 1),
                                  )
                                }
                                className="px-2 py-1 text-xs font-medium text-[#4B5563] hover:text-[#111827] hover:bg-[#F3F4F6] rounded-md transition-colors cursor-pointer whitespace-nowrap"
                              >
                                +1h
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void onSnoozeTask(
                                    task.id,
                                    addHoursToLocalDatetime(task.dueDate, 24),
                                  )
                                }
                                className="px-2 py-1 text-xs font-medium text-[#4B5563] hover:text-[#111827] hover:bg-[#F3F4F6] rounded-md transition-colors cursor-pointer whitespace-nowrap"
                              >
                                +1 dia
                              </button>
                              <button
                                type="button"
                                onClick={() => void onCompleteTask(task.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#15803D] bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors cursor-pointer whitespace-nowrap"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Concluir
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => void onDeleteTask(task.id)}
                            title="Excluir tarefa"
                            aria-label="Excluir tarefa"
                            className="p-1.5 text-[#9CA3AF] hover:text-[#B91C1C] rounded-md transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
