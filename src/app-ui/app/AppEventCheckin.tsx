import { useState, useRef } from 'react';
import { QrCode, CheckCircle2, XCircle, Search } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';

type CheckinResult = {
  success: boolean;
  message: string;
  ticket?: {
    ticket_code: string;
    event?: { nome: string };
    is_used: boolean;
  };
};

export default function AppEventCheckin() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<CheckinResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const checkinMutation = useMutation({
    mutationFn: async (ticketCode: string) => {
      const { data, error } = await supabase
        .from('event_qrcodes')
        .select('id, ticket_code, is_used, is_cancelled, app_events(nome)')
        .eq('ticket_code', ticketCode)
        .single();

      if (error || !data) {
        return { success: false, message: 'Ingresso não encontrado.' } as CheckinResult;
      }

      if (data.is_cancelled) {
        return { success: false, message: 'Este ingresso foi cancelado.' } as CheckinResult;
      }

      if (data.is_used) {
        return { success: false, message: 'Este ingresso já foi utilizado.', ticket: data } as CheckinResult;
      }

      const { error: updateError } = await supabase
        .from('event_qrcodes')
        .update({ is_used: true, used_at: new Date().toISOString() })
        .eq('id', data.id);

      if (updateError) throw updateError;

      return {
        success: true,
        message: 'Check-in realizado com sucesso!',
        ticket: { ...data, is_used: true },
      } as CheckinResult;
    },
    onSuccess: (res) => setResult(res),
    onError: (e: Error) => setResult({ success: false, message: e.message }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setResult(null);
    checkinMutation.mutate(trimmed);
    setCode('');
    inputRef.current?.focus();
  };

  const reset = () => { setResult(null); setCode(''); inputRef.current?.focus(); };

  return (
    <div className="p-6 max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
          <QrCode className="w-6 h-6 text-green-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Check-in QR Code</h1>
          <p className="text-slate-500 dark:text-slate-400">Valide ingressos pelo código do ticket</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Código do Ingresso
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  placeholder="Ex: TKT-XXXXXXXX"
                  autoFocus
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <button
                type="submit"
                disabled={checkinMutation.isPending || !code.trim()}
                className="px-5 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition"
              >
                {checkinMutation.isPending ? '...' : 'Validar'}
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Use um leitor QR Code ou digite o código manualmente. O campo aceita leitura automática.
            </p>
          </div>
        </form>
      </div>

      {result && (
        <div className={`rounded-xl p-6 border ${
          result.success
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        }`}>
          <div className="flex items-start gap-4">
            {result.success
              ? <CheckCircle2 className="w-10 h-10 text-green-500 shrink-0" />
              : <XCircle className="w-10 h-10 text-red-500 shrink-0" />
            }
            <div className="flex-1">
              <p className={`font-bold text-lg ${result.success ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
                {result.success ? 'Check-in aprovado!' : 'Ingresso inválido'}
              </p>
              <p className={`text-sm mt-1 ${result.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                {result.message}
              </p>
              {result.ticket && (
                <div className="mt-3 space-y-1 text-sm">
                  <p className="text-slate-700 dark:text-slate-300"><span className="font-medium">Código:</span> {result.ticket.ticket_code}</p>
                  {result.ticket.event && <p className="text-slate-700 dark:text-slate-300"><span className="font-medium">Evento:</span> {result.ticket.event.nome}</p>}
                </div>
              )}
            </div>
          </div>
          <button onClick={reset} className="mt-4 w-full py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600">
            Novo Check-in
          </button>
        </div>
      )}
    </div>
  );
}
