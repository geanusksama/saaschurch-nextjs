# Guia de estilo Silas CRM no saaschurch (02/11/2026)

Fonte: `FRONTBACK/guia-style/Redesign SLS CRM interface (5)/entrega/`
(PROMPT - Guia de Estilo, PROMPT - Responsivo Mobile First, Componentes, Home v6).

**Regra:** só aparência. Nenhuma lógica, rota, estado ou campo foi alterado.

## Decisões do dono

- **Cor primária:** o Branding da igreja (Configurações → Branding) continua
  mandando. O violeta `#6d4aff` (secundária verde-água `#14a3b8`) passou a ser
  o padrão. O cinza anterior (`#475569`/`#94a3b8`) entrou em
  `LEGACY_DEFAULT_THEMES` (`src/lib/themeSettings.ts`) e no script inline de
  `src/app/layout.tsx`. Quem estava nele só herdou o padrão e por isso migra
  sozinho, mas qualquer outra cor salva fica como está.
- **Escopo:** aplicar em todas as telas de uma vez.

## Como foi feito

- `src/app/design-guide.css` define os tokens `--sl-*` (claro e `.dark`),
  escopados em `.app-shell` e `body:has(.app-shell)`. Home pública e login não
  mudam.
- As telas usam classes do Tailwind v4, que leem `var(--color-*)`. No escopo do
  sistema, a paleta é **remapeada**: `slate-*` → neutros do guia (escala própria
  para o claro e o escuro), `purple/violet/indigo-*` → cor primária do Branding.
  Com isso as 180+ telas mudam sem ninguém editar o TSX delas.
- Componentes shadcn (`data-slot`): botões em pílula, campos com raio 12 e foco
  na primária com halo, abas em pílula, modais com raio 22, menus com raio 16,
  tooltip escuro, cabeçalho de tabela em 12/600 na cor secundária.
- Fundo da área logada: gradiente pastel do guia (escuro: gradiente noturno).
- A sidebar e o header (`src/components/app-ui/AppUI.tsx`) mudaram só nas
  classes: vidro, itens em pílula, ícone em círculo e item ativo na primária.

## Menu inferior do celular (< 640px)

`src/components/app-ui/MobileBottomNav.tsx`. Ordem decidida pelo dono:
**App, Secretaria, Tesouraria, Perfil**.
- App → `/app-ui` (mesmo destino do item "Apps" da sidebar).
- Secretaria / Tesouraria (seção "Finanças") → bottom sheet com as telas da
  seção, tiradas de `visibleNavigation` (a mesma lista já filtrada por
  permissão que a sidebar usa). A aba some se a pessoa não vê nenhuma tela.
- Perfil → abre a gaveta "Minha Conta" que já existia (`setMobileDrawerOpen`).
- O `<main>` ganhou um respiro embaixo só no celular, para o menu não cobrir
  o conteúdo.

## Sidebar escura

Roxo profundo `#1e1730` só no tema escuro (decisão do dono); no claro a
sidebar fica no vidro claro do guia. A classe
`sl-sidebar` no elemento da sidebar redefine os tokens `--sl-*` só ali dentro
(`design-guide.css`, fim do arquivo).

## Pipeline da Secretaria em pastas

`src/app-ui/ecclesiastical/PipelinePastas.tsx`. A tela abre numa grade de pastas
(uma por tipo de atividade/stage, como antes) no lugar das abas do topo. Clicar
faz o mesmo `setStageId` das abas e mostra o kanban com os filtros; o botão
"Pastas" volta. Cada pasta mostra um resumo (total no período, pendentes e
total por etapa). O resumo vem da rota existente `/kan/stages/{id}/board`, só
leitura e com os filtros de período/campo/igreja da tela. Etapas com nome de
finalizado/concluído/cancelado/arquivado/aprovado/reprovado/deferido não
contam como pendência.

## Sidebar: ordem, módulos fixados e pin (02/11/2026)

- Módulos e telas aparecem em ordem alfabética **só na exibição**. As listas
  originais não são reordenadas, porque `firstAllowedPath` usa a ordem delas.
- Grupo **Fixados** no topo: `src/lib/pinnedSections.ts` (localStorage
  `mrm_pinned_nav_sections`). Sem nada salvo, vêm Secretaria e Finanças; a
  pessoa desafixa pelo pin.
- A estrela de favoritar telas virou pin (só o ícone; `favorites.ts` igual).

## Banco / Santander fora do menu (02/11/2026)

A pedido do dono, o item tem `hiddenFromMenu: true` em `appNavigation`: some da
sidebar, da tela de Apps, do menu inferior e da lista de atalhos. O item **não
foi apagado**, de propósito: `isCurrentPathAllowed` procura a rota nessa lista.
Sem o item, a tela ficaria liberada pelo link direto para quem não tem
`santander_view`. A tela continua acessível pelo link para quem tem a permissão.

## Home pública no celular (02/11/2026)

Referência: `guia-style/adcampinas-mobile-first` (tela Main), mantendo as cores
do tema da home (escuro refinado / claro). Só abaixo de 768 px e no modo
clássico; desktop e modo animado sem mudança. Em `PublicHome.tsx`:
- header fixo com logo, "Bem-vindo à {siteTitle}", tema e **Entrar**
  (`/auth/login`, o mesmo link do ícone de usuário), incluindo o gatilho
  invisível da contabilidade;
- cartão da missão (eyebrow, título, texto, versículo);
- Acesso rápido: **Sou Membro** (abre o login do membro, como o card) e
  **Sou Visitante**, que abre o mesmo cadastro da opção "Quero ser Membro" do
  botão de atendimento e some se esse serviço estiver oculto;
- Rádio em largura total (o play abre o mesmo destino do card), Ciclo da fé e
  demais cards de `home_cards` em cartões neutros, com o mesmo toque da grade
  de ícones;
- tab bar: Início · Eventos · Atendimento (abre o mesmo menu do botão flutuante)
  · Loja · Perfil (`/auth/login`). O menu Eventos/Compras/Peniel/CIBE continua
  logo abaixo do header, porque Peniel e CIBE só existem nele.

## Ainda não feito (exige lógica ou decisão)

- Abas centralizadas no header e o menu ⋯ com plano/limites: são
  funcionalidades novas e não existem no sistema.
- Strings HTML de impressão/relatórios (hex fixo) não foram tocadas.

## Decisões de 02/11/2026 (tarde)

- **Tab bar do celular**: Módulos · Membros · Criar (+) · Lançamento · Gestão de Culto. Início e Avisos ficam no header. Some nas telas de formulário (rotas `/new`, `/edit`, `-new`, `-edit`): `escondeTabBar()` em `MobileBottomNav.tsx`.
- **Criar rápido**: padrão Tesouraria (Lançamento, Livro Caixa, Conta a pagar), Secretaria (Novo membro, Batismo, Transferência, Consagração), Igreja (Gestão de Culto, Novo evento). "Personalizar" deixa cada pessoa tirar/pôr atalhos entre as telas que ela já vê no menu; fica no navegador (`mrm_criar_rapido_atalhos`).
- **Início no celular**: sem o carrossel "Módulos" e sem o botão de QR na busca.
- **Cartões de totais** das consultas (Membros, Batismo, Consagração, Transferência, Requerimentos, Quero ser Membro, Credencial, Aniversariantes, Igrejas): `CartoesTotais.tsx`, quebram linha (sem rolagem lateral) e recolhem/expandem; escolha guardada no navegador.
- **Gestão de Culto**: cabeçalho numa faixa só; hora e tipo foram para a gaveta "Filtros" (continuam filtrando na hora). Posições do Culto: busca na mesma linha do caminho.
- **Livro Caixa no celular**: botão "Filtros" (igreja, período, Buscar lançamento numa gaveta) + Consultar. Relatórios só pelo ícone do topo. Totais/Gráficos aparecem depois de consultar.
- **Lançamento no celular**: rótulos idênticos aos do computador; barra "Lançar" colada no rodapé.
- **Lançar culto**: "Total do culto" e "Presentes" só exibem a soma do que foi digitado.
- **Campo embutido em caixa arredondada**: sem contorno quadrado; o anel de foco vai na caixa (`design-guide.css`).
- **DateRangePicker no celular**: preso ao rodapé, com rolagem interna.
