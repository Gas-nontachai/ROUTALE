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
    <div className="flex h-dvh w-full flex-col overflow-hidden">
      <div className="shrink-0">
        <Navbar
          isDark={isDark}
          onToggleTheme={() => setIsDark((prev) => !prev)}
        />
      </div>

      <main className="min-h-0 w-full flex-1 overflow-hidden p-2">
        {screen === 'import' ? (
          <ImportPage onPreview={() => setScreen('world')} />
        ) : (
          <JourneyPage onBack={() => setScreen('import')} />
        )}
      </main>

      <div className="shrink-0 max-lg:hidden">
        <Footer />
      </div>
    </div>
  );
}
