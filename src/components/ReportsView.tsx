import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Check, Download, Pencil, Printer, X } from 'lucide-react';
import { STAGES, type Lead, type MonthlyReportRow } from '../types/crm';
import {
  exportMonthlyReportCsv,
  formatCompactCurrency,
  formatCurrency,
  formatCurrencyExact,
  formatMonthLabel,
  formatMonthShort,
  getCurrentMonthKey,
  getLastNMonths,
} from '../utils/formatters';

interface ReportsViewProps {
  leads: Lead[];
  monthlyGoal: number;
  onSaveGoal: (newGoal: number) => Promise<void>;
}

export function ReportsView({ leads, monthlyGoal, onSaveGoal }: ReportsViewProps) {
  const monthKeys = useMemo(() => {
    const base = new Set(getLastNMonths(6));
    for (const l of leads) {
      if (l.createdMonth) base.add(l.createdMonth);
      if (l.closedMonth) base.add(l.closedMonth);
    }
    return Array.from(base).sort();
  }, [leads]);

  const recent6Keys = useMemo(() => monthKeys.slice(-6), [monthKeys]);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getCurrentMonthKey());

  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(String(monthlyGoal));
  const [savingGoal, setSavingGoal] = useState(false);

  const monthlyRows: MonthlyReportRow[] = useMemo(() => {
    return recent6Keys.map((monthKey) => {
      const createdInMonth = leads.filter((l) => l.createdMonth === monthKey);
      const closedInMonth = leads.filter(
        (l) => l.stage === 'fechado' && l.closedMonth === monthKey,
      );
      const closedRevenue = closedInMonth.reduce((sum, l) => sum + (l.value || 0), 0);
      const denominator = Math.max(createdInMonth.length, closedInMonth.length);
      const conversionRate = denominator > 0 ? (closedInMonth.length / denominator) * 100 : 0;
      const avgTicket = closedInMonth.length > 0 ? closedRevenue / closedInMonth.length : 0;

      return {
        monthKey,
        monthLabel: formatMonthLabel(monthKey),
        shortLabel: formatMonthShort(monthKey),
        newLeadsCount: createdInMonth.length,
        closedDealsCount: closedInMonth.length,
        closedRevenue,
        conversionRate,
        avgTicket,
        goal: monthlyGoal,
      };
    });
  }, [leads, recent6Keys, monthlyGoal]);

  const activeMonthRow = useMemo(() => {
    const found = monthlyRows.find((r) => r.monthKey === selectedMonth);
    if (found) return found;
    return (
      monthlyRows[monthlyRows.length - 1] ?? {
        monthKey: selectedMonth,
        monthLabel: formatMonthLabel(selectedMonth),
        shortLabel: formatMonthShort(selectedMonth),
        newLeadsCount: 0,
        closedDealsCount: 0,
        closedRevenue: 0,
        conversionRate: 0,
        avgTicket: 0,
        goal: monthlyGoal,
      }
    );
  }, [monthlyRows, selectedMonth, monthlyGoal]);

  const goalProgress =
    monthlyGoal > 0 ? Math.min(100, Math.round((activeMonthRow.closedRevenue / monthlyGoal) * 100)) : 0;

  const openPipelineTotal = useMemo(
    () =>
      leads
        .filter((l) => l.stage !== 'fechado')
        .reduce((sum, l) => sum + (l.value || 0), 0),
    [leads],
  );

  const openPipelineCount = useMemo(
    () => leads.filter((l) => l.stage !== 'fechado').length,
    [leads],
  );

  const stageBreakdown = useMemo(() => {
    const totalCount = Math.max(1, leads.length);
    return STAGES.map((stage) => {
      const items = leads.filter((l) => l.stage === stage.id);
      const value = items.reduce((sum, l) => sum + (l.value || 0), 0);
      return {
        ...stage,
        count: items.length,
        value,
        percent: Math.round((items.length / totalCount) * 100),
      };
    });
  }, [leads]);

  const closedDealsInSelectedMonth = useMemo(
    () => leads.filter((l) => l.stage === 'fechado' && l.closedMonth === activeMonthRow.monthKey),
    [leads, activeMonthRow.monthKey],
  );

  async function handleSaveGoal(e: React.FormEvent) {
    e.preventDefault();
    const num = Number(goalInput.replace(/[^\d.,]/g, '').replace(',', '.'));
    if (!Number.isFinite(num) || num < 0) return;
    setSavingGoal(true);
    try {
      await onSaveGoal(num);
      setEditingGoal(false);
    } finally {
      setSavingGoal(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Report Header Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#E5E7EB]">
        <div>
          <h2 className="text-base font-semibold text-[#111827]">
            Desempenho Comercial — {activeMonthRow.monthLabel}
          </h2>
          <p className="text-xs text-[#6B7280] mt-0.5">
            Consolidado mensal de receita fechada, conversão do funil e evolução dos últimos 6 meses.
          </p>
        </div>

        <div className="no-print flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Selecionar mês do relatório"
            value={activeMonthRow.monthKey}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 text-xs font-medium bg-white border border-[#D1D5DB] rounded-lg text-[#111827] focus:outline-none focus:border-[#1D4ED8]"
          >
            {[...monthlyRows].reverse().map((row) => (
              <option key={row.monthKey} value={row.monthKey}>
                {row.monthLabel}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() =>
              exportMonthlyReportCsv(
                monthlyRows,
                `relatorio-vendas-${activeMonthRow.monthKey}.csv`,
              )
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#374151] bg-white border border-[#D1D5DB] hover:bg-[#F9FAFB] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar CSV
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-[#1D4ED8] hover:bg-[#1E40AF] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimir
          </button>
        </div>
      </div>

      {/* 4-Column KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#6B7280]">Receita fechada no mês</span>
            {!editingGoal ? (
              <button
                type="button"
                onClick={() => {
                  setGoalInput(String(monthlyGoal));
                  setEditingGoal(true);
                }}
                className="no-print inline-flex items-center gap-1 text-[11px] font-medium text-[#1D4ED8] hover:underline cursor-pointer whitespace-nowrap"
              >
                <Pencil className="w-3 h-3" />
                Meta
              </button>
            ) : null}
          </div>

          <p className="text-2xl font-mono tabular-nums font-semibold text-[#111827] mt-2">
            {formatCurrency(activeMonthRow.closedRevenue)}
          </p>

          {editingGoal ? (
            <form onSubmit={handleSaveGoal} className="mt-3 flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                step="500"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                aria-label="Valor da meta mensal em reais"
                className="w-full px-2 py-1 text-xs font-mono tabular-nums border border-[#D1D5DB] rounded-md focus:outline-none focus:border-[#1D4ED8]"
              />
              <button
                type="submit"
                disabled={savingGoal}
                aria-label="Salvar meta"
                className="p-1.5 text-white bg-[#15803D] hover:bg-emerald-800 rounded-md cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setEditingGoal(false)}
                aria-label="Cancelar edição de meta"
                className="p-1.5 text-[#4B5563] hover:bg-[#F3F4F6] rounded-md cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <div className="mt-3 space-y-1.5">
              <div className="w-full h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#15803D] rounded-full transition-all"
                  style={{ width: `${goalProgress}%` }}
                />
              </div>
              <p className="text-xs text-[#6B7280] font-mono tabular-nums">
                {goalProgress}% da meta de {formatCurrency(monthlyGoal)}
              </p>
            </div>
          )}
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
          <span className="text-xs font-medium text-[#6B7280]">Taxa de conversão mensal</span>
          <p className="text-2xl font-mono tabular-nums font-semibold text-[#111827] mt-2">
            {activeMonthRow.conversionRate.toFixed(1).replace('.', ',')}%
          </p>
          <p className="text-xs text-[#6B7280] mt-3 font-mono tabular-nums">
            {activeMonthRow.closedDealsCount} fechados · {activeMonthRow.newLeadsCount} novos leads
          </p>
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
          <span className="text-xs font-medium text-[#6B7280]">Ticket médio (mês)</span>
          <p className="text-2xl font-mono tabular-nums font-semibold text-[#111827] mt-2">
            {formatCurrency(activeMonthRow.avgTicket)}
          </p>
          <p className="text-xs text-[#6B7280] mt-3">
            Valor médio por negócio ganho em {activeMonthRow.shortLabel}
          </p>
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
          <span className="text-xs font-medium text-[#6B7280]">Pipeline ativo em aberto</span>
          <p className="text-2xl font-mono tabular-nums font-semibold text-[#111827] mt-2">
            {formatCurrency(openPipelineTotal)}
          </p>
          <p className="text-xs text-[#6B7280] mt-3 font-mono tabular-nums">
            {openPipelineCount} {openPipelineCount === 1 ? 'oportunidade' : 'oportunidades'} em
            andamento
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Monthly Revenue Bar Chart */}
        <div className="xl:col-span-8 bg-white border border-[#E5E7EB] rounded-xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
            <div>
              <h3 className="text-sm font-semibold text-[#111827]">
                Evolução de Receita Mensal (Últimos 6 meses)
              </h3>
              <p className="text-xs text-[#6B7280] mt-0.5">
                Comparativo entre negócios fechados e meta mensal configurada
              </p>
            </div>
            <div className="text-xs text-[#6B7280] font-mono tabular-nums">
              Linha de meta: {formatCurrency(monthlyGoal)}
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyRows} margin={{ top: 12, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis
                  dataKey="shortLabel"
                  tick={{ fill: '#6B7280', fontSize: 12 }}
                  axisLine={{ stroke: '#E5E7EB' }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v: number) => formatCompactCurrency(v)}
                  tick={{ fill: '#6B7280', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={68}
                />
                <Tooltip
                  cursor={{ fill: '#F3F4F6' }}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E5E7EB',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: unknown) => [formatCurrencyExact(Number(value) || 0), 'Receita']}
                  labelFormatter={(label) => `Mês: ${String(label)}`}
                />
                {monthlyGoal > 0 && (
                  <ReferenceLine
                    y={monthlyGoal}
                    stroke="#15803D"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                  />
                )}
                <Bar
                  dataKey="closedRevenue"
                  name="Receita Fechada"
                  fill="#1D4ED8"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={48}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Funnel Breakdown by Stage */}
        <div className="xl:col-span-4 bg-white border border-[#E5E7EB] rounded-xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#111827]">Funil Atual por Estágio</h3>
            <p className="text-xs text-[#6B7280] mt-0.5 mb-5">
              Distribuição de volume e valor no quadro Kanban
            </p>

            <div className="space-y-4">
              {stageBreakdown.map((st) => (
                <div key={st.id} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="font-medium text-[#111827]">{st.label}</span>
                    <span className="font-mono tabular-nums text-[#4B5563]">
                      {st.count} · {formatCurrency(st.value)}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.max(st.count > 0 ? 6 : 0, st.percent)}%`,
                        backgroundColor: st.dotColor,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[#E5E7EB] flex items-center justify-between text-xs">
            <span className="text-[#6B7280]">Total de leads na base</span>
            <span className="font-mono tabular-nums font-semibold text-[#111827]">
              {leads.length}
            </span>
          </div>
        </div>
      </div>

      {/* Monthly Performance Table */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#111827]">
            Demonstrativo Mensal de Desempenho
          </h3>
          <span className="text-xs text-[#6B7280]">Valores em BRL (R$)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA] text-xs font-medium text-[#6B7280]">
                <th className="py-3 px-6">Mês</th>
                <th className="py-3 px-4 text-right">Novos Leads</th>
                <th className="py-3 px-4 text-right">Fechados</th>
                <th className="py-3 px-4 text-right">Conversão</th>
                <th className="py-3 px-4 text-right">Ticket Médio</th>
                <th className="py-3 px-6 text-right">Receita Fechada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB] text-sm">
              {[...monthlyRows].reverse().map((row) => {
                const isSelected = row.monthKey === activeMonthRow.monthKey;
                const hitGoal = monthlyGoal > 0 && row.closedRevenue >= monthlyGoal;

                return (
                  <tr
                    key={row.monthKey}
                    onClick={() => setSelectedMonth(row.monthKey)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#EFF6FF]/60' : 'hover:bg-[#F9FAFB]'
                    }`}
                  >
                    <td className="py-3 px-6 font-medium text-[#111827] whitespace-nowrap">
                      {row.monthLabel}
                      {hitGoal && (
                        <span className="ml-2 text-[11px] font-medium text-[#15803D]">
                          · Meta atingida
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-[#374151]">
                      {row.newLeadsCount}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-[#374151]">
                      {row.closedDealsCount}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-[#374151]">
                      {row.conversionRate.toFixed(1).replace('.', ',')}%
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-[#374151]">
                      {formatCurrency(row.avgTicket)}
                    </td>
                    <td className="py-3 px-6 text-right font-mono tabular-nums font-semibold text-[#111827]">
                      {formatCurrency(row.closedRevenue)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Closed Deals in Selected Month */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#111827]">
            Negócios Fechados em {activeMonthRow.monthLabel} ({closedDealsInSelectedMonth.length})
          </h3>
        </div>
        {closedDealsInSelectedMonth.length === 0 ? (
          <p className="py-8 px-6 text-center text-xs text-[#6B7280]">
            Nenhum negócio fechado registrado neste mês. Arraste leads para a coluna Fechado no
            Kanban para contabilizá-los aqui.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA] text-xs font-medium text-[#6B7280]">
                  <th className="py-3 px-6">Lead</th>
                  <th className="py-3 px-4">Empresa</th>
                  <th className="py-3 px-4">Contato</th>
                  <th className="py-3 px-6 text-right">Valor Fechado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] text-sm">
                {closedDealsInSelectedMonth.map((deal) => (
                  <tr key={deal.id} className="hover:bg-[#F9FAFB]">
                    <td className="py-3 px-6 font-medium text-[#111827]">{deal.name}</td>
                    <td className="py-3 px-4 text-[#4B5563]">{deal.company || '—'}</td>
                    <td className="py-3 px-4 text-xs text-[#6B7280]">
                      {deal.email || deal.phone || '—'}
                    </td>
                    <td className="py-3 px-6 text-right font-mono tabular-nums font-semibold text-[#15803D]">
                      {formatCurrency(deal.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
