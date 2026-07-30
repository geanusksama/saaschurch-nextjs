# Central de Ajuda

Botão de interrogação na barra superior, à esquerda do Assistente de IA.
Disponível para **todos os perfis** — não tem chave de permissão.

Não confundir com o **Assistente de IA** (o botão verde): aquele consulta o banco,
analisa dados e é restrito ao perfil master. A Central de Ajuda explica como o sistema
funciona e não vê dado nenhum.

## Como está montado

```
src/lib/helpContent.ts        ← a documentação, em forma de dado (fonte única)
        │
        ├──► src/components/app-ui/HelpCenter.tsx   aba "Documentação" (navega + busca local)
        └──► src/app/api/help/ask/route.ts          aba "Perguntar à IA"
```

`helpContent.ts` exporta `HELP_SECTIONS` (seções → artigos com `title`, `keywords`,
`path` e `body` em markdown simples) e três utilidades: `searchHelp()`, `helpCorpus()`
e `findArticle()`.

**Documentação nova entra nesse arquivo, e só nele.** As duas abas leem a mesma fonte;
não existe segundo lugar para atualizar.

## A aba de IA

`POST /api/help/ask` recebe `{ question, history }` e usa `generateAiText()` de
`src/lib/aiReplyService.ts` — o mesmo caminho do agente do WhatsApp, então respeita o
provedor (OpenAI/Anthropic) e a chave configurados em *Configurações de IA*.

O prompt manda: responder **só** com a documentação, não inventar nome de botão ou de
tela, e dizer quando a resposta não está lá. A documentação inteira cabe no contexto, e
os artigos mais relevantes vão destacados no topo — isso evita o caso em que a busca erra
o artigo e a IA responde "não sei" tendo a resposta em mãos.

A resposta volta com `sources`: os artigos usados viram atalhos clicáveis no painel.

Sem chave de IA configurada a rota devolve **503** com uma mensagem que orienta usar a
busca — a aba Documentação continua funcionando sem rede.

## Markdown suportado

O renderizador em `HelpCenter.tsx` é mínimo de propósito (uma biblioteca inteira seria
peso morto): `##`, `###`, listas com `- `, `**negrito**` e `` `código` ``. Se um artigo
precisar de mais que isso, o artigo é que está grande demais.

## Ao escrever um artigo

- Escreva para quem **opera** o sistema, não para quem programa.
- Nada de nome de tabela, arquivo ou rota de API.
- Caminho de menu no formato `Menu → Submenu`.
- Preencha `keywords` com os sinônimos e os nomes antigos — é o que a busca usa.
- Preencha `path` quando o artigo explica uma tela: o painel ganha o botão "Abrir a tela".
- Vale muito a pena incluir a seção "o que costuma dar errado": é a pergunta que a pessoa
  realmente faria.
