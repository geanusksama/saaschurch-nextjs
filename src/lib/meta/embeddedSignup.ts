/**
 * Cliente do Embedded Signup v4 da Meta (WhatsApp Cloud API).
 * Só funciona em HTTPS com o domínio cadastrado no app da Meta.
 */

declare global {
  interface Window {
    FB?: {
      init: (opts: Record<string, unknown>) => void;
      login: (
        cb: (resp: { authResponse?: { code?: string } | null }) => void,
        opts: Record<string, unknown>,
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

export interface ResultadoSignup {
  code: string;
  wabaId: string;
  phoneNumberId: string;
}

export const MSG_CONCLUA_NA_JANELA = "Conclua clicando em 'Concluir' na janela da Meta";

let sdkPromise: Promise<void> | null = null;

export function carregarSdkMeta(appId: string, versao: string): Promise<void> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<void>((resolve, reject) => {
    const falhar = () => {
      sdkPromise = null;
      reject(new Error('Não foi possível carregar o SDK da Meta. Verifique sua conexão ou bloqueadores de anúncios.'));
    };
    window.fbAsyncInit = () => {
      window.FB?.init({ appId, autoLogAppEvents: true, xfbml: true, version: versao });
      resolve();
    };
    if (window.FB) {
      window.FB.init({ appId, autoLogAppEvents: true, xfbml: true, version: versao });
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.async = true;
    s.defer = true;
    s.crossOrigin = 'anonymous';
    s.src = 'https://connect.facebook.net/en_US/sdk.js';
    s.onerror = falhar;
    document.body.appendChild(s);
  });
  return sdkPromise;
}

interface DadosJanela {
  type?: string;
  event?: string;
  data?: Record<string, unknown>;
}

export function abrirEmbeddedSignup(configId: string): Promise<ResultadoSignup> {
  return new Promise<ResultadoSignup>((resolve, reject) => {
    if (!window.FB) {
      reject(new Error('SDK da Meta não carregado.'));
      return;
    }
    let code: string | null = null;
    let ids: { wabaId: string; phoneNumberId: string } | null = null;
    let loginRespondeu = false;
    let terminou = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const encerrar = () => {
      terminou = true;
      timers.forEach(clearTimeout);
      window.removeEventListener('message', onMessage);
    };
    const tentarConcluir = () => {
      if (terminou || !loginRespondeu) return;
      if (code && ids) {
        encerrar();
        resolve({ code, ...ids });
      } else if (ids && !code) {
        encerrar();
        reject(new Error(MSG_CONCLUA_NA_JANELA));
      }
    };

    function onMessage(event: MessageEvent) {
      if (!(event.origin === 'https://www.facebook.com' || (event.origin.startsWith('https://') && event.origin.endsWith('.facebook.com')))) return;
      let data: DadosJanela | null = null;
      try {
        data = typeof event.data === 'string' ? (JSON.parse(event.data) as DadosJanela) : (event.data as DadosJanela);
      } catch {
        return;
      }
      if (!data || data.type !== 'WA_EMBEDDED_SIGNUP') return;
      if (data.event === 'FINISH' || data.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING') {
        const d = data.data ?? {};
        const wabaId = String(d.waba_id ?? '');
        const phoneNumberId = String(d.phone_number_id ?? '');
        if (wabaId && phoneNumberId) {
          ids = { wabaId, phoneNumberId };
          tentarConcluir();
        }
      } else if (data.event === 'CANCEL') {
        encerrar();
        reject(new Error('Conexão cancelada.'));
      } else if (data.event === 'ERROR') {
        encerrar();
        const msg = String((data.data ?? {}).error_message ?? 'Erro na janela da Meta.');
        reject(new Error(msg));
      }
    }
    window.addEventListener('message', onMessage);

    window.FB.login(
      (resp) => {
        loginRespondeu = true;
        code = resp?.authResponse?.code ?? null;
        if (!code) {
          // Sem code: pode ser cancelamento ou fechamento antes do "Concluir".
          // Dá um instante para um FINISH chegar e então avisa.
          timers.push(setTimeout(() => {
            if (terminou) return;
            encerrar();
            reject(new Error(ids ? MSG_CONCLUA_NA_JANELA : 'Conexão não concluída.'));
          }, 800));
          return;
        }
        tentarConcluir();
        // Code chegou mas o FINISH ainda não: espera um pouco.
        if (!terminou) {
          timers.push(setTimeout(() => {
            if (terminou) return;
            encerrar();
            reject(new Error('A Meta não informou o número escolhido. Tente novamente.'));
          }, 30000));
        }
      },
      {
        config_id: configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: { setup: {} },
      },
    );
  });
}
