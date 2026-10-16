/**
 * Assistente "Configurar" — a igreja liga a PRÓPRIA conta Asaas (já criada e
 * aprovada): dados da instituição + chave → o servidor valida, confere o
 * titular, salva criptografado, liga as formas de pagamento e registra o
 * webhook. Mostra o checklist de cada passo (POST /api/asaas/admin/config/configurar).
 */
import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, Rocket, XCircle } from 'lucide-react';
import { api, Botao, Campo, Cartao, cx, inputCls } from './comum';

interface Passo { passo: string; ok: boolean; aviso?: boolean; detalhe: string }

export function Assistente({ campoNome, onPronto, onCancelar }: { campoNome: string | null; onPronto: () => void; onCancelar?: () => void }) {
  const [f, setF] = useState({ nome: '', documento: '', email: '', apiKey: '' });
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [passos, setPassos] = useState<Passo[] | null>(null);
  const [ok, setOk] = useState(false);

  async function configurar() {
    setErro(null);
    setPassos(null);
    setOcupado(true);
    try {
      const r = await api<{ ok: boolean; passos: Passo[] }>('config/configurar', { method: 'POST', body: f });
      setPassos(r.passos);
      setOk(r.ok);
      if (r.ok) setF((x) => ({ ...x, apiKey: '' }));
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Cartao className="p-5 space-y-4 border-purple-200 dark:border-purple-800">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center shrink-0"><Rocket className="w-5 h-5 text-white" /></div>
        <div>
          <p className="font-bold">Configurar o pagamento {campoNome ? `do campo ${campoNome}` : 'da igreja'}</p>
          <p className="text-xs text-slate-500">Use a conta Asaas da própria igreja, já criada e aprovada. Preencha e clique em Configurar: o sistema faz o resto.</p>
        </div>
      </div>

      <ol className="text-xs text-slate-500 list-decimal pl-5 space-y-0.5">
        <li>Crie a conta em <a className="text-purple-600 font-semibold inline-flex items-center gap-0.5" href="https://www.asaas.com" target="_blank" rel="noreferrer">asaas.com<ExternalLink className="w-3 h-3" /></a> no CNPJ da igreja e envie os documentos até ela ficar <b>aprovada</b>.</li>
        <li>No app do Asaas, cadastre uma <b>chave Pix</b>.</li>
        <li>Em <b>Integrações › Chaves de API</b>, gere uma chave <b>sem permissão de saque</b> e cole abaixo.</li>
      </ol>

      <div className="grid gap-3 md:grid-cols-2">
        <Campo rotulo="Nome da instituição"><input className={inputCls} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Igreja Evangélica Assembleia de Deus…" /></Campo>
        <Campo rotulo="CNPJ (ou CPF) do titular da conta"><input className={inputCls} value={f.documento} onChange={(e) => setF({ ...f, documento: e.target.value })} inputMode="numeric" placeholder="00.000.000/0000-00" /></Campo>
        <Campo rotulo="E-mail para avisos" ajuda="O Asaas avisa aqui se a confirmação automática falhar."><input className={inputCls} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="tesouraria@igreja.com.br" /></Campo>
        <Campo rotulo="Chave de API do Asaas" ajuda="Fica criptografada e não aparece de novo."><input className={inputCls} type="password" autoComplete="off" value={f.apiKey} onChange={(e) => setF({ ...f, apiKey: e.target.value })} placeholder="$aact_prod_…" /></Campo>
      </div>

      {erro && <p className="flex items-center gap-2 text-sm text-rose-600"><XCircle className="w-4 h-4" />{erro}</p>}

      {passos && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
          {passos.map((p) => (
            <div key={p.passo} className="flex items-start gap-3 px-3 py-2 text-sm">
              {p.ok && !p.aviso ? <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5" /> : p.aviso ? <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" /> : <XCircle className="w-4 h-4 text-rose-600 mt-0.5" />}
              <div><p className="font-semibold">{p.passo}</p><p className={cx('text-xs', p.ok ? 'text-slate-500' : p.aviso ? 'text-amber-700' : 'text-rose-600')}>{p.detalhe}</p></div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {ok ? (
          <Botao onClick={onPronto}><CheckCircle2 className="w-4 h-4" />Concluir</Botao>
        ) : (
          <Botao carregando={ocupado} onClick={configurar} disabled={!f.apiKey.trim()}><Rocket className="w-4 h-4" />Configurar</Botao>
        )}
        {onCancelar && !ok && <Botao tipo="secundario" onClick={onCancelar}>Cancelar</Botao>}
      </div>
    </Cartao>
  );
}
