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
    <section className="flex flex-col items-center gap-2 rounded-[18px] border border-dashed border-slate-300 bg-white px-6 py-14 text-center md:rounded-[22px] dark:border-slate-600 dark:bg-slate-800">
      <div className="mb-2 grid size-12 place-items-center rounded-2xl bg-[#f1f5f9] dark:bg-slate-700">
        <Icone className="size-6 text-slate-500 dark:text-slate-300" />
      </div>
      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{titulo}</h2>
      <span className="inline-flex h-[26px] items-center rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 text-xs font-bold text-slate-600 dark:text-slate-200">
        Em breve · {etapa}
      </span>
      <p className="mx-auto max-w-md text-sm text-slate-500 dark:text-slate-400">{descricao}</p>
    </section>
  );
}
