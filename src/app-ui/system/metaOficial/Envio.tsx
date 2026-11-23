/**
 * Meta Oficial → Envio. Lista dos disparos (tabela no computador, cartões no celular) com barras de
 * progresso e selo de status; Novo disparo em 3 passos e detalhe com pausar/retomar/cancelar.
 */
import { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw, Send } from 'lucide-react';
import { apiBase } from '../../../lib/apiBase';
import { cabecalhos, lerErro } from '../../../lib/meta/clienteHttp';
import { Permissao } from '../../../lib/permissoes/Permissao';
import NovoDisparo from './NovoDisparo';
import DetalheDisparo from './DetalheDisparo';
import { Barra, COR_BARRA, Selo, alerta, botaoSec, dataHora, Carregando, type Disparo } from './envioComum';

const BASE = `${apiBase}/meta/whatsapp/envio`;

function Barras({ d }: { d: Disparo }) {
  return (
    <div className="grid min-w-[200px] grid-cols-2 gap-x-3 gap-y-1.5">
      <Barra rotulo="Enviado" valor={d.enviados} total={d.total} cor={COR_BARRA.enviado} />
      <Barra rotulo="Entregue" valor={d.entregues} total={d.total} cor={COR_BARRA.entregue} />
      <Barra rotulo="Lido" valor={d.lidos} total={d.total} cor={COR_BARRA.lido} />
      <Barra rotulo="Falhou" valor={d.falhos} total={d.total} cor={COR_BARRA.falhou} />
    </div>
  );
}

export default function Envio({ irPara }: { irPara: (aba: string) => void }) {
  const [estado, setEstado] = useState<'carregando' | 'erro' | 'sem-permissao' | 'ok'>('carregando');
  const [erro, setErro] = useState('');
  const [disparos, setDisparos] = useState<Disparo[]>([]);
  const [novo, setNovo] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  const carregar = useCallback(() => setRecarga((n) => n + 1), []);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const r = await fetch(BASE, { headers: cabecalhos() });
        if (!vivo) return;
        if (r.status === 403) return setEstado('sem-permissao');
        if (!r.ok) {
          const m = await lerErro(r);
          if (!vivo) return;
          setErro(m);
          return setEstado('erro');
        }
        const j = (await r.json()) as { disparos?: Disparo[] };
        if (!vivo) return;
        setDisparos(j.disparos ?? []);
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
  }, [recarga]);

  if (estado === 'carregando') return <Carregando />;
  if (estado === 'sem-permissao') return <p className="text-sm text-slate-500">Você não tem permissão para ver os disparos.</p>;
  if (estado === 'erro') {
    return (
      <div className="space-y-3">
        <p role="alert" className={alerta}>{erro}</p>
        <button type="button" className={botaoSec} onClick={() => { setEstado('carregando'); carregar(); }}>
          <RefreshCw className="size-3.5" /> Repetir
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-stretch justify-end gap-2 md:gap-3">
        <button
          type="button"
          onClick={carregar}
          className="inline-flex min-h-[52px] items-center justify-center gap-2 whitespace-nowrap rounded-2xl border-[1.5px] border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <RefreshCw className="h-[19px] w-[19px]" /> Atualizar
        </button>
        <Permissao chave="whatsapp_oficial.envio.criar" rotulo="Criar disparo (WhatsApp Oficial)" herda="whatsapp_oficial.envio.view">
          <button
            type="button"
            onClick={() => setNovo(true)}
            className="inline-flex min-h-[52px] items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-slate-900 px-[18px] text-sm font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            <Plus className="h-[19px] w-[19px]" strokeWidth={2.2} /> Novo disparo
          </button>
        </Permissao>
      </div>

      {disparos.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 rounded-[18px] border border-[#e8ecf1] bg-white px-6 py-14 text-center md:rounded-[22px] dark:border-slate-700 dark:bg-slate-800">
          <span className="mb-2 grid size-12 place-items-center rounded-2xl bg-[#f1f5f9] text-slate-500 dark:bg-slate-700 dark:text-slate-300"><Send className="size-6" strokeWidth={1.8} /></span>
          <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum disparo ainda. Use Novo disparo para enviar um modelo aprovado.</p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-[22px] border border-[#e8ecf1] bg-white md:block dark:border-slate-700 dark:bg-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#eef2f6] bg-slate-50 text-left text-xs font-bold uppercase tracking-[.04em] text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
                  <th className="px-5 py-3">Disparo</th>
                  <th className="px-5 py-3">Situação</th>
                  <th className="px-5 py-3">Pessoas</th>
                  <th className="px-5 py-3">Andamento</th>
                  <th className="px-5 py-3">Criado em</th>
                  <th className="px-5 py-3"><span className="sr-only">Abrir</span></th>
                </tr>
              </thead>
              <tbody>
                {disparos.map((d) => (
                  <tr key={d.id} className="border-t border-[#f1f5f9] align-top transition-colors first:border-t-0 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/40">
                    <td className="px-5 py-3.5">
                      <p className="font-bold text-slate-900 dark:text-slate-100">{d.nome}</p>
                      <p className="break-all font-mono text-xs text-slate-500">{d.modeloNome}</p>
                    </td>
                    <td className="px-5 py-3.5"><Selo status={d.status} /></td>
                    <td className="px-5 py-3.5 text-[13px] tabular-nums text-slate-700 dark:text-slate-300">{d.total.toLocaleString('pt-BR')}</td>
                    <td className="px-5 py-3.5"><Barras d={d} /></td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-[13px] text-slate-500 dark:text-slate-400">{dataHora(d.criadoEm)}</td>
                    <td className="px-5 py-3.5 text-right"><button type="button" className={botaoSec} onClick={() => setAberto(d.id)}>Detalhes</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-2 md:hidden">
            {disparos.map((d) => (
              <li key={d.id} className="space-y-2.5 rounded-[18px] border border-[#e8ecf1] bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                <div>
                  <p className="font-bold text-slate-900 dark:text-slate-100">{d.nome}</p>
                  <p className="break-all font-mono text-xs text-slate-500">{d.modeloNome}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <Selo status={d.status} />
                  <span>{d.total.toLocaleString('pt-BR')} pessoas</span>
                  <span>{dataHora(d.criadoEm)}</span>
                </div>
                <Barras d={d} />
                <button type="button" className={botaoSec} onClick={() => setAberto(d.id)}>Detalhes</button>
              </li>
            ))}
          </ul>
        </>
      )}

      {novo && (
        <NovoDisparo
          irPara={irPara}
          onFechar={() => setNovo(false)}
          onCriado={() => {
            setNovo(false);
            carregar();
          }}
        />
      )}
      {aberto && <DetalheDisparo id={aberto} onFechar={() => setAberto(null)} onMudou={carregar} />}
    </div>
  );
}
