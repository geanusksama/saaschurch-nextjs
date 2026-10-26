/**
 * Engajamento → Relatório de presença.
 *
 * Quem aparecia nas fotos dos cultos no período de referência (padrão: os 3
 * meses antes) e não aparece nas fotos dos últimos 3 domingos. As fotos vêm do
 * Instagram da igreja; quem está em cada uma vem do reconhecimento de rosto
 * (Engajamento → Pessoas) e das marcações à mão. Abre vazio e só consulta no
 * botão (regra das telas de consulta, AGENTS.md).
 */
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import * as XLSX from 'xlsx';
import { ChevronLeft, ChevronRight, Download, ExternalLink, History, Loader2, Printer, ScanFace, Search, TrendingDown } from 'lucide-react';
import { Permissao } from '../../lib/permissoes/Permissao';
import {
  SITUACOES, dataBr, diasAtras, engajamentoApi, iniciais, somarDias, ymd,
  type EventoLinhaDoTempo, type FiltroComparativo, type LinhaComparacao, type Situacao,
} from './engajamentoApi';
import { Avatar, Aviso, Badge, Cabecalho, Corpo, Gaveta, Tela, Vazio, cls } from './ui';

type Preset = 'domingos' | 'p30x90' | 'p60x60' | 'livre';

const PRESETS: Array<{ id: Preset; rotulo: string }> = [
  { id: 'domingos', rotulo: 'Últimos 3 domingos × 3 meses antes' },
  { id: 'p30x90', rotulo: 'Último mês × 3 meses antes' },
  { id: 'p60x60', rotulo: '60 × 60 dias' },
  { id: 'livre', rotulo: 'Personalizado' },
];

/** Período recente termina hoje; a referência termina na véspera dele. */
function periodosDoPreset(id: Preset) {
  const hoje = ymd(new Date());
  let recIni: string;
  let diasRef: number;
  if (id === 'domingos') {
    // do antepenúltimo domingo até hoje = os 3 últimos domingos
    const ultimoDomingo = somarDias(hoje, -new Date(`${hoje}T12:00:00`).getDay());
    recIni = somarDias(ultimoDomingo, -14);
    diasRef = 12 * 7;
  } else if (id === 'p60x60') {
    recIni = somarDias(hoje, -59);
    diasRef = 60;
  } else {
    recIni = somarDias(hoje, -29);
    diasRef = 90;
  }
  const refFim = somarDias(recIni, -1);
  return { refIni: somarDias(refFim, -(diasRef - 1)), refFim, recIni, recFim: hoje };
}

const POR_PAGINA = 60;
const ORDEM_SITUACAO: Record<Situacao, number> = { AUSENTE: 0, DIMINUIU: 1, VOLTOU: 2, NOVO: 3, CONSTANTE: 4 };

function esc(v: unknown) {
  return String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

function FotoPessoa({ l, tamanho = 44 }: { l: { foto: string | null; nome: string | null }; tamanho?: number }) {
  return l.foto
    ? <img src={l.foto} alt="" loading="lazy" className="flex-none rounded-xl object-cover" style={{ width: tamanho, height: tamanho }} />
    : <Avatar texto={iniciais(l.nome ?? '?')} tamanho={tamanho} />;
}

export default function EngajamentoComparativo() {
  const navigate = useNavigate();
  const [preset, setPreset] = useState<Preset>('domingos');
  const [periodos, setPeriodos] = useState(() => periodosDoPreset('domingos'));
  const [soDomingos, setSoDomingos] = useState(true);

  const [consultado, setConsultado] = useState<FiltroComparativo | null>(null);
  const [linhas, setLinhas] = useState<LinhaComparacao[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState<Situacao | null>('AUSENTE');
  const [pagina, setPagina] = useState(1);

  const [historico, setHistorico] = useState<LinhaComparacao | null>(null);
  const [eventos, setEventos] = useState<EventoLinhaDoTempo[]>([]);
  const [carregandoHist, setCarregandoHist] = useState(false);

  const escolherPreset = (id: Preset) => {
    setPreset(id);
    if (id !== 'livre') setPeriodos(periodosDoPreset(id));
    if (id === 'domingos') setSoDomingos(true);
  };

  const buscar = async () => {
    const f: FiltroComparativo = { ...periodos, soDomingos };
    setCarregando(true);
    setErro('');
    try {
      setLinhas((await engajamentoApi.comparativo(f)).linhas);
      setConsultado(f);
      setPagina(1);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível montar o relatório.');
    } finally {
      setCarregando(false);
    }
  };

  const contagem = useMemo(() => {
    const c: Record<Situacao, number> = { AUSENTE: 0, DIMINUIU: 0, CONSTANTE: 0, VOLTOU: 0, NOVO: 0 };
    for (const l of linhas) c[l.situacao]++;
    return c;
  }, [linhas]);
  const semNome = useMemo(() => linhas.filter((l) => !l.nome).length, [linhas]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return linhas
      .filter((l) => (!situacao || l.situacao === situacao) && (!termo || (l.nome ?? '').toLowerCase().includes(termo) || String(l.rol ?? '') === termo))
      .sort((a, b) => ORDEM_SITUACAO[a.situacao] - ORDEM_SITUACAO[b.situacao] || b.diasRef - a.diasRef || (a.nome ?? '~').localeCompare(b.nome ?? '~', 'pt-BR'));
  }, [linhas, situacao, busca]);

  const paginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const visiveis = filtradas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  const abrirHistorico = useCallback(async (l: LinhaComparacao) => {
    if (!consultado) return;
    setHistorico(l);
    setEventos([]);
    setCarregandoHist(true);
    try {
      setEventos((await engajamentoApi.linhaDoTempo(l.chave, consultado)).eventos);
    } catch {
      setEventos([]);
    } finally {
      setCarregandoHist(false);
    }
  }, [consultado]);

  const rotulo = (s: Situacao) => SITUACOES.find((x) => x.id === s)!;
  const unidade = consultado?.soDomingos ? 'domingos' : 'cultos';
  const descricao = consultado
    ? `Antes: ${dataBr(consultado.refIni)} a ${dataBr(consultado.refFim)} · Agora: ${dataBr(consultado.recIni)} a ${dataBr(consultado.recFim)}${consultado.soDomingos ? ' · só domingos' : ''}`
    : '';

  /** Relatório impresso com a foto de cada pessoa. */
  const imprimir = () => {
    const titulo = `Relatório de presença nas fotos${situacao ? ` — ${rotulo(situacao).rotulo}` : ''}`;
    const linhasHtml = filtradas.map((l) => `
      <tr>
        <td class="f">${l.foto ? `<img src="${esc(l.foto)}"/>` : ''}</td>
        <td><b>${esc(l.nome ?? 'Sem nome')}</b>${l.rol != null ? `<br/><span>ROL ${esc(l.rol)}</span>` : ''}</td>
        <td>${esc(l.celular ?? '')}</td>
        <td class="n">${l.diasRef}</td><td class="n">${l.diasRec}</td>
        <td>${dataBr(l.ultimaPresenca)}</td>
        <td>${esc(rotulo(l.situacao).rotulo)}</td>
      </tr>`).join('');
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(titulo)}</title><style>
      body{font-family:Arial,sans-serif;font-size:10px;color:#111;margin:14px}
      h1{font-size:14px;margin:0 0 2px}p{margin:0 0 10px;color:#555}
      table{width:100%;border-collapse:collapse}th,td{border-bottom:.5px solid #dde1e7;padding:4px 6px;text-align:left;vertical-align:middle}
      th{font-size:8px;text-transform:uppercase;letter-spacing:.06em;color:#64748b}td span{color:#64748b}
      td.f{width:44px}td.f img{width:40px;height:40px;object-fit:cover;border-radius:8px}.n{text-align:center;font-weight:700}
      @page{size:A4 portrait;margin:10mm}tr{page-break-inside:avoid}</style></head><body>
      <h1>${esc(titulo)}</h1><p>${esc(descricao)} · ${filtradas.length} pessoa(s) · indicador para conferência: não aparecer em foto não prova ausência.</p>
      <table><thead><tr><th></th><th>Pessoa</th><th>Celular</th><th>${unidade} antes</th><th>${unidade} agora</th><th>Última foto</th><th>Situação</th></tr></thead>
      <tbody>${linhasHtml}</tbody></table>
      <script>Promise.all([...document.images].map(i=>i.complete?1:new Promise(r=>{i.onload=i.onerror=r}))).then(()=>{window.print()})</script>
      </body></html>`);
    w.document.close();
  };

  const exportar = () => {
    const dados = filtradas.map((l) => ({
      Nome: l.nome ?? 'Sem nome',
      ROL: l.rol ?? '',
      Celular: l.celular ?? '',
      [`${unidade} antes`]: l.diasRef,
      [`${unidade} agora`]: l.diasRec,
      'Última foto': dataBr(l.ultimaPresenca),
      Situação: rotulo(l.situacao).rotulo,
      Foto: l.foto ?? '',
    }));
    const ws = XLSX.utils.json_to_sheet(dados);
    ws['!cols'] = [{ wch: 36 }, { wch: 8 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 60 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Presença');
    XLSX.writeFile(wb, `relatorio-presenca-fotos-${consultado?.recFim ?? ymd(new Date())}.xlsx`);
  };

  return (
    <Tela>
      <Cabecalho
        icone={<TrendingDown className="h-5 w-5" strokeWidth={1.8} />}
        titulo="Relatório de presença"
        acoes={
          <>
            <Permissao chave="engajamento.comparativo.imprimir" rotulo="Imprimir relatório" herda="engajamento.view">
              <button type="button" onClick={imprimir} disabled={!filtradas.length} title="Imprimir com fotos" className={cls.botaoSec}>
                <Printer className="h-4 w-4" />
                <span className="hidden md:inline">Imprimir</span>
              </button>
            </Permissao>
            <Permissao chave="engajamento.comparativo.exportar" rotulo="Exportar planilha (Excel)" herda="engajamento.view">
              <button type="button" onClick={exportar} disabled={!filtradas.length} title="Planilha Excel" className={cls.botaoSec}>
                <Download className="h-4 w-4" />
                <span className="hidden md:inline">Planilha</span>
              </button>
            </Permissao>
          </>
        }
      />

      <Corpo>
        <section className={`${cls.cartao} flex flex-col gap-4 p-4 md:p-5`}>
          <div className="flex gap-2 overflow-x-auto pb-0.5">
            {PRESETS.map((p) => (
              <button key={p.id} type="button" onClick={() => escolherPreset(p.id)} className={cls.chip(preset === p.id)}>{p.rotulo}</button>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            {([['Antes (referência)', 'refIni', 'refFim'], ['Agora (recente)', 'recIni', 'recFim']] as const).map(([titulo, ini, fim]) => (
              <div key={ini} className="rounded-2xl border border-[#e8ecf1] p-3 dark:border-slate-700">
                <div className="mb-2 text-xs font-bold uppercase tracking-[.06em] text-[#64748b]">{titulo}</div>
                <div className="flex items-center gap-2">
                  <input type="date" value={periodos[ini]} disabled={preset !== 'livre'} onChange={(e) => setPeriodos((p) => ({ ...p, [ini]: e.target.value }))} className={`${cls.campo} tabular-nums disabled:bg-[#f8fafc] disabled:text-slate-600`} />
                  <span className="text-slate-400">→</span>
                  <input type="date" value={periodos[fim]} disabled={preset !== 'livre'} onChange={(e) => setPeriodos((p) => ({ ...p, [fim]: e.target.value }))} className={`${cls.campo} tabular-nums disabled:bg-[#f8fafc] disabled:text-slate-600`} />
                </div>
              </div>
            ))}
            <div className="flex flex-col justify-end gap-2">
              <button type="button" onClick={() => setSoDomingos((v) => !v)} className={`${cls.chip(soDomingos)} justify-center`}>Só domingos</button>
              <button type="button" onClick={buscar} disabled={carregando} data-sem-permissao="só consulta; a rota exige engajamento.view, o mesmo que abre a tela" className="flex h-[46px] items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900">
                {carregando ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Search className="h-[18px] w-[18px]" strokeWidth={2.2} />}
                {carregando ? 'Montando...' : 'Gerar relatório'}
              </button>
            </div>
          </div>
        </section>

        {erro && <Aviso>{erro}</Aviso>}

        {!consultado ? (
          <Vazio
            icone={<TrendingDown className="h-6 w-6" strokeWidth={1.8} />}
            titulo="Clique em Gerar relatório"
            texto="Compara quem aparecia nas fotos dos domingos nos 3 meses anteriores com quem apareceu nos últimos 3 domingos. As fotos vêm do Instagram da igreja."
          />
        ) : (
          <>
            <div className="flex gap-2 overflow-x-auto pb-0.5">
              {SITUACOES.map((s) => {
                const ligado = situacao === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    title={s.dica}
                    onClick={() => { setSituacao(ligado ? null : s.id); setPagina(1); }}
                    className={`flex flex-[1_0_auto] items-center gap-2.5 rounded-2xl border-[1.5px] bg-white py-2 pl-3 pr-3.5 text-left transition-colors hover:border-slate-900 dark:bg-slate-800 ${ligado ? 'border-slate-900 dark:border-slate-300' : 'border-[#e8ecf1] dark:border-slate-700'}`}
                  >
                    <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: s.fg }} />
                    <span className="flex flex-col">
                      <span className="text-[19px] font-extrabold leading-[1.15] tracking-[-.02em] tabular-nums">{contagem[s.id]}</span>
                      <span className="whitespace-nowrap text-xs font-semibold text-slate-500 dark:text-slate-400">{s.rotulo}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {semNome > 0 && (
              <Aviso tipo="info">
                {semNome} pessoa(s) do relatório ainda estão <b>sem nome</b>.{' '}
                <button type="button" onClick={() => navigate('/app-ui/engajamento/pessoas')} className="font-bold underline">Dar nome agora</button>
              </Aviso>
            )}

            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <input
                value={busca}
                onChange={(e) => { setBusca(e.target.value); setPagina(1); }}
                placeholder="Filtrar por nome ou ROL"
                className="h-[52px] w-full rounded-2xl border-[1.5px] border-slate-200 bg-white pl-12 pr-3.5 text-[15px] outline-none placeholder:text-slate-400 focus:border-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <p className="px-1 text-xs text-slate-500 dark:text-slate-400">{descricao}</p>

            {filtradas.length === 0 ? (
              <Vazio
                icone={<ScanFace className="h-6 w-6" strokeWidth={1.8} />}
                titulo="Ninguém nesta situação"
                texto={linhas.length ? 'Troque a situação nos números acima.' : 'Não há fotos com pessoas reconhecidas nesses períodos. Clique em Iniciar na tela do Instagram.'}
              />
            ) : (
              <section className={`${cls.cartao} overflow-hidden`}>
                <div className={`hidden grid-cols-[minmax(0,2.6fr)_110px_110px_minmax(0,1.3fr)_150px_44px] items-center gap-3 border-b border-[#f1f5f9] px-[18px] py-3 lg:grid dark:border-slate-700 ${cls.cabecalhoTabela}`}>
                  <span>Pessoa</span><span className="text-center">{unidade} antes</span><span className="text-center">{unidade} agora</span>
                  <span>Última foto</span><span>Situação</span><span />
                </div>
                {visiveis.map((l, i) => {
                  const s = rotulo(l.situacao);
                  return (
                    <div
                      key={l.chave}
                      className="grid animate-[egRowIn_.25s_ease_both] grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 border-b border-[#f1f5f9] px-4 py-3 last:border-b-0 lg:grid-cols-[minmax(0,2.6fr)_110px_110px_minmax(0,1.3fr)_150px_44px] lg:px-[18px] dark:border-slate-700"
                      style={{ animationDelay: `${Math.min(i, 20) * 12}ms` }}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <FotoPessoa l={l} />
                        <div className="min-w-0">
                          <div className={`truncate text-[15px] font-bold ${l.nome ? '' : 'text-[#a16207]'}`}>{l.nome ?? 'Sem nome'}</div>
                          <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {l.rol != null ? `ROL ${l.rol}` : l.memberId ? 'Membro' : 'Não ligado ao cadastro'}{l.celular ? ` · ${l.celular}` : ''}
                          </div>
                        </div>
                      </div>
                      <div className="lg:hidden"><Badge bg={s.bg} fg={s.fg}>{s.rotulo}</Badge></div>
                      <div className="hidden text-center text-[15px] font-bold tabular-nums lg:block">{l.diasRef}</div>
                      <div className="hidden text-center text-[15px] font-bold tabular-nums lg:block" style={{ color: l.diasRec === 0 ? '#b91c1c' : undefined }}>{l.diasRec}</div>
                      <div className="col-span-2 text-sm lg:col-span-1">
                        <span className="tabular-nums">{dataBr(l.ultimaPresenca)}</span>
                        <span className="ml-1.5 text-xs text-slate-500">{diasAtras(l.ultimaPresenca)}</span>
                        <span className="ml-2 text-xs text-slate-500 lg:hidden">· {l.diasRef} antes · {l.diasRec} agora</span>
                      </div>
                      <div className="hidden lg:block"><Badge bg={s.bg} fg={s.fg}>{s.rotulo}</Badge></div>
                      <button type="button" onClick={() => abrirHistorico(l)} title="Ver as fotos em que aparece" className={`${cls.botaoIcone} hidden lg:grid`}>
                        <History className="h-[18px] w-[18px]" />
                      </button>
                      <button type="button" onClick={() => abrirHistorico(l)} className="col-span-2 flex h-9 items-center justify-center gap-2 rounded-[10px] border border-slate-200 text-sm font-semibold text-slate-700 lg:hidden dark:border-slate-600 dark:text-slate-200">
                        <History className="h-4 w-4" /> Ver fotos
                      </button>
                    </div>
                  );
                })}
                {paginas > 1 && (
                  <div className="flex items-center justify-between gap-3 border-t border-[#f1f5f9] px-[18px] py-3 text-sm dark:border-slate-700">
                    <span className="text-slate-500 tabular-nums">{(pagina - 1) * POR_PAGINA + 1}–{Math.min(pagina * POR_PAGINA, filtradas.length)} de {filtradas.length}</span>
                    <div className="flex gap-1.5">
                      <button type="button" onClick={() => setPagina((p) => p - 1)} disabled={pagina === 1} title="Anterior" className={cls.botaoIcone}><ChevronLeft className="h-5 w-5" /></button>
                      <span className="grid h-9 place-items-center px-2 font-semibold tabular-nums">{pagina}/{paginas}</span>
                      <button type="button" onClick={() => setPagina((p) => p + 1)} disabled={pagina === paginas} title="Próxima" className={cls.botaoIcone}><ChevronRight className="h-5 w-5" /></button>
                    </div>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </Corpo>

      <Gaveta
        aberta={Boolean(historico)}
        fechar={() => setHistorico(null)}
        titulo={historico?.nome ?? 'Sem nome'}
        subtitulo={historico ? `${historico.diasRef} ${unidade} antes · ${historico.diasRec} agora` : ''}
      >
        {carregandoHist ? (
          <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando fotos...</div>
        ) : eventos.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma foto no período consultado.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {eventos.map((ev) => (
              <li key={ev.publicacaoId} className="flex items-center gap-3">
                {ev.rosto
                  ? <img src={ev.rosto} alt="" className="h-14 w-14 flex-none rounded-xl object-cover" loading="lazy" />
                  : ev.imagem && <img src={ev.imagem} alt="" className="h-14 w-14 flex-none rounded-xl object-cover" loading="lazy" />}
                <div className="min-w-0">
                  <div className="text-sm font-bold tabular-nums">{dataBr(ev.dia)} <span className="font-normal text-slate-500">· {diasAtras(ev.dia)}</span></div>
                  <div className="truncate text-xs text-slate-500">{ev.fonte === 'ROSTO' ? 'Rosto reconhecido' : 'Marcado à mão'}{ev.titulo ? ` — ${ev.titulo}` : ''}</div>
                  {ev.permalink && (
                    <a href={ev.permalink} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-slate-700 underline dark:text-slate-200">
                      Abrir no Instagram <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Gaveta>
    </Tela>
  );
}
