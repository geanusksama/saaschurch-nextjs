/**
 * Pagamentos › Eventos e loja: os mesmos cadastros do menu Mobile (tabelas
 * appv3_eventos e appv3_produtos), aqui ao lado das vendas. O que se cria em
 * um lugar aparece no outro, no app e no site (Eventos / Compras).
 * Permissões: as do Mobile (mobile_eventos, mobile_loja).
 */
import { useState } from 'react';
import { usePermissions } from '../../lib/usePermissions';
import { MobileRecurso } from '../mobile/MobileRecurso';
import { Abas } from '../mobile/MobileTela';
import { perfilAtual } from './comum';

const ABAS: [string, string, string][] = [
  ['eventos', 'Eventos e ingressos', 'mobile_eventos'],
  ['produtos', 'Produtos da loja', 'mobile_loja'],
];

export default function EventosLoja() {
  const { canView } = usePermissions(perfilAtual());
  const abas = ABAS.filter(([, , perm]) => canView(perm));
  const [aba, setAba] = useState(abas[0]?.[0] ?? '');
  if (!abas.length) return <p className="text-sm text-slate-500">Sem permissão para eventos e loja.</p>;
  return (
    <div>
      <Abas abas={abas.map(([k, r]) => [k, r])} atual={aba} onTrocar={setAba} />
      {aba && <MobileRecurso key={aba} recurso={aba} />}
    </div>
  );
}
