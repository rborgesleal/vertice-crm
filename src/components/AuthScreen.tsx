import { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { ArrowRight, BarChart3, BellRing, Columns3, MessageSquareText } from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';

export function AuthScreen() {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleGoogleLogin() {
    setLoading(true);
    setErrorMsg(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Não foi possível concluir o login.';
      if (msg.includes('popup-closed-by-user')) {
        setErrorMsg('A janela de login foi fechada antes da conclusão. Tente novamente.');
      } else {
        setErrorMsg('Falha na autenticação com Google. Verifique se pop-ups estão liberados.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col justify-between">
      <header className="w-full max-w-6xl mx-auto px-6 py-6 flex items-center justify-between gap-8">
        <span className="text-lg font-bold tracking-tight text-[#111827] whitespace-nowrap shrink-0 font-[var(--font-display)]">
          Vértice CRM
        </span>
        <span className="text-xs text-[#6B7280] whitespace-nowrap shrink-0">
          Gestão comercial em nuvem
        </span>
      </header>

      <main className="w-full max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7 space-y-6">
          <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-bold tracking-tight text-[#111827] leading-[1.12] [text-wrap:balance]">
            Controle seu funil comercial do primeiro contato ao fechamento.
          </h1>
          <p className="text-base text-[#4B5563] max-w-xl leading-relaxed">
            Organize leads em um quadro Kanban arrastável, registre cada ligação ou e-mail no
            histórico do cliente, programe lembretes de follow-up e acompanhe o desempenho mensal
            das vendas em tempo real.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 pt-4 border-t border-[#E5E7EB]">
            <div className="flex items-start gap-3">
              <Columns3 className="w-4 h-4 text-[#1D4ED8] mt-1 shrink-0" />
              <div>
                <h2 className="text-sm font-semibold text-[#111827]">Pipeline Kanban</h2>
                <p className="text-xs text-[#6B7280] mt-0.5 leading-relaxed">
                  Arraste oportunidades entre Novo, Contato, Proposta e Fechado.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MessageSquareText className="w-4 h-4 text-[#1D4ED8] mt-1 shrink-0" />
              <div>
                <h2 className="text-sm font-semibold text-[#111827]">Histórico de Interações</h2>
                <p className="text-xs text-[#6B7280] mt-0.5 leading-relaxed">
                  Linha do tempo completa por lead com telefone, e-mail e notas.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <BellRing className="w-4 h-4 text-[#1D4ED8] mt-1 shrink-0" />
              <div>
                <h2 className="text-sm font-semibold text-[#111827]">Lembretes de Follow-up</h2>
                <p className="text-xs text-[#6B7280] mt-0.5 leading-relaxed">
                  Alertas de tarefas atrasadas ou para hoje com adiamento rápido.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <BarChart3 className="w-4 h-4 text-[#1D4ED8] mt-1 shrink-0" />
              <div>
                <h2 className="text-sm font-semibold text-[#111827]">Relatórios Mensais</h2>
                <p className="text-xs text-[#6B7280] mt-0.5 leading-relaxed">
                  Receita fechada, meta, taxa de conversão, ticket médio e CSV.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-8">
            <h2 className="text-xl font-semibold text-[#111827] mb-2">Entrar no seu workspace</h2>
            <p className="text-sm text-[#6B7280] mb-6 leading-relaxed">
              Todos os seus leads, interações, tarefas e relatórios são salvos com segurança e
              isolamento na sua conta.
            </p>

            {errorMsg && (
              <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {errorMsg}
              </div>
            )}

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-3 px-4 py-3 text-sm font-medium text-white bg-[#1D4ED8] hover:bg-[#1E40AF] disabled:opacity-60 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>{loading ? 'Conectando...' : 'Continuar com Google'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <p className="text-xs text-[#6B7280] mt-5 leading-relaxed">
              Ao entrar, seus dados comerciais ficam sincronizados automaticamente com o banco de
              dados em nuvem.
            </p>
          </div>
        </div>
      </main>

      <footer className="w-full max-w-6xl mx-auto px-6 py-6 border-t border-[#E5E7EB] flex items-center justify-between text-xs text-[#6B7280]">
        <span>Vértice CRM</span>
        <span>Dados privados por conta autenticada</span>
      </footer>
    </div>
  );
}
