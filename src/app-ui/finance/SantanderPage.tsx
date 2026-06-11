'use client';

import { useState, useEffect } from 'react';
import { ConciliacaoSantander } from '../../modules/financeiro/conciliacao-santander/frontend/ConciliacaoSantander';
import { usePermissions } from '../../lib/usePermissions';
import { supabase } from '../../lib/supabaseClient';
import { apiBase } from '../../lib/apiBase';
import { Loader2 } from 'lucide-react';

interface PageData {
  churchId: string;
  credentials: { id: string; apelido: string; ambiente: string }[];
  planoDeContasOptions: { value: string; label: string }[];
  formaPagamentoOptions: { value: string; label: string }[];
}

export default function SantanderPage() {
  const [profileType] = useState<string>(() => {
    if (typeof window === 'undefined') return 'church';
    try {
      return (JSON.parse(localStorage.getItem('mrm_user') || '{}') as Record<string, unknown>).profileType as string || 'church';
    } catch { return 'church'; }
  });

  const { canView, canCreate, canEdit } = usePermissions(profileType);

  const permissions: string[] = [
    canView('santander_view')      && 'financeiro.santander.visualizar',
    canView('santander_config')    && 'financeiro.santander.configurar',
    canCreate('santander_sync')    && 'financeiro.santander.consultar',
    canCreate('santander_import')  && 'financeiro.santander.importar',
    canEdit('santander_conciliar') && 'financeiro.santander.conciliar',
    canEdit('santander_lancar')    && 'financeiro.santander.lancar_livro_caixa',
    canCreate('santander_ignorar') && 'financeiro.santander.ignorar',
    canCreate('santander_export')  && 'financeiro.santander.exportar',
    canView('santander_audit')     && 'financeiro.santander.auditoria',
  ].filter(Boolean) as string[];

  const [data, setData] = useState<PageData | null>(null);

  useEffect(() => {
    async function load() {
      const raw = localStorage.getItem('mrm_user');
      const user = raw ? JSON.parse(raw) as Record<string, unknown> : {};
      const token = localStorage.getItem('mrm_token') ?? '';
      const churchId = String(user.churchId ?? user.church_id ?? '');
      const headers = { Authorization: `Bearer ${token}` };

      let credentials: { id: string; apelido: string; ambiente: string }[] = [];
      try {
        const credRes = await fetch(`${apiBase}/santander/credentials`, { headers });
        if (credRes.ok) {
          const json = await credRes.json() as { credentials?: { id: string; apelido: string; ambiente: string }[] };
          credentials = Array.isArray(json.credentials) ? json.credentials : [];
        }
      } catch { /* sem credenciais */ }

      const [planoRes, formaRes] = await Promise.all([
        supabase.from('plano_de_contas').select('id, nome').eq('ativo', true).order('nome'),
        supabase.from('forma_pagamento').select('id, nome').eq('mostrar', true).order('nome'),
      ]);

      const planoDeContasOptions = (planoRes.data ?? []).map(
        (p: { id: number; nome: string }) => ({ value: String(p.id), label: p.nome })
      );
      const formaPagamentoOptions = (formaRes.data ?? []).map(
        (f: { id: number; nome: string }) => ({ value: String(f.id), label: f.nome })
      );

      setData({ churchId, credentials, planoDeContasOptions, formaPagamentoOptions });
    }
    void load();
  }, []);

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div>
      <ConciliacaoSantander
        churchId={data.churchId}
        credentials={data.credentials}
        permissions={permissions}
        planoDeContasOptions={data.planoDeContasOptions}
        formaPagamentoOptions={data.formaPagamentoOptions}
      />
    </div>
  );
}
