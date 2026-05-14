import { useMemo, useState } from 'react';
import { BarChart3, FileDown, Printer } from 'lucide-react';
import { usePastoralReportSummary } from '../../lib/pastoralHooks';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartISO() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return start.toISOString().slice(0, 10);
}

export default function PastoralReports() {
  const [startDate, setStartDate] = useState(monthStartISO());
  const [endDate, setEndDate] = useState(todayISO());

  const { data, isLoading } = usePastoralReportSummary({ startDate, endDate });

  const visitsByResponsible = useMemo(
    () => Object.entries(data?.visitsByResponsible || {}).sort((a, b) => b[1] - a[1]),
    [data?.visitsByResponsible],
  );

  const prayersByCategory = useMemo(
    () => Object.entries(data?.prayerByCategory || {}).sort((a, b) => b[1] - a[1]),
    [data?.prayerByCategory],
  );

  function handlePrintPdf() {
    window.print();
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100">
            <BarChart3 className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Relatórios Pastorais</h1>
            <p className="text-slate-600">Consolidação de visitas, aconselhamentos, oração e discipulado.</p>
          </div>
        </div>

        <button
          onClick={handlePrintPdf}
          className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
        >
          <Printer className="h-4 w-4" />
          Exportar PDF
        </button>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Data inicial</label>
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Data final</label>
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="flex items-end">
            <button onClick={handlePrintPdf} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100">
              <FileDown className="h-4 w-4" />
              Imprimir relatório
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Carregando relatório pastoral...</div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-5">
            <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Visitas</p><p className="text-2xl font-bold text-slate-900">{data?.totals.visits || 0}</p></div>
            <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Aconselhamentos</p><p className="text-2xl font-bold text-slate-900">{data?.totals.counseling || 0}</p></div>
            <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Pedidos de oração</p><p className="text-2xl font-bold text-slate-900">{data?.totals.prayers || 0}</p></div>
            <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Discipulados</p><p className="text-2xl font-bold text-slate-900">{data?.totals.discipleships || 0}</p></div>
            <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Progresso discipulado</p><p className="text-2xl font-bold text-slate-900">{data?.totals.avgDiscipleshipProgress || 0}%</p></div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-800">Visitas por responsável</div>
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-4 py-2">Responsável</th>
                    <th className="px-4 py-2">Qtd. visitas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visitsByResponsible.map(([name, value]) => (
                    <tr key={name}>
                      <td className="px-4 py-2 text-slate-700">{name}</td>
                      <td className="px-4 py-2 font-semibold text-slate-900">{value}</td>
                    </tr>
                  ))}
                  {visitsByResponsible.length === 0 && (
                    <tr><td className="px-4 py-4 text-slate-500" colSpan={2}>Sem dados no período.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-800">Pedidos por categoria</div>
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-4 py-2">Categoria</th>
                    <th className="px-4 py-2">Qtd. pedidos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {prayersByCategory.map(([name, value]) => (
                    <tr key={name}>
                      <td className="px-4 py-2 text-slate-700">{name}</td>
                      <td className="px-4 py-2 font-semibold text-slate-900">{value}</td>
                    </tr>
                  ))}
                  {prayersByCategory.length === 0 && (
                    <tr><td className="px-4 py-4 text-slate-500" colSpan={2}>Sem dados no período.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
