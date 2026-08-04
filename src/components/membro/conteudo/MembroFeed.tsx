"use client";

/**
 * Feed — mesmo desenho do app Flutter: cartão em largura cheia, cabeçalho com
 * avatar/autor/local/idade do post, mídia sangrando nas bordas, barra de ações
 * e a legenda no formato "autor + texto".
 *
 * A faixa de círculos do topo é montada com os autores que publicaram — não há
 * tabela de stories; é um índice de quem publicou, na mesma leitura visual.
 */

import { useMemo } from 'react';
import { Heart, MessageCircle, Send, Bookmark, MapPin, MoreHorizontal, BadgeCheck } from 'lucide-react';
import { MembroShell } from '../MembroShell';
import { MEMBRO } from '../theme';
import { useConteudo } from './useConteudo';
import { Carregando, Vazio, SemCampo, Erro } from './Primitivos';

interface Post {
  id: string;
  titulo: string | null;
  conteudo: string | null;
  midia: string | null;
  midia_tipo: string | null;
  autor: string | null;
  autor_foto: string | null;
  curtidas: number;
  comentarios: number;
  data: string | null;
  local: string | null;
  verificado: boolean;
}

/** "69d", "3s", "5h", "12min" — mesma abreviação do app. */
function idade(iso: string | null): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '';
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const sem = Math.floor(d / 7);
  if (d < 365) return d < 30 ? `${sem}sem` : `${Math.floor(d / 30)}m`;
  return `${Math.floor(d / 365)}a`;
}

function iniciais(nome: string | null): string {
  const partes = (nome ?? '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  return (partes[0][0] + (partes[1]?.[0] ?? '')).toUpperCase();
}

function Avatar({ post, tamanho }: { post: Post; tamanho: number }) {
  if (post.autor_foto) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={post.autor_foto} alt="" className="rounded-full object-cover flex-shrink-0"
        style={{ width: tamanho, height: tamanho }} />
    );
  }
  return (
    <div className="rounded-full flex items-center justify-center flex-shrink-0 font-bold"
      style={{
        width: tamanho, height: tamanho,
        background: MEMBRO.CARD, border: `2px solid ${MEMBRO.BORDER}`,
        color: MEMBRO.TEXT2, fontSize: tamanho * 0.34,
      }}>
      {iniciais(post.autor)}
    </div>
  );
}

export default function MembroFeed() {
  const { dados, carregando, erro, semCampo } = useConteudo<Post[]>('feed');
  const posts = useMemo(() => dados ?? [], [dados]);

  // um círculo por autor, na ordem em que apareceram
  const autores = useMemo(() => {
    const vistos = new Map<string, Post>();
    for (const p of posts) {
      const chave = p.autor ?? p.id;
      if (!vistos.has(chave)) vistos.set(chave, p);
    }
    return [...vistos.values()];
  }, [posts]);

  return (
    <MembroShell title="Feed" showBack>
      {carregando ? <Carregando />
        : erro ? <Erro mensagem={erro} />
        : semCampo ? <SemCampo />
        : !posts.length ? <Vazio oQue="publicação" />
        : (
          <div className="h-full overflow-y-auto flex flex-col gap-2" style={{ background: MEMBRO.BG }}>
            {/* faixa de autores */}
            <div className="flex gap-4 overflow-x-auto px-4 py-3" style={{ background: MEMBRO.CARD }}>
              {autores.map(a => (
                <div key={a.id} className="flex flex-col items-center gap-1 flex-shrink-0 w-16">
                  <Avatar post={a} tamanho={56} />
                  <span className="text-[11px] truncate w-full text-center" style={{ color: MEMBRO.TEXT2 }}>
                    {(a.autor ?? '').split(' ')[0] || '—'}
                  </span>
                </div>
              ))}
            </div>

            {posts.map(p => (
              <article key={p.id} className="flex flex-col" style={{ background: MEMBRO.CARD }}>
                {/* cabeçalho */}
                <header className="flex items-center gap-3 px-4 py-3">
                  <Avatar post={p} tamanho={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-sm truncate" style={{ color: MEMBRO.TEXT1 }}>
                        {p.autor ?? 'Publicação'}
                      </span>
                      {p.verificado && <BadgeCheck className="w-3.5 h-3.5 flex-shrink-0" style={{ color: MEMBRO.ACCENT }} />}
                    </div>
                    <div className="flex items-center gap-1 text-xs" style={{ color: MEMBRO.TEXT2 }}>
                      {p.local && <><MapPin className="w-3 h-3" />{p.local}</>}
                      {p.local && p.data && <span>·</span>}
                      {p.data && <span>{idade(p.data)}</span>}
                    </div>
                  </div>
                  <MoreHorizontal className="w-5 h-5 flex-shrink-0" style={{ color: MEMBRO.TEXT2 }} />
                </header>

                {/* mídia — largura cheia, como no app */}
                {p.midia && (
                  p.midia_tipo?.startsWith('video')
                    ? <video controls src={p.midia} className="w-full bg-black" style={{ maxHeight: 420 }} />
                    // eslint-disable-next-line @next/next/no-img-element
                    : <img src={p.midia} alt="" className="w-full object-cover bg-black" style={{ maxHeight: 420 }} />
                )}

                {/* ações */}
                <div className="flex items-center px-4 py-3">
                  <div className="flex items-center gap-4 flex-1">
                    <Heart className="w-6 h-6" style={{ color: MEMBRO.TEXT1 }} />
                    <MessageCircle className="w-6 h-6" style={{ color: MEMBRO.TEXT1 }} />
                    <Send className="w-6 h-6" style={{ color: MEMBRO.TEXT1 }} />
                  </div>
                  <Bookmark className="w-6 h-6" style={{ color: MEMBRO.TEXT1 }} />
                </div>

                <div className="px-4 pb-4 flex flex-col gap-1">
                  {p.curtidas > 0 && (
                    <span className="text-sm font-semibold" style={{ color: MEMBRO.TEXT1 }}>
                      {p.curtidas} {p.curtidas === 1 ? 'curtida' : 'curtidas'}
                    </span>
                  )}

                  {p.titulo && (
                    <div className="text-sm" style={{ color: MEMBRO.TEXT1 }}>
                      <span className="font-semibold mr-1.5">{p.autor ?? 'Publicação'}</span>
                      {p.titulo}
                    </div>
                  )}

                  {p.conteudo && (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: MEMBRO.TEXT1 }}>
                      {p.conteudo}
                    </p>
                  )}

                  {p.comentarios > 0 && (
                    <span className="text-sm" style={{ color: MEMBRO.ACCENT }}>
                      Ver {p.comentarios === 1 ? 'o comentário' : `todos os ${p.comentarios} comentários`}
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
    </MembroShell>
  );
}
