import { useEffect, useState } from 'react';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { ImportPage } from './pages/ImportPage';
import { JourneyPage } from './pages/JourneyPage';

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
          <JourneyPage onBack={() => setScreen('import')} />
        )}
      </main>

      <div className="shrink-0">
        <Footer />
      </div>
    </div>
  );
}
