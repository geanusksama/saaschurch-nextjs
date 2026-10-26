/**
 * Engajamento → Instagram.
 *
 * Dois botões: "Entrar com Instagram" (login oficial, conta profissional da
 * igreja) e "Iniciar" — que traz as fotos das publicações e roda o
 * reconhecimento de rostos nelas, no navegador. Depois é só dar nome às
 * pessoas (Engajamento → Pessoas) e abrir o Relatório.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { CheckCircle2, Loader2, Play, ScanFace, TrendingDown, Unplug } from 'lucide-react';
import { toast } from 'sonner';
import { Permissao } from '../../lib/permissoes/Permissao';
import { InstagramIcon } from '../../components/icons/InstagramIcon';
import { engajamentoApi, type ContaInstagram } from './engajamentoApi';
import { carregarReconhecimento, rostosDasFotos } from './reconhecimento';
import { Aviso, Badge, Cabecalho, Corpo, Tela, cls } from './ui';

const CHAVE_ESTADO = 'engajamento_ig_state';
/** Quanto do Instagram trazer no Iniciar: 6 meses cobre "3 meses × último mês" com folga. */
const DIAS_IMPORTAR = 180;

function urlDeVolta() {
  return `${window.location.origin}/app-ui/engajamento/instagram`;
}

type Etapa =
  | { tipo: 'parado' }
  | { tipo: 'importando'; novas: number }
  | { tipo: 'preparando' }
  | { tipo: 'analisando'; feitas: number; total: number; rostos: number; pessoasNovas: number }
  | { tipo: 'pronto'; novas: number; rostos: number; pessoasNovas: number };

export default function EngajamentoInstagram() {
  const navigate = useNavigate();
  const [conta, setConta] = useState<ContaInstagram | null>(null);
  // volta do login do Instagram: ?code=...&state=... (ou ?error=...)
  const [volta] = useState(() => {
    const sp = new URLSearchParams(window.location.search);
    return { code: sp.get('code'), state: sp.get('state'), erroIg: sp.get('error_description') || sp.get('error') };
  });
  const [erro, setErro] = useState(() => (volta.erroIg ? `O Instagram não concluiu o login: ${volta.erroIg}` : ''));
  const [entrando, setEntrando] = useState(false);
  const [etapa, setEtapa] = useState<Etapa>({ tipo: 'parado' });
  const parar = useRef(false);
  const carregou = useRef(false);

  // Carrega a conta; se voltou do login do Instagram com o code, conclui.
  // Uma vez só: o code vale um uso e o StrictMode roda o efeito duas vezes.
  useEffect(() => {
    if (carregou.current) return;
    carregou.current = true;
    if (volta.code || volta.erroIg) window.history.replaceState(null, '', window.location.pathname);
    let esperado: string | null = null;
    try { esperado = sessionStorage.getItem(CHAVE_ESTADO); sessionStorage.removeItem(CHAVE_ESTADO); } catch { /* sem sessionStorage */ }

    const pedido = !volta.code
      ? engajamentoApi.conta()
      : volta.state && volta.state === esperado
        ? engajamentoApi.concluirLogin(volta.code, urlDeVolta()).then((c) => { toast.success(`Conectado como @${c.username}.`); return c; })
        : Promise.reject(new Error('O login voltou sem a confirmação desta tela. Clique em Entrar com Instagram de novo.'));
    pedido
      .then(setConta)
      .catch((e) => {
        setErro(e instanceof Error ? e.message : 'Não foi possível ler a conta.');
        engajamentoApi.conta().then(setConta).catch(() => undefined);
      });
  }, [volta]);

  const entrar = () => {
    if (!conta?.appId) return;
    setEntrando(true);
    const state = crypto.randomUUID();
    try { sessionStorage.setItem(CHAVE_ESTADO, state); } catch { /* segue: a volta acusa */ }
    const url = new URL('https://www.instagram.com/oauth/authorize');
    url.searchParams.set('enable_fb_login', '0');
    url.searchParams.set('force_authentication', '1');
    url.searchParams.set('client_id', conta.appId);
    url.searchParams.set('redirect_uri', urlDeVolta());
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'instagram_business_basic');
    url.searchParams.set('state', state);
    window.location.href = url.toString();
  };

  const desconectar = async () => {
    if (!window.confirm('Desconectar o Instagram? Fotos, pessoas e relatórios continuam.')) return;
    try {
      setConta(await engajamentoApi.desconectar());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível desconectar.');
    }
  };

  const iniciar = async () => {
    parar.current = false;
    setErro('');
    try {
      // 1. fotos do Instagram (a rota traz 15 publicações novas por chamada)
      let novas = 0;
      setEtapa({ tipo: 'importando', novas });
      for (;;) {
        const r = await engajamentoApi.sincronizar(DIAS_IMPORTAR);
        novas += r.novas;
        setEtapa({ tipo: 'importando', novas });
        if (!r.restam || parar.current) break;
      }

      // 2. rostos, publicação por publicação
      setEtapa({ tipo: 'preparando' });
      const api = await carregarReconhecimento();
      const primeira = await engajamentoApi.rostosPendentes();
      let { publicacoes } = primeira;
      const total = primeira.restantes;
      let feitas = 0;
      let rostos = 0;
      let pessoasNovas = 0;
      while (publicacoes.length && !parar.current) {
        for (const p of publicacoes) {
          if (parar.current) break;
          setEtapa({ tipo: 'analisando', feitas, total, rostos, pessoasNovas });
          const achados = await rostosDasFotos(api, p.imagens);
          const r = await engajamentoApi.gravarRostos(p.id, achados);
          feitas++;
          rostos += r.rostos;
          pessoasNovas += r.pessoasNovas;
        }
        ({ publicacoes } = await engajamentoApi.rostosPendentes());
      }
      setEtapa({ tipo: 'pronto', novas, rostos, pessoasNovas });
      engajamentoApi.conta().then(setConta).catch(() => undefined);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Parou no meio. Clique em Iniciar de novo para continuar de onde parou.');
      setEtapa({ tipo: 'parado' });
    }
  };

  const rodando = etapa.tipo === 'importando' || etapa.tipo === 'preparando' || etapa.tipo === 'analisando';
  const porcento = etapa.tipo === 'analisando' && etapa.total ? Math.round((etapa.feitas / etapa.total) * 100) : null;

  return (
    <Tela>
      <Cabecalho icone={<InstagramIcon className="h-5 w-5" strokeWidth={1.8} />} titulo="Instagram da igreja" />
      <Corpo>
        {erro && <Aviso>{erro}</Aviso>}

        <section className={`${cls.cartao} mx-auto flex w-full max-w-[720px] flex-col items-center gap-5 px-5 py-8 text-center md:px-10`}>
          <span className="grid h-16 w-16 place-items-center rounded-[20px] bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white">
            <InstagramIcon className="h-8 w-8" />
          </span>

          {!conta ? (
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          ) : !conta.appId ? (
            <>
              <div>
                <div className="text-lg font-bold">Falta ligar o Instagram ao sistema</div>
                <p className="mt-1 text-sm text-slate-500">É feito uma única vez, pelo administrador do sistema. Depois disso aparece aqui o botão “Entrar com Instagram”.</p>
              </div>
              <ol className="w-full list-decimal space-y-1.5 rounded-2xl bg-[#f8fafc] p-4 pl-8 text-left text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                <li>Em <b>developers.facebook.com</b> → Meus apps → Criar app (tipo <b>Empresa</b>) → adicionar o produto <b>Instagram</b> (“API com login do Instagram”).</li>
                <li>Em “Configurar login comercial do Instagram”, cadastrar o endereço de volta: <code className="break-all">{urlDeVolta()}</code></li>
                <li>Em Funções do app → Testadores do Instagram, adicionar a conta da igreja e aceitar o convite no Instagram.</li>
                <li>Copiar o <b>ID do app do Instagram</b> e a <b>chave secreta</b> para as variáveis <code>INSTAGRAM_APP_ID</code> e <code>INSTAGRAM_APP_SECRET</code> do servidor.</li>
              </ol>
            </>
          ) : !conta.conectado ? (
            <>
              <div>
                <div className="text-lg font-bold">Entre com o Instagram da igreja</div>
                <p className="mt-1 text-sm text-slate-500">A conta precisa ser <b>profissional</b> (Comercial ou Criador) — o Instagram não libera contas pessoais.</p>
              </div>
              <Permissao chave="engajamento_instagram.instagram.conectar" rotulo="Entrar com Instagram" herda="engajamento_instagram.view">
                <button
                  type="button"
                  onClick={entrar}
                  disabled={entrando}
                  className="flex h-12 items-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af] px-6 text-[15px] font-bold text-white shadow-[0_12px_30px_-12px_rgba(221,42,123,.6)] hover:brightness-110 disabled:opacity-70"
                >
                  {entrando ? <Loader2 className="h-5 w-5 animate-spin" /> : <InstagramIcon className="h-5 w-5" />}
                  Entrar com Instagram
                </button>
              </Permissao>
            </>
          ) : (
            <>
              <div className="flex flex-col items-center gap-1.5">
                <div className="text-lg font-bold">@{conta.username}</div>
                <Badge bg="#dcfce7" fg="#166534">Conectada</Badge>
                {conta.ultimaSincronizacao && (
                  <span className="text-xs text-slate-500">Última busca: {new Date(conta.ultimaSincronizacao).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                )}
              </div>

              {etapa.tipo === 'parado' && (
                <p className="max-w-md text-sm text-slate-500">
                  <b>Iniciar</b> traz as fotos dos últimos 6 meses e reconhece os rostos. Na primeira vez demora alguns minutos; depois só processa o que for novo.
                </p>
              )}

              {rodando && (
                <div className="flex w-full max-w-md flex-col gap-2">
                  <div className="flex items-center justify-center gap-2 text-sm font-semibold">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {etapa.tipo === 'importando' && `Trazendo fotos do Instagram… ${etapa.novas} publicação(ões) nova(s)`}
                    {etapa.tipo === 'preparando' && 'Preparando o reconhecimento de rostos…'}
                    {etapa.tipo === 'analisando' && `Reconhecendo rostos… ${etapa.feitas} de ${etapa.total} publicações`}
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#f1f5f9] dark:bg-slate-700">
                    <div className="h-full rounded-full bg-slate-900 transition-all dark:bg-white" style={{ width: `${porcento ?? (etapa.tipo === 'importando' ? 15 : 25)}%` }} />
                  </div>
                  {etapa.tipo === 'analisando' && (
                    <span className="text-xs text-slate-500">{etapa.rostos} rostos · {etapa.pessoasNovas} pessoas novas. Pode deixar a aba aberta.</span>
                  )}
                  <button type="button" onClick={() => { parar.current = true; }} className="mx-auto text-xs font-semibold text-slate-500 underline">Parar (continua depois de onde parou)</button>
                </div>
              )}

              {etapa.tipo === 'pronto' && (
                <div className="flex w-full max-w-md items-start gap-2.5 rounded-2xl bg-[#f0fdf4] p-3 text-left text-sm text-[#166534]">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" />
                  <span>{etapa.novas} publicação(ões) nova(s) · {etapa.rostos} rostos reconhecidos · {etapa.pessoasNovas} pessoa(s) nova(s). Agora dê nome às pessoas e abra o relatório.</span>
                </div>
              )}

              <div className="flex flex-wrap justify-center gap-2">
                <Permissao chave="engajamento_instagram.instagram.sincronizar" rotulo="Iniciar (trazer fotos e reconhecer rostos)" herda="engajamento_instagram.view">
                  <button type="button" onClick={iniciar} disabled={rodando} className="flex h-12 items-center gap-2 rounded-2xl bg-slate-900 px-7 text-[15px] font-bold text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900">
                    {rodando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
                    Iniciar
                  </button>
                </Permissao>
                {etapa.tipo === 'pronto' && (
                  <>
                    <button type="button" onClick={() => navigate('/app-ui/engajamento/pessoas')} className={`${cls.botaoSec} h-12 rounded-2xl px-5`}>
                      <ScanFace className="h-4 w-4" /> Dar nome às pessoas
                    </button>
                    <button type="button" onClick={() => navigate('/app-ui/engajamento')} className={`${cls.botaoSec} h-12 rounded-2xl px-5`}>
                      <TrendingDown className="h-4 w-4" /> Ver relatório
                    </button>
                  </>
                )}
              </div>

              <Permissao chave="engajamento_instagram.instagram.desconectar" rotulo="Desconectar conta" herda="engajamento_instagram.instagram.conectar">
                <button type="button" onClick={desconectar} disabled={rodando} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#b91c1c]">
                  <Unplug className="h-3.5 w-3.5" /> Desconectar
                </button>
              </Permissao>
            </>
          )}
        </section>

        <p className="mx-auto max-w-[720px] text-center text-xs text-slate-500">
          O reconhecimento de rosto é dado biométrico (LGPD, art. 11): use com a base legal/consentimento dos membros. Os rostos ficam só no servidor e podem ser apagados em Pessoas.
        </p>
      </Corpo>
    </Tela>
  );
}
