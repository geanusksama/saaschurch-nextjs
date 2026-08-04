"use client";

/**
 * Bíblia — mesma fonte do app Flutter (BibliaScreen): a API pública
 * bible-api.com, tradução `almeida`. É a única tela de conteúdo do portal que
 * não passa por /api/membro/conteudo, porque o texto bíblico não é do campo
 * nem do membro — é público e igual para todos. Por isso também não há
 * isolamento a aplicar aqui.
 */

import { useState, useEffect, useCallback } from 'react';
import { BookOpen, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { MembroShell } from '../MembroShell';
import { MEMBRO } from '../theme';
import { Carregando, Erro } from './Primitivos';

const TRADUCAO = 'almeida';

const LIVROS = [
  'Gênesis', 'Êxodo', 'Levítico', 'Números', 'Deuteronômio', 'Josué', 'Juízes', 'Rute',
  '1 Samuel', '2 Samuel', '1 Reis', '2 Reis', '1 Crônicas', '2 Crônicas', 'Esdras',
  'Neemias', 'Ester', 'Jó', 'Salmos', 'Provérbios', 'Eclesiastes', 'Cânticos',
  'Isaías', 'Jeremias', 'Lamentações', 'Ezequiel', 'Daniel', 'Oséias', 'Joel', 'Amós',
  'Obadias', 'Jonas', 'Miquéias', 'Naum', 'Habacuque', 'Sofonias', 'Ageu', 'Zacarias', 'Malaquias',
  'Mateus', 'Marcos', 'Lucas', 'João', 'Atos', 'Romanos', '1 Coríntios', '2 Coríntios',
  'Gálatas', 'Efésios', 'Filipenses', 'Colossenses', '1 Tessalonicenses', '2 Tessalonicenses',
  '1 Timóteo', '2 Timóteo', 'Tito', 'Filemom', 'Hebreus', 'Tiago', '1 Pedro', '2 Pedro',
  '1 João', '2 João', '3 João', 'Judas', 'Apocalipse',
];

interface Versiculo { verse: number; text: string }

export default function MembroBiblia() {
  const [livro, setLivro] = useState('João');
  const [capitulo, setCapitulo] = useState(1);
  const [busca, setBusca] = useState('');
  const [versiculos, setVersiculos] = useState<Versiculo[]>([]);
  const [referencia, setReferencia] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async (ref: string) => {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch(
        `https://bible-api.com/${encodeURIComponent(ref)}?translation=${TRADUCAO}`
      );
      if (!res.ok) throw new Error('Passagem não encontrada.');
      const json = await res.json();
      const vs = (json.verses ?? []) as Array<{ verse: number; text: string }>;
      if (!vs.length) throw new Error('Passagem não encontrada.');
      setVersiculos(vs.map(v => ({ verse: v.verse, text: String(v.text ?? '').trim() })));
      setReferencia(String(json.reference ?? ref));
    } catch (err) {
      setVersiculos([]);
      setErro(err instanceof Error ? err.message : 'Não foi possível carregar.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(`${livro} ${capitulo}`); }, [livro, capitulo, carregar]);

  const irPara = (delta: number) => setCapitulo(c => Math.max(1, c + delta));

  const buscar = () => {
    const t = busca.trim();
    if (!t) return;
    // Aceita "João 3" e "João 3:16" — a API resolve os dois formatos.
    carregar(t);
    setReferencia(t);
    setBusca('');
  };

  return (
    <MembroShell title="Bíblia" showBack>
      <div className="h-full flex flex-col" style={{ background: MEMBRO.BG }}>
        {/* seletor + busca */}
        <div className="px-4 pt-4 pb-3 flex flex-col gap-2"
          style={{ background: MEMBRO.CARD, borderBottom: `1px solid ${MEMBRO.BORDER}` }}>
          <div className="flex gap-2">
            <select
              value={livro}
              onChange={e => { setLivro(e.target.value); setCapitulo(1); }}
              className="flex-1 h-10 px-3 rounded-xl text-sm font-medium"
              style={{ border: `1px solid ${MEMBRO.BORDER}`, color: MEMBRO.TEXT1, background: MEMBRO.CARD }}
            >
              {LIVROS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <div className="flex items-center rounded-xl overflow-hidden flex-shrink-0"
              style={{ border: `1px solid ${MEMBRO.BORDER}` }}>
              <button onClick={() => irPara(-1)} disabled={capitulo <= 1}
                className="h-10 w-9 flex items-center justify-center disabled:opacity-30">
                <ChevronLeft className="w-4 h-4" style={{ color: MEMBRO.TEXT2 }} />
              </button>
              <span className="px-2 text-sm font-semibold tabular-nums" style={{ color: MEMBRO.TEXT1 }}>
                {capitulo}
              </span>
              <button onClick={() => irPara(1)} className="h-10 w-9 flex items-center justify-center">
                <ChevronRight className="w-4 h-4" style={{ color: MEMBRO.TEXT2 }} />
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && buscar()}
              placeholder="Ex.: Salmos 23 ou João 3:16"
              className="flex-1 h-10 px-3 rounded-xl text-sm"
              style={{ border: `1px solid ${MEMBRO.BORDER}`, color: MEMBRO.TEXT1 }}
            />
            <button onClick={buscar}
              className="h-10 px-4 rounded-xl inline-flex items-center gap-1.5 text-sm font-semibold text-white"
              style={{ background: MEMBRO.ACCENT }}>
              <Search className="w-4 h-4" /> Ir
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {carregando ? <Carregando />
            : erro ? <Erro mensagem={erro} />
            : (
              <div className="rounded-2xl p-5"
                style={{ background: MEMBRO.CARD, border: `1px solid ${MEMBRO.BORDER}`, boxShadow: MEMBRO.SHADOW }}>
                <div className="flex items-center gap-1.5 mb-4">
                  <BookOpen className="w-4 h-4" style={{ color: MEMBRO.ACCENT }} />
                  <span className="font-bold" style={{ color: MEMBRO.TEXT1 }}>{referencia}</span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {versiculos.map(v => (
                    <p key={v.verse} className="text-[15px] leading-relaxed text-justify"
                      style={{ color: MEMBRO.TEXT1 }}>
                      <sup className="font-bold mr-1" style={{ color: MEMBRO.ACCENT }}>{v.verse}</sup>
                      {v.text}
                    </p>
                  ))}
                </div>
              </div>
            )}
        </div>
      </div>
    </MembroShell>
  );
}
