# Sistema WhatsApp do SaaS Church

Este diretório reúne a documentação técnica do módulo de WhatsApp do projeto, baseada no código atual da aplicação.

## Objetivo

Documentar como o sistema funciona, quais rotas de API são usadas, quais tabelas sustentam o fluxo, quais arquivos participam do processo e quais regras de negócio são críticas para manutenção segura.

## Visão Geral

- Stack principal: Next.js App Router, TypeScript, Supabase e Z-API.
- O módulo recebe mensagens pelo webhook da Z-API.
- O envio de mensagens sai por rotas internas protegidas por autenticação.
- Instâncias, conversas, mensagens, permissões e rate limit ficam no Supabase.
- A UI de inbox usa hooks React e Supabase Realtime para atualizar conversas e mensagens.

## Arquivos Centrais

- [src/lib/whatsappSendService.ts](../../src/lib/whatsappSendService.ts)
- [src/types/whatsapp.ts](../../src/types/whatsapp.ts)
- [src/app/api/whatsapp/webhook/route.ts](../../src/app/api/whatsapp/webhook/route.ts)
- [src/app/api/whatsapp/send/route.ts](../../src/app/api/whatsapp/send/route.ts)
- [src/app/api/whatsapp/upload/route.ts](../../src/app/api/whatsapp/upload/route.ts)
- [src/app/api/whatsapp/instances/route.ts](../../src/app/api/whatsapp/instances/route.ts)
- [src/app/api/whatsapp/instances/[id]/route.ts](../../src/app/api/whatsapp/instances/%5Bid%5D/route.ts)
- [src/app/api/whatsapp/instances/[id]/users/route.ts](../../src/app/api/whatsapp/instances/%5Bid%5D/users/route.ts)
- [src/app/api/whatsapp/conversations/route.ts](../../src/app/api/whatsapp/conversations/route.ts)
- [src/app/api/whatsapp/conversations/[id]/route.ts](../../src/app/api/whatsapp/conversations/%5Bid%5D/route.ts)
- [src/app/api/whatsapp/messages/route.ts](../../src/app/api/whatsapp/messages/route.ts)
- [src/app/api/whatsapp/messages/[id]/route.ts](../../src/app/api/whatsapp/messages/%5Bid%5D/route.ts)
- [src/components/app-ui-screens/communication/WhatsAppInbox.tsx](../../src/components/app-ui-screens/communication/WhatsAppInbox.tsx)
- [src/components/app-ui-screens/communication/WhatsAppInstances.tsx](../../src/components/app-ui-screens/communication/WhatsAppInstances.tsx)
- [supabase/migrations/20260606_whatsapp_module.sql](../../supabase/migrations/20260606_whatsapp_module.sql)

## Índice

1. [Arquitetura](./01-arquitetura.md)
2. [APIs e endpoints](./02-apis-e-endpoints.md)
3. [Banco de dados](./03-banco-de-dados.md)
4. [Configuração e regras](./04-configuracao-e-regras.md)
5. [Fluxos principais](./05-fluxos-principais.md)
6. [Sumário para outra IA](./SUMARIO.md)

## Resumo Executivo

O módulo funciona como uma camada de integração entre WhatsApp e o sistema interno. Ele recebe mensagens via webhook da Z-API, salva o histórico no banco, exibe conversas na interface administrativa e envia respostas usando a mesma instância configurada. A autorização é baseada em usuário e instância: usuários `master` têm leitura global em algumas rotas, proprietários gerenciam suas próprias instâncias, e usuários autorizados podem visualizar instâncias compartilhadas pela tabela `whatsapp_instance_users`.
