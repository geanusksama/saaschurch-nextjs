/**
 * Cadastro de credor — modal, sem listagem.
 *
 * Credor é o único cadastro realmente novo do módulo: o Livro Caixa guarda o
 * favorecido como texto livre, sem cadastro nenhum de onde reaproveitar.
 *
 * Fica como modal aberto pelo "+" ao lado do campo Credor, e não como uma aba
 * com tabela: o momento em que se percebe que falta um credor é exatamente
 * enquanto se lança a conta. Assim o cadastro entra no caminho, o credor novo
 * já sai selecionado, e a tela não carrega uma listagem que ninguém pediu.
 *
 * Os demais cadastros que o módulo consome (plano de contas, bancos,
 * departamentos, tipos de credor, formas de pagamento) têm CRUD próprio em
 * Configurações — não são duplicados aqui.
 */
import { useEffect, useMemo, useState } from 'react';
import { X, Search } from 'lucide-react';
import { toast } from 'sonner';
import { apiBase } from '../../lib/apiBase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

const VAZIO = {
  churchId: '', nome: '', tipoPessoa: 'PF', tipoCredor: '', cpfCnpj: '',
  telefone: '', email: '', bancoId: '', agencia: '', conta: '', chavePix: '',
  memberId: '', favorecidoChurchId: '', observacoes: '',
};

const campoCls =
  'w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500';
const rotuloCls = 'block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1';

function igrejaPadrao(igrejas: Row[]) {
  try {
    const u = JSON.parse(localStorage.getItem('mrm_user') || '{}');
    if (u.churchId) return u.churchId as string;
  } catch { /* segue para o fallback */ }
  return igrejas.length === 1 ? igrejas[0].id : '';
}

export function CredorFormModal({
  igrejas, bancos, churchIdSugerida, onFechar, onSalvo,
}: {
  igrejas: Row[];
  bancos: Row[];
  /** Igreja escolhida no lançamento — o credor nasce na mesma. */
  churchIdSugerida?: string;
  onFechar: () => void;
  /** Recebe o credor criado, para a tela que abriu já selecioná-lo. */
  onSalvo: (credor: Row) => void;
}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('mrm_token') : null;
  const headers = useMemo<Record<string, string>>(
    () => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }),
    [token]
  );

  const [form, setForm] = useState({ ...VAZIO, churchId: churchIdSugerida || igrejaPadrao(igrejas) });
  const [tiposCredor, setTiposCredor] = useState<Row[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const [buscaMembro, setBuscaMembro] = useState('');
  const [membros, setMembros] = useState<Row[]>([]);
  const [membroSelecionado, setMembroSelecionado] = useState<Row | null>(null);

  // Busca de PJ: não há tabela de pessoa jurídica no sistema, então a base é o
  // que já foi lançado no Livro Caixa como favorecido PJ, mais os credores PJ
  // já cadastrados. Evita redigitar CNPJ e evita cadastrar o mesmo duas vezes.
  const [buscaPj, setBuscaPj] = useState('');
  const [resultadosPj, setResultadosPj] = useState<Row[]>([]);
  const [buscandoPj, setBuscandoPj] = useState(false);
  const [pjJaCadastrado, setPjJaCadastrado] = useState<Row | null>(null);

  useEffect(() => {
    if (form.tipoPessoa !== 'PJ' || buscaPj.trim().length < 3) {
      setResultadosPj([]);
      return;
    }
    setBuscandoPj(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${apiBase}/credores/buscar-pj?q=${encodeURIComponent(buscaPj)}`, { headers });
        setResultadosPj(r.ok ? await r.json() : []);
      } catch {
        setResultadosPj([]);
      } finally {
        setBuscandoPj(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [buscaPj, form.tipoPessoa, headers]);

  // Tipos de credor vêm do cadastro (Configurações › Tipos de Credor).
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${apiBase}/lookups/tipos-credor`, { headers });
        if (!r.ok) return;
        const j = await r.json();
        const ativos = (Array.isArray(j) ? j : []).filter((t: Row) => t.ativo !== false);
        setTiposCredor(ativos);
        setForm((f) => (f.tipoCredor ? f : { ...f, tipoCredor: ativos.find((t: Row) => t.is_default)?.codigo ?? '' }));
      } catch { /* dropdown vazio; o cadastro resolve */ }
    })();
  }, [headers]);

  // Busca de membro com atraso, para não disparar uma consulta por tecla.
  useEffect(() => {
    if (buscaMembro.trim().length < 3) { setMembros([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${apiBase}/members?search=${encodeURIComponent(buscaMembro)}&pageSize=10`, { headers });
        if (!r.ok) return;
        const j = await r.json();
        setMembros(Array.isArray(j) ? j : (j.data ?? []));
      } catch { setMembros([]); }
    }, 350);
    return () => clearTimeout(t);
  }, [buscaMembro, headers]);

  async function salvar() {
    setErro('');
    if (!form.nome.trim()) return setErro('Informe o nome do credor.');
    if (!form.churchId) return setErro('Selecione a igreja.');

    setSalvando(true);
    try {
      const r = await fetch(`${apiBase}/credores`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...form, nome: form.nome.trim() }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Falha ao cadastrar o credor.');
      toast.success(`Credor ${j.nome} cadastrado.`);
      onSalvo(j);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onFechar}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Novo credor</h3>
            <p className="text-xs text-slate-500">Quem recebe: pastor, obreiro, fornecedor, prestador de serviço.</p>
          </div>
          <button onClick={onFechar} className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <div className="space-y-3 px-6 py-5">
          {erro && (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">{erro}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className={rotuloCls}>Nome *</label>
              <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={campoCls} autoFocus />
            </div>
            <div>
              <label className={rotuloCls}>Igreja *</label>
              <select value={form.churchId} onChange={(e) => setForm({ ...form, churchId: e.target.value })} className={campoCls}>
                <option value="">Selecione...</option>
                {igrejas.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={rotuloCls}>Tipo de credor</label>
              <select value={form.tipoCredor} onChange={(e) => setForm({ ...form, tipoCredor: e.target.value })} className={campoCls}>
                <option value="">Selecione...</option>
                {tiposCredor.map((t) => <option key={t.id} value={t.codigo}>{t.nome}</option>)}
              </select>
            </div>
            <div>
              <label className={rotuloCls}>Pessoa</label>
              <select value={form.tipoPessoa} onChange={(e) => setForm({ ...form, tipoPessoa: e.target.value })} className={campoCls}>
                <option value="PF">Física</option>
                <option value="PJ">Jurídica</option>
              </select>
            </div>
            <div>
              <label className={rotuloCls}>CPF / CNPJ</label>
              <input value={form.cpfCnpj} onChange={(e) => setForm({ ...form, cpfCnpj: e.target.value })} className={campoCls} />
            </div>

            {/* Só para PJ: procura no que já foi lançado antes de redigitar. */}
            {form.tipoPessoa === 'PJ' && (
              <div className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                <label className={rotuloCls}>Buscar pessoa jurídica já usada</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    value={buscaPj}
                    onChange={(e) => { setBuscaPj(e.target.value); setPjJaCadastrado(null); }}
                    className={`${campoCls} pl-9`}
                    placeholder="Nome ou CNPJ — ao menos 3 letras"
                  />
                </div>

                {pjJaCadastrado ? (
                  <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                    <strong>{pjJaCadastrado.nome}</strong> já está cadastrado como credor
                    {pjJaCadastrado.ativo === false ? ' (inativo)' : ''}. Cancele e selecione-o no
                    campo Credor em vez de cadastrar de novo.
                  </div>
                ) : null}

                {buscandoPj ? (
                  <p className="mt-2 text-xs text-slate-500">Buscando...</p>
                ) : resultadosPj.length > 0 ? (
                  <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
                    {resultadosPj.map((r, i) => (
                      <button
                        key={`${r.origem}-${r.credorId ?? i}`}
                        type="button"
                        onClick={() => {
                          if (r.origem === 'credor') {
                            setPjJaCadastrado(r);
                            return;
                          }
                          // Vindo de um membro-PJ, o vínculo também é aproveitado:
                          // é o que faz o extrato do credor casar com o cadastro.
                          setForm((f) => ({
                            ...f,
                            nome: r.nome,
                            cpfCnpj: r.documento || f.cpfCnpj,
                            memberId: r.memberId || f.memberId,
                          }));
                          if (r.memberId) setMembroSelecionado({ id: r.memberId, fullName: r.nome });
                          setResultadosPj([]);
                          setBuscaPj('');
                          setPjJaCadastrado(null);
                        }}
                        className="block w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <div className="text-sm text-slate-800 dark:text-slate-100">{r.nome}</div>
                        <div className="text-xs text-slate-500">
                          {r.documento || 'sem documento'}
                          {r.origem === 'credor'
                            ? ' · já cadastrado como credor'
                            : r.origem === 'membro'
                              ? ' · cadastrado como pessoa jurídica'
                              : ' · do histórico do Livro Caixa'}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : buscaPj.trim().length >= 3 ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Nenhuma PJ encontrada. Preencha o nome e o CNPJ acima para cadastrar do zero.
                  </p>
                ) : null}
              </div>
            )}
            <div>
              <label className={rotuloCls}>Telefone</label>
              <input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} className={campoCls} />
            </div>
            <div>
              <label className={rotuloCls}>E-mail</label>
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={campoCls} />
            </div>
          </div>

          {/* Igreja favorecida: repasse, ajuda e aluguel entre igrejas. Sem este
              vínculo o livro caixa gravaria só o nome, solto. Vale um vínculo
              por credor — igreja e membro são excludentes. */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
            <label className={rotuloCls}>Quem recebe é uma igreja? (opcional)</label>
            <select
              value={form.favorecidoChurchId}
              onChange={(e) => {
                const id = e.target.value;
                const igreja = igrejas.find((c: Row) => c.id === id);
                setForm((f) => ({
                  ...f,
                  favorecidoChurchId: id,
                  nome: id ? (igreja?.name ?? f.nome) : f.nome,
                  // Igreja e membro não convivem: escolher um limpa o outro.
                  memberId: id ? '' : f.memberId,
                }));
                if (id) setMembroSelecionado(null);
              }}
              className={campoCls}
            >
              <option value="">Não — é pessoa ou empresa</option>
              {igrejas.map((c: Row) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Vínculo com o membro: faz o extrato do credor casar com o perfil. */}
          <div className={`rounded-xl border border-slate-200 dark:border-slate-700 p-3 ${form.favorecidoChurchId ? 'opacity-50 pointer-events-none' : ''}`}>
            <label className={rotuloCls}>Vincular a um membro (opcional)</label>
            {membroSelecionado ? (
              <div className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2">
                <span className="text-sm">{membroSelecionado.fullName}</span>
                <button
                  type="button"
                  onClick={() => { setMembroSelecionado(null); setForm({ ...form, memberId: '' }); }}
                  className="text-xs font-semibold text-red-600"
                >
                  Remover
                </button>
              </div>
            ) : (
              <>
                <input
                  value={buscaMembro}
                  onChange={(e) => setBuscaMembro(e.target.value)}
                  className={campoCls}
                  placeholder="Digite ao menos 3 letras do nome..."
                />
                {membros.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
                    {membros.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setMembroSelecionado(m);
                          setForm((f) => ({ ...f, memberId: m.id, nome: f.nome || m.fullName }));
                          setMembros([]);
                          setBuscaMembro('');
                        }}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        {m.fullName}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Dados bancários: adiantam o registro do pagamento depois. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={rotuloCls}>Banco</label>
              <select value={form.bancoId} onChange={(e) => setForm({ ...form, bancoId: e.target.value })} className={campoCls}>
                <option value="">Nenhum</option>
                {bancos.map((b) => <option key={b.id} value={b.id}>{b.codigo ? `${b.codigo} - ${b.nome}` : b.nome}</option>)}
              </select>
            </div>
            <div>
              <label className={rotuloCls}>Chave PIX</label>
              <input value={form.chavePix} onChange={(e) => setForm({ ...form, chavePix: e.target.value })} className={campoCls} />
            </div>
            <div>
              <label className={rotuloCls}>Agência</label>
              <input value={form.agencia} onChange={(e) => setForm({ ...form, agencia: e.target.value })} className={campoCls} />
            </div>
            <div>
              <label className={rotuloCls}>Conta</label>
              <input value={form.conta} onChange={(e) => setForm({ ...form, conta: e.target.value })} className={campoCls} />
            </div>
          </div>

          <div>
            <label className={rotuloCls}>Observações</label>
            <textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={2} className={campoCls} />
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-4">
            <button onClick={onFechar} className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              Cancelar
            </button>
            <button onClick={salvar} disabled={salvando} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
              {salvando ? 'Salvando...' : 'Cadastrar credor'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
