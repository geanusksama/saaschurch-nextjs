/**
 * Blocos de Numeração de Dízimo.
 *
 * A igreja recebe talões de recibo físicos e o tesoureiro amarra cada dízimo
 * lançado ao número do recibo que entregou. Esta tela é onde esses talões
 * entram no sistema e onde se vê o que já foi gasto.
 *
 * Duas abas sobre o mesmo filtro, e a diferença entre elas é a UNIDADE:
 *   1. Blocos            — um talão por linha: faixa, usados, livres.
 *   2. Igrejas com blocos — uma IGREJA por linha, com o total somado dos talões
 *      dela e um switch só de exigência. Uma igreja com três blocos aparece
 *      três vezes na primeira aba e uma vez aqui.
 *
 * A segunda lista só traz igreja que tem bloco ATIVO. Sem esse filtro ela
 * virava a relação inteira do campo — centenas de linhas zeradas, com o switch
 * travado em todas, porque exigir numeração de quem não tem talão é o que a
 * própria rota recusa.
 *
 * Clicar num bloco abre a cartela: os números um a um, livres e usados.
 *
 * NADA CONSULTA SOZINHO. A tela abre vazia e só vai ao banco quando o usuário
 * clica em Buscar; trocar de filtro não dispara consulta. Cada carga varre
 * blocos, agrupa números por status e conta igrejas — caro demais para rodar a
 * cada mexida em filtro, ainda mais quando o resultado nem era o que a pessoa
 * queria ver.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Hash, Plus, Search, X, AlertTriangle, Check, Trash2,
  ChevronLeft, ChevronRight, Building2, Lock, Unlock, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiBase } from '../../lib/apiBase';
import { usePermissions } from '../../lib/usePermissions';
import { ConfirmDialog } from '../../components/app-ui/shared/ConfirmDialog';
import { ChurchPickerModal, type ChurchOption } from './ChurchPickerModal';
import { MAX_NUMEROS_POR_BLOCO, STATUS_LIVRE, validarFaixa } from '../../lib/dizimoNumeracao';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

const PERM_KEY = 'dizimo_blocos';

/**
 * Tamanho da página por aba. Fora do componente de propósito: dentro, seria um
 * objeto novo a cada render e arrastaria o `useCallback` da busca junto.
 *
 * A aba de igrejas é mais curta porque cada linha dela custa um groupBy de
 * números no servidor; a de blocos é uma linha por talão.
 */
const PAGE_SIZE = { blocos: 50, igrejas: 20 } as const;

/** O que cada aba guarda entre uma visita e outra. */
type EstadoAba = { linhas: Row[]; total: number; pagina: number; buscou: boolean };
const ABA_VAZIA: EstadoAba = { linhas: [], total: 0, pagina: 1, buscou: false };

function perfilAtual(): string {
  try { return JSON.parse(localStorage.getItem('mrm_user') || '{}').profileType || 'church'; }
  catch { return 'church'; }
}

const inputCls =
  'px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white';

/**
 * Botão que abre a busca de igreja e mostra a escolhida.
 *
 * O seletor é o ChurchPickerModal do Livro Caixa — digita o nome, clica em
 * Buscar, e ao abrir já lista as últimas igrejas consultadas. Um `<select>` com
 * a relação inteira do campo passa de 200 opções e ninguém acha a igreja
 * rolando a lista.
 */
function SeletorIgreja({
  igreja, onAbrir, onLimpar,
}: {
  igreja: ChurchOption | null;
  onAbrir: () => void;
  onLimpar: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onAbrir}
        className={`${inputCls} flex items-center gap-2 min-w-[240px] text-left hover:border-emerald-400 transition-colors`}
      >
        <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <span className={`truncate ${igreja ? '' : 'text-slate-400'}`}>
          {igreja ? igreja.name : 'Buscar igreja...'}
        </span>
      </button>
      {igreja && (
        <button
          type="button"
          onClick={onLimpar}
          title="Limpar igreja"
          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          <X className="w-4 h-4 text-slate-400" />
        </button>
      )}
    </div>
  );
}

export default function DizimoBlocos() {
  const perfil = perfilAtual();
  const { canView, canCreate, canEdit, canDelete } = usePermissions(perfil);
  const token = localStorage.getItem('mrm_token');
  const authHeaders = useMemo<Record<string, string>>(
    () => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }),
    [token]
  );
  const storedUser = (() => { try { return JSON.parse(localStorage.getItem('mrm_user') || '{}'); } catch { return {}; } })();
  const campoAtivo = localStorage.getItem('mrm_active_field_id') || storedUser.campoId || '';

  const [aba, setAba] = useState<'blocos' | 'igrejas'>('blocos');
  // Um campo só. O seletor de igreja que ficava aqui do lado fazia a mesma
  // pergunta duas vezes: a busca textual já filtra por nome e código da igreja
  // (e pelo número do bloco, quando o que se digita é um número).
  const [busca, setBusca] = useState('');

  /**
   * O resultado é guardado POR ABA.
   *
   * Trocar de aba não consulta e também não joga fora o que já foi buscado: se
   * a aba tem resultado de uma busca anterior, ela reaparece como estava, sem
   * ida ao banco. Quem nunca buscou naquela aba continua vendo a tela vazia.
   */
  const [estados, setEstados] = useState<Record<'blocos' | 'igrejas', EstadoAba>>({
    blocos: { ...ABA_VAZIA },
    igrejas: { ...ABA_VAZIA },
  });
  const atual = estados[aba];
  const { total, pagina, buscou } = atual;

  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  /**
   * Igreja escolhida ao clicar numa linha da aba de igrejas. Não é um seletor
   * na barra de filtros — é o atalho "me mostre os talões desta aqui".
   */
  const [igrejaFiltro, setIgrejaFiltro] = useState<{ id: string; name: string } | null>(null);

  const pageSize = PAGE_SIZE[aba];

  /** Igreja cuja exigência está esperando confirmação, e para qual valor. */
  const [exigenciaAlvo, setExigenciaAlvo] = useState<{ igreja: Row; valor: boolean } | null>(null);
  const [cadastroAberto, setCadastroAberto] = useState(false);
  const [cartelaDe, setCartelaDe] = useState<Row | null>(null);
  const [excluirAlvo, setExcluirAlvo] = useState<Row | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  /**
   * Vai ao banco. Só é chamada por clique: botão Buscar, troca de aba (de quem
   * já buscou antes), paginação e depois de gravar algo.
   */
  const buscar = useCallback(async (opcoes?: {
    aba?: 'blocos' | 'igrejas';
    pagina?: number;
    /** `null` limpa o filtro de igreja; `undefined` mantém o que está. */
    churchId?: string | null;
    texto?: string;
  }) => {
    const abaAlvo = opcoes?.aba ?? aba;
    const paginaAlvo = opcoes?.pagina ?? 1;
    const churchAlvo = opcoes?.churchId === undefined ? igrejaFiltro?.id : opcoes.churchId;
    const textoAlvo = opcoes?.texto ?? busca;
    setCarregando(true);
    setErro('');
    try {
      const p = new URLSearchParams();
      if (textoAlvo.trim()) p.set('q', textoAlvo.trim());
      // A igreja escolhida no clique vence o campo: ela identifica pelo id, e
      // o código da igreja se repete de propósito neste sistema.
      if (churchAlvo) p.set('churchId', churchAlvo);
      else if (campoAtivo) p.set('campoId', campoAtivo);
      p.set('pagina', String(paginaAlvo));
      p.set('pageSize', String(PAGE_SIZE[abaAlvo]));

      const url = abaAlvo === 'blocos'
        ? `${apiBase}/dizimo-blocos?${p}`
        : `${apiBase}/dizimo-blocos/igrejas?${p}`;
      // Tela de configuração não pode ler cache: o usuário salva e continua
      // vendo o estado antigo.
      const r = await fetch(url, { headers: authHeaders, cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Não foi possível carregar.');
      setEstados((e) => ({
        ...e,
        [abaAlvo]: { linhas: j.data ?? [], total: j.total ?? 0, pagina: paginaAlvo, buscou: true },
      }));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar.');
    } finally {
      setCarregando(false);
    }
  }, [aba, busca, campoAtivo, authHeaders, igrejaFiltro]);

  /**
   * Trocar de aba NÃO consulta — mas também não perde o que já foi buscado.
   *
   * O resultado de cada aba fica guardado: quem já buscou ali volta e encontra
   * a lista como deixou, sem nova ida ao banco. Quem nunca buscou naquela aba
   * vê a tela vazia e o botão Buscar, que é o certo — as duas abas respondem
   * perguntas diferentes, e cada linha da aba de igrejas custa um agrupamento
   * de números no servidor.
   */
  function trocarAba(nova: 'blocos' | 'igrejas') {
    setAba(nova);
    setErro('');
  }

  /**
   * Clique numa igreja da segunda aba: leva para os talões dela, na primeira.
   *
   * Filtra por `churchId` e não pelo texto porque o código da igreja se repete
   * de propósito neste sistema (Sede 1, Sede Brasil 1) — buscar "01-099-999"
   * poderia trazer talão de outra congregação com o mesmo código.
   */
  function verBlocosDaIgreja(igreja: Row) {
    setIgrejaFiltro({ id: igreja.id, name: igreja.name });
    setBusca('');
    setAba('blocos');
    setErro('');
    void buscar({ aba: 'blocos', pagina: 1, churchId: igreja.id, texto: '' });
  }

  /** Tira o filtro de igreja e refaz a busca da aba aberta. */
  function limparIgrejaFiltro() {
    setIgrejaFiltro(null);
    if (buscou) void buscar({ pagina: 1, churchId: null });
  }

  /**
   * Confirma antes de virar a chave.
   *
   * Um clique aqui muda a rotina da tesouraria de uma igreja inteira: ligado,
   * ela para de conseguir lançar dízimo sem número do talão. É barato clicar
   * sem querer numa tabela e caro descobrir depois, pelo telefone do tesoureiro.
   */
  async function alternarExigencia(igreja: Row, valor: boolean) {
    setExigenciaAlvo(null);
    try {
      const r = await fetch(`${apiBase}/dizimo-blocos/igrejas`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ churchId: igreja.id, exige: valor }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Não foi possível salvar.');
      // Atualiza a linha no estado guardado da aba, sem refazer a busca.
      setEstados((e) => ({
        ...e,
        igrejas: {
          ...e.igrejas,
          linhas: e.igrejas.linhas.map((l) => (l.id === igreja.id ? { ...l, exigeNumeracao: valor } : l)),
        },
      }));
      toast.success(
        valor
          ? `${igreja.name} passa a exigir o número do bloco no dízimo.`
          : `${igreja.name} volta a lançar dízimo sem número.`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.');
    }
  }

  async function excluirBloco() {
    if (!excluirAlvo) return;
    setExcluindo(true);
    try {
      const r = await fetch(`${apiBase}/dizimo-blocos/${excluirAlvo.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Não foi possível excluir.');
      toast.success('Bloco excluído.');
      setExcluirAlvo(null);
      void buscar({ pagina });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível excluir.');
    } finally {
      setExcluindo(false);
    }
  }

  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));

  // O menu já esconde o item de quem não tem a chave, mas a URL continua
  // digitável — e o talão é o controle do dinheiro do dízimo. Quem não pode
  // ver não vê nem colando o link. O perfil igreja nasce fora daqui de
  // propósito: quem ENTREGA o talão não pode ser quem o recebe. Isso não
  // atrapalha o tesoureiro, que usa os números na tela de Lançamento — ela
  // confere contra o bloco da igreja dele sem depender desta chave.
  if (!canView(PERM_KEY)) {
    return (
      <div className="p-6">
        <div className="flex items-start gap-3 px-4 py-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 max-w-lg">
          <Lock className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="font-bold text-slate-800 dark:text-white text-sm">Sem acesso a esta tela</h2>
            <p className="text-xs text-slate-500 mt-1">
              A gestão dos blocos de numeração é do campo. Para lançar dízimo com o número do
              talão, use Finanças › Lançamento.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 text-slate-900 dark:text-slate-100">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center flex-shrink-0">
          <Hash className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">Blocos de Numeração</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Talões de recibo de dízimo por igreja. Os números de uma igreja não servem em outra.
          </p>
        </div>
        {canCreate(PERM_KEY) && (
          <button
            onClick={() => setCadastroAberto(true)}
            className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
          >
            <Plus className="w-4 h-4" /> Cadastrar bloco
          </button>
        )}
      </div>

      {/* Abas */}
      <div className="flex items-center gap-1 mb-3 border-b border-slate-200 dark:border-slate-700">
        {([['blocos', 'Blocos'], ['igrejas', 'Igrejas com blocos']] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => trocarAba(k)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              aba === k
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filtros — nada aqui dispara consulta; quem consulta é o botão Buscar. */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2.5 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={aba === 'blocos' ? 'Nome da igreja ou número do bloco...' : 'Nome da igreja...'}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void buscar({ pagina: 1 }); }}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            />
          </div>

          {/* Veio de um clique na aba de igrejas. Fica visível para a lista
              não parecer incompleta sem motivo, e sai com um clique. */}
          {igrejaFiltro && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border bg-[#ecfdf5] border-[#6ee7b7] text-[#047857] dark:bg-[#064e3b] dark:border-[#047857] dark:text-[#6ee7b7]">
              <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate max-w-[220px]">{igrejaFiltro.name}</span>
              <button
                type="button"
                onClick={limparIgrejaFiltro}
                title="Tirar o filtro desta igreja"
                className="p-0.5 rounded hover:bg-black/10"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )}

          {/* Só Buscar. Não existe "Atualizar" separado porque ele fazia a
              mesma coisa: clicar em Buscar de novo já refaz a consulta. */}
          <button
            onClick={() => void buscar({ pagina: 1 })}
            disabled={carregando}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold"
          >
            {carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {carregando ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
      </div>

      {erro && (
        <div className="flex items-center gap-2 px-4 py-3 mb-4 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {erro}
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {!buscou ? (
          <EstadoVazio texto="Escolha os filtros e clique em Buscar. A tela não consulta sozinha para não pesar no banco." />
        ) : aba === 'blocos' ? (
          <TabelaBlocos
            linhas={atual.linhas}
            carregando={carregando}
            podeExcluir={canDelete(PERM_KEY)}
            onAbrirCartela={setCartelaDe}
            onExcluir={setExcluirAlvo}
          />
        ) : (
          <TabelaIgrejas
            linhas={atual.linhas}
            carregando={carregando}
            podeEditar={canEdit(PERM_KEY)}
            // O clique só pede a confirmação; quem grava é o ConfirmDialog.
            onAlternar={(igreja, valor) => setExigenciaAlvo({ igreja, valor })}
            onVerBlocos={verBlocosDaIgreja}
          />
        )}

        {buscou && totalPaginas > 1 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-500">
            <span>{total.toLocaleString('pt-BR')} registro(s)</span>
            <div className="flex items-center gap-2">
              <button
                disabled={pagina <= 1 || carregando}
                onClick={() => void buscar({ pagina: pagina - 1 })}
                className="p-1 rounded disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span>{pagina} / {totalPaginas}</span>
              <button
                disabled={pagina >= totalPaginas || carregando}
                onClick={() => void buscar({ pagina: pagina + 1 })}
                className="p-1 rounded disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {cadastroAberto && (
        <CadastroBlocoModal
          authHeaders={authHeaders}
          onFechar={() => setCadastroAberto(false)}
          onCriado={() => { setCadastroAberto(false); void buscar({ pagina }); }}
        />
      )}

      {cartelaDe && (
        <CartelaModal
          bloco={cartelaDe}
          authHeaders={authHeaders}
          onFechar={() => setCartelaDe(null)}
          // Excluir número ou bloco lá dentro muda as contagens desta tabela.
          onMudou={() => void buscar({ pagina })}
        />
      )}

      <ConfirmDialog
        open={Boolean(excluirAlvo)}
        title="Excluir bloco"
        message={
          excluirAlvo
            ? `Excluir o bloco ${excluirAlvo.numeroBloco} de ${excluirAlvo.church?.name} (${excluirAlvo.numeroInicial}–${excluirAlvo.numeroFinal})? Só é possível enquanto nenhum número tiver sido usado.`
            : ''
        }
        confirmLabel="Excluir"
        loading={excluindo}
        variant="danger"
        onConfirm={excluirBloco}
        onCancel={() => setExcluirAlvo(null)}
      />

      <ConfirmDialog
        open={Boolean(exigenciaAlvo)}
        title={exigenciaAlvo?.valor ? 'Exigir número no dízimo?' : 'Desligar a exigência?'}
        message={
          exigenciaAlvo
            ? exigenciaAlvo.valor
              ? `A partir de agora, ${exigenciaAlvo.igreja.name} só consegue lançar dízimo informando um número livre do talão dela. Quem estiver com a tela de Lançamento aberta sente a mudança no próximo salvamento.`
              : `${exigenciaAlvo.igreja.name} volta a lançar dízimo sem informar número. Os números já usados continuam registrados; o campo apenas deixa de ser obrigatório.`
            : ''
        }
        confirmLabel={exigenciaAlvo?.valor ? 'Exigir número' : 'Desligar exigência'}
        variant={exigenciaAlvo?.valor ? 'info' : 'warning'}
        onConfirm={() => { if (exigenciaAlvo) void alternarExigencia(exigenciaAlvo.igreja, exigenciaAlvo.valor); }}
        onCancel={() => setExigenciaAlvo(null)}
      />
    </div>
  );
}

// ─── Tabela de blocos ────────────────────────────────────────────────────────

function TabelaBlocos({
  linhas, carregando, podeExcluir, onAbrirCartela, onExcluir,
}: {
  linhas: Row[];
  carregando: boolean;
  podeExcluir: boolean;
  onAbrirCartela: (b: Row) => void;
  onExcluir: (b: Row) => void;
}) {
  if (carregando) return <EstadoVazio texto="Buscando..." carregando />;
  if (!linhas.length) {
    return <EstadoVazio texto="Nenhum bloco para este filtro. Use “Cadastrar bloco” para registrar o talão que a igreja recebeu." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 dark:bg-slate-900/40 text-xs uppercase text-slate-500 dark:text-slate-400">
          <tr>
            <th className="text-left px-4 py-2 font-semibold">Igreja</th>
            <th className="text-left px-4 py-2 font-semibold">Regional</th>
            <th className="text-right px-4 py-2 font-semibold">Bloco</th>
            <th className="text-right px-4 py-2 font-semibold">Início</th>
            <th className="text-right px-4 py-2 font-semibold">Fim</th>
            <th className="text-right px-4 py-2 font-semibold">Qtd.</th>
            <th className="text-right px-4 py-2 font-semibold">Usados</th>
            <th className="text-right px-4 py-2 font-semibold">Livres</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
          {linhas.map((b) => (
            <tr
              key={b.id}
              onClick={() => onAbrirCartela(b)}
              className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40 ${b.ativo ? '' : 'opacity-50'}`}
              title="Ver os números deste bloco"
            >
              <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-100">
                {b.church?.name}
                {b.church?.exigeNumeracao && (
                  <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                    <Lock className="w-3 h-3" /> exige
                  </span>
                )}
              </td>
              <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{b.church?.regional?.name ?? '—'}</td>
              <td className="px-4 py-2 text-right font-bold text-slate-800 dark:text-slate-100">{b.numeroBloco}</td>
              <td className="px-4 py-2 text-right tabular-nums">{b.numeroInicial}</td>
              <td className="px-4 py-2 text-right tabular-nums">{b.numeroFinal}</td>
              <td className="px-4 py-2 text-right tabular-nums text-slate-500">{b.quantidade}</td>
              <td className="px-4 py-2 text-right tabular-nums font-semibold text-slate-700 dark:text-slate-200">{b.usados}</td>
              <td className="px-4 py-2 text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">{b.livres}</td>
              <td className="px-4 py-2 text-right">
                {podeExcluir && b.usados === 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onExcluir(b); }}
                    title="Excluir bloco"
                    className="p-1.5 rounded hover:bg-rose-50 dark:hover:bg-rose-900/30 text-rose-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Tabela de igrejas (o switch) ────────────────────────────────────────────

function TabelaIgrejas({
  linhas, carregando, podeEditar, onAlternar, onVerBlocos,
}: {
  linhas: Row[];
  carregando: boolean;
  podeEditar: boolean;
  onAlternar: (igreja: Row, valor: boolean) => void;
  /** Clique na linha: leva para os talões desta igreja, na aba Blocos. */
  onVerBlocos: (igreja: Row) => void;
}) {
  if (carregando) return <EstadoVazio texto="Buscando..." carregando />;
  if (!linhas.length) return <EstadoVazio texto="Nenhuma igreja para este filtro." />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 dark:bg-slate-900/40 text-xs uppercase text-slate-500 dark:text-slate-400">
          <tr>
            <th className="text-left px-4 py-2 font-semibold">Igreja</th>
            <th className="text-left px-4 py-2 font-semibold">Regional</th>
            <th className="text-right px-4 py-2 font-semibold">Blocos</th>
            <th className="text-right px-4 py-2 font-semibold">Usados</th>
            <th className="text-right px-4 py-2 font-semibold">Livres</th>
            <th className="text-center px-4 py-2 font-semibold">Exigir número no dízimo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
          {linhas.map((c) => (
            <tr
              key={c.id}
              onClick={() => onVerBlocos(c)}
              title="Ver os talões desta igreja"
              className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40"
            >
              <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-100">{c.name}</td>
              <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{c.regional?.name ?? '—'}</td>
              <td className="px-4 py-2 text-right tabular-nums">{c.blocos}</td>
              <td className="px-4 py-2 text-right tabular-nums">{c.usados}</td>
              <td className="px-4 py-2 text-right tabular-nums font-semibold text-[#047857] dark:text-[#6ee7b7]">{c.livres}</td>
              {/* O switch tem ação própria: o clique nele não pode virar
                  navegação para a outra aba. */}
              <td className="px-4 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                {/* Sem bloco cadastrado o switch fica travado: ligar ali daria
                    à igreja um campo obrigatório que nenhum número satisfaz, e
                    a tesouraria dela pararia de lançar dízimo. */}
                <button
                  type="button"
                  disabled={!podeEditar || (!c.exigeNumeracao && c.livres === 0)}
                  onClick={() => onAlternar(c, !c.exigeNumeracao)}
                  title={
                    !c.exigeNumeracao && c.livres === 0
                      ? 'Cadastre um bloco com números livres antes de exigir a numeração.'
                      : c.exigeNumeracao
                        ? 'Clique para permitir lançamento de dízimo sem número'
                        : 'Clique para exigir número do bloco no dízimo'
                  }
                  /*
                   * Verde = exigindo, laranja = desligado. Laranja e não cinza
                   * de propósito: "sem numeração" não é estado neutro, é a
                   * igreja lançando dízimo sem recibo amarrado — dá para
                   * varrer a coluna e ver quem ainda está assim.
                   *
                   * As cores vão em HEX e NÃO como `bg-amber-50` por um motivo
                   * concreto: globals.css tem regras `.app-shell
                   * [class*="bg-amber-50"]`, `[class*="text-amber-700"]` e
                   * `[class*="border-amber-"]` que trocam tudo pela cor do
                   * tema com `!important`. Escrito pelo nome da paleta, este
                   * botão sai cinza — verde e laranja viram a mesma coisa e o
                   * estado deixa de ser legível. O valor arbitrário não casa
                   * com aqueles seletores e sobrevive.
                   */
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    c.exigeNumeracao
                      ? 'bg-[#ecfdf5] border-[#6ee7b7] text-[#047857] dark:bg-[#064e3b] dark:border-[#047857] dark:text-[#6ee7b7]'
                      : 'bg-[#fffbeb] border-[#fcd34d] text-[#b45309] dark:bg-[#78350f] dark:border-[#b45309] dark:text-[#fcd34d]'
                  }`}
                >
                  {c.exigeNumeracao ? <><Lock className="w-3.5 h-3.5" /> Exigindo</> : <><Unlock className="w-3.5 h-3.5" /> Desligado</>}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EstadoVazio({ texto, carregando }: { texto: string; carregando?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400 dark:text-slate-500 text-sm">
      {carregando
        ? <Loader2 className="w-6 h-6 animate-spin" />
        : <Building2 className="w-8 h-8 text-slate-200 dark:text-slate-700" />}
      <span className="max-w-md text-center px-6">{texto}</span>
    </div>
  );
}

// ─── Modal de cadastro ───────────────────────────────────────────────────────

function CadastroBlocoModal({
  authHeaders, onFechar, onCriado,
}: {
  authHeaders: Record<string, string>;
  onFechar: () => void;
  onCriado: () => void;
}) {
  const [igreja, setIgreja] = useState<ChurchOption | null>(null);
  const [pickerAberto, setPickerAberto] = useState(false);
  const [numeroBloco, setNumeroBloco] = useState('');
  const [numeroInicial, setNumeroInicial] = useState('');
  const [numeroFinal, setNumeroFinal] = useState('');
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const inicio = Number(numeroInicial);
  const fim = Number(numeroFinal);
  const faixaValida = Number.isSafeInteger(inicio) && Number.isSafeInteger(fim) && inicio > 0 && fim >= inicio;
  const quantidade = faixaValida ? fim - inicio + 1 : 0;
  const avisoFaixa = numeroInicial && numeroFinal ? validarFaixa({ numeroInicial: inicio, numeroFinal: fim }) : null;

  async function salvar() {
    setErro('');
    if (!igreja) return setErro('Busque e selecione a igreja.');
    if (!numeroBloco.trim()) return setErro('Informe o número do bloco.');
    if (avisoFaixa) return setErro(avisoFaixa);
    if (!faixaValida) return setErro('Informe a faixa de números do bloco.');

    setSalvando(true);
    try {
      const r = await fetch(`${apiBase}/dizimo-blocos`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          churchId: igreja.id,
          numeroBloco: Number(numeroBloco),
          numeroInicial: inicio,
          numeroFinal: fim,
          observacao,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Não foi possível cadastrar o bloco.');
      toast.success(`Bloco ${j.numeroBloco} cadastrado com ${j.quantidade} número(s).`);
      onCriado();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível cadastrar o bloco.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-700">
          <h2 className="text-base font-bold text-slate-800 dark:text-white">Cadastrar bloco</h2>
          <button onClick={onFechar} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {/* A regional vem junto da igreja escolhida — não é uma segunda
              pergunta a responder, é informação da mesma resposta. */}
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Igreja</label>
            <SeletorIgreja
              igreja={igreja}
              onAbrir={() => setPickerAberto(true)}
              onLimpar={() => setIgreja(null)}
            />
            {igreja?.regional?.name && (
              <p className="mt-1 text-[11px] text-slate-400">Regional: {igreja.regional.name}</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Nº do bloco</label>
              <input
                type="number"
                min={1}
                value={numeroBloco}
                onChange={(e) => setNumeroBloco(e.target.value)}
                placeholder="100"
                className={`${inputCls} w-full`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Do número</label>
              <input
                type="number"
                min={1}
                value={numeroInicial}
                onChange={(e) => setNumeroInicial(e.target.value)}
                placeholder="1"
                className={`${inputCls} w-full`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Ao número</label>
              <input
                type="number"
                min={1}
                value={numeroFinal}
                onChange={(e) => setNumeroFinal(e.target.value)}
                placeholder="100"
                className={`${inputCls} w-full`}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Observação</label>
            <input
              type="text"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Opcional — ex.: talão entregue ao tesoureiro em 01/2026"
              className={`${inputCls} w-full`}
            />
          </div>

          {/* O usuário vê quantos recibos vai gerar ANTES de confirmar: o
              cadastro cria uma linha por número e não tem desfazer depois que
              alguém usa um deles. */}
          {quantidade > 0 && !avisoFaixa && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-xs">
              <Check className="w-4 h-4 flex-shrink-0" />
              Serão gerados <strong>{quantidade.toLocaleString('pt-BR')}</strong> números,
              de {inicio} a {fim}, só para esta igreja.
            </div>
          )}
          {avisoFaixa && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-xs">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {avisoFaixa}
            </div>
          )}
          {erro && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 text-xs">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {erro}
            </div>
          )}
          <p className="text-[11px] text-slate-400">
            Limite de {MAX_NUMEROS_POR_BLOCO.toLocaleString('pt-BR')} números por bloco.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100 dark:border-slate-700">
          <button onClick={onFechar} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300">
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={salvando}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold"
          >
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Gerar bloco
          </button>
        </div>
      </div>

      {pickerAberto && (
        <ChurchPickerModal
          onClose={() => setPickerAberto(false)}
          onSelect={(church) => { setIgreja(church); setPickerAberto(false); }}
        />
      )}
    </div>
  );
}

// ─── Cartela: os números do bloco ────────────────────────────────────────────
function CartelaModal({
  bloco, authHeaders, onFechar, onMudou,
}: {
  bloco: Row;
  authHeaders: Record<string, string>;
  onFechar: () => void;
  /** A tabela de fora mostra contagens; excluir aqui as deixa desatualizadas. */
  onMudou: () => void;
}) {
  // A sala pode trocar sem fechar o modal: a igreja pegou o bloco 100 este ano
  // e vai pegar o 400 no ano que vem, e conferir o talão é passear entre eles.
  const [blocoAtivo, setBlocoAtivo] = useState<Row>(bloco);
  const [blocosDaIgreja, setBlocosDaIgreja] = useState<Row[]>([]);

  const [filtro, setFiltro] = useState<'' | 'LIVRE' | 'USADO'>('');
  const [numeros, setNumeros] = useState<Row[]>([]);
  const [resumo, setResumo] = useState<Row | null>(null);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [recarga, setRecarga] = useState(0);
  const pageSize = 200;

  const [excluirNumero, setExcluirNumero] = useState<Row | null>(null);
  const [excluirBlocoAberto, setExcluirBlocoAberto] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const churchId = blocoAtivo.church?.id ?? bloco.church?.id ?? '';

  // Os outros talões da mesma igreja, para a lista do topo.
  useEffect(() => {
    if (!churchId) return;
    let vivo = true;
    (async () => {
      try {
        const r = await fetch(
          `${apiBase}/dizimo-blocos?churchId=${encodeURIComponent(churchId)}&pageSize=200`,
          { headers: authHeaders, cache: 'no-store' }
        );
        const j = await r.json();
        if (vivo && r.ok) setBlocosDaIgreja(j.data ?? []);
      } catch { /* sem a lista, o modal ainda mostra o bloco aberto */ }
    })();
    return () => { vivo = false; };
  }, [churchId, authHeaders, recarga]);

  /**
   * Aqui a consulta automática se justifica, e as da tela de fora não: abrir a
   * cartela É o pedido para ver os números, e o escopo é um bloco só.
   */
  useEffect(() => {
    let vivo = true;
    (async () => {
      setCarregando(true);
      try {
        const p = new URLSearchParams({ pagina: String(pagina), pageSize: String(pageSize) });
        if (filtro) p.set('status', filtro);
        const r = await fetch(`${apiBase}/dizimo-blocos/${blocoAtivo.id}/numeros?${p}`, {
          headers: authHeaders,
          cache: 'no-store',
        });
        const j = await r.json();
        if (!vivo) return;
        if (r.ok) { setNumeros(j.data ?? []); setTotal(j.total ?? 0); setResumo(j.bloco ?? null); }
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => { vivo = false; };
  }, [blocoAtivo.id, filtro, pagina, authHeaders, recarga]);

  function trocarBloco(b: Row) {
    setBlocoAtivo(b);
    setPagina(1);
    setFiltro('');
  }

  async function confirmarExclusaoNumero() {
    if (!excluirNumero) return;
    setExcluindo(true);
    try {
      const r = await fetch(`${apiBase}/dizimo-blocos/numeros/${excluirNumero.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Não foi possível excluir o número.');
      toast.success(
        j.estavaUsado
          ? `Número ${j.numero} removido — estava marcado como usado, sem lançamento vinculado.`
          : `Número ${j.numero} removido da cartela.`
      );
      setExcluirNumero(null);
      setRecarga((n) => n + 1);
      onMudou();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível excluir o número.');
    } finally {
      setExcluindo(false);
    }
  }

  async function confirmarExclusaoBloco() {
    setExcluindo(true);
    try {
      const r = await fetch(`${apiBase}/dizimo-blocos/${blocoAtivo.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Não foi possível excluir o bloco.');
      toast.success(`Bloco ${blocoAtivo.numeroBloco} excluído com ${j.numerosRemovidos ?? 0} número(s).`);
      setExcluirBlocoAberto(false);
      onMudou();

      // Sobrou outro talão desta igreja? Abre ele. Era o último? Fecha o modal,
      // porque não há mais sala nenhuma para mostrar.
      const restantes = blocosDaIgreja.filter((b) => b.id !== blocoAtivo.id);
      if (restantes.length) { setBlocosDaIgreja(restantes); trocarBloco(restantes[0]); }
      else onFechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível excluir o bloco.');
    } finally {
      setExcluindo(false);
    }
  }

  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));
  const lista = blocosDaIgreja.length ? blocosDaIgreja : [blocoAtivo];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 py-3 border-b border-slate-100 dark:border-slate-700">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-800 dark:text-white truncate">
              Bloco {blocoAtivo.numeroBloco} · {blocoAtivo.church?.name}
            </h2>
            <p className="text-xs text-slate-500">
              {blocoAtivo.numeroInicial}–{blocoAtivo.numeroFinal}
              {resumo && ` · ${resumo.livres} livre(s) · ${resumo.usados} usado(s)`}
            </p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setExcluirBlocoAberto(true)}
              title="Excluir este bloco e todos os seus números"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30"
            >
              <Trash2 className="w-4 h-4" /> Excluir bloco
            </button>
            <button onClick={onFechar} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Os talões que esta igreja já recebeu, um chip por bloco. É a gaveta
            dela: hoje o 100 (1–100), ano que vem o 400 (400–499). */}
        <div className="px-5 py-2 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 flex-shrink-0 pr-1">
              Blocos
            </span>
            {lista.map((b) => (
              <button
                key={b.id}
                onClick={() => trocarBloco(b)}
                title={`${b.numeroInicial}–${b.numeroFinal}${typeof b.livres === 'number' ? ` · ${b.livres} livre(s)` : ''}`}
                className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                  b.id === blocoAtivo.id
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-emerald-400'
                } ${b.ativo === false ? 'opacity-50' : ''}`}
              >
                {b.numeroBloco}
                <span className={`ml-1.5 font-normal ${b.id === blocoAtivo.id ? 'text-emerald-100' : 'text-slate-400'}`}>
                  {b.numeroInicial}–{b.numeroFinal}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 px-5 py-2 border-b border-slate-100 dark:border-slate-700">
          {([['', 'Todos'], ['LIVRE', 'Livres'], ['USADO', 'Usados']] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => { setFiltro(k); setPagina(1); }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold border ${
                filtro === k
                  ? 'bg-slate-800 border-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                  : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
          <span className="ml-auto text-[11px] text-slate-400">Clique num número para excluí-lo</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {carregando ? (
            <EstadoVazio texto="Carregando..." carregando />
          ) : !numeros.length ? (
            <EstadoVazio texto="Nenhum número neste filtro." />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-1.5">
              {numeros.map((n) => {
                const usado = n.status !== STATUS_LIVRE;
                const quando = n.livroCaixa?.dataLancamento
                  ? new Date(n.livroCaixa.dataLancamento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
                  : null;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setExcluirNumero(n)}
                    title={
                      usado
                        ? `Usado${quando ? ` em ${quando}` : ''}${n.livroCaixa?.favorecido ? ` — ${n.livroCaixa.favorecido}` : ''} · clique para excluir`
                        : 'Livre · clique para excluir'
                    }
                    /*
                     * Livre = verde, usado = laranja. Em HEX, não como
                     * `bg-emerald-50`: globals.css tem regras
                     * `.app-shell [class*="bg-emerald-50"]` (e as equivalentes
                     * de texto e borda) que trocam tudo pela cor do tema com
                     * `!important`. Pelo nome da paleta, a cartela inteira sai
                     * cinza e livre fica igual a usado — que é exatamente o que
                     * esta tela existe para distinguir.
                     */
                    className={`px-1 py-1.5 rounded text-center text-xs font-semibold tabular-nums border transition-colors hover:border-[#fb7185] hover:bg-[#fff1f2] hover:text-[#be123c] ${
                      usado
                        ? 'bg-[#fffbeb] border-[#fcd34d] text-[#b45309] dark:bg-[#78350f] dark:border-[#b45309] dark:text-[#fcd34d]'
                        : 'bg-[#ecfdf5] border-[#6ee7b7] text-[#047857] dark:bg-[#064e3b] dark:border-[#047857] dark:text-[#6ee7b7]'
                    }`}
                  >
                    {n.numero}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-2 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-500">
          <span>{total.toLocaleString('pt-BR')} número(s)</span>
          {totalPaginas > 1 && (
            <div className="flex items-center gap-2">
              <button disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)} className="p-1 rounded disabled:opacity-30">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span>{pagina} / {totalPaginas}</span>
              <button disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)} className="p-1 rounded disabled:opacity-30">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(excluirNumero)}
        title={`Excluir o número ${excluirNumero?.numero ?? ''}?`}
        message={
          excluirNumero
            ? excluirNumero.livroCaixa
              ? 'Este número está preso a um dízimo já lançado e não pode ser excluído — o servidor vai recusar. Exclua o lançamento primeiro.'
              : `O número ${excluirNumero.numero} sai da cartela do bloco ${blocoAtivo.numeroBloco} e deixa de existir para esta igreja. Use isto quando a folha do talão está rasgada, borrada ou nunca chegou. Não tem desfazer.`
            : ''
        }
        confirmLabel="Excluir número"
        loading={excluindo}
        variant="danger"
        onConfirm={confirmarExclusaoNumero}
        onCancel={() => setExcluirNumero(null)}
      />

      <ConfirmDialog
        open={excluirBlocoAberto}
        title={`Excluir o bloco ${blocoAtivo.numeroBloco} inteiro?`}
        message={`Some o bloco ${blocoAtivo.numeroBloco} (${blocoAtivo.numeroInicial}–${blocoAtivo.numeroFinal}) de ${blocoAtivo.church?.name} e, em cascata, TODOS os números dele. Só é possível se nenhum número estiver preso a um dízimo já lançado. Não tem desfazer.`}
        confirmLabel="Excluir bloco e números"
        loading={excluindo}
        variant="danger"
        onConfirm={confirmarExclusaoBloco}
        onCancel={() => setExcluirBlocoAberto(false)}
      />
    </div>
  );
}
