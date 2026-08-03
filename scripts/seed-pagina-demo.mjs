/**
 * Seed de demonstração: monta a página de um departamento com TODOS os blocos
 * preenchidos, para ver o CMS funcionando de ponta a ponta.
 *
 * O conteúdo é fictício e as imagens vêm do picsum.photos (placeholder público
 * e determinístico — a mesma seed devolve sempre a mesma foto). Serve para
 * demonstração; troque pelo conteúdo real depois.
 *
 * Uso:
 *   node scripts/seed-pagina-demo.mjs [slug] [--publicar]
 *   node scripts/seed-pagina-demo.mjs adolescentes --publicar
 *
 * Reexecutar substitui os blocos daquela página — não duplica.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

for (const f of [".env.local", ".env"]) {
  const p = path.resolve(process.cwd(), f);
  if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const SLUG = (process.argv[2] && !process.argv[2].startsWith("--")) ? process.argv[2] : "adolescentes";
const PUBLICAR = process.argv.includes("--publicar");
const LIMPAR = process.argv.includes("--limpar");
/**
 * Nome do campo. É obrigatório na prática: o slug é único POR CAMPO, então
 * "adolescentes" existe em Campinas e em Curitiba — sem escolher, o script
 * pegaria uma das duas ao acaso.
 */
const CAMPO_NOME = (process.argv.find((a) => a.startsWith("--campo=")) || "").split("=")[1] || "";

/** Foto de exemplo — determinística pela seed. */
const foto = (seed, w = 1600, h = 900) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

// ── Localiza a página ────────────────────────────────────────────────────────

const { data: candidatos, error: erroSite } = await sb
  .from("department_sites")
  .select("id, slug, titulo, campo_id, department_id, preset, status, campos(name)")
  .ilike("slug", SLUG)
  .is("deleted_at", null);

if (erroSite) { console.error(erroSite.message); process.exit(1); }
if (!candidatos?.length) {
  console.error(`Página "/${SLUG}" não encontrada. Rode a migration 51 antes.`);
  process.exit(1);
}

const nomeCampo = (s) => s.campos?.name ?? "(sem campo)";

let site;
if (CAMPO_NOME) {
  site = candidatos.find((s) => nomeCampo(s).toLowerCase() === CAMPO_NOME.toLowerCase());
  if (!site) {
    console.error(`"/${SLUG}" não existe no campo "${CAMPO_NOME}".`);
    console.error(`Campos com essa página: ${candidatos.map(nomeCampo).join(", ")}`);
    process.exit(1);
  }
} else if (candidatos.length > 1) {
  console.error(`"/${SLUG}" existe em mais de um campo — escolha qual:`);
  for (const c of candidatos) console.error(`  --campo="${nomeCampo(c)}"`);
  process.exit(1);
} else {
  site = candidatos[0];
}

console.log(`Página: ${site.titulo} (/${site.slug}) · campo ${nomeCampo(site)} · preset ${site.preset}\n`);

// Modo limpeza: desfaz um seed anterior e devolve a página a rascunho vazio.
if (LIMPAR) {
  await sb.from("department_site_blocks").delete().eq("site_id", site.id);
  await sb.from("department_sites")
    .update({ status: "RASCUNHO", published_at: null }).eq("id", site.id);
  console.log("✔ blocos removidos e página de volta a RASCUNHO");
  process.exit(0);
}

// ── Blocos ───────────────────────────────────────────────────────────────────
// O menu entra depois, num segundo passo: seus links apontam para os ids dos
// blocos, que só existem depois da inserção.

const blocos = [
  {
    tipo: "hero", variante: "carousel", chave: "hero",
    props: {
      badge: "Adolescentes · 12 a 17 anos",
      titulo: "Sua fé começa agora",
      subtitulo: "Encontros toda sexta, às 19h30. Vem com a gente.",
      altura: "lg", alinhamento: "center", overlay: 55,
      efeito: "zoom", autoplay: true, intervalo: 6, setas: true,
      ctaTexto: "Quero participar", ctaUrl: "#",
      slides: [
        { imagem: foto("adol-culto"), titulo: "Sua fé começa agora",
          subtitulo: "Encontros toda sexta, às 19h30.",
          ctaTexto: "Quero participar", ctaUrl: "#" },
        { imagem: foto("adol-louvor"), titulo: "Louvor que move",
          subtitulo: "Uma geração que adora de verdade." },
        { imagem: foto("adol-amigos"), titulo: "Você não está sozinho",
          subtitulo: "Amizades que caminham com você." },
      ],
    },
  },
  {
    tipo: "numeros", variante: "linha", chave: "numeros",
    props: {
      titulo: "",
      itens: [
        { valor: "180+", rotulo: "adolescentes" },
        { valor: "12", rotulo: "pequenos grupos" },
        { valor: "4", rotulo: "encontros por mês" },
        { valor: "2", rotulo: "acampamentos por ano" },
      ],
    },
  },
  {
    tipo: "texto", variante: "destaque", chave: "sobre",
    props: {
      titulo: "Quem somos",
      conteudo:
        "O ministério de Adolescentes existe para caminhar com quem está " +
        "descobrindo a própria fé.\n\nAqui ninguém precisa fingir que tem todas " +
        "as respostas. A gente estuda a Bíblia de um jeito que faz sentido para " +
        "a vida real, joga junto, serve junto e cresce junto.",
      alinhamento: "left",
    },
  },
  {
    tipo: "container", variante: "3-colunas", chave: "pilares",
    props: {
      titulo: "No que acreditamos",
      borda: true, alinhamento: "left",
      colunas: [
        { icone: "📖", titulo: "Palavra",
          texto: "Estudo bíblico semanal, com linguagem de quem tem 15 anos — sem diluir o conteúdo." },
        { icone: "🤝", titulo: "Amizade",
          texto: "Pequenos grupos por faixa de idade, onde dá para falar do que realmente importa." },
        { icone: "🔥", titulo: "Propósito",
          texto: "Projetos sociais e ações de serviço para colocar a fé em prática fora da igreja." },
      ],
    },
  },
  {
    tipo: "galeria", variante: "mosaico", chave: "galeria",
    props: {
      titulo: "Nossos momentos", colunas: 3, legendas: true,
      fotos: [
        { url: foto("adol-g1", 800, 1000), legenda: "Acampamento de inverno" },
        { url: foto("adol-g2", 800, 600),  legenda: "Noite de louvor" },
        { url: foto("adol-g3", 800, 900),  legenda: "Ação social no bairro" },
        { url: foto("adol-g4", 800, 700),  legenda: "Pequeno grupo" },
        { url: foto("adol-g5", 800, 1100), legenda: "Batismo" },
        { url: foto("adol-g6", 800, 800),  legenda: "Gincana" },
      ],
    },
  },
  {
    tipo: "agenda", variante: "semana", chave: "programacao",
    props: {
      titulo: "Programação da semana",
      itens: [
        { dia: "Sexta", hora: "19h30", descricao: "Encontro de Adolescentes", local: "Templo — Sala 2" },
        { dia: "Sexta", hora: "21h00", descricao: "Pequenos grupos", local: "Salas do 1º andar" },
        { dia: "Domingo", hora: "09h00", descricao: "EBD Adolescentes", local: "Sala 4" },
        { dia: "Sábado", hora: "15h00", descricao: "Ensaio do louvor", local: "Auditório" },
      ],
    },
  },
  {
    tipo: "eventos", variante: "cards", chave: "eventos",
    props: {
      titulo: "Próximos eventos", limite: 6, mostrarPassados: true,
      textoBotao: "Inscrever-se", textoEncerrado: "Inscrições encerradas",
    },
  },
  {
    tipo: "tabela", variante: "listrada", chave: "tabela",
    props: {
      titulo: "Acampamento de verão — valores",
      colunas: [{ titulo: "Lote" }, { titulo: "Até" }, { titulo: "Valor" }, { titulo: "Parcelamento" }],
      linhas: [
        { celulas: "1º lote | 30/09 | R$ 280,00 | em até 4x", destaque: true },
        { celulas: "2º lote | 31/10 | R$ 320,00 | em até 3x", destaque: false },
        { celulas: "3º lote | 30/11 | R$ 380,00 | em até 2x", destaque: false },
        { celulas: "Na hora | — | R$ 420,00 | à vista", destaque: false },
      ],
    },
  },
  {
    tipo: "loja", variante: "vitrine", chave: "loja",
    props: { titulo: "Loja do ministério", subtitulo: "Camisetas e materiais", limite: 8, colunas: 4 },
  },
  {
    tipo: "depoimentos", variante: "cards", chave: "depoimentos",
    props: {
      titulo: "O que eles dizem",
      itens: [
        { texto: "Eu vinha só porque meus pais traziam. Hoje eu venho porque quero.",
          nome: "Rafael, 16", foto: foto("adol-d1", 200, 200) },
        { texto: "Foi no pequeno grupo que eu consegui falar do que estava passando pela primeira vez.",
          nome: "Beatriz, 15", foto: foto("adol-d2", 200, 200) },
        { texto: "O acampamento mudou o meu ano. Voltei outra pessoa.",
          nome: "Lucas, 14", foto: foto("adol-d3", 200, 200) },
      ],
    },
  },
  {
    tipo: "equipe", variante: "circulos", chave: "equipe",
    props: {
      titulo: "Quem lidera", colunas: 4,
      pessoas: [
        { foto: foto("adol-l1", 300, 300), nome: "Pr. André Martins", funcao: "Pastor de Adolescentes" },
        { foto: foto("adol-l2", 300, 300), nome: "Juliana Prado", funcao: "Coordenadora" },
        { foto: foto("adol-l3", 300, 300), nome: "Thiago Nunes", funcao: "Louvor" },
        { foto: foto("adol-l4", 300, 300), nome: "Carol Ribeiro", funcao: "Pequenos grupos" },
      ],
    },
  },
  {
    tipo: "faq", variante: "acordeao", chave: "faq",
    props: {
      titulo: "Dúvidas frequentes",
      itens: [
        { pergunta: "Qual a faixa de idade?",
          resposta: "De 12 a 17 anos. A partir dos 18 a pessoa passa para a Frente Jovem." },
        { pergunta: "Preciso ser membro da igreja para participar?",
          resposta: "Não. Os encontros são abertos — traga seus amigos." },
        { pergunta: "Tem alguma taxa?",
          resposta: "Os encontros semanais são gratuitos. Só acampamentos e viagens têm custo." },
        { pergunta: "Como faço para servir no ministério?",
          resposta: "Fale com a liderança no fim de qualquer encontro ou use o formulário de contato." },
      ],
    },
  },
  {
    tipo: "html", variante: "contido", chave: "html",
    props: {
      espacamento: "md",
      html:
        '<div class="aviso">' +
        '<h3>Autorização para menores</h3>' +
        '<p>Para acampamentos e viagens, todo adolescente precisa entregar a ' +
        'autorização assinada pelos responsáveis. Baixe, preencha e entregue à ' +
        'liderança até uma semana antes.</p>' +
        '<a class="botao" href="#">Baixar autorização (PDF)</a>' +
        "</div>",
      css:
        ".aviso{border:2px dashed var(--ds-border);border-radius:16px;padding:28px;text-align:center}" +
        ".aviso h3{font-size:20px;font-weight:700;margin-bottom:8px}" +
        ".aviso p{color:var(--ds-text-muted);max-width:520px;margin:0 auto 18px}" +
        ".botao{display:inline-block;background:var(--ds-primary);color:#fff;" +
        "padding:12px 24px;border-radius:8px;font-weight:600;text-decoration:none}",
    },
  },
  {
    tipo: "cta", variante: "imagem", chave: "cta",
    props: {
      titulo: "Sexta que vem tem encontro",
      subtitulo: "Chega às 19h15 para pegar lugar bom. Traz um amigo.",
      imagem: foto("adol-cta"),
      ctaTexto: "Ver como chegar", ctaUrl: "#",
    },
  },
  {
    tipo: "contato", variante: "cards", chave: "contato",
    props: {
      titulo: "Fale com a liderança",
      whatsapp: "5519999998888",
      instagram: "@adolescentes.adcampinas",
      email: "adolescentes@adcampinas.com.br",
    },
  },
];

// ── Grava ────────────────────────────────────────────────────────────────────

console.log("1. Limpando blocos anteriores desta página");
await sb.from("department_site_blocks").delete().eq("site_id", site.id);

console.log("2. Inserindo blocos");
const idsPorChave = {};
let ordem = 1; // 0 fica reservado para o menu

for (const b of blocos) {
  const { data, error } = await sb
    .from("department_site_blocks")
    .insert({
      site_id: site.id,
      campo_id: site.campo_id,
      tipo: b.tipo,
      variante: b.variante,
      ordem: ordem++,
      props: b.props,
      props_publicado: b.props,
      visivel: true,
    })
    .select("id")
    .single();
  if (error) { console.error(`  ✘ ${b.tipo}: ${error.message}`); process.exit(1); }
  idsPorChave[b.chave] = data.id;
  console.log(`  ✔ ${b.tipo} (${b.variante})`);
}

// Agora o menu: os links apontam para as âncoras dos blocos recém-criados.
console.log("\n3. Menu com links para as seções");
const ancora = (chave) => `sec-${idsPorChave[chave]}`;

const propsMenu = {
  logo: "",
  titulo: "Adolescentes",
  alturaLogo: 36,
  fixo: true,
  ctaTexto: "Inscreva-se",
  ctaUrl: `#${idsPorChave.eventos ? ancora("eventos") : ""}`,
  itens: [
    { label: "Quem somos",    ancora: ancora("sobre"),        url: "" },
    { label: "Programação",   ancora: ancora("programacao"),  url: "" },
    { label: "Eventos",       ancora: ancora("eventos"),      url: "" },
    { label: "Galeria",       ancora: ancora("galeria"),      url: "" },
    { label: "Loja",          ancora: ancora("loja"),         url: "" },
    { label: "Dúvidas",       ancora: ancora("faq"),          url: "" },
  ],
};

const { error: erroMenu } = await sb.from("department_site_blocks").insert({
  site_id: site.id,
  campo_id: site.campo_id,
  tipo: "menu",
  variante: "cta",
  ordem: 0,
  props: propsMenu,
  props_publicado: propsMenu,
  visivel: true,
});
if (erroMenu) { console.error(`  ✘ ${erroMenu.message}`); process.exit(1); }
console.log(`  ✔ menu com ${propsMenu.itens.length} links`);

// ── Publicação ───────────────────────────────────────────────────────────────

if (PUBLICAR) {
  console.log("\n4. Publicando");
  const { error } = await sb
    .from("department_sites")
    .update({ status: "PUBLICADO", published_at: new Date().toISOString() })
    .eq("id", site.id);
  if (error) { console.error(`  ✘ ${error.message}`); process.exit(1); }
  console.log("  ✔ no ar");
} else {
  console.log("\n4. Mantida como RASCUNHO (use --publicar para colocar no ar)");
}

console.log(`\n✔ ${blocos.length + 1} blocos criados.`);
console.log(`   Editor : /app-ui/cms/sites/${site.id}/builder`);
console.log(`   Página : /${site.slug}${PUBLICAR ? "" : "  (só depois de publicar)"}`);
