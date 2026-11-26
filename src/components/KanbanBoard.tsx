import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Clock,
  GripVertical,
  Mail,
  Phone,
  Plus,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { STAGES, type FollowUpTask, type Lead, type LeadStage } from '../types/crm';
import { formatCurrency, formatRelativeDue, isTaskOverdue } from '../utils/formatters';

interface KanbanBoardProps {
  leads: Lead[];
  tasks: FollowUpTask[];
  loading: boolean;
  seeding: boolean;
  onSelectLead: (lead: Lead) => void;
  onOpenNewLead: (stage: LeadStage) => void;
  onMoveLead: (lead: Lead, targetStage: LeadStage) => Promise<void>;
  onSeedSampleData: () => Promise<void>;
}

export function KanbanBoard({
  leads,
  tasks,
  loading,
  seeding,
  onSelectLead,
  onOpenNewLead,
  onMoveLead,
  onSeedSampleData,
}: KanbanBoardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<'all' | LeadStage>('all');
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<LeadStage | null>(null);
  const [movingLeadId, setMovingLeadId] = useState<string | null>(null);

  const pendingTasksByLead = useMemo(() => {
    const map = new Map<string, FollowUpTask[]>();
    for (const t of tasks) {
      if (t.status !== 'pendente') continue;
      const list = map.get(t.leadId) ?? [];
      list.push(t);
      map.set(t.leadId, list);
    }
    return map;
  }, [tasks]);

  const filteredLeads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return leads.filter((lead) => {
      if (stageFilter !== 'all' && lead.stage !== stageFilter) return false;
      if (!q) return true;
      return (
        lead.name.toLowerCase().includes(q) ||
        lead.company.toLowerCase().includes(q) ||
        lead.email.toLowerCase().includes(q) ||
        lead.phone.toLowerCase().includes(q)
      );
    });
  }, [leads, searchQuery, stageFilter]);

  const leadsByStage = useMemo(() => {
    const grouped: Record<LeadStage, Lead[]> = {
      novo: [],
      contato: [],
      proposta: [],
      fechado: [],
    };
    for (const lead of filteredLeads) {
      grouped[lead.stage].push(lead);
    }
    return grouped;
  }, [filteredLeads]);

  const totalOpenPipeline = useMemo(
    () =>
      leads
        .filter((l) => l.stage !== 'fechado')
        .reduce((acc, l) => acc + (l.value || 0), 0),
    [leads],
  );

  const totalClosedValue = useMemo(
    () =>
      leads
        .filter((l) => l.stage === 'fechado')
        .reduce((acc, l) => acc + (l.value || 0), 0),
    [leads],
  );

  function handleDragStart(e: React.DragEvent<HTMLDivElement>, leadId: string) {
    setDraggedLeadId(leadId);
    e.dataTransfer.setData('text/plain', leadId);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragEnd() {
    setDraggedLeadId(null);
    setDragOverStage(null);
  }

  function handleDragOver(e: React.DragEvent<HTMLElement>, stage: LeadStage) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverStage !== stage) {
      setDragOverStage(stage);
    }
  }

  async function handleDrop(e: React.DragEvent<HTMLElement>, targetStage: LeadStage) {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || draggedLeadId;
    setDraggedLeadId(null);
    setDragOverStage(null);
    if (!id) return;

    const lead = leads.find((l) => l.id === id);
    if (!lead || lead.stage === targetStage) return;

    setMovingLeadId(lead.id);
    try {
      await onMoveLead(lead, targetStage);
    } finally {
      setMovingLeadId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 bg-white border border-[#E5E7EB] rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {STAGES.map((s) => (
            <div
              key={s.id}
              className="bg-white border border-[#E5E7EB] rounded-xl p-4 space-y-3 min-h-[420px]"
            >
              <div className="h-5 w-28 bg-[#F3F4F6] rounded animate-pulse" />
              <div className="h-24 bg-[#F8F9FA] rounded-lg animate-pulse" />
              <div className="h-24 bg-[#F8F9FA] rounded-lg animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-10 max-w-2xl mx-auto mt-8 text-center">
        <h2 className="text-xl font-semibold text-[#111827] mb-2">
          Seu pipeline de vendas está pronto
        </h2>
        <p className="text-sm text-[#4B5563] max-w-md mx-auto leading-relaxed mb-7">
          Cadastre seu primeiro lead manualmente ou carregue uma base de demonstração com leads,
          interações, tarefas de follow-up e histórico de 6 meses para explorar os relatórios.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => onOpenNewLead('novo')}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#1D4ED8] hover:bg-[#1E40AF] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Criar primeiro lead
          </button>
          <button
            type="button"
            onClick={onSeedSampleData}
            disabled={seeding}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[#374151] bg-white border border-[#D1D5DB] hover:bg-[#F9FAFB] disabled:opacity-60 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4 text-[#1D4ED8]" />
            {seeding ? 'Carregando base de exemplo...' : 'Carregar dados de demonstração'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Workspace Toolbar: Search, Stage Filter, and Quiet Summary Metrics */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-[#E5E7EB]">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome, empresa, e-mail ou telefone..."
              className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-[#E5E7EB] rounded-lg text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/15 transition-colors"
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

          <div
            role="group"
            aria-label="Filtrar por estágio"
            className="inline-flex items-center gap-1 p-1 bg-[#F3F4F6] rounded-lg overflow-x-auto"
          >
            <button
              type="button"
              onClick={() => setStageFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                stageFilter === 'all'
                  ? 'bg-white text-[#111827] shadow-xs'
                  : 'text-[#4B5563] hover:text-[#111827]'
              }`}
            >
              Todos
            </button>
            {STAGES.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStageFilter(st.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  stageFilter === st.id
                    ? 'bg-white text-[#111827] shadow-xs'
                    : 'text-[#4B5563] hover:text-[#111827]'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-[#6B7280] shrink-0">
          <div>
            <span>Em aberto: </span>
            <strong className="font-mono tabular-nums font-semibold text-[#111827]">
              {formatCurrency(totalOpenPipeline)}
            </strong>
          </div>
          <span aria-hidden="true">·</span>
          <div>
            <span>Fechado: </span>
            <strong className="font-mono tabular-nums font-semibold text-[#15803D]">
              {formatCurrency(totalClosedValue)}
            </strong>
          </div>
        </div>
      </div>

      {/* Kanban Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
        {STAGES.map((stage) => {
          const stageLeads = leadsByStage[stage.id];
          const stageTotal = stageLeads.reduce((sum, l) => sum + (l.value || 0), 0);
          const isDropTarget = dragOverStage === stage.id;

          return (
            <section
              key={stage.id}
              onDragOver={(e) => handleDragOver(e, stage.id)}
              onDragLeave={() => {
                if (dragOverStage === stage.id) setDragOverStage(null);
              }}
              onDrop={(e) => void handleDrop(e, stage.id)}
              aria-label={`Coluna ${stage.label}`}
              className={`rounded-xl border transition-colors min-h-[500px] flex flex-col ${
                isDropTarget
                  ? 'bg-[#EFF6FF]/60 border-[#1D4ED8] ring-2 ring-[#1D4ED8]/15'
                  : 'bg-[#F3F4F6]/70 border-[#E5E7EB]'
              }`}
            >
              {/* Column Header */}
              <div className="px-4 py-3.5 border-b border-[#E5E7EB] flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-[#111827] truncate">{stage.label}</h2>
                    <span className="text-xs font-mono tabular-nums text-[#6B7280]">
                      {stageLeads.length}
                    </span>
                  </div>
                  <p className="text-xs font-mono tabular-nums text-[#6B7280] mt-0.5">
                    {formatCurrency(stageTotal)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenNewLead(stage.id)}
                  title={`Adicionar lead em ${stage.label}`}
                  aria-label={`Adicionar lead em ${stage.label}`}
                  className="p-1.5 rounded-lg text-[#4B5563] hover:text-[#111827] hover:bg-white border border-transparent hover:border-[#E5E7EB] transition-colors cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Cards List */}
              <div className="p-3 space-y-2.5 flex-1">
                {stageLeads.length === 0 ? (
                  <div className="py-10 px-4 text-center border border-dashed border-[#D1D5DB] rounded-lg">
                    <p className="text-xs text-[#6B7280]">
                      {isDropTarget
                        ? `Solte o lead em ${stage.label}`
                        : 'Nenhum lead nesta coluna'}
                    </p>
                  </div>
                ) : (
                  stageLeads.map((lead) => {
                    const leadTasks = pendingTasksByLead.get(lead.id) ?? [];
                    const nextTask = leadTasks[0];
                    const hasOverdue = nextTask
                      ? isTaskOverdue(nextTask.dueDate, nextTask.status)
                      : false;
                    const dueInfo = nextTask ? formatRelativeDue(nextTask.dueDate) : null;
                    const isDragging = draggedLeadId === lead.id;
                    const isMoving = movingLeadId === lead.id;

                    return (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, lead.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => onSelectLead(lead)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onSelectLead(lead);
                          }
                        }}
                        className={`group bg-white border border-[#E5E7EB] hover:border-[#9CA3AF] rounded-lg p-3.5 transition-all cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] ${
                          isDragging ? 'opacity-40 scale-[0.98]' : 'opacity-100'
                        } ${isMoving ? 'opacity-60' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-[#111827] truncate group-hover:text-[#1D4ED8] transition-colors">
                              {lead.name}
                            </h3>
                            {lead.company && (
                              <p className="text-xs text-[#6B7280] truncate mt-0.5">
                                {lead.company}
                              </p>
                            )}
                          </div>
                          <GripVertical
                            className="w-4 h-4 text-[#D1D5DB] group-hover:text-[#9CA3AF] shrink-0 mt-0.5 cursor-grab"
                            aria-hidden="true"
                          />
                        </div>

                        <div className="mt-2.5 flex items-baseline justify-between gap-2">
                          <span className="text-sm font-mono tabular-nums font-semibold text-[#111827]">
                            {formatCurrency(lead.value)}
                          </span>
                          <span className="text-[11px] text-[#9CA3AF] font-mono tabular-nums">
                            {lead.stage === 'fechado' && lead.closedMonth
                              ? `Fechado ${lead.closedMonth}`
                              : `Entrada ${lead.createdMonth}`}
                          </span>
                        </div>

                        {(lead.phone || lead.email) && (
                          <div className="mt-2.5 pt-2.5 border-t border-[#F3F4F6] space-y-1 text-xs text-[#4B5563]">
                            {lead.phone && (
                              <div className="flex items-center gap-1.5 truncate">
                                <Phone className="w-3 h-3 text-[#9CA3AF] shrink-0" />
                                <span className="truncate font-mono tabular-nums text-[11px]">
                                  {lead.phone}
                                </span>
                              </div>
                            )}
                            {lead.email && (
                              <div className="flex items-center gap-1.5 truncate">
                                <Mail className="w-3 h-3 text-[#9CA3AF] shrink-0" />
                                <span className="truncate text-[11px]">{lead.email}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {nextTask && dueInfo && (
                          <div
                            className={`mt-2.5 pt-2 border-t border-[#F3F4F6] flex items-center gap-1.5 text-[11px] font-medium ${
                              hasOverdue
                                ? 'text-[#B91C1C]'
                                : dueInfo.state === 'today'
                                  ? 'text-[#B45309]'
                                  : 'text-[#4B5563]'
                            }`}
                          >
                            {hasOverdue ? (
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            ) : (
                              <Clock className="w-3.5 h-3.5 shrink-0" />
                            )}
                            <span className="truncate">
                              {dueInfo.label} · {nextTask.title}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
