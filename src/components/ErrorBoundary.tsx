import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

/** A render crash must never leave a blank white screen. The sidebar stays usable around it. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Admin page crashed', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="surface mx-auto mt-16 max-w-lg p-8 text-center" role="alert">
        <h1 className="text-xl font-semibold text-[var(--prila-ink)]">This page hit a problem</h1>
        <p className="mt-2 text-sm text-slate-500">
          Nothing was lost. Your other pages still work. Reload to try again, and if it keeps happening, share the
          details below with the team.
        </p>
        <pre className="mono mt-4 max-h-28 overflow-auto rounded-lg bg-slate-50 p-3 text-left text-xs text-slate-600">
          {this.state.error.message}
        </pre>
        <div className="mt-5 flex justify-center gap-2">
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            Reload page
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => this.setState({ error: null })}>
            Try again
          </button>
        </div>
      </div>
    );
  }
}
