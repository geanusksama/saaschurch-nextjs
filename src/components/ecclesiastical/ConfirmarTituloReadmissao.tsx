import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, History, Loader2, X } from "lucide-react";
import { apiBase } from "../../lib/apiBase";

/**
 * Modal de confirmação do título de retorno numa readmissão.
 *
 * Aberto assim que um serviço de readmissão é escolhido — na ocorrência rápida
 * do perfil do membro e na abertura do requerimento. Mostra o histórico de
 * títulos eclesiásticos da pessoa para a secretaria decidir para qual deles ela
 * volta, em vez de o sistema deduzir sozinho. Ver src/lib/readmissaoTitulo.ts.
 */

type TituloDoHistorico = {
  nome: string;
  level: number;
  quando: string | null;
  noEscopo: boolean;
};

type Dados = {
  member: { id: string; fullName: string; tituloAtual: string | null; situacao: string | null };
  service: { id: number; sigla: string; description: string } | null;
  ehReadmissao: boolean;
  escopo: "MEMBRO" | "OBREIRO" | "MINISTRO" | null;
  escopoLabel: string | null;
  historico: TituloDoHistorico[];
  sugerido: { nome: string; level: number; quando: string | null } | null;
  catalogo: Array<{ nome: string; level: number }>;
  exigeConfirmacao: boolean;
};

function authFetch(url: string, init: RequestInit = {}) {
  const token = localStorage.getItem("mrm_token");
  return fetch(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json",
    },
  });
}

function fmtData(v: string | null) {
  if (!v) return "sem data";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "sem data" : d.toLocaleDateString("pt-BR");
}

export function ConfirmarTituloReadmissao({
  memberId,
  serviceId,
  onCancel,
  onConfirm,
}: {
  memberId: string;
  serviceId: number | string;
  onCancel: () => void;
  /** Nome canônico do título escolhido, como está no catálogo. */
  onConfirm: (titulo: string) => void;
}) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [escolhido, setEscolhido] = useState<string>("");

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await authFetch(
          `${apiBase}/members/${memberId}/readmission-titles?serviceId=${serviceId}`
        );
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body?.error || "Não foi possível carregar o histórico de títulos.");
        if (!vivo) return;
        const d = body as Dados;
        setDados(d);
        setErro("");
        // A sugestão vem pré-marcada, mas continua sendo só uma sugestão: quem
        // confirma é a secretaria, e ela pode trocar antes de aplicar.
        setEscolhido(d.sugerido?.nome || "");
      } catch (e: unknown) {
        if (vivo) setErro(e instanceof Error ? e.message : "Erro ao carregar títulos.");
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [memberId, serviceId]);

  /** Maior título que a pessoa já teve — base do aviso de rebaixamento. */
  const maiorDoHistorico = useMemo(() => {
    if (!dados?.historico?.length) return null;
    return dados.historico.reduce((maior, t) => (t.level > maior.level ? t : maior), dados.historico[0]);
  }, [dados]);

  const levelEscolhido = useMemo(() => {
    if (!dados || !escolhido) return null;
    const noHistorico = dados.historico.find((t) => t.nome === escolhido);
    if (noHistorico) return noHistorico.level;
    const noCatalogo = dados.catalogo.find((t) => t.nome === escolhido);
    return noCatalogo ? noCatalogo.level : null;
  }, [dados, escolhido]);

  const avisoRebaixamento =
    maiorDoHistorico && levelEscolhido !== null && levelEscolhido < maiorDoHistorico.level
      ? `Esta pessoa já foi ${maiorDoHistorico.nome}. Confirmando ${escolhido}, ela volta abaixo do que já teve.`
      : null;

  // Só o que não está no histórico, para o catálogo não repetir a lista de cima.
  const catalogoExtra = useMemo(() => {
    if (!dados) return [];
    const jaListados = new Set(dados.historico.map((t) => t.nome));
    return dados.catalogo.filter((t) => !jaListados.has(t.nome));
  }, [dados]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Confirmar título de retorno</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {dados?.service ? `${dados.service.sigla} — ${dados.service.description}` : "Readmissão"}
            </p>
          </div>
          <button onClick={onCancel} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {carregando && (
            <div className="flex items-center gap-2 text-sm text-slate-500 py-6 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Buscando o histórico de títulos...
            </div>
          )}

          {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</div>}

          {dados && !carregando && (
            <>
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                <p className="text-sm font-semibold text-slate-800">{dados.member.fullName}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Título atual: <span className="font-medium text-slate-700">{dados.member.tituloAtual || "—"}</span>
                  {dados.member.situacao ? ` · ${dados.member.situacao}` : ""}
                </p>
                {dados.escopoLabel && (
                  <p className="text-xs text-slate-500 mt-1">Este serviço readmite: {dados.escopoLabel}</p>
                )}
              </div>

              <div>
                <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <History className="w-3.5 h-3.5" /> Títulos no histórico
                </div>

                {dados.historico.length === 0 ? (
                  <p className="text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    Nenhum título reconhecível no histórico desta pessoa. Escolha abaixo, no catálogo, o título
                    com que ela deve voltar.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {dados.historico.map((t) => {
                      const marcado = escolhido === t.nome;
                      const ehSugerido = dados.sugerido?.nome === t.nome;
                      return (
                        <button
                          key={t.nome}
                          type="button"
                          onClick={() => setEscolhido(t.nome)}
                          className={`w-full text-left rounded-xl border-2 px-3 py-2.5 transition-all ${
                            marcado ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-blue-300"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <span className="text-sm font-semibold text-slate-800">{t.nome}</span>
                              {ehSugerido && (
                                <span className="ml-2 text-[10px] font-semibold uppercase rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5">
                                  mais recente
                                </span>
                              )}
                              {!t.noEscopo && dados.escopo && (
                                <span className="ml-2 text-[10px] font-semibold uppercase rounded-full bg-amber-100 text-amber-700 px-2 py-0.5">
                                  fora do grupo do serviço
                                </span>
                              )}
                            </div>
                            {marcado && <CheckCircle2 className="w-4 h-4 text-blue-500 flex-shrink-0" />}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">Registrado em {fmtData(t.quando)}</p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {catalogoExtra.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                    Outros títulos do catálogo
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {catalogoExtra.map((t) => {
                      const marcado = escolhido === t.nome;
                      return (
                        <button
                          key={t.nome}
                          type="button"
                          onClick={() => setEscolhido(t.nome)}
                          className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                            marcado
                              ? "border-blue-500 bg-blue-50 text-blue-700"
                              : "border-slate-200 text-slate-600 hover:border-blue-300"
                          }`}
                        >
                          {t.nome}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {avisoRebaixamento && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{avisoRebaixamento}</span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex gap-3 border-t border-slate-100 px-5 py-4">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => escolhido && onConfirm(escolhido)}
            disabled={!escolhido || carregando}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Confirmar {escolhido ? escolhido : "título"}
          </button>
        </div>
      </div>
    </div>
  );
}
