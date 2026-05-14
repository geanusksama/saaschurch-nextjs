import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import {
  X,
  Users,
  Eye,
  Pencil,
  Loader2,
} from 'lucide-react';

import { apiBase } from '../../lib/apiBase';

type Props = {
  open: boolean;
  onClose: () => void;
  initialQuery?: string;
  onEditMember?: (memberId: string) => void;
};

type MemberSearchResult = {
  id: string;
  fullName: string;
  preferredName?: string | null;
  rol?: number | null;
  membershipStatus?: string | null;
  ecclesiasticalTitle?: string | null;
  ecclesiasticalTitleRef?: {
    id?: string;
    name?: string | null;
    abbreviation?: string | null;
  } | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  cpf?: string | null;
  church?: {
    id: string;
    name: string;
    code?: string | null;
  } | null;
};

function authHeaders(token: string | null) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function normalizeText(value: string | null | undefined) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function matchesMemberQuery(item: MemberSearchResult, query: string) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return true;
  }

  if (/^\d+$/.test(normalizedQuery)) {
    return Number(item?.rol) === Number(normalizedQuery);
  }

  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  const fullName = normalizeText(item.fullName);

  return terms.every((term) => fullName.split(/\s+/).some((part) => part.startsWith(term)));
}

function moveActiveIndex(current: number, length: number, direction: 1 | -1) {
  if (!length) return -1;
  if (current < 0) return direction === 1 ? 0 : length - 1;
  return (current + direction + length) % length;
}

function getDisplayedEcclesiasticalTitle(member: MemberSearchResult) {
  return member.ecclesiasticalTitleRef?.name || member.ecclesiasticalTitle || 'Não informado';
}

export function GlobalSearchModal({
  open,
  onClose,
  initialQuery = '',
  onEditMember,
}: Props) {
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const requestSequenceRef = useRef(0);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<MemberSearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<MemberSearchResult | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  const visibleItems = useMemo(() => {
    return items.filter((item) => matchesMemberQuery(item, query || initialQuery));
  }, [items, query, initialQuery]);

  useEffect(() => {
    if (!open) return;
    requestSequenceRef.current += 1;
    setQuery(initialQuery);
    setItems([]);
    setSearched(false);
    setError('');
    setSelected(null);
    setActiveIndex(-1);
    setTimeout(() => panelRef.current?.focus(), 50);
  }, [open, initialQuery]);

  useEffect(() => {
    itemRefs.current = itemRefs.current.slice(0, visibleItems.length);
    if (!selected) {
      setActiveIndex(visibleItems.length ? 0 : -1);
    }
  }, [visibleItems, selected]);

  useEffect(() => {
    if (activeIndex >= 0) {
      itemRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  const runSearch = async (termOverride?: string) => {
    const term = (termOverride ?? initialQuery).trim();
    const requestId = ++requestSequenceRef.current;
    setQuery(term);
    if (!term) {
      setError('Digite o nome ou o rol do membro.');
      return;
    }
    const token = localStorage.getItem('mrm_token');
    if (!token) {
      setError('Sessão expirada. Faça login novamente.');
      return;
    }

    setLoading(true);
    setError('');
    setSearched(true);
    setItems([]);
    setSelected(null);
    setActiveIndex(-1);

    try {
      const response = await fetch(`${apiBase}/members?query=${encodeURIComponent(term)}&limit=20`, {
        headers: authHeaders(token),
      });

      if (!response.ok) {
        throw new Error('Falha ao buscar membros.');
      }

      const data = await response.json();
      if (requestId !== requestSequenceRef.current) {
        return;
      }

      const next = Array.isArray(data) ? data : [];

      if (/^\d+$/.test(term)) {
        const rol = Number(term);
        const exactMatches = next.filter((item: MemberSearchResult) => Number(item?.rol) === rol);
        setItems(exactMatches);

        if (exactMatches.length === 1) {
          setSelected(exactMatches[0]);
        }
      } else {
        const filteredMatches = next.filter((item: MemberSearchResult) => matchesMemberQuery(item, term));
        setItems(filteredMatches);
      }
    } catch (err) {
      if (requestId !== requestSequenceRef.current) {
        return;
      }
      setError(err instanceof Error ? err.message : 'Falha ao buscar.');
    } finally {
      if (requestId === requestSequenceRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!open || !initialQuery.trim()) return;
    runSearch(initialQuery);
  }, [open, initialQuery]);

  const handleNavigate = (item: MemberSearchResult, mode: 'view' | 'edit') => {
    if (mode === 'edit' && onEditMember) {
      setSelected(null);
      onClose();
      onEditMember(item.id);
      return;
    }

    setSelected(null);
    onClose();
    navigate(mode === 'edit' ? `/app-ui/members/${item.id}/edit` : `/app-ui/members/${item.id}`);
  };

  const handleResultsKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }

    if (selected) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => moveActiveIndex(current, visibleItems.length, 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => moveActiveIndex(current, visibleItems.length, -1));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (activeIndex >= 0 && visibleItems[activeIndex]) {
        setSelected(visibleItems[activeIndex]);
      }
    }
  };

  return (
    <>
      {open ? (
        <>
          <div className="fixed inset-0 z-50 bg-slate-900/50" onClick={onClose} />
          <div
            ref={panelRef}
            tabIndex={-1}
            onKeyDown={handleResultsKeyDown}
            className="fixed left-1/2 top-16 z-[60] w-[95%] max-w-4xl -translate-x-1/2 overflow-hidden rounded-2xl bg-white shadow-2xl outline-none"
          >
            <div className="border-b border-slate-200 p-3">
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-xl bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Resultado da busca</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{query || initialQuery}</p>
                </div>
                <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100">
                  <X className="h-5 w-5 text-slate-500" />
                </button>
              </div>
            </div>

            <section className="max-h-[60vh] overflow-y-auto">
            {!selected ? <p className="border-b border-slate-100 px-6 py-2 text-xs text-slate-500">Use as setas ou a roda do mouse para navegar. Pressione Enter para selecionar.</p> : null}
            {error ? (
              <div className="m-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            ) : null}

            {loading ? (
              <div className="px-6 py-12 text-center text-sm text-slate-500">
                <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-purple-500" />
                Buscando...
              </div>
            ) : null}

            {searched && !loading && visibleItems.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-slate-500">
                Nenhum resultado encontrado para "{query}".
              </div>
            ) : null}

            {!loading && visibleItems.length > 0 && !selected ? (
              <ul
                className="divide-y divide-slate-100"
                onWheel={(event) => {
                  if (!visibleItems.length || event.deltaY === 0) return;
                  setActiveIndex((current) => moveActiveIndex(current, visibleItems.length, event.deltaY > 0 ? 1 : -1));
                }}
              >
                {visibleItems.map((item, index) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      ref={(element) => {
                        itemRefs.current[index] = element;
                      }}
                      onClick={() => setSelected(item)}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${activeIndex === index ? 'bg-purple-50 ring-1 ring-inset ring-purple-200' : 'hover:bg-slate-50'}`}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-700">
                        <Users className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{item.fullName}</p>
                        <p className="truncate text-xs text-slate-500">
                          {[item.rol ? `ROL ${item.rol}` : null, item.church?.code ? `${item.church.code} - ${item.church.name}` : item.church?.name || null]
                            .filter(Boolean)
                            .join(' • ')}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        {item.membershipStatus || 'Sem status'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {selected ? (
              <div className="p-5">
                <div className="mb-4 flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
                  <div className="min-w-0 flex-1">
                    <span className="inline-block rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-700">
                      {getDisplayedEcclesiasticalTitle(selected)}
                    </span>
                    <h2 className="mt-2 text-lg font-bold text-slate-900">{selected.fullName}</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {[selected.rol ? `ROL ${selected.rol}` : null, selected.church?.code ? `${selected.church.code} - ${selected.church.name}` : selected.church?.name || null]
                        .filter(Boolean)
                        .join(' • ')}
                    </p>
                  </div>
                  <button type="button" onClick={() => setSelected(null)} className="rounded-lg p-2 hover:bg-slate-100">
                    <X className="h-5 w-5 text-slate-500" />
                  </button>
                </div>

                <dl className="space-y-3">
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status</dt>
                    <dd className="mt-0.5 text-sm text-slate-800">{selected.membershipStatus || 'Nao informado'}</dd>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Título</dt>
                    <dd className="mt-0.5 text-sm text-slate-800">{getDisplayedEcclesiasticalTitle(selected)}</dd>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Telefone</dt>
                    <dd className="mt-0.5 text-sm text-slate-800">{selected.mobile || selected.phone || 'Nao informado'}</dd>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">E-mail</dt>
                    <dd className="mt-0.5 text-sm text-slate-800">{selected.email || 'Nao informado'}</dd>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">CPF</dt>
                    <dd className="mt-0.5 text-sm text-slate-800">{selected.cpf || 'Nao informado'}</dd>
                  </div>
                </dl>

                <div className="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => handleNavigate(selected, 'view')}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <Eye className="h-4 w-4" />
                    Ir para o perfil
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNavigate(selected, 'edit')}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700"
                  >
                    <Pencil className="h-4 w-4" />
                    Editar membro
                  </button>
                </div>
              </div>
            ) : null}
            </section>
          </div>
        </>
      ) : null}
    </>
  );
}
