# Home Pública Configurável — PRD

## 1. Problema

A home pública (`PublicHome.tsx`) foi escrita para **uma** igreja. Hoje estão
cravados no código:

| O que | Onde está cravado |
| --- | --- |
| Logo do cabeçalho e marca d'água | `<img src="/adcampinas.png">` (2 ocorrências) |
| Título da aba e ícone do navegador | `src/app/layout.tsx` (`metadata.title`, `icons`) |
| Nome/ícones do app instalado (PWA) | `public/manifest.webmanifest` (estático) |
| "Nossa missão é / REINAR" + parágrafo | JSX |
| Referência e texto do versículo | JSX + modal |
| Cor de fundo claro/escuro (`#0a0a0a` / `#f5f4f0`) | constante `bg` |
| Os 8 cartões de ícone | JSX, um a um |
| Link do YouTube, Instagram, rádio, Google Maps | `href` no JSX |
| Endereço e telefone da sede | texto no JSX |
| Dias de culto (4 linhas) | texto no JSX |
| Lista de serviços da secretaria (FAB) | constante `FAB_OPTIONS` |

O sistema é um código só rodando contra **um banco Supabase por igreja**
(`scripts/migrate-self.mjs`). Cada igreja que entra no SaaS precisa hoje de um
fork visual — o que não escala.

## 2. Objetivo

Uma tela de configuração no painel (`Sistema → Home Pública`) onde a igreja sede
personaliza **tudo o que a home mostra**, gravando no banco daquele projeto. A
home passa a ler essa configuração; o comportamento (Peniel, Sou Membro, GF,
PWA, serviços da secretaria, contabilidade oculta) continua idêntico.

## 3. Usuários

| Perfil | O que faz |
| --- | --- |
| Administrador do campo (`master`, `admin`, `campo`) | Edita e publica a home |
| Demais perfis | Não veem a tela (permissão `settings_home_publica`) |
| Visitante | Vê a home já personalizada, sem login |

## 4. Escopo — o que passa a ser configurável

### 4.1 Identidade (aba do navegador e app)
- Nome do site (título da aba) e descrição
- Favicon (ícone da aba)
- Logo do cabeçalho
- Imagem de marca d'água do fundo (a logo gigante translúcida)
- Nome curto e nome completo do PWA, ícones 192/512/maskable, `theme_color`

### 4.2 Hero
- Sobre-título ("Nossa missão é")
- Título ("REINAR")
- Parágrafo da missão
- Referência do versículo ("João 3:16"), rótulo do botão ("Leia") e o texto do
  versículo que abre no modal
- Mostrar/ocultar o bloco do versículo

### 4.3 Aparência
- Cor de fundo no tema escuro e no tema claro
- Cor de destaque (hoje o dourado `#d4af37`)
- Ligar/desligar os símbolos bíblicos flutuantes e escolher a paleta deles
- Ligar/desligar os holofotes e cometas do tema escuro
- Opacidade da marca d'água
- Tema inicial (escuro ou claro)

### 4.4 Cartões de ícone (o coração do pedido)
Cada cartão vira uma **linha de banco**, com:
- ordem, visível/oculto
- título e subtítulo (aceita quebra de linha)
- ícone (catálogo lucide + a pomba do Peniel) e cor do ícone/anel
- comportamento: ação interna (`membro`, `peniel`, `gf`, `pwa`, `maps`,
  `agenda`, `verse`) ou link externo com URL
- destaques: pulsar (como o "Sou Membro" verde), bolinha "ao vivo", ocupar as
  duas colunas

Assim a igreja **oculta** o que não usa (rádio própria, Peniel), **edita** o
endereço do YouTube/Instagram/Maps e **cria** cartões novos (ex.: "Dízimo
online", "Spotify", "Podcast").

Duas exceções, deliberadas:

- **"Instalar o app" é padrão da plataforma**: não pode ser apagado nem
  ocultado, e o texto é do próprio componente — ele já muda entre Android e
  iPhone e some sozinho quando o app está instalado. Escondê-lo só tiraria o
  atalho de quem quer instalar.
- **"Sou Membro", "Peniel" e "Grupos Familiares"** podem ser ocultados, mas não
  apagados: são portas do sistema.

### 4.5 Sede, contato e dias de culto — sem duplicar

Endereço, telefone, WhatsApp, redes sociais e a programação de culto **já são
cadastrados** em Sistema → Informações da Igreja. A home passa a ler de lá;
esta tela mostra só em leitura, com atalho para editar no lugar certo.

Consequência prática: o cartão do Instagram guarda um apelido
(`sede:instagram`) em vez da URL. A igreja troca o Instagram num lugar só e a
home acompanha.

### 4.6 Serviços da secretaria (botão flutuante)
- Ligar/desligar o botão, editar o título do modal
- Mostrar/ocultar e renomear cada uma das 16 opções de atendimento
- A gravação continua indo para o mesmo pipeline pastoral — só a vitrine muda

## 5. Fora de escopo (agora)

- Editor visual arrastando blocos (a ordem é por setas ↑↓)
- Páginas públicas internas (Peniel, GF, timeline pastoral) — já têm config
  própria ou ficam para uma segunda rodada
- Textos de WhatsApp que citam "AD Campinas" nas rotas de API
- Múltiplas home no mesmo banco (uma por campo é o suficiente)

## 6. Regras inegociáveis

1. **Nada quebra sem configuração.** Banco vazio ⇒ a home renderiza exatamente
   o que renderiza hoje. Os defaults do código são o conteúdo atual da AD
   Campinas, e a primeira visita à tela de configuração grava esse conteúdo
   real no banco — nada de formulário em branco nem de dado inventado.
2. **Sem piscar.** A home já monta com os defaults e troca quando a resposta
   chega; nunca mostra tela vazia.
3. **Peniel, Sou Membro, GF, instalar app, contabilidade (7 toques) e o FAB
   continuam funcionando** — a configuração muda rótulo, ícone, ordem e
   visibilidade, nunca o fluxo.
4. **Leitura pública sem autenticação**; escrita só para administrador.
5. **Migração aditiva** — tabelas novas, nenhuma coluna existente alterada.

## 7. Critérios de aceite

- [ ] Trocar a logo no painel troca a logo da home, o favicon e o ícone do app
- [ ] Trocar o título troca o texto da aba do navegador
- [ ] Ocultar o cartão "102,9" some com ele da home
- [ ] Trocar a URL do Instagram muda o destino do cartão
- [ ] Editar dias de culto e endereço em Informações da Igreja reflete na home
- [ ] O cartão "Instalar o app" não tem como ser ocultado nem apagado
- [ ] Criar um cartão novo com ícone e link funciona
- [ ] Ocultar 3 serviços do FAB remove só eles; os demais continuam abrindo o
      formulário certo
- [ ] Com a tabela vazia a home é pixel a pixel a de hoje
