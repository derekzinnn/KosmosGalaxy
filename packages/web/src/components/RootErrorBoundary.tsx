import { Component, type ReactNode } from 'react';
import { ErrorState } from '@/components/states/ErrorState';

interface State {
  hasError: boolean;
}

/**
 * The last line of defence.
 *
 * Without this, an unhandled render error leaves the client staring at a blank
 * white page with no idea what happened and no way out. React still requires a
 * class component for this.
 */
export class RootErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-dvh items-center justify-center">
          <ErrorState
            title="Não conseguimos carregar esta tela"
            description="Recarregue a página. Se o problema continuar, fale com a equipe Kosmos."
            onRetry={() => window.location.reload()}
            retryLabel="Recarregar"
          />
        </div>
      );
    }

    return this.props.children;
  }
}
