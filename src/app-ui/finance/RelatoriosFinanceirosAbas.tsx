"use client";
import { useSearchParams } from "react-router";
import { BarChart3, Receipt } from "lucide-react";
import FinancialReportsDashboard from "./FinancialReportsDashboard";
import RelatoriosIgreja from "../relatoriosIgreja/RelatoriosIgreja";
import { Permissao, usePode } from "../../lib/permissoes/Permissao";

/**
 * Rel. Financeiros: o painel de sempre + a aba "Relatórios de Tesouraria".
 * A aba fica na URL (?aba=tesouraria): voltar para a tela mantém o relatório.
 */
export default function RelatoriosFinanceirosAbas() {
  const [params, setParams] = useSearchParams();
  const pode = usePode();
  const podeTesouraria = pode("finance_reports.relatorios_tesouraria.aba");
  const tesouraria = params.get("aba") === "tesouraria" && podeTesouraria;
  const irParaPainel = () => { const p = new URLSearchParams(params); for (const k of ["aba", "grupo", "rel"]) p.delete(k); setParams(p); };
  const aba = (ativa: boolean) => `inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition ${ativa ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200"}`;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 px-6 pt-6">
        <button type="button" data-sem-permissao="troca de aba; o painel já é a tela liberada por finance_reports" className={aba(!tesouraria)} onClick={irParaPainel}><BarChart3 className="h-4 w-4" />Painel</button>
        <Permissao chave="finance_reports.relatorios_tesouraria.aba" rotulo="Aba Relatórios de Tesouraria" herda="finance_reports.view">
          <button type="button" className={aba(tesouraria)} onClick={() => setParams({ aba: "tesouraria" })}><Receipt className="h-4 w-4" />Relatórios de Tesouraria</button>
        </Permissao>
      </div>
      {tesouraria ? <div className="p-6"><RelatoriosIgreja modulo="tesouraria" manter={["aba"]} /></div> : <FinancialReportsDashboard />}
    </div>
  );
}
