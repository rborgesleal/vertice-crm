import React, { useState } from 'react';
import { X } from 'lucide-react';
import { FIELD_LIMITS, STAGES, type LeadInput, type LeadStage } from '../types/crm';

interface LeadModalProps {
  initialStage: LeadStage;
  onClose: () => void;
  onSubmit: (input: LeadInput) => Promise<void>;
}

export function LeadModal({ initialStage, onClose, onSubmit }: LeadModalProps) {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [stage, setStage] = useState<LeadStage>(initialStage);
  const [valueStr, setValueStr] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Informe o nome do lead.');
      return;
    }

    const parsedValue = Number(valueStr.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        company: company.trim(),
        phone: phone.trim(),
        email: email.trim(),
        stage,
        value: parsedValue,
        notes: notes.trim(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar lead.');
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-[#111827]/40 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-lead-title"
    >
      <div className="bg-white border border-[#E5E7EB] rounded-xl w-full max-w-lg overflow-hidden shadow-lg">
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
          <h2 id="new-lead-title" className="text-base font-semibold text-[#111827]">
            Novo Lead
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela"
            className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#374151] mb-1.5">
                Nome do lead *
              </label>
              <input
                type="text"
                required
                maxLength={FIELD_LIMITS.leadName}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Ana Paula Ferreira"
                className="w-full px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/15"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">Empresa</label>
              <input
                type="text"
                maxLength={FIELD_LIMITS.company}
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Ex.: Horizonte Tech"
                className="w-full px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/15"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">
                Valor estimado (R$)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={valueStr}
                onChange={(e) => setValueStr(e.target.value)}
                placeholder="0,00"
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/15"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">Telefone</label>
              <input
                type="tel"
                maxLength={FIELD_LIMITS.phone}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 99999-0000"
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/15"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1.5">E-mail</label>
              <input
                type="email"
                maxLength={FIELD_LIMITS.email}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contato@empresa.com.br"
                className="w-full px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/15"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">
              Estágio inicial
            </label>
            <div className="grid grid-cols-4 gap-1.5 p-1 bg-[#F3F4F6] rounded-lg">
              {STAGES.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStage(st.id)}
                  className={`py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    stage === st.id
                      ? 'bg-white text-[#111827] shadow-xs'
                      : 'text-[#4B5563] hover:text-[#111827]'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">Observações</label>
            <textarea
              rows={3}
              maxLength={FIELD_LIMITS.notes}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contexto inicial, necessidade do cliente, origem do lead..."
              className="w-full px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/15 resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[#374151] bg-white border border-[#D1D5DB] hover:bg-[#F9FAFB] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-[#1D4ED8] hover:bg-[#1E40AF] disabled:opacity-60 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              {saving ? 'Salvando...' : 'Salvar Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
