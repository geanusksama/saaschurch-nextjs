/**
 * Formulário do conteúdo de um jogo (Mobile › EBD e jogos › Jogos).
 * A pessoa preenche campos comuns; o JSON que o app lê é montado por
 * src/lib/mobile/jogoDados.ts (e validado de novo no servidor).
 */
import { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { montarCruzada, palavrasDaCruzada, vazioDoJogo, type PalavraCruzada } from '../../lib/mobile/jogoDados';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Dados = Record<string, any>;

const inputCls =
  'w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500';
const rotulo = 'text-xs font-semibold text-slate-500 mb-1';

/** Dados do tipo certo para o jogo escolhido (trocar de jogo começa do zero). */
function dadosDoJogo(jogo: string, valor: unknown): Dados {
  let d: Dados = {};
  if (typeof valor === 'string') { try { d = JSON.parse(valor); } catch { d = {}; } }
  else if (valor && typeof valor === 'object') d = valor as Dados;
  const bate =
    (jogo === 'QUIZ' && 'pergunta' in d) || (jogo === 'VF' && 'afirmacao' in d) ||
    (jogo === 'FORCA' && 'palavra' in d) || (jogo === 'CRUZADAS' && ('palavras' in d || 'grade' in d));
  if (!bate) return vazioDoJogo(jogo);
  if (jogo === 'CRUZADAS') return { palavras: palavrasDaCruzada(d) };
  return d;
}

export function JogoEditor({ jogo, valor, onChange, travado }: {
  jogo: string; valor: unknown; onChange: (v: Dados) => void; travado: boolean;
}) {
  const d = dadosDoJogo(jogo || 'QUIZ', valor);
  const set = (patch: Dados) => onChange({ ...d, ...patch });

  if (jogo === 'VF') {
    return (
      <div className="space-y-3">
        <div>
          <p className={rotulo}>Afirmação <span className="text-rose-500">*</span></p>
          <textarea rows={3} className={inputCls} disabled={travado} value={d.afirmacao ?? ''} onChange={(e) => set({ afirmacao: e.target.value })}
            placeholder="Ex.: Moisés abriu o Mar Vermelho." />
        </div>
        <div>
          <p className={rotulo}>A afirmação é</p>
          <div className="flex gap-2">
            {[[true, 'Verdadeira'], [false, 'Falsa']].map(([v, r]) => (
              <button key={String(v)} type="button" disabled={travado} onClick={() => set({ verdadeiro: v })}
                className={`px-4 py-2 rounded-lg text-sm font-semibold border ${d.verdadeiro === v ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-200 dark:border-slate-600'}`}>
                {r as string}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (jogo === 'FORCA') {
    return (
      <div className="space-y-3">
        <div>
          <p className={rotulo}>Palavra <span className="text-rose-500">*</span></p>
          <input className={inputCls} disabled={travado} value={d.palavra ?? ''} onChange={(e) => set({ palavra: e.target.value })} placeholder="Ex.: JERUSALEM" />
          <p className="text-[11px] text-slate-400 mt-1">Acentos e espaços são tirados; o jogo usa só letras.</p>
        </div>
        <div>
          <p className={rotulo}>Dica <span className="text-rose-500">*</span></p>
          <input className={inputCls} disabled={travado} value={d.dica ?? ''} onChange={(e) => set({ dica: e.target.value })} placeholder="Ex.: Cidade santa" />
        </div>
      </div>
    );
  }

  if (jogo === 'CRUZADAS') return <Cruzadas palavras={d.palavras ?? []} onChange={(p) => onChange({ palavras: p })} travado={travado} />;

  // QUIZ
  const opcoes: string[] = Array.isArray(d.opcoes) ? [...d.opcoes, '', '', '', ''].slice(0, 4) : ['', '', '', ''];
  return (
    <div className="space-y-3">
      <div>
        <p className={rotulo}>Pergunta <span className="text-rose-500">*</span></p>
        <textarea rows={2} className={inputCls} disabled={travado} value={d.pergunta ?? ''} onChange={(e) => set({ pergunta: e.target.value })}
          placeholder="Ex.: Quem construiu a arca?" />
      </div>
      <div>
        <p className={rotulo}>Alternativas — marque a correta <span className="text-rose-500">*</span></p>
        <div className="space-y-2">
          {opcoes.map((o, i) => (
            <label key={i} className="flex items-center gap-2">
              <input type="radio" name="correta" className="w-4 h-4 accent-purple-600" disabled={travado}
                checked={Number(d.correta ?? 0) === i} onChange={() => set({ correta: i, opcoes })} />
              <span className="w-5 text-xs font-bold text-slate-400">{'ABCD'[i]}</span>
              <input className={inputCls} disabled={travado} value={o}
                onChange={(e) => { const n = [...opcoes]; n[i] = e.target.value; set({ opcoes: n }); }} />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function Cruzadas({ palavras, onChange, travado }: { palavras: PalavraCruzada[]; onChange: (p: PalavraCruzada[]) => void; travado: boolean }) {
  const previa = useMemo(() => montarCruzada(palavras), [palavras]);
  const muda = (i: number, patch: Partial<PalavraCruzada>) => onChange(palavras.map((p, k) => (k === i ? { ...p, ...patch } : p)));
  const grade: string[] = previa.dados?.grade ?? [];
  const numeros: Record<string, string> = previa.dados?.numeros ?? {};
  const colunas = grade[0]?.length ?? 0;

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-slate-400">
        Informe cada palavra, a dica e onde ela começa (linha e coluna, a partir de 1). Palavras que se cruzam precisam ter a mesma letra no cruzamento. A grade e a numeração saem sozinhas.
      </p>
      {palavras.map((p, i) => (
        <div key={i} className="rounded-lg border border-slate-200 dark:border-slate-600 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 w-16">Palavra {i + 1}</span>
            <input className={inputCls} placeholder="Palavra" disabled={travado} value={p.palavra} onChange={(e) => muda(i, { palavra: e.target.value })} />
            {!travado && palavras.length > 1 && (
              <button type="button" title="Remover" onClick={() => onChange(palavras.filter((_, k) => k !== i))} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <input className={inputCls} placeholder="Dica" disabled={travado} value={p.dica} onChange={(e) => muda(i, { dica: e.target.value })} />
          <div className="flex items-center gap-2 text-xs">
            <select className="h-9 px-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700" disabled={travado} value={p.direcao} onChange={(e) => muda(i, { direcao: e.target.value as 'H' | 'V' })}>
              <option value="H">Horizontal →</option>
              <option value="V">Vertical ↓</option>
            </select>
            <span>Linha</span>
            <input type="number" min={1} className="h-9 w-20 px-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700" disabled={travado} value={p.linha} onChange={(e) => muda(i, { linha: Number(e.target.value) })} />
            <span>Coluna</span>
            <input type="number" min={1} className="h-9 w-20 px-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700" disabled={travado} value={p.coluna} onChange={(e) => muda(i, { coluna: Number(e.target.value) })} />
          </div>
        </div>
      ))}
      {!travado && (
        <button type="button" onClick={() => onChange([...palavras, { palavra: '', dica: '', direcao: 'V', linha: 1, coluna: 1 }])}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-xs font-semibold">
          <Plus className="w-4 h-4" /> Adicionar palavra
        </button>
      )}
      <div>
        <p className={rotulo}>Como fica no app</p>
        {previa.erro ? (
          <p className="text-xs text-rose-600">{previa.erro}</p>
        ) : (
          <div className="inline-grid gap-0.5 bg-slate-800 p-1 rounded-lg" style={{ gridTemplateColumns: `repeat(${colunas}, 28px)` }}>
            {grade.join('').split('').map((ch, i) => (
              <div key={i} className={`relative w-7 h-7 flex items-center justify-center text-xs font-bold ${ch === '.' ? 'bg-slate-800' : 'bg-white text-slate-800'}`}>
                {numeros[String(i)] && <span className="absolute top-0 left-0.5 text-[8px] text-slate-400">{numeros[String(i)]}</span>}
                {ch !== '.' ? ch : ''}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
