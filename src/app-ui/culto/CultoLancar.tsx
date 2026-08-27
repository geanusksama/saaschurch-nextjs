/**
 * Lançar dados de culto — a porta do tesoureiro e do secretário.
 *
 * Dois cards. Clicou, abre o modal com os campos daquele papel e pronto: sem
 * Kanban, sem painel, sem organograma. Quem lança não tem visão de gestão.
 *
 * O card só fica ativo para quem está anexado à posição — exceto master/admin,
 * que abrem os dois para conferir (e aí precisam escolher a igreja).
 */
import React, { useEffect, useState } from 'react';
import { Wallet, Users, ShieldCheck, ArrowRight, Loader2, Info } from 'lucide-react';
import { cultoApi, type Bloco, type MeusPapeis } from './cultoApi';
import CultoLancarModal from './CultoLancarModal';
import CultoDirigenteModal from './CultoDirigenteModal';

/** 'DIRIGENTE' não é um bloco de lançamento: é a mesa de aprovação. */
type Alvo = Bloco | 'DIRIGENTE';

interface CardBloco {
  bloco: Alvo;
  titulo: string;
  subtitulo: string;
  campos: string;
  icone: React.ElementType;
  gradiente: string;
}

const CARDS: CardBloco[] = [
  {
    bloco: 'FINANCEIRO',
    titulo: 'Tesoureiro',
    subtitulo: 'Financeiro do culto',
    campos: 'Dízimos e ofertas.',
    icone: Wallet,
    gradiente: 'from-amber-500 to-orange-600',
  },
  {
    bloco: 'PRESENCA',
    titulo: 'Secretário',
    subtitulo: 'Contagem de presença',
    campos: 'Contagem de pessoas e cadeiras vazias.',
    icone: Users,
    gradiente: 'from-rose-500 to-pink-600',
  },
  {
    bloco: 'DIRIGENTE',
    titulo: 'Dirigente',
    subtitulo: 'Confere e aprova',
    campos: 'Os envios da sua igreja no dia. Aprova ou cobra o que falta.',
    icone: ShieldCheck,
    gradiente: 'from-emerald-500 to-green-600',
  },
];

export default function CultoLancar() {
  const [papeis, setPapeis] = useState<MeusPapeis | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState<Alvo | null>(null);

  useEffect(() => {
    let vivo = true;
    cultoApi
      .meusPapeis()
      .then((p) => vivo && setPapeis(p))
      .catch((e) => vivo && setErro((e as Error).message))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, []);

  function habilitado(alvo: Alvo): boolean {
    if (!papeis) return false;
    if (papeis.irrestrito) return true;
    if (alvo === 'DIRIGENTE') return papeis.papeis.includes('APROVADOR_LOCAL');
    return papeis.podeEnviar.some((p) => p.bloco === alvo);
  }

  function igrejaDo(alvo: Alvo): string | null {
    if (alvo === 'DIRIGENTE') {
      return (
        papeis?.posicoes.find((p) => p.papel === 'APROVADOR_LOCAL')?.churchId ??
        papeis?.churchIdPadrao ??
        null
      );
    }
    return papeis?.podeEnviar.find((p) => p.bloco === alvo)?.churchId ?? null;
  }

  const nenhum =
    papeis && !habilitado('FINANCEIRO') && !habilitado('PRESENCA') && !habilitado('DIRIGENTE');

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Lançar dados de culto</h1>

      </div>

      {carregando && (
        <div className="flex items-center justify-center gap-2 text-slate-400 py-20">
          <Loader2 className="w-5 h-5 animate-spin" /> Carregando…
        </div>
      )}

      {erro && (
        <div className="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          {erro}
        </div>
      )}

      {nenhum && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-5 py-4 text-sm text-amber-800 dark:text-amber-300">
          <Info className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <strong>Você não está anexado a nenhuma posição do culto.</strong>
            <p className="mt-1">
              Quem cadastra é o administrador do campo, em Gestão de Culto › Posições.
            </p>
          </div>
        </div>
      )}

      {!carregando && !erro && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 max-w-4xl">
          {/* Só o card do papel de quem entrou. Um tesoureiro não precisa ver
              o botão do secretário — não é dele e não abre. Master vê os dois
              porque precisa conferir os dois lados. */}
          {CARDS.filter((c) => habilitado(c.bloco)).map((card) => {
            const ativo = true;
            const Icone = card.icone;
            const papelDoCard = card.bloco === 'DIRIGENTE' ? 'APROVADOR_LOCAL' : card.bloco;
            const igreja = papeis?.posicoes.find(
              (p) => p.papel === papelDoCard && p.churchName,
            )?.churchName;
            return (
              <button
                key={card.bloco}
                onClick={() => ativo && setAberto(card.bloco)}
                disabled={!ativo}
                className={`group text-left rounded-2xl overflow-hidden border transition-all ${
                  ativo
                    ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:shadow-xl hover:-translate-y-0.5 cursor-pointer'
                    : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className={`h-1.5 bg-gradient-to-r ${card.gradiente} ${ativo ? '' : 'opacity-40'}`} />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${card.gradiente} ${
                        ativo ? '' : 'opacity-50'
                      }`}
                    >
                      <Icone className="w-6 h-6 text-white" />
                    </div>
                    {ativo && (
                      <ArrowRight className="w-5 h-5 text-slate-300 group-hover:translate-x-1 transition-all" />
                    )}
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">
                    {card.titulo}
                  </h3>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {card.subtitulo}
                  </p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{card.campos}</p>
                  {ativo && igreja && (
                    <p className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
                      <strong className="text-slate-700 dark:text-slate-200">{igreja}</strong>
                    </p>
                  )}
                  {!ativo && (
                    <p className="mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-800 text-xs text-slate-400">
                      Você não está anexado a esta posição.
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {aberto === 'DIRIGENTE' && papeis && (
        <CultoDirigenteModal churchId={igrejaDo('DIRIGENTE')} onFechar={() => setAberto(null)} />
      )}

      {aberto && aberto !== 'DIRIGENTE' && papeis && (
        <CultoLancarModal
          bloco={aberto}
          churchIdPadrao={igrejaDo(aberto) ?? papeis.churchIdPadrao}
          precisaEscolherIgreja={papeis.irrestrito && !igrejaDo(aberto)}
          onFechar={() => setAberto(null)}
        />
      )}
    </div>
  );
}
