/**
 * Resumo do liderado — página pública.
 *
 * O líder do GF abre pelo link que chega no WhatsApp quando alguém é anexado
 * ao grupo dele. Sem login: o token do endereço é a chave.
 *
 * TEMA CLARO SEMPRE, pelo mesmo motivo do formulário de campanha: em aparelho
 * no modo escuro o navegador reescreve as cores e o texto some.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { AlertTriangle, Link2, Loader2, MessageCircle, Phone, ThumbsDown, ThumbsUp, Users } from 'lucide-react';

interface ReportPayload {
  nome: string;
  telefone: string;
  fatos: {
    totalMessages: number;
    outbound: number;
    inbound: number;
    tentativasSemResposta: number;
    respondeu: boolean;
    linksEnviados: string[];
    ultimaMensagemEm: string | null;
  };
  situacao: { cellGroupName: string | null; leaderName: string | null; ehMembro: boolean };
  sintese: string;
  pontosPositivos: string[];
  pontosNegativos: string[];
  enviouEndereco: boolean;
  sugestaoMelhoria: string;
  motivoSemGf: string;
}

interface Payload {
  cellGroup: { name: string | null; color: string | null; leaderName: string | null };
  churchName: string | null;
  contact: { name: string | null; phone: string };
  report: ReportPayload | null;
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8" style={{ colorScheme: 'light' }}>
      <div className="mx-auto w-full max-w-2xl space-y-4">{children}</div>
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-slate-900">
        {icon}
        <h2 className="text-sm font-bold uppercase tracking-wide">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export default function GfResumoPublic() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<Payload | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    fetch(`/api/public/gf-resumo/${token}`)
      .then(async (res) => {
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload.error || 'Não foi possível abrir este resumo.');
        setData(payload);
      })
      .catch((err) => setErro(err.message))
      .finally(() => setCarregando(false));
  }, [token]);

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50" style={{ colorScheme: 'light' }}>
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (erro || !data) {
    return (
      <Moldura>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-amber-500" />
          <p className="text-sm text-amber-800">{erro || 'Resumo indisponível.'}</p>
        </div>
      </Moldura>
    );
  }

  const cor = data.cellGroup.color || '#8B5CF6';
  const r = data.report;

  return (
    <Moldura>
      <div className="rounded-2xl p-5 text-white shadow-sm" style={{ backgroundColor: cor }}>
        <p className="text-xs uppercase tracking-wide opacity-80">{data.churchName ?? 'Grupo Familiar'}</p>
        <h1 className="mt-1 text-2xl font-bold">{data.contact.name || 'Novo contato'}</h1>
        <p className="mt-1 text-sm opacity-90">
          Encaminhado(a) para o GF {data.cellGroup.name ?? '—'}
          {data.cellGroup.leaderName ? ` · Líder ${data.cellGroup.leaderName}` : ''}
        </p>
        <a
          href={`https://wa.me/${data.contact.phone.replace(/\D/g, '')}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white/20 px-3 py-1.5 text-sm font-medium hover:bg-white/30"
        >
          <Phone className="h-4 w-4" />
          Chamar no WhatsApp
        </a>
      </div>

      {!r ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
          O resumo desta conversa ainda não pôde ser gerado. Fale com a secretaria.
        </div>
      ) : (
        <>
          <Card title="O que já foi conversado" icon={<MessageCircle className="h-4 w-4 text-purple-600" />}>
            <p className="text-sm leading-relaxed text-slate-700">{r.sintese}</p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-slate-50 p-2">
                <p className="text-lg font-bold text-slate-900">{r.fatos.totalMessages}</p>
                <p className="text-xs text-slate-500">mensagens</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <p className="text-lg font-bold text-slate-900">{r.fatos.inbound}</p>
                <p className="text-xs text-slate-500">respostas dele(a)</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <p className="text-lg font-bold text-slate-900">{r.fatos.tentativasSemResposta}</p>
                <p className="text-xs text-slate-500">sem resposta</p>
              </div>
            </div>
            {!r.fatos.respondeu && (
              <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
                Esta pessoa ainda não respondeu nenhuma mensagem. Um contato pessoal pode fazer diferença.
              </p>
            )}
          </Card>

          {(r.pontosPositivos.length > 0 || r.pontosNegativos.length > 0) && (
            <Card title="Pontos de atenção" icon={<ThumbsUp className="h-4 w-4 text-purple-600" />}>
              <div className="space-y-3">
                {r.pontosPositivos.map((p, i) => (
                  <p key={`p${i}`} className="flex items-start gap-2 text-sm text-slate-700">
                    <ThumbsUp className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    {p}
                  </p>
                ))}
                {r.pontosNegativos.map((p, i) => (
                  <p key={`n${i}`} className="flex items-start gap-2 text-sm text-slate-700">
                    <ThumbsDown className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                    {p}
                  </p>
                ))}
              </div>
            </Card>
          )}

          {r.fatos.linksEnviados.length > 0 && (
            <Card title="Links enviados" icon={<Link2 className="h-4 w-4 text-purple-600" />}>
              <ul className="space-y-1">
                {r.fatos.linksEnviados.map((l) => (
                  <li key={l}>
                    <a href={l} target="_blank" rel="noreferrer" className="break-all text-sm text-purple-600 underline">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title="Próximo passo" icon={<Users className="h-4 w-4 text-purple-600" />}>
            <p className="text-sm leading-relaxed text-slate-700">{r.sugestaoMelhoria}</p>
            <p className="mt-3 text-xs text-slate-500">
              {r.enviouEndereco
                ? 'O endereço da igreja já foi enviado para esta pessoa.'
                : 'O endereço da igreja ainda não foi enviado para esta pessoa.'}
            </p>
          </Card>
        </>
      )}
    </Moldura>
  );
}
