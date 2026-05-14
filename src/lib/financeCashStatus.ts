export type FinanceCashStatusOptionRegional = {
  id: string;
  name: string;
};

export type FinanceCashStatusOptionChurch = {
  id: string;
  name: string;
  regionalId: string | null;
  regionalName: string;
};

export type FinanceCashStatusMonth = {
  month: number;
  status: string;
  allowUntil: string | null;
  isOpen: boolean;
  label: string;
};

export type FinanceCashStatusRow = {
  churchId: string;
  churchName: string;
  regionalId: string | null;
  regionalName: string;
  months: FinanceCashStatusMonth[];
};

export type FinanceCashStatusCheck = {
  churchId: string;
  date: string;
  year: number;
  month: number;
  canInsert: boolean;
  status: string;
  allowUntil: string | null;
  message: string;
};

import { apiBase } from './apiBase';

function getAuthHeaders(contentType = true) {
  const token = localStorage.getItem('mrm_token');
  return {
    ...(contentType ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || 'Erro ao processar a solicitacao do caixa.');
  }

  return payload as T;
}

export async function fetchFinanceCashStatusOptions() {
  const response = await fetch(`${apiBase}/finance/cash-status/options`, {
    headers: getAuthHeaders(false),
  });

  return parseApiResponse<{
    regionals: FinanceCashStatusOptionRegional[];
    churches: FinanceCashStatusOptionChurch[];
  }>(response);
}

export async function listFinanceCashStatuses(input: {
  year: number;
  months: number[];
  regionalIds?: string[];
  churchIds?: string[];
  search?: string;
}) {
  const response = await fetch(`${apiBase}/finance/cash-status/list`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(input),
  });

  return parseApiResponse<{ rows: FinanceCashStatusRow[] }>(response);
}

export async function updateFinanceCashStatuses(input: {
  year: number;
  months: number[];
  action: 'open' | 'close' | 'allow';
  churchIds?: string[];
  regionalIds?: string[];
  allowUntil?: string;
  notes?: string;
}) {
  const response = await fetch(`${apiBase}/finance/cash-status/update`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(input),
  });

  return parseApiResponse<{
    updatedCount: number;
    churches: number;
    months: number[];
    action: string;
  }>(response);
}

export async function checkChurchCashStatus(churchId: string, date: string) {
  const response = await fetch(`${apiBase}/finance/cash-status/check`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ churchId, date }),
  });

  return parseApiResponse<FinanceCashStatusCheck>(response);
}