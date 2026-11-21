import { useEffect } from 'react';
import Layout from './components/Layout';
import { ToastProvider } from './components/Toast';
import { ConfirmProvider } from './components/ConfirmModal';
import { QuotaModalProvider } from './components/QuotaModal';
import Home from './pages/Home';
import Chat from './pages/Chat';
import Coder from './pages/Coder';
import Profile from './pages/Profile';
import Files from './pages/Files';
import Vision from './pages/Vision';
import { SaveFilesProvider } from './components/SaveFilesModal';
import { navigate, useRoute } from './router';
import { useSettings } from './lib/hooks';
import { useT } from './lib/i18n';
import { applySettingsToDom, isDevMode } from './lib/utils';

const FULL_HEIGHT = new Set(['chat', 'coder', 'files', 'vision']);

function Page({ route }) {
  switch (route.segments[0]) {
    case undefined:
      return <Home />;
    case 'chat':
      return <Chat route={route} />;
    case 'coder':
      return <Coder route={route} />;
    case 'files':
      return <Files />;
    case 'vision':
      return <Vision route={route} />;
    case 'profile':
      return <Profile route={route} />;
    default:
      return <Home />;
  }
}

function Shell() {
  const route = useRoute();
  const settings = useSettings();
  const t = useT();
  const section = route.segments[0] || '';
  const fullHeight = FULL_HEIGHT.has(section);

  // tema, ukuran huruf, mode animasi → atribut <html>
  useEffect(() => {
    applySettingsToDom(settings);
  }, [settings]);

  // ?dev=1 diingat per sesi supaya tetap aktif setelah navigasi
  useEffect(() => {
    isDevMode();
  }, []);

  // judul tab + scroll ke atas saat pindah halaman
  useEffect(() => {
    const names = { '': t('nav.home'), chat: t('nav.chat'), coder: t('nav.coder'), files: t('files.title'), vision: t('nav.vision'), profile: t('nav.profile') };
    document.title = `${names[section] ?? t('nav.home')} — MyAssistant`;
    if (!fullHeight) window.scrollTo(0, 0);
  }, [section, fullHeight, t]);

  // Ctrl/Cmd+K → percakapan baru (di Coder: sesi Coder baru)
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        navigate(section === 'coder' ? '/coder' : '/chat');
        setTimeout(() => window.dispatchEvent(new Event('ma:focus-composer')), 60);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [section]);

  return (
    <Layout route={route} fullHeight={fullHeight}>
      <div key={section || 'home'} className="fade-slide h-full">
        <Page route={route} />
      </div>
    </Layout>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <QuotaModalProvider>
          <SaveFilesProvider>
            <Shell />
          </SaveFilesProvider>
        </QuotaModalProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
