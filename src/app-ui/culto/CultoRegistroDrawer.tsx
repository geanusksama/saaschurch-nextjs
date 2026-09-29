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
  Trash2,
  Crown,
  Pencil,
} from 'lucide-react';
import {
  cultoApi,
  fmtData,
  fmtHora,
  fmtMoeda,
  mascaraMoeda,
  moedaParaNumero,
  numeroParaMoeda,
  ROTULO_BLOCO,
  ROTULO_STATUS,
  type Bloco,
  type Papel,
  type Posicao,
  type Nivel,
  type Registro,
} from './cultoApi';
import { BORDA, PASTILHA, PONTO, TEXTO } from './cultoCores';

const CAMPOS_FINANCEIRO: { campo: string; label: string; moeda?: boolean }[] = [
  { campo: 'totalDizimos', label: 'Valor total de dízimos', moeda: true },
  { campo: 'totalOfertas', label: 'Valor total de ofertas', moeda: true },
  { campo: 'qtdDizimos', label: 'Qtd. de dízimos' },
];

const CAMPOS_PRESENCA: { campo: string; label: string }[] = [
  { campo: 'qtdHomens', label: 'Homens' },
  { campo: 'qtdMulheres', label: 'Mulheres' },
  { campo: 'qtdCriancas', label: 'Crianças' },
  { campo: 'qtdVisitantes', label: 'Visitantes' },
  { campo: 'qtdConversoes', label: 'Conversões' },
  { campo: 'qtdReconciliacoes', label: 'Reconciliações' },
  { campo: 'cadeirasVazias', label: 'Cadeiras vazias' },
];

/** Campos de dinheiro: mostrados e digitados como R$ 1.234,56. */
const CAMPOS_MOEDA = new Set(['totalDizimos', 'totalOfertas']);

/** Chave da observação de um bloco no formulário do drawer. */
function chaveObs(bloco: string): string {
  return `observacao:${bloco}`;
}

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
  // Cada nível escreve a sua observação: o dirigente da congregação e o
  // hospedeiro decidem em cartões lado a lado.
  const [obsNivel, setObsNivel] = useState<Record<Nivel, string>>({ LOCAL: '', HOSPEDEIRA: '' });
  const [pedindoMotivo, setPedindoMotivo] = useState<Nivel | null>(null);
  // Presidente corrigindo a observação que um dirigente já deixou.
  const [editandoObs, setEditandoObs] = useState<Nivel | null>(null);
  const [textoEdicao, setTextoEdicao] = useState('');
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [obsPresidente, setObsPresidente] = useState('');
  const [salvandoObs, setSalvandoObs] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  // Bloco com a exclusão do envio aguardando confirmação (só o master).
  const [excluindoBloco, setExcluindoBloco] = useState<Bloco | null>(null);
  const [apagandoBloco, setApagandoBloco] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [papeisDoUsuario, setPapeisDoUsuario] = useState<string[]>([]);
  /**
   * Quem responde por cada bloco na igreja deste culto.
   *
   * "Faltando enviar: Financeiro" não diz a quem cobrar. O dirigente precisa do
   * nome — e precisa saber quando NÃO há ninguém anexado, que é o caso em que
   * o bloco nunca vai chegar sozinho.
   */
  const [posicoes, setPosicoes] = useState<Posicao[]>([]);

  /** Preenche o formulário com o que já foi lançado nos blocos visíveis. */
  function formDoRegistro(r: Registro): Record<string, string> {
    const inicial: Record<string, string> = {};
    for (const l of r.lancamentos) {
      for (const [k, v] of Object.entries(l)) {
        if (v !== null && typeof v !== 'object' && k !== 'id' && k !== 'bloco') {
          // Cada bloco tem a sua observação; no mapa achatado a do último
          // bloco apagaria a dos outros.
          inicial[k === 'observacao' ? chaveObs(l.bloco) : k] = CAMPOS_MOEDA.has(k)
            ? numeroParaMoeda(v as string | number)
            : String(v);
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
        setObsPresidente(r.observacaoPresidente ?? '');
      })
      .catch((e) => vivo && setErro((e as Error).message))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [registroId, versao]);

  useEffect(() => {
    cultoApi
      .meusPapeis()
      .then((p) => setPapeisDoUsuario(p.papeis))
      .catch(() => {
        /* sem papéis, o campo do presidente simplesmente não aparece */
      });
  }, []);

  useEffect(() => {
    if (!registro?.churchId) return;
    cultoApi
      .listarPosicoes(registro.churchId)
      .then(setPosicoes)
      .catch(() => {
        /* sem as posições, o drawer continua igual — só sem o nome */
      });
  }, [registro?.churchId]);

  /**
   * Só o presidente do campo (e o master) escrevem a observação do presidente.
   * O servidor recusa qualquer outro; aqui é só para não mostrar um campo que
   * vai voltar 403.
   */
  const souPresidente = (() => {
    if (typeof window === 'undefined') return false;
    try {
      const u = JSON.parse(localStorage.getItem('mrm_user') || '{}');
      if (u.profileType === 'master' || u.profileType === 'admin') return true;
    } catch {
      /* sem usuário guardado, cai no papel do culto abaixo */
    }
    return papeisDoUsuario.includes('PRESIDENTE');
  })();

  /** Quem decide no nível local, para dizer o nome em vez de "o dirigente". */
  const aprovadorLocal =
    posicoes.find((p) => p.papel === 'APROVADOR_LOCAL' && p.isActive)?.user.fullName ?? null;

  /** Nome de quem deveria enviar o bloco; null quando ninguém foi anexado. */
  function responsavel(bloco: Bloco): string | null {
    return posicoes.find((p) => p.papel === (bloco as Papel) && p.isActive)?.user.fullName ?? null;
  }

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
      for (const c of campos) {
        const bruto = form[c] ?? '';
        dados[c] = CAMPOS_MOEDA.has(c) ? moedaParaNumero(bruto) : bruto || null;
      }
      dados.observacao = form[chaveObs(bloco)]?.trim() || null;
      await cultoApi.enviarBloco(registro.id, bloco, dados);
      recarregar();
      onMudou();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(null);
    }
  }

  async function decidir(nivel: Nivel | 'PRESIDENTE', decisao: 'APROVADO' | 'REJEITADO') {
    if (!registro) return;
    const motivo = nivel === 'PRESIDENTE' ? '' : obsNivel[nivel].trim();
    if (decisao === 'REJEITADO' && !motivo) {
      if (nivel !== 'PRESIDENTE') setPedindoMotivo(nivel);
      return;
    }
    setDecidindo(true);
    setErro(null);
    try {
      await cultoApi.decidir(registro.id, nivel, decisao, motivo || undefined);
      setObsNivel({ LOCAL: '', HOSPEDEIRA: '' });
      setPedindoMotivo(null);
      recarregar();
      onMudou();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setDecidindo(false);
    }
  }

  async function salvarEdicaoObs(nivel: Nivel) {
    if (!registro) return;
    setSalvandoEdicao(true);
    setErro(null);
    try {
      await cultoApi.editarObservacaoAprovacao(registro.id, nivel, textoEdicao);
      setEditandoObs(null);
      recarregar();
      onMudou();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvandoEdicao(false);
    }
  }

  async function excluir() {
    if (!registro) return;
    setExcluindo(true);
    setErro(null);
    try {
      await cultoApi.excluirRegistro(registro.id);
      onMudou();
      onFechar();
    } catch (e) {
      setErro((e as Error).message);
      setExcluindo(false);
    }
  }

  /** Apaga só o envio de um bloco; as aprovações são desfeitas no servidor. */
  async function excluirEnvio(bloco: Bloco) {
    if (!registro) return;
    setApagandoBloco(true);
    setErro(null);
    try {
      await cultoApi.excluirBloco(registro.id, bloco);
      setExcluindoBloco(null);
      recarregar();
      onMudou();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setApagandoBloco(false);
    }
  }

  const podeEnviar = registro?.minhasPermissoes?.podeEnviar ?? [];
  const podeAprovar = registro?.minhasPermissoes?.podeAprovar ?? [];
  const podeExcluir = registro?.minhasPermissoes?.podeExcluir ?? false;
  // O presidente conclui por cima dos dirigentes — só enquanto o culto espera
  // aprovação, que é quando o servidor aceita (senão volta 409).
  const presidenteDecide =
    Boolean(registro?.minhasPermissoes?.podeConcluir) &&
    ['AGUARDANDO_LOCAL', 'APROVADO_LOCAL'].includes(registro?.status ?? '');
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
        <div className="mt-1 relative">
          {moeda && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 pointer-events-none">
              R$
            </span>
          )}
          <input
            // Dinheiro com máscara pt-BR (1.234,56), igual ao formulário de
            // lançamento; contagem continua número puro.
            type={moeda ? 'text' : 'number'}
            inputMode={moeda ? 'numeric' : undefined}
            min={moeda ? undefined : 0}
            placeholder={moeda ? '0,00' : '0'}
            value={form[campo] ?? ''}
            onChange={(e) =>
              setForm((f) => ({ ...f, [campo]: moeda ? mascaraMoeda(e.target.value) : e.target.value }))
            }
            disabled={!editavel}
            className={`w-full border border-slate-200 dark:border-slate-700 rounded-lg py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60 ${
              moeda ? 'pl-9 pr-3 text-right tabular-nums' : 'px-3'
            }`}
          />
        </div>
      </label>
    );
  }

  function blocoCard(bloco: Bloco) {
    if (!registro) return null;
    const lanc = registro.lancamentos.find((l) => l.bloco === bloco);
    const souResponsavel = podeEnviar.includes(bloco);
    const exigido = registro.blocosExigidos.includes(bloco);
    if (!lanc && !souResponsavel && !exigido && !registro.blocosEnviados.includes(bloco)) {
      return null;
    }

    const Icone = ICONE_BLOCO[bloco];
    // `blocosEnviados` vem do servidor ANTES da poda: é o que permite saber que
    // o bloco chegou mesmo quando os valores dele não vieram.
    const enviado = Boolean(lanc?.enviadoEm) || registro.blocosEnviados.includes(bloco);

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
          <div className="flex items-center gap-2">
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                enviado ? PASTILHA.verde : PASTILHA.vermelho
              }`}
            >
              {enviado ? 'enviado' : 'pendente'}
            </span>
            {podeExcluir && lanc && (
              <button
                onClick={() => setExcluindoBloco(bloco)}
                title={`Excluir o envio de ${ROTULO_BLOCO[bloco]}`}
                aria-label={`Excluir o envio de ${ROTULO_BLOCO[bloco]}`}
                className={`p-1 rounded-lg hover:brightness-95 ${PASTILHA.vermelho}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {excluindoBloco === bloco && (
          <div className={`flex flex-wrap items-center gap-2 px-4 py-3 border-b ${BORDA.vermelho} bg-[#fff1f2] dark:bg-[#4c0519]/30`}>
            <span className={`text-sm mr-auto ${TEXTO.vermelho}`}>
              Excluir só o envio de {ROTULO_BLOCO[bloco]}? O resto do culto fica; se ele já tinha
              aprovação, ela é desfeita.
            </span>
            <button
              onClick={() => setExcluindoBloco(null)}
              disabled={apagandoBloco}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              onClick={() => void excluirEnvio(bloco)}
              disabled={apagandoBloco}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${PONTO.vermelho} hover:brightness-90 text-white text-xs font-semibold disabled:opacity-50`}
            >
              {apagandoBloco ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Excluir envio
            </button>
          </div>
        )}

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
              <label className="block mt-3">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Observação para o dirigente
                </span>
                <textarea
                  rows={2}
                  value={form[chaveObs(bloco)] ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, [chaveObs(bloco)]: e.target.value }))}
                  disabled={!editavel}
                  className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60"
                />
              </label>
              {lanc?.enviadoPorUser && (
                <p className="text-xs text-slate-400 pt-1">Enviado por {lanc.enviadoPorUser.fullName}</p>
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
                  {/* "Reenviar" dava a entender que criaria outro lançamento:
                      é o mesmo, com os números corrigidos. */}
                  {enviado ? 'Atualizar' : 'Enviar'}
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
          ) : enviado ? (
            /* Chegou, mas os números não vieram para este usuário: o bloco foi
               podado no servidor. Dizer "ainda não enviado" seria mentira — o
               culto inclusive já pode estar aprovado por causa dele.
               O texto não diz quem limitou: quem trancou não precisa aparecer
               para quem foi trancado. */
            <p className="text-sm text-slate-400">Enviado · visão limitada.</p>
          ) : (
            <p className="text-sm text-slate-400">
              Ainda não enviado.{' '}
              {responsavel(bloco)
                ? `Responsável: ${responsavel(bloco)}.`
                : 'Nenhum responsável anexado nesta igreja — enquanto não houver, este bloco não tem quem envie.'}
            </p>
          )}
        </div>
      </div>
    );
  }

  /**
   * Cartão de um nível de aprovação: o dirigente da congregação (LOCAL) e o
   * dirigente hospedeiro (HOSPEDEIRA). Mostra a decisão e a observação de quem
   * decidiu; aprovar/devolver aparecem só no nível que está na vez e para quem
   * pode decidir nele. O presidente corrige a observação já dada.
   */
  function cartaoNivel(nivel: Nivel) {
    if (!registro) return null;
    const decisao = registro.aprovacoes.find((a) => a.nivel === nivel);
    const titulo = nivel === 'LOCAL' ? 'Dirigente da congregação' : 'Dirigente hospedeiro';
    const quem =
      nivel === 'LOCAL'
        ? aprovadorLocal
        : registro.hostChurch
          ? registro.hostChurch.name
          : null;
    const naVez = nivelAtivo === nivel;
    const editando = editandoObs === nivel;

    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldCheck className={`w-4 h-4 shrink-0 ${TEXTO.verde}`} />
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{titulo}</span>
          </div>
          <span
            className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              decisao?.decisao === 'APROVADO'
                ? PASTILHA.verde
                : decisao?.decisao === 'REJEITADO'
                  ? PASTILHA.ambar
                  : naVez
                    ? PASTILHA.azul
                    : PASTILHA.cinza
            }`}
          >
            {decisao?.decisao === 'APROVADO'
              ? 'aprovou'
              : decisao?.decisao === 'REJEITADO'
                ? 'devolveu'
                : naVez
                  ? 'na vez dele'
                  : 'aguardando'}
          </span>
        </div>

        <div className="p-4 space-y-3 text-sm">
          {quem && <p className="text-xs text-slate-500 dark:text-slate-400">{quem}</p>}

          {decisao ? (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {decisao.aprovador?.fullName ?? '—'} · {fmtData(decisao.decididoEm)}
              </p>
              {editando ? (
                <>
                  <textarea
                    rows={3}
                    value={textoEdicao}
                    onChange={(e) => setTextoEdicao(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => void salvarEdicaoObs(nivel)}
                      disabled={salvandoEdicao}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold disabled:opacity-50"
                    >
                      {salvandoEdicao ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Salvar
                    </button>
                    <button
                      onClick={() => setEditandoObs(null)}
                      disabled={salvandoEdicao}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300"
                    >
                      Cancelar
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex items-start gap-2 rounded-lg bg-slate-50 dark:bg-slate-900/50 px-3 py-2">
                  <p className="flex-1 text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                    {decisao.motivo || <span className="text-slate-400">Sem observação.</span>}
                  </p>
                  {souPresidente && (
                    <button
                      onClick={() => {
                        setTextoEdicao(decisao.motivo ?? '');
                        setEditandoObs(nivel);
                      }}
                      title="Editar a observação (presidente)"
                      aria-label="Editar a observação"
                      className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : naVez ? (
            <>
              <textarea
                rows={3}
                value={obsNivel[nivel]}
                onChange={(e) => setObsNivel((o) => ({ ...o, [nivel]: e.target.value }))}
                placeholder={
                  pedindoMotivo === nivel
                    ? 'Motivo da devolução — obrigatório (a igreja recebe este texto)'
                    : 'Observação do dirigente (opcional ao aprovar)'
                }
                className={`w-full border rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
                  pedindoMotivo === nivel ? BORDA.ambar : 'border-slate-200 dark:border-slate-700'
                }`}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => void decidir(nivel, 'APROVADO')}
                  disabled={decidindo}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50"
                >
                  {decidindo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {souPresidente ? 'Aprovar pelo dirigente' : 'Aprovar'}
                </button>
                <button
                  onClick={() => void decidir(nivel, 'REJEITADO')}
                  disabled={decidindo}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-sm font-semibold disabled:opacity-50"
                >
                  <Undo2 className="w-4 h-4" />
                  Devolver
                </button>
              </div>
            </>
          ) : (
            <>
              {/* O campo aparece sempre, para o cartão ter a mesma cara em todo
                  culto — mas travado: o servidor recusa decidir fora da vez. */}
              <textarea
                rows={3}
                disabled
                placeholder="Observação do dirigente"
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 disabled:opacity-60 cursor-not-allowed"
              />
              <p className="text-xs text-slate-400">
                {nivel === 'LOCAL'
                  ? registro.blocosFaltando.length > 0
                    ? `Libera quando chegar ${registro.blocosFaltando
                        .map((b) => (b === 'FINANCEIRO' ? 'o Financeiro' : b === 'PRESENCA' ? 'a Presença' : 'o Complemento'))
                        .join(' e ')}.`
                    : podeAprovar.includes('LOCAL')
                      ? 'Ainda não decidiu.'
                      : 'Só o dirigente da congregação decide aqui.'
                  : registro.status === 'APROVADO_LOCAL' && !podeAprovar.includes('HOSPEDEIRA')
                    ? 'Só o dirigente hospedeiro decide aqui.'
                    : 'Libera depois que o dirigente da congregação aprovar.'}
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onClick={onFechar}>
      {/* Largo: Presença | Financeiro, embaixo Dirigente | Hospedeiro, e o
          parecer do presidente no fim — a ordem em que o culto é conferido. */}
      <div
        className="w-full max-w-5xl h-full bg-slate-50 dark:bg-slate-900 shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between px-5 py-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {registro?.church.name ?? 'Culto'}
            </h2>
            {registro && (
              <p className="mt-0.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                {fmtData(registro.dataCulto)}
                {fmtHora(registro.horaInicio, registro.horaFim)
                  ? ` · ${fmtHora(registro.horaInicio, registro.horaFim)}`
                  : ''}{' '}
                · {registro.tipoCulto} · {ROTULO_STATUS[registro.status]}
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
              {registro.blocosFaltando.length > 0 && (
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                  Faltando enviar:{' '}
                  <strong>
                    {registro.blocosFaltando
                      .map((b) => {
                        const quem = responsavel(b);
                        return `${ROTULO_BLOCO[b]}${quem ? ` (${quem})` : ' (sem responsável)'}`;
                      })
                      .join(', ')}
                  </strong>
                  . Não dá para aprovar até chegar.
                </div>
              )}

              {registro.observacao && (
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                  <strong className="text-slate-700 dark:text-slate-200">Observação do culto:</strong>{' '}
                  {registro.observacao}
                </div>
              )}

              {/* 1. Os envios: Presença (os membros) à esquerda, Financeiro à direita. */}
              <div className="grid gap-4 lg:grid-cols-2 items-start">
                {blocoCard('PRESENCA')}
                {blocoCard('FINANCEIRO')}
              </div>
              {blocoCard('EXTRA')}

              {/* 2. Quem aprova: dirigente da congregação e, se houver, o hospedeiro. */}
              <div className={`grid gap-4 items-start ${registro.hostChurchId ? 'lg:grid-cols-2' : ''}`}>
                {cartaoNivel('LOCAL')}
                {registro.hostChurchId && cartaoNivel('HOSPEDEIRA')}
              </div>

              {/* 3. O parecer do Pastor Presidente, que olha tudo acima. */}
              {(souPresidente || registro.observacaoPresidente) && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    <Crown className="w-4 h-4" /> Parecer do Pastor Presidente
                  </p>
                  {souPresidente ? (
                    <>
                      <textarea
                        rows={3}
                        value={obsPresidente}
                        onChange={(e) => setObsPresidente(e.target.value)}
                        placeholder="O parecer do presidente sobre este culto — sai nos relatórios."
                        className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={async () => {
                            setSalvandoObs(true);
                            setErro(null);
                            try {
                              await cultoApi.observacaoPresidente(registro.id, obsPresidente);
                              recarregar();
                              onMudou();
                            } catch (e) {
                              setErro((e as Error).message);
                            } finally {
                              setSalvandoObs(false);
                            }
                          }}
                          disabled={salvandoObs}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold disabled:opacity-50"
                        >
                          {salvandoObs ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                          Salvar parecer
                        </button>
                        {/* Fecha o culto sem esperar os dirigentes: aprova pelos
                            níveis que faltam, em nome do presidente. */}
                        {presidenteDecide && (
                          <button
                            onClick={() => void decidir('PRESIDENTE', 'APROVADO')}
                            disabled={decidindo}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50"
                          >
                            {decidindo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            Aprovar e concluir
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                      {registro.observacaoPresidente}
                    </p>
                  )}
                </div>
              )}

              {podeExcluir && (
                <div className={`rounded-xl border ${BORDA.vermelho} bg-white dark:bg-slate-800 p-4`}>
                  {confirmandoExclusao ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-sm mr-auto ${TEXTO.vermelho}`}>
                        Excluir este culto e tudo o que foi lançado nele?
                      </span>
                      <button
                        onClick={() => setConfirmandoExclusao(false)}
                        disabled={excluindo}
                        className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => void excluir()}
                        disabled={excluindo}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${PONTO.vermelho} hover:brightness-90 text-white text-sm font-semibold disabled:opacity-50`}
                      >
                        {excluindo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        Excluir
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmandoExclusao(true)}
                      className={`inline-flex items-center gap-2 text-sm font-semibold hover:underline ${TEXTO.vermelho}`}
                    >
                      <Trash2 className="w-4 h-4" />
                      Excluir culto
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
