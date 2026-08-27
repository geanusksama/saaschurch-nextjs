/**
 * Detalhe de um culto: os blocos que o usuário pode ver, o formulário do bloco
 * que ele pode enviar e, para quem aprova, os botões de decisão.
 *
 * Isolamento: os blocos que não vieram do servidor simplesmente não existem
 * aqui. Não há nada escondido no DOM — a poda é feita em cultoScope.ts.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  X,
  Check,
  Undo2,
  Loader2,
  Wallet,
  Users,
  FileText,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';
import {
  cultoApi,
  fmtData,
  fmtHora,
  fmtMoeda,
  ROTULO_BLOCO,
  ROTULO_STATUS,
  type Bloco,
  type Nivel,
  type Registro,
} from './cultoApi';
import { BORDA, PASTILHA, TEXTO } from './cultoCores';

const CAMPOS_FINANCEIRO: { campo: string; label: string; moeda?: boolean }[] = [
  { campo: 'totalDizimos', label: 'Total de dízimos', moeda: true },
  { campo: 'totalOfertas', label: 'Total de ofertas', moeda: true },
  { campo: 'qtdDizimos', label: 'Qtd. de dízimos' },
  { campo: 'qtdOfertas', label: 'Qtd. de ofertas' },
];

const CAMPOS_PRESENCA: { campo: string; label: string }[] = [
  { campo: 'qtdHomens', label: 'Homens' },
  { campo: 'qtdMulheres', label: 'Mulheres' },
  { campo: 'qtdJovens', label: 'Jovens' },
  { campo: 'qtdAdolescentes', label: 'Adolescentes' },
  { campo: 'qtdCriancas', label: 'Crianças' },
  { campo: 'qtdVisitantes', label: 'Visitantes' },
  { campo: 'qtdConversoes', label: 'Conversões' },
  { campo: 'qtdReconciliacoes', label: 'Reconciliações' },
  { campo: 'qtdFamilias', label: 'Famílias' },
  { campo: 'cadeirasVazias', label: 'Cadeiras vazias' },
];

const ICONE_BLOCO: Record<Bloco, React.ElementType> = {
  FINANCEIRO: Wallet,
  PRESENCA: Users,
  EXTRA: FileText,
};

interface Props {
  registroId: string;
  onFechar: () => void;
  onMudou: () => void;
}

export default function CultoRegistroDrawer({ registroId, onFechar, onMudou }: Props) {
  const [registro, setRegistro] = useState<Registro | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<Bloco | null>(null);
  const [decidindo, setDecidindo] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [motivo, setMotivo] = useState('');
  const [pedindoMotivo, setPedindoMotivo] = useState<Nivel | null>(null);

  /** Preenche o formulário com o que já foi lançado nos blocos visíveis. */
  function formDoRegistro(r: Registro): Record<string, string> {
    const inicial: Record<string, string> = {};
    for (const l of r.lancamentos) {
      for (const [k, v] of Object.entries(l)) {
        if (v !== null && typeof v !== 'object' && k !== 'id' && k !== 'bloco') {
          inicial[k] = String(v);
        }
      }
    }
    return inicial;
  }

  const [versao, setVersao] = useState(0);
  const recarregar = useCallback(() => {
    setCarregando(true);
    setVersao((v) => v + 1);
  }, []);

  useEffect(() => {
    let vivo = true;
    cultoApi
      .obterRegistro(registroId)
      .then((r) => {
        if (!vivo) return;
        setErro(null);
        setRegistro(r);
        setForm(formDoRegistro(r));
      })
      .catch((e) => vivo && setErro((e as Error).message))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [registroId, versao]);

  async function enviar(bloco: Bloco) {
    if (!registro) return;
    setSalvando(bloco);
    setErro(null);
    try {
      const campos =
        bloco === 'FINANCEIRO'
          ? CAMPOS_FINANCEIRO.map((c) => c.campo)
          : bloco === 'PRESENCA'
            ? CAMPOS_PRESENCA.map((c) => c.campo)
            : ['texto', 'anexoUrl'];
      const dados: Record<string, unknown> = {};
      for (const c of campos) dados[c] = form[c] ?? null;
      await cultoApi.enviarBloco(registro.id, bloco, dados);
      recarregar();
      onMudou();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(null);
    }
  }

  async function decidir(nivel: Nivel, decisao: 'APROVADO' | 'REJEITADO') {
    if (!registro) return;
    if (decisao === 'REJEITADO' && !motivo.trim()) {
      setPedindoMotivo(nivel);
      return;
    }
    setDecidindo(true);
    setErro(null);
    try {
      await cultoApi.decidir(registro.id, nivel, decisao, motivo.trim() || undefined);
      setMotivo('');
      setPedindoMotivo(null);
      recarregar();
      onMudou();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setDecidindo(false);
    }
  }

  const podeEnviar = registro?.minhasPermissoes?.podeEnviar ?? [];
  const podeAprovar = registro?.minhasPermissoes?.podeAprovar ?? [];
  const editavel = registro ? ['ABERTO', 'AGUARDANDO_LOCAL', 'REJEITADO'].includes(registro.status) : false;

  // A hospedeira só decide depois do dirigente local; o local só depois que
  // todos os blocos chegaram. Espelha as guardas do servidor para o botão não
  // aparecer prometendo algo que vai voltar 409.
  const nivelAtivo: Nivel | null = !registro
    ? null
    : registro.status === 'AGUARDANDO_LOCAL' && podeAprovar.includes('LOCAL')
      ? 'LOCAL'
      : registro.status === 'APROVADO_LOCAL' && podeAprovar.includes('HOSPEDEIRA')
        ? 'HOSPEDEIRA'
        : null;

  function campoNumero(campo: string, label: string, moeda = false) {
    return (
      <label key={campo} className="block">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
        <input
          type="number"
          min={0}
          step={moeda ? '0.01' : '1'}
          value={form[campo] ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, [campo]: e.target.value }))}
          disabled={!editavel}
          className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60"
        />
      </label>
    );
  }

  function blocoCard(bloco: Bloco) {
    if (!registro) return null;
    const lanc = registro.lancamentos.find((l) => l.bloco === bloco);
    const souResponsavel = podeEnviar.includes(bloco);
    const exigido = registro.blocosExigidos.includes(bloco);
    if (!lanc && !souResponsavel && !exigido) return null;

    const Icone = ICONE_BLOCO[bloco];
    const enviado = Boolean(lanc?.enviadoEm);

    return (
      <div
        key={bloco}
        className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Icone className={`w-4 h-4 ${TEXTO.verde}`} />
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {ROTULO_BLOCO[bloco]}
            </span>
            {exigido && (
              <span className="text-[10px] uppercase tracking-wide text-slate-400">obrigatório</span>
            )}
          </div>
          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              enviado ? PASTILHA.verde : PASTILHA.vermelho
            }`}
          >
            {enviado ? 'enviado' : 'pendente'}
          </span>
        </div>

        <div className="p-4">
          {souResponsavel ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {bloco === 'FINANCEIRO' &&
                  CAMPOS_FINANCEIRO.map((c) => campoNumero(c.campo, c.label, c.moeda))}
                {bloco === 'PRESENCA' && CAMPOS_PRESENCA.map((c) => campoNumero(c.campo, c.label))}
              </div>
              {bloco === 'EXTRA' && (
                <textarea
                  rows={3}
                  value={form.texto ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, texto: e.target.value }))}
                  disabled={!editavel}
                  placeholder="O que mais precisa ser informado deste culto?"
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60"
                />
              )}
              {editavel && (
                <button
                  onClick={() => void enviar(bloco)}
                  disabled={salvando === bloco}
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50"
                >
                  {salvando === bloco ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  {enviado ? 'Reenviar' : 'Enviar'}
                </button>
              )}
            </>
          ) : lanc ? (
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              {bloco === 'FINANCEIRO' &&
                CAMPOS_FINANCEIRO.map((c) => (
                  <div key={c.campo}>
                    <dt className="text-xs text-slate-500 dark:text-slate-400">{c.label}</dt>
                    <dd className="font-semibold text-slate-800 dark:text-slate-100">
                      {c.moeda
                        ? fmtMoeda(lanc[c.campo as keyof typeof lanc] as string)
                        : ((lanc[c.campo as keyof typeof lanc] as number | null) ?? '—')}
                    </dd>
                  </div>
                ))}
              {bloco === 'PRESENCA' &&
                CAMPOS_PRESENCA.map((c) => (
                  <div key={c.campo}>
                    <dt className="text-xs text-slate-500 dark:text-slate-400">{c.label}</dt>
                    <dd className="font-semibold text-slate-800 dark:text-slate-100">
                      {(lanc[c.campo as keyof typeof lanc] as number | null) ?? '—'}
                    </dd>
                  </div>
                ))}
              {bloco === 'EXTRA' && (
                <div className="col-span-full text-slate-700 dark:text-slate-200">
                  {lanc.texto || '—'}
                </div>
              )}
              {lanc.observacao && (
                <div className="col-span-full mt-1 rounded-lg bg-slate-50 dark:bg-slate-900/50 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                  <strong className="text-slate-700 dark:text-slate-200">Observação:</strong>{' '}
                  {lanc.observacao}
                </div>
              )}
              {lanc.enviadoPorUser && (
                <div className="col-span-full text-xs text-slate-400 pt-1">
                  Enviado por {lanc.enviadoPorUser.fullName}
                </div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-slate-400">Ainda não enviado.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onClick={onFechar}>
      <div
        className="w-full max-w-2xl h-full bg-slate-50 dark:bg-slate-900 shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between px-5 py-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {registro?.church.name ?? 'Culto'}
            </h2>
            {registro && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {fmtData(registro.dataCulto)}
                {fmtHora(registro.horaInicio, registro.horaFim)
                  ? ` · ${fmtHora(registro.horaInicio, registro.horaFim)}`
                  : ''}{' '}
                · {registro.tipoCulto} ·{' '}
                <span className="font-semibold">{ROTULO_STATUS[registro.status]}</span>
              </p>
            )}
          </div>
          <button
            onClick={onFechar}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {erro && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {carregando && (
            <div className="flex items-center gap-2 text-slate-400 py-10 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" /> Carregando…
            </div>
          )}

          {registro && !carregando && (
            <>
              {registro.aprovacoes.map((a) => (
                <div
                  key={a.id}
                  className={`rounded-lg px-4 py-3 text-sm border ${
                    a.decisao === 'APROVADO'
                      ? BORDA.verde + ' ' + PASTILHA.verde
                      : BORDA.ambar + ' ' + PASTILHA.ambar
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold">
                    <ShieldCheck className="w-4 h-4" />
                    {a.nivel === 'LOCAL' ? 'Dirigente da igreja' : 'Dirigente da hospedeira'} —{' '}
                    {a.decisao === 'APROVADO' ? 'aprovou' : 'devolveu'}
                  </div>
                  <div className="text-xs mt-1 opacity-80">
                    {a.aprovador?.fullName ?? '—'} · {fmtData(a.decididoEm)}
                    {a.motivo ? ` · ${a.motivo}` : ''}
                  </div>
                </div>
              ))}

              {registro.blocosFaltando.length > 0 && (
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                  Faltando enviar:{' '}
                  <strong>{registro.blocosFaltando.map((b) => ROTULO_BLOCO[b]).join(', ')}</strong>.
                  Não dá para aprovar até chegar.
                </div>
              )}

              {(['FINANCEIRO', 'PRESENCA', 'EXTRA'] as Bloco[]).map((b) => blocoCard(b))}

              {nivelAtivo && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">
                    {nivelAtivo === 'LOCAL'
                      ? 'Você é o dirigente desta igreja — confira e decida.'
                      : 'Você é o dirigente da hospedeira — confira e decida.'}
                  </p>
                  {/* Serve para os dois: obrigatório ao devolver, opcional ao
                      aprovar (o dirigente às vezes quer registrar um porquê). */}
                  <textarea
                    rows={2}
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder={
                      pedindoMotivo === nivelAtivo
                        ? 'Motivo da devolução — obrigatório (a igreja recebe este texto)'
                        : 'Observação (opcional)'
                    }
                    className={`w-full mb-3 border rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
                      pedindoMotivo === nivelAtivo
                        ? BORDA.ambar
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => void decidir(nivelAtivo, 'APROVADO')}
                      disabled={decidindo}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50"
                    >
                      {decidindo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Aprovar
                    </button>
                    <button
                      onClick={() => void decidir(nivelAtivo, 'REJEITADO')}
                      disabled={decidindo}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-sm font-semibold disabled:opacity-50"
                    >
                      <Undo2 className="w-4 h-4" />
                      Devolver
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
