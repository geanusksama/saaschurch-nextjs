import { useEffect, useState } from 'react';
import { Download, Share, Plus, X } from 'lucide-react';

/**
 * Convite para instalar o app (PWA).
 *
 * Chrome/Edge/Android: guardamos o evento `beforeinstallprompt` e chamamos
 * `prompt()` no clique — o navegador só aceita a partir de um gesto do usuário.
 *
 * iOS/Safari: esse evento NÃO existe. Lá a instalação é manual (Compartilhar →
 * Adicionar à Tela de Início), então mostramos as instruções em vez do botão.
 *
 * Em qualquer caso o card some se o app já estiver rodando instalado.
 */

interface PromptDeInstalacao extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function estaInstalado() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari no iOS não implementa display-mode: standalone
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function ehIOS() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPadOS recente se identifica como Mac; o toque desempata
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export function InstallAppCard({ isDark }: { isDark: boolean }) {
  const [prompt, setPrompt] = useState<PromptDeInstalacao | null>(null);
  const [instalado, setInstalado] = useState(true); // esconde até termos certeza
  const [mostrarPassosIOS, setMostrarPassosIOS] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setInstalado(estaInstalado());
    setIos(ehIOS());

    const aoPoderInstalar = (e: Event) => {
      e.preventDefault(); // sem isso o Chrome mostra o banner dele por cima
      setPrompt(e as PromptDeInstalacao);
    };
    const aoInstalar = () => {
      setInstalado(true);
      setPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', aoPoderInstalar);
    window.addEventListener('appinstalled', aoInstalar);
    return () => {
      window.removeEventListener('beforeinstallprompt', aoPoderInstalar);
      window.removeEventListener('appinstalled', aoInstalar);
    };
  }, []);

  const textPrimary = isDark ? 'text-white' : 'text-gray-900';
  const textSub = isDark ? 'text-slate-400' : 'text-gray-500';

  // Nada a oferecer: já instalado, ou navegador que não suporta e não é iOS
  if (instalado) return null;
  if (!prompt && !ios) return null;

  const instalar = async () => {
    if (ios) {
      setMostrarPassosIOS(true);
      return;
    }
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setInstalado(true);
    setPrompt(null); // o evento é de uso único
  };

  return (
    <>
      <button onClick={instalar} className="flex items-start gap-4 group hover:opacity-80 transition-opacity text-left">
        <div
          className="flex-shrink-0 w-14 h-14 rounded-full border-2 flex items-center justify-center transition-colors"
          style={{ borderColor: '#38bdf8', background: 'rgba(56,189,248,0.10)' }}
        >
          <Download className="w-6 h-6" style={{ color: '#38bdf8' }} />
        </div>
        <div className="flex flex-col justify-center min-h-[3.5rem]">
          <h3 className={`text-lg font-bold mb-1 ${textPrimary}`}>Instalar o app</h3>
          <p className={`text-xs leading-relaxed ${textSub}`}>
            Adicione a AD Campinas à tela de início<br />e abra direto, sem navegador.
          </p>
        </div>
      </button>

      {mostrarPassosIOS && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMostrarPassosIOS(false)} />
          <div
            className={`relative w-full max-w-sm rounded-2xl border p-6 shadow-2xl ${
              isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200'
            }`}
          >
            <button
              onClick={() => setMostrarPassosIOS(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:bg-slate-500/10"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className={`font-bold text-base mb-1 ${textPrimary}`}>Instalar no iPhone</h3>
            <p className={`text-xs mb-5 ${textSub}`}>São dois toques, pelo menu do Safari:</p>

            <ol className="space-y-4">
              <li className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-sky-500/10 text-sky-500 flex items-center justify-center flex-shrink-0">
                  <Share className="w-4 h-4" />
                </span>
                <p className={`text-sm ${textPrimary}`}>
                  Toque em <strong>Compartilhar</strong> na barra do Safari
                </p>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-sky-500/10 text-sky-500 flex items-center justify-center flex-shrink-0">
                  <Plus className="w-4 h-4" />
                </span>
                <p className={`text-sm ${textPrimary}`}>
                  Escolha <strong>Adicionar à Tela de Início</strong>
                </p>
              </li>
            </ol>

            <button
              onClick={() => setMostrarPassosIOS(false)}
              className="mt-6 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
}
