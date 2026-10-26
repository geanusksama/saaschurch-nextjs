# Engajamento — presença pelas fotos do Instagram da igreja

Decidido com o dono em 26/10/2026. Pedido original em `../../../engajamento.md`
(fora do repositório).

## 1. O que faz

A igreja posta as fotos dos cultos no Instagram. O sistema:

1. entra na conta da igreja pelo **login oficial do Instagram**;
2. traz as fotos das publicações dos últimos 6 meses (botão **Iniciar**);
3. **reconhece os rostos** nas fotos e agrupa a mesma pessoa em todas elas;
4. a equipe dá o **nome** de cada pessoa uma vez (ou liga ao membro do cadastro);
5. o **Relatório** compara quem aparecia nas fotos dos domingos dos 3 meses
   anteriores com quem aparece nos **últimos 3 domingos** — planilha Excel e
   impressão com foto.

Menu lateral **Engajamento**: Relatório, Pessoas, Fotos, Instagram. Nasce só
para o master (`permissionCatalog.ts`); os demais só com liberação na matriz.

## 2. Decisões

| # | Decisão | Por quê |
|---|---|---|
| D1 | Só a API oficial do Instagram (login do Instagram, `instagram_business_basic`). | Raspagem quebra os termos do Instagram e derruba a conta. |
| D2 | Só conta **profissional** (Comercial/Criador). | O Instagram desligou a API de contas pessoais em 04/12/2024. |
| D3 | Quem está na foto vem do **reconhecimento de rosto** (decisão do dono) + marcação à mão para corrigir. | A API não informa quem aparece na foto. |
| D4 | O reconhecimento roda no **navegador** de quem clica em Iniciar (`@vladmandic/face-api` 1.7.15 do jsDelivr, carregada na hora). O servidor só recebe o vetor de 128 números e o recorte. | Nada pesado na função da Vercel; nada novo no `package.json`. |
| D5 | Agrupamento por distância euclidiana ao **centroide** da pessoa, corte **0,5** (a face-api usa 0,6). | Separar a mesma pessoa em duas se corrige com "É a mesma que…"; misturar duas faria o relatório errar. |
| D6 | Presença conta **cultos** (dias distintos com foto), não fotos. "Só domingos" filtra pelo dia da semana da data do culto. | A mesma pessoa aparece em várias fotos do mesmo culto. |
| D7 | Resultado é **indicador** para a equipe conferir. | Não aparecer em foto não prova que a pessoa faltou. |
| D8 | Presença Facial (face_presencas) **não** entra. | O dono pediu só as fotos do Instagram. |
| D9 | Igreja/congregação **não** é filtro. | As fotos são da conta da igreja; o dono pediu sem igreja. |

## 3. LGPD

Rosto é dado biométrico e, junto com presença em culto, revela convicção
religiosa (art. 11). Por isso:

- `engajamento_pessoas` e `engajamento_rostos` têm RLS ligado e nenhuma
  política: só o servidor lê. O token do Instagram fica criptografado
  (AES-256-GCM, `src/lib/engajamento/cripto.ts`).
- Pessoas → **Apagar rostos** apaga vetores, pessoas e os recortes no storage
  do campo inteiro (`DELETE /api/engajamento/rostos`).
- A base legal / consentimento dos membros é responsabilidade da igreja; a tela
  do Instagram avisa.

## 4. Banco

Migrations `20261026120000_engajamento` e `20261027090000_engajamento_rostos`
(aditivas).

| Tabela | Guarda |
|---|---|
| `engajamento_instagram` | conta conectada por campo (token criptografado, validade, última busca) |
| `engajamento_publicacoes` | publicação do Instagram (ou álbum enviado à mão): data do culto, legenda, link, cópia das fotos no storage (`dados/engajamento/<campo>/`), `rostos_analisados_em` |
| `engajamento_pessoas` | pessoa achada nas fotos: nome ou `member_id`, centroide, foto de capa, `oculta` |
| `engajamento_rostos` | cada rosto em cada foto: vetor, caixa, recorte, pessoa |
| `engajamento_marcacoes` | marcação à mão (membro ou nome livre) |

A cópia das fotos no storage existe porque a URL da CDN do Instagram expira.

## 5. Rotas (`src/app/api/engajamento/`)

| Rota | Chave |
|---|---|
| `GET/POST/DELETE instagram` — situação, concluir login (`code`), desconectar | `engajamento_instagram.view` / `.instagram.conectar` / `.instagram.desconectar` |
| `POST instagram/sincronizar` — 15 publicações novas por chamada | `engajamento_instagram.instagram.sincronizar` |
| `GET rostos/pendentes`, `POST rostos` | `engajamento_instagram.instagram.sincronizar` |
| `DELETE rostos` (tudo) / `DELETE rostos/[id]` (um) | `engajamento_pessoas.pessoas.apagar_rostos` / `.tirar_rosto` |
| `GET pessoas`, `GET/PATCH pessoas/[id]`, `POST pessoas/[id]/juntar` | `engajamento_pessoas.view` / `.nomear` / `.ocultar` / `.juntar` |
| `GET comparativo`, `GET comparativo/historico` | `engajamento.view` |
| `publicacoes`, `publicacoes/[id]`, `.../marcacoes` | `engajamento_fotos.*` |

Todas filtram pelo **campo ativo** (master inclusive).

## 6. Configuração (uma vez por domínio)

1. developers.facebook.com → criar app (tipo Empresa) → produto **Instagram**
   ("API com login do Instagram").
2. Endereço de volta: `https://<domínio>/app-ui/engajamento/instagram`.
3. Funções do app → Testadores do Instagram → adicionar a conta da igreja e
   aceitar no Instagram (dispensa a revisão da Meta para a própria conta).
4. Variáveis no projeto da Vercel: `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`
   (opcional `ENGAJAMENTO_ENCRYPTION_KEY`).

## 7. Verificado e não verificado (26/10/2026)

- `scripts/e2e-engajamento.mjs`: 16 ok — agrupamento, relatório por domingos,
  juntar pessoas, isolamento de campo (vetores sintéticos).
- **Não verificado**: login e sincronização contra uma conta real do Instagram
  (o app da Meta ainda não existe); a detecção de rostos no navegador com fotos
  reais de culto (qualidade depende do tamanho dos rostos na foto — abaixo de
  40 px o rosto é descartado).
