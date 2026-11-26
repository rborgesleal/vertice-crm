import { BellRing, CheckCircle2, Clock, ExternalLink, X } from 'lucide-react';
import type { FollowUpTask } from '../types/crm';
import { addHoursToLocalDatetime, formatRelativeDue } from '../utils/formatters';

interface ReminderBannerProps {
  dueTasks: FollowUpTask[];
  onOpenLead: (leadId: string) => void;
  onCompleteTask: (taskId: string) => Promise<void>;
  onSnoozeTask: (taskId: string, newDueDate: string) => Promise<void>;
  onDismiss: (taskId: string) => void;
}

export function ReminderBanner({
  dueTasks,
  onOpenLead,
  onCompleteTask,
  onSnoozeTask,
  onDismiss,
}: ReminderBannerProps) {
  if (dueTasks.length === 0) return null;

  const urgent = dueTasks[0];
  const rel = formatRelativeDue(urgent.dueDate);

  return (
    <div
      role="status"
      className="no-print mb-5 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
    >
      <div className="flex items-start sm:items-center gap-3 min-w-0">
        <div className="p-2 rounded-lg bg-amber-100/80 text-[#B45309] shrink-0">
          <BellRing className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-[#92400E]">
              Lembrete de Follow-up ({dueTasks.length}{' '}
              {dueTasks.length === 1 ? 'pendente' : 'pendentes'})
            </span>
            <span aria-hidden="true" className="text-[#B45309]">
              ·
            </span>
            <span className="font-mono tabular-nums text-[#B91C1C] font-medium">{rel.label}</span>
          </div>
          <p className="text-sm text-[#111827] font-medium truncate mt-0.5">
            {urgent.leadName}: {urgent.title}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        <button
          type="button"
          onClick={() => onOpenLead(urgent.leadId)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#111827] bg-white border border-[#E5E7EB] hover:bg-[#F9FAFB] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Abrir lead
        </button>
        <button
          type="button"
          onClick={() =>
            void onSnoozeTask(urgent.id, addHoursToLocalDatetime(urgent.dueDate, 1))
          }
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#92400E] bg-white border border-[#FDE68A] hover:bg-amber-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
        >
          <Clock className="w-3.5 h-3.5" />
          Adiar +1h
        </button>
        <button
          type="button"
          onClick={() => void onCompleteTask(urgent.id)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#15803D] hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Concluir
        </button>
        <button
          type="button"
          onClick={() => onDismiss(urgent.id)}
          aria-label="Dispensar alerta nesta sessão"
          className="p-1.5 text-[#92400E] hover:bg-amber-100 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
