/**
 * Pagamentos › Configurações: chave do Asaas do campo (criptografada, nunca
 * exibida de volta), formas aceitas no app, webhook e — para o master — em
 * quais campos esta mesma conta recebe.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2, KeyRound, Plug, RefreshCcw, ShieldCheck, Webhook, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api, Botao, Campo, Cartao, Carregando, confirmar, CopiaECola, cx, dataBr, Erro, inputCls, Interruptor, perfilAtual, useDados } from './comum';
import { Tabela } from './tabela';

interface Config {
  configurado: boolean; ambiente?: string; chave?: string; contaNome?: string | null; contaDocumento?: string | null; ativo?: boolean;
  pixAtivo?: boolean; cartaoAtivo?: boolean; recorrenciaAtiva?: boolean; maxParcelas?: number; webhookRegistrado?: boolean;
  ultimoEventoEm?: string | null; urlWebhook: string; campoNome: string | null;
  eventos: { id: string; evento: string; recebidoEm: string; processadoEm: string | null; ignorado: boolean; erro: string | null }[];
}
interface Teste { conta: { nome: string; documento: string; status: string; tipo: string }; saldo: number; chavesPix: { tipo: string; chave: string }[]; webhooks: { id: string; nome: string; url: string; ativo: boolean; interrompido: boolean }[] }
interface CampoConta { campoId: string; nome: string; atual: boolean; configurado: boolean; ativo: boolean; contaNome: string | null; mesmaConta: boolean }

export default function Configuracoes() {
  const { dados: c, erro, carregando, recarregar, setDados } = useDados<Config>('config');
  const [chave, setChave] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [teste, setTeste] = useState<Teste | null>(null);
  const [testando, setTestando] = useState(false);
  const [email, setEmail] = useState('');
  const [registrando, setRegistrando] = useState(false);
  const master = perfilAtual() === 'master';
  const [campos, setCampos] = useState<CampoConta[] | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());

  // Master: lista de campos para escolher onde a chave vale (marcados = este campo + os que já usam esta conta).
  useEffect(() => {
    if (!master) return;
    api<CampoConta[]>('config/campos')
      .then((l) => {
        setCampos(l);
        setMarcados(new Set(l.filter((c) => c.atual || (c.mesmaConta && c.ativo)).map((c) => c.campoId)));
      })
      .catch(() => setCampos([]));
  }, [master, c?.configurado]);

  const alternarCampo = (id: string) =>
    setMarcados((m) => {
      const n = new Set(m);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  async function salvar(mudanca: Record<string, unknown>) {
    setSalvando(true);
    try {
      const r = await api<Config>('config', { method: 'POST', body: mudanca });
      setDados(r);
      setChave('');
      if (master && 'campos' in mudanca) api<CampoConta[]>('config/campos').then(setCampos).catch(() => {});
      toast.success('Configuração salva');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function testar() {
    setTestando(true);
    try {
      setTeste(await api<Teste>('config/testar', { method: 'POST' }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTestando(false);
    }
  }

  async function registrar() {
    setRegistrando(true);
    try {
      await api('config/webhook', { method: 'POST', body: { email } });
      toast.success('Webhook registrado no Asaas');
      recarregar();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRegistrando(false);
    }
  }

  if (carregando && !c) return <Carregando />;
  if (erro) return <Erro msg={erro} onTentar={recarregar} />;
  if (!c) return null;

  return (
    <div className="space-y-4">
    <div className="grid gap-4 lg:grid-cols-2">
      <Cartao className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-purple-600" />
          <p className="font-bold flex-1">Conta Asaas do campo {c.campoNome ? `· ${c.campoNome}` : ''}</p>
          {c.configurado && (
            <span className={cx('px-2 py-0.5 rounded-full text-xs font-bold', c.ambiente === 'production' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
              {c.ambiente === 'production' ? 'PRODUÇÃO' : 'SANDBOX'}
            </span>
          )}
        </div>
        {c.configurado && (
          <div className="text-sm rounded-lg bg-slate-50 dark:bg-slate-900/40 p-3">
            <p><span className="text-slate-500">Titular:</span> <b>{c.contaNome ?? '—'}</b> {c.contaDocumento ? `· ${c.contaDocumento}` : ''}</p>
            <p><span className="text-slate-500">Chave:</span> {c.chave}</p>
          </div>
        )}
        <Campo rotulo={c.configurado ? 'Trocar a chave de API' : 'Chave de API do Asaas'} ajuda="No Asaas: Integrações › Chaves de API. Gere SEM permissão de saque. A chave fica criptografada e não aparece de novo.">
          <input className={inputCls} type="password" autoComplete="off" value={chave} onChange={(e) => setChave(e.target.value)} placeholder="$aact_prod_…" />
        </Campo>
        <div className="flex flex-wrap gap-2">
          <Botao carregando={salvando} disabled={!chave.trim()} onClick={() => salvar({ apiKey: chave.trim(), ...(master && campos ? { campos: [...marcados] } : {}) })}>Salvar chave</Botao>
          {c.configurado && <Botao tipo="secundario" carregando={testando} onClick={testar}><Plug className="w-4 h-4" />Testar conexão</Botao>}
        </div>
        {teste && (
          <div className="text-sm rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 p-3 space-y-1">
            <p className="flex items-center gap-2 font-semibold text-emerald-700"><CheckCircle2 className="w-4 h-4" />Conectado · {teste.conta.nome} ({teste.conta.status})</p>
            <p>Saldo: <b>{teste.saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b></p>
            <p>Chaves Pix: {teste.chavesPix.length ? teste.chavesPix.map((k) => `${k.tipo} ${k.chave}`).join(', ') : <span className="text-rose-600">nenhuma — cadastre uma chave Pix no Asaas para receber Pix</span>}</p>
            <p>Webhooks na conta: {teste.webhooks.length ? teste.webhooks.map((w) => `${w.nome}${w.interrompido ? ' (INTERROMPIDO)' : ''}`).join(', ') : 'nenhum'}</p>
          </div>
        )}

        {c.configurado && (
          <>
            <hr className="border-slate-100 dark:border-slate-700" />
            <Interruptor ligado={Boolean(c.ativo)} onChange={(v) => salvar({ ativo: v })} rotulo="Pagamento online ativo neste campo"
              sub="Desligado: o app volta para o Pix com conferência manual da tesouraria." />
            <Interruptor ligado={Boolean(c.pixAtivo)} onChange={(v) => salvar({ pixAtivo: v })} rotulo="Pix com baixa automática" />
            <Interruptor ligado={Boolean(c.cartaoAtivo)} onChange={(v) => salvar({ cartaoAtivo: v })} rotulo="Cartão de crédito no app" />
            <Interruptor ligado={Boolean(c.recorrenciaAtiva)} onChange={(v) => salvar({ recorrenciaAtiva: v })} rotulo="Dízimo/oferta recorrente (todo mês)" sub="No cartão debita sozinho; no Pix o Asaas gera um Pix por mês e o app avisa." />
            <Campo rotulo="Parcelas máximas na loja do app">
              <select className={cx(inputCls, 'max-w-[160px]')} value={c.maxParcelas} onChange={(e) => salvar({ maxParcelas: Number(e.target.value) })}>
                {[1, 2, 3].map((n) => <option key={n} value={n}>{n === 1 ? 'À vista' : `${n}x`}</option>)}
              </select>
            </Campo>
          </>
        )}
      </Cartao>

      <div className="space-y-4">
        {c.configurado && (
          <Cartao className="p-5 space-y-3">
            <div className="flex items-center gap-2"><Webhook className="w-5 h-5 text-purple-600" /><p className="font-bold flex-1">Webhook (confirmação automática)</p>
              {c.webhookRegistrado ? <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" />Registrado</span>
                : <span className="text-xs font-semibold text-rose-600 flex items-center gap-1"><XCircle className="w-4 h-4" />Não registrado</span>}
            </div>
            <p className="text-xs text-slate-500">É por aqui que o Asaas avisa que um Pix ou cartão foi pago. Sem ele, o app só confirma enquanto a tela de pagamento estiver aberta.</p>
            <CopiaECola texto={c.urlWebhook} rotulo="Copiar URL" />
            <div className="flex flex-wrap gap-2 items-end">
              <Campo rotulo="E-mail para avisos de falha do webhook"><input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tesouraria@igreja.com.br" /></Campo>
              <Botao carregando={registrando} disabled={!email.includes('@')} onClick={registrar}><ShieldCheck className="w-4 h-4" />{c.webhookRegistrado ? 'Registrar de novo' : 'Registrar automaticamente'}</Botao>
            </div>
            <p className="text-xs text-slate-500">Último evento recebido: {c.ultimoEventoEm ? dataBr(c.ultimoEventoEm, true) : 'nenhum ainda'}</p>
          </Cartao>
        )}
      </div>
    </div>

    {master && campos && campos.length > 1 && (
      <TabelaCampos
        campos={campos}
        marcados={marcados}
        onAlternar={alternarCampo}
        acoes={
          <>
            {chave.trim() && <Botao carregando={salvando} onClick={() => salvar({ apiKey: chave.trim(), campos: [...marcados] })}>Salvar chave e campos</Botao>}
            {c.configurado && !chave.trim() && (
              <Botao carregando={salvando} onClick={() => {
                const trocar = campos.filter((cp) => marcados.has(cp.campoId) && cp.configurado && !cp.mesmaConta).map((cp) => cp.nome);
                if (trocar.length && !confirmar(`Substituir a conta Asaas de: ${trocar.join(', ')}?`)) return;
                salvar({ campos: [...marcados] });
              }}>Salvar campos</Botao>
            )}
          </>
        }
      />
    )}

    {c.configurado && <Eventos eventos={c.eventos} onMudou={recarregar} />}
    </div>
  );
}

const EVENTO_ROTULO: Record<string, string> = {
  PAYMENT_CREATED: 'Cobrança criada', PAYMENT_UPDATED: 'Cobrança alterada', PAYMENT_CONFIRMED: 'Pagamento confirmado', PAYMENT_RECEIVED: 'Pagamento recebido',
  PAYMENT_OVERDUE: 'Vencida', PAYMENT_DELETED: 'Cancelada', PAYMENT_REFUNDED: 'Estornada', SUBSCRIPTION_CREATED: 'Recorrência criada',
  SUBSCRIPTION_UPDATED: 'Recorrência alterada', SUBSCRIPTION_DELETED: 'Recorrência cancelada', SUBSCRIPTION_INACTIVATED: 'Recorrência pausada',
};

function Eventos({ eventos, onMudou }: { eventos: Config['eventos']; onMudou: () => void }) {
  const situacao = (e: Config['eventos'][number]) => (e.erro ? 'Erro' : e.ignorado ? 'De outro sistema' : e.processadoEm ? 'Processado' : 'Recebido');
  return (
    <Tabela<Config['eventos'][number]>
      titulo="Últimos eventos do webhook"
      linhas={eventos}
      chave={(e) => e.id}
      ordemInicial={{ chave: 'data', desc: true }}
      porPagina={10}
      vazio={<p className="py-6 text-center text-sm text-slate-400">Nenhum evento recebido ainda.</p>}
      colunas={[
        { chave: 'data', rotulo: 'Recebido em', valor: (e) => e.recebidoEm, texto: (e) => dataBr(e.recebidoEm, true), classe: 'whitespace-nowrap text-slate-500' },
        { chave: 'evento', rotulo: 'Evento', valor: (e) => EVENTO_ROTULO[e.evento] ?? e.evento, render: (e) => <><p className="font-semibold">{EVENTO_ROTULO[e.evento] ?? e.evento}</p><p className="text-[11px] text-slate-400">{e.evento}</p></> },
        {
          chave: 'situacao', rotulo: 'Situação', valor: situacao,
          render: (e) => <span className="inline-flex items-center gap-1.5 text-xs"><span className={cx('w-2 h-2 rounded-full', e.erro ? 'bg-rose-500' : e.ignorado ? 'bg-slate-300' : 'bg-emerald-500')} />{situacao(e)}</span>,
        },
        { chave: 'erro', rotulo: 'Detalhe', valor: (e) => e.erro ?? '', classe: 'text-xs text-rose-600' },
        {
          chave: 'acoes', rotulo: '', acao: true, valor: () => '', alinhar: 'direita',
          render: (e) => e.erro ? (
            <Botao tipo="secundario" className="!px-2 !py-1" title="Reprocessar" onClick={async () => {
              try { await api(`evento/${encodeURIComponent(e.id)}/reprocessar`, { method: 'POST' }); toast.success('Reprocessado'); onMudou(); } catch (er) { toast.error((er as Error).message); }
            }}><RefreshCcw className="w-3 h-3" />Reprocessar</Botao>
          ) : null,
        },
      ]}
    />
  );
}

/** Master: campos que usam a chave — tabela padrão (busca, ordenação, paginação, exportação) com um switch por campo. */
function TabelaCampos({ campos, marcados, onAlternar, acoes }: { campos: CampoConta[]; marcados: Set<string>; onAlternar: (id: string) => void; acoes: ReactNode }) {
  const ligados = campos.filter((cp) => marcados.has(cp.campoId)).length;
  const situacao = (cp: CampoConta) => (!cp.configurado ? 'Sem Asaas' : cp.mesmaConta ? (cp.ativo ? 'Usando esta conta' : 'Esta conta, desligado') : `Outra conta: ${cp.contaNome ?? '—'}`);
  return (
    <Tabela<CampoConta>
      titulo="Campos que usam esta chave"
      linhas={campos}
      chave={(cp) => cp.campoId}
      ordemInicial={{ chave: 'campo' }}
      porPagina={10}
      barra={<div className="flex flex-wrap items-end gap-2"><div><p className="text-sm font-bold">Campos que vão usar esta chave</p><p className="text-xs text-slate-500">{ligados} de {campos.length} ligados · desligar tira o pagamento online do campo; outra conta só é trocada se você ligar</p></div>{acoes}</div>}
      colunas={[
        { chave: 'campo', rotulo: 'Campo', valor: (cp) => cp.nome, render: (cp) => <span className="font-semibold">{cp.nome}{cp.atual && <span className="ml-1 text-[11px] font-normal text-purple-600">(este campo)</span>}</span> },
        { chave: 'situacao', rotulo: 'Situação hoje', valor: situacao, render: (cp) => <span className={cx('text-xs', cp.configurado && !cp.mesmaConta ? 'text-amber-600' : 'text-slate-500')}>{situacao(cp)}</span> },
        { chave: 'usar', rotulo: 'Usar esta chave', alinhar: 'direita', valor: (cp) => (marcados.has(cp.campoId) ? 'Sim' : 'Não'),
          render: (cp) => <div className="flex justify-end" onClick={(e) => e.stopPropagation()}><Interruptor ligado={marcados.has(cp.campoId)} onChange={() => onAlternar(cp.campoId)} rotulo="" /></div> },
      ]}
    />
  );
}
