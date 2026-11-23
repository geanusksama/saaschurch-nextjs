/** Aba ainda não entregue da central Meta Oficial: mostra a etapa e o que ela fará. */
import type { LucideIcon } from 'lucide-react';

export default function EmBreve({
  icone: Icone,
  titulo,
  etapa,
  descricao,
}: {
  icone: LucideIcon;
  titulo: string;
  etapa: string;
  descricao: string;
}) {
  return (
    <section className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-8 text-center space-y-3 shadow-sm">
      <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-700">
        <Icone className="size-6 text-slate-500 dark:text-slate-300" />
      </div>
      <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">{titulo}</h2>
      <span className="inline-flex items-center rounded-full border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-200">
        Em breve · {etapa}
      </span>
      <p className="mx-auto max-w-md text-sm text-slate-500 dark:text-slate-400">{descricao}</p>
    </section>
  );
}
