Criar o módulo completo “Peniel” no sistema.

1. SITE / HOME
Adicionar um novo ícone na Home, junto dos ícones existentes, chamado “Peniel”.
Ao clicar, abrir a página pública do Peniel.

2. PÁGINA PÚBLICA PENIEL
A página deve seguir o visual verde profundo da identidade Peniel, elegante e refinado.

Estrutura:
- Hero com carrossel no modelo de 3 cards pequenos, igual referência enviada.
- Imagem de fundo do hero editável pelo painel.
- Título, subtítulo, textos, cores e botões totalmente editáveis.
- Abaixo do hero: agenda dos próximos eventos Peniel.
- Cada evento deve ter botão “Fazer minha inscrição”.
- Abaixo da agenda: carrossel de vídeos de testemunhos.

3. INSCRIÇÃO
Ao clicar em “Fazer minha inscrição”, abrir formulário igual ao arquivo `image.png` dentro da pasta `docs/peniel`.

Campos devem seguir exatamente o modelo desse arquivo.

Ao enviar:
- Verificar se ainda há vaga.
- Se houver vaga, cadastrar inscrição.
- Abrir modal de sucesso com os dados da inscrição.
- Permitir baixar comprovante em PDF.
- Enviar automaticamente mensagem no WhatsApp do inscrito.
- Usar a instância WhatsApp já existente no sistema.

Se não houver vaga:
- Mostrar modal informando que as vagas acabaram.
- Perguntar se deseja entrar na fila ou escolher outra data disponível.

4. PAINEL ADMINISTRATIVO
Criar menu no sidebar chamado “Peniel”.

O painel deve seguir o padrão visual das telas da Secretaria, como a tela de Batismo.

Criar CRUD completo para:
- Página Peniel
- Hero
- Cores
- Botões
- Textos
- Carrossel do hero
- Agenda de eventos
- Vídeos de testemunhos
- Inscrições
- Fila de espera
- Configuração da instância WhatsApp

5. GESTÃO DE EVENTOS PENIEL
Ao cadastrar uma data/evento Peniel, o administrador deve informar:
- Título do evento
- Data
- Horário
- Local
- Valor
- Limite de participantes
- Status
- Descrição

O limite de participantes não aparece para o público, é apenas controle interno.

Na gestão, mostrar:
- Próximo Peniel em destaque
- Lista de datas futuras no lado direito
- Total de inscritos
- Quantidade de vagas disponíveis
- Fila de espera
- Valor arrecadado
- Status do evento

6. WHATSAPP
Na tela de gestão do Peniel, permitir escolher qual instância WhatsApp será usada para responder/enviar mensagens automáticas.

Não criar nova integração se já existe WhatsApp implantado.
Apenas reutilizar a estrutura atual do sistema.

7. RESPONSIVIDADE
Todas as telas devem ser responsivas:
- Desktop
- Tablet
- Celular

O CRUD administrativo também deve funcionar bem no celular e tablet.

8. ARQUIVOS DE REFERÊNCIA
Usar como referência:
- Imagem/modelo da página Peniel enviada
- Arquivo `docs/peniel/image.png` para o formulário
- Padrão visual das telas da Secretaria, especialmente Batismo