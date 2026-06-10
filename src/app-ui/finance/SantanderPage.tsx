'use client';

import { useState, useEffect } from 'react';
import { ConciliacaoSantander } from '../../modules/financeiro/conciliacao-santander/frontend/ConciliacaoSantander';
import { supabase } from '../../lib/supabaseClient';
import { apiBase } from '../../lib/apiBase';
import { Loader2 } from 'lucide-react';

interface PageData {
  churchId: string;
  credentials: { id: string; apelido: string }[];
  accounts: { id: string; display_name: string; branch_code: string; account_number: string }[];
  permissions: string[];
  planoDeContasOptions: { value: string; label: string }[];
  formaPagamentoOptions: { value: string; label: string }[];
}

// Permissões padrão para admin enquanto tabelas não têm RLS configurada
const DEFAULT_PERMISSIONS = [
  'financeiro.santander.visualizar',
  'financeiro.santander.configurar',
  'financeiro.santander.consultar',
  'financeiro.santander.importar',
  'financeiro.santander.conciliar',
  'financeiro.santander.lancar_livro_caixa',
  'financeiro.santander.ignorar',
  'financeiro.santander.exportar',
  'financeiro.santander.auditoria',
];

export default function SantanderPage() {
  const [data, setData] = useState<PageData | null>(null);

  useEffect(() => {
    async function load() {
      const raw = localStorage.getItem('mrm_user');
      const user = raw ? JSON.parse(raw) as Record<string, unknown> : {};
      const token = localStorage.getItem('mrm_token') ?? '';
      const churchId = String(user.churchId ?? user.church_id ?? '');

      const headers = { Authorization: `Bearer ${token}` };

      // Permissões: garante que é sempre um array de strings
      const rawPerms = user.permissions;
      const permissions: string[] = Array.isArray(rawPerms)
        ? rawPerms.filter((p): p is string => typeof p === 'string')
        : DEFAULT_PERMISSIONS;

      // Busca credenciais — pode retornar 403, 404 ou 500 se tabela não existe
      let credentials: { id: string; apelido: string }[] = [];
      let accounts: { id: string; display_name: string; branch_code: string; account_number: string }[] = [];
      try {
        const credRes = await fetch(`${apiBase}/santander/credentials`, { headers });
        if (credRes.ok) {
          const json = await credRes.json() as { credentials?: { id: string; apelido: string }[] };
          credentials = Array.isArray(json.credentials) ? json.credentials : [];
        }
      } catch {
        // silencia — componente mostra estado vazio
      }

      // Busca plano de contas e formas de pagamento (Supabase direto — independe das tabelas Santander)
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

      setData({ churchId, credentials, accounts, permissions, planoDeContasOptions, formaPagamentoOptions });
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
        accounts={data.accounts}
        permissions={data.permissions}
        planoDeContasOptions={data.planoDeContasOptions}
        formaPagamentoOptions={data.formaPagamentoOptions}
      />
    </div>
  )
}
