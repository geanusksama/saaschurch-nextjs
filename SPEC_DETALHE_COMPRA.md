# Spec: Tela de Detalhe da Compra (Minhas Compras → Detalhe)
> Gerado em 2026-05-19  
> **Para:** agente responsável pela implementação Flutter  
> **Arquivo principal:** `lib/main.dart` (~22 mil linhas, app inteiro em arquivo único)

---

## 1. O que precisa ser feito

Ao clicar em qualquer card na tela **Minhas Compras** (`_OrderCard`), o app deve navegar para uma nova tela de detalhe do pedido (`_OrderDetailScreen`) exibindo:

1. **Dados do pedido** — número, status, total, método de pagamento, data
2. **Dados do evento** — nome, data, local, banner, categoria
3. **Participantes do evento** (cantores, pregadores) — de `event_participants`
4. **Ingressos / assentos comprados** — de `event_order_items` + `event_seats` + `event_rows` + `event_sectors`
5. **QR Codes** dos ingressos — de `event_qrcodes`
6. **Ações disponíveis** — Cancelar, Reembolso, Transferir (conforme já existem no card)

---

## 2. Contexto do código atual

### 2.1 Onde está o card atual
- **Classe:** `_OrderCard` — linha ~19200 de `lib/main.dart`
- O card **não tem onTap** hoje — apenas os botões internos têm ação
- A tela pai é `MinhasComprasScreen` (linha ~19110)

### 2.2 Modelo atual `_OrderSummary` (linha ~15573)
```dart
class _OrderSummary {
  final String id;               // UUID do pedido (event_orders.id)
  final String numeroPedido;     // PED-20260519...
  final String eventoId;         // UUID do evento
  final String eventoNome;
  final String eventoEmoji;
  final double total;
  final String status;
  final String paymentMethod;
  final DateTime createdAt;
  final DateTime? eventoData;
}
```

### 2.3 Serviço de dados
- **Classe:** `_EvService` (singleton: `_EvService.i`)
- Método de listagem existente: `loadMyOrdersV2(userId)` — linha ~16755
- Query atual:
```dart
db.from('event_orders')
  .select('*, app_events(nome, data_inicio, icon_emoji)')
  .eq('user_id', userId)
  .order('created_at', ascending: false)
```

---

## 3. Tabelas e dados necessários para o detalhe

### Query do detalhe (1 chamada ao Supabase)
```dart
// Buscar pedido completo com itens, assentos e participantes
final row = await db.from('event_orders')
  .select('''
    id, numero_pedido, order_number, status, total, valor_total,
    payment_method, created_at, buyer_name, buyer_email, buyer_phone,
    app_events(
      id, nome, descricao, data_inicio, data_fim, local,
      local_endereco, imagem_url, banner_url, icon_emoji, categoria,
      event_participants(id, nome, papel, foto_url, ordem)
    ),
    event_order_items(
      id, qty, unit_price, subtotal, status, sector_nome, row_nome, seat_numero,
      event_seats(
        id, numero, status,
        event_rows(nome),
        event_sectors(nome, cor_hex)
      )
    )
  ''')
  .eq('id', orderId)
  .single();
```

> **Nota:** Os campos `sector_nome`, `row_nome`, `seat_numero` já existem em `event_order_items` como desnormalização (ver linha ~16400 do main.dart onde são gravados). Use esses campos como fallback caso o join de `event_seats` não retorne dados.

### Query dos QR Codes (chamada separada)
```dart
// Mesma query usada em MeusIngressosScreen (linha ~16490)
final tickets = await db.from('event_qrcodes')
  .select('*, event_order_items(sector_nome, row_nome, seat_numero)')
  .eq('order_id', orderId)
  .order('created_at');
```

---

## 4. Novo modelo de detalhe

Criar as classes abaixo **próximo a `_OrderSummary`** (linha ~15613):

```dart
class _OrderItemDetail {
  final String id;
  final int qty;
  final double unitPrice;
  final double subtotal;
  final String status;          // 'ATIVO' | 'CANCELADO'
  // Assento
  final String? sectorNome;
  final String? sectorCor;      // hex ex: '#8b5cf6'
  final String? rowNome;        // 'A', 'B', 'C'
  final int? seatNumero;        // 3

  String get seatLabel {
    if (rowNome != null && seatNumero != null) {
      return '${sectorNome != null ? "$sectorNome – " : ""}Fileira $rowNome, Cadeira $seatNumero';
    }
    if (sectorNome != null) return sectorNome!;
    return 'Ingresso avulso';
  }
}

class _OrderDetail extends _OrderSummary {
  // Estende _OrderSummary e adiciona:
  final String? buyerName;
  final String? buyerEmail;
  final String? buyerPhone;
  // Evento
  final String? eventoDescricao;
  final String? eventoLocal;
  final String? eventoLocalEndereco;
  final String? eventoImagemUrl;
  final DateTime? eventoFim;
  // Itens
  final List<_OrderItemDetail> items;
  // Participantes
  final List<_EvParticipant> participants;  // já existe no código: linha ~15925
  // QR Codes (carregados separadamente)
  List<_EvTicket> tickets;   // já existe: classe _EvTicket linha ~15495
}
```

---

## 5. Método a adicionar em `_EvService`

Adicionar após `loadMyOrdersV2` (linha ~16768):

```dart
Future<_OrderDetail?> loadOrderDetail(String orderId) async {
  final db = _db;
  if (db == null) return null;
  try {
    final row = await db.from('event_orders')
        .select('id, numero_pedido, order_number, status, total, valor_total, payment_method, created_at, buyer_name, buyer_email, buyer_phone, app_events(id, nome, descricao, data_inicio, data_fim, local, local_endereco, imagem_url, banner_url, icon_emoji, categoria, event_participants(id, nome, papel, foto_url, ordem)), event_order_items(id, qty, unit_price, subtotal, status, sector_nome, row_nome, seat_numero, event_seats(id, numero, status, event_rows(nome), event_sectors(nome, cor_hex)))')
        .eq('id', orderId)
        .single();

    final ticketRows = await db.from('event_qrcodes')
        .select('*, event_order_items(sector_nome, row_nome, seat_numero)')
        .eq('order_id', orderId)
        .order('created_at');

    return _OrderDetail.fromJson(
      Map<String, dynamic>.from(row as Map),
      tickets: (ticketRows as List).map((t) =>
          _EvTicket.fromJson(Map<String, dynamic>.from(t as Map))).toList(),
    );
  } catch (e) {
    debugPrint('loadOrderDetail error: $e');
    return null;
  }
}
```

---

## 6. Mudança no `_OrderCard` (linha ~19200)

Envolver o `Container` raiz com `InkWell` (ou `GestureDetector`):

```dart
// ANTES: return Container(...)
// DEPOIS:
return InkWell(
  borderRadius: BorderRadius.circular(16),
  onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
    builder: (_) => _OrderDetailScreen(
      orderId: order.id,
      orderSummary: order,
      sessionController: sessionController,
      onChanged: onChanged,
    ),
  )),
  child: Container(...),   // container existente inalterado
);
```

---

## 7. Nova tela `_OrderDetailScreen`

Adicionar após a classe `_OrderCard`. Layout sugerido:

```
AppBar: "Detalhes do Pedido"  ← botão voltar

── Banner do evento (imagem_url) ──────────────────
   Emoji + Nome do evento
   📅 Data início  |  📍 Local

── Participantes (scroll horizontal) ──────────────
   [Foto] Nome     [Foto] Nome    [Foto] Nome
   Papel           Papel          Papel
   (só mostrar se event_participants não vazio)

── Ingressos comprados ─────────────────────────────
   Para cada event_order_item:
   ┌─────────────────────────────────┐
   │ 🎟  Setor VIP – Fileira A, Cad 3│
   │     Unitário: R$ 150,00          │
   │     Status: ATIVO  [badge]       │
   └─────────────────────────────────┘

── Resumo financeiro ───────────────────────────────
   Subtotal:        R$ 150,00
   Desconto:        R$ 0,00
   Total:           R$ 150,00
   Pagamento:       PIX
   Nº Pedido:       PED-20260519...
   Data:            19 Mai 2026

── Dados do comprador ──────────────────────────────
   Nome: Iglise222 Da Costa Lopes
   E-mail: xxx@gmail.com
   Telefone: (11) 99999-9999

── Ações ───────────────────────────────────────────
   [Ver QR Codes / Ingressos]   (se PAGO)
   [Continuar pagando]          (se AGUARDANDO_PAGAMENTO)
   [Cancelar]  [Reembolso]  [Presentear]
```

### Estado da tela
```dart
class _OrderDetailState extends State<_OrderDetailScreen> {
  _OrderDetail? _detail;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final d = await _EvService.i.loadOrderDetail(widget.orderId);
    if (mounted) setState(() { _detail = d; _loading = false; });
  }
}
```

---

## 8. Mapa de tabelas → seções da tela

| Seção na tela | Tabela(s) | Campo(s) usado(s) |
|---|---|---|
| Banner/nome evento | `app_events` | `nome`, `imagem_url`, `icon_emoji`, `data_inicio`, `local` |
| Participantes | `event_participants` | `nome`, `papel`, `foto_url`, `ordem` |
| Ingressos/assentos | `event_order_items` | `sector_nome`, `row_nome`, `seat_numero`, `unit_price`, `status` |
| QR Codes | `event_qrcodes` | `ticket_code`, `is_used`, `is_cancelled` |
| Resumo financeiro | `event_orders` | `total`, `payment_method`, `numero_pedido`, `created_at` |
| Dados do comprador | `event_orders` | `buyer_name`, `buyer_email`, `buyer_phone` |

---

## 9. Padrões de UI do projeto (obrigatório seguir)

- **Header:** usar `_SubScreenHeader` (widget existente) ou `AppBar` padrão com `leading: BackButton()`
- **Cores dark/light:** sempre verificar `context.isDark`, usar `DP.*` para dark e `AppPalette.*` para light
- **Padding padrão:** `EdgeInsets.symmetric(horizontal: 20)`
- **Cards:** `Container` com `BorderRadius.circular(16)` e `Border.all(color: border)`
- **Badges de status:** copiar o padrão de `_OrderCard` (linha ~19242) — `statusColor` e `statusLabel` já existem em `_OrderSummary`
- **Loading state:** `Center(child: CircularProgressIndicator())` enquanto `_loading = true`
- **Fotos de participantes:** usar `Image.network(url, fit: BoxFit.cover)` com fallback de inicial (ver `_AvatarFallback` no projeto)
- **Sem Supabase:** se `!sessionController.bootstrap.configuredSupabase`, mostrar mensagem de serviço indisponível

---

## 10. Checklist de implementação

- [ ] Criar modelo `_OrderItemDetail` próximo a `_OrderSummary` (linha ~15613)
- [ ] Criar modelo `_OrderDetail` estendendo `_OrderSummary`
- [ ] Adicionar método `loadOrderDetail(orderId)` em `_EvService` após linha ~16768
- [ ] Envolver `_OrderCard` com `InkWell` com `onTap` abrindo `_OrderDetailScreen`
- [ ] Criar `_OrderDetailScreen` + `_OrderDetailState` após classe `_OrderCard` (~linha 19400)
- [ ] Seção participantes (scroll horizontal, só se não vazio)
- [ ] Seção ingressos/assentos (lista de cards)
- [ ] Seção resumo financeiro
- [ ] Seção dados do comprador
- [ ] Botões de ação (reutilizar lógica de `_OrderCard._cancel`, `_requestRefund`)
- [ ] Testar com pedido PAGO, CANCELADO e AGUARDANDO_PAGAMENTO
