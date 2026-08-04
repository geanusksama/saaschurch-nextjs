/**
 * Distribuição inteligente: liga cada contato importado ao GF mais perto da
 * casa dele.
 *
 * O caminho de uma pessoa até um GF tem quatro etapas, e cada uma pode falhar
 * sem derrubar as outras:
 *
 *  1. ACHAR O ENDEREÇO. Primeiro nas colunas da planilha importada (`raw`), que
 *     é dado explícito e de graça. Só quem não tem endereço no arquivo passa
 *     pela IA, que lê a conversa de WhatsApp e responde onde a pessoa mora —
 *     isso custa tokens, então é o último recurso, não o primeiro.
 *  2. GEOCODIFICAR. CEP vai no ViaCEP (rápido, sem limite prático). Endereço
 *     escrito vai no Nominatim, que pede no máximo 1 requisição por segundo —
 *     respeitamos isso com espera entre chamadas e cache por consulta.
 *  3. ESCOLHER O GF. Haversine ("de pássaro", mesma limitação do lib/geo.ts)
 *     entre a pessoa e cada GF ativo com coordenada.
 *  4. CONECTAR. Esta etapa NÃO acontece aqui: a rota só devolve a sugestão. É
 *     alguém na tela que aperta "Conectar" e dispara o anexo de verdade —
 *     porque anexar manda WhatsApp para o líder e passa a cobrar dele o
 *     acompanhamento daquela pessoa. Isso não se faz sozinho no meio da noite.
 *
 * O resultado de cada linha fica gravado em `whatsapp_import_rows`: reabrir a
 * tela não repete o trabalho caro, e o botão "Analisar" só olha quem ainda não
 * foi analisado.
 *
 * Server-side apenas.
 */

import { prisma } from './prisma';
import { supabaseAdmin } from './supabase-admin';
import { generateAiText, loadConversationHistory } from './aiReplyService';
import { findConversationByPhone } from './gfContactReportService';
import { haversineKm, normalizeZipcode } from './geo';

// ── Tipos ──────────────────────────────────────────────────────────────────

export interface GfCandidato {
  id: string;
  name: string;
  color: string | null;
  photo: string | null;
  cellType: string | null;
  meetingDay: string | null;
  meetingTime: string | null;
  endereco: string;
  latitude: number;
  longitude: number;
  leaderName: string | null;
  leaderPhone: string | null;
}

export interface ParDistribuicao {
  importRowId: string;
  batchId: string;
  batchName: string | null;
  nome: string;
  telefone: string | null;
  endereco: string | null;
  cep: string | null;
  origemEndereco: 'arquivo' | 'conversa' | null;
  latitude: number | null;
  longitude: number | null;
  gf: GfCandidato | null;
  distanciaKm: number | null;
  observacao: string | null;
  analisadoEm: string | null;
  /** true na aba "já conectados" — habilita o desfazer */
  conectado?: boolean;
}

export interface ResumoAnalise {
  analisadas: number;
  comEndereco: number;
  doArquivo: number;
  daConversa: number;
  comSugestao: number;
  semEndereco: number;
  semCoordenada: number;
  /** linhas que ficaram de fora desta rodada (o lote é limitado por chamada) */
  restantes: number;
  pares: ParDistribuicao[];
}

// ── Endereço vindo da planilha ─────────────────────────────────────────────

/**
 * Nomes de coluna que costumam trazer endereço nas listas que a secretaria
 * importa. A comparação é sem acento e sem espaço — "Endereço Completo",
 * "endereco_completo" e "ENDERECO" caem todos no mesmo lugar.
 */
const CHAVES_ENDERECO = ['endereco', 'enderecocompleto', 'logradouro', 'rua', 'address'];
const CHAVES_CEP = ['cep', 'codigopostal', 'zipcode', 'zip'];
const CHAVES_NUMERO = ['numero', 'num', 'nro'];
const CHAVES_BAIRRO = ['bairro', 'neighborhood'];
const CHAVES_CIDADE = ['cidade', 'municipio', 'city'];
const CHAVES_UF = ['uf', 'estado', 'state'];

function normalizarChave(chave: string): string {
  return String(chave)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

function valorPorChaves(fonte: Record<string, unknown>, chaves: string[]): string | null {
  for (const [k, v] of Object.entries(fonte ?? {})) {
    if (v === null || v === undefined || String(v).trim() === '') continue;
    if (chaves.includes(normalizarChave(k))) return String(v).trim();
  }
  return null;
}

interface EnderecoBruto {
  texto: string | null;
  cep: string | null;
}

/** Junta as colunas de endereço da planilha num texto só. */
export function enderecoDoArquivo(raw: Record<string, unknown>, variables: Record<string, unknown>): EnderecoBruto {
  const fonte = { ...(variables ?? {}), ...(raw ?? {}) };

  const cepBruto = valorPorChaves(fonte, CHAVES_CEP);
  const cep = cepBruto && normalizeZipcode(cepBruto).length === 8 ? normalizeZipcode(cepBruto) : null;

  const rua = valorPorChaves(fonte, CHAVES_ENDERECO);
  const numero = valorPorChaves(fonte, CHAVES_NUMERO);
  const bairro = valorPorChaves(fonte, CHAVES_BAIRRO);
  const cidade = valorPorChaves(fonte, CHAVES_CIDADE);
  const uf = valorPorChaves(fonte, CHAVES_UF);

  const texto = [
    [rua, numero].filter(Boolean).join(', '),
    bairro,
    cidade,
    uf,
  ].filter(Boolean).join(', ');

  return { texto: texto || null, cep };
}

// ── Endereço vindo da conversa ─────────────────────────────────────────────

const CEP_REGEX = /\b(\d{5})-?(\d{3})\b/;

const PROMPT_ENDERECO = `Você lê conversas de WhatsApp entre uma igreja e uma pessoa e extrai ONDE ESSA PESSOA MORA.

Responda SOMENTE um JSON, sem texto em volta:
{"endereco": "rua, número, bairro, cidade, UF ou string vazia",
 "cep": "somente dígitos ou string vazia",
 "confianca": "alta|media|baixa"}

Regras:
- Só considere o endereço DA PESSOA (onde ela mora). O endereço da igreja, de
  eventos ou de terceiros NÃO conta — nesses casos devolva endereco vazio.
- Se ela só disse o bairro ou a cidade, devolva isso mesmo com confianca "baixa".
- Nunca invente rua, número ou CEP que não estejam escritos na conversa.`;

interface EnderecoDaConversa extends EnderecoBruto {
  confianca: 'alta' | 'media' | 'baixa' | null;
}

/**
 * Pergunta à IA onde a pessoa mora, a partir da conversa.
 *
 * O CEP escrito na conversa é capturado por regex ANTES de perguntar à IA: é
 * prova literal, e não depende de o modelo acertar a cópia dos dígitos.
 */
export async function enderecoDaConversa(
  conversationId: string,
  campoId: string | null,
): Promise<EnderecoDaConversa> {
  const history = await loadConversationHistory(conversationId, 60);
  if (!history.length) return { texto: null, cep: null, confianca: null };

  const transcript = history
    .map((m) => `${m.role === 'user' ? 'CONTATO' : 'IGREJA'}: ${m.content}`)
    .join('\n');

  // CEP dito pela própria pessoa (mensagem dela, não nossa)
  const doContato = history.filter((m) => m.role === 'user').map((m) => m.content).join('\n');
  const achouCep = doContato.match(CEP_REGEX);
  const cepLiteral = achouCep ? `${achouCep[1]}${achouCep[2]}` : null;

  let texto: string | null = null;
  let cepIa: string | null = null;
  let confianca: EnderecoDaConversa['confianca'] = null;

  try {
    const bruto = await generateAiText(campoId, PROMPT_ENDERECO, [{ role: 'user', content: transcript }]);
    const limpo = bruto.replace(/^```(json)?/m, '').replace(/```\s*$/m, '').trim();
    const parsed = JSON.parse(limpo) as { endereco?: string; cep?: string; confianca?: string };
    texto = String(parsed.endereco ?? '').trim() || null;
    const cepBruto = normalizeZipcode(parsed.cep ?? '');
    cepIa = cepBruto.length === 8 ? cepBruto : null;
    const c = String(parsed.confianca ?? '').toLowerCase();
    confianca = c === 'alta' || c === 'media' || c === 'baixa' ? c : null;
  } catch (err) {
    // IA desligada, sem chave ou resposta fora do formato: o CEP literal ainda
    // pode salvar a linha, então não propagamos o erro.
    console.warn('[gfDistribuicao] IA não devolveu endereço utilizável', (err as Error)?.message);
  }

  return { texto, cep: cepLiteral ?? cepIa, confianca };
}

// ── Geocodificação ─────────────────────────────────────────────────────────

interface Ponto {
  latitude: number;
  longitude: number;
  rotulo: string;
}

/** Espera entre chamadas ao Nominatim — a política de uso pede 1 req/s. */
const ESPERA_NOMINATIM_MS = 1100;
let ultimaChamadaNominatim = 0;

async function respirar(ms: number) {
  if (ms > 0) await new Promise((r) => setTimeout(r, ms));
}

/**
 * Endereço → coordenada.
 *
 * O cache é por execução (o Map vive enquanto a análise roda): numa lista
 * importada é comum meia dúzia de pessoas do mesmo CEP, e não faz sentido
 * consultar o mesmo endereço várias vezes.
 */
export async function geocodificar(
  cep: string | null,
  texto: string | null,
  cache: Map<string, Ponto | null>,
): Promise<Ponto | null> {
  // 1) CEP no ViaCEP: vira endereço estruturado, que o Nominatim acha melhor
  let consulta = texto;
  if (cep) {
    const chaveCep = `cep:${cep}`;
    if (cache.has(chaveCep)) return cache.get(chaveCep) ?? null;

    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const payload = await res.json().catch(() => ({}));
      if (res.ok && !payload?.erro) {
        consulta = [payload.logradouro, payload.bairro, payload.localidade, payload.uf]
          .filter(Boolean)
          .join(', ');
      }
    } catch {
      /* ViaCEP fora do ar: cai para o texto do endereço */
    }
  }

  if (!consulta) return null;

  const chave = `q:${consulta.toLowerCase()}`;
  if (cache.has(chave)) return cache.get(chave) ?? null;

  const desdeUltima = Date.now() - ultimaChamadaNominatim;
  await respirar(ESPERA_NOMINATIM_MS - desdeUltima);
  ultimaChamadaNominatim = Date.now();

  let ponto: Ponto | null = null;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=${encodeURIComponent(consulta)}`,
      // a política do Nominatim exige identificar quem chama
      { headers: { 'User-Agent': 'MRM-SaasChurch/1.0 (contato@adcampinas.com.br)' } },
    );
    if (res.ok) {
      const payload = (await res.json().catch(() => [])) as Array<Record<string, unknown>>;
      const primeiro = Array.isArray(payload) ? payload[0] : null;
      if (primeiro?.lat && primeiro?.lon) {
        ponto = {
          latitude: Number(primeiro.lat),
          longitude: Number(primeiro.lon),
          rotulo: String(primeiro.display_name ?? consulta),
        };
      }
    }
  } catch (err) {
    console.warn('[gfDistribuicao] Nominatim falhou', (err as Error)?.message);
  }

  cache.set(chave, ponto);
  if (cep) cache.set(`cep:${cep}`, ponto);
  return ponto;
}

// ── GFs candidatos ─────────────────────────────────────────────────────────

/** GFs ativos com coordenada — sem coordenada não há como medir distância. */
export async function listarGfsCandidatos(churchId?: string | null): Promise<GfCandidato[]> {
  const cells = await prisma.cellGroup.findMany({
    where: {
      deletedAt: null,
      status: 'active',
      ...(churchId ? { churchId } : {}),
      latitude: { not: null },
      longitude: { not: null },
    },
    select: {
      id: true,
      name: true,
      color: true,
      photo: true,
      cellType: true,
      meetingDay: true,
      meetingTime: true,
      addressStreet: true,
      addressNumber: true,
      addressNeighborhood: true,
      addressCity: true,
      addressState: true,
      latitude: true,
      longitude: true,
      leader: { select: { fullName: true, mobile: true, phone: true } },
      leaders: {
        orderBy: { position: 'asc' },
        take: 1,
        select: { member: { select: { fullName: true, mobile: true, phone: true } } },
      },
    },
    orderBy: { name: 'asc' },
  });

  return cells.map((c) => {
    const principal = c.leaders[0]?.member ?? c.leader ?? null;
    return {
      id: c.id,
      name: c.name,
      color: c.color,
      photo: c.photo,
      cellType: c.cellType,
      meetingDay: c.meetingDay,
      // HH:mm, senão o horário sai deslocado pelo fuso do servidor
      meetingTime: c.meetingTime ? c.meetingTime.toISOString().slice(11, 16) : null,
      endereco: [
        [c.addressStreet, c.addressNumber].filter(Boolean).join(', '),
        c.addressNeighborhood,
        c.addressCity,
        c.addressState,
      ].filter(Boolean).join(', '),
      latitude: Number(c.latitude),
      longitude: Number(c.longitude),
      leaderName: principal?.fullName ?? null,
      leaderPhone: principal ? principal.mobile || principal.phone || null : null,
    };
  });
}

/** O GF mais perto de um ponto. Empate não existe na prática (distância real). */
export function gfMaisProximo(
  ponto: { latitude: number; longitude: number },
  gfs: GfCandidato[],
): { gf: GfCandidato; km: number } | null {
  let melhor: { gf: GfCandidato; km: number } | null = null;
  for (const gf of gfs) {
    const km = haversineKm(ponto, gf);
    if (km === null) continue;
    if (!melhor || km < melhor.km) melhor = { gf, km };
  }
  return melhor;
}

// ── A análise ──────────────────────────────────────────────────────────────

interface LinhaImportada {
  id: string;
  batch_id: string;
  name: string | null;
  phone: string | null;
  raw: Record<string, unknown> | null;
  variables: Record<string, unknown> | null;
  cell_group_id: string | null;
  /** quando o contato importado bateu com alguém do cadastro */
  matched_member_id: string | null;
}

const SELECT_LINHA =
  'id, batch_id, name, phone, raw, variables, cell_group_id, matched_member_id, address_text, address_zipcode, address_source, latitude, longitude, suggested_cell_group_id, suggested_distance_km, analyzed_at, analysis_note';

/**
 * Analisa um lote de contatos e grava a sugestão de GF em cada linha.
 *
 * `limite` existe porque cada linha sem endereço no arquivo custa uma chamada
 * de IA e uma de geocodificação (com espera de 1s). Analisar 2 mil contatos de
 * uma vez estouraria o tempo da requisição — a tela chama de novo para
 * continuar de onde parou, e `restantes` diz quanto falta.
 */
export async function analisarDistribuicao(opts: {
  batchId?: string | null;
  churchId?: string | null;
  campoId?: string | null;
  instanceIds: Set<string> | null;
  limite?: number;
  /** true = reanalisa quem já tem análise (o padrão é só quem falta) */
  refazer?: boolean;
}): Promise<ResumoAnalise> {
  const limite = Math.min(200, Math.max(1, opts.limite ?? 25));

  let query = supabaseAdmin
    .from('whatsapp_import_rows')
    .select(SELECT_LINHA, { count: 'exact' })
    // quem já está num GF não entra: a distribuição é para quem falta
    .is('cell_group_id', null);
  if (opts.batchId) query = query.eq('batch_id', opts.batchId);
  if (!opts.refazer) query = query.is('analyzed_at', null);

  const { data, count } = await query.order('created_at', { ascending: true }).limit(limite);
  const linhas = (data ?? []) as unknown as LinhaImportada[];

  const gfs = await listarGfsCandidatos(opts.churchId);
  const cache = new Map<string, Ponto | null>();

  // não gasta IA nem geocodificação com quem já está num GF pelo cadastro
  const jaEmGf = await membrosJaEmGf(linhas.map((l) => l.matched_member_id ?? '').filter(Boolean));

  const resumo: ResumoAnalise = {
    analisadas: 0,
    comEndereco: 0,
    doArquivo: 0,
    daConversa: 0,
    comSugestao: 0,
    semEndereco: 0,
    semCoordenada: 0,
    restantes: Math.max(0, (count ?? linhas.length) - linhas.length),
    pares: [],
  };

  for (const linha of linhas) {
    if (linha.matched_member_id && jaEmGf.has(linha.matched_member_id)) continue;
    resumo.analisadas++;

    // 1) endereço: primeiro o arquivo (de graça), depois a conversa (IA)
    let origem: 'arquivo' | 'conversa' | null = null;
    let { texto, cep } = enderecoDoArquivo(linha.raw ?? {}, linha.variables ?? {});
    if (texto || cep) {
      origem = 'arquivo';
      resumo.doArquivo++;
    } else if (linha.phone) {
      const conversa = await findConversationByPhone(linha.phone, opts.instanceIds);
      if (conversa) {
        const daConversa = await enderecoDaConversa(conversa.id, opts.campoId ?? null);
        if (daConversa.texto || daConversa.cep) {
          texto = daConversa.texto;
          cep = daConversa.cep;
          origem = 'conversa';
          resumo.daConversa++;
        }
      }
    }

    let nota: string | null = null;
    let ponto: Ponto | null = null;

    if (!texto && !cep) {
      nota = 'Nenhum endereço na planilha nem na conversa.';
      resumo.semEndereco++;
    } else {
      resumo.comEndereco++;
      ponto = await geocodificar(cep, texto, cache);
      if (!ponto) {
        nota = 'Endereço encontrado, mas não localizado no mapa.';
        resumo.semCoordenada++;
      }
    }

    // 2) GF mais próximo
    const escolha = ponto ? gfMaisProximo(ponto, gfs) : null;
    if (ponto && !escolha) {
      nota = gfs.length
        ? 'Nenhum GF com coordenada cadastrada para comparar.'
        : 'Nenhum GF ativo com endereço no mapa.';
    }
    if (escolha) resumo.comSugestao++;

    const agora = new Date().toISOString();
    const enderecoFinal = texto || (cep ? `CEP ${cep}` : null);

    await supabaseAdmin
      .from('whatsapp_import_rows')
      .update({
        address_text: enderecoFinal,
        address_zipcode: cep,
        address_source: origem,
        latitude: ponto?.latitude ?? null,
        longitude: ponto?.longitude ?? null,
        suggested_cell_group_id: escolha?.gf.id ?? null,
        suggested_distance_km: escolha ? Number(escolha.km.toFixed(3)) : null,
        analyzed_at: agora,
        analysis_note: nota,
      })
      .eq('id', linha.id);

    resumo.pares.push({
      importRowId: linha.id,
      batchId: linha.batch_id,
      batchName: null,
      nome: linha.name || 'Sem nome',
      telefone: linha.phone,
      endereco: enderecoFinal,
      cep,
      origemEndereco: origem,
      latitude: ponto?.latitude ?? null,
      longitude: ponto?.longitude ?? null,
      gf: escolha?.gf ?? null,
      distanciaKm: escolha ? Number(escolha.km.toFixed(2)) : null,
      observacao: nota,
      analisadoEm: agora,
      conectado: false,
    });
  }

  return resumo;
}

/**
 * Dos contatos recebidos, quais JÁ estão num GF pelo cadastro de membros.
 *
 * `whatsapp_import_rows.cell_group_id` só sabe das conexões feitas por esta
 * tela. Se a pessoa é membro e já foi anexada ao GF por outro caminho (a tela
 * do GF, por exemplo), a linha importada continua "livre" — e ela reapareceria
 * aqui para ser distribuída de novo. Este filtro fecha esse buraco.
 */
async function membrosJaEmGf(memberIds: string[]): Promise<Set<string>> {
  const ids = memberIds.filter(Boolean);
  if (!ids.length) return new Set();
  const vinculos = await prisma.cellGroupMember.findMany({
    where: { memberId: { in: ids }, isActive: true },
    select: { memberId: true },
  });
  return new Set(vinculos.map((v) => v.memberId));
}

/**
 * Pares já analisados que esperam o "Conectar" — é o que a tela mostra ao
 * abrir, sem refazer análise nenhuma.
 *
 * `conectados: true` inverte a lista: mostra quem JÁ foi conectado por esta
 * tela, que é o que permite desfazer em lote.
 */
export async function listarParesPendentes(opts: {
  batchId?: string | null;
  churchId?: string | null;
  limite?: number;
  conectados?: boolean;
}): Promise<ParDistribuicao[]> {
  let query = supabaseAdmin.from('whatsapp_import_rows').select(SELECT_LINHA);

  if (opts.conectados) {
    query = query.not('cell_group_id', 'is', null);
  } else {
    query = query.is('cell_group_id', null).not('suggested_cell_group_id', 'is', null);
  }
  if (opts.batchId) query = query.eq('batch_id', opts.batchId);

  const { data } = await query
    .order('suggested_distance_km', { ascending: true })
    .limit(Math.min(500, Math.max(1, opts.limite ?? 100)));

  const linhas = (data ?? []) as unknown as Array<
    LinhaImportada & {
      address_text: string | null;
      address_zipcode: string | null;
      address_source: 'arquivo' | 'conversa' | null;
      latitude: number | null;
      longitude: number | null;
      suggested_cell_group_id: string | null;
      suggested_distance_km: number | null;
      analyzed_at: string | null;
      analysis_note: string | null;
    }
  >;
  if (!linhas.length) return [];

  // A lista de candidatos serve para desenhar o GF na tela. Quem já está
  // conectado pode estar num GF de outra igreja (transferência), então esse
  // caso busca sem filtrar por igreja.
  const gfs = await listarGfsCandidatos(opts.conectados ? null : opts.churchId);
  const porId = new Map(gfs.map((g) => [g.id, g]));

  const emGfPeloCadastro = opts.conectados
    ? new Set<string>()
    : await membrosJaEmGf(linhas.map((l) => l.matched_member_id ?? '').filter(Boolean));

  return linhas
    .filter((l) => !(l.matched_member_id && emGfPeloCadastro.has(l.matched_member_id)))
    .map((l) => {
      const gfId = opts.conectados ? l.cell_group_id : l.suggested_cell_group_id;
      return {
        importRowId: l.id,
        batchId: l.batch_id,
        batchName: null,
        nome: l.name || 'Sem nome',
        telefone: l.phone,
        endereco: l.address_text,
        cep: l.address_zipcode,
        origemEndereco: l.address_source,
        latitude: l.latitude === null ? null : Number(l.latitude),
        longitude: l.longitude === null ? null : Number(l.longitude),
        gf: gfId ? porId.get(gfId) ?? null : null,
        distanciaKm: l.suggested_distance_km === null ? null : Number(l.suggested_distance_km),
        observacao: l.analysis_note,
        analisadoEm: l.analyzed_at,
        conectado: !!l.cell_group_id,
      };
    });
}
