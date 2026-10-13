import { useEffect, useState } from 'react';
import { Building2, Shuffle } from 'lucide-react';

import { apiBase } from '../../lib/apiBase';

export type CampoNavegavelForm = {
  campoId: string;
  churchId: string | null;
};

type CampoOption = { id: string; name: string };
type ChurchOption = { id: string; name: string };

/**
 * Campos que o usuário pode navegar pelo seletor "Alternar Campo".
 *
 * Só o master vê e grava isto. Marcado algum campo além do campo do cadastro,
 * o seletor aparece para o usuário e ele troca de campo sem senha; desmarcado
 * tudo, o seletor some e ele fica no próprio campo.
 *
 * A igreja escolhida é onde ele fica lotado quando entra naquele campo. Para
 * perfil igreja, secretaria e tesouraria ela é necessária: esses perfis só
 * enxergam a própria igreja, e sem ela não veriam nada no outro campo.
 */
export function CamposNavegaveis({
  campos,
  campoPrincipalId,
  value,
  onChange,
}: {
  campos: CampoOption[];
  campoPrincipalId: string;
  value: CampoNavegavelForm[];
  onChange: (next: CampoNavegavelForm[]) => void;
}) {
  const [igrejasPorCampo, setIgrejasPorCampo] = useState<Record<string, ChurchOption[]>>({});
  const outros = campos.filter((campo) => campo.id !== campoPrincipalId);

  // Igrejas de cada campo marcado, sob demanda.
  useEffect(() => {
    const token = localStorage.getItem('mrm_token');
    const faltando = value.map((v) => v.campoId).filter((id) => !(id in igrejasPorCampo));
    if (!faltando.length) return;
    let cancelado = false;
    Promise.all(
      faltando.map(async (campoId) => {
        const res = await fetch(`${apiBase}/churches?slim=1&fieldId=${encodeURIComponent(campoId)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const lista = res.ok ? await res.json() : [];
        return [campoId, Array.isArray(lista) ? lista : []] as const;
      }),
    )
      .then((pares) => {
        if (cancelado) return;
        setIgrejasPorCampo((atual) => {
          const proximo = { ...atual };
          for (const [campoId, lista] of pares) {
            proximo[campoId] = lista.map((c: ChurchOption) => ({ id: c.id, name: c.name }));
          }
          return proximo;
        });
      })
      .catch(() => {
        /* a lista de igrejas fica vazia; o campo continua marcável */
      });
    return () => {
      cancelado = true;
    };
  }, [value, igrejasPorCampo]);

  const marcado = (campoId: string) => value.find((v) => v.campoId === campoId);

  const alternar = (campoId: string) => {
    if (marcado(campoId)) onChange(value.filter((v) => v.campoId !== campoId));
    else onChange([...value, { campoId, churchId: null }]);
  };

  const escolherIgreja = (campoId: string, churchId: string) => {
    onChange(value.map((v) => (v.campoId === campoId ? { ...v, churchId: churchId || null } : v)));
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
      <div className="flex items-center gap-2 mb-1">
        <Shuffle className="w-4 h-4 text-slate-400" />
        <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Campos que pode navegar
        </h2>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
        Marque os outros campos que este usuário pode acessar. Com algum marcado, aparece para ele o seletor
        &quot;Alternar Campo&quot; e, em cada campo, ele vê só os dados daquele campo.
      </p>

      {!campoPrincipalId ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Escolha primeiro a igreja ou a regional do usuário.</p>
      ) : outros.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Não há outros campos cadastrados.</p>
      ) : (
        <div className="space-y-2">
          {outros.map((campo) => {
            const item = marcado(campo.id);
            const igrejas = igrejasPorCampo[campo.id];
            return (
              <div
                key={campo.id}
                className={`rounded-lg border px-3 py-2.5 ${
                  item ? 'border-slate-400 dark:border-slate-500' : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(item)}
                    onChange={() => alternar(campo.id)}
                    className="w-4 h-4 accent-purple-600"
                  />
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{campo.name}</span>
                </label>
                {item && (
                  <div className="relative mt-2 ml-7">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <select
                      value={item.churchId || ''}
                      onChange={(e) => escolherIgreja(campo.id, e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">
                        {igrejas === undefined ? 'Carregando igrejas...' : 'Sem igreja (vê o campo todo, conforme o perfil)'}
                      </option>
                      {(igrejas || []).map((igreja) => (
                        <option key={igreja.id} value={igreja.id}>
                          {igreja.name}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      Igreja em que ele fica neste campo. Perfil igreja, secretaria e tesouraria precisam dela.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
