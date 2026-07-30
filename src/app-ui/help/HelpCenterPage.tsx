/**
 * Central de Ajuda — página.
 *
 * Três níveis, e a navegação só anda DENTRO da ajuda: capa com as coleções →
 * lista de artigos da coleção → artigo. Nenhum botão leva para as telas do
 * sistema; quem lê a ajuda volta para o trabalho pelo menu, como sempre.
 *
 * A documentação é recortada pelo que o usuário pode usar (`filterHelpSections`).
 * O mesmo corte é refeito no servidor para a aba de IA — filtrar só aqui seria
 * decoração, porque bastaria perguntar no chat para receber a explicação de uma
 * tela sem acesso.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bird, BookOpen, Calendar, ChevronLeft, ChevronRight, FileText, FolderOpen,
  HeartHandshake, HelpCircle, Home, Loader2, MessagesSquare, Rocket, Search,
  Send, Settings, Smartphone, Sparkles, Users, Wallet,
} from 'lucide-react';
import {
  filterHelpSections,
  type HelpArticle,
  type HelpSection,
} from '@/lib/helpContent';
import { searchHelp } from '@/lib/helpContent';
import { usePermissions } from '@/lib/usePermissions';
import { HelpMarkdown } from '../../components/app-ui/HelpMarkdown';

const ICONES: Record<string, React.ComponentType<{ className?: string }>> = {
  Rocket,
  FolderOpen,
  HeartHandshake,
  Users,
  Home,
  MessagesSquare,
  Calendar,
  Smartphone,
  Wallet,
  BookOpen,
  Bird,
  Settings,
};

interface Mensagem {
  role: 'user' | 'assistant';
  content: string;
  sources?: { sectionId: string; articleId: string; title: string }[];
}

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('mrm_token') ?? '' : '';
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export default function HelpCenterPage() {
  const storedUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('mrm_user') ?? '{}');
    } catch {
      return {};
    }
  }, []);
  const { canView } = usePermissions(storedUser?.profileType);

  const secoes = useMemo(() => filterHelpSections(canView), [canView]);
  const totalArtigos = useMemo(() => secoes.reduce((n, s) => n + s.articles.length, 0), [secoes]);

  const [busca, setBusca] = useState('');
  const [secaoAberta, setSecaoAberta] = useState<HelpSection | null>(null);
  const [artigoAberto, setArtigoAberto] = useState<HelpArticle | null>(null);
  const [modoIa, setModoIa] = useState(false);

  const resultados = useMemo(
    () => (busca.trim() ? searchHelp(busca, 20, secoes) : []),
    [busca, secoes]
  );

  // trocar de nível volta ao topo — senão o artigo abre no meio da rolagem anterior
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [secaoAberta, artigoAberto, modoIa]);

  const abrirArtigo = (secao: HelpSection, artigo: HelpArticle) => {
    setSecaoAberta(secao);
    setArtigoAberto(artigo);
    setModoIa(false);
    setBusca('');
  };

  const voltarParaCapa = () => {
    setSecaoAberta(null);
    setArtigoAberto(null);
    setModoIa(false);
  };

  // ── artigo ────────────────────────────────────────────────────────────────
  if (artigoAberto && secaoAberta) {
    const indice = secaoAberta.articles.findIndex(a => a.id === artigoAberto.id);
    const proximo = secaoAberta.articles[indice + 1] ?? null;
    const anterior = secaoAberta.articles[indice - 1] ?? null;

    return (
      <Moldura>
        <nav className="mb-4 flex items-center gap-1.5 text-xs text-slate-400">
          <button onClick={voltarParaCapa} className="hover:text-emerald-600">
            Ajuda
          </button>
          <ChevronRight className="h-3 w-3" />
          <button onClick={() => setArtigoAberto(null)} className="hover:text-emerald-600">
            {secaoAberta.title}
          </button>
        </nav>

        <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
          {artigoAberto.title}
        </h1>
        {artigoAberto.summary ? (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{artigoAberto.summary}</p>
        ) : null}

        <hr className="my-6 border-slate-200 dark:border-slate-700" />

        <HelpMarkdown text={artigoAberto.body} />

        <hr className="my-8 border-slate-200 dark:border-slate-700" />

        <div className="flex items-start justify-between gap-6">
          <button
            onClick={() => (anterior ? setArtigoAberto(anterior) : setArtigoAberto(null))}
            className="group flex items-start gap-1.5 text-left"
          >
            <ChevronLeft className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400 group-hover:text-emerald-600" />
            <span>
              {anterior ? (
                <>
                  <span className="block text-[11px] text-slate-400">Artigo anterior</span>
                  <span className="text-sm font-semibold text-slate-600 group-hover:text-emerald-600 dark:text-slate-300">
                    {anterior.title}
                  </span>
                </>
              ) : (
                <span className="text-sm text-slate-500 group-hover:text-emerald-600">
                  {secaoAberta.title}
                </span>
              )}
            </span>
          </button>

          {proximo ? (
            <button
              onClick={() => setArtigoAberto(proximo)}
              className="group flex items-start gap-1.5 text-right"
            >
              <span>
                <span className="block text-[11px] text-slate-400">Próximo artigo</span>
                <span className="text-sm font-semibold text-slate-600 group-hover:text-emerald-600 dark:text-slate-300">
                  {proximo.title}
                </span>
              </span>
              <ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400 group-hover:text-emerald-600" />
            </button>
          ) : null}
        </div>

        <p className="mt-10 text-center text-xs text-slate-400">
          Ainda com dúvida? Use a aba{' '}
          <button
            onClick={() => {
              voltarParaCapa();
              setModoIa(true);
            }}
            className="font-semibold text-emerald-600 hover:underline"
          >
            Perguntar à IA
          </button>{' '}
          ou fale com quem administra o sistema.
        </p>
      </Moldura>
    );
  }

  // ── coleção ───────────────────────────────────────────────────────────────
  if (secaoAberta) {
    const Icone = ICONES[secaoAberta.icon ?? ''] ?? FolderOpen;
    return (
      <Moldura>
        <button
          onClick={voltarParaCapa}
          className="mb-6 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-emerald-600"
        >
          <ChevronLeft className="h-4 w-4" /> Central de ajuda
        </button>

        <div className="mb-6 flex items-start gap-4">
          <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/30">
            <Icone className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
              {secaoAberta.title}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{secaoAberta.description}</p>
            <p className="mt-1 text-xs text-slate-400">
              {secaoAberta.articles.length} {secaoAberta.articles.length === 1 ? 'artigo' : 'artigos'}
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800">
          {secaoAberta.articles.map(a => (
            <button
              key={a.id}
              onClick={() => abrirArtigo(secaoAberta, a)}
              className="group flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/40"
            >
              <FileText className="h-5 w-5 flex-shrink-0 text-slate-300 group-hover:text-emerald-500" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-800 group-hover:text-emerald-700 dark:text-slate-100">
                  {a.title}
                </span>
                {a.summary ? (
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{a.summary}</span>
                ) : null}
              </span>
              <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-300 group-hover:text-emerald-500" />
            </button>
          ))}
        </div>
      </Moldura>
    );
  }

  // ── IA ────────────────────────────────────────────────────────────────────
  if (modoIa) {
    return (
      <Moldura>
        <button
          onClick={voltarParaCapa}
          className="mb-6 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-emerald-600"
        >
          <ChevronLeft className="h-4 w-4" /> Central de ajuda
        </button>
        <ChatIa onAbrirArtigo={(sectionId, articleId) => {
          const s = secoes.find(x => x.id === sectionId);
          const a = s?.articles.find(x => x.id === articleId);
          if (s && a) abrirArtigo(s, a);
        }} />
      </Moldura>
    );
  }

  // ── capa ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-full">
      <div className="bg-emerald-50/70 px-6 py-12 dark:bg-emerald-900/10">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
            Pesquise, aprenda e tire suas dúvidas
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {totalArtigos} {totalArtigos === 1 ? 'artigo' : 'artigos'} sobre como usar o sistema.
          </p>

          <div className="relative mt-6 max-w-xl">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Pesquisar artigos..."
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-700 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-8">
        {busca.trim() ? (
          <>
            <p className="mb-3 text-xs text-slate-400">
              {resultados.length} {resultados.length === 1 ? 'resultado' : 'resultados'} para &ldquo;{busca}&rdquo;
            </p>
            {!resultados.length ? (
              <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center dark:border-slate-600">
                <p className="text-sm text-slate-500">Nada encontrado na documentação.</p>
                <button
                  onClick={() => setModoIa(true)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Perguntar à IA
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800">
                {resultados.map(h => (
                  <button
                    key={h.article.id}
                    onClick={() => abrirArtigo(h.section, h.article)}
                    className="group flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/40"
                  >
                    <FileText className="h-5 w-5 flex-shrink-0 text-slate-300 group-hover:text-emerald-500" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-800 group-hover:text-emerald-700 dark:text-slate-100">
                        {h.article.title}
                      </span>
                      <span className="block text-xs text-slate-400">{h.section.title}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-300 group-hover:text-emerald-500" />
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="mb-3 text-xs text-slate-400">
              {secoes.length} {secoes.length === 1 ? 'coleção' : 'coleções'}
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {secoes.map(s => {
                const Icone = ICONES[s.icon ?? ''] ?? FolderOpen;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSecaoAberta(s)}
                    className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 text-left transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800"
                  >
                    <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/30">
                      <Icone className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{s.title}</span>
                    <span className="mt-1 flex-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      {s.description}
                    </span>
                    <span className="mt-3 text-[11px] text-slate-400">
                      {s.articles.length} {s.articles.length === 1 ? 'artigo' : 'artigos'}
                    </span>
                  </button>
                );
              })}

              <button
                onClick={() => setModoIa(true)}
                className="flex flex-col rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 text-left transition-shadow hover:shadow-md dark:border-emerald-800 dark:bg-emerald-900/20"
              >
                <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
                  <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </span>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Perguntar à IA</span>
                <span className="mt-1 flex-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  Escreva a dúvida com suas palavras. Responde com base nesta documentação — e diz
                  quando não sabe.
                </span>
                <span className="mt-3 text-[11px] text-slate-400">resposta na hora</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Moldura({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-3xl px-6 py-8">{children}</div>;
}

/* ---------------------------------------------------------------------- IA */

function ChatIa({ onAbrirArtigo }: { onAbrirArtigo: (sectionId: string, articleId: string) => void }) {
  const [pergunta, setPergunta] = useState('');
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [pensando, setPensando] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens, pensando]);

  const perguntar = async () => {
    const q = pergunta.trim();
    if (!q || pensando) return;

    const historico = mensagens.map(m => ({ role: m.role, content: m.content }));
    setMensagens(m => [...m, { role: 'user', content: q }]);
    setPergunta('');
    setPensando(true);

    try {
      const res = await fetch('/api/help/ask', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ question: q, history: historico }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Não consegui responder agora.');
      setMensagens(m => [...m, { role: 'assistant', content: data.answer, sources: data.sources ?? [] }]);
    } catch (e) {
      setMensagens(m => [
        ...m,
        { role: 'assistant', content: e instanceof Error ? e.message : 'Não consegui responder agora.' },
      ]);
    } finally {
      setPensando(false);
    }
  };

  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/30">
          <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Perguntar à IA</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Responde só com base na documentação que você tem acesso.
          </p>
        </div>
      </div>

      <div className="min-h-[300px] space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        {!mensagens.length ? (
          <div className="py-10 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">Escreva sua dúvida com suas palavras.</p>
            <div className="mt-4 space-y-1.5">
              {[
                'Como crio uma campanha de atualização de foto?',
                'Por que um menu sumiu para um usuário?',
                'Como envio WhatsApp para uma regional inteira?',
              ].map(ex => (
                <button
                  key={ex}
                  onClick={() => setPergunta(ex)}
                  className="mx-auto block rounded-full border border-slate-200 px-3 py-1.5 text-[11px] text-slate-500 hover:border-emerald-300 hover:text-emerald-600 dark:border-slate-600 dark:text-slate-400"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        ) : (
          mensagens.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'flex justify-end' : ''}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                  m.role === 'user' ? 'bg-emerald-600 text-sm text-white' : 'bg-slate-100 dark:bg-slate-700/50'
                }`}
              >
                {m.role === 'user' ? (
                  m.content
                ) : (
                  <>
                    <HelpMarkdown text={m.content} compacto />
                    {m.sources?.length ? (
                      <div className="mt-2 flex flex-wrap gap-1.5 border-t border-slate-200 pt-2 dark:border-slate-600">
                        {m.sources.map(src => (
                          <button
                            key={src.articleId}
                            onClick={() => onAbrirArtigo(src.sectionId, src.articleId)}
                            className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-emerald-700 shadow-sm dark:bg-slate-800 dark:text-emerald-300"
                          >
                            {src.title}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          ))
        )}
        {pensando ? (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Consultando a documentação...
          </div>
        ) : null}
        <div ref={fimRef} />
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={pergunta}
          onChange={e => setPergunta(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              perguntar();
            }
          }}
          placeholder="Digite sua dúvida..."
          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
        <button
          onClick={perguntar}
          disabled={pensando || !pergunta.trim()}
          className="rounded-lg bg-emerald-600 px-5 text-white disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </>
  );
}

/** Ícone da capa, exportado para o item de menu não precisar reimportar. */
export { HelpCircle as HelpIcon };
