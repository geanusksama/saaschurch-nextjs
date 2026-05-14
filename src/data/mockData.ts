// Mock Data para o Sistema MRM
// Dados realistas em português brasileiro

export const churches = [
  { id: 1, name: 'Sede Principal', city: 'São Paulo', state: 'SP', regional: 'Regional SP Capital' },
  { id: 2, name: 'Campus Norte', city: 'Guarulhos', state: 'SP', regional: 'Regional SP Capital' },
  { id: 3, name: 'Campus Sul', city: 'Santo André', state: 'SP', regional: 'Regional SP Capital' },
  { id: 4, name: 'Campus Oeste', city: 'Osasco', state: 'SP', regional: 'Regional SP Capital' },
  { id: 5, name: 'Sede Campinas', city: 'Campinas', state: 'SP', regional: 'Regional SP Interior' },
];

export const members = [
  { id: 1, name: 'Ana Paula Silva', phone: '(11) 98765-4321', email: 'ana.silva@email.com', church: 'Sede Principal', status: 'Ativo', joinDate: '2020-03-15', birthDate: '1988-05-20', cpf: '123.456.789-00', address: 'Rua das Flores, 123', neighborhood: 'Jardim Paulista', city: 'São Paulo', state: 'SP', zip: '01310-100', photo: 'AS' },
  { id: 2, name: 'Carlos Eduardo Santos', phone: '(11) 97654-3210', email: 'carlos.santos@email.com', church: 'Sede Principal', status: 'Ativo', joinDate: '2019-07-22', birthDate: '1985-11-15', cpf: '234.567.890-11', address: 'Av. Paulista, 1000', neighborhood: 'Bela Vista', city: 'São Paulo', state: 'SP', zip: '01310-100', photo: 'CS' },
  { id: 3, name: 'Mariana Costa Oliveira', phone: '(11) 96543-2109', email: 'mariana.oliveira@email.com', church: 'Campus Norte', status: 'Ativo', joinDate: '2021-01-10', birthDate: '1992-03-08', cpf: '345.678.901-22', address: 'Rua dos Comerciários, 456', neighborhood: 'Centro', city: 'Guarulhos', state: 'SP', zip: '07010-020', photo: 'MO' },
  { id: 4, name: 'Rafael Souza Lima', phone: '(11) 95432-1098', email: 'rafael.lima@email.com', church: 'Sede Principal', status: 'Ativo', joinDate: '2018-05-30', birthDate: '1990-09-25', cpf: '456.789.012-33', address: 'Rua Augusta, 789', neighborhood: 'Consolação', city: 'São Paulo', state: 'SP', zip: '01305-000', photo: 'RL' },
  { id: 5, name: 'Juliana Ferreira Rocha', phone: '(11) 94321-0987', email: 'juliana.rocha@email.com', church: 'Campus Sul', status: 'Ativo', joinDate: '2022-02-14', birthDate: '1995-07-12', cpf: '567.890.123-44', address: 'Av. Industrial, 321', neighborhood: 'Centro', city: 'Santo André', state: 'SP', zip: '09015-000', photo: 'JR' },
  { id: 6, name: 'Pedro Henrique Alves', phone: '(11) 93210-9876', email: 'pedro.alves@email.com', church: 'Sede Principal', status: 'Ativo', joinDate: '2017-11-05', birthDate: '1987-01-30', cpf: '678.901.234-55', address: 'Rua Oscar Freire, 654', neighborhood: 'Jardins', city: 'São Paulo', state: 'SP', zip: '01426-000', photo: 'PA' },
  { id: 7, name: 'Beatriz Martins Pereira', phone: '(11) 92109-8765', email: 'beatriz.pereira@email.com', church: 'Campus Norte', status: 'Ativo', joinDate: '2020-08-18', birthDate: '1993-04-22', cpf: '789.012.345-66', address: 'Rua do Rosário, 147', neighborhood: 'Macedo', city: 'Guarulhos', state: 'SP', zip: '07111-000', photo: 'BP' },
  { id: 8, name: 'Lucas Gabriel Nascimento', phone: '(11) 91098-7654', email: 'lucas.nascimento@email.com', church: 'Sede Principal', status: 'Ativo', joinDate: '2021-06-25', birthDate: '1998-12-05', cpf: '890.123.456-77', address: 'Rua Haddock Lobo, 258', neighborhood: 'Cerqueira César', city: 'São Paulo', state: 'SP', zip: '01414-000', photo: 'LN' },
  { id: 9, name: 'Camila Rodrigues Silva', phone: '(11) 90987-6543', email: 'camila.silva@email.com', church: 'Campus Oeste', status: 'Ativo', joinDate: '2019-03-12', birthDate: '1991-08-18', cpf: '901.234.567-88', address: 'Av. dos Autonomistas, 789', neighborhood: 'Centro', city: 'Osasco', state: 'SP', zip: '06010-000', photo: 'CS' },
  { id: 10, name: 'Gabriel Henrique Costa', phone: '(11) 89876-5432', email: 'gabriel.costa@email.com', church: 'Sede Principal', status: 'Ativo', joinDate: '2022-09-07', birthDate: '1996-06-14', cpf: '012.345.678-99', address: 'Rua da Consolação, 963', neighborhood: 'Consolação', city: 'São Paulo', state: 'SP', zip: '01301-000', photo: 'GC' },
  { id: 11, name: 'Fernanda Almeida Santos', phone: '(11) 88765-4321', email: 'fernanda.santos@email.com', church: 'Campus Norte', status: 'Ativo', joinDate: '2018-12-20', birthDate: '1989-02-28', cpf: '123.456.789-10', address: 'Rua Tiradentes, 456', neighborhood: 'Centro', city: 'Guarulhos', state: 'SP', zip: '07012-000', photo: 'FS' },
  { id: 12, name: 'Thiago Oliveira Lima', phone: '(11) 87654-3210', email: 'thiago.lima@email.com', church: 'Sede Principal', status: 'Ativo', joinDate: '2020-04-15', birthDate: '1994-10-10', cpf: '234.567.890-21', address: 'Av. Rebouças, 1234', neighborhood: 'Pinheiros', city: 'São Paulo', state: 'SP', zip: '05402-000', photo: 'TL' },
  { id: 13, name: 'Amanda Carolina Souza', phone: '(11) 86543-2109', email: 'amanda.souza@email.com', church: 'Campus Sul', status: 'Inativo', joinDate: '2021-07-08', birthDate: '1997-03-17', cpf: '345.678.901-32', address: 'Rua das Nações, 852', neighborhood: 'Jardim', city: 'Santo André', state: 'SP', zip: '09020-000', photo: 'AS' },
  { id: 14, name: 'Felipe Augusto Rocha', phone: '(11) 85432-1098', email: 'felipe.rocha@email.com', church: 'Sede Principal', status: 'Ativo', joinDate: '2019-10-22', birthDate: '1986-11-29', cpf: '456.789.012-43', address: 'Rua Estados Unidos, 741', neighborhood: 'Jardim América', city: 'São Paulo', state: 'SP', zip: '01427-000', photo: 'FR' },
  { id: 15, name: 'Larissa Beatriz Ferreira', phone: '(11) 84321-0987', email: 'larissa.ferreira@email.com', church: 'Campus Oeste', status: 'Ativo', joinDate: '2022-01-30', birthDate: '1999-05-23', cpf: '567.890.123-54', address: 'Rua Antonio Agu, 369', neighborhood: 'Centro', city: 'Osasco', state: 'SP', zip: '06013-000', photo: 'LF' },
  { id: 16, name: 'João Victor Mendes', phone: '(19) 98765-1234', email: 'joao.mendes@email.com', church: 'Sede Campinas', status: 'Ativo', joinDate: '2020-11-12', birthDate: '1992-07-19', cpf: '678.901.234-65', address: 'Av. Norte-Sul, 1500', neighborhood: 'Centro', city: 'Campinas', state: 'SP', zip: '13010-000', photo: 'JM' },
  { id: 17, name: 'Isabela Cristina Dias', phone: '(11) 97531-8642', email: 'isabela.dias@email.com', church: 'Sede Principal', status: 'Ativo', joinDate: '2021-05-17', birthDate: '1993-09-08', cpf: '789.012.345-76', address: 'Rua Frei Caneca, 852', neighborhood: 'Consolação', city: 'São Paulo', state: 'SP', zip: '01307-000', photo: 'ID' },
  { id: 18, name: 'Renato Augusto Silva', phone: '(11) 96420-7531', email: 'renato.silva@email.com', church: 'Campus Norte', status: 'Ativo', joinDate: '2018-09-25', birthDate: '1988-12-14', cpf: '890.123.456-87', address: 'Rua São João, 963', neighborhood: 'Centro', city: 'Guarulhos', state: 'SP', zip: '07013-000', photo: 'RS' },
  { id: 19, name: 'Patrícia Helena Costa', phone: '(11) 95309-6420', email: 'patricia.costa@email.com', church: 'Campus Sul', status: 'Ativo', joinDate: '2022-03-08', birthDate: '1995-04-26', cpf: '901.234.567-98', address: 'Av. Dom Pedro II, 456', neighborhood: 'Centro', city: 'Santo André', state: 'SP', zip: '09016-000', photo: 'PC' },
  { id: 20, name: 'Diego Fernando Alves', phone: '(11) 94198-5309', email: 'diego.alves@email.com', church: 'Sede Principal', status: 'Ativo', joinDate: '2019-12-03', birthDate: '1991-01-07', cpf: '012.345.678-09', address: 'Rua Bela Cintra, 741', neighborhood: 'Consolação', city: 'São Paulo', state: 'SP', zip: '01415-000', photo: 'DA' },
];

export const crmLeads = [
  { id: 1, name: 'Roberto Carlos Mendes', phone: '(11) 99999-1111', email: 'roberto.mendes@email.com', source: 'Site', stage: 'Visitante', responsible: 'Ana Paula Silva', lastContact: '2024-03-14', score: 85, notes: 'Interessado em batismo', church: 'Sede Principal' },
  { id: 2, name: 'Silvia Regina Souza', phone: '(11) 99999-2222', email: 'silvia.souza@email.com', source: 'Indicação', stage: 'Visitante', responsible: 'Carlos Eduardo Santos', lastContact: '2024-03-13', score: 72, notes: 'Veio pelo convite da irmã Mariana', church: 'Sede Principal' },
  { id: 3, name: 'Marcos Paulo Oliveira', phone: '(11) 99999-3333', email: 'marcos.oliveira@email.com', source: 'WhatsApp', stage: 'Em Acompanhamento', responsible: 'Ana Paula Silva', lastContact: '2024-03-15', score: 90, notes: 'Participa da célula há 2 meses', church: 'Campus Norte' },
  { id: 4, name: 'Vanessa Cristina Lima', phone: '(11) 99999-4444', email: 'vanessa.lima@email.com', source: 'Evento CIBE', stage: 'Em Acompanhamento', responsible: 'Rafael Souza Lima', lastContact: '2024-03-12', score: 78, notes: 'Interessada em ministério de louvor', church: 'Sede Principal' },
  { id: 5, name: 'André Luiz Santos', phone: '(11) 99999-5555', email: 'andre.santos@email.com', source: 'Facebook', stage: 'Consolidado', responsible: 'Juliana Ferreira Rocha', lastContact: '2024-03-10', score: 95, notes: 'Pronto para batismo', church: 'Campus Sul' },
  { id: 6, name: 'Daniela Ferreira Costa', phone: '(11) 99999-6666', email: 'daniela.costa@email.com', source: 'Instagram', stage: 'Visitante', responsible: 'Pedro Henrique Alves', lastContact: '2024-03-14', score: 65, notes: 'Primeira visita neste domingo', church: 'Sede Principal' },
  { id: 7, name: 'Rodrigo Almeida Rocha', phone: '(11) 99999-7777', email: 'rodrigo.rocha@email.com', source: 'Indicação', stage: 'Em Acompanhamento', responsible: 'Beatriz Martins Pereira', lastContact: '2024-03-11', score: 82, notes: 'Frequenta cultos há 1 mês', church: 'Campus Norte' },
  { id: 8, name: 'Aline Patricia Silva', phone: '(11) 99999-8888', email: 'aline.silva@email.com', source: 'Site', stage: 'Consolidado', responsible: 'Lucas Gabriel Nascimento', lastContact: '2024-03-09', score: 88, notes: 'Quer servir no ministério infantil', church: 'Sede Principal' },
  { id: 9, name: 'Bruno Henrique Dias', phone: '(11) 99999-9999', email: 'bruno.dias@email.com', source: 'WhatsApp', stage: 'Visitante', responsible: 'Camila Rodrigues Silva', lastContact: '2024-03-15', score: 70, notes: 'Perguntou sobre célula próxima', church: 'Campus Oeste' },
  { id: 10, name: 'Letícia Maria Santos', phone: '(11) 99999-0000', email: 'leticia.santos@email.com', source: 'Culto Domingo', stage: 'Em Acompanhamento', responsible: 'Gabriel Henrique Costa', lastContact: '2024-03-13', score: 75, notes: 'Interessada em discipulado', church: 'Sede Principal' },
  { id: 11, name: 'Fábio José Pereira', phone: '(11) 98888-1111', email: 'fabio.pereira@email.com', source: 'Indicação', stage: 'Consolidado', responsible: 'Fernanda Almeida Santos', lastContact: '2024-03-08', score: 92, notes: 'Completou discipulado', church: 'Campus Norte' },
  { id: 12, name: 'Tatiana Souza Lima', phone: '(11) 98888-2222', email: 'tatiana.lima@email.com', source: 'Evento', stage: 'Visitante', responsible: 'Thiago Oliveira Lima', lastContact: '2024-03-14', score: 68, notes: 'Participou do retiro de jovens', church: 'Sede Principal' },
];

export const financialTransactions = [
  { id: 1, date: '2024-03-15', description: 'Dízimo - Ana Paula Silva', category: 'Dízimo', type: 'Receita', amount: 850.00, method: 'PIX', church: 'Sede Principal', status: 'Confirmado' },
  { id: 2, date: '2024-03-15', description: 'Oferta - Carlos Eduardo Santos', category: 'Oferta', type: 'Receita', amount: 200.00, method: 'Cartão', church: 'Sede Principal', status: 'Confirmado' },
  { id: 3, date: '2024-03-14', description: 'Conta de Luz - Março/2024', category: 'Infraestrutura', type: 'Despesa', amount: 3200.00, method: 'Boleto', church: 'Sede Principal', status: 'Pago' },
  { id: 4, date: '2024-03-14', description: 'Dízimo - Mariana Costa Oliveira', category: 'Dízimo', type: 'Receita', amount: 650.00, method: 'TED', church: 'Campus Norte', status: 'Confirmado' },
  { id: 5, date: '2024-03-14', description: 'Oferta Missionária', category: 'Missões', type: 'Receita', amount: 1500.00, method: 'Dinheiro', church: 'Sede Principal', status: 'Confirmado' },
  { id: 6, date: '2024-03-13', description: 'Material de Limpeza', category: 'Manutenção', type: 'Despesa', amount: 450.00, method: 'Cartão', church: 'Sede Principal', status: 'Pago' },
  { id: 7, date: '2024-03-13', description: 'Dízimo - Rafael Souza Lima', category: 'Dízimo', type: 'Receita', amount: 1200.00, method: 'PIX', church: 'Sede Principal', status: 'Confirmado' },
  { id: 8, date: '2024-03-12', description: 'Salário - Pastor Principal', category: 'Pessoal', type: 'Despesa', amount: 8500.00, method: 'TED', church: 'Sede Principal', status: 'Pago' },
  { id: 9, date: '2024-03-12', description: 'Oferta - Juliana Ferreira Rocha', category: 'Oferta', type: 'Receita', amount: 300.00, method: 'PIX', church: 'Campus Sul', status: 'Confirmado' },
  { id: 10, date: '2024-03-12', description: 'Compra Equipamento Som', category: 'Infraestrutura', type: 'Despesa', amount: 15000.00, method: 'Boleto', church: 'Sede Principal', status: 'Pendente' },
  { id: 11, date: '2024-03-11', description: 'Dízimo - Pedro Henrique Alves', category: 'Dízimo', type: 'Receita', amount: 950.00, method: 'PIX', church: 'Sede Principal', status: 'Confirmado' },
  { id: 12, date: '2024-03-11', description: 'Internet - Março/2024', category: 'Infraestrutura', type: 'Despesa', amount: 550.00, method: 'Débito Automático', church: 'Sede Principal', status: 'Pago' },
  { id: 13, date: '2024-03-10', description: 'Oferta Culto Domingo', category: 'Oferta', type: 'Receita', amount: 4200.00, method: 'Dinheiro', church: 'Sede Principal', status: 'Confirmado' },
  { id: 14, date: '2024-03-10', description: 'Água - Março/2024', category: 'Infraestrutura', type: 'Despesa', amount: 680.00, method: 'Boleto', church: 'Sede Principal', status: 'Pago' },
  { id: 15, date: '2024-03-09', description: 'Dízimo - Beatriz Martins Pereira', category: 'Dízimo', type: 'Receita', amount: 720.00, method: 'TED', church: 'Campus Norte', status: 'Confirmado' },
  { id: 16, date: '2024-03-08', description: 'Material Gráfico - Evento CIBE', category: 'Eventos', type: 'Despesa', amount: 2800.00, method: 'Cartão', church: 'Sede Principal', status: 'Pago' },
  { id: 17, date: '2024-03-08', description: 'Oferta Especial Missões', category: 'Missões', type: 'Receita', amount: 8500.00, method: 'Transferência', church: 'Sede Principal', status: 'Confirmado' },
  { id: 18, date: '2024-03-07', description: 'Dízimo - Lucas Gabriel Nascimento', category: 'Dízimo', type: 'Receita', amount: 580.00, method: 'PIX', church: 'Sede Principal', status: 'Confirmado' },
  { id: 19, date: '2024-03-07', description: 'Manutenção Ar Condicionado', category: 'Manutenção', type: 'Despesa', amount: 1200.00, method: 'Dinheiro', church: 'Sede Principal', status: 'Pago' },
  { id: 20, date: '2024-03-06', description: 'Dízimo - Camila Rodrigues Silva', category: 'Dízimo', type: 'Receita', amount: 890.00, method: 'PIX', church: 'Campus Oeste', status: 'Confirmado' },
];

export const events = [
  { id: 1, title: 'Congresso CIBE 2024', date: '2024-06-15', endDate: '2024-06-17', time: '19h', location: 'Sede Principal', category: 'Congresso', participants: 450, capacity: 800, price: 150.00, status: 'Confirmado', image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&h=600&fit=crop' },
  { id: 2, title: 'Retiro de Jovens', date: '2024-06-22', endDate: '2024-06-24', time: 'Dia todo', location: 'Sítio da Igreja', category: 'Retiro', participants: 95, capacity: 120, price: 280.00, status: 'Confirmado', image: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800&h=600&fit=crop' },
  { id: 3, title: 'Encontro de Casais', date: '2024-06-29', endDate: '2024-06-29', time: '14h', location: 'Campus Norte', category: 'Workshop', participants: 42, capacity: 80, price: 80.00, status: 'Confirmado', image: 'https://images.unsplash.com/photo-1529634806980-85c3dd6d0efc?w=800&h=600&fit=crop' },
  { id: 4, title: 'Acampamento Kids', date: '2024-07-06', endDate: '2024-07-08', time: 'Dia todo', location: 'Camping Águas Claras', category: 'Kids', participants: 85, capacity: 200, price: 320.00, status: 'Inscrições Abertas', image: 'https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=800&h=600&fit=crop' },
  { id: 5, title: 'Conferência de Líderes', date: '2024-07-13', endDate: '2024-07-13', time: '9h - 17h', location: 'Sede Principal', category: 'Conferência', participants: 128, capacity: 300, price: 0, status: 'Confirmado', image: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=800&h=600&fit=crop' },
  { id: 6, title: 'Show Gospel', date: '2024-07-20', endDate: '2024-07-20', time: '20h', location: 'Arena Gospel', category: 'Show', participants: 892, capacity: 1500, price: 60.00, status: 'Confirmado', image: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&h=600&fit=crop' },
  { id: 7, title: 'Culto de Domingo - Manhã', date: '2024-03-17', endDate: '2024-03-17', time: '9h', location: 'Sede Principal', category: 'Culto', participants: 485, capacity: 600, price: 0, status: 'Realizado', image: 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?w=800&h=600&fit=crop' },
  { id: 8, title: 'Culto de Domingo - Noite', date: '2024-03-17', endDate: '2024-03-17', time: '18h', location: 'Sede Principal', category: 'Culto', participants: 542, capacity: 600, price: 0, status: 'Realizado', image: 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?w=800&h=600&fit=crop' },
  { id: 9, title: 'Batismo Sede Principal', date: '2024-03-24', endDate: '2024-03-24', time: '18h', location: 'Sede Principal', category: 'Batismo', participants: 12, capacity: 15, price: 0, status: 'Confirmado', image: 'https://images.unsplash.com/photo-1519834785169-98be25ec3f84?w=800&h=600&fit=crop' },
  { id: 10, title: 'EBD - Escola Bíblica Dominical', date: '2024-03-24', endDate: '2024-03-24', time: '8h', location: 'Sede Principal', category: 'Ensino', participants: 145, capacity: 200, price: 0, status: 'Semanal', image: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&h=600&fit=crop' },
];

export const cells = [
  { id: 1, name: 'Célula Alfa', leader: 'João Silva', leaderPhone: '(11) 98765-4321', members: 12, location: 'Jardim Paulista', address: 'Rua das Flores, 123', day: 'Sexta', time: '20h', growth: '+3', church: 'Sede Principal', network: 'Rede 1' },
  { id: 2, name: 'Célula Beta', leader: 'Maria Santos', leaderPhone: '(11) 97654-3210', members: 8, location: 'Vila Mariana', address: 'Rua dos Pinheiros, 456', day: 'Quinta', time: '19h30', growth: '+1', church: 'Campus Norte', network: 'Rede 2' },
  { id: 3, name: 'Célula Ômega', leader: 'Pedro Costa', leaderPhone: '(11) 96543-2109', members: 15, location: 'Moema', address: 'Av. Ibirapuera, 789', day: 'Terça', time: '20h', growth: '+5', church: 'Sede Principal', network: 'Rede 1' },
  { id: 4, name: 'Célula Delta', leader: 'Ana Lima', leaderPhone: '(11) 95432-1098', members: 10, location: 'Pinheiros', address: 'Rua Teodoro Sampaio, 321', day: 'Quarta', time: '19h', growth: '+2', church: 'Campus Oeste', network: 'Rede 3' },
  { id: 5, name: 'Célula Gama', leader: 'Carlos Rocha', leaderPhone: '(11) 94321-0987', members: 14, location: 'Itaim Bibi', address: 'Rua Joaquim Floriano, 654', day: 'Sexta', time: '20h30', growth: '+4', church: 'Sede Principal', network: 'Rede 1' },
  { id: 6, name: 'Célula Sigma', leader: 'Fernanda Alves', leaderPhone: '(11) 93210-8765', members: 9, location: 'Santo André', address: 'Av. Industrial, 147', day: 'Quinta', time: '20h', growth: '+1', church: 'Campus Sul', network: 'Rede 4' },
  { id: 7, name: 'Célula Epsilon', leader: 'Rafael Mendes', leaderPhone: '(11) 92109-7654', members: 11, location: 'Guarulhos', address: 'Rua Tiradentes, 258', day: 'Terça', time: '19h30', growth: '+2', church: 'Campus Norte', network: 'Rede 2' },
  { id: 8, name: 'Célula Kappa', leader: 'Juliana Dias', leaderPhone: '(11) 91098-6543', members: 13, location: 'Consolação', address: 'Rua da Consolação, 369', day: 'Sexta', time: '20h', growth: '+3', church: 'Sede Principal', network: 'Rede 1' },
];

export const baptismRequests = [
  { id: 1, name: 'João Silva', age: 28, date: '2024-03-10', status: 'pending', pastor: 'Pr. Carlos Mendes', classes: 3, totalClasses: 4, phone: '(11) 98765-4321', email: 'joao.silva@email.com', church: 'Sede Principal', address: 'Rua das Acácias, 123', cell: 'Célula Alfa' },
  { id: 2, name: 'Maria Santos', age: 32, date: '2024-03-12', status: 'approved', pastor: 'Pra. Ana Costa', classes: 4, totalClasses: 4, phone: '(11) 97654-3210', email: 'maria.santos@email.com', church: 'Sede Principal', address: 'Av. Brasil, 456', cell: 'Célula Beta' },
  { id: 3, name: 'Pedro Costa', age: 45, date: '2024-03-08', status: 'in-review', pastor: 'Pr. Carlos Mendes', classes: 2, totalClasses: 4, phone: '(11) 96543-2109', email: 'pedro.costa@email.com', church: 'Campus Norte', address: 'Rua Central, 789', cell: 'Célula Epsilon' },
  { id: 4, name: 'Ana Lima', age: 25, date: '2024-03-15', status: 'pending', pastor: 'Pra. Ana Costa', classes: 1, totalClasses: 4, phone: '(11) 95432-1098', email: 'ana.lima@email.com', church: 'Sede Principal', address: 'Rua das Flores, 321', cell: 'Célula Gama' },
  { id: 5, name: 'Carlos Rocha', age: 38, date: '2024-03-14', status: 'completed', pastor: 'Pr. Carlos Mendes', classes: 4, totalClasses: 4, phone: '(11) 94321-0987', email: 'carlos.rocha@email.com', church: 'Sede Principal', address: 'Av. Paulista, 654', cell: 'Célula Alfa', baptismDate: '2024-03-17' },
  { id: 6, name: 'Fernanda Alves', age: 29, date: '2024-03-11', status: 'approved', pastor: 'Pra. Ana Costa', classes: 4, totalClasses: 4, phone: '(11) 93210-8765', email: 'fernanda.alves@email.com', church: 'Campus Sul', address: 'Rua do Comércio, 147', cell: 'Célula Sigma' },
  { id: 7, name: 'Rafael Mendes', age: 34, date: '2024-03-09', status: 'approved', pastor: 'Pr. Carlos Mendes', classes: 4, totalClasses: 4, phone: '(11) 92109-7654', email: 'rafael.mendes@email.com', church: 'Sede Principal', address: 'Rua Augusta, 258', cell: 'Célula Ômega' },
  { id: 8, name: 'Juliana Dias', age: 27, date: '2024-03-13', status: 'in-review', pastor: 'Pra. Ana Costa', classes: 3, totalClasses: 4, phone: '(11) 91098-6543', email: 'juliana.dias@email.com', church: 'Campus Norte', address: 'Av. Santos, 369', cell: 'Célula Epsilon' },
];

export const ministries = [
  { id: 1, name: 'Louvor e Adoração', icon: '🎵', description: 'Exaltando o nome do Senhor', leader: 'Ana Paula Silva', members: 45, volunteers: 38, active: true, church: 'Sede Principal', meetingDay: 'Sábado', meetingTime: '14h' },
  { id: 2, name: 'Infantil', icon: '👶', description: 'Ensinando as crianças', leader: 'Beatriz Martins', members: 120, volunteers: 85, active: true, church: 'Sede Principal', meetingDay: 'Domingo', meetingTime: '8h' },
  { id: 3, name: 'Jovens', icon: '🌟', description: 'Impactando a juventude', leader: 'Lucas Nascimento', members: 180, volunteers: 95, active: true, church: 'Sede Principal', meetingDay: 'Sexta', meetingTime: '20h' },
  { id: 4, name: 'Intercessão', icon: '🙏', description: 'Guerreiros em oração', leader: 'Fernanda Santos', members: 65, volunteers: 52, active: true, church: 'Sede Principal', meetingDay: 'Terça', meetingTime: '6h' },
  { id: 5, name: 'Comunicação', icon: '📢', description: 'Divulgando a palavra', leader: 'Thiago Lima', members: 38, volunteers: 28, active: true, church: 'Sede Principal', meetingDay: 'Quinta', meetingTime: '19h' },
  { id: 6, name: 'Ação Social', icon: '❤️', description: 'Servindo a comunidade', leader: 'Camila Silva', members: 52, volunteers: 42, active: true, church: 'Sede Principal', meetingDay: 'Sábado', meetingTime: '9h' },
  { id: 7, name: 'Recepção', icon: '🤝', description: 'Acolhendo com amor', leader: 'Gabriel Costa', members: 48, volunteers: 40, active: true, church: 'Sede Principal', meetingDay: 'Domingo', meetingTime: '8h' },
  { id: 8, name: 'Dança', icon: '💃', description: 'Dançando para o Senhor', leader: 'Juliana Rocha', members: 32, volunteers: 28, active: true, church: 'Sede Principal', meetingDay: 'Quarta', meetingTime: '19h30' },
];

export const pastoralVisits = [
  { id: 1, member: 'Roberto Mendes', pastor: 'Pr. Carlos Mendes', date: '2024-03-15', type: 'Acompanhamento', status: 'Realizada', notes: 'Família passando por momento de luto. Oramos juntos.', church: 'Sede Principal' },
  { id: 2, member: 'Silvia Souza', pastor: 'Pra. Ana Costa', date: '2024-03-16', type: 'Aconselhamento', status: 'Agendada', notes: 'Questões matrimoniais para conversar', church: 'Sede Principal' },
  { id: 3, member: 'Marcos Oliveira', pastor: 'Pr. Carlos Mendes', date: '2024-03-14', type: 'Hospital', status: 'Realizada', notes: 'Visitado no Hospital São Paulo. Cirurgia bem sucedida.', church: 'Campus Norte' },
  { id: 4, member: 'Vanessa Lima', pastor: 'Pra. Ana Costa', date: '2024-03-17', type: 'Discipulado', status: 'Agendada', notes: 'Iniciar discipulado para novos convertidos', church: 'Sede Principal' },
  { id: 5, member: 'André Santos', pastor: 'Pr. Carlos Mendes', date: '2024-03-13', type: 'Acompanhamento', status: 'Realizada', notes: 'Conversa sobre chamado ministerial', church: 'Campus Sul' },
];

export const prayerRequests = [
  { id: 1, requester: 'Ana Paula Silva', request: 'Oração pela saúde da minha mãe', date: '2024-03-15', status: 'Em Oração', priority: 'Alta', category: 'Saúde', church: 'Sede Principal', answered: false },
  { id: 2, requester: 'Carlos Santos', request: 'Direção de Deus para nova oportunidade de trabalho', date: '2024-03-14', status: 'Em Oração', priority: 'Média', category: 'Profissional', church: 'Sede Principal', answered: false },
  { id: 3, requester: 'Mariana Oliveira', request: 'Restauração do casamento', date: '2024-03-13', status: 'Respondida', priority: 'Alta', category: 'Família', church: 'Campus Norte', answered: true, answeredDate: '2024-03-15', testimony: 'Deus restaurou meu casamento! Glória a Ele!' },
  { id: 4, requester: 'Rafael Lima', request: 'Sabedoria para decisões importantes', date: '2024-03-12', status: 'Em Oração', priority: 'Média', category: 'Direção', church: 'Sede Principal', answered: false },
  { id: 5, requester: 'Juliana Rocha', request: 'Cura para ansiedade e depressão', date: '2024-03-11', status: 'Em Oração', priority: 'Alta', category: 'Saúde', church: 'Campus Sul', answered: false },
];

export const checkIns = [
  { id: 1, name: 'João Silva', type: 'Membro', time: '08:45', service: 'Culto da Manhã', date: '2024-03-17', church: 'Sede Principal' },
  { id: 2, name: 'Maria Santos', type: 'Visitante', time: '08:47', service: 'Culto da Manhã', date: '2024-03-17', church: 'Sede Principal', firstTime: true },
  { id: 3, name: 'Pedro Costa', type: 'Membro', time: '08:48', service: 'Culto da Manhã', date: '2024-03-17', church: 'Sede Principal' },
  { id: 4, name: 'Ana Lima', type: 'Kids', time: '08:50', service: 'Culto da Manhã', date: '2024-03-17', church: 'Sede Principal', parent: 'Carlos Lima' },
  { id: 5, name: 'Carlos Rocha', type: 'Membro', time: '08:52', service: 'Culto da Manhã', date: '2024-03-17', church: 'Sede Principal' },
];

export const whatsappConversations = [
  { id: 1, name: 'João Silva', lastMessage: 'Muito obrigado pelo retorno!', time: '10:30', unread: 0, status: 'read', avatar: 'JS', phone: '(11) 98765-4321' },
  { id: 2, name: 'Maria Santos', lastMessage: 'Qual o horário do culto de domingo?', time: '09:15', unread: 2, status: 'delivered', avatar: 'MS', phone: '(11) 97654-3210' },
  { id: 3, name: 'Pedro Costa', lastMessage: 'Posso participar da célula?', time: 'Ontem', unread: 1, status: 'sent', avatar: 'PC', phone: '(11) 96543-2109' },
  { id: 4, name: 'Ana Lima', lastMessage: 'Obrigada pela oração 🙏', time: 'Ontem', unread: 0, status: 'read', avatar: 'AL', phone: '(11) 95432-1098' },
  { id: 5, name: 'Carlos Rocha', lastMessage: 'Vou participar do evento!', time: '15/03', unread: 0, status: 'read', avatar: 'CR', phone: '(11) 94321-0987' },
];

export const emailCampaigns = [
  { id: 1, name: 'Convite CIBE 2024', status: 'sent', sent: 1248, opened: 892, clicked: 456, date: '2024-03-10', subject: 'Você está convidado para o CIBE 2024!', template: 'Event Invitation' },
  { id: 2, name: 'Boletim Semanal - Março', status: 'draft', sent: 0, opened: 0, clicked: 0, date: '2024-03-15', subject: 'Novidades da semana', template: 'Newsletter' },
  { id: 3, name: 'Lembrete Retiro de Jovens', status: 'scheduled', sent: 0, opened: 0, clicked: 0, date: '2024-03-20', subject: 'Faltam 30 dias para o Retiro!', template: 'Reminder' },
  { id: 4, name: 'Boas Vindas Novos Membros', status: 'sent', sent: 45, opened: 38, clicked: 22, date: '2024-03-08', subject: 'Bem-vindo à família!', template: 'Welcome' },
  { id: 5, name: 'Chamado Voluntários Ação Social', status: 'sent', sent: 856, opened: 645, clicked: 178, date: '2024-03-05', subject: 'Seja um voluntário!', template: 'Volunteer Call' },
];

export const automations = [
  { id: 1, name: 'Boas-vindas Novos Visitantes', trigger: 'Novo visitante cadastrado', actions: 3, status: 'Ativo', executions: 24, lastRun: '2024-03-15 10:30', church: 'Todas' },
  { id: 2, name: 'Lembrete Aniversário Membro', trigger: 'Aniversário do membro', actions: 2, status: 'Ativo', executions: 12, lastRun: '2024-03-15 08:00', church: 'Todas' },
  { id: 3, name: 'Follow-up Visitante 3 Dias', trigger: '3 dias após primeira visita', actions: 4, status: 'Ativo', executions: 8, lastRun: '2024-03-14 09:00', church: 'Sede Principal' },
  { id: 4, name: 'Confirmação Pagamento Dízimo', trigger: 'Pagamento confirmado', actions: 1, status: 'Ativo', executions: 156, lastRun: '2024-03-15 11:45', church: 'Todas' },
  { id: 5, name: 'Lembrete Célula Semanal', trigger: 'Segunda-feira às 18h', actions: 2, status: 'Pausado', executions: 0, lastRun: 'Nunca', church: 'Sede Principal' },
];
