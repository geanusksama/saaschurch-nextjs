/**
 * Menu Mobile › Configurações.
 *
 *  - Sede do campo: qual sede (headquarters) o app mostra na página Igreja e
 *    de onde vêm os horários de culto. Cada campo tem a sua.
 *  - Igreja Mundial: o portal que aparece antes do login. Só se edita aqui.
 *    É a do campo, se ele tiver uma própria; senão a padrão do banco, que só
 *    master/admin alteram (a API confere).
 *  - Abas: Pix do campo e o conteúdo da Igreja Mundial (líderes, cartões,
 *    eventos, notícias, Pix), com a tela genérica.
 */
import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { usePermissions } from '../../lib/usePermissions';
import { MUNDIAL_CAMPOS, RECURSOS, RECURSOS_CONFIG } from '../../lib/mobile/definicoes';
import { api, enviarImagem, perfilAtual } from './api';
import { MobileRecurso } from './MobileRecurso';
import { Abas, CabecalhoMobile } from './MobileTela';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
interface Estado {
  campo: { id: string; name: string } | null;
  sedes: { id: string; nome: string; cidade: string }[];
  sedeId: string | null;
  mundial: Row | null;
  mundialDoCampo: boolean;
  podeEditarMundial: boolean;
}

const inputCls =
  'w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500';

export default function MobileConfig() {
  const { canView, canEdit } = usePermissions(perfilAtual());
  const [estado, setEstado] = useState<Estado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sede, setSede] = useState('');
  const [mundial, setMundial] = useState<Row>({});
  const [salvando, setSalvando] = useState<'sede' | 'mundial' | null>(null);
  const [aba, setAba] = useState('mundial');
  const [enviando, setEnviando] = useState(false);

  const aplicar = (e: Estado) => {
    setEstado(e);
    setSede(e.sedeId ?? '');
    setMundial(e.mundial ?? Object.fromEntries(MUNDIAL_CAMPOS.map((c) => [c.col, c.padrao ?? ''])));
  };

  useEffect(() => {
    api<Estado>('config').then(aplicar).catch((e) => setErro((e as Error).message));
  }, []);

  if (!canView('mobile_config')) return <div className="p-6 text-sm text-slate-500">Sem acesso às configurações do app.</div>;
  const podeEditar = canEdit('mobile_config');

  const salvar = async (parte: 'sede' | 'mundial') => {
    setSalvando(parte);
    try {
      const corpo = parte === 'sede' ? { sedeId: sede || null } : { mundial };
      aplicar(await api<Estado>('config', { method: 'PUT', body: corpo }));
      toast.success('Salvo. O app mostra na próxima vez que abrir.');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(null);
    }
  };

  const mundialEditavel = podeEditar && !!estado?.podeEditarMundial;
  const abas: [string, string][] = [['mundial', 'Igreja Mundial'], ...RECURSOS_CONFIG.map((r) => [r, RECURSOS[r].titulo] as [string, string])];

  return (
    <div className="p-6 text-slate-900 dark:text-slate-100">
      <CabecalhoMobile titulo="Configurações do app" sub={`Campo ${estado?.campo?.name ?? '…'}: sede, Igreja Mundial e chaves Pix.`} />
      {erro && (
        <div className="flex items-center gap-2 px-4 py-3 mb-4 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 text-sm">
          <AlertTriangle className="w-4 h-4" /> {erro}
        </div>
      )}
      {!estado && !erro && <Loader2 className="w-5 h-5 animate-spin text-slate-400" />}

      {estado && (
        <>
          <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-6 max-w-2xl">
            <h2 className="font-bold text-sm mb-1">Sede do campo</h2>
            <p className="text-xs text-slate-500 mb-3">A página Igreja do app mostra esta sede, com endereço, redes sociais e horários de culto.</p>
            {estado.sedes.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma sede cadastrada para este campo em Configurações do Sistema.</p>
            ) : (
              <div className="flex gap-2">
                <select className={inputCls} value={sede} disabled={!podeEditar} onChange={(e) => setSede(e.target.value)}>
                  <option value="">Automática (sede da igreja da pessoa)</option>
                  {estado.sedes.map((s) => <option key={s.id} value={s.id}>{s.nome}{s.cidade ? ` — ${s.cidade}` : ''}</option>)}
                </select>
                {podeEditar && (
                  <button onClick={() => salvar('sede')} disabled={salvando === 'sede'}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-sm font-semibold">
                    {salvando === 'sede' && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
                  </button>
                )}
              </div>
            )}
          </section>

          <Abas abas={abas} atual={aba} onTrocar={setAba} />
          {aba === 'mundial' ? (
            <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 max-w-2xl space-y-4">
              <p className="text-xs text-slate-500">
                {estado.mundial
                  ? estado.mundialDoCampo
                    ? 'Igreja Mundial própria deste campo.'
                    : 'Igreja Mundial padrão: vale para todos os campos deste banco.'
                  : 'Ainda não cadastrada. Preencha para aparecer na tela inicial do app.'}
                {!estado.podeEditarMundial && ' Só master ou admin altera a padrão.'}
              </p>
              {MUNDIAL_CAMPOS.map((c) => (
                <div key={c.col}>
                  {c.tipo === 'bool' ? (
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input type="checkbox" className="w-4 h-4 accent-purple-600" checked={Boolean(mundial[c.col])} disabled={!mundialEditavel}
                        onChange={(e) => setMundial((m) => ({ ...m, [c.col]: e.target.checked }))} />
                      {c.rotulo}
                    </label>
                  ) : (
                    <>
                      <p className="text-xs font-semibold text-slate-500 mb-1">{c.rotulo}{c.obrigatorio && <span className="text-rose-500"> *</span>}</p>
                      {c.tipo === 'textoLongo' ? (
                        <textarea rows={2} className={inputCls} value={mundial[c.col] ?? ''} disabled={!mundialEditavel}
                          onChange={(e) => setMundial((m) => ({ ...m, [c.col]: e.target.value }))} />
                      ) : (
                        <div className="flex items-center gap-3">
                          {c.tipo === 'imagem' && mundial[c.col] ? <img src={mundial[c.col]} alt="" className="w-12 h-12 rounded-lg object-contain bg-slate-100" /> : null}
                          <input className={inputCls} value={mundial[c.col] ?? ''} disabled={!mundialEditavel}
                            onChange={(e) => setMundial((m) => ({ ...m, [c.col]: e.target.value }))} />
                          {c.tipo === 'imagem' && mundialEditavel && (
                            <label className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-xs font-semibold cursor-pointer whitespace-nowrap">
                              {enviando ? 'Enviando…' : 'Enviar'}
                              <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                                const f = e.target.files?.[0];
                                e.target.value = '';
                                if (!f) return;
                                setEnviando(true);
                                try {
                                  const url = await enviarImagem(f, 'mundial');
                                  setMundial((m) => ({ ...m, [c.col]: url }));
                                } catch (err) {
                                  toast.error((err as Error).message);
                                } finally {
                                  setEnviando(false);
                                }
                              }} />
                            </label>
                          )}
                        </div>
                      )}
                    </>
                  )}
                  {c.ajuda && <p className="text-[11px] text-slate-400 mt-1">{c.ajuda}</p>}
                </div>
              ))}
              {mundialEditavel && (
                <button onClick={() => salvar('mundial')} disabled={salvando === 'mundial'}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-sm font-semibold">
                  {salvando === 'mundial' && <Loader2 className="w-4 h-4 animate-spin" />} Salvar Igreja Mundial
                </button>
              )}
            </section>
          ) : !estado.mundial && aba.startsWith('mundial-') ? (
            <p className="text-sm text-slate-500">Cadastre os dados da Igreja Mundial primeiro (aba Igreja Mundial).</p>
          ) : (
            <MobileRecurso key={aba} recurso={aba} />
          )}
        </>
      )}
    </div>
  );
}
