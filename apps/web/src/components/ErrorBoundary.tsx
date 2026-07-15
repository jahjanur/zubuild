import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Branded, recoverable fallback. Kept dependency-light (plain buttons + theme
 * tokens) so it renders even when higher-level UI is what crashed. Works in
 * light + dark; `fullScreen` fills the viewport (app-wide net) vs. sitting
 * inside the page area (per-route).
 */
function Fallback({ fullScreen, onReset, onReload }: { fullScreen: boolean; onReset: () => void; onReload: () => void }) {
  const { t } = useTranslation();
  return (
    <div className={`flex items-center justify-center px-4 py-10 ${fullScreen ? 'min-h-screen bg-app-bg' : 'min-h-[320px]'}`} role="alert">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-app-danger-muted text-app-danger">
          <AlertTriangle size={26} />
        </div>
        <h1 className="text-lg font-semibold text-app-primary">{t('errorBoundary.title')}</h1>
        <p className="mt-1.5 text-sm text-app-secondary">{t('errorBoundary.subtitle')}</p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-app-accent px-4 py-2.5 text-sm font-semibold text-app-accent-contrast shadow-button transition hover:bg-app-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]"
          >
            {t('errorBoundary.tryAgain')}
          </button>
          <button
            type="button"
            onClick={onReload}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[var(--border)] bg-app-surface-1 px-4 py-2.5 text-sm font-semibold text-app-primary transition hover:border-app-border-strong hover:bg-app-surface-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]"
          >
            <RefreshCw size={16} /> {t('errorBoundary.reload')}
          </button>
        </div>
      </div>
    </div>
  );
}

interface Props {
  children: ReactNode;
  /** Fill the viewport (app-wide) vs. sit inside the page content area (per-route). */
  fullScreen?: boolean;
}
interface State {
  error: Error | null;
}

/**
 * React error boundary. Catches render/lifecycle errors in the subtree, logs
 * them, and shows a recoverable fallback instead of a white screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // No remote logging service is wired into the app — console is the sink.
    // Keep the component stack so the crash is diagnosable.
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private reset = (): void => this.setState({ error: null });
  private reload = (): void => window.location.reload();

  render(): ReactNode {
    if (this.state.error) {
      return <Fallback fullScreen={!!this.props.fullScreen} onReset={this.reset} onReload={this.reload} />;
    }
    return this.props.children;
  }
}

/**
 * Route-scoped boundary: keyed by pathname so navigating to another page
 * remounts it and clears a crashed state automatically. The inline fallback
 * renders inside the layout, so the sidebar stays usable when a page crashes.
 */
export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  return <ErrorBoundary key={location.pathname}>{children}</ErrorBoundary>;
}
