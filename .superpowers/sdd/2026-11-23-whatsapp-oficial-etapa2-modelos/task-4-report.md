# Task 4 - Central Meta Oficial (relatório)

## Entregue
- `src/app-ui/system/MetaOficial.tsx`: central com abas (?aba=) visao-geral (padrão), conexao, modelos (EmBreve), envio, conversas, leads (EmBreve), app (só master). `role=tablist/tab/tabpanel`, setas/Home/End, rolagem horizontal em tela estreita. Aba modelos só com `whatsapp_oficial.modelos.view`.
- `metaOficial/VisaoGeral.tsx`: cartões Conexão, Modelos, Liberação, Próximos passos (CheckCircle2/Circle), atalhos externos (WhatsApp Manager, Pagamentos da Meta). Três fetches independentes (mesmo helper `cabecalhos` das telas); falha de um não derruba os outros.
- `metaOficial/EmBreve.tsx`.
- `WhatsAppOficial.tsx` e `MetaAppConfig.tsx`: prop `embutido` (só esconde o cabeçalho); lógica intocada. Em WhatsAppOficial foram exportados `Qualidade`, `LIMITES`, `QUALIDADES` (reuso na Visão geral).
- Rotas: `system/meta-oficial`; `system/whatsapp-oficial` e `system/meta-app` viram `<Navigate>` para `?aba=conexao` / `?aba=app`.
- Menu: um item "Meta Oficial" (permKey whatsapp_oficial) no lugar dos dois; nome amigável no breadcrumb. Cartão `meta-oficial` em Comunicação (SystemSettings).

## Permissões
As 3 chaves nascem por `definirPermissao` em MetaOficial.tsx (mesmo mecanismo das demais; o catálogo de módulos não recebe sub-chaves, elas vêm de `arvore.generated.ts`): `whatsapp_oficial.modelos.view` (herda `whatsapp_oficial.view`), `.criar` e `.excluir` (herdam `.modelos.view`). `npm run permissoes:arvore` gerou +18 linhas.

Prova (podeChave com src/lib/permissoes/resolver.ts, a mesma usada por exigirPermissao em servidor.ts), fora de grupo, sem sobrescritas:
- church e field: `whatsapp_oficial.view`, `modelos.view`, `modelos.criar`, `modelos.excluir` => false (seguem o pai).
- chave inexistente `whatsapp_oficial.inexistente.x` => true (confirma que o caminho "fora da árvore" ainda libera, e que as 3 não caem mais nele).
- em grupo sem marcação: `modelos.view` => false.

## Checagens
permissoes:arvore/check ok (740 componentes; auditoria 0 pendentes); `node --test scripts/teste-meta-whatsapp.mjs` 85/85; tsc dos arquivos tocados sem erros neles (erros pré-existentes em AppDashboard e SecretariatPipeline, não tocados); eslint 42 problemas antes e depois (arquivos novos limpos); curl /app-ui/system/meta-oficial => 200. Navegador não conferido (controlador).

## Preocupações
- O item de menu "Meta – App oficial" (permKey meta_app) saiu; a aba App exige apenas profileType master (o catálogo meta_app já é só master).
- Para validar o eslint "antes" usei `git stash`/`pop` rapidamente com o next dev rodando; nada se perdeu, mas pode ter causado recompilação momentânea.
- Os links de atalhos da Meta (Manager e Pagamentos) são URLs genéricas do business.facebook.com sem business_id; o controlador pode querer ajustá-los.

## Rodada de correção 1
Achado: usuário com whatsapp_oficial.view sem modelos.view recebia 403 em /modelos e a Visão geral mostrava "Não foi possível carregar" e passos de modelos que levavam a uma aba oculta.
Correção: MetaOficial passa `podeModelos` à VisaoGeral; sem a permissão, /modelos não é buscado e o cartão Modelos e os 2 passos de modelos são omitidos (grade passa a 2 colunas). Se vier 403 mesmo assim, o pedido vira estado `sem-permissao` (não erro) com o mesmo efeito. Botão "Abrir": `type="button"` e `focus-visible:ring`.
Checagens: permissoes:check ok, eslint limpo, tsc sem erros nos arquivos tocados, node --test 85/85, curl 200.
