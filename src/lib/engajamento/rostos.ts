/**
 * Reconhecimento de rostos do Engajamento — a parte do servidor.
 *
 * O navegador acha os rostos e calcula o vetor de cada um (face-api, modelo
 * face_recognition: 128 números). Aqui cada rosto vai para a PESSOA cujo
 * centroide (média dos rostos dela) está mais perto; longe de todas, vira
 * pessoa nova. A equipe dá o nome de cada pessoa uma vez, e junta duas quando o
 * sistema separou a mesma pessoa.
 *
 * Distância euclidiana. A face-api considera "mesma pessoa" abaixo de 0,6;
 * aqui o corte é 0,5 — separar a mesma pessoa em duas (a equipe junta com um
 * clique) é melhor que misturar duas pessoas numa só (o relatório erra).
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { guardarImagem } from './imagens';

export const LIMIAR = 0.5;
const DIMENSAO = 128;

export interface RostoRecebido {
  imagemIndice: number;
  descritor: number[];
  caixa: { x: number; y: number; w: number; h: number };
  pontuacao: number;
  /** recorte do rosto, data:image/jpeg;base64,... */
  foto: string;
}

export function distancia(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < DIMENSAO; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

export function rostoValido(r: RostoRecebido): boolean {
  return Array.isArray(r.descritor) && r.descritor.length === DIMENSAO && r.descritor.every((n) => Number.isFinite(n))
    && Number.isInteger(r.imagemIndice) && r.imagemIndice >= 0
    && typeof r.foto === 'string' && r.foto.startsWith('data:image/jpeg;base64,') && r.foto.length < 60_000;
}

interface Centro { id: string; centroide: number[]; amostras: number; novo: boolean; mudou: boolean; fotoUrl: string | null }

/** Rodar várias promessas com no máximo `n` ao mesmo tempo. */
async function emLotes<T, R>(itens: T[], n: number, f: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const saida: R[] = new Array(itens.length);
  let prox = 0;
  await Promise.all(Array.from({ length: Math.min(n, itens.length) }, async () => {
    while (prox < itens.length) {
      const i = prox++;
      saida[i] = await f(itens[i], i);
    }
  }));
  return saida;
}

/**
 * Grava os rostos de uma publicação e marca a publicação como analisada.
 * Refazer a análise da mesma publicação apaga os rostos anteriores dela antes.
 */
export async function gravarRostos(campoId: string, publicacaoId: string, rostos: RostoRecebido[]) {
  const fotos = await emLotes(rostos, 6, (r, i) =>
    guardarImagem(Buffer.from(r.foto.slice('data:image/jpeg;base64,'.length), 'base64'), campoId, `rosto_${publicacaoId}_${r.imagemIndice}_${i}`));

  const centros: Centro[] = (await prisma.$queryRaw<Array<{ id: string; centroide: number[]; amostras: number; foto_url: string | null }>>(Prisma.sql`
    SELECT id, centroide, amostras, foto_url FROM engajamento_pessoas WHERE campo_id = ${campoId}::uuid`))
    .map((c) => ({ id: c.id, centroide: c.centroide, amostras: c.amostras, novo: false, mudou: false, fotoUrl: c.foto_url }));

  const atribuidos: Array<{ pessoaId: string; r: RostoRecebido; foto: string }> = [];
  rostos.forEach((r, i) => {
    let melhor: Centro | null = null;
    let menor = Infinity;
    for (const c of centros) {
      const d = distancia(r.descritor, c.centroide);
      if (d < menor) { menor = d; melhor = c; }
    }
    if (!melhor || menor >= LIMIAR) {
      melhor = { id: crypto.randomUUID(), centroide: [...r.descritor], amostras: 1, novo: true, mudou: true, fotoUrl: fotos[i] };
      centros.push(melhor);
    } else {
      const n = melhor.amostras + 1;
      melhor.centroide = melhor.centroide.map((v, k) => v + (r.descritor[k] - v) / n);
      melhor.amostras = n;
      melhor.mudou = true;
    }
    atribuidos.push({ pessoaId: melhor.id, r, foto: fotos[i] });
  });

  const novos = centros.filter((c) => c.novo);
  const alterados = centros.filter((c) => c.mudou && !c.novo);

  await prisma.$transaction([
    prisma.$executeRaw(Prisma.sql`DELETE FROM engajamento_rostos WHERE publicacao_id = ${publicacaoId}::uuid`),
    ...(novos.length ? [prisma.$executeRaw(Prisma.sql`
      INSERT INTO engajamento_pessoas (id, campo_id, foto_url, centroide, amostras)
      VALUES ${Prisma.join(novos.map((c) => Prisma.sql`(${c.id}::uuid, ${campoId}::uuid, ${c.fotoUrl}, ${c.centroide}::real[], ${c.amostras})`))}`)] : []),
    ...(alterados.length ? [prisma.$executeRaw(Prisma.sql`
      UPDATE engajamento_pessoas p SET centroide = v.centroide, amostras = v.amostras, updated_at = now()
        FROM (VALUES ${Prisma.join(alterados.map((c) => Prisma.sql`(${c.id}::uuid, ${c.centroide}::real[], ${c.amostras}::int)`))}) AS v(id, centroide, amostras)
       WHERE p.id = v.id`)] : []),
    ...(atribuidos.length ? [prisma.$executeRaw(Prisma.sql`
      INSERT INTO engajamento_rostos (campo_id, publicacao_id, imagem_indice, pessoa_id, descritor, caixa, pontuacao, foto_url)
      VALUES ${Prisma.join(atribuidos.map((a) => Prisma.sql`(${campoId}::uuid, ${publicacaoId}::uuid, ${a.r.imagemIndice}, ${a.pessoaId}::uuid,
        ${a.r.descritor}::real[], ${JSON.stringify(a.r.caixa)}::jsonb, ${a.r.pontuacao}, ${a.foto})`))}`)] : []),
    prisma.$executeRaw(Prisma.sql`UPDATE engajamento_publicacoes SET rostos_analisados_em = now() WHERE id = ${publicacaoId}::uuid`),
  ]);

  return { rostos: atribuidos.length, pessoasNovas: novos.length };
}

/** Junta `outra` em `destino`: rostos passam para o destino e o centroide é refeito. */
export async function juntarPessoas(campoId: string, destinoId: string, outraId: string, userId: string | null) {
  await prisma.$transaction([
    prisma.$executeRaw(Prisma.sql`
      UPDATE engajamento_rostos SET pessoa_id = ${destinoId}::uuid
       WHERE pessoa_id = ${outraId}::uuid AND campo_id = ${campoId}::uuid`),
    prisma.$executeRaw(Prisma.sql`
      UPDATE engajamento_pessoas d
         SET nome = coalesce(d.nome, o.nome), member_id = coalesce(d.member_id, o.member_id),
             updated_at = now(), updated_by = ${userId}::uuid
        FROM engajamento_pessoas o
       WHERE d.id = ${destinoId}::uuid AND o.id = ${outraId}::uuid`),
    prisma.$executeRaw(Prisma.sql`DELETE FROM engajamento_pessoas WHERE id = ${outraId}::uuid AND campo_id = ${campoId}::uuid`),
  ]);
  await recalcularCentroide(destinoId);
}

/** Centroide = média dos descritores dos rostos da pessoa (feito em SQL). */
export async function recalcularCentroide(pessoaId: string) {
  await prisma.$executeRaw(Prisma.sql`
    UPDATE engajamento_pessoas p
       SET centroide = m.centroide, amostras = m.n, updated_at = now()
      FROM (
        SELECT array_agg(media ORDER BY i)::real[] AS centroide, max(n)::int AS n
          FROM (
            SELECT i, avg(v) AS media, count(*) AS n
              FROM engajamento_rostos r, unnest(r.descritor) WITH ORDINALITY AS u(v, i)
             WHERE r.pessoa_id = ${pessoaId}::uuid
             GROUP BY i
          ) x
      ) m
     WHERE p.id = ${pessoaId}::uuid AND m.centroide IS NOT NULL`);
}
