# MRM Design System

Sistema de design completo e escalável para a plataforma MRM SaaS.

## 📁 Estrutura

```
design-system/
├── tokens.ts              # Design tokens (cores, espaçamento, tipografia)
├── components/            # Componentes reutilizáveis
│   ├── Button.tsx        # Botões com variantes
│   ├── Input.tsx         # Inputs de formulário
│   ├── Select.tsx        # Componente de seleção
│   ├── Table.tsx         # Tabelas de dados
│   ├── Card.tsx          # Cards diversos
│   ├── Modal.tsx         # Modais e dialogs
│   └── Badge.tsx         # Badges de status
└── index.ts              # Exportações centralizadas
```

## 🎨 Design Tokens

### Cores
- **Primary**: Purple (#8b5cf6) - Ações principais
- **Secondary**: Blue (#3b82f6) - Ações secundárias
- **Accent**: Green, Orange - Destaques
- **Semantic**: Success, Warning, Error - Estados

### Espaçamento
- xs: 4px
- sm: 8px
- md: 12px
- lg: 16px
- xl: 24px
- 2xl: 32px
- 3xl: 48px

### Border Radius
- small: 6px
- medium: 8px
- large: 12px
- xl: 16px

### Tipografia
- Heading: 24px / 700
- Subheading: 18px / 600
- Body: 14px / 400
- Caption: 12px / 400
- Label: 14px / 500

## 🧩 Componentes

### Button
Botões com múltiplas variantes e tamanhos.

**Variantes:**
- `primary` - Ação principal
- `secondary` - Ação secundária
- `outline` - Botão com borda
- `danger` - Ações destrutivas
- `ghost` - Botão transparente

**Tamanhos:**
- `small` - Botão pequeno
- `medium` - Tamanho padrão
- `large` - Botão grande

**Propriedades:**
```tsx
<Button 
  variant="primary" 
  size="medium"
  loading={false}
  disabled={false}
  icon={<Icon />}
  fullWidth={false}
>
  Clique aqui
</Button>
```

### Input
Inputs de formulário padronizados.

**Tipos:**
- `Input` - Input de texto padrão
- `EmailInput` - Input de email
- `PhoneInput` - Input de telefone
- `PasswordInput` - Input de senha com toggle
- `SearchInput` - Input de busca com ícone

**Propriedades:**
```tsx
<Input
  label="Nome"
  placeholder="Digite..."
  error="Mensagem de erro"
  helperText="Texto de ajuda"
  icon={<Icon />}
  disabled={false}
/>
```

### Select
Componente de seleção com busca e multi-select.

**Propriedades:**
```tsx
<Select
  label="Escolha"
  options={[
    { value: '1', label: 'Opção 1' },
    { value: '2', label: 'Opção 2' }
  ]}
  value={selectedValue}
  onChange={(val) => setSelectedValue(val)}
  multiple={false}
  searchable={false}
  disabled={false}
/>
```

### Table
Tabelas de dados com ordenação e paginação.

**Variantes:**
- `default` - Tabela padrão
- `compact` - Tabela compacta
- `financial` - Tabela financeira (font mono)

**Propriedades:**
```tsx
<Table
  columns={[
    { key: 'name', header: 'Nome', sortable: true },
    { key: 'email', header: 'Email' }
  ]}
  data={tableData}
  variant="default"
  onRowClick={(row) => {}}
  pagination={{
    page: 1,
    pageSize: 10,
    total: 100,
    onPageChange: (page) => {}
  }}
/>
```

### Card
Cards para diferentes contextos.

**Tipos:**
- `Card` - Card básico
- `DashboardCard` - Card de dashboard com métricas
- `MemberCard` - Card de membro
- `LeadCard` - Card de lead CRM
- `EventCard` - Card de evento
- `FinancialSummaryCard` - Card financeiro

**Exemplos:**
```tsx
<DashboardCard
  title="Total de Membros"
  value="1,234"
  icon={<Users />}
  change={{ value: 12, isPositive: true }}
/>

<MemberCard
  name="João Silva"
  role="Pastor"
  email="joao@igreja.com"
  status="active"
/>
```

### Modal
Modais para diferentes interações.

**Tipos:**
- `Modal` - Modal básico
- `FormModal` - Modal com formulário
- `ConfirmationModal` - Modal de confirmação

**Exemplos:**
```tsx
<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Título"
  size="medium"
>
  Conteúdo do modal
</Modal>

<ConfirmationModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  onConfirm={handleConfirm}
  title="Confirmar?"
  message="Tem certeza?"
  variant="danger"
/>
```

### Badge
Badges de status e categorias.

**Variantes:**
- `active` - Verde
- `pending` - Laranja
- `inactive` - Cinza
- `completed` - Azul
- `cancelled` - Vermelho
- `success` - Verde
- `error` - Vermelho
- `warning` - Laranja
- `info` - Azul

**Tamanhos:**
- `small`
- `medium`
- `large`

**Exemplos:**
```tsx
<Badge variant="active" size="medium">
  Ativo
</Badge>

<StatusBadge status="pending" />
```

## 💡 Uso

### Importação Individual
```tsx
import { Button } from '../design-system/components/Button';
import { Input } from '../design-system/components/Input';
```

### Importação Central
```tsx
import { Button, Input, Card } from '../design-system';
```

### Usando Tokens
```tsx
import { colors, spacing, borderRadius } from '../design-system/tokens';

// Usando em componentes
<div style={{ 
  backgroundColor: colors.primary[500],
  padding: spacing.lg,
  borderRadius: borderRadius.medium 
}} />
```

## 🎯 Princípios

1. **Consistência** - Todos os componentes seguem o mesmo padrão visual
2. **Reutilização** - Componentes são altamente reutilizáveis
3. **Acessibilidade** - Focus states e keyboard navigation
4. **Responsividade** - Funciona em todos os tamanhos de tela
5. **Escalabilidade** - Fácil adicionar novos componentes

## 🚀 Próximos Passos

- [ ] Kanban Board Component
- [ ] Sidebar Component
- [ ] Topbar Component
- [ ] Chart Components (Line, Bar, Pie)
- [ ] Form Layout Components
- [ ] Toast Notifications
- [ ] Tooltip Component
- [ ] Avatar Component
- [ ] File Upload Component
- [ ] Date Picker Component

## 📖 Documentação Completa

Acesse `/design-system` na aplicação para ver todos os componentes em ação com exemplos interativos.
