import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
  isQuotaError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '', isQuotaError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    const raw = error.message || 'Erro inesperado ao carregar o aplicativo.';
    const isQuotaError = raw.toLowerCase().includes('quota exceeded');
    let friendly = raw;

    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.error === 'string') {
        friendly = `${parsed.error} (${parsed.operationType ?? 'operação'} em ${parsed.path ?? 'banco de dados'})`;
      }
    } catch {
      // Keep original message
    }

    return {
      hasError: true,
      errorMessage: friendly,
      isQuotaError,
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('ErrorBoundary caught error:', error, info);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-[#E5E7EB] rounded-xl p-8">
            <div className="w-10 h-10 rounded-lg bg-red-50 text-red-700 flex items-center justify-center mb-5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-semibold text-[#111827] mb-2">
              {this.state.isQuotaError
                ? 'Limite diário do banco de dados atingido'
                : 'Ocorreu um erro de conexão ou permissão'}
            </h1>
            <p className="text-sm text-[#4B5563] leading-relaxed mb-4">
              {this.state.isQuotaError
                ? 'A cota gratuita diária do Firestore foi excedida e será redefinida automaticamente no próximo dia.'
                : 'Não foi possível concluir a operação no banco de dados. Recarregue a página ou tente entrar novamente.'}
            </p>
            <div className="bg-[#F8F9FA] border border-[#E5E7EB] rounded-lg p-3 mb-6 text-xs font-mono text-[#374151] break-words">
              {this.state.errorMessage}
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#1D4ED8] rounded-lg hover:bg-[#1E40AF] transition-colors cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className="w-4 h-4" />
              Recarregar aplicativo
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
