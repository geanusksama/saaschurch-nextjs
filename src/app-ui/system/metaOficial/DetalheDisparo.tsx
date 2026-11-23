/**
 * Detalhe de um disparo (painel lateral; ocupa a tela no celular): contadores com barras,
 * Pausar / Retomar / Cancelar com confirmação no próprio painel e lista por pessoa paginada.
 * Telefones chegam mascarados do servidor. Atualiza sozinho enquanto o disparo está ativo.
 */
import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Pause, Play, RefreshCw, Ban, X } from 'lucide-react';
import { apiBase } from '../../../lib/apiBase';
import { cabecalhos, lerErro } from '../../../lib/meta/clienteHttp';
import { Permissao } from '../../../lib/permissoes/Permissao';
import {
  Barra, COR_BARRA, ROTULO_CATEGORIA, Selo, alerta, botaoPerigo, botaoSec, botaoSecM, cartaoCls, dataHora, Carregando, type Disparo,
} from './envioComum';

type Item = { id: string; nome: string; telefone: string; status: string; erroCodigo: number | null; erro: string | null; enviadoEm: string | null; atualizadoEm: string };
type Pagina = { disparo: Disparo; pagina: number; porPagina: number; totalItens: number; itens: Item[] };
type Acao = 'pausar' | 'retomar' | 'cancelar';

const BASE = `${apiBase}/meta/whatsapp/envio`;
const POR_PAGINA = 25;
const ATIVOS = ['enviando', 'aguardando_limite', 'agendado'];
const TEXTO_ACAO: Record<Acao, string> = {
  pausar: 'Pausar este disparo? As mensagens que faltam ficam paradas até você retomar.',
  retomar: 'Retomar este disparo? O envio das mensagens que faltam continua.',
  cancelar: 'Cancelar este disparo? As mensagens que ainda não saíram não serão enviadas. Isso não pode ser desfeito.',
};

export default function DetalheDisparo({ id, onFechar, onMudou }: { id: string; onFechar: () => void; onMudou: () => void }) {
  const [estado, setEstado] = useState<'carregando' | 'erro' | 'sem-permissao' | 'ok'>('carregando');
  const [erro, setErro] = useState('');
  const [dados, setDados] = useState<Pagina | null>(null);
  const [pagina, setPagina] = useState(1);
  const [recarga, setRecarga] = useState(0);
  const [confirmando, setConfirmando] = useState<Acao | null>(null);
  const [agindo, setAgindo] = useState(false);
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !agindo) onFechar();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [agindo, onFechar]);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const r = await fetch(`${BASE}/${encodeURIComponent(id)}?pagina=${pagina}&porPagina=${POR_PAGINA}`, { headers: cabecalhos() });
        if (!vivo) return;
        if (r.status === 403) return setEstado('sem-permissao');
        if (!r.ok) {
          const m = await lerErro(r);
          if (!vivo) return;
          setErro(m);
          return setEstado('erro');
        }
        const j = (await r.json()) as Pagina;
        if (!vivo) return;
        setDados(j);
        setEstado('ok');
      } catch {
        if (!vivo) return;
        setErro('Não foi possível falar com o servidor.');
        setEstado('erro');
      }
    })();
    return () => {
      vivo = false;
    };
  }, [id, pagina, recarga]);

  const ativo = !!dados && ATIVOS.includes(dados.disparo.status);
  useEffect(() => {
    if (!ativo) return;
    const t = setInterval(() => setRecarga((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, [ativo]);

  const atualizar = useCallback(() => setRecarga((n) => n + 1), []);

  const executar = async (acao: Acao) => {
    setAgindo(true);
    setAviso('');
    try {
      const r = await fetch(`${BASE}/${encodeURIComponent(id)}`, { method: 'PATCH', headers: cabecalhos(true), body: JSON.stringify({ acao }) });
      if (!r.ok) setAviso(await lerErro(r));
      else {
        setConfirmando(null);
        atualizar();
        onMudou();
      }
    } catch {
      setAviso('Não foi possível falar com o servidor.');
    } finally {
      setAgindo(false);
    }
  };

  const d = dados?.disparo;
  const totalPaginas = dados ? Math.max(1, Math.ceil(dados.totalItens / dados.porPagina)) : 1;
  const podePausar = !!d && ['enviando', 'aguardando_limite', 'agendado'].includes(d.status);
  const podeRetomar = d?.status === 'pausado';
  const podeCancelar = !!d && ['enviando', 'aguardando_limite', 'agendado', 'pausado'].includes(d.status);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onMouseDown={(e) => e.target === e.currentTarget && !agindo && onFechar()}>
      <div role="dialog" aria-modal="true" aria-label="Detalhe do disparo" className="flex h-full w-full flex-col bg-[#f4f6f8] shadow-xl lg:max-w-3xl dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3 border-b border-[#e8ecf1] bg-white px-4 py-3 md:px-7 dark:border-slate-700 dark:bg-slate-800">
          <h2 className="min-w-0 truncate text-[17px] font-bold text-slate-900 dark:text-slate-100">{d?.nome ?? 'Disparo'}</h2>
          <div className="flex items-center gap-1">
            <button type="button" onClick={atualizar} aria-label="Atualizar" className="grid h-9 w-9 place-items-center rounded-[10px] text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700">
              <RefreshCw className="size-4" />
            </button>
            <button type="button" onClick={onFechar} disabled={agindo} aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-[10px] text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-700">
              <X className="size-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3 md:px-7 md:py-4">
          {estado === 'carregando' && <Carregando />}
          {estado === 'sem-permissao' && <p className="text-sm text-slate-500">Você não tem permissão para ver este disparo.</p>}
          {estado === 'erro' && (
            <div className="space-y-3">
              <p role="alert" className={alerta}>{erro}</p>
              <button type="button" className={botaoSec} onClick={() => { setEstado('carregando'); atualizar(); }}><RefreshCw className="size-3.5" /> Repetir</button>
            </div>
          )}

          {estado === 'ok' && d && dados && (
            <>
              <section className={`${cartaoCls} space-y-3`}>
                <div className="flex flex-wrap items-center gap-2">
                  <Selo status={d.status} />
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {d.modeloNome} · {ROTULO_CATEGORIA[d.categoria] ?? d.categoria} · criado em {dataHora(d.criadoEm)}
                    {d.agendadoPara && d.status === 'agendado' ? ` · sai em ${dataHora(d.agendadoPara)}` : ''}
                  </span>
                </div>
                {d.motivo && <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">{d.motivo}</p>}
                <p className="text-sm"><strong>{d.total.toLocaleString('pt-BR')}</strong> {d.total === 1 ? 'pessoa' : 'pessoas'} no disparo</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Barra rotulo="Enviado" valor={d.enviados} total={d.total} cor={COR_BARRA.enviado} />
                  <Barra rotulo="Entregue" valor={d.entregues} total={d.total} cor={COR_BARRA.entregue} />
                  <Barra rotulo="Lido" valor={d.lidos} total={d.total} cor={COR_BARRA.lido} />
                  <Barra rotulo="Falhou" valor={d.falhos} total={d.total} cor={COR_BARRA.falhou} />
                </div>

                {(podePausar || podeRetomar || podeCancelar) && (
                  confirmando ? (
                    <div role="alertdialog" aria-label="Confirmar ação" className="flex flex-wrap items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                      <span className="font-semibold">{TEXTO_ACAO[confirmando]}</span>
                      <button type="button" disabled={agindo} onClick={() => setConfirmando(null)} className={botaoSec}>Voltar</button>
                      <Permissao chave="whatsapp_oficial.envio.controlar" rotulo="Pausar, retomar e cancelar disparo" herda="whatsapp_oficial.envio.view">
                        <button type="button" disabled={agindo} onClick={() => void executar(confirmando)} className={botaoPerigo}>
                          {agindo && <Loader2 className="size-3.5 animate-spin" />} Confirmar
                        </button>
                      </Permissao>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {podePausar && (
                        <Permissao chave="whatsapp_oficial.envio.controlar" rotulo="Pausar, retomar e cancelar disparo" herda="whatsapp_oficial.envio.view">
                          <button type="button" className={botaoSecM} onClick={() => setConfirmando('pausar')}><Pause className="size-4" /> Pausar</button>
                        </Permissao>
                      )}
                      {podeRetomar && (
                        <Permissao chave="whatsapp_oficial.envio.controlar" rotulo="Pausar, retomar e cancelar disparo" herda="whatsapp_oficial.envio.view">
                          <button type="button" className={botaoSecM} onClick={() => setConfirmando('retomar')}><Play className="size-4" /> Retomar</button>
                        </Permissao>
                      )}
                      {podeCancelar && (
                        <Permissao chave="whatsapp_oficial.envio.controlar" rotulo="Pausar, retomar e cancelar disparo" herda="whatsapp_oficial.envio.view">
                          <button type="button" className={`${botaoSecM} !border-red-200 !text-red-600 hover:!bg-red-50 dark:!border-red-900 dark:!text-red-400 dark:hover:!bg-red-950/40`} onClick={() => setConfirmando('cancelar')}><Ban className="size-4" /> Cancelar disparo</button>
                        </Permissao>
                      )}
                    </div>
                  )
                )}
                {aviso && <p role="alert" className={alerta}>{aviso}</p>}
              </section>

              <section className="overflow-hidden rounded-[18px] border border-[#e8ecf1] bg-white md:rounded-[22px] dark:border-slate-700 dark:bg-slate-800">
                <div className="hidden md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#eef2f6] bg-slate-50 text-left text-xs font-bold uppercase tracking-[.04em] text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
                        <th className="px-5 py-3">Pessoa</th>
                        <th className="px-5 py-3">Telefone</th>
                        <th className="px-5 py-3">Situação</th>
                        <th className="px-5 py-3">Atualizado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dados.itens.map((i) => (
                        <tr key={i.id} className="border-t border-[#f1f5f9] align-top first:border-t-0 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/40">
                          <td className="px-5 py-3 font-semibold text-slate-900 dark:text-slate-100">{i.nome}</td>
                          <td className="whitespace-nowrap px-5 py-3 text-[13px] text-slate-600 dark:text-slate-300">{i.telefone}</td>
                          <td className="px-5 py-3">
                            <Selo status={i.status} envio />
                            {i.erro && <p className="mt-1 text-xs text-slate-500">{i.erro}{i.erroCodigo ? ` (${i.erroCodigo})` : ''}</p>}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3 text-[13px] text-slate-500 dark:text-slate-400">{dataHora(i.atualizadoEm)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ul className="divide-y divide-[#f1f5f9] md:hidden dark:divide-slate-700">
                  {dados.itens.map((i) => (
                    <li key={i.id} className="space-y-1.5 p-4">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{i.nome}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <Selo status={i.status} envio />
                        <span>{i.telefone}</span>
                      </div>
                      {i.erro && <p className="text-xs text-slate-500">{i.erro}{i.erroCodigo ? ` (${i.erroCodigo})` : ''}</p>}
                    </li>
                  ))}
                </ul>
                {dados.itens.length === 0 && <p className="px-5 py-10 text-center text-sm text-slate-500">Nenhuma pessoa nesta página.</p>}
                <div className="flex items-center justify-between gap-2 border-t border-[#f1f5f9] px-4 py-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  <span>Página {dados.pagina} de {totalPaginas} · {dados.totalItens.toLocaleString('pt-BR')} no total</span>
                  <div className="flex gap-2">
                    <button type="button" className={botaoSec} disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)} aria-label="Página anterior"><ChevronLeft className="size-3.5" /></button>
                    <button type="button" className={botaoSec} disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)} aria-label="Próxima página"><ChevronRight className="size-3.5" /></button>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
