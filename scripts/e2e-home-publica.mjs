/**
 * E2E da Home Pública — roda contra o servidor de desenvolvimento.
 *
 *   node scripts/e2e-home-publica.mjs [http://localhost:3000]
 *
 * Cobre o que a tela faz de verdade: carregar (semeando na primeira vez),
 * ocultar um cartão, reordenar, renomear, apagar, criar, mexer em cores e
 * textos, salvar e conferir se a home pública passou a refletir tudo isso.
 *
 * Ao final RESTAURA o estado que encontrou — pode rodar em cima do banco de
 * referência sem deixar sujeira.
 *
 * A sessão é obtida por magic link via service role: não precisa de senha.
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const BASE = process.argv[2] || 'http://localhost:3000';
const EMAIL_TESTE = process.env.E2E_EMAIL || 'admin@admin.com';

// ── .env ────────────────────────────────────────────────────────────────────
for (const arquivo of ['.env', '.env.local']) {
  if (!fs.existsSync(arquivo)) continue;
  for (const linha of fs.readFileSync(arquivo, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/.exec(linha);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let falhas = 0;
let passos = 0;

function ok(nome, condicao, detalhe = '') {
  passos++;
  if (condicao) {
    console.log(`  ok   ${nome}`);
  } else {
    falhas++;
    console.log(`  FALHA ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
  }
}

async function pegarToken() {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: EMAIL_TESTE,
  });
  if (error) throw new Error(`generateLink: ${error.message}`);

  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data: sessao, error: erroOtp } = await anon.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: 'magiclink',
  });
  if (erroOtp) throw new Error(`verifyOtp: ${erroOtp.message}`);
  return sessao.session.access_token;
}

async function api(caminho, { metodo = 'GET', token, corpo } = {}) {
  const res = await fetch(`${BASE}${caminho}`, {
    method: metodo,
    headers: {
      ...(corpo ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await res.text();
  let json = null;
  try { json = JSON.parse(texto); } catch { /* resposta não-JSON */ }
  return { status: res.status, json, texto };
}

/**
 * Este teste ESCREVE na configuração real e restaura no fim. Se alguém estiver
 * editando a tela ao mesmo tempo, a restauração desfaz o que a pessoa salvou —
 * foi exatamente o que aconteceu na primeira execução. Por isso a confirmação
 * explícita é obrigatória fora de um banco descartável.
 */
function exigirConfirmacao() {
  if (process.env.E2E_CONFIRMO === 'sim') return;
  console.error(
    'Este E2E grava na configuração da home e depois restaura o estado anterior.\n' +
    'Se alguém estiver com a tela "Home Pública" aberta, as edições dessa pessoa\n' +
    'serão perdidas.\n\n' +
    'Confirme que ninguém está editando e rode de novo:\n' +
    '  E2E_CONFIRMO=sim node scripts/e2e-home-publica.mjs\n'
  );
  process.exit(2);
}

const main = async () => {
  exigirConfirmacao();
  console.log(`E2E Home Pública — ${BASE}\n`);
  const token = await pegarToken();

  // ── 1. Carregar (semeia na primeira vez) ─────────────────────────────────
  console.log('1. Carregar a configuração');
  const inicial = await api('/api/home-config', { token });
  ok('GET /api/home-config responde 200', inicial.status === 200, `status ${inicial.status} ${inicial.texto.slice(0, 200)}`);
  if (inicial.status !== 200) { console.log('\nAbortando: sem configuração não dá para seguir.'); process.exit(1); }

  const original = { config: inicial.json.config, cards: inicial.json.cards };
  ok('veio configuração', !!original.config?.siteTitle);
  ok('veio a lista de cartões', Array.isArray(original.cards) && original.cards.length > 0,
    `${original.cards?.length} cartões`);
  ok('veio a sede (Informações da Igreja)', !!inicial.json.sede);
  ok('cartão do app presente e visível',
    original.cards.some(c => c.action === 'pwa' && c.visible));

  // ── 2. Ocultar um cartão ─────────────────────────────────────────────────
  console.log('\n2. Ocultar o cartão da rádio (o erro que apareceu na tela)');
  const ocultavel = original.cards.find(c => c.action === 'link') || original.cards[0];
  let cards = original.cards.map(c => (c.key === ocultavel.key ? { ...c, visible: false } : c));
  let r = await api('/api/home-config', { metodo: 'PUT', token, corpo: { config: original.config, cards } });
  ok('PUT salva sem erro', r.status === 200, `status ${r.status} ${r.texto.slice(0, 300)}`);
  ok('cartão voltou oculto', r.json?.cards?.find(c => c.key === ocultavel.key)?.visible === false);

  const publico1 = await api('/api/public/home-config?_=' + Date.now());
  ok('home pública não lista mais o cartão oculto',
    !publico1.json?.cards?.filter(c => c.visible).some(c => c.key === ocultavel.key));

  // ── 3. Reordenar ─────────────────────────────────────────────────────────
  console.log('\n3. Reordenar (trocar os dois primeiros)');
  cards = [...cards];
  [cards[0], cards[1]] = [cards[1], cards[0]];
  const esperadoPrimeiro = cards[0].key;
  r = await api('/api/home-config', { metodo: 'PUT', token, corpo: { config: original.config, cards } });
  ok('PUT da reordenação responde 200', r.status === 200, `status ${r.status} ${r.texto.slice(0, 200)}`);
  ok('ordem persistiu', r.json?.cards?.[0]?.key === esperadoPrimeiro,
    `primeiro veio ${r.json?.cards?.[0]?.key}`);

  // ── 4. Editar textos, ícone e cor ────────────────────────────────────────
  console.log('\n4. Editar título, ícone e cores de um cartão');
  const alvo = cards.find(c => c.action === 'link');
  cards = cards.map(c => (c.key === alvo.key
    ? { ...c, title: 'Título de teste E2E', icon: 'Podcast', iconColor: '#123456', hoverColor: '#abcdef', subtitle: 'linha 1\nlinha 2' }
    : c));
  r = await api('/api/home-config', { metodo: 'PUT', token, corpo: { config: original.config, cards } });
  const salvo = r.json?.cards?.find(c => c.key === alvo.key);
  ok('PUT da edição responde 200', r.status === 200, `status ${r.status} ${r.texto.slice(0, 200)}`);
  ok('título persistiu', salvo?.title === 'Título de teste E2E');
  ok('ícone persistiu', salvo?.icon === 'Podcast');
  ok('cor do ícone persistiu', salvo?.iconColor === '#123456');
  ok('cor de hover persistiu', salvo?.hoverColor === '#abcdef');
  ok('quebra de linha persistiu', salvo?.subtitle === 'linha 1\nlinha 2');

  // ── 5. Criar e apagar um cartão ──────────────────────────────────────────
  console.log('\n5. Criar um cartão novo e depois apagar');
  const novo = {
    key: 'e2e_novo', action: 'link', title: 'Dízimo online',
    subtitle: 'Contribua pelo site', url: 'https://exemplo.org/dizimo',
    icon: 'HandCoins', iconColor: null, hoverColor: null,
    visible: true, pulse: false, liveDot: false, fullWidth: false,
  };
  r = await api('/api/home-config', { metodo: 'PUT', token, corpo: { config: original.config, cards: [...cards, novo] } });
  ok('cartão novo foi criado', r.status === 200 && r.json?.cards?.some(c => c.key === 'e2e_novo'),
    `status ${r.status}`);

  r = await api('/api/home-config', { metodo: 'PUT', token, corpo: { config: original.config, cards } });
  ok('cartão novo foi apagado', r.status === 200 && !r.json?.cards?.some(c => c.key === 'e2e_novo'),
    `status ${r.status}`);

  // ── 6. Travas ────────────────────────────────────────────────────────────
  console.log('\n6. Travas do cartão "Instalar o app"');
  const semPwa = cards.filter(c => c.action !== 'pwa');
  r = await api('/api/home-config', { metodo: 'PUT', token, corpo: { config: original.config, cards: semPwa } });
  ok('cartão do app é reposto quando some da lista',
    r.status === 200 && r.json?.cards?.some(c => c.action === 'pwa'), `status ${r.status}`);

  const pwaOculto = cards.map(c => (c.action === 'pwa' ? { ...c, visible: false } : c));
  r = await api('/api/home-config', { metodo: 'PUT', token, corpo: { config: original.config, cards: pwaOculto } });
  ok('cartão do app não aceita ficar oculto',
    r.json?.cards?.find(c => c.action === 'pwa')?.visible === true);

  // ── 7. Validação ─────────────────────────────────────────────────────────
  console.log('\n7. Entrada inválida é recusada sem gravar nada');
  const invalido = [...cards, { key: 'e2e_ruim', action: 'link', title: 'Sem destino', url: '' }];
  r = await api('/api/home-config', { metodo: 'PUT', token, corpo: { config: original.config, cards: invalido } });
  ok('link sem endereço devolve 400', r.status === 400, `status ${r.status}`);
  ok('400 explica o motivo', Array.isArray(r.json?.detalhes) && r.json.detalhes.length > 0);

  const corRuim = cards.map((c, i) => (i === 0 ? { ...c, iconColor: 'vermelho' } : c));
  r = await api('/api/home-config', { metodo: 'PUT', token, corpo: { config: original.config, cards: corRuim } });
  ok('cor fora do formato devolve 400', r.status === 400, `status ${r.status}`);

  const iconeRuim = cards.map((c, i) => (i === 0 ? { ...c, icon: 'NaoExiste' } : c));
  r = await api('/api/home-config', { metodo: 'PUT', token, corpo: { config: original.config, cards: iconeRuim } });
  ok('ícone fora do catálogo devolve 400', r.status === 400, `status ${r.status}`);

  const chaveRepetida = [...cards, { ...cards[0] }];
  r = await api('/api/home-config', { metodo: 'PUT', token, corpo: { config: original.config, cards: chaveRepetida } });
  ok('chave repetida devolve 400', r.status === 400, `status ${r.status}`);

  // ── 8. Configuração geral ────────────────────────────────────────────────
  console.log('\n8. Salvar identidade, hero, aparência e atendimento');
  const cfgTeste = {
    ...original.config,
    siteTitle: 'Título E2E',
    heroTitle: 'TESTE',
    bgDark: '#111111',
    accentColor: '#ff8800',
    faviconUrl: '/icons/icon-512.png',
    showSymbols: false,
    watermarkOpacity: 0.12,
    services: { ...original.config.services, enabled: true, title: 'Atendimento E2E', hidden: ['jovem'], labels: { emergencial: 'Urgência' } },
  };
  r = await api('/api/home-config', { metodo: 'PUT', token, corpo: { config: cfgTeste, cards } });
  ok('PUT da configuração responde 200', r.status === 200, `status ${r.status} ${r.texto.slice(0, 200)}`);
  ok('título persistiu', r.json?.config?.siteTitle === 'Título E2E');
  ok('cor de fundo persistiu', r.json?.config?.bgDark === '#111111');
  ok('favicon persistiu', r.json?.config?.faviconUrl === '/icons/icon-512.png');
  ok('símbolos desligados persistiram', r.json?.config?.showSymbols === false);
  ok('opacidade persistiu', Number(r.json?.config?.watermarkOpacity) === 0.12);
  ok('serviço oculto persistiu', r.json?.config?.services?.hidden?.includes('jovem'));
  ok('renome de serviço persistiu', r.json?.config?.services?.labels?.emergencial === 'Urgência');

  const publico2 = await api('/api/public/home-config?_=' + Date.now());
  ok('home pública reflete o título', publico2.json?.config?.siteTitle === 'Título E2E');
  ok('home pública reflete o favicon', publico2.json?.config?.faviconUrl === '/icons/icon-512.png');

  const html = await fetch(`${BASE}/`).then(res => res.text());
  ok('<title> do HTML reflete a configuração', html.includes('<title>Título E2E</title>'));
  ok('<link rel="icon"> reflete a configuração', html.includes('href="/icons/icon-512.png"'));
  ok('só existe um <link rel="icon">', (html.match(/rel="icon"/g) || []).length === 1,
    `encontrados ${(html.match(/rel="icon"/g) || []).length}`);

  const manifesto = await api('/manifest.webmanifest');
  ok('manifesto do PWA responde 200', manifesto.status === 200);
  ok('manifesto usa a cor de fundo configurada', manifesto.json?.background_color === '#111111');

  // ── 9. Autorização ───────────────────────────────────────────────────────
  console.log('\n9. Autorização');
  ok('GET sem token devolve 401', (await api('/api/home-config')).status === 401);
  ok('PUT sem token devolve 401',
    (await api('/api/home-config', { metodo: 'PUT', corpo: { config: original.config, cards } })).status === 401);
  ok('GET público dispensa token', (await api('/api/public/home-config?_=' + Date.now())).status === 200);

  // ── 10. Restaurar ────────────────────────────────────────────────────────
  console.log('\n10. Restaurar o estado original');
  r = await api('/api/home-config', { metodo: 'PUT', token, corpo: original });
  ok('restauração responde 200', r.status === 200, `status ${r.status}`);
  ok('título voltou ao original', r.json?.config?.siteTitle === original.config.siteTitle);
  ok('cartões voltaram ao original',
    JSON.stringify(r.json?.cards) === JSON.stringify(original.cards));

  console.log(`\n${falhas === 0 ? 'TUDO PASSOU' : 'HOUVE FALHA'} — ${passos - falhas}/${passos} verificações`);
  process.exit(falhas === 0 ? 0 : 1);
};

main().catch(err => {
  console.error('\nErro no E2E:', err.message);
  process.exit(1);
});
