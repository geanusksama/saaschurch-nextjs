/**
 * Central de Ajuda — o painel do botão de interrogação na barra superior.
 *
 * Duas abas sobre a MESMA base de conhecimento (`src/lib/helpContent.ts`):
 *  - **Documentação**: navega e busca por texto. Funciona sempre, sem rede.
 *  - **Perguntar à IA**: manda a dúvida para /api/help/ask, que responde só com
 *    o que está na documentação e devolve os artigos usados como atalho.
 *
 * É diferente do Assistente de IA (o botão verde): aquele analisa dados e é
 * restrito; este explica o sistema e é para todo mundo.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowLeft, BookOpen, ExternalLink, HelpCircle, Loader2, Search, Send, Sparkles, X,
} from 'lucide-react';
import { HELP_SECTIONS, findArticle, searchHelp, type HelpArticle } from '@/lib/helpContent';

interface Mensagem {
  role: 'user' | 'assistant';
  content: string;
  sources?: { articleId: string; title: string; path: string | null }[];
}

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('mrm_token') ?? '' : '';
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

/**
 * Markdown mínimo: só o que os artigos realmente usam (##, ###, listas,
 * **negrito**, `código`). Uma biblioteca inteira para isso seria peso morto.
 */
function Markdown({ text }: { text: string }) {
  const linhas = text.trim().split('\n');

  const inline = (s: string) =>
    s
      .split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
      .map((parte, i) => {
        if (parte.startsWith('**') && parte.endsWith('**')) {
          return (
            <strong key={i} className="font-semibold text-slate-800 dark:text-slate-100">
              {parte.slice(2, -2)}
            </strong>
          );
        }
        if (parte.startsWith('`') && parte.endsWith('`')) {
          return (
            <code key={i} className="rounded bg-slate-100 px-1 py-0.5 text-[11px] dark:bg-slate-700">
              {parte.slice(1, -1)}
            </code>
          );
        }
        return <span key={i}>{parte}</span>;
      });

  const blocos: React.ReactNode[] = [];
  let lista: string[] = [];

  const fecharLista = () => {
    if (!lista.length) return;
    blocos.push(
      <ul key={`ul-${blocos.length}`} className="my-2 space-y-1 pl-4">
        {lista.map((item, i) => (
          <li key={i} className="list-disc text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
            {inline(item)}
          </li>
        ))}
      </ul>
    );
    lista = [];
  };

  linhas.forEach((linha, i) => {
    const l = linha.trim();
    if (l.startsWith('- ')) {
      lista.push(l.slice(2));
      return;
    }
    fecharLista();
    if (!l) return;
    if (l.startsWith('### ')) {
      blocos.push(
        <h4 key={i} className="mb-1 mt-4 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {l.slice(4)}
        </h4>
      );
    } else if (l.startsWith('## ')) {
      blocos.push(
        <h3 key={i} className="mb-1 mt-4 text-sm font-bold text-slate-800 dark:text-slate-100">
          {l.slice(3)}
        </h3>
      );
    } else {
      blocos.push(
        <p key={i} className="my-2 text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
          {inline(l)}
        </p>
      );
    }
  });
  fecharLista();

  return <div>{blocos}</div>;
}

export function HelpCenter({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'docs' | 'ia'>('docs');
  const [busca, setBusca] = useState('');
  const [artigo, setArtigo] = useState<HelpArticle | null>(null);

  const [pergunta, setPergunta] = useState('');
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [pensando, setPensando] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);

  const resultados = useMemo(() => (busca.trim() ? searchHelp(busca) : []), [busca]);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open, onClose]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens, pensando]);

  const abrirArtigo = (articleId: string) => {
    const hit = findArticle(articleId);
    if (!hit) return;
    setArtigo(hit.article);
    setTab('docs');
    setBusca('');
  };

  const irParaTela = (path: string) => {
    navigate(path.replace(/^\/app-ui/, '/app-ui'));
    onClose();
  };

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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl dark:bg-slate-900"
        onClick={e => e.stopPropagation()}
      >
        {/* cabeçalho */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-sky-600" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Central de Ajuda</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-1 border-b border-slate-200 px-4 dark:border-slate-700">
          <button
            onClick={() => setTab('docs')}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold ${
              tab === 'docs' ? 'border-b-2 border-sky-600 text-sky-700 dark:text-sky-400' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <BookOpen className="h-4 w-4" /> Documentação
          </button>
          <button
            onClick={() => setTab('ia')}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold ${
              tab === 'ia' ? 'border-b-2 border-sky-600 text-sky-700 dark:text-sky-400' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Sparkles className="h-4 w-4" /> Perguntar à IA
          </button>
        </div>

        {/* ── documentação ────────────────────────────────────────────── */}
        {tab === 'docs' ? (
          <div className="flex flex-1 flex-col overflow-hidden">
            {artigo ? (
              <div className="flex-1 overflow-y-auto p-5">
                <button
                  onClick={() => setArtigo(null)}
                  className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400"
                >
                  <ArrowLeft className="h-4 w-4" /> Voltar
                </button>
                <h3 className="mb-1 text-base font-bold text-slate-800 dark:text-slate-100">{artigo.title}</h3>
                {artigo.path ? (
                  <button
                    onClick={() => irParaTela(artigo.path!)}
                    className="mb-3 inline-flex items-center gap-1.5 rounded-lg bg-sky-50 px-3 py-1.5 text-[11px] font-semibold text-sky-700 hover:bg-sky-100 dark:bg-sky-900/30 dark:text-sky-300"
                  >
                    Abrir a tela <ExternalLink className="h-3 w-3" />
                  </button>
                ) : null}
                <Markdown text={artigo.body} />
              </div>
            ) : (
              <>
                <div className="border-b border-slate-100 p-4 dark:border-slate-700">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      autoFocus
                      value={busca}
                      onChange={e => setBusca(e.target.value)}
                      placeholder="Buscar na documentação..."
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 focus:border-sky-400 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  {busca.trim() ? (
                    !resultados.length ? (
                      <div className="py-10 text-center">
                        <p className="text-xs text-slate-400">Nada encontrado para &ldquo;{busca}&rdquo;.</p>
                        <button
                          onClick={() => {
                            setPergunta(busca);
                            setTab('ia');
                          }}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold text-white"
                        >
                          <Sparkles className="h-3.5 w-3.5" /> Perguntar à IA
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {resultados.map(h => (
                          <button
                            key={h.article.id}
                            onClick={() => setArtigo(h.article)}
                            className="block w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{h.article.title}</p>
                            <p className="text-[11px] text-slate-400">{h.section.title}</p>
                          </button>
                        ))}
                      </div>
                    )
                  ) : (
                    HELP_SECTIONS.map(s => (
                      <div key={s.id} className="mb-5">
                        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">{s.title}</h3>
                        <p className="mb-2 text-[11px] text-slate-400">{s.description}</p>
                        <div className="space-y-0.5">
                          {s.articles.map(a => (
                            <button
                              key={a.id}
                              onClick={() => setArtigo(a)}
                              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              {a.title}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          /* ── IA ──────────────────────────────────────────────────────── */
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {!mensagens.length ? (
                <div className="py-8 text-center">
                  <Sparkles className="mx-auto mb-3 h-8 w-8 text-sky-400" />
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                    Pergunte qualquer coisa sobre o sistema.
                  </p>
                  <p className="mx-auto mt-1 max-w-xs text-[11px] text-slate-400">
                    Respondo com base na documentação. Se algo não estiver nela, eu digo — não invento.
                  </p>
                  <div className="mt-4 space-y-1.5">
                    {[
                      'Como crio uma campanha de atualização de foto?',
                      'Por que um menu sumiu para um usuário?',
                      'Como envio WhatsApp para uma regional inteira?',
                    ].map(ex => (
                      <button
                        key={ex}
                        onClick={() => setPergunta(ex)}
                        className="mx-auto block rounded-full border border-slate-200 px-3 py-1.5 text-[11px] text-slate-500 hover:border-sky-300 hover:text-sky-600 dark:border-slate-600 dark:text-slate-400"
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
                        m.role === 'user'
                          ? 'bg-sky-600 text-sm text-white'
                          : 'bg-slate-100 dark:bg-slate-800'
                      }`}
                    >
                      {m.role === 'user' ? (
                        m.content
                      ) : (
                        <>
                          <Markdown text={m.content} />
                          {m.sources?.length ? (
                            <div className="mt-2 flex flex-wrap gap-1.5 border-t border-slate-200 pt-2 dark:border-slate-700">
                              {m.sources.map(s => (
                                <button
                                  key={s.articleId}
                                  onClick={() => abrirArtigo(s.articleId)}
                                  className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-sky-700 shadow-sm dark:bg-slate-700 dark:text-sky-300"
                                >
                                  {s.title}
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

            <div className="border-t border-slate-200 p-3 dark:border-slate-700">
              <div className="flex gap-2">
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
                  className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-sky-400 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                />
                <button
                  onClick={perguntar}
                  disabled={pensando || !pergunta.trim()}
                  className="rounded-lg bg-sky-600 px-4 text-white disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default HelpCenter;
