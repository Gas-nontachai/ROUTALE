import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { ImportPage } from './pages/ImportPage';
import { Button } from './components/ui/button';
import { LoadingState } from './components/LoadingState';

const JourneyPage = lazy(() =>
  import('./pages/JourneyPage').then(({ JourneyPage }) => ({
    default: JourneyPage,
  })),
);

export class JourneyBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div
        role="alert"
        className="grid h-full content-center justify-items-center gap-3 p-4 text-center"
      >
        <p>
          The journey could not be loaded. Check your connection and reload to
          import your GPX again.
        </p>
        <Button onClick={() => window.location.reload()}>Reload Routale</Button>
      </div>
    ) : (
      this.props.children
    );
  }
}

type Screen = 'import' | 'world';

export default function App() {
  const [isDark, setIsDark] = useState(false);
  const [screen, setScreen] = useState<Screen>('import');

  useEffect(() => {
    if (window.location.pathname !== '/') {
      window.history.replaceState(null, '', '/');
    }
  }, []);

  return (
    <div
      data-theme={isDark ? 'dark' : 'light'}
      className="flex h-dvh w-full flex-col overflow-hidden bg-canvas text-foreground"
    >
      <div className="shrink-0">
        <Navbar
          isDark={isDark}
          onToggleTheme={() => setIsDark((prev) => !prev)}
        />
      </div>

      <a
        href="#main-content"
        className="sr-only z-[60] rounded-lg bg-surface p-3 text-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto min-h-0 w-full max-w-[1600px] flex-1 overflow-hidden p-3 sm:p-4 lg:px-6"
      >
        {screen === 'import' ? (
          <ImportPage onPreview={() => setScreen('world')} />
        ) : (
          <JourneyBoundary>
            <Suspense
              fallback={
                <div className="grid h-full place-items-center">
                  <LoadingState label="Preparing your journey…" />
                </div>
              }
            >
              <JourneyPage onBack={() => setScreen('import')} />
            </Suspense>
          </JourneyBoundary>
        )}
      </main>

      <div className="shrink-0">
        <Footer />
      </div>
    </div>
  );
}
