/**
 * Pagamentos › Configurações: chave do Asaas do campo (criptografada, nunca
 * exibida de volta), formas aceitas no app, webhook e — para o master — em
 * quais campos esta mesma conta recebe.
 */
import { useEffect, useState } from 'react';
import { CheckCircle2, KeyRound, Plug, RefreshCcw, ShieldCheck, Webhook, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api, Botao, Campo, Cartao, Carregando, confirmar, CopiaECola, cx, dataBr, Erro, inputCls, Interruptor, perfilAtual, useDados } from './comum';

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

  async function salvar(mudanca: Record<string, unknown>) {
    setSalvando(true);
    try {
      const r = await api<Config>('config', { method: 'POST', body: mudanca });
      setDados(r);
      setChave('');
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
    <div className="grid gap-4 xl:grid-cols-2 max-w-6xl">
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
          <Botao carregando={salvando} disabled={!chave.trim()} onClick={() => salvar({ apiKey: chave.trim() })}>Salvar chave</Botao>
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
            <Eventos eventos={c.eventos} onMudou={recarregar} />
          </Cartao>
        )}
        {master && c.configurado && <CamposDaConta />}
      </div>
    </div>
  );
}

function Eventos({ eventos, onMudou }: { eventos: Config['eventos']; onMudou: () => void }) {
  const [ver, setVer] = useState(false);
  if (!eventos.length) return null;
  const comErro = eventos.filter((e) => e.erro);
  return (
    <div>
      <button className="text-xs font-semibold text-purple-600" onClick={() => setVer(!ver)}>{ver ? 'Ocultar' : 'Ver'} últimos eventos {comErro.length ? `(${comErro.length} com erro)` : ''}</button>
      {ver && (
        <div className="mt-2 max-h-72 overflow-auto divide-y divide-slate-100 dark:divide-slate-700 text-xs">
          {eventos.map((e) => (
            <div key={e.id} className="flex items-center gap-2 py-1.5">
              <span className={cx('w-2 h-2 rounded-full', e.erro ? 'bg-rose-500' : e.ignorado ? 'bg-slate-300' : 'bg-emerald-500')} />
              <span className="flex-1"><b>{e.evento}</b> · {dataBr(e.recebidoEm, true)}{e.ignorado ? ' · de outro sistema' : ''}{e.erro ? <span className="block text-rose-600">{e.erro}</span> : null}</span>
              {e.erro && (
                <Botao tipo="secundario" className="!px-2 !py-1" onClick={async () => {
                  try { await api(`evento/${encodeURIComponent(e.id)}/reprocessar`, { method: 'POST' }); toast.success('Reprocessado'); onMudou(); } catch (er) { toast.error((er as Error).message); }
                }}><RefreshCcw className="w-3 h-3" /></Botao>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CamposDaConta() {
  const [lista, setLista] = useState<CampoConta[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const carregar = () => api<CampoConta[]>('config/campos').then(setLista).catch((e) => setErro((e as Error).message));
  useEffect(() => {
    carregar();
  }, []);

  async function mudar(c: CampoConta, ativo: boolean) {
    const msg = ativo
      ? c.configurado && !c.mesmaConta
        ? `O campo ${c.nome} já tem outra conta Asaas. Substituir pela conta deste campo?`
        : `Receber os pagamentos do campo ${c.nome} nesta mesma conta Asaas?`
      : `Desligar o pagamento online no campo ${c.nome}?`;
    if (!confirmar(msg)) return;
    try {
      await api('config/campos', { method: 'POST', body: { campoId: c.campoId, ativo } });
      toast.success('Feito');
      carregar();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Cartao className="p-5 space-y-3">
      <p className="font-bold">Em quais campos esta conta recebe</p>
      <p className="text-xs text-slate-500">Só o master vê. Ligar um campo copia a chave e o webhook desta conta para ele; cada campo continua vendo só os próprios pagamentos.</p>
      {erro && <Erro msg={erro} />}
      {!lista ? <Carregando /> : (
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {lista.map((c) => (
            <div key={c.campoId} className="flex items-center gap-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{c.nome} {c.atual && <span className="text-[11px] text-purple-600">(este campo)</span>}</p>
                <p className="text-xs text-slate-500">{!c.configurado ? 'Sem Asaas' : c.mesmaConta ? 'Esta conta' : `Outra conta: ${c.contaNome ?? '—'}`}</p>
              </div>
              <Interruptor ligado={c.ativo && (c.mesmaConta || !c.configurado)} onChange={(v) => mudar(c, v)} rotulo="" />
            </div>
          ))}
        </div>
      )}
    </Cartao>
  );
}
