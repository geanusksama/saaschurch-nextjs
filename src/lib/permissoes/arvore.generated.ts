/**
 * GERADO por scripts/gerar-arvore-permissoes.mjs — não edite à mão.
 * Rode `npm run permissoes:arvore` depois de marcar ou desmarcar um componente.
 */
import type { DefPermissao } from './definir';

export const COMPONENTES_PERMISSAO: DefPermissao[] = [
  {
    "chave": "asset_inventory.asset_inventory_list.iniciar_novo_inventario",
    "rotulo": "Iniciar novo inventário — Asset Inventory List",
    "herda": "asset_inventory.view",
    "arquivo": "src/app-ui/assets/AssetInventoryList.tsx"
  },
  {
    "chave": "asset_inventory.asset_inventory_report.imprimir",
    "rotulo": "Imprimir — Asset Inventory Report",
    "herda": "asset_inventory.view",
    "arquivo": "src/app-ui/assets/AssetInventoryReport.tsx"
  },
  {
    "chave": "asset_inventory.asset_inventory_scan.confirmar",
    "rotulo": "Confirmar — Asset Inventory Scan",
    "herda": "asset_inventory.view",
    "arquivo": "src/app-ui/assets/AssetInventoryScan.tsx"
  },
  {
    "chave": "assets.asset_detail_modal.editar",
    "rotulo": "Editar — Asset Detail Modal",
    "herda": "assets.view",
    "arquivo": "src/app-ui/assets/AssetDetailModal.tsx"
  },
  {
    "chave": "assets.asset_detail_modal.imprimir_etiqueta",
    "rotulo": "Imprimir etiqueta — Asset Detail Modal",
    "herda": "assets.view",
    "arquivo": "src/app-ui/assets/AssetDetailModal.tsx"
  },
  {
    "chave": "assets.asset_form_drawer.salvar",
    "rotulo": "Salvar — Asset Form Drawer",
    "herda": "assets.view",
    "arquivo": "src/app-ui/assets/AssetFormDrawer.tsx"
  },
  {
    "chave": "assets.asset_import_modal.baixar_modelo_de_planilha",
    "rotulo": "Baixar modelo de planilha — Asset Import Modal",
    "herda": "assets.view",
    "arquivo": "src/app-ui/assets/AssetImportModal.tsx"
  },
  {
    "chave": "assets.asset_import_modal.confirmar_e_importar",
    "rotulo": "Confirmar e importar — Asset Import Modal",
    "herda": "assets.view",
    "arquivo": "src/app-ui/assets/AssetImportModal.tsx"
  },
  {
    "chave": "assets.asset_label_print_modal.imprimir_etiquetas",
    "rotulo": "Imprimir etiquetas — Asset Label Print Modal",
    "herda": "assets.view",
    "arquivo": "src/app-ui/assets/AssetLabelPrintModal.tsx"
  },
  {
    "chave": "assets.assets_list.editar",
    "rotulo": "Editar — Assets List",
    "herda": "assets.edit",
    "arquivo": "src/app-ui/assets/AssetsList.tsx"
  },
  {
    "chave": "assets.assets_list.excluir",
    "rotulo": "Excluir — Assets List",
    "herda": "assets.delete",
    "arquivo": "src/app-ui/assets/AssetsList.tsx"
  },
  {
    "chave": "assets.assets_list.importar_csv",
    "rotulo": "Importar CSV — Assets List",
    "herda": "assets.create",
    "arquivo": "src/app-ui/assets/AssetsList.tsx"
  },
  {
    "chave": "assets.assets_list.imprimir_etiquetas",
    "rotulo": "Imprimir Etiquetas — Assets List",
    "herda": "assets.view",
    "arquivo": "src/app-ui/assets/AssetsList.tsx"
  },
  {
    "chave": "assets.assets_list.novo_bem",
    "rotulo": "Novo Bem — Assets List",
    "herda": "assets.create",
    "arquivo": "src/app-ui/assets/AssetsList.tsx"
  },
  {
    "chave": "attendance.attendance_module.adicionar_dispositivo",
    "rotulo": "Adicionar Dispositivo — Attendance Module",
    "herda": "attendance.view",
    "arquivo": "src/components/app-ui/AttendanceModule.tsx"
  },
  {
    "chave": "attendance.attendance_module.csv",
    "rotulo": "CSV — Attendance Module",
    "herda": "attendance.view",
    "arquivo": "src/components/app-ui/AttendanceModule.tsx"
  },
  {
    "chave": "attendance.attendance_module.editar",
    "rotulo": "Editar — Attendance Module",
    "herda": "attendance.view",
    "arquivo": "src/components/app-ui/AttendanceModule.tsx"
  },
  {
    "chave": "attendance.attendance_module.enviar_mensagem_saudades",
    "rotulo": "Enviar Mensagem (Saudades) — Attendance Module",
    "herda": "attendance.view",
    "arquivo": "src/components/app-ui/AttendanceModule.tsx"
  },
  {
    "chave": "attendance.attendance_module.enviar_whatsapp",
    "rotulo": "Enviar WhatsApp — Attendance Module",
    "herda": "attendance.view",
    "arquivo": "src/components/app-ui/AttendanceModule.tsx"
  },
  {
    "chave": "attendance.attendance_module.excel",
    "rotulo": "Excel — Attendance Module",
    "herda": "attendance.view",
    "arquivo": "src/components/app-ui/AttendanceModule.tsx"
  },
  {
    "chave": "attendance.attendance_module.excluir",
    "rotulo": "Excluir — Attendance Module",
    "herda": "attendance.view",
    "arquivo": "src/components/app-ui/AttendanceModule.tsx"
  },
  {
    "chave": "attendance.attendance_module.excluir_registro",
    "rotulo": "Excluir registro — Attendance Module",
    "herda": "attendance.view",
    "arquivo": "src/components/app-ui/AttendanceModule.tsx"
  },
  {
    "chave": "attendance.attendance_module.gerar",
    "rotulo": "Gerar — Attendance Module",
    "herda": "attendance.view",
    "arquivo": "src/components/app-ui/AttendanceModule.tsx"
  },
  {
    "chave": "attendance.attendance_module.imprimir",
    "rotulo": "Imprimir — Attendance Module",
    "herda": "attendance.view",
    "arquivo": "src/components/app-ui/AttendanceModule.tsx"
  },
  {
    "chave": "attendance.attendance_module.imprimir_relatorio",
    "rotulo": "Imprimir Relatório — Attendance Module",
    "herda": "attendance.view",
    "arquivo": "src/components/app-ui/AttendanceModule.tsx"
  },
  {
    "chave": "attendance.attendance_module.renovar_gerar_token",
    "rotulo": "Renovar Gerar token — Attendance Module",
    "herda": "attendance.view",
    "arquivo": "src/components/app-ui/AttendanceModule.tsx"
  },
  {
    "chave": "attendance.attendance_module.salvar",
    "rotulo": "Salvar — Attendance Module",
    "herda": "attendance.view",
    "arquivo": "src/components/app-ui/AttendanceModule.tsx"
  },
  {
    "chave": "audit_log.audit_log.exportar",
    "rotulo": "Exportar — Audit Log",
    "herda": "audit_log.view",
    "arquivo": "src/components/app-ui/system/AuditLog.tsx"
  },
  {
    "chave": "baptism.baptism_event_detail.adicionar_candidato",
    "rotulo": "Adicionar Candidato — Baptism Event Detail",
    "herda": "baptism.view",
    "arquivo": "src/components/app-ui/BaptismEventDetail.tsx"
  },
  {
    "chave": "baptism.baptism_event_detail.editar_evento",
    "rotulo": "Editar Evento — Baptism Event Detail",
    "herda": "baptism.view",
    "arquivo": "src/components/app-ui/BaptismEventDetail.tsx"
  },
  {
    "chave": "baptism.baptism_event_detail.enviar_convites",
    "rotulo": "Enviar Convites — Baptism Event Detail",
    "herda": "baptism.view",
    "arquivo": "src/components/app-ui/BaptismEventDetail.tsx"
  },
  {
    "chave": "baptism.baptism_request_new.salvar_pedido",
    "rotulo": "Salvar Pedido — Baptism Request New",
    "herda": "baptism.view",
    "arquivo": "src/components/app-ui/forms/BaptismRequestNew.tsx"
  },
  {
    "chave": "baptism.baptism.agendar",
    "rotulo": "Agendar — Baptism",
    "herda": "baptism.view",
    "arquivo": "src/components/app-ui/Baptism.tsx"
  },
  {
    "chave": "baptism.baptism.editar",
    "rotulo": "Editar — Baptism",
    "herda": "baptism.view",
    "arquivo": "src/components/app-ui/Baptism.tsx"
  },
  {
    "chave": "baptism.baptism.excluir",
    "rotulo": "Excluir — Baptism",
    "herda": "baptism.view",
    "arquivo": "src/components/app-ui/Baptism.tsx"
  },
  {
    "chave": "baptism.baptism.excluir_selecionados",
    "rotulo": "Excluir selecionados — Baptism",
    "herda": "baptism.view",
    "arquivo": "src/components/app-ui/Baptism.tsx"
  },
  {
    "chave": "baptism.baptism.exportar",
    "rotulo": "Exportar — Baptism",
    "herda": "baptism.view",
    "arquivo": "src/components/app-ui/Baptism.tsx"
  },
  {
    "chave": "baptism.baptism.imprimir",
    "rotulo": "Imprimir — Baptism",
    "herda": "baptism.view",
    "arquivo": "src/components/app-ui/Baptism.tsx"
  },
  {
    "chave": "baptism.baptism.novo_batismo",
    "rotulo": "Novo Batismo — Baptism",
    "herda": "baptism.view",
    "arquivo": "src/components/app-ui/Baptism.tsx"
  },
  {
    "chave": "baptism.baptism.salvar_alteracoes_iniciar_processo",
    "rotulo": "Salvar Alteracoes Iniciar Processo — Baptism",
    "herda": "baptism.view",
    "arquivo": "src/components/app-ui/Baptism.tsx"
  },
  {
    "chave": "baptism.baptism.salvar_alteracoes_salvar_data",
    "rotulo": "Salvar Alteracoes Salvar Data — Baptism",
    "herda": "baptism.view",
    "arquivo": "src/components/app-ui/Baptism.tsx"
  },
  {
    "chave": "birthdays.birthdays.enviar_em_massa_enviar_whatsapp",
    "rotulo": "Enviar em Massa Enviar WhatsApp — Birthdays",
    "herda": "birthdays.view",
    "arquivo": "src/components/app-ui/Birthdays.tsx"
  },
  {
    "chave": "birthdays.birthdays.enviar_email",
    "rotulo": "Enviar email — Birthdays",
    "herda": "birthdays.view",
    "arquivo": "src/components/app-ui/Birthdays.tsx"
  },
  {
    "chave": "birthdays.birthdays.enviar_email_em_massa",
    "rotulo": "Enviar Email em Massa — Birthdays",
    "herda": "birthdays.view",
    "arquivo": "src/components/app-ui/Birthdays.tsx"
  },
  {
    "chave": "birthdays.birthdays.enviar_whatsapp",
    "rotulo": "Enviar WhatsApp — Birthdays",
    "herda": "birthdays.view",
    "arquivo": "src/components/app-ui/Birthdays.tsx"
  },
  {
    "chave": "birthdays.birthdays.enviar_whatsapp_de_aniversario",
    "rotulo": "Enviar WhatsApp de aniversário — Birthdays",
    "herda": "birthdays.view",
    "arquivo": "src/components/app-ui/Birthdays.tsx"
  },
  {
    "chave": "birthdays.birthdays.imprimir",
    "rotulo": "Imprimir — Birthdays",
    "herda": "birthdays.view",
    "arquivo": "src/components/app-ui/Birthdays.tsx"
  },
  {
    "chave": "campo_passwords.field_password_admin.remover",
    "rotulo": "Remover — Field Password Admin",
    "herda": "campo_passwords.view",
    "arquivo": "src/app-ui/system/FieldPasswordAdmin.tsx"
  },
  {
    "chave": "campo_passwords.field_password_admin.salvar_senha",
    "rotulo": "Salvar senha do campo — Field Password Admin",
    "herda": "campo_passwords.view",
    "arquivo": "src/app-ui/system/FieldPasswordAdmin.tsx"
  },
  {
    "chave": "cashbook.analytics_modal.imprimir_relatorio",
    "rotulo": "Imprimir Relatório — Analytics Modal",
    "herda": "cashbook.view",
    "arquivo": "src/app-ui/finance/AnalyticsModal.tsx"
  },
  {
    "chave": "cashbook.cashbook.editar_lancamento",
    "rotulo": "Editar lançamento — Cashbook",
    "herda": "cashbook.view",
    "arquivo": "src/app-ui/finance/Cashbook.tsx"
  },
  {
    "chave": "cashbook.cashbook.excluir",
    "rotulo": "Excluir — Cashbook",
    "herda": "cashbook.view",
    "arquivo": "src/app-ui/finance/Cashbook.tsx"
  },
  {
    "chave": "cashbook.cashbook.imprimir_recibo",
    "rotulo": "Imprimir recibo — Cashbook",
    "herda": "cashbook.view",
    "arquivo": "src/app-ui/finance/Cashbook.tsx"
  },
  {
    "chave": "cashbook.cashbook.salvar_edicao",
    "rotulo": "Salvar edição do lançamento — Cashbook",
    "herda": "cashbook.cashbook.editar_lancamento",
    "arquivo": "src/app-ui/finance/Cashbook.tsx"
  },
  {
    "chave": "cashbook.relatorio_modal.baixar",
    "rotulo": "Baixar — Relatorio Modal",
    "herda": "cashbook.view",
    "arquivo": "src/app-ui/finance/RelatorioModal.tsx"
  },
  {
    "chave": "cashbook.relatorio_modal.imprimir",
    "rotulo": "Imprimir — Relatorio Modal",
    "herda": "cashbook.view",
    "arquivo": "src/app-ui/finance/RelatorioModal.tsx"
  },
  {
    "chave": "cells.attach_member_modal.anexar",
    "rotulo": "Anexar — Attach Member Modal",
    "herda": "cells.view",
    "arquivo": "src/components/app-ui/cells/AttachMemberModal.tsx"
  },
  {
    "chave": "cells.attach_member_modal.listas_importadas",
    "rotulo": "Listas importadas — Attach Member Modal",
    "herda": "cells.view",
    "arquivo": "src/components/app-ui/cells/AttachMemberModal.tsx"
  },
  {
    "chave": "cells.attach_member_modal.neste_gf_anexar",
    "rotulo": "Neste GF Anexar — Attach Member Modal",
    "herda": "cells.view",
    "arquivo": "src/components/app-ui/cells/AttachMemberModal.tsx"
  },
  {
    "chave": "cells.cell_detail.anexar_pessoas",
    "rotulo": "Anexar pessoas — Cell Detail",
    "herda": "cell_group_members.edit",
    "arquivo": "src/components/app-ui/CellDetail.tsx"
  },
  {
    "chave": "cells.cell_detail.remover_do_gf",
    "rotulo": "Remover do GF — Cell Detail",
    "herda": "cell_group_members.delete",
    "arquivo": "src/components/app-ui/CellDetail.tsx"
  },
  {
    "chave": "cells.cell_groups.editar_gf",
    "rotulo": "Editar GF — Cell Groups",
    "herda": "cells.edit",
    "arquivo": "src/components/app-ui/CellGroups.tsx"
  },
  {
    "chave": "cells.cell_groups.excluir_gf",
    "rotulo": "Excluir GF — Cell Groups",
    "herda": "cells.delete",
    "arquivo": "src/components/app-ui/CellGroups.tsx"
  },
  {
    "chave": "cells.cell_groups.novo_gf",
    "rotulo": "Novo GF — Cell Groups",
    "herda": "cells.create",
    "arquivo": "src/components/app-ui/CellGroups.tsx"
  },
  {
    "chave": "churches.churches.editar",
    "rotulo": "Editar — Churches",
    "herda": "churches.view",
    "arquivo": "src/components/app-ui/Churches.tsx"
  },
  {
    "chave": "churches.churches.encerrar_mesmo_assim",
    "rotulo": "Encerrar mesmo assim — Churches",
    "herda": "churches.view",
    "arquivo": "src/components/app-ui/Churches.tsx"
  },
  {
    "chave": "churches.churches.excluir",
    "rotulo": "Excluir — Churches",
    "herda": "churches.view",
    "arquivo": "src/components/app-ui/Churches.tsx"
  },
  {
    "chave": "churches.churches.imprimir",
    "rotulo": "Imprimir — Churches",
    "herda": "churches.view",
    "arquivo": "src/components/app-ui/Churches.tsx"
  },
  {
    "chave": "churches.churches.menu_exportar",
    "rotulo": "Exportar (menu) — Churches",
    "herda": "churches.view",
    "arquivo": "src/components/app-ui/Churches.tsx"
  },
  {
    "chave": "churches.churches.nova_funcao",
    "rotulo": "Nova Funcao — Churches",
    "herda": "churches.view",
    "arquivo": "src/components/app-ui/Churches.tsx"
  },
  {
    "chave": "churches.churches.nova_igreja",
    "rotulo": "Nova Igreja — Churches",
    "herda": "churches.view",
    "arquivo": "src/components/app-ui/Churches.tsx"
  },
  {
    "chave": "churches.churches.novo_contato",
    "rotulo": "Novo Contato — Churches",
    "herda": "churches.view",
    "arquivo": "src/components/app-ui/Churches.tsx"
  },
  {
    "chave": "churches.churches.novo_dirigente",
    "rotulo": "Novo Dirigente — Churches",
    "herda": "churches.view",
    "arquivo": "src/components/app-ui/Churches.tsx"
  },
  {
    "chave": "churches.churches.salvar_alteracoes_trocar_dirigente",
    "rotulo": "Salvar alterações Trocar dirigente — Churches",
    "herda": "churches.view",
    "arquivo": "src/components/app-ui/Churches.tsx"
  },
  {
    "chave": "churches.churches.salvar_dados_criar_igreja",
    "rotulo": "Salvar dados Criar igreja — Churches",
    "herda": "churches.view",
    "arquivo": "src/components/app-ui/Churches.tsx"
  },
  {
    "chave": "churches.churches.salvar_lancamento",
    "rotulo": "Salvar lançamento — Churches",
    "herda": "churches.view",
    "arquivo": "src/components/app-ui/Churches.tsx"
  },
  {
    "chave": "churches.churches.salvar_vinculos",
    "rotulo": "Salvar vinculos — Churches",
    "herda": "churches.view",
    "arquivo": "src/components/app-ui/Churches.tsx"
  },
  {
    "chave": "churches.leader_report_modal.imprimir",
    "rotulo": "Imprimir — Leader Report Modal",
    "herda": "churches.view",
    "arquivo": "src/components/app-ui/churches/LeaderReportModal.tsx"
  },
  {
    "chave": "consecration.consecration_new.salvar_consagracao",
    "rotulo": "Salvar Consagração — Consecration New",
    "herda": "consecration.view",
    "arquivo": "src/components/app-ui/forms/ConsecrationNew.tsx"
  },
  {
    "chave": "consecration.consecration.agendar",
    "rotulo": "Agendar — Consecration",
    "herda": "consecration.view",
    "arquivo": "src/components/app-ui/Consecration.tsx"
  },
  {
    "chave": "consecration.consecration.editar",
    "rotulo": "Editar — Consecration",
    "herda": "consecration.view",
    "arquivo": "src/components/app-ui/Consecration.tsx"
  },
  {
    "chave": "consecration.consecration.excluir",
    "rotulo": "Excluir — Consecration",
    "herda": "consecration.view",
    "arquivo": "src/components/app-ui/Consecration.tsx"
  },
  {
    "chave": "consecration.consecration.excluir_selecionados",
    "rotulo": "Excluir selecionados — Consecration",
    "herda": "consecration.view",
    "arquivo": "src/components/app-ui/Consecration.tsx"
  },
  {
    "chave": "consecration.consecration.exportar",
    "rotulo": "Exportar — Consecration",
    "herda": "consecration.view",
    "arquivo": "src/components/app-ui/Consecration.tsx"
  },
  {
    "chave": "consecration.consecration.imprimir",
    "rotulo": "Imprimir — Consecration",
    "herda": "consecration.view",
    "arquivo": "src/components/app-ui/Consecration.tsx"
  },
  {
    "chave": "consecration.consecration.nova_consagracao",
    "rotulo": "Nova Consagração — Consecration",
    "herda": "consecration.view",
    "arquivo": "src/components/app-ui/Consecration.tsx"
  },
  {
    "chave": "consecration.consecration.salvar_alteracoes_iniciar_processo",
    "rotulo": "Salvar Alteracoes Iniciar Processo — Consecration",
    "herda": "consecration.view",
    "arquivo": "src/components/app-ui/Consecration.tsx"
  },
  {
    "chave": "consecration.consecration.salvar_alteracoes_salvar_data",
    "rotulo": "Salvar Alteracoes Salvar Data — Consecration",
    "herda": "consecration.view",
    "arquivo": "src/components/app-ui/Consecration.tsx"
  },
  {
    "chave": "contabilidade_agendamentos.contabilidade_agendamentos.cadastrar",
    "rotulo": "Cadastrar — Contabilidade Agendamentos",
    "herda": "contabilidade_agendamentos.view",
    "arquivo": "src/app-ui/system/ContabilidadeAgendamentos.tsx"
  },
  {
    "chave": "contabilidade_agendamentos.contabilidade_agendamentos.editar_contador",
    "rotulo": "Editar contador — Contabilidade Agendamentos",
    "herda": "contabilidade_agendamentos.view",
    "arquivo": "src/app-ui/system/ContabilidadeAgendamentos.tsx"
  },
  {
    "chave": "contabilidade_agendamentos.contabilidade_agendamentos.enviar_agora",
    "rotulo": "Enviar agora — Contabilidade Agendamentos",
    "herda": "contabilidade_agendamentos.view",
    "arquivo": "src/app-ui/system/ContabilidadeAgendamentos.tsx"
  },
  {
    "chave": "contabilidade_agendamentos.contabilidade_agendamentos.excluir",
    "rotulo": "Excluir — Contabilidade Agendamentos",
    "herda": "contabilidade_agendamentos.view",
    "arquivo": "src/app-ui/system/ContabilidadeAgendamentos.tsx"
  },
  {
    "chave": "contabilidade_agendamentos.contabilidade_agendamentos.excluir_contador",
    "rotulo": "Excluir contador — Contabilidade Agendamentos",
    "herda": "contabilidade_agendamentos.view",
    "arquivo": "src/app-ui/system/ContabilidadeAgendamentos.tsx"
  },
  {
    "chave": "contabilidade_agendamentos.contabilidade_agendamentos.novo_contador",
    "rotulo": "Novo Contador — Contabilidade Agendamentos",
    "herda": "contabilidade_agendamentos.view",
    "arquivo": "src/app-ui/system/ContabilidadeAgendamentos.tsx"
  },
  {
    "chave": "contabilidade_agendamentos.contabilidade_agendamentos.salvar",
    "rotulo": "Salvar — Contabilidade Agendamentos",
    "herda": "contabilidade_agendamentos.view",
    "arquivo": "src/app-ui/system/ContabilidadeAgendamentos.tsx"
  },
  {
    "chave": "contas_pagar.conta_pagar_form_drawer.cadastrar_novo_credor",
    "rotulo": "Cadastrar novo credor — Conta Pagar Form Drawer",
    "herda": "contas_pagar.view",
    "arquivo": "src/app-ui/finance/ContaPagarFormDrawer.tsx"
  },
  {
    "chave": "contas_pagar.conta_pagar_form_drawer.salvar_alteracoes_lancar_conta",
    "rotulo": "Salvar alterações Lançar conta — Conta Pagar Form Drawer",
    "herda": "contas_pagar.view",
    "arquivo": "src/app-ui/finance/ContaPagarFormDrawer.tsx"
  },
  {
    "chave": "contas_pagar.contas_pagar.aprovar",
    "rotulo": "Aprovar — Contas Pagar",
    "herda": "contas_pagar.view",
    "arquivo": "src/app-ui/finance/ContasPagar.tsx"
  },
  {
    "chave": "contas_pagar.contas_pagar.editar",
    "rotulo": "Editar — Contas Pagar",
    "herda": "contas_pagar.view",
    "arquivo": "src/app-ui/finance/ContasPagar.tsx"
  },
  {
    "chave": "contas_pagar.contas_pagar.exportar",
    "rotulo": "Exportar — Contas Pagar",
    "herda": "contas_pagar.view",
    "arquivo": "src/app-ui/finance/ContasPagar.tsx"
  },
  {
    "chave": "contas_pagar.contas_pagar.imprimir",
    "rotulo": "Imprimir — Contas Pagar",
    "herda": "contas_pagar.view",
    "arquivo": "src/app-ui/finance/ContasPagar.tsx"
  },
  {
    "chave": "contas_pagar.contas_pagar.nova_conta",
    "rotulo": "Nova Conta — Contas Pagar",
    "herda": "contas_pagar.create",
    "arquivo": "src/app-ui/finance/ContasPagar.tsx"
  },
  {
    "chave": "contas_pagar.contas_pagar.remover_todos",
    "rotulo": "Remover todos — Contas Pagar",
    "herda": "contas_pagar.view",
    "arquivo": "src/app-ui/finance/ContasPagar.tsx"
  },
  {
    "chave": "contas_pagar.credor_form_modal.cadastrar_credor",
    "rotulo": "Cadastrar credor — Credor Form Modal",
    "herda": "contas_pagar.view",
    "arquivo": "src/app-ui/finance/CredorFormModal.tsx"
  },
  {
    "chave": "contas_pagar.credor_form_modal.remover",
    "rotulo": "Remover — Credor Form Modal",
    "herda": "contas_pagar.view",
    "arquivo": "src/app-ui/finance/CredorFormModal.tsx"
  },
  {
    "chave": "contas_pagar.parcela_detail_modal.estornar",
    "rotulo": "Estornar — Parcela Detail Modal",
    "herda": "contas_pagar.view",
    "arquivo": "src/app-ui/finance/ParcelaDetailModal.tsx"
  },
  {
    "chave": "credential_models.modelos_credencial.editar",
    "rotulo": "Editar — Modelos Credencial",
    "herda": "credential_models.edit",
    "arquivo": "src/app-ui/ecclesiastical/ModelosCredencial.tsx"
  },
  {
    "chave": "credential_models.modelos_credencial.excluir",
    "rotulo": "Excluir — Modelos Credencial",
    "herda": "credential_models.delete",
    "arquivo": "src/app-ui/ecclesiastical/ModelosCredencial.tsx"
  },
  {
    "chave": "credential_models.modelos_credencial.novo_modelo",
    "rotulo": "Novo Modelo — Modelos Credencial",
    "herda": "credential_models.create",
    "arquivo": "src/app-ui/ecclesiastical/ModelosCredencial.tsx"
  },
  {
    "chave": "credentials.credentials.excel",
    "rotulo": "Excel — Credentials",
    "herda": "credentials.view",
    "arquivo": "src/components/app-ui/Credentials.tsx"
  },
  {
    "chave": "credentials.credentials.excluir",
    "rotulo": "Excluir — Credentials",
    "herda": "credentials.view",
    "arquivo": "src/components/app-ui/Credentials.tsx"
  },
  {
    "chave": "credentials.credentials.imprimir",
    "rotulo": "Imprimir — Credentials",
    "herda": "credentials.view",
    "arquivo": "src/components/app-ui/Credentials.tsx"
  },
  {
    "chave": "credentials.credentials.nova_credencial",
    "rotulo": "Nova Credencial — Credentials",
    "herda": "credentials.view",
    "arquivo": "src/components/app-ui/Credentials.tsx"
  },
  {
    "chave": "crm_leads.contacts_module.exportar",
    "rotulo": "Exportar — Contacts Module",
    "herda": "crm_leads.view",
    "arquivo": "src/components/app-ui/ContactsModule.tsx"
  },
  {
    "chave": "crm_leads.contacts_module.novo_contato",
    "rotulo": "Novo Contato — Contacts Module",
    "herda": "crm_leads.view",
    "arquivo": "src/components/app-ui/ContactsModule.tsx"
  },
  {
    "chave": "crm_pipeline.secretariat_pipeline.anexar_arquivo",
    "rotulo": "Anexar arquivo — Secretariat Pipeline",
    "herda": "crm_pipeline.view",
    "arquivo": "src/app-ui/ecclesiastical/SecretariatPipeline.tsx"
  },
  {
    "chave": "crm_pipeline.secretariat_pipeline.criar",
    "rotulo": "Criar — Secretariat Pipeline",
    "herda": "crm_pipeline.view",
    "arquivo": "src/app-ui/ecclesiastical/SecretariatPipeline.tsx"
  },
  {
    "chave": "crm_pipeline.secretariat_pipeline.editar",
    "rotulo": "Editar — Secretariat Pipeline",
    "herda": "crm_pipeline.view",
    "arquivo": "src/app-ui/ecclesiastical/SecretariatPipeline.tsx"
  },
  {
    "chave": "crm_pipeline.secretariat_pipeline.editar_nome",
    "rotulo": "Editar nome — Secretariat Pipeline",
    "herda": "crm_pipeline.view",
    "arquivo": "src/app-ui/ecclesiastical/SecretariatPipeline.tsx"
  },
  {
    "chave": "crm_pipeline.secretariat_pipeline.enviar_mensagem",
    "rotulo": "Enviar mensagem — Secretariat Pipeline",
    "herda": "crm_pipeline.view",
    "arquivo": "src/app-ui/ecclesiastical/SecretariatPipeline.tsx"
  },
  {
    "chave": "crm_pipeline.secretariat_pipeline.excluir",
    "rotulo": "Excluir — Secretariat Pipeline",
    "herda": "crm_pipeline.view",
    "arquivo": "src/app-ui/ecclesiastical/SecretariatPipeline.tsx"
  },
  {
    "chave": "crm_pipeline.secretariat_pipeline.excluir_registros",
    "rotulo": "Excluir registros ( ) — Secretariat Pipeline",
    "herda": "crm_pipeline.view",
    "arquivo": "src/app-ui/ecclesiastical/SecretariatPipeline.tsx"
  },
  {
    "chave": "crm_pipeline.secretariat_pipeline.exportar",
    "rotulo": "Exportar — Secretariat Pipeline",
    "herda": "crm_pipeline.view",
    "arquivo": "src/app-ui/ecclesiastical/SecretariatPipeline.tsx"
  },
  {
    "chave": "crm_pipeline.secretariat_pipeline.exportar_csv",
    "rotulo": "Exportar CSV — Secretariat Pipeline",
    "herda": "crm_pipeline.view",
    "arquivo": "src/app-ui/ecclesiastical/SecretariatPipeline.tsx"
  },
  {
    "chave": "crm_pipeline.secretariat_pipeline.imprimir",
    "rotulo": "Imprimir — Secretariat Pipeline",
    "herda": "crm_pipeline.view",
    "arquivo": "src/app-ui/ecclesiastical/SecretariatPipeline.tsx"
  },
  {
    "chave": "crm_pipeline.secretariat_pipeline.remover_arquivo",
    "rotulo": "Remover arquivo — Secretariat Pipeline",
    "herda": "crm_pipeline.view",
    "arquivo": "src/app-ui/ecclesiastical/SecretariatPipeline.tsx"
  },
  {
    "chave": "crm_pipeline.secretariat_pipeline.salvar_alteracoes",
    "rotulo": "Salvar alterações — Secretariat Pipeline",
    "herda": "crm_pipeline.view",
    "arquivo": "src/app-ui/ecclesiastical/SecretariatPipeline.tsx"
  },
  {
    "chave": "culto_gestao.culto_imprimir_modal.imprimir",
    "rotulo": "Imprimir — Culto Imprimir Modal",
    "herda": "culto_gestao.view",
    "arquivo": "src/app-ui/culto/CultoImprimirModal.tsx"
  },
  {
    "chave": "culto_gestao.culto_meus_lancamentos.ver_editar_lancar",
    "rotulo": "· · ver editar lançar — Culto Meus Lancamentos",
    "herda": "culto_gestao.view",
    "arquivo": "src/app-ui/culto/CultoMeusLancamentos.tsx"
  },
  {
    "chave": "culto_gestao.culto_resumo_modal.editar_culto",
    "rotulo": "Editar culto — Culto Resumo Modal",
    "herda": "culto_gestao.view",
    "arquivo": "src/app-ui/culto/CultoResumoModal.tsx"
  },
  {
    "chave": "culto_gestao.culto_resumo_modal.excluir_culto_ou_um_dos_envios",
    "rotulo": "Excluir culto ou um dos envios — Culto Resumo Modal",
    "herda": "culto_gestao.view",
    "arquivo": "src/app-ui/culto/CultoResumoModal.tsx"
  },
  {
    "chave": "culto_gestao.gestao_culto.abrir_o_culto_para_ver_editar_aprovar_ou",
    "rotulo": "Abrir o culto para ver, editar, aprovar ou excluir — Gestao Culto",
    "herda": "culto_gestao.view",
    "arquivo": "src/app-ui/culto/GestaoCulto.tsx"
  },
  {
    "chave": "culto_gestao.gestao_culto.editar_culto",
    "rotulo": "Editar culto — Gestao Culto",
    "herda": "culto_gestao.view",
    "arquivo": "src/app-ui/culto/GestaoCulto.tsx"
  },
  {
    "chave": "culto_gestao.gestao_culto.excluir_culto",
    "rotulo": "Excluir culto — Gestao Culto",
    "herda": "culto_gestao.view",
    "arquivo": "src/app-ui/culto/GestaoCulto.tsx"
  },
  {
    "chave": "culto_gestao.gestao_culto.excluir_o_culto_inteiro",
    "rotulo": "Excluir o culto inteiro — Gestao Culto",
    "herda": "culto_gestao.view",
    "arquivo": "src/app-ui/culto/GestaoCulto.tsx"
  },
  {
    "chave": "culto_gestao.gestao_culto.excluir_so_o",
    "rotulo": "Excluir só o — Gestao Culto",
    "herda": "culto_gestao.view",
    "arquivo": "src/app-ui/culto/GestaoCulto.tsx"
  },
  {
    "chave": "culto_gestao.gestao_culto.imprimir",
    "rotulo": "Imprimir — Gestao Culto",
    "herda": "culto_gestao.view",
    "arquivo": "src/app-ui/culto/GestaoCulto.tsx"
  },
  {
    "chave": "culto_lancar.culto_lancar_modal.cadastrar_horarios_de_culto_desta_igreja",
    "rotulo": "Cadastrar horários de culto desta igreja — Culto Lancar Modal",
    "herda": "culto_lancar.view",
    "arquivo": "src/app-ui/culto/CultoLancarModal.tsx"
  },
  {
    "chave": "culto_lancar.culto_lancar_modal.cadastrar_tipos_de_culto",
    "rotulo": "Cadastrar tipos de culto — Culto Lancar Modal",
    "herda": "culto_lancar.view",
    "arquivo": "src/app-ui/culto/CultoLancarModal.tsx"
  },
  {
    "chave": "culto_lancar.culto_lancar_modal.enviar",
    "rotulo": "Enviar — Culto Lancar Modal",
    "herda": "culto_lancar.view",
    "arquivo": "src/app-ui/culto/CultoLancarModal.tsx"
  },
  {
    "chave": "culto_lancar.culto_lancar_modal.escolher_outro_culto",
    "rotulo": "Escolher outro culto — Culto Lancar Modal",
    "herda": "culto_lancar.view",
    "arquivo": "src/app-ui/culto/CultoLancarModal.tsx"
  },
  {
    "chave": "culto_lancar.culto_lancar_modal.novo_lancamento",
    "rotulo": "Novo lançamento — Culto Lancar Modal",
    "herda": "culto_lancar.view",
    "arquivo": "src/app-ui/culto/CultoLancarModal.tsx"
  },
  {
    "chave": "culto_lancar.culto_lancar_modal.selecionar_e_lancar",
    "rotulo": "Selecionar e lançar — Culto Lancar Modal",
    "herda": "culto_lancar.view",
    "arquivo": "src/app-ui/culto/CultoLancarModal.tsx"
  },
  {
    "chave": "culto_lancar.horarios_culto_modal.excluir_horario",
    "rotulo": "Excluir horário — Horarios Culto Modal",
    "herda": "culto_lancar.view",
    "arquivo": "src/app-ui/culto/HorariosCultoModal.tsx"
  },
  {
    "chave": "culto_posicoes.posicoes_culto.anexar",
    "rotulo": "Anexar — Posicoes Culto",
    "herda": "culto_posicoes.view",
    "arquivo": "src/app-ui/culto/PosicoesCulto.tsx"
  },
  {
    "chave": "culto_posicoes.posicoes_culto.confirmar_pela_funcao",
    "rotulo": "Confirmar titular da função — Posicoes Culto",
    "herda": "culto_posicoes.view",
    "arquivo": "src/app-ui/culto/PosicoesCulto.tsx"
  },
  {
    "chave": "culto_posicoes.posicoes_culto.criar_acesso",
    "rotulo": "Criar acesso — Posicoes Culto",
    "herda": "culto_posicoes.view",
    "arquivo": "src/app-ui/culto/PosicoesCulto.tsx"
  },
  {
    "chave": "culto_posicoes.posicoes_culto.criar_usuario_e_anexar_como",
    "rotulo": "Criar usuário e anexar como — Posicoes Culto",
    "herda": "culto_posicoes.view",
    "arquivo": "src/app-ui/culto/PosicoesCulto.tsx"
  },
  {
    "chave": "culto_posicoes.posicoes_culto.nao_esta_na_lista_criar_a_partir_de_um_m",
    "rotulo": "Não está na lista? Criar a partir de um membro — Posicoes Culto",
    "herda": "culto_posicoes.view",
    "arquivo": "src/app-ui/culto/PosicoesCulto.tsx"
  },
  {
    "chave": "culto_posicoes.posicoes_culto.remover",
    "rotulo": "Remover — Posicoes Culto",
    "herda": "culto_posicoes.view",
    "arquivo": "src/app-ui/culto/PosicoesCulto.tsx"
  },
  {
    "chave": "daily_bread.daily_bread.adicionar_primeira_reflexao",
    "rotulo": "Adicionar primeira reflexao — Daily Bread",
    "herda": "daily_bread.view",
    "arquivo": "src/components/app-ui/DailyBread.tsx"
  },
  {
    "chave": "daily_bread.daily_bread.editar",
    "rotulo": "Editar — Daily Bread",
    "herda": "daily_bread.view",
    "arquivo": "src/components/app-ui/DailyBread.tsx"
  },
  {
    "chave": "daily_bread.daily_bread.excluir",
    "rotulo": "Excluir — Daily Bread",
    "herda": "daily_bread.view",
    "arquivo": "src/components/app-ui/DailyBread.tsx"
  },
  {
    "chave": "daily_bread.daily_bread.nova_reflexao",
    "rotulo": "Nova reflexao — Daily Bread",
    "herda": "daily_bread.view",
    "arquivo": "src/components/app-ui/DailyBread.tsx"
  },
  {
    "chave": "daily_bread.daily_bread.salvar",
    "rotulo": "Salvar — Daily Bread",
    "herda": "daily_bread.view",
    "arquivo": "src/components/app-ui/DailyBread.tsx"
  },
  {
    "chave": "discipleship.discipleship_curriculum.adicionar_materia",
    "rotulo": "Adicionar matéria — Discipleship Curriculum",
    "herda": "discipleship.view",
    "arquivo": "src/app-ui/pastoral/DiscipleshipCurriculum.tsx"
  },
  {
    "chave": "discipleship.discipleship_curriculum.novo_programa",
    "rotulo": "Novo Programa — Discipleship Curriculum",
    "herda": "discipleship.view",
    "arquivo": "src/app-ui/pastoral/DiscipleshipCurriculum.tsx"
  },
  {
    "chave": "discipleship.discipleship_curriculum.salvar_programa",
    "rotulo": "Salvar Programa — Discipleship Curriculum",
    "herda": "discipleship.view",
    "arquivo": "src/app-ui/pastoral/DiscipleshipCurriculum.tsx"
  },
  {
    "chave": "discipleship.discipleship_new.salvar_discipulado",
    "rotulo": "Salvar discipulado — Discipleship New",
    "herda": "discipleship.view",
    "arquivo": "src/app-ui/pastoral/DiscipleshipNew.tsx"
  },
  {
    "chave": "discipleship.discipleship_tracking.registrar_encontro",
    "rotulo": "Registrar Encontro — Discipleship Tracking",
    "herda": "discipleship.view",
    "arquivo": "src/app-ui/pastoral/DiscipleshipTracking.tsx"
  },
  {
    "chave": "dizimo_blocos.dizimo_blocos.cadastrar_bloco",
    "rotulo": "Cadastrar bloco — Dizimo Blocos",
    "herda": "dizimo_blocos.create",
    "arquivo": "src/app-ui/finance/DizimoBlocos.tsx"
  },
  {
    "chave": "dizimo_blocos.dizimo_blocos.excluir_bloco",
    "rotulo": "Excluir bloco — Dizimo Blocos",
    "herda": "dizimo_blocos.view",
    "arquivo": "src/app-ui/finance/DizimoBlocos.tsx"
  },
  {
    "chave": "dizimo_blocos.dizimo_blocos.gerar_bloco",
    "rotulo": "Gerar bloco — Dizimo Blocos",
    "herda": "dizimo_blocos.view",
    "arquivo": "src/app-ui/finance/DizimoBlocos.tsx"
  },
  {
    "chave": "ebd_cadastros.ebd_cadastros.excluir_categoria",
    "rotulo": "Excluir (categoria) — Ebd Cadastros",
    "herda": "ebd_cadastros.view",
    "arquivo": "src/app-ui/ebd/EbdCadastros.tsx"
  },
  {
    "chave": "ebd_cadastros.ebd_cadastros.excluir_produto",
    "rotulo": "Excluir (produto) — Ebd Cadastros",
    "herda": "ebd_cadastros.view",
    "arquivo": "src/app-ui/ebd/EbdCadastros.tsx"
  },
  {
    "chave": "ebd_cadastros.ebd_cadastros.excluir_trimestre",
    "rotulo": "Excluir (trimestre) — Ebd Cadastros",
    "herda": "ebd_cadastros.view",
    "arquivo": "src/app-ui/ebd/EbdCadastros.tsx"
  },
  {
    "chave": "ebd_cadastros.ebd_cadastros.nova_categoria",
    "rotulo": "Nova Categoria — Ebd Cadastros",
    "herda": "ebd_cadastros.view",
    "arquivo": "src/app-ui/ebd/EbdCadastros.tsx"
  },
  {
    "chave": "ebd_cadastros.ebd_cadastros.novo_produto",
    "rotulo": "Novo Produto — Ebd Cadastros",
    "herda": "ebd_cadastros.view",
    "arquivo": "src/app-ui/ebd/EbdCadastros.tsx"
  },
  {
    "chave": "ebd_cadastros.ebd_cadastros.novo_trimestre",
    "rotulo": "Novo Trimestre — Ebd Cadastros",
    "herda": "ebd_cadastros.view",
    "arquivo": "src/app-ui/ebd/EbdCadastros.tsx"
  },
  {
    "chave": "ebd_cadastros.ebd_cadastros.salvar",
    "rotulo": "Salvar — Ebd Cadastros",
    "herda": "ebd_cadastros.view",
    "arquivo": "src/app-ui/ebd/EbdCadastros.tsx"
  },
  {
    "chave": "ebd_entrega.ebd_entrega.adicionar_produto",
    "rotulo": "Adicionar produto — Ebd Entrega",
    "herda": "ebd_entrega.view",
    "arquivo": "src/app-ui/ebd/EbdEntrega.tsx"
  },
  {
    "chave": "ebd_entrega.ebd_entrega.imprimir",
    "rotulo": "Imprimir — Ebd Entrega",
    "herda": "ebd_entrega.view",
    "arquivo": "src/app-ui/ebd/EbdEntrega.tsx"
  },
  {
    "chave": "ebd_entrega.ebd_entrega.nova_entrega",
    "rotulo": "Nova Entrega — Ebd Entrega",
    "herda": "ebd_entrega.view",
    "arquivo": "src/app-ui/ebd/EbdEntrega.tsx"
  },
  {
    "chave": "ebd_entrega.ebd_entrega.remover_item",
    "rotulo": "Remover (item) — Ebd Entrega",
    "herda": "ebd_entrega.view",
    "arquivo": "src/app-ui/ebd/EbdEntrega.tsx"
  },
  {
    "chave": "ebd_entrega.ebd_entrega.salvar_e_gerar_documento",
    "rotulo": "Salvar e Gerar Documento — Ebd Entrega",
    "herda": "ebd_entrega.view",
    "arquivo": "src/app-ui/ebd/EbdEntrega.tsx"
  },
  {
    "chave": "ebd_estoque.ebd_estoque.adicionar_item",
    "rotulo": "Adicionar item — Ebd Estoque",
    "herda": "ebd_estoque.view",
    "arquivo": "src/app-ui/ebd/EbdEstoque.tsx"
  },
  {
    "chave": "ebd_estoque.ebd_estoque.excluir_entrada",
    "rotulo": "Excluir (entrada) — Ebd Estoque",
    "herda": "ebd_estoque.view",
    "arquivo": "src/app-ui/ebd/EbdEstoque.tsx"
  },
  {
    "chave": "ebd_estoque.ebd_estoque.remover_item",
    "rotulo": "Remover (item) — Ebd Estoque",
    "herda": "ebd_estoque.view",
    "arquivo": "src/app-ui/ebd/EbdEstoque.tsx"
  },
  {
    "chave": "ebd_estoque.ebd_estoque.salvar",
    "rotulo": "Salvar — Ebd Estoque",
    "herda": "ebd_estoque.view",
    "arquivo": "src/app-ui/ebd/EbdEstoque.tsx"
  },
  {
    "chave": "ebd_estoque.ebd_estoque.salvar_entrada",
    "rotulo": "Salvar Entrada — Ebd Estoque",
    "herda": "ebd_estoque.view",
    "arquivo": "src/app-ui/ebd/EbdEstoque.tsx"
  },
  {
    "chave": "ebd_financeiro.ebd_financeiro.confirmar_pagamento_da_parcela",
    "rotulo": "Confirmar Pagamento da Parcela — Ebd Financeiro",
    "herda": "ebd_financeiro.view",
    "arquivo": "src/app-ui/ebd/EbdFinanceiro.tsx"
  },
  {
    "chave": "ebd_financeiro.ebd_financeiro.nova_negociacao",
    "rotulo": "Nova Negociação — Ebd Financeiro",
    "herda": "ebd_financeiro.view",
    "arquivo": "src/app-ui/ebd/EbdFinanceiro.tsx"
  },
  {
    "chave": "ebd_financeiro.ebd_financeiro.salvar",
    "rotulo": "Salvar — Ebd Financeiro",
    "herda": "ebd_financeiro.view",
    "arquivo": "src/app-ui/ebd/EbdFinanceiro.tsx"
  },
  {
    "chave": "ebd_financeiro.ebd_financeiro.salvar_negociacao",
    "rotulo": "Salvar Negociação — Ebd Financeiro",
    "herda": "ebd_financeiro.view",
    "arquivo": "src/app-ui/ebd/EbdFinanceiro.tsx"
  },
  {
    "chave": "ebd_relatorios.ebd_relatorios.exportar_excel",
    "rotulo": "Exportar Excel — Ebd Relatorios",
    "herda": "ebd_relatorios.view",
    "arquivo": "src/app-ui/ebd/EbdRelatorios.tsx"
  },
  {
    "chave": "ebd_relatorios.ebd_relatorios.imprimir",
    "rotulo": "Imprimir — Ebd Relatorios",
    "herda": "ebd_relatorios.view",
    "arquivo": "src/app-ui/ebd/EbdRelatorios.tsx"
  },
  {
    "chave": "engajamento_fotos.fotos.desmarcar",
    "rotulo": "Desmarcar pessoa",
    "herda": "engajamento_fotos.view",
    "arquivo": "src/app-ui/engajamento/EngajamentoFotos.tsx"
  },
  {
    "chave": "engajamento_fotos.fotos.editar",
    "rotulo": "Corrigir data e título",
    "herda": "engajamento_fotos.view",
    "arquivo": "src/app-ui/engajamento/EngajamentoFotos.tsx"
  },
  {
    "chave": "engajamento_fotos.fotos.excluir",
    "rotulo": "Remover publicação",
    "herda": "engajamento_fotos.view",
    "arquivo": "src/app-ui/engajamento/EngajamentoFotos.tsx"
  },
  {
    "chave": "engajamento_fotos.fotos.marcar",
    "rotulo": "Marcar pessoa na foto",
    "herda": "engajamento_fotos.view",
    "arquivo": "src/app-ui/engajamento/EngajamentoFotos.tsx"
  },
  {
    "chave": "engajamento_instagram.instagram.conectar",
    "rotulo": "Entrar com Instagram",
    "herda": "engajamento_instagram.view",
    "arquivo": "src/app-ui/engajamento/EngajamentoInstagram.tsx"
  },
  {
    "chave": "engajamento_instagram.instagram.desconectar",
    "rotulo": "Desconectar conta",
    "herda": "engajamento_instagram.instagram.conectar",
    "arquivo": "src/app-ui/engajamento/EngajamentoInstagram.tsx"
  },
  {
    "chave": "engajamento_instagram.instagram.sincronizar",
    "rotulo": "Iniciar (trazer fotos e reconhecer rostos)",
    "herda": "engajamento_instagram.view",
    "arquivo": "src/app-ui/engajamento/EngajamentoInstagram.tsx"
  },
  {
    "chave": "engajamento_pessoas.pessoas.apagar_rostos",
    "rotulo": "Apagar todos os dados de rosto",
    "herda": "engajamento_pessoas.view",
    "arquivo": "src/app-ui/engajamento/EngajamentoPessoas.tsx"
  },
  {
    "chave": "engajamento_pessoas.pessoas.juntar",
    "rotulo": "Juntar com outra pessoa",
    "herda": "engajamento_pessoas.view",
    "arquivo": "src/app-ui/engajamento/EngajamentoPessoas.tsx"
  },
  {
    "chave": "engajamento_pessoas.pessoas.nomear",
    "rotulo": "Dar nome / ligar ao membro",
    "herda": "engajamento_pessoas.view",
    "arquivo": "src/app-ui/engajamento/EngajamentoPessoas.tsx"
  },
  {
    "chave": "engajamento_pessoas.pessoas.ocultar",
    "rotulo": "Ocultar do relatório",
    "herda": "engajamento_pessoas.view",
    "arquivo": "src/app-ui/engajamento/EngajamentoPessoas.tsx"
  },
  {
    "chave": "engajamento_pessoas.pessoas.tirar_rosto",
    "rotulo": "Tirar rosto (não é esta pessoa)",
    "herda": "engajamento_pessoas.view",
    "arquivo": "src/app-ui/engajamento/EngajamentoPessoas.tsx"
  },
  {
    "chave": "engajamento.comparativo.exportar",
    "rotulo": "Exportar planilha (Excel)",
    "herda": "engajamento.view",
    "arquivo": "src/app-ui/engajamento/EngajamentoComparativo.tsx"
  },
  {
    "chave": "engajamento.comparativo.imprimir",
    "rotulo": "Imprimir relatório",
    "herda": "engajamento.view",
    "arquivo": "src/app-ui/engajamento/EngajamentoComparativo.tsx"
  },
  {
    "chave": "events.agenda.adicionar_evento",
    "rotulo": "Adicionar evento — Agenda",
    "herda": "events.view",
    "arquivo": "src/components/app-ui/Agenda.tsx"
  },
  {
    "chave": "events.agenda.adicionar_primeiro_evento",
    "rotulo": "Adicionar primeiro evento — Agenda",
    "herda": "events.create",
    "arquivo": "src/components/app-ui/Agenda.tsx"
  },
  {
    "chave": "events.agenda.editar",
    "rotulo": "Editar — Agenda",
    "herda": "events.edit",
    "arquivo": "src/components/app-ui/Agenda.tsx"
  },
  {
    "chave": "events.agenda.excluir",
    "rotulo": "Excluir — Agenda",
    "herda": "events.view",
    "arquivo": "src/components/app-ui/Agenda.tsx"
  },
  {
    "chave": "events.agenda.importar_csv",
    "rotulo": "Importar CSV — Agenda",
    "herda": "events.view",
    "arquivo": "src/components/app-ui/Agenda.tsx"
  },
  {
    "chave": "events.agenda.importar_registros",
    "rotulo": "Importar registros — Agenda",
    "herda": "events.view",
    "arquivo": "src/components/app-ui/Agenda.tsx"
  },
  {
    "chave": "events.agenda.modelo_csv",
    "rotulo": "Modelo CSV — Agenda",
    "herda": "events.view",
    "arquivo": "src/components/app-ui/Agenda.tsx"
  },
  {
    "chave": "events.agenda.novo",
    "rotulo": "Novo — Agenda",
    "herda": "events.create",
    "arquivo": "src/components/app-ui/Agenda.tsx"
  },
  {
    "chave": "events.agenda.novo_2",
    "rotulo": "Novo — Agenda",
    "herda": "events.view",
    "arquivo": "src/components/app-ui/Agenda.tsx"
  },
  {
    "chave": "events.agenda.novo_evento",
    "rotulo": "Novo Evento — Agenda",
    "herda": "events.create",
    "arquivo": "src/components/app-ui/Agenda.tsx"
  },
  {
    "chave": "events.agenda.novo_evento_2",
    "rotulo": "Novo evento — Agenda",
    "herda": "events.create",
    "arquivo": "src/components/app-ui/Agenda.tsx"
  },
  {
    "chave": "events.agenda.salvar",
    "rotulo": "Salvar — Agenda",
    "herda": "events.view",
    "arquivo": "src/components/app-ui/Agenda.tsx"
  },
  {
    "chave": "finance_executive.diretoria.excel",
    "rotulo": "Excel — Diretoria",
    "herda": "finance_executive.view",
    "arquivo": "src/app-ui/finance/Diretoria.tsx"
  },
  {
    "chave": "finance_executive.diretoria.imprimir",
    "rotulo": "Imprimir — Diretoria",
    "herda": "finance_executive.view",
    "arquivo": "src/app-ui/finance/Diretoria.tsx"
  },
  {
    "chave": "inbox.inbox.enviar",
    "rotulo": "Enviar — Inbox",
    "herda": "inbox.view",
    "arquivo": "src/components/app-ui/Inbox.tsx"
  },
  {
    "chave": "inbox.inbox.enviar_para_outro_campo",
    "rotulo": "Enviar para outro Campo — Inbox",
    "herda": "inbox.view",
    "arquivo": "src/components/app-ui/Inbox.tsx"
  },
  {
    "chave": "inbox.inbox.excluir",
    "rotulo": "Excluir — Inbox",
    "herda": "inbox.view",
    "arquivo": "src/components/app-ui/Inbox.tsx"
  },
  {
    "chave": "inbox.inbox.excluir_2",
    "rotulo": "Excluir ( ) — Inbox",
    "herda": "inbox.view",
    "arquivo": "src/components/app-ui/Inbox.tsx"
  },
  {
    "chave": "inbox.inbox.gerar_meu_e_mail_campo",
    "rotulo": "Gerar meu e-mail @ campo — Inbox",
    "herda": "inbox.view",
    "arquivo": "src/components/app-ui/Inbox.tsx"
  },
  {
    "chave": "inbox.inbox.nova_mensagem",
    "rotulo": "Nova mensagem — Inbox",
    "herda": "inbox.view",
    "arquivo": "src/components/app-ui/Inbox.tsx"
  },
  {
    "chave": "inbox.inbox.remover_attachment",
    "rotulo": "Remover (attachment) — Inbox",
    "herda": "inbox.view",
    "arquivo": "src/components/app-ui/Inbox.tsx"
  },
  {
    "chave": "integrations.integrations.desconectar",
    "rotulo": "Desconectar — Integrations",
    "herda": "integrations.view",
    "arquivo": "src/components/app-ui/system/Integrations.tsx"
  },
  {
    "chave": "internal_chat.chat_fab.excluir",
    "rotulo": "Excluir — Chat FAB",
    "herda": "internal_chat.delete",
    "arquivo": "src/components/app-ui/ChatFAB.tsx"
  },
  {
    "chave": "members.family_relationships.adicionar_membro",
    "rotulo": "Adicionar Membro — Family Relationships",
    "herda": "members.view",
    "arquivo": "src/components/app-ui/FamilyRelationships.tsx"
  },
  {
    "chave": "members.member_edit.salvar_alteracoes",
    "rotulo": "Salvar Alteracoes — Member Edit",
    "herda": "members.view",
    "arquivo": "src/components/app-ui/MemberEdit.tsx"
  },
  {
    "chave": "members.member_edit.salvar_alteracoes_2",
    "rotulo": "Salvar Alterações — Member Edit",
    "herda": "members.view",
    "arquivo": "src/components/app-ui/MemberEdit.tsx"
  },
  {
    "chave": "members.member_import.confirmar_e_importar_pt_br_membros",
    "rotulo": "Confirmar e Importar pt-BR membros — Member Import",
    "herda": "members.view",
    "arquivo": "src/components/app-ui/MemberImport.tsx"
  },
  {
    "chave": "members.member_import.nova_importacao",
    "rotulo": "Nova Importação — Member Import",
    "herda": "members.view",
    "arquivo": "src/components/app-ui/MemberImport.tsx"
  },
  {
    "chave": "members.member_notes.adicionar_primeira_nota",
    "rotulo": "Adicionar Primeira Nota — Member Notes",
    "herda": "members.view",
    "arquivo": "src/components/app-ui/MemberNotes.tsx"
  },
  {
    "chave": "members.member_notes.nova_nota",
    "rotulo": "Nova Nota — Member Notes",
    "herda": "members.view",
    "arquivo": "src/components/app-ui/MemberNotes.tsx"
  },
  {
    "chave": "members.member_profile.adicionar_familiar",
    "rotulo": "Adicionar familiar — Member Profile",
    "herda": "members.view",
    "arquivo": "src/components/app-ui/MemberProfile.tsx"
  },
  {
    "chave": "members.member_profile.adicionar_historico_em_outra_igreja",
    "rotulo": "Adicionar histórico em outra igreja — Member Profile",
    "herda": "members.view",
    "arquivo": "src/components/app-ui/MemberProfile.tsx"
  },
  {
    "chave": "members.member_profile.editar",
    "rotulo": "Editar — Member Profile",
    "herda": "members.view",
    "arquivo": "src/components/app-ui/MemberProfile.tsx"
  },
  {
    "chave": "members.member_profile.excluir",
    "rotulo": "Excluir — Member Profile",
    "herda": "members.view",
    "arquivo": "src/components/app-ui/MemberProfile.tsx"
  },
  {
    "chave": "members.member_profile.executar_ocorrencia_rapida",
    "rotulo": "Executar Ocorrência Rápida — Member Profile",
    "herda": "members.view",
    "arquivo": "src/components/app-ui/MemberProfile.tsx"
  },
  {
    "chave": "members.member_profile.nova_funcao",
    "rotulo": "Nova função — Member Profile",
    "herda": "members.view",
    "arquivo": "src/components/app-ui/MemberProfile.tsx"
  },
  {
    "chave": "members.member_profile.nova_ocorrencia",
    "rotulo": "Nova Ocorrência — Member Profile",
    "herda": "members.view",
    "arquivo": "src/components/app-ui/MemberProfile.tsx"
  },
  {
    "chave": "members.member_profile.remover_vinculo",
    "rotulo": "Remover vínculo — Member Profile",
    "herda": "members.view",
    "arquivo": "src/components/app-ui/MemberProfile.tsx"
  },
  {
    "chave": "members.member_profile.salvar",
    "rotulo": "Salvar — Member Profile",
    "herda": "members.view",
    "arquivo": "src/components/app-ui/MemberProfile.tsx"
  },
  {
    "chave": "members.member_registration.adicionar_historico_em_outra_igreja",
    "rotulo": "Adicionar histórico em outra igreja — Member Registration",
    "herda": "members.view",
    "arquivo": "src/components/app-ui/MemberRegistration.tsx"
  },
  {
    "chave": "members.member_registration.editar_membro",
    "rotulo": "Editar Membro — Member Registration",
    "herda": "members.view",
    "arquivo": "src/components/app-ui/MemberRegistration.tsx"
  },
  {
    "chave": "members.member_registration.incluir_na_consagracao",
    "rotulo": "Incluir na Consagração — Member Registration",
    "herda": "members.view",
    "arquivo": "src/components/app-ui/MemberRegistration.tsx"
  },
  {
    "chave": "members.member_registration.incluir_no_batismo",
    "rotulo": "Incluir no Batismo — Member Registration",
    "herda": "members.view",
    "arquivo": "src/components/app-ui/MemberRegistration.tsx"
  },
  {
    "chave": "members.member_registration.novo_cadastro",
    "rotulo": "Novo Cadastro — Member Registration",
    "herda": "members.view",
    "arquivo": "src/components/app-ui/MemberRegistration.tsx"
  },
  {
    "chave": "members.member_registration.remover_prev_church",
    "rotulo": "Remover (prev church) — Member Registration",
    "herda": "members.view",
    "arquivo": "src/components/app-ui/MemberRegistration.tsx"
  },
  {
    "chave": "members.member_registration.salvar_historico",
    "rotulo": "Salvar histórico — Member Registration",
    "herda": "members.view",
    "arquivo": "src/components/app-ui/MemberRegistration.tsx"
  },
  {
    "chave": "members.member_registration.salvar_membro",
    "rotulo": "Salvar Membro — Member Registration",
    "herda": "members.view",
    "arquivo": "src/components/app-ui/MemberRegistration.tsx"
  },
  {
    "chave": "members.members.editar",
    "rotulo": "Editar — Members",
    "herda": "members.view",
    "arquivo": "src/components/app-ui/Members.tsx"
  },
  {
    "chave": "members.members.excluir",
    "rotulo": "Excluir — Members",
    "herda": "members.view",
    "arquivo": "src/components/app-ui/Members.tsx"
  },
  {
    "chave": "members.members.excluir_tudo",
    "rotulo": "Excluir tudo — Members",
    "herda": "members.view",
    "arquivo": "src/components/app-ui/Members.tsx"
  },
  {
    "chave": "members.members.exportar_excel",
    "rotulo": "Exportar Excel — Members",
    "herda": "members.view",
    "arquivo": "src/components/app-ui/Members.tsx"
  },
  {
    "chave": "members.members.imprimir",
    "rotulo": "Imprimir — Members",
    "herda": "members.view",
    "arquivo": "src/components/app-ui/Members.tsx"
  },
  {
    "chave": "members.members.novo_membro",
    "rotulo": "Novo Membro — Members",
    "herda": "members.view",
    "arquivo": "src/components/app-ui/Members.tsx"
  },
  {
    "chave": "members.members.novo_pf",
    "rotulo": "Novo PF — Members",
    "herda": "members.view",
    "arquivo": "src/components/app-ui/Members.tsx"
  },
  {
    "chave": "members.members.novo_pj",
    "rotulo": "Novo PJ — Members",
    "herda": "members.view",
    "arquivo": "src/components/app-ui/Members.tsx"
  },
  {
    "chave": "membership_requests.membership_review_modal.aprovar_cadastro",
    "rotulo": "Aprovar cadastro — Membership Review Modal",
    "herda": "membership_requests.view",
    "arquivo": "src/app-ui/ecclesiastical/MembershipReviewModal.tsx"
  },
  {
    "chave": "membership_requests.membership_review_modal.aprovar_e_encerrar_acolhimento",
    "rotulo": "Aprovar e encerrar acolhimento — Membership Review Modal",
    "herda": "membership_requests.view",
    "arquivo": "src/app-ui/ecclesiastical/MembershipReviewModal.tsx"
  },
  {
    "chave": "membership_requests.membership_review_modal.enviar_por_whatsapp",
    "rotulo": "Enviar por WhatsApp — Membership Review Modal",
    "herda": "membership_requests.view",
    "arquivo": "src/app-ui/ecclesiastical/MembershipReviewModal.tsx"
  },
  {
    "chave": "membership_requests.membership_review_modal.reprovar",
    "rotulo": "Reprovar — Membership Review Modal",
    "herda": "membership_requests.view",
    "arquivo": "src/app-ui/ecclesiastical/MembershipReviewModal.tsx"
  },
  {
    "chave": "ministries.ministries.atualizar_ministerio_criar_ministerio",
    "rotulo": "Atualizar Ministério Criar Ministério — Ministries",
    "herda": "ministries.view",
    "arquivo": "src/components/app-ui/Ministries.tsx"
  },
  {
    "chave": "ministries.ministries.confirmar_exclusao",
    "rotulo": "Confirmar exclusão — Ministries",
    "herda": "ministries.ministries.excluir",
    "arquivo": "src/components/app-ui/Ministries.tsx"
  },
  {
    "chave": "ministries.ministries.editar",
    "rotulo": "Editar — Ministries",
    "herda": "ministries.edit",
    "arquivo": "src/components/app-ui/Ministries.tsx"
  },
  {
    "chave": "ministries.ministries.excluir",
    "rotulo": "Excluir — Ministries",
    "herda": "ministries.delete",
    "arquivo": "src/components/app-ui/Ministries.tsx"
  },
  {
    "chave": "ministries.ministries.novo_ministerio",
    "rotulo": "Novo Ministério — Ministries",
    "herda": "ministries.create",
    "arquivo": "src/components/app-ui/Ministries.tsx"
  },
  {
    "chave": "mobile_config.mobile_config.salvar",
    "rotulo": "Salvar — Mobile Config",
    "herda": "mobile_config.edit",
    "arquivo": "src/app-ui/mobile/MobileConfig.tsx"
  },
  {
    "chave": "mobile_config.mobile_config.salvar_igreja_mundial",
    "rotulo": "Salvar Igreja Mundial — Mobile Config",
    "herda": "mobile_config.view",
    "arquivo": "src/app-ui/mobile/MobileConfig.tsx"
  },
  {
    "chave": "notifications.notifications.editar",
    "rotulo": "Editar — Notifications",
    "herda": "notifications.view",
    "arquivo": "src/components/app-ui/Notifications.tsx"
  },
  {
    "chave": "notifications.notifications.excluir",
    "rotulo": "Excluir — Notifications",
    "herda": "notifications.view",
    "arquivo": "src/components/app-ui/Notifications.tsx"
  },
  {
    "chave": "notifications.notifications.nova_notificacao",
    "rotulo": "Nova notificação — Notifications",
    "herda": "notifications.view",
    "arquivo": "src/components/app-ui/Notifications.tsx"
  },
  {
    "chave": "notifications.notifications.salvar_alteracoes_criar_notificacao",
    "rotulo": "Salvar alterações Criar notificação — Notifications",
    "herda": "notifications.view",
    "arquivo": "src/components/app-ui/Notifications.tsx"
  },
  {
    "chave": "pastoral_reports.pastoral_reports.imprimir",
    "rotulo": "Imprimir — Pastoral Reports",
    "herda": "pastoral_reports.view",
    "arquivo": "src/app-ui/pastoral/PastoralReports.tsx"
  },
  {
    "chave": "pastoral_reports.pastoral_reports.imprimir_relatorio",
    "rotulo": "Imprimir relatório — Pastoral Reports",
    "herda": "pastoral_reports.view",
    "arquivo": "src/app-ui/pastoral/PastoralReports.tsx"
  },
  {
    "chave": "pastoral_visits.attach_journey_modal.anexar_cronograma",
    "rotulo": "Anexar cronograma — Attach Journey Modal",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/AttachJourneyModal.tsx"
  },
  {
    "chave": "pastoral_visits.conversation_modal.enviar",
    "rotulo": "Enviar — Conversation Modal",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/ConversationModal.tsx"
  },
  {
    "chave": "pastoral_visits.conversation_modal.gerar_outra",
    "rotulo": "Gerar outra — Conversation Modal",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/ConversationModal.tsx"
  },
  {
    "chave": "pastoral_visits.import_csv_modal.baixar_modelo",
    "rotulo": "Baixar modelo — Import Csv Modal",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/ImportCsvModal.tsx"
  },
  {
    "chave": "pastoral_visits.journey_analysis_modal.imprimir_a_analise",
    "rotulo": "Imprimir a análise — Journey Analysis Modal",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/JourneyAnalysisModal.tsx"
  },
  {
    "chave": "pastoral_visits.journey_matrix_editor.criar_cronograma_padrao",
    "rotulo": "Criar cronograma padrão — Journey Matrix Editor",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/JourneyMatrixEditor.tsx"
  },
  {
    "chave": "pastoral_visits.journey_matrix_editor.excluir_etapa",
    "rotulo": "Excluir etapa — Journey Matrix Editor",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/JourneyMatrixEditor.tsx"
  },
  {
    "chave": "pastoral_visits.journey_matrix_editor.nova_etapa",
    "rotulo": "Nova etapa — Journey Matrix Editor",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/JourneyMatrixEditor.tsx"
  },
  {
    "chave": "pastoral_visits.journey_matrix_editor.novo_cronograma",
    "rotulo": "Novo cronograma — Journey Matrix Editor",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/JourneyMatrixEditor.tsx"
  },
  {
    "chave": "pastoral_visits.journey_matrix_editor.salvar",
    "rotulo": "Salvar — Journey Matrix Editor",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/JourneyMatrixEditor.tsx"
  },
  {
    "chave": "pastoral_visits.journey_sends.csv",
    "rotulo": "CSV — Journey Sends",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/JourneySends.tsx"
  },
  {
    "chave": "pastoral_visits.journey_sends.editar_antes_de_enviar",
    "rotulo": "Editar antes de enviar — Journey Sends",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/JourneySends.tsx"
  },
  {
    "chave": "pastoral_visits.journey_sends.enviar_reply",
    "rotulo": "Enviar (reply) — Journey Sends",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/JourneySends.tsx"
  },
  {
    "chave": "pastoral_visits.journey_sends.enviar_sugestao",
    "rotulo": "Enviar sugestão — Journey Sends",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/JourneySends.tsx"
  },
  {
    "chave": "pastoral_visits.journey_sends.excel",
    "rotulo": "Excel — Journey Sends",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/JourneySends.tsx"
  },
  {
    "chave": "pastoral_visits.pastoral_attendance_detail.adicionar",
    "rotulo": "+ Adicionar • — Pastoral Attendance Detail",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/PastoralAttendanceDetail.tsx"
  },
  {
    "chave": "pastoral_visits.pastoral_attendance_detail.anexar_arquivo",
    "rotulo": "Anexar Arquivo — Pastoral Attendance Detail",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/PastoralAttendanceDetail.tsx"
  },
  {
    "chave": "pastoral_visits.pastoral_attendance_detail.criar_primeira_atividade",
    "rotulo": "Criar primeira atividade — Pastoral Attendance Detail",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/PastoralAttendanceDetail.tsx"
  },
  {
    "chave": "pastoral_visits.pastoral_attendance_detail.editar",
    "rotulo": "Editar — Pastoral Attendance Detail",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/PastoralAttendanceDetail.tsx"
  },
  {
    "chave": "pastoral_visits.pastoral_attendance_detail.excluir",
    "rotulo": "Excluir — Pastoral Attendance Detail",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/PastoralAttendanceDetail.tsx"
  },
  {
    "chave": "pastoral_visits.pastoral_attendance_detail.gerar_outra_sugestao_gerar_sugestao",
    "rotulo": "Gerar outra sugestão Gerar sugestão — Pastoral Attendance Detail",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/PastoralAttendanceDetail.tsx"
  },
  {
    "chave": "pastoral_visits.pastoral_attendance_detail.nova_atividade",
    "rotulo": "Nova Atividade — Pastoral Attendance Detail",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/PastoralAttendanceDetail.tsx"
  },
  {
    "chave": "pastoral_visits.pastoral_attendance_detail.remover",
    "rotulo": "Remover — Pastoral Attendance Detail",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/PastoralAttendanceDetail.tsx"
  },
  {
    "chave": "pastoral_visits.pastoral_attendance_detail.salvar",
    "rotulo": "Salvar — Pastoral Attendance Detail",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/PastoralAttendanceDetail.tsx"
  },
  {
    "chave": "pastoral_visits.pastoral_attendance_new.criar_atendimento",
    "rotulo": "Criar Atendimento — Pastoral Attendance New",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/PastoralAttendanceNew.tsx"
  },
  {
    "chave": "pastoral_visits.pastoral_cronograma.acompanhamento",
    "rotulo": "Acompanhamento — Pastoral Cronograma",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/PastoralCronograma.tsx"
  },
  {
    "chave": "pastoral_visits.pastoral_dashboard.csv",
    "rotulo": "CSV — Pastoral Dashboard",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/PastoralDashboard.tsx"
  },
  {
    "chave": "pastoral_visits.pastoral_dashboard.excel",
    "rotulo": "Excel — Pastoral Dashboard",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/PastoralDashboard.tsx"
  },
  {
    "chave": "pastoral_visits.pastoral_dashboard.imprimir",
    "rotulo": "Imprimir — Pastoral Dashboard",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/PastoralDashboard.tsx"
  },
  {
    "chave": "pastoral_visits.pastoral_distribuicao.desconectar",
    "rotulo": "Desconectar — Pastoral Distribuicao",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/PastoralDistribuicao.tsx"
  },
  {
    "chave": "pastoral_visits.pastoral_distribuicao.desconectar_marcados",
    "rotulo": "Desconectar marcados — Pastoral Distribuicao",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/PastoralDistribuicao.tsx"
  },
  {
    "chave": "pastoral_visits.pastoral_hub.envio_em_massa",
    "rotulo": "Envio em Massa — Pastoral Hub",
    "herda": "whatsapp_campaigns.view",
    "arquivo": "src/app-ui/pastoral/PastoralHub.tsx"
  },
  {
    "chave": "pastoral_visits.pastoral_hub.envios",
    "rotulo": "Envios — Pastoral Hub",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/PastoralHub.tsx"
  },
  {
    "chave": "pastoral_visits.pastoral_hub.importacoes",
    "rotulo": "Importações — Pastoral Hub",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/PastoralHub.tsx"
  },
  {
    "chave": "pastoral_visits.pastoral_imports.csv",
    "rotulo": "CSV — Pastoral Imports",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/PastoralImports.tsx"
  },
  {
    "chave": "pastoral_visits.pastoral_imports.excel",
    "rotulo": "Excel — Pastoral Imports",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/PastoralImports.tsx"
  },
  {
    "chave": "pastoral_visits.pastoral_imports.excluir_selecionados",
    "rotulo": "Excluir selecionados — Pastoral Imports",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/PastoralImports.tsx"
  },
  {
    "chave": "pastoral_visits.pastoral_imports.excluir_todos_os_lotes_importados",
    "rotulo": "Excluir todos os lotes importados — Pastoral Imports",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/PastoralImports.tsx"
  },
  {
    "chave": "pastoral_visits.pastoral_kanban.excluir_atendimento",
    "rotulo": "Excluir atendimento — Pastoral Kanban",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/PastoralKanban.tsx"
  },
  {
    "chave": "pastoral_visits.pastoral_kanban.excluir_selecionados",
    "rotulo": "Excluir selecionados — Pastoral Kanban",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/PastoralKanban.tsx"
  },
  {
    "chave": "pastoral_visits.pastoral_kanban.imprimir_relatorio_do_pipeline",
    "rotulo": "Imprimir Relatório do Pipeline — Pastoral Kanban",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/PastoralKanban.tsx"
  },
  {
    "chave": "pastoral_visits.pastoral_kanban.novo_atendimento",
    "rotulo": "Novo atendimento — Pastoral Kanban",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/PastoralKanban.tsx"
  },
  {
    "chave": "pastoral_visits.pastoral_kanban.novo_atendimento_2",
    "rotulo": "Novo Atendimento — Pastoral Kanban",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/PastoralKanban.tsx"
  },
  {
    "chave": "pastoral_visits.pastoral_mass_send.baixar_o_arquivo_modelo_com_as_colunas_a",
    "rotulo": "Baixar o arquivo-modelo com as colunas aceitas — Pastoral Mass Send",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/PastoralMassSend.tsx"
  },
  {
    "chave": "pastoral_visits.pastoral_mass_send.csv",
    "rotulo": "CSV — Pastoral Mass Send",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/PastoralMassSend.tsx"
  },
  {
    "chave": "pastoral_visits.pastoral_mass_send.enviar_mensagem_individual_pela_instanci",
    "rotulo": "Enviar mensagem individual pela instância selecionada — Pastoral Mass Send",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/PastoralMassSend.tsx"
  },
  {
    "chave": "pastoral_visits.pastoral_mass_send.excel",
    "rotulo": "Excel — Pastoral Mass Send",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/PastoralMassSend.tsx"
  },
  {
    "chave": "pastoral_visits.pastoral_mass_send.importar_csv",
    "rotulo": "Importar CSV — Pastoral Mass Send",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/PastoralMassSend.tsx"
  },
  {
    "chave": "pastoral_visits.pastoral_mass_send.parecer_pdf",
    "rotulo": "Parecer PDF — Pastoral Mass Send",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/PastoralMassSend.tsx"
  },
  {
    "chave": "pastoral_visits.pastoral_send_history.csv",
    "rotulo": "CSV — Pastoral Send History",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/PastoralSendHistory.tsx"
  },
  {
    "chave": "pastoral_visits.pastoral_send_history.enviar_reply",
    "rotulo": "Enviar (reply) — Pastoral Send History",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/PastoralSendHistory.tsx"
  },
  {
    "chave": "pastoral_visits.pastoral_send_history.enviar_sugestao",
    "rotulo": "Enviar sugestão — Pastoral Send History",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/PastoralSendHistory.tsx"
  },
  {
    "chave": "pastoral_visits.pastoral_send_history.excel",
    "rotulo": "Excel — Pastoral Send History",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/PastoralSendHistory.tsx"
  },
  {
    "chave": "pastoral_visits.pastoral_send_history.excluir_selecionados",
    "rotulo": "Excluir selecionados — Pastoral Send History",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/PastoralSendHistory.tsx"
  },
  {
    "chave": "pastoral_visits.pastoral_send_history.remover_ia_da_conversa",
    "rotulo": "Remover IA da conversa — Pastoral Send History",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/PastoralSendHistory.tsx"
  },
  {
    "chave": "pastoral_visits.pastoral_send_history.remover_ia_das_selecionadas",
    "rotulo": "Remover IA das selecionadas — Pastoral Send History",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/PastoralSendHistory.tsx"
  },
  {
    "chave": "pastoral_visits.pastoral_send_history.remover_ia_de_todos",
    "rotulo": "Remover IA de todos — Pastoral Send History",
    "herda": "pastoral_visits.view",
    "arquivo": "src/app-ui/pastoral/PastoralSendHistory.tsx"
  },
  {
    "chave": "peniel.peniel_dashboard.adicionar_card",
    "rotulo": "Adicionar Card — Peniel Dashboard",
    "herda": "peniel.view",
    "arquivo": "src/app-ui/peniel/PenielDashboard.tsx"
  },
  {
    "chave": "peniel.peniel_dashboard.adicionar_testemunho",
    "rotulo": "Adicionar Testemunho — Peniel Dashboard",
    "herda": "peniel.view",
    "arquivo": "src/app-ui/peniel/PenielDashboard.tsx"
  },
  {
    "chave": "peniel.peniel_dashboard.aprovar_all_selected",
    "rotulo": "Aprovar (all selected) — Peniel Dashboard",
    "herda": "peniel.view",
    "arquivo": "src/app-ui/peniel/PenielDashboard.tsx"
  },
  {
    "chave": "peniel.peniel_dashboard.aprovar_vaga",
    "rotulo": "Aprovar Vaga — Peniel Dashboard",
    "herda": "peniel.view",
    "arquivo": "src/app-ui/peniel/PenielDashboard.tsx"
  },
  {
    "chave": "peniel.peniel_dashboard.cancelar_edicao_editar",
    "rotulo": "Cancelar edição Editar — Peniel Dashboard",
    "herda": "peniel.view",
    "arquivo": "src/app-ui/peniel/PenielDashboard.tsx"
  },
  {
    "chave": "peniel.peniel_dashboard.criar_primeiro_encontro",
    "rotulo": "Criar Primeiro Encontro — Peniel Dashboard",
    "herda": "peniel.view",
    "arquivo": "src/app-ui/peniel/PenielDashboard.tsx"
  },
  {
    "chave": "peniel.peniel_dashboard.editar",
    "rotulo": "Editar — Peniel Dashboard",
    "herda": "peniel.view",
    "arquivo": "src/app-ui/peniel/PenielDashboard.tsx"
  },
  {
    "chave": "peniel.peniel_dashboard.editar_card",
    "rotulo": "Editar Card — Peniel Dashboard",
    "herda": "peniel.view",
    "arquivo": "src/app-ui/peniel/PenielDashboard.tsx"
  },
  {
    "chave": "peniel.peniel_dashboard.editar_testemunho",
    "rotulo": "Editar Testemunho — Peniel Dashboard",
    "herda": "peniel.view",
    "arquivo": "src/app-ui/peniel/PenielDashboard.tsx"
  },
  {
    "chave": "peniel.peniel_dashboard.enviar_lembrete_de_pagamento_por_whatsap",
    "rotulo": "Enviar lembrete de pagamento por WhatsApp — Peniel Dashboard",
    "herda": "peniel.view",
    "arquivo": "src/app-ui/peniel/PenielDashboard.tsx"
  },
  {
    "chave": "peniel.peniel_dashboard.excluir",
    "rotulo": "Excluir — Peniel Dashboard",
    "herda": "peniel.view",
    "arquivo": "src/app-ui/peniel/PenielDashboard.tsx"
  },
  {
    "chave": "peniel.peniel_dashboard.excluir_card",
    "rotulo": "Excluir Card — Peniel Dashboard",
    "herda": "peniel.view",
    "arquivo": "src/app-ui/peniel/PenielDashboard.tsx"
  },
  {
    "chave": "peniel.peniel_dashboard.excluir_inscricao",
    "rotulo": "Excluir Inscrição — Peniel Dashboard",
    "herda": "peniel.view",
    "arquivo": "src/app-ui/peniel/PenielDashboard.tsx"
  },
  {
    "chave": "peniel.peniel_dashboard.excluir_permanentemente",
    "rotulo": "Excluir Permanentemente — Peniel Dashboard",
    "herda": "peniel.view",
    "arquivo": "src/app-ui/peniel/PenielDashboard.tsx"
  },
  {
    "chave": "peniel.peniel_dashboard.excluir_testemunho",
    "rotulo": "Excluir Testemunho — Peniel Dashboard",
    "herda": "peniel.view",
    "arquivo": "src/app-ui/peniel/PenielDashboard.tsx"
  },
  {
    "chave": "peniel.peniel_dashboard.exportar_csv",
    "rotulo": "Exportar CSV — Peniel Dashboard",
    "herda": "peniel.view",
    "arquivo": "src/app-ui/peniel/PenielDashboard.tsx"
  },
  {
    "chave": "peniel.peniel_dashboard.imprimir",
    "rotulo": "Imprimir — Peniel Dashboard",
    "herda": "peniel.view",
    "arquivo": "src/app-ui/peniel/PenielDashboard.tsx"
  },
  {
    "chave": "peniel.peniel_dashboard.novo_evento",
    "rotulo": "Novo Evento — Peniel Dashboard",
    "herda": "peniel.view",
    "arquivo": "src/app-ui/peniel/PenielDashboard.tsx"
  },
  {
    "chave": "peniel.peniel_dashboard.salvar_alteracoes",
    "rotulo": "Salvar alterações — Peniel Dashboard",
    "herda": "peniel.view",
    "arquivo": "src/app-ui/peniel/PenielDashboard.tsx"
  },
  {
    "chave": "peniel.peniel_dashboard.salvar_alteracoes_cms",
    "rotulo": "Salvar Alterações CMS — Peniel Dashboard",
    "herda": "peniel.view",
    "arquivo": "src/app-ui/peniel/PenielDashboard.tsx"
  },
  {
    "chave": "peniel.peniel_dashboard.salvar_encontro",
    "rotulo": "Salvar Encontro — Peniel Dashboard",
    "herda": "peniel.view",
    "arquivo": "src/app-ui/peniel/PenielDashboard.tsx"
  },
  {
    "chave": "pipeline_config.pipelines_admin.criar_coluna_salvar_alteracoes",
    "rotulo": "Criar Coluna Salvar Alterações — Pipelines Admin",
    "herda": "pipeline_config.view",
    "arquivo": "src/app-ui/ecclesiastical/PipelinesAdmin.tsx"
  },
  {
    "chave": "pipeline_config.pipelines_admin.editar",
    "rotulo": "Editar — Pipelines Admin",
    "herda": "pipeline_config.view",
    "arquivo": "src/app-ui/ecclesiastical/PipelinesAdmin.tsx"
  },
  {
    "chave": "pipeline_config.pipelines_admin.excluir",
    "rotulo": "Excluir — Pipelines Admin",
    "herda": "pipeline_config.view",
    "arquivo": "src/app-ui/ecclesiastical/PipelinesAdmin.tsx"
  },
  {
    "chave": "pipeline_config.pipelines_admin.excluir_stage",
    "rotulo": "Excluir (stage) — Pipelines Admin",
    "herda": "pipeline_config.view",
    "arquivo": "src/app-ui/ecclesiastical/PipelinesAdmin.tsx"
  },
  {
    "chave": "pipeline_config.pipelines_admin.nova_coluna",
    "rotulo": "Nova Coluna — Pipelines Admin",
    "herda": "pipeline_config.view",
    "arquivo": "src/app-ui/ecclesiastical/PipelinesAdmin.tsx"
  },
  {
    "chave": "pipeline_config.pipelines_admin.novo_pipeline",
    "rotulo": "Novo pipeline — Pipelines Admin",
    "herda": "pipeline_config.view",
    "arquivo": "src/app-ui/ecclesiastical/PipelinesAdmin.tsx"
  },
  {
    "chave": "pipeline_config.pipelines_admin.novo_servico",
    "rotulo": "Novo Serviço — Pipelines Admin",
    "herda": "pipeline_config.view",
    "arquivo": "src/app-ui/ecclesiastical/PipelinesAdmin.tsx"
  },
  {
    "chave": "pipeline_config.pipelines_admin.salvar",
    "rotulo": "Salvar — Pipelines Admin",
    "herda": "pipeline_config.view",
    "arquivo": "src/app-ui/ecclesiastical/PipelinesAdmin.tsx"
  },
  {
    "chave": "pipeline_config.pipelines_admin.salvar_alteracoes",
    "rotulo": "Salvar Alterações — Pipelines Admin",
    "herda": "pipeline_config.view",
    "arquivo": "src/app-ui/ecclesiastical/PipelinesAdmin.tsx"
  },
  {
    "chave": "presence_tickets.ticket_presence_page.excluir",
    "rotulo": "Excluir ( ) — Ticket Presence Page",
    "herda": "presence_tickets.view",
    "arquivo": "src/app-ui/ecclesiastical/TicketPresencePage.tsx"
  },
  {
    "chave": "presence_tickets.ticket_presence_page.excluir_tiquete",
    "rotulo": "Excluir tíquete — Ticket Presence Page",
    "herda": "presence_tickets.view",
    "arquivo": "src/app-ui/ecclesiastical/TicketPresencePage.tsx"
  },
  {
    "chave": "presence_tickets.ticket_presence_page.gerar_ticket",
    "rotulo": "Gerar Ticket — Ticket Presence Page",
    "herda": "presence_tickets.view",
    "arquivo": "src/app-ui/ecclesiastical/TicketPresencePage.tsx"
  },
  {
    "chave": "presence_tickets.ticket_presence_page.gerar_tikets",
    "rotulo": "Gerar Tikets — Ticket Presence Page",
    "herda": "presence_tickets.view",
    "arquivo": "src/app-ui/ecclesiastical/TicketPresencePage.tsx"
  },
  {
    "chave": "presence_tickets.ticket_presence_page.imprimir_tiquetes_filtrados",
    "rotulo": "Imprimir tíquetes filtrados — Ticket Presence Page",
    "herda": "presence_tickets.view",
    "arquivo": "src/app-ui/ecclesiastical/TicketPresencePage.tsx"
  },
  {
    "chave": "reports.batismo.abrir",
    "rotulo": "Relatório de batismo",
    "herda": "reports.view",
    "arquivo": "src/components/app-ui/Reports.tsx"
  },
  {
    "chave": "reports.batismo.exportar_excel",
    "rotulo": "Exportar Excel",
    "herda": "reports.batismo.abrir",
    "arquivo": "src/components/app-ui/Reports.tsx"
  },
  {
    "chave": "reports.batismo.imprimir",
    "rotulo": "Imprimir",
    "herda": "reports.batismo.abrir",
    "arquivo": "src/components/app-ui/Reports.tsx"
  },
  {
    "chave": "reports.batismo.modelos",
    "rotulo": "Salvar e gerenciar modelos",
    "herda": "reports.batismo.abrir",
    "arquivo": "src/components/app-ui/Reports.tsx"
  },
  {
    "chave": "reports.consagracao.abrir",
    "rotulo": "Relatório de consagração",
    "herda": "reports.view",
    "arquivo": "src/components/app-ui/Reports.tsx"
  },
  {
    "chave": "reports.consagracao.exportar_excel",
    "rotulo": "Exportar Excel",
    "herda": "reports.consagracao.abrir",
    "arquivo": "src/components/app-ui/Reports.tsx"
  },
  {
    "chave": "reports.consagracao.imprimir",
    "rotulo": "Imprimir",
    "herda": "reports.consagracao.abrir",
    "arquivo": "src/components/app-ui/Reports.tsx"
  },
  {
    "chave": "reports.consagracao.modelos",
    "rotulo": "Salvar e gerenciar modelos",
    "herda": "reports.consagracao.abrir",
    "arquivo": "src/components/app-ui/Reports.tsx"
  },
  {
    "chave": "reports.credenciais.abrir",
    "rotulo": "Relatório de credenciais",
    "herda": "reports.view",
    "arquivo": "src/components/app-ui/Reports.tsx"
  },
  {
    "chave": "reports.credenciais.exportar_excel",
    "rotulo": "Exportar Excel",
    "herda": "reports.credenciais.abrir",
    "arquivo": "src/components/app-ui/Reports.tsx"
  },
  {
    "chave": "reports.credenciais.imprimir",
    "rotulo": "Imprimir",
    "herda": "reports.credenciais.abrir",
    "arquivo": "src/components/app-ui/Reports.tsx"
  },
  {
    "chave": "reports.credenciais.modelos",
    "rotulo": "Salvar e gerenciar modelos",
    "herda": "reports.credenciais.abrir",
    "arquivo": "src/components/app-ui/Reports.tsx"
  },
  {
    "chave": "reports.dashboards.aba",
    "rotulo": "Aba Dashboards",
    "herda": "reports.view",
    "arquivo": "src/components/app-ui/Reports.tsx"
  },
  {
    "chave": "reports.dashboards.gerenciar",
    "rotulo": "Adicionar, editar e excluir gráficos",
    "herda": "reports.dashboards.aba",
    "arquivo": "src/components/app-ui/Reports.tsx"
  },
  {
    "chave": "reports.funcoes.abrir",
    "rotulo": "Relatório de funções",
    "herda": "reports.view",
    "arquivo": "src/components/app-ui/Reports.tsx"
  },
  {
    "chave": "reports.igrejas.abrir",
    "rotulo": "Relatório de igrejas",
    "herda": "reports.view",
    "arquivo": "src/components/app-ui/Reports.tsx"
  },
  {
    "chave": "reports.igrejas.exportar_excel",
    "rotulo": "Exportar Excel",
    "herda": "reports.igrejas.abrir",
    "arquivo": "src/components/app-ui/Reports.tsx"
  },
  {
    "chave": "reports.igrejas.imprimir",
    "rotulo": "Imprimir",
    "herda": "reports.igrejas.abrir",
    "arquivo": "src/components/app-ui/Reports.tsx"
  },
  {
    "chave": "reports.igrejas.modelos",
    "rotulo": "Salvar e gerenciar modelos",
    "herda": "reports.igrejas.abrir",
    "arquivo": "src/components/app-ui/Reports.tsx"
  },
  {
    "chave": "reports.membros.abrir",
    "rotulo": "Relatório de membros",
    "herda": "reports.view",
    "arquivo": "src/components/app-ui/Reports.tsx"
  },
  {
    "chave": "reports.membros.exportar_excel",
    "rotulo": "Exportar Excel",
    "herda": "reports.membros.abrir",
    "arquivo": "src/components/app-ui/Reports.tsx"
  },
  {
    "chave": "reports.membros.imprimir",
    "rotulo": "Imprimir",
    "herda": "reports.membros.abrir",
    "arquivo": "src/components/app-ui/Reports.tsx"
  },
  {
    "chave": "reports.membros.modelos",
    "rotulo": "Salvar e gerenciar modelos",
    "herda": "reports.membros.abrir",
    "arquivo": "src/components/app-ui/Reports.tsx"
  },
  {
    "chave": "reports.presenca.abrir",
    "rotulo": "Relatório de presença",
    "herda": "reports.view",
    "arquivo": "src/components/app-ui/Reports.tsx"
  },
  {
    "chave": "reports.reports.excluir_dashboard",
    "rotulo": "Excluir dashboard — Reports",
    "herda": "reports.view",
    "arquivo": "src/components/app-ui/Reports.tsx"
  },
  {
    "chave": "reports.reports.novo_dashboard",
    "rotulo": "Novo dashboard — Reports",
    "herda": "reports.view",
    "arquivo": "src/components/app-ui/Reports.tsx"
  },
  {
    "chave": "reports.reports.remover",
    "rotulo": "Remover — Reports",
    "herda": "reports.view",
    "arquivo": "src/components/app-ui/Reports.tsx"
  },
  {
    "chave": "reports.reports.salvar_grafico",
    "rotulo": "Salvar gráfico — Reports",
    "herda": "reports.view",
    "arquivo": "src/components/app-ui/Reports.tsx"
  },
  {
    "chave": "reports.requerimentos.abrir",
    "rotulo": "Relatório de requerimentos",
    "herda": "reports.view",
    "arquivo": "src/components/app-ui/Reports.tsx"
  },
  {
    "chave": "reports.requerimentos.exportar_excel",
    "rotulo": "Exportar Excel",
    "herda": "reports.requerimentos.abrir",
    "arquivo": "src/components/app-ui/Reports.tsx"
  },
  {
    "chave": "reports.requerimentos.imprimir",
    "rotulo": "Imprimir",
    "herda": "reports.requerimentos.abrir",
    "arquivo": "src/components/app-ui/Reports.tsx"
  },
  {
    "chave": "reports.requerimentos.modelos",
    "rotulo": "Salvar e gerenciar modelos",
    "herda": "reports.requerimentos.abrir",
    "arquivo": "src/components/app-ui/Reports.tsx"
  },
  {
    "chave": "reports.transferencias.abrir",
    "rotulo": "Relatório de transferências",
    "herda": "reports.view",
    "arquivo": "src/components/app-ui/Reports.tsx"
  },
  {
    "chave": "reports.transferencias.exportar_excel",
    "rotulo": "Exportar Excel",
    "herda": "reports.transferencias.abrir",
    "arquivo": "src/components/app-ui/Reports.tsx"
  },
  {
    "chave": "reports.transferencias.imprimir",
    "rotulo": "Imprimir",
    "herda": "reports.transferencias.abrir",
    "arquivo": "src/components/app-ui/Reports.tsx"
  },
  {
    "chave": "reports.transferencias.modelos",
    "rotulo": "Salvar e gerenciar modelos",
    "herda": "reports.transferencias.abrir",
    "arquivo": "src/components/app-ui/Reports.tsx"
  },
  {
    "chave": "reports.usuarios.abrir",
    "rotulo": "Relatório de usuários",
    "herda": "reports.view",
    "arquivo": "src/components/app-ui/Reports.tsx"
  },
  {
    "chave": "requirements.requerimentos.anexar_arquivo",
    "rotulo": "Anexar arquivo — Requerimentos",
    "herda": "requirements.view",
    "arquivo": "src/app-ui/ecclesiastical/Requerimentos.tsx"
  },
  {
    "chave": "requirements.requerimentos.enviar_mensagem",
    "rotulo": "Enviar mensagem — Requerimentos",
    "herda": "requirements.view",
    "arquivo": "src/app-ui/ecclesiastical/Requerimentos.tsx"
  },
  {
    "chave": "requirements.requerimentos.exportar",
    "rotulo": "Exportar — Requerimentos",
    "herda": "requirements.view",
    "arquivo": "src/app-ui/ecclesiastical/Requerimentos.tsx"
  },
  {
    "chave": "requirements.requerimentos.imprimir",
    "rotulo": "Imprimir — Requerimentos",
    "herda": "requirements.view",
    "arquivo": "src/app-ui/ecclesiastical/Requerimentos.tsx"
  },
  {
    "chave": "requirements.requerimentos.incluir_requerimento",
    "rotulo": "Incluir requerimento — Requerimentos",
    "herda": "requirements.view",
    "arquivo": "src/app-ui/ecclesiastical/Requerimentos.tsx"
  },
  {
    "chave": "requirements.requerimentos.novo_requerimento",
    "rotulo": "Novo Requerimento — Requerimentos",
    "herda": "requirements.view",
    "arquivo": "src/app-ui/ecclesiastical/Requerimentos.tsx"
  },
  {
    "chave": "requirements.requerimentos.remover",
    "rotulo": "Remover — Requerimentos",
    "herda": "requirements.view",
    "arquivo": "src/app-ui/ecclesiastical/Requerimentos.tsx"
  },
  {
    "chave": "requirements.requerimentos.remover_arquivo",
    "rotulo": "Remover arquivo — Requerimentos",
    "herda": "requirements.view",
    "arquivo": "src/app-ui/ecclesiastical/Requerimentos.tsx"
  },
  {
    "chave": "santander_view.credenciais_modal.nova_credencial",
    "rotulo": "Nova Credencial — Credenciais Modal",
    "herda": "santander_view.view",
    "arquivo": "src/modules/financeiro/conciliacao-santander/frontend/CredenciaisModal.tsx"
  },
  {
    "chave": "santander_view.credenciais_modal.salvar",
    "rotulo": "Salvar — Credenciais Modal",
    "herda": "santander_view.view",
    "arquivo": "src/modules/financeiro/conciliacao-santander/frontend/CredenciaisModal.tsx"
  },
  {
    "chave": "santander_view.importar_febraban_modal.importar_movimentos",
    "rotulo": "Importar Movimentos — Importar Febraban Modal",
    "herda": "santander_view.view",
    "arquivo": "src/modules/financeiro/conciliacao-santander/frontend/ImportarFebrabanModal.tsx"
  },
  {
    "chave": "santander_view.santander_extrato_view.exportar_csv",
    "rotulo": "Exportar CSV — Santander Extrato View",
    "herda": "santander_view.view",
    "arquivo": "src/modules/financeiro/conciliacao-santander/frontend/SantanderExtratoView.tsx"
  },
  {
    "chave": "santander_view.santander_home_view.importar_febraban",
    "rotulo": "Importar FEBRABAN — Santander Home View",
    "herda": "santander_view.view",
    "arquivo": "src/modules/financeiro/conciliacao-santander/frontend/SantanderHomeView.tsx"
  },
  {
    "chave": "santander_view.santander_table.conciliar_manualmente",
    "rotulo": "Conciliar manualmente — Santander Table",
    "herda": "santander_view.view",
    "arquivo": "src/modules/financeiro/conciliacao-santander/frontend/SantanderTable.tsx"
  },
  {
    "chave": "santander_view.santander_table.lancar",
    "rotulo": "+ Lançar — Santander Table",
    "herda": "santander_view.view",
    "arquivo": "src/modules/financeiro/conciliacao-santander/frontend/SantanderTable.tsx"
  },
  {
    "chave": "secretaria_campanhas.attach_audience_modal.anexar_pessoa_s",
    "rotulo": "Anexar pessoa(s) — Attach Audience Modal",
    "herda": "secretaria_campanhas.view",
    "arquivo": "src/app-ui/secretaria/AttachAudienceModal.tsx"
  },
  {
    "chave": "secretaria_campanhas.campaign_builder_modal.pergunta_livre",
    "rotulo": "Pergunta livre — Campaign Builder Modal",
    "herda": "secretaria_campanhas.view",
    "arquivo": "src/app-ui/secretaria/CampaignBuilderModal.tsx"
  },
  {
    "chave": "secretaria_campanhas.campaign_builder_modal.remover_field",
    "rotulo": "Remover (field) — Campaign Builder Modal",
    "herda": "secretaria_campanhas.view",
    "arquivo": "src/app-ui/secretaria/CampaignBuilderModal.tsx"
  },
  {
    "chave": "secretaria_campanhas.campaign_builder_modal.salvar_campanha",
    "rotulo": "Salvar campanha — Campaign Builder Modal",
    "herda": "secretaria_campanhas.view",
    "arquivo": "src/app-ui/secretaria/CampaignBuilderModal.tsx"
  },
  {
    "chave": "secretaria_campanhas.campaign_response_drawer.aprovar_e_atualizar_cadastro",
    "rotulo": "Aprovar e atualizar cadastro — Campaign Response Drawer",
    "herda": "secretaria_campanhas.view",
    "arquivo": "src/app-ui/secretaria/CampaignResponseDrawer.tsx"
  },
  {
    "chave": "secretaria_campanhas.campaign_response_drawer.reprovar_e_pedir_correcao",
    "rotulo": "Reprovar e pedir correção — Campaign Response Drawer",
    "herda": "secretaria_campanhas.view",
    "arquivo": "src/app-ui/secretaria/CampaignResponseDrawer.tsx"
  },
  {
    "chave": "secretaria_campanhas.member_field_picker_modal.adicionar_campo_campos",
    "rotulo": "Adicionar campo campos — Member Field Picker Modal",
    "herda": "secretaria_campanhas.view",
    "arquivo": "src/app-ui/secretaria/MemberFieldPickerModal.tsx"
  },
  {
    "chave": "secretaria_campanhas.secretaria_campaigns.anexar_pessoas",
    "rotulo": "Anexar pessoas — Secretaria Campaigns",
    "herda": "secretaria_campanhas.view",
    "arquivo": "src/app-ui/secretaria/SecretariaCampaigns.tsx"
  },
  {
    "chave": "secretaria_campanhas.secretaria_campaigns.editar",
    "rotulo": "Editar — Secretaria Campaigns",
    "herda": "secretaria_campanhas.view",
    "arquivo": "src/app-ui/secretaria/SecretariaCampaigns.tsx"
  },
  {
    "chave": "secretaria_campanhas.secretaria_campaigns.enviar",
    "rotulo": "Enviar — Secretaria Campaigns",
    "herda": "secretaria_campanhas.view",
    "arquivo": "src/app-ui/secretaria/SecretariaCampaigns.tsx"
  },
  {
    "chave": "secretaria_campanhas.secretaria_campaigns.enviar_app",
    "rotulo": "Enviar (app) — Secretaria Campaigns",
    "herda": "secretaria_campanhas.view",
    "arquivo": "src/app-ui/secretaria/SecretariaCampaigns.tsx"
  },
  {
    "chave": "secretaria_campanhas.secretaria_campaigns.nova_campanha",
    "rotulo": "Nova campanha — Secretaria Campaigns",
    "herda": "secretaria_campanhas.view",
    "arquivo": "src/app-ui/secretaria/SecretariaCampaigns.tsx"
  },
  {
    "chave": "secretaria_campanhas.secretaria_campaigns.sem_instancia_de_whatsapp_escolher",
    "rotulo": "Sem instância de WhatsApp — escolher — Secretaria Campaigns",
    "herda": "secretaria_campanhas.view",
    "arquivo": "src/app-ui/secretaria/SecretariaCampaigns.tsx"
  },
  {
    "chave": "services.services_matrix.editar",
    "rotulo": "Editar — Services Matrix",
    "herda": "services.view",
    "arquivo": "src/app-ui/ecclesiastical/ServicesMatrix.tsx"
  },
  {
    "chave": "services.services_matrix.editar_servico",
    "rotulo": "Editar serviço — Services Matrix",
    "herda": "services.view",
    "arquivo": "src/app-ui/ecclesiastical/ServicesMatrix.tsx"
  },
  {
    "chave": "services.services_matrix.excluir",
    "rotulo": "Excluir — Services Matrix",
    "herda": "services.view",
    "arquivo": "src/app-ui/ecclesiastical/ServicesMatrix.tsx"
  },
  {
    "chave": "services.services_matrix.nova_regra",
    "rotulo": "Nova Regra — Services Matrix",
    "herda": "services.view",
    "arquivo": "src/app-ui/ecclesiastical/ServicesMatrix.tsx"
  },
  {
    "chave": "services.services_matrix.novo_servico",
    "rotulo": "Novo serviço — Services Matrix",
    "herda": "services.view",
    "arquivo": "src/app-ui/ecclesiastical/ServicesMatrix.tsx"
  },
  {
    "chave": "services.services_matrix.salvar",
    "rotulo": "Salvar — Services Matrix",
    "herda": "services.view",
    "arquivo": "src/app-ui/ecclesiastical/ServicesMatrix.tsx"
  },
  {
    "chave": "settings_api_keys.api_keys.criar_chave",
    "rotulo": "Criar Chave — Api Keys",
    "herda": "settings_api_keys.view",
    "arquivo": "src/components/app-ui/system/ApiKeys.tsx"
  },
  {
    "chave": "settings_api_keys.api_keys.nova_chave",
    "rotulo": "Nova Chave — Api Keys",
    "herda": "settings_api_keys.view",
    "arquivo": "src/components/app-ui/system/ApiKeys.tsx"
  },
  {
    "chave": "settings_backup.backup.criar_backup_manual",
    "rotulo": "Criar Backup Manual — Backup",
    "herda": "settings_backup.view",
    "arquivo": "src/components/app-ui/system/Backup.tsx"
  },
  {
    "chave": "settings_backup.backup.download",
    "rotulo": "Download — Backup",
    "herda": "settings_backup.view",
    "arquivo": "src/components/app-ui/system/Backup.tsx"
  },
  {
    "chave": "settings_backup.backup.excluir",
    "rotulo": "Excluir — Backup",
    "herda": "settings_backup.view",
    "arquivo": "src/components/app-ui/system/Backup.tsx"
  },
  {
    "chave": "settings_backup.backup.salvar_configuracoes",
    "rotulo": "Salvar Configuracoes — Backup",
    "herda": "settings_backup.view",
    "arquivo": "src/components/app-ui/system/Backup.tsx"
  },
  {
    "chave": "settings_branding.ai_settings.salvar_configuracoes",
    "rotulo": "Salvar Configurações — Ai Settings",
    "herda": "settings_branding.view",
    "arquivo": "src/components/app-ui/AiSettings.tsx"
  },
  {
    "chave": "settings_branding.branding.remover_logo",
    "rotulo": "Remover logo — Branding",
    "herda": "settings_branding.view",
    "arquivo": "src/components/app-ui/system/Branding.tsx"
  },
  {
    "chave": "settings_branding.branding.salvo_salvar_alteracoes",
    "rotulo": "Salvo! Salvar Alterações — Branding",
    "herda": "settings_branding.view",
    "arquivo": "src/components/app-ui/system/Branding.tsx"
  },
  {
    "chave": "settings_church_info.church_info.adicionar",
    "rotulo": "Adicionar — Church Info",
    "herda": "settings_church_info.view",
    "arquivo": "src/components/app-ui/system/ChurchInfo.tsx"
  },
  {
    "chave": "settings_church_info.church_info.excluir_access",
    "rotulo": "Excluir (access) — Church Info",
    "herda": "settings_church_info.view",
    "arquivo": "src/components/app-ui/system/ChurchInfo.tsx"
  },
  {
    "chave": "settings_church_info.church_info.excluir_schedule",
    "rotulo": "Excluir (schedule) — Church Info",
    "herda": "settings_church_info.view",
    "arquivo": "src/components/app-ui/system/ChurchInfo.tsx"
  },
  {
    "chave": "settings_church_info.church_info.salvar",
    "rotulo": "Salvar — Church Info",
    "herda": "settings_church_info.view",
    "arquivo": "src/components/app-ui/system/ChurchInfo.tsx"
  },
  {
    "chave": "settings_church_info.church_info.salvar_alteracoes",
    "rotulo": "Salvar Alteracoes — Church Info",
    "herda": "settings_church_info.view",
    "arquivo": "src/components/app-ui/system/ChurchInfo.tsx"
  },
  {
    "chave": "settings_email_config.email_settings.salvar_configuracoes",
    "rotulo": "Salvar Configurações — Email Settings",
    "herda": "settings_email_config.view",
    "arquivo": "src/components/app-ui/system/EmailSettings.tsx"
  },
  {
    "chave": "settings_home_publica.home_publica.adicionar_cartao",
    "rotulo": "Adicionar cartão — Home Publica",
    "herda": "settings_home_publica.view",
    "arquivo": "src/components/app-ui/system/HomePublica.tsx"
  },
  {
    "chave": "settings_home_publica.home_publica.editar",
    "rotulo": "Editar — Home Publica",
    "herda": "settings_home_publica.view",
    "arquivo": "src/components/app-ui/system/HomePublica.tsx"
  },
  {
    "chave": "settings_home_publica.home_publica.enviar_imagem",
    "rotulo": "Enviar imagem — Home Publica",
    "herda": "settings_home_publica.view",
    "arquivo": "src/components/app-ui/system/HomePublica.tsx"
  },
  {
    "chave": "settings_home_publica.home_publica.remover",
    "rotulo": "Remover — Home Publica",
    "herda": "settings_home_publica.view",
    "arquivo": "src/components/app-ui/system/HomePublica.tsx"
  },
  {
    "chave": "settings_home_publica.home_publica.remover_cartao",
    "rotulo": "Remover cartão — Home Publica",
    "herda": "settings_home_publica.view",
    "arquivo": "src/components/app-ui/system/HomePublica.tsx"
  },
  {
    "chave": "settings_home_publica.home_publica.remover_cor",
    "rotulo": "Remover cor — Home Publica",
    "herda": "settings_home_publica.view",
    "arquivo": "src/components/app-ui/system/HomePublica.tsx"
  },
  {
    "chave": "settings_home_publica.home_publica.salvo_salvar",
    "rotulo": "Salvo Salvar — Home Publica",
    "herda": "settings_home_publica.view",
    "arquivo": "src/components/app-ui/system/HomePublica.tsx"
  },
  {
    "chave": "settings_notifications.notification_settings.salvar_configuracoes",
    "rotulo": "Salvar Configurações — Notification Settings",
    "herda": "settings_notifications.view",
    "arquivo": "src/components/app-ui/system/NotificationSettings.tsx"
  },
  {
    "chave": "settings_security.security.adicionar",
    "rotulo": "Adicionar — Security",
    "herda": "settings_security.view",
    "arquivo": "src/components/app-ui/system/Security.tsx"
  },
  {
    "chave": "settings_security.security.salvar_configuracoes",
    "rotulo": "Salvar Configurações — Security",
    "herda": "settings_security.view",
    "arquivo": "src/components/app-ui/system/Security.tsx"
  },
  {
    "chave": "settings_sms_config.sms_settings.salvar_configuracoes",
    "rotulo": "Salvar Configurações — Sms Settings",
    "herda": "settings_sms_config.view",
    "arquivo": "src/components/app-ui/system/SmsSettings.tsx"
  },
  {
    "chave": "settings_templates.templates.criar_template",
    "rotulo": "Criar Template — Templates",
    "herda": "settings_templates.view",
    "arquivo": "src/components/app-ui/system/Templates.tsx"
  },
  {
    "chave": "settings_templates.templates.novo_template",
    "rotulo": "Novo Template — Templates",
    "herda": "settings_templates.view",
    "arquivo": "src/components/app-ui/system/Templates.tsx"
  },
  {
    "chave": "settings_webhooks.webhooks.criar_webhook",
    "rotulo": "Criar Webhook — Webhooks",
    "herda": "settings_webhooks.view",
    "arquivo": "src/components/app-ui/system/Webhooks.tsx"
  },
  {
    "chave": "settings_webhooks.webhooks.novo_webhook",
    "rotulo": "Novo Webhook — Webhooks",
    "herda": "settings_webhooks.view",
    "arquivo": "src/components/app-ui/system/Webhooks.tsx"
  },
  {
    "chave": "spreadsheets.spreadsheet.excluir",
    "rotulo": "Excluir — Spreadsheet",
    "herda": "spreadsheets.view",
    "arquivo": "src/app-ui/spreadsheet/Spreadsheet.tsx"
  },
  {
    "chave": "spreadsheets.spreadsheet.excluir_arquivo",
    "rotulo": "Excluir arquivo — Spreadsheet",
    "herda": "spreadsheets.view",
    "arquivo": "src/app-ui/spreadsheet/Spreadsheet.tsx"
  },
  {
    "chave": "spreadsheets.spreadsheet.importar_para_planilha",
    "rotulo": "✅ Importar para Planilha — Spreadsheet",
    "herda": "spreadsheets.view",
    "arquivo": "src/app-ui/spreadsheet/Spreadsheet.tsx"
  },
  {
    "chave": "spreadsheets.spreadsheet.nova_planilha",
    "rotulo": "Nova Planilha — Spreadsheet",
    "herda": "spreadsheets.view",
    "arquivo": "src/app-ui/spreadsheet/Spreadsheet.tsx"
  },
  {
    "chave": "spreadsheets.spreadsheet.salvar",
    "rotulo": "☁️ Salvar — Spreadsheet",
    "herda": "spreadsheets.view",
    "arquivo": "src/app-ui/spreadsheet/Spreadsheet.tsx"
  },
  {
    "chave": "system_grupos_usuarios.grupos_usuarios.adicionar",
    "rotulo": "Adicionar — Grupos Usuarios",
    "herda": "system_grupos_usuarios.view",
    "arquivo": "src/app-ui/system/GruposUsuarios.tsx"
  },
  {
    "chave": "system_grupos_usuarios.grupos_usuarios.criar_grupo",
    "rotulo": "Criar grupo — Grupos Usuarios",
    "herda": "system_grupos_usuarios.view",
    "arquivo": "src/app-ui/system/GruposUsuarios.tsx"
  },
  {
    "chave": "system_grupos_usuarios.grupos_usuarios.excluir_grupo",
    "rotulo": "Excluir grupo — Grupos Usuarios",
    "herda": "system_grupos_usuarios.view",
    "arquivo": "src/app-ui/system/GruposUsuarios.tsx"
  },
  {
    "chave": "system_grupos_usuarios.grupos_usuarios.novo_grupo",
    "rotulo": "Novo grupo — Grupos Usuarios",
    "herda": "system_grupos_usuarios.view",
    "arquivo": "src/app-ui/system/GruposUsuarios.tsx"
  },
  {
    "chave": "system_grupos_usuarios.grupos_usuarios.salvar_igrejas",
    "rotulo": "Salvar igrejas — Grupos Usuarios",
    "herda": "system_grupos_usuarios.view",
    "arquivo": "src/app-ui/system/GruposUsuarios.tsx"
  },
  {
    "chave": "system_grupos_usuarios.grupos_usuarios.salvar_nome",
    "rotulo": "Salvar nome — Grupos Usuarios",
    "herda": "system_grupos_usuarios.view",
    "arquivo": "src/app-ui/system/GruposUsuarios.tsx"
  },
  {
    "chave": "system_grupos_usuarios.grupos_usuarios.salvar_regras",
    "rotulo": "Salvar regras — Grupos Usuarios",
    "herda": "system_grupos_usuarios.view",
    "arquivo": "src/app-ui/system/GruposUsuarios.tsx"
  },
  {
    "chave": "system_grupos_usuarios.grupos_usuarios.tirar_do_grupo",
    "rotulo": "Tirar do grupo — Grupos Usuarios",
    "herda": "system_grupos_usuarios.view",
    "arquivo": "src/app-ui/system/GruposUsuarios.tsx"
  },
  {
    "chave": "system_roles.permissions_matrix.editar_permissoes",
    "rotulo": "Editar Permissões — Permissions Matrix",
    "herda": "system_roles.view",
    "arquivo": "src/app-ui/system/PermissionsMatrix.tsx"
  },
  {
    "chave": "system_roles.permissions_matrix.salvar_alteracoes",
    "rotulo": "Salvar Alterações — Permissions Matrix",
    "herda": "system_roles.view",
    "arquivo": "src/app-ui/system/PermissionsMatrix.tsx"
  },
  {
    "chave": "system_roles.roles.editar_funcao",
    "rotulo": "Editar funcao — Roles",
    "herda": "system_roles.view",
    "arquivo": "src/components/app-ui/system/Roles.tsx"
  },
  {
    "chave": "system_roles.roles.excluir_funcao",
    "rotulo": "Excluir funcao — Roles",
    "herda": "system_roles.view",
    "arquivo": "src/components/app-ui/system/Roles.tsx"
  },
  {
    "chave": "system_roles.roles.nova_funcao",
    "rotulo": "Nova Funcao — Roles",
    "herda": "system_roles.view",
    "arquivo": "src/components/app-ui/system/Roles.tsx"
  },
  {
    "chave": "system_roles.roles.salvar_alteracoes_criar_funcao",
    "rotulo": "Salvar alteracoes Criar funcao — Roles",
    "herda": "system_roles.view",
    "arquivo": "src/components/app-ui/system/Roles.tsx"
  },
  {
    "chave": "system_users.user_edit.salvar_alteracoes",
    "rotulo": "Salvar Alterações — User Edit",
    "herda": "system_users.view",
    "arquivo": "src/app-ui/system/UserEdit.tsx"
  },
  {
    "chave": "system_users.user_new.criar_usuario",
    "rotulo": "Criar Usuário — User New",
    "herda": "system_users.view",
    "arquivo": "src/app-ui/system/UserNew.tsx"
  },
  {
    "chave": "system_users.user_permissions.remover_todas_as_sobrescritas_usar_padro",
    "rotulo": "Remover todas as sobrescritas (usar padrões do perfil) — User Permissions",
    "herda": "system_users.view",
    "arquivo": "src/app-ui/system/UserPermissions.tsx"
  },
  {
    "chave": "system_users.user_permissions.salvar",
    "rotulo": "Salvar — User Permissions",
    "herda": "system_users.view",
    "arquivo": "src/app-ui/system/UserPermissions.tsx"
  },
  {
    "chave": "system_users.users_list.excluir",
    "rotulo": "Excluir — Users List",
    "herda": "system_users.view",
    "arquivo": "src/app-ui/system/UsersList.tsx"
  },
  {
    "chave": "system_users.users_list.salvar_nova_senha",
    "rotulo": "Salvar Nova Senha — Users List",
    "herda": "system_users.view",
    "arquivo": "src/app-ui/system/UsersList.tsx"
  },
  {
    "chave": "tela_app.app_daily_bread.clique_p_exportar",
    "rotulo": "clique p/ exportar — App Daily Bread",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/AppDailyBread.tsx"
  },
  {
    "chave": "tela_app.app_daily_bread.excluir_entrada",
    "rotulo": "Excluir entrada — App Daily Bread",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/AppDailyBread.tsx"
  },
  {
    "chave": "tela_app.app_daily_bread.exportar_excel",
    "rotulo": "Exportar Excel — App Daily Bread",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/AppDailyBread.tsx"
  },
  {
    "chave": "tela_app.app_daily_bread.imprimir",
    "rotulo": "Imprimir — App Daily Bread",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/AppDailyBread.tsx"
  },
  {
    "chave": "tela_app.app_daily_bread.nova_entrada",
    "rotulo": "Nova Entrada — App Daily Bread",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/AppDailyBread.tsx"
  },
  {
    "chave": "tela_app.app_daily_bread.salvar",
    "rotulo": "Salvar — App Daily Bread",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/AppDailyBread.tsx"
  },
  {
    "chave": "tela_app.app_event_checkin.novo_check_in",
    "rotulo": "Novo Check-in — App Event Checkin",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/AppEventCheckin.tsx"
  },
  {
    "chave": "tela_app.app_event_edit.adicionar",
    "rotulo": "Adicionar — App Event Edit",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/AppEventEdit.tsx"
  },
  {
    "chave": "tela_app.app_event_edit.remover_participant",
    "rotulo": "Remover (participant) — App Event Edit",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/AppEventEdit.tsx"
  },
  {
    "chave": "tela_app.app_event_edit.salvar_alteracoes",
    "rotulo": "Salvar Alterações — App Event Edit",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/AppEventEdit.tsx"
  },
  {
    "chave": "tela_app.app_event_new.adicionar",
    "rotulo": "Adicionar — App Event New",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/AppEventNew.tsx"
  },
  {
    "chave": "tela_app.app_event_new.adicionar_sala",
    "rotulo": "Adicionar sala — App Event New",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/AppEventNew.tsx"
  },
  {
    "chave": "tela_app.app_event_new.criar_evento",
    "rotulo": "Criar Evento — App Event New",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/AppEventNew.tsx"
  },
  {
    "chave": "tela_app.app_event_new.remover_participant",
    "rotulo": "Remover (participant) — App Event New",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/AppEventNew.tsx"
  },
  {
    "chave": "tela_app.app_event_new.remover_sector",
    "rotulo": "Remover (sector) — App Event New",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/AppEventNew.tsx"
  },
  {
    "chave": "tela_app.app_event_refunds.aprovar",
    "rotulo": "Aprovar — App Event Refunds",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/AppEventRefunds.tsx"
  },
  {
    "chave": "tela_app.app_event_view.editar",
    "rotulo": "Editar — App Event View",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/AppEventView.tsx"
  },
  {
    "chave": "tela_app.app_events.criar_primeiro_evento",
    "rotulo": "Criar primeiro evento — App Events",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/AppEvents.tsx"
  },
  {
    "chave": "tela_app.app_events.editar",
    "rotulo": "Editar — App Events",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/AppEvents.tsx"
  },
  {
    "chave": "tela_app.app_events.novo_evento",
    "rotulo": "Novo Evento — App Events",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/AppEvents.tsx"
  },
  {
    "chave": "tela_app.app_hqaccess.adicionar_instrucao",
    "rotulo": "Adicionar Instrução — App HQAccess",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/AppHQAccess.tsx"
  },
  {
    "chave": "tela_app.app_hqaccess.nova_instrucao",
    "rotulo": "Nova Instrução — App HQAccess",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/AppHQAccess.tsx"
  },
  {
    "chave": "tela_app.app_hqaccess.salvar",
    "rotulo": "Salvar — App HQAccess",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/AppHQAccess.tsx"
  },
  {
    "chave": "tela_app.app_hqschedule.adicionar_programacao",
    "rotulo": "Adicionar Programação — App HQSchedule",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/AppHQSchedule.tsx"
  },
  {
    "chave": "tela_app.app_hqschedule.nova_programacao",
    "rotulo": "Nova Programação — App HQSchedule",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/AppHQSchedule.tsx"
  },
  {
    "chave": "tela_app.app_hqschedule.salvar",
    "rotulo": "Salvar — App HQSchedule",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/AppHQSchedule.tsx"
  },
  {
    "chave": "tela_app.app_media_manager.criar_conteudo_salvar_alteracoes",
    "rotulo": "Criar conteúdo Salvar alterações — App Media Manager",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/media/AppMediaManager.tsx"
  },
  {
    "chave": "tela_app.app_media_manager.editar",
    "rotulo": "Editar — App Media Manager",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/media/AppMediaManager.tsx"
  },
  {
    "chave": "tela_app.app_media_manager.excluir",
    "rotulo": "Excluir — App Media Manager",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/media/AppMediaManager.tsx"
  },
  {
    "chave": "tela_app.app_media_manager.novo_conteudo",
    "rotulo": "Novo conteúdo — App Media Manager",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/media/AppMediaManager.tsx"
  },
  {
    "chave": "tela_app.app_notification_manager.editar",
    "rotulo": "Editar — App Notification Manager",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/AppNotificationManager.tsx"
  },
  {
    "chave": "tela_app.app_notification_manager.enviar_agora",
    "rotulo": "Enviar agora — App Notification Manager",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/AppNotificationManager.tsx"
  },
  {
    "chave": "tela_app.app_notification_manager.excluir",
    "rotulo": "Excluir — App Notification Manager",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/AppNotificationManager.tsx"
  },
  {
    "chave": "tela_app.app_notification_manager.nova_notificacao",
    "rotulo": "Nova notificação — App Notification Manager",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/AppNotificationManager.tsx"
  },
  {
    "chave": "tela_app.app_notification_manager.salvar",
    "rotulo": "Salvar — App Notification Manager",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/AppNotificationManager.tsx"
  },
  {
    "chave": "tela_app.app_registrations.aprovar",
    "rotulo": "Aprovar — App Registrations",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/AppRegistrations.tsx"
  },
  {
    "chave": "tela_app.app_registrations.aprovar_todos",
    "rotulo": "... Aprovar todos — App Registrations",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/AppRegistrations.tsx"
  },
  {
    "chave": "tela_app.app_registrations.confirmar_exclusao",
    "rotulo": "Confirmar Exclusão — App Registrations",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/AppRegistrations.tsx"
  },
  {
    "chave": "tela_app.app_registrations.excluir",
    "rotulo": "... Excluir — App Registrations",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/AppRegistrations.tsx"
  },
  {
    "chave": "tela_app.app_registrations.excluir_cadastro_e_usuario",
    "rotulo": "Excluir cadastro e usuário — App Registrations",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/AppRegistrations.tsx"
  },
  {
    "chave": "tela_app.app_registrations.excluir_todos",
    "rotulo": "Excluir todos — App Registrations",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/AppRegistrations.tsx"
  },
  {
    "chave": "tela_app.app_registrations.rejeitar",
    "rotulo": "Rejeitar — App Registrations",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/AppRegistrations.tsx"
  },
  {
    "chave": "tela_app.app_registrations.rejeitar_todos",
    "rotulo": "... Rejeitar todos — App Registrations",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/AppRegistrations.tsx"
  },
  {
    "chave": "tela_app.feed_manager.excluir_comentario",
    "rotulo": "Excluir comentário — Feed Manager",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/FeedManager.tsx"
  },
  {
    "chave": "tela_app.feed_manager.excluir_publicacao",
    "rotulo": "Excluir publicação — Feed Manager",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/FeedManager.tsx"
  },
  {
    "chave": "tela_app.feed_manager.nova_publicacao",
    "rotulo": "Nova publicação — Feed Manager",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/FeedManager.tsx"
  },
  {
    "chave": "tela_app.feed_manager.publicar_salvar_rascunho",
    "rotulo": "Publicar Salvar rascunho — Feed Manager",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/app/FeedManager.tsx"
  },
  {
    "chave": "tela_app.pedido_detail_panel.aprovar_reembolso",
    "rotulo": "✅ Aprovar Reembolso — Pedido Detail Panel",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/events/PedidoDetailPanel.tsx"
  },
  {
    "chave": "tela_app.pedido_detail_panel.enviar",
    "rotulo": "Enviar — Pedido Detail Panel",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/events/PedidoDetailPanel.tsx"
  },
  {
    "chave": "tela_app.pedido_detail_panel.excluir_definitivamente",
    "rotulo": "Excluir definitivamente — Pedido Detail Panel",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/events/PedidoDetailPanel.tsx"
  },
  {
    "chave": "tela_app.pedido_detail_panel.excluir_pedido_permanentemente",
    "rotulo": "Excluir pedido permanentemente — Pedido Detail Panel",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/events/PedidoDetailPanel.tsx"
  },
  {
    "chave": "tela_app.pedido_detail_panel.gerar_qr_codes",
    "rotulo": "Gerar QR Codes — Pedido Detail Panel",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/events/PedidoDetailPanel.tsx"
  },
  {
    "chave": "tela_app.pedido_detail_panel.gerar_qr_codes_para_todos_os_assentos",
    "rotulo": "Gerar QR Codes para todos os assentos — Pedido Detail Panel",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/events/PedidoDetailPanel.tsx"
  },
  {
    "chave": "tela_app.pedido_detail_panel.imprimir",
    "rotulo": "🖨 Imprimir — Pedido Detail Panel",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/events/PedidoDetailPanel.tsx"
  },
  {
    "chave": "tela_app.pedido_detail_panel.imprimir_2",
    "rotulo": "Imprimir — Pedido Detail Panel",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/events/PedidoDetailPanel.tsx"
  },
  {
    "chave": "tela_app.pedido_detail_panel.regenerar",
    "rotulo": "Regenerar — Pedido Detail Panel",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/events/PedidoDetailPanel.tsx"
  },
  {
    "chave": "tela_app.pedido_detail_panel.regenerar_qr_codes",
    "rotulo": "Regenerar QR Codes — Pedido Detail Panel",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/events/PedidoDetailPanel.tsx"
  },
  {
    "chave": "tela_app.pedido_detail_panel.transferir_ingresso_para_outro_membro",
    "rotulo": "Transferir ingresso para outro membro — Pedido Detail Panel",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/events/PedidoDetailPanel.tsx"
  },
  {
    "chave": "tela_app.pedidos_kanban.gerar_qr_code",
    "rotulo": "Gerar QR Code — Pedidos Kanban",
    "herda": "tela_app.view",
    "arquivo": "src/app-ui/events/PedidosKanban.tsx"
  },
  {
    "chave": "tela_assistentes_ia.ai_assistants.atualizar_assistente_criar_assistente",
    "rotulo": "Atualizar Assistente Criar Assistente — Ai Assistants",
    "herda": "tela_assistentes_ia.view",
    "arquivo": "src/app-ui/finance/AiAssistants.tsx"
  },
  {
    "chave": "tela_assistentes_ia.ai_assistants.criar_assistente",
    "rotulo": "Criar Assistente — Ai Assistants",
    "herda": "tela_assistentes_ia.view",
    "arquivo": "src/app-ui/finance/AiAssistants.tsx"
  },
  {
    "chave": "tela_assistentes_ia.ai_assistants.editar_assistente",
    "rotulo": "Editar assistente — Ai Assistants",
    "herda": "tela_assistentes_ia.view",
    "arquivo": "src/app-ui/finance/AiAssistants.tsx"
  },
  {
    "chave": "tela_assistentes_ia.ai_assistants.enviar_mensagem",
    "rotulo": "Enviar mensagem ao assistente — Ai Assistants",
    "herda": "tela_assistentes_ia.view",
    "arquivo": "src/app-ui/finance/AiAssistants.tsx"
  },
  {
    "chave": "tela_assistentes_ia.ai_assistants.excluir_assistente",
    "rotulo": "Excluir assistente — Ai Assistants",
    "herda": "tela_assistentes_ia.view",
    "arquivo": "src/app-ui/finance/AiAssistants.tsx"
  },
  {
    "chave": "tela_assistentes_ia.ai_assistants.excluir_conversa",
    "rotulo": "Excluir conversa — Ai Assistants",
    "herda": "tela_assistentes_ia.view",
    "arquivo": "src/app-ui/finance/AiAssistants.tsx"
  },
  {
    "chave": "tela_assistentes_ia.ai_assistants.excluir_esta_conversa",
    "rotulo": "Excluir esta conversa — Ai Assistants",
    "herda": "tela_assistentes_ia.view",
    "arquivo": "src/app-ui/finance/AiAssistants.tsx"
  },
  {
    "chave": "tela_assistentes_ia.ai_assistants.nova_conversa",
    "rotulo": "Nova conversa — Ai Assistants",
    "herda": "tela_assistentes_ia.view",
    "arquivo": "src/app-ui/finance/AiAssistants.tsx"
  },
  {
    "chave": "tela_cadastros_auxiliares.lookup_crud.editar",
    "rotulo": "Editar — Lookup Crud",
    "herda": "tela_cadastros_auxiliares.view",
    "arquivo": "src/app-ui/system/LookupCrud.tsx"
  },
  {
    "chave": "tela_cadastros_auxiliares.lookup_crud.excluir",
    "rotulo": "Excluir — Lookup Crud",
    "herda": "tela_cadastros_auxiliares.view",
    "arquivo": "src/app-ui/system/LookupCrud.tsx"
  },
  {
    "chave": "tela_cadastros_auxiliares.lookup_crud.novo_item",
    "rotulo": "Novo item — Lookup Crud",
    "herda": "tela_cadastros_auxiliares.view",
    "arquivo": "src/app-ui/system/LookupCrud.tsx"
  },
  {
    "chave": "tela_cadastros_auxiliares.lookup_crud.salvar",
    "rotulo": "Salvar — Lookup Crud",
    "herda": "tela_cadastros_auxiliares.view",
    "arquivo": "src/app-ui/system/LookupCrud.tsx"
  },
  {
    "chave": "tela_cms.cmsdashboard.criar_e_abrir_o_editor",
    "rotulo": "Criar e abrir o editor — CMSDashboard",
    "herda": "tela_cms.view",
    "arquivo": "src/app-ui/cms/CMSDashboard.tsx"
  },
  {
    "chave": "tela_cms.cmsdashboard.editar",
    "rotulo": "Editar — CMSDashboard",
    "herda": "tela_cms.view",
    "arquivo": "src/app-ui/cms/CMSDashboard.tsx"
  },
  {
    "chave": "tela_cms.cmsdashboard.nova_pagina",
    "rotulo": "Nova página — CMSDashboard",
    "herda": "tela_cms.view",
    "arquivo": "src/app-ui/cms/CMSDashboard.tsx"
  },
  {
    "chave": "tela_cms.cmsdept_builder.adicionar",
    "rotulo": "Adicionar — CMSDept Builder",
    "herda": "tela_cms.view",
    "arquivo": "src/app-ui/cms/CMSDeptBuilder.tsx"
  },
  {
    "chave": "tela_cms.cmsdept_builder.remover_bloco",
    "rotulo": "Remover bloco — CMSDept Builder",
    "herda": "tela_cms.view",
    "arquivo": "src/app-ui/cms/CMSDeptBuilder.tsx"
  },
  {
    "chave": "tela_cms.cmsdept_builder.remover_item",
    "rotulo": "Remover item — CMSDept Builder",
    "herda": "tela_cms.view",
    "arquivo": "src/app-ui/cms/CMSDeptBuilder.tsx"
  },
  {
    "chave": "tela_cms.cmsdept_builder.republicar_publicar",
    "rotulo": "Republicar Publicar — CMSDept Builder",
    "herda": "tela_cms.view",
    "arquivo": "src/app-ui/cms/CMSDeptBuilder.tsx"
  },
  {
    "chave": "tela_cms.cmsdept_builder.salvar",
    "rotulo": "Salvar — CMSDept Builder",
    "herda": "tela_cms.view",
    "arquivo": "src/app-ui/cms/CMSDeptBuilder.tsx"
  },
  {
    "chave": "tela_cms.cmsdept_preview.republicar_publicar",
    "rotulo": "Republicar Publicar — CMSDept Preview",
    "herda": "tela_cms.view",
    "arquivo": "src/app-ui/cms/CMSDeptPreview.tsx"
  },
  {
    "chave": "tela_cms.cmsdept_produtos.adicionar",
    "rotulo": "Adicionar — CMSDept Produtos",
    "herda": "tela_cms.view",
    "arquivo": "src/app-ui/cms/CMSDeptProdutos.tsx"
  },
  {
    "chave": "tela_cms.cmsdept_produtos.editar",
    "rotulo": "Editar — CMSDept Produtos",
    "herda": "tela_cms.view",
    "arquivo": "src/app-ui/cms/CMSDeptProdutos.tsx"
  },
  {
    "chave": "tela_cms.cmsdept_produtos.novo_produto",
    "rotulo": "Novo produto — CMSDept Produtos",
    "herda": "tela_cms.view",
    "arquivo": "src/app-ui/cms/CMSDeptProdutos.tsx"
  },
  {
    "chave": "tela_cms.cmsdept_produtos.remover_linha",
    "rotulo": "Remover linha — CMSDept Produtos",
    "herda": "tela_cms.view",
    "arquivo": "src/app-ui/cms/CMSDeptProdutos.tsx"
  },
  {
    "chave": "tela_cms.cmsdept_produtos.remover_variacao",
    "rotulo": "Remover variação — CMSDept Produtos",
    "herda": "tela_cms.view",
    "arquivo": "src/app-ui/cms/CMSDeptProdutos.tsx"
  },
  {
    "chave": "tela_cms.cmsdept_produtos.salvar_produto",
    "rotulo": "Salvar produto — CMSDept Produtos",
    "herda": "tela_cms.view",
    "arquivo": "src/app-ui/cms/CMSDeptProdutos.tsx"
  },
  {
    "chave": "tela_cms.cmsdept_settings.despublicar_publicar",
    "rotulo": "Despublicar Publicar — CMSDept Settings",
    "herda": "tela_cms.view",
    "arquivo": "src/app-ui/cms/CMSDeptSettings.tsx"
  },
  {
    "chave": "tela_cms.cmspage_builder.adicionar_block",
    "rotulo": "Adicionar (block) — CMSPage Builder",
    "herda": "tela_cms.view",
    "arquivo": "src/app-ui/cms/CMSPageBuilder.tsx"
  },
  {
    "chave": "tela_cms.cmspage_builder.adicionar_bloco",
    "rotulo": "Adicionar bloco — CMSPage Builder",
    "herda": "tela_cms.view",
    "arquivo": "src/app-ui/cms/CMSPageBuilder.tsx"
  },
  {
    "chave": "tela_cms.cmspage_builder.remover_bloco",
    "rotulo": "Remover bloco — CMSPage Builder",
    "herda": "tela_cms.view",
    "arquivo": "src/app-ui/cms/CMSPageBuilder.tsx"
  },
  {
    "chave": "tela_cms.cmspage_builder.salvo_salvar",
    "rotulo": "Salvo! Salvar — CMSPage Builder",
    "herda": "tela_cms.view",
    "arquivo": "src/app-ui/cms/CMSPageBuilder.tsx"
  },
  {
    "chave": "tela_comunicacao.communication.nova_campanha",
    "rotulo": "Nova Campanha — Communication",
    "herda": "tela_comunicacao.view",
    "arquivo": "src/components/app-ui/Communication.tsx"
  },
  {
    "chave": "tela_comunicacao.email_campaigns.novo_template",
    "rotulo": "Novo Template — Email Campaigns",
    "herda": "tela_comunicacao.view",
    "arquivo": "src/components/app-ui/EmailCampaigns.tsx"
  },
  {
    "chave": "tela_comunicacao.whats_app_instances.criar_instancia",
    "rotulo": "Criar Instância — Whats App Instances",
    "herda": "tela_comunicacao.view",
    "arquivo": "src/components/app-ui-screens/communication/WhatsAppInstances.tsx"
  },
  {
    "chave": "tela_comunicacao.whats_app_instances.desconectar",
    "rotulo": "Desconectar — Whats App Instances",
    "herda": "tela_comunicacao.view",
    "arquivo": "src/components/app-ui-screens/communication/WhatsAppInstances.tsx"
  },
  {
    "chave": "tela_comunicacao.whats_app_instances.nova_instancia",
    "rotulo": "Nova Instância — Whats App Instances",
    "herda": "tela_comunicacao.view",
    "arquivo": "src/components/app-ui-screens/communication/WhatsAppInstances.tsx"
  },
  {
    "chave": "tela_comunicacao.whats_app_instances.salvar_alteracoes",
    "rotulo": "Salvar alterações — Whats App Instances",
    "herda": "tela_comunicacao.view",
    "arquivo": "src/components/app-ui-screens/communication/WhatsAppInstances.tsx"
  },
  {
    "chave": "tela_comunicacao.whats_app.enviar_mensagem",
    "rotulo": "Enviar mensagem — Whats App",
    "herda": "tela_comunicacao.view",
    "arquivo": "src/components/app-ui/WhatsApp.tsx"
  },
  {
    "chave": "tela_credenciais.modelos_credencial.cadastrar",
    "rotulo": "Cadastrar — Modelos Credencial",
    "herda": "tela_credenciais.view",
    "arquivo": "src/app-ui/ecclesiastical/ModelosCredencial.tsx"
  },
  {
    "chave": "tela_credenciais.modelos_credencial.excluir",
    "rotulo": "Excluir — Modelos Credencial",
    "herda": "tela_credenciais.view",
    "arquivo": "src/app-ui/ecclesiastical/ModelosCredencial.tsx"
  },
  {
    "chave": "tela_credenciais.solicitacoes_credencial.alterar_situacao",
    "rotulo": "Alterar situação da solicitação — Solicitacoes Credencial",
    "herda": "tela_credenciais.view",
    "arquivo": "src/app-ui/ecclesiastical/SolicitacoesCredencial.tsx"
  },
  {
    "chave": "tela_credenciais.solicitacoes_credencial.aprovar",
    "rotulo": "Aprovar — Solicitacoes Credencial",
    "herda": "tela_credenciais.view",
    "arquivo": "src/app-ui/ecclesiastical/SolicitacoesCredencial.tsx"
  },
  {
    "chave": "tela_crm.crmdetail.enviar_mensagem",
    "rotulo": "Enviar Mensagem — CRMDetail",
    "herda": "tela_crm.view",
    "arquivo": "src/components/app-ui/CRMDetail.tsx"
  },
  {
    "chave": "tela_crm.crmpipeline.adicionar_lead",
    "rotulo": "Adicionar Lead — CRMPipeline",
    "herda": "tela_crm.view",
    "arquivo": "src/components/app-ui/CRMPipeline.tsx"
  },
  {
    "chave": "tela_crm.crmpipeline.imprimir",
    "rotulo": "Imprimir — CRMPipeline",
    "herda": "tela_crm.view",
    "arquivo": "src/components/app-ui/CRMPipeline.tsx"
  },
  {
    "chave": "tela_crm.lead_detail.adicionar_atividade",
    "rotulo": "Adicionar Atividade — Lead Detail",
    "herda": "tela_crm.view",
    "arquivo": "src/components/app-ui/LeadDetail.tsx"
  },
  {
    "chave": "tela_crm.lead_detail.adicionar_tag",
    "rotulo": "+ Adicionar Tag — Lead Detail",
    "herda": "tela_crm.view",
    "arquivo": "src/components/app-ui/LeadDetail.tsx"
  },
  {
    "chave": "tela_crm.lead_detail.criar_tarefa",
    "rotulo": "Criar Tarefa — Lead Detail",
    "herda": "tela_crm.view",
    "arquivo": "src/components/app-ui/LeadDetail.tsx"
  },
  {
    "chave": "tela_crm.lead_detail.editar",
    "rotulo": "Editar — Lead Detail",
    "herda": "tela_crm.view",
    "arquivo": "src/components/app-ui/LeadDetail.tsx"
  },
  {
    "chave": "tela_crm.lead_detail.enviar_email",
    "rotulo": "Enviar Email — Lead Detail",
    "herda": "tela_crm.view",
    "arquivo": "src/components/app-ui/LeadDetail.tsx"
  },
  {
    "chave": "tela_crm.lead_detail.salvar_nota",
    "rotulo": "Salvar Nota — Lead Detail",
    "herda": "tela_crm.view",
    "arquivo": "src/components/app-ui/LeadDetail.tsx"
  },
  {
    "chave": "tela_crm.lead_new.salvar_lead",
    "rotulo": "Salvar Lead — Lead New",
    "herda": "tela_crm.view",
    "arquivo": "src/components/app-ui/forms/LeadNew.tsx"
  },
  {
    "chave": "tela_crm.prospecting_module.novo_lead",
    "rotulo": "Novo Lead — Prospecting Module",
    "herda": "tela_crm.view",
    "arquivo": "src/components/app-ui/ProspectingModule.tsx"
  },
  {
    "chave": "tela_culto_registro.culto_registro_drawer.aprovar_e_concluir",
    "rotulo": "Aprovar e concluir — Culto Registro Drawer",
    "herda": "tela_culto_registro.view",
    "arquivo": "src/app-ui/culto/CultoRegistroDrawer.tsx"
  },
  {
    "chave": "tela_culto_registro.culto_registro_drawer.aprovar_pelo_dirigente_aprovar",
    "rotulo": "Aprovar pelo dirigente Aprovar — Culto Registro Drawer",
    "herda": "tela_culto_registro.view",
    "arquivo": "src/app-ui/culto/CultoRegistroDrawer.tsx"
  },
  {
    "chave": "tela_culto_registro.culto_registro_drawer.atualizar_enviar",
    "rotulo": "Atualizar Enviar — Culto Registro Drawer",
    "herda": "tela_culto_registro.view",
    "arquivo": "src/app-ui/culto/CultoRegistroDrawer.tsx"
  },
  {
    "chave": "tela_culto_registro.culto_registro_drawer.editar_a_observacao_presidente",
    "rotulo": "Editar a observação (presidente) — Culto Registro Drawer",
    "herda": "tela_culto_registro.view",
    "arquivo": "src/app-ui/culto/CultoRegistroDrawer.tsx"
  },
  {
    "chave": "tela_culto_registro.culto_registro_drawer.excluir",
    "rotulo": "Excluir — Culto Registro Drawer",
    "herda": "tela_culto_registro.view",
    "arquivo": "src/app-ui/culto/CultoRegistroDrawer.tsx"
  },
  {
    "chave": "tela_culto_registro.culto_registro_drawer.excluir_culto",
    "rotulo": "Excluir culto — Culto Registro Drawer",
    "herda": "tela_culto_registro.view",
    "arquivo": "src/app-ui/culto/CultoRegistroDrawer.tsx"
  },
  {
    "chave": "tela_culto_registro.culto_registro_drawer.excluir_envio",
    "rotulo": "Excluir envio — Culto Registro Drawer",
    "herda": "tela_culto_registro.view",
    "arquivo": "src/app-ui/culto/CultoRegistroDrawer.tsx"
  },
  {
    "chave": "tela_culto_registro.culto_registro_drawer.imprimir",
    "rotulo": "Imprimir — Culto Registro Drawer",
    "herda": "tela_culto_registro.view",
    "arquivo": "src/app-ui/culto/CultoRegistroDrawer.tsx"
  },
  {
    "chave": "tela_culto_registro.culto_registro_drawer.salvar",
    "rotulo": "Salvar — Culto Registro Drawer",
    "herda": "tela_culto_registro.view",
    "arquivo": "src/app-ui/culto/CultoRegistroDrawer.tsx"
  },
  {
    "chave": "tela_culto_registro.culto_registro_drawer.salvar_parecer",
    "rotulo": "Salvar parecer — Culto Registro Drawer",
    "herda": "tela_culto_registro.view",
    "arquivo": "src/app-ui/culto/CultoRegistroDrawer.tsx"
  },
  {
    "chave": "tela_eventos.event_detail.editar",
    "rotulo": "Editar — Event Detail",
    "herda": "tela_eventos.view",
    "arquivo": "src/components/app-ui/EventDetail.tsx"
  },
  {
    "chave": "tela_financas.finance_transactions.exportar",
    "rotulo": "Exportar — Finance Transactions",
    "herda": "tela_financas.view",
    "arquivo": "src/components/app-ui/FinanceTransactions.tsx"
  },
  {
    "chave": "tela_financas.finance.exportar",
    "rotulo": "Exportar — Finance",
    "herda": "tela_financas.view",
    "arquivo": "src/components/app-ui/Finance.tsx"
  },
  {
    "chave": "tela_gf.cell_form.remover_lider",
    "rotulo": "Remover líder — Cell Form",
    "herda": "tela_gf.view",
    "arquivo": "src/components/app-ui/cells/CellForm.tsx"
  },
  {
    "chave": "tela_gf.cells_list.nova_celula",
    "rotulo": "Nova Célula — Cells List",
    "herda": "tela_gf.view",
    "arquivo": "src/app-ui/cells/CellsList.tsx"
  },
  {
    "chave": "tela_gf.cells_list.salvar_celula",
    "rotulo": "Salvar Célula — Cells List",
    "herda": "tela_gf.view",
    "arquivo": "src/app-ui/cells/CellsList.tsx"
  },
  {
    "chave": "tela_import_export.import_export.baixar_template_csv",
    "rotulo": "Baixar Template CSV — Import Export",
    "herda": "tela_import_export.view",
    "arquivo": "src/components/app-ui/system/ImportExport.tsx"
  },
  {
    "chave": "tela_import_export.import_export.importar",
    "rotulo": "Importar — Import Export",
    "herda": "tela_import_export.view",
    "arquivo": "src/components/app-ui/system/ImportExport.tsx"
  },
  {
    "chave": "tela_import_export.import_export.importar_registros",
    "rotulo": "Importar registros — Import Export",
    "herda": "tela_import_export.view",
    "arquivo": "src/components/app-ui/system/ImportExport.tsx"
  },
  {
    "chave": "tela_import_export.import_export.nova_importacao",
    "rotulo": "Nova Importação — Import Export",
    "herda": "tela_import_export.view",
    "arquivo": "src/components/app-ui/system/ImportExport.tsx"
  },
  {
    "chave": "tela_import_export.import_export.template_csv",
    "rotulo": "Template CSV — Import Export",
    "herda": "tela_import_export.view",
    "arquivo": "src/components/app-ui/system/ImportExport.tsx"
  },
  {
    "chave": "tela_lancamento_recibo.lancamento_new.aprovar_preencher",
    "rotulo": "Aprovar & Preencher — Lancamento New",
    "herda": "tela_lancamento_recibo.view",
    "arquivo": "src/app-ui/finance/LancamentoNew.tsx"
  },
  {
    "chave": "tela_lancamento_recibo.lancamento_new.cadastrar_nova_pj",
    "rotulo": "Cadastrar nova PJ — Lancamento New",
    "herda": "tela_lancamento_recibo.view",
    "arquivo": "src/app-ui/finance/LancamentoNew.tsx"
  },
  {
    "chave": "tela_lancamento_recibo.lancamento_new.confirmar_valor",
    "rotulo": "Confirmar valor editado — Lancamento New",
    "herda": "tela_lancamento_recibo.view",
    "arquivo": "src/app-ui/finance/LancamentoNew.tsx"
  },
  {
    "chave": "tela_lancamento_recibo.lancamento_new.desvincular_e_lancar_como_despesa_avulsa",
    "rotulo": "Desvincular e lançar como despesa avulsa — Lancamento New",
    "herda": "tela_lancamento_recibo.view",
    "arquivo": "src/app-ui/finance/LancamentoNew.tsx"
  },
  {
    "chave": "tela_lancamento_recibo.lancamento_new.editar_valor",
    "rotulo": "Editar valor — Lancamento New",
    "herda": "tela_lancamento_recibo.view",
    "arquivo": "src/app-ui/finance/LancamentoNew.tsx"
  },
  {
    "chave": "tela_lancamento_recibo.lancamento_new.excluir",
    "rotulo": "Excluir — Lancamento New",
    "herda": "tela_lancamento_recibo.view",
    "arquivo": "src/app-ui/finance/LancamentoNew.tsx"
  },
  {
    "chave": "tela_lancamento_recibo.lancamento_new.lancar_receita_lancar_despesa",
    "rotulo": "Lançar Receita Lançar Despesa — Lancamento New",
    "herda": "tela_lancamento_recibo.view",
    "arquivo": "src/app-ui/finance/LancamentoNew.tsx"
  },
  {
    "chave": "tela_lancamento_recibo.lancamento_new.remover_observacao",
    "rotulo": "Remover observação — Lancamento New",
    "herda": "tela_lancamento_recibo.view",
    "arquivo": "src/app-ui/finance/LancamentoNew.tsx"
  },
  {
    "chave": "tela_lancamento_recibo.lancamento_new.salvar",
    "rotulo": "Salvar — Lancamento New",
    "herda": "tela_lancamento_recibo.view",
    "arquivo": "src/app-ui/finance/LancamentoNew.tsx"
  },
  {
    "chave": "tela_lancamento_recibo.lancamento_new.salvar_obs_inline",
    "rotulo": "Salvar (obs inline) — Lancamento New",
    "herda": "tela_lancamento_recibo.view",
    "arquivo": "src/app-ui/finance/LancamentoNew.tsx"
  },
  {
    "chave": "tela_lancamento_recibo.member_quick_create_modal.salvar",
    "rotulo": "Salvar cadastro rápido — Member Quick Create Modal",
    "herda": "tela_lancamento_recibo.view",
    "arquivo": "src/components/app-ui/MemberQuickCreateModal.tsx"
  },
  {
    "chave": "tela_lancamento_recibo.recibo_modal.anexar",
    "rotulo": "Anexar — Recibo Modal",
    "herda": "tela_lancamento_recibo.view",
    "arquivo": "src/app-ui/finance/ReciboModal.tsx"
  },
  {
    "chave": "tela_lancamento_recibo.recibo_modal.baixar_arquivo",
    "rotulo": "Baixar arquivo — Recibo Modal",
    "herda": "tela_lancamento_recibo.view",
    "arquivo": "src/app-ui/finance/ReciboModal.tsx"
  },
  {
    "chave": "tela_lancamento_recibo.recibo_modal.baixar_pdf",
    "rotulo": "Baixar PDF — Recibo Modal",
    "herda": "tela_lancamento_recibo.view",
    "arquivo": "src/app-ui/finance/ReciboModal.tsx"
  },
  {
    "chave": "tela_lancamento_recibo.recibo_modal.enviar_recibo",
    "rotulo": "Enviar Recibo — Recibo Modal",
    "herda": "tela_lancamento_recibo.view",
    "arquivo": "src/app-ui/finance/ReciboModal.tsx"
  },
  {
    "chave": "tela_lancamento_recibo.recibo_modal.enviar_whatsapp",
    "rotulo": "Enviar WhatsApp — Recibo Modal",
    "herda": "tela_lancamento_recibo.view",
    "arquivo": "src/app-ui/finance/ReciboModal.tsx"
  },
  {
    "chave": "tela_lancamento_recibo.recibo_modal.imprimir",
    "rotulo": "Imprimir — Recibo Modal",
    "herda": "tela_lancamento_recibo.view",
    "arquivo": "src/app-ui/finance/ReciboModal.tsx"
  },
  {
    "chave": "tela_lancamento_recibo.recibo_modal.imprimir_salvar_pdf",
    "rotulo": "Imprimir / Salvar PDF — Recibo Modal",
    "herda": "tela_lancamento_recibo.view",
    "arquivo": "src/app-ui/finance/ReciboModal.tsx"
  },
  {
    "chave": "tela_lancamento_recibo.recibo_modal.remover",
    "rotulo": "Remover — Recibo Modal",
    "herda": "tela_lancamento_recibo.view",
    "arquivo": "src/app-ui/finance/ReciboModal.tsx"
  },
  {
    "chave": "tela_ministerios.ministry_detail.adicionar_membro",
    "rotulo": "Adicionar Membro — Ministry Detail",
    "herda": "tela_ministerios.view",
    "arquivo": "src/app-ui/ministries/MinistryDetail.tsx"
  },
  {
    "chave": "tela_ministerios.ministry_detail.editar_ministerio",
    "rotulo": "Editar Ministério — Ministry Detail",
    "herda": "tela_ministerios.view",
    "arquivo": "src/app-ui/ministries/MinistryDetail.tsx"
  },
  {
    "chave": "tela_ministerios.ministry_detail.enviar_mensagem",
    "rotulo": "Enviar Mensagem — Ministry Detail",
    "herda": "tela_ministerios.view",
    "arquivo": "src/app-ui/ministries/MinistryDetail.tsx"
  },
  {
    "chave": "tela_ministerios.ministry_detail.gerar_relatorio",
    "rotulo": "Gerar Relatório — Ministry Detail",
    "herda": "tela_ministerios.view",
    "arquivo": "src/app-ui/ministries/MinistryDetail.tsx"
  },
  {
    "chave": "tela_mobile_recursos.jogo_editor.adicionar_palavra",
    "rotulo": "Adicionar palavra — Jogo Editor",
    "herda": "tela_mobile_recursos.view",
    "arquivo": "src/app-ui/mobile/JogoEditor.tsx"
  },
  {
    "chave": "tela_mobile_recursos.jogo_editor.remover",
    "rotulo": "Remover — Jogo Editor",
    "herda": "tela_mobile_recursos.view",
    "arquivo": "src/app-ui/mobile/JogoEditor.tsx"
  },
  {
    "chave": "tela_mobile_recursos.mobile_recurso.adicionar",
    "rotulo": "Adicionar — Mobile Recurso",
    "herda": "tela_mobile_recursos.view",
    "arquivo": "src/app-ui/mobile/MobileRecurso.tsx"
  },
  {
    "chave": "tela_mobile_recursos.mobile_recurso.aprovar_e_executar",
    "rotulo": "Aprovar e executar — Mobile Recurso",
    "herda": "tela_mobile_recursos.view",
    "arquivo": "src/app-ui/mobile/MobileRecurso.tsx"
  },
  {
    "chave": "tela_mobile_recursos.mobile_recurso.excluir",
    "rotulo": "Excluir — Mobile Recurso",
    "herda": "tela_mobile_recursos.view",
    "arquivo": "src/app-ui/mobile/MobileRecurso.tsx"
  },
  {
    "chave": "tela_mobile_recursos.mobile_recurso.salvar",
    "rotulo": "Salvar — Mobile Recurso",
    "herda": "tela_mobile_recursos.view",
    "arquivo": "src/app-ui/mobile/MobileRecurso.tsx"
  },
  {
    "chave": "tela_moldura.app_ui.meu_perfil_ver_e_editar_dados",
    "rotulo": "Meu Perfil Ver e editar dados — App UI",
    "herda": "tela_moldura.view",
    "arquivo": "src/components/app-ui/AppUI.tsx"
  },
  {
    "chave": "tela_moldura.app_ui.remover_dos_favoritos",
    "rotulo": "Remover dos favoritos — App UI",
    "herda": "tela_moldura.view",
    "arquivo": "src/components/app-ui/AppUI.tsx"
  },
  {
    "chave": "tela_moldura.app_ui.salvo_salvar",
    "rotulo": "Salvo! Salvar — App UI",
    "herda": "tela_moldura.view",
    "arquivo": "src/components/app-ui/AppUI.tsx"
  },
  {
    "chave": "tela_moldura.chat_fab.anexar",
    "rotulo": "Anexar — Chat FAB",
    "herda": "tela_moldura.view",
    "arquivo": "src/components/app-ui/ChatFAB.tsx"
  },
  {
    "chave": "tela_moldura.chat_fab.enviar",
    "rotulo": "Enviar — Chat FAB",
    "herda": "tela_moldura.view",
    "arquivo": "src/components/app-ui/ChatFAB.tsx"
  },
  {
    "chave": "tela_moldura.chat_fab.enviar_localizacao",
    "rotulo": "Enviar Localização — Chat FAB",
    "herda": "tela_moldura.view",
    "arquivo": "src/components/app-ui/ChatFAB.tsx"
  },
  {
    "chave": "tela_moldura.chat_fab.salvar_frase_rapida",
    "rotulo": "Salvar frase rápida — Chat FAB",
    "herda": "tela_moldura.view",
    "arquivo": "src/components/app-ui/ChatFAB.tsx"
  },
  {
    "chave": "tela_moldura.global_search_modal.editar_membro",
    "rotulo": "Editar membro — Global Search Modal",
    "herda": "tela_moldura.view",
    "arquivo": "src/components/app-ui/GlobalSearchModal.tsx"
  },
  {
    "chave": "tela_moldura.member_edit_drawer.remover_foto",
    "rotulo": "Remover foto — Member Edit Drawer",
    "herda": "tela_moldura.view",
    "arquivo": "src/components/app-ui/MemberEditDrawer.tsx"
  },
  {
    "chave": "tela_moldura.member_edit_drawer.salvar_alteracoes",
    "rotulo": "Salvar alterações — Member Edit Drawer",
    "herda": "tela_moldura.view",
    "arquivo": "src/components/app-ui/MemberEditDrawer.tsx"
  },
  {
    "chave": "tela_moldura.member_edit_drawer.trocar_foto_adicionar_foto",
    "rotulo": "Trocar foto Adicionar foto — Member Edit Drawer",
    "herda": "tela_moldura.view",
    "arquivo": "src/components/app-ui/MemberEditDrawer.tsx"
  },
  {
    "chave": "tela_moldura.quick_widgets.excluir_nota",
    "rotulo": "Excluir nota — Quick Widgets",
    "herda": "tela_moldura.view",
    "arquivo": "src/components/app-ui/QuickWidgets.tsx"
  },
  {
    "chave": "tela_moldura.quick_widgets.nova",
    "rotulo": "Nova — Quick Widgets",
    "herda": "tela_moldura.view",
    "arquivo": "src/components/app-ui/QuickWidgets.tsx"
  },
  {
    "chave": "tela_moldura.quick_widgets.salvar",
    "rotulo": "Salvar — Quick Widgets",
    "herda": "tela_moldura.view",
    "arquivo": "src/components/app-ui/QuickWidgets.tsx"
  },
  {
    "chave": "tela_moldura.system_settings.adicionar_usuario",
    "rotulo": "Adicionar Usuário — System Settings",
    "herda": "tela_moldura.view",
    "arquivo": "src/components/app-ui/SystemSettings.tsx"
  },
  {
    "chave": "tela_moldura.system_settings.gerar_api_key",
    "rotulo": "Gerar API Key — System Settings",
    "herda": "tela_moldura.view",
    "arquivo": "src/components/app-ui/SystemSettings.tsx"
  },
  {
    "chave": "tela_pastoral.counseling_session.adicionar_resource",
    "rotulo": "Adicionar (resource) — Counseling Session",
    "herda": "tela_pastoral.view",
    "arquivo": "src/app-ui/pastoral/CounselingSession.tsx"
  },
  {
    "chave": "tela_pastoral.counseling_session.remover_resource",
    "rotulo": "Remover (resource) — Counseling Session",
    "herda": "tela_pastoral.view",
    "arquivo": "src/app-ui/pastoral/CounselingSession.tsx"
  },
  {
    "chave": "tela_pastoral.counseling_session.salvar_sessao",
    "rotulo": "Salvar Sessão — Counseling Session",
    "herda": "tela_pastoral.view",
    "arquivo": "src/app-ui/pastoral/CounselingSession.tsx"
  },
  {
    "chave": "tela_pastoral.pastoral.nova",
    "rotulo": "Nova — Pastoral",
    "herda": "tela_pastoral.view",
    "arquivo": "src/components/app-ui/Pastoral.tsx"
  },
  {
    "chave": "tela_pastoral.prayer_new.enviar_pedido",
    "rotulo": "Enviar Pedido — Prayer New",
    "herda": "tela_pastoral.view",
    "arquivo": "src/app-ui/pastoral/PrayerNew.tsx"
  },
  {
    "chave": "tela_pastoral.visit_detail.agendar_nova_visita",
    "rotulo": "Agendar Nova Visita — Visit Detail",
    "herda": "tela_pastoral.view",
    "arquivo": "src/app-ui/pastoral/VisitDetail.tsx"
  },
  {
    "chave": "tela_pastoral.visit_detail.editar_visita",
    "rotulo": "Editar Visita — Visit Detail",
    "herda": "tela_pastoral.view",
    "arquivo": "src/app-ui/pastoral/VisitDetail.tsx"
  },
  {
    "chave": "tela_pastoral.visit_detail.gerar_relatorio",
    "rotulo": "Gerar Relatório — Visit Detail",
    "herda": "tela_pastoral.view",
    "arquivo": "src/app-ui/pastoral/VisitDetail.tsx"
  },
  {
    "chave": "tela_pastoral.visit_report.salvar_relatorio",
    "rotulo": "Salvar Relatorio — Visit Report",
    "herda": "tela_pastoral.view",
    "arquivo": "src/app-ui/pastoral/VisitReport.tsx"
  },
  {
    "chave": "tela_patrimonio.asset_detail.imprimir_etiqueta",
    "rotulo": "Imprimir etiqueta — Asset Detail",
    "herda": "tela_patrimonio.view",
    "arquivo": "src/app-ui/assets/AssetDetail.tsx"
  },
  {
    "chave": "tela_patrimonio.asset_form.salvar",
    "rotulo": "Salvar — Asset Form",
    "herda": "tela_patrimonio.view",
    "arquivo": "src/app-ui/assets/AssetForm.tsx"
  },
  {
    "chave": "tela_permissoes.membro_busca.editar_membro",
    "rotulo": "Editar membro — Membro Busca",
    "herda": "tela_permissoes.view",
    "arquivo": "src/app-ui/system/MembroBusca.tsx"
  },
  {
    "chave": "tela_sistema_antiga.system.editar",
    "rotulo": "Editar — System",
    "herda": "tela_sistema_antiga.view",
    "arquivo": "src/components/app-ui/System.tsx"
  },
  {
    "chave": "tela_sistema_antiga.system.novo_usuario",
    "rotulo": "Novo Usuário — System",
    "herda": "tela_sistema_antiga.view",
    "arquivo": "src/components/app-ui/System.tsx"
  },
  {
    "chave": "tela_stripe.stripe_config_admin.atualizar_salvar",
    "rotulo": "Atualizar Salvar — Stripe Config Admin",
    "herda": "tela_stripe.view",
    "arquivo": "src/app-ui/stripe/StripeConfigAdmin.tsx"
  },
  {
    "chave": "tela_stripe.stripe_config_admin.remover",
    "rotulo": "Remover — Stripe Config Admin",
    "herda": "tela_stripe.view",
    "arquivo": "src/app-ui/stripe/StripeConfigAdmin.tsx"
  },
  {
    "chave": "tela_stripe.stripe_reembolsos.aprovar",
    "rotulo": "Aprovar — Stripe Reembolsos",
    "herda": "tela_stripe.view",
    "arquivo": "src/app-ui/stripe/StripeReembolsos.tsx"
  },
  {
    "chave": "tela_stripe.stripe_reembolsos.rejeitar",
    "rotulo": "Rejeitar — Stripe Reembolsos",
    "herda": "tela_stripe.view",
    "arquivo": "src/app-ui/stripe/StripeReembolsos.tsx"
  },
  {
    "chave": "transfer.transfer_new.salvar_transferencia",
    "rotulo": "Salvar Transferência — Transfer New",
    "herda": "transfer.view",
    "arquivo": "src/components/app-ui/forms/TransferNew.tsx"
  },
  {
    "chave": "transfer.transfer.editar",
    "rotulo": "Editar — Transfer",
    "herda": "transfer.view",
    "arquivo": "src/components/app-ui/Transfer.tsx"
  },
  {
    "chave": "transfer.transfer.excluir",
    "rotulo": "Excluir — Transfer",
    "herda": "transfer.view",
    "arquivo": "src/components/app-ui/Transfer.tsx"
  },
  {
    "chave": "transfer.transfer.imprimir",
    "rotulo": "Imprimir — Transfer",
    "herda": "transfer.view",
    "arquivo": "src/components/app-ui/Transfer.tsx"
  },
  {
    "chave": "transfer.transfer.nova_transferencia",
    "rotulo": "Nova Transferencia — Transfer",
    "herda": "transfer.view",
    "arquivo": "src/components/app-ui/Transfer.tsx"
  },
  {
    "chave": "transfer.transfer.salvar_alteracoes_criar_transferencia",
    "rotulo": "Salvar Alteracoes Criar Transferencia — Transfer",
    "herda": "transfer.view",
    "arquivo": "src/components/app-ui/Transfer.tsx"
  },
  {
    "chave": "whatsapp_inbox.whats_app_inbox.baixar",
    "rotulo": "Baixar — Whats App Inbox",
    "herda": "whatsapp_inbox.view",
    "arquivo": "src/components/app-ui-screens/communication/WhatsAppInbox.tsx"
  },
  {
    "chave": "whatsapp_inbox.whats_app_inbox.enviar",
    "rotulo": "Enviar — Whats App Inbox",
    "herda": "whatsapp_inbox.view",
    "arquivo": "src/components/app-ui-screens/communication/WhatsAppInbox.tsx"
  },
  {
    "chave": "whatsapp_inbox.whats_app_inbox.enviar_mensagem",
    "rotulo": "Enviar mensagem — Whats App Inbox",
    "herda": "whatsapp_inbox.view",
    "arquivo": "src/components/app-ui-screens/communication/WhatsAppInbox.tsx"
  },
  {
    "chave": "whatsapp_inbox.whats_app_inbox.excluir",
    "rotulo": "Excluir — Whats App Inbox",
    "herda": "whatsapp_inbox.view",
    "arquivo": "src/components/app-ui-screens/communication/WhatsAppInbox.tsx"
  },
  {
    "chave": "whatsapp_inbox.whats_app_inbox.excluir_conversa",
    "rotulo": "Excluir conversa — Whats App Inbox",
    "herda": "whatsapp_inbox.view",
    "arquivo": "src/components/app-ui-screens/communication/WhatsAppInbox.tsx"
  },
  {
    "chave": "whatsapp_inbox.whats_app_inbox.nova_conversa",
    "rotulo": "+ Nova conversa — Whats App Inbox",
    "herda": "whatsapp_inbox.view",
    "arquivo": "src/components/app-ui-screens/communication/WhatsAppInbox.tsx"
  },
  {
    "chave": "whatsapp_inbox.whats_app_inbox.nova_conversa_2",
    "rotulo": "Nova Conversa — Whats App Inbox",
    "herda": "whatsapp_inbox.view",
    "arquivo": "src/components/app-ui-screens/communication/WhatsAppInbox.tsx"
  },
  {
    "chave": "word_docs.word_editor.excluir",
    "rotulo": "Excluir — Word Editor",
    "herda": "word_docs.view",
    "arquivo": "src/app-ui/word/WordEditor.tsx"
  },
  {
    "chave": "word_docs.word_editor.exportar_doc",
    "rotulo": "Exportar .doc — Word Editor",
    "herda": "word_docs.view",
    "arquivo": "src/app-ui/word/WordEditor.tsx"
  },
  {
    "chave": "word_docs.word_editor.imprimir",
    "rotulo": "Imprimir — Word Editor",
    "herda": "word_docs.view",
    "arquivo": "src/app-ui/word/WordEditor.tsx"
  },
  {
    "chave": "word_docs.word_editor.imprimir_doc_s",
    "rotulo": "Imprimir doc s — Word Editor",
    "herda": "word_docs.view",
    "arquivo": "src/app-ui/word/WordEditor.tsx"
  },
  {
    "chave": "word_docs.word_editor.imprimir_documento",
    "rotulo": "Imprimir documento — Word Editor",
    "herda": "word_docs.view",
    "arquivo": "src/app-ui/word/WordEditor.tsx"
  },
  {
    "chave": "word_docs.word_editor.novo_documento",
    "rotulo": "Novo Documento — Word Editor",
    "herda": "word_docs.view",
    "arquivo": "src/app-ui/word/WordEditor.tsx"
  },
  {
    "chave": "word_docs.word_editor.novo_documento_em_branco",
    "rotulo": "Novo Documento em Branco — Word Editor",
    "herda": "word_docs.view",
    "arquivo": "src/app-ui/word/WordEditor.tsx"
  },
  {
    "chave": "word_docs.word_editor.salvar",
    "rotulo": "Salvar — Word Editor",
    "herda": "word_docs.view",
    "arquivo": "src/app-ui/word/WordEditor.tsx"
  }
];

/** Ações genéricas de tela que o código usa de fato, com os arquivos. */
export const ACOES_GENERICAS_EM_USO: Record<string, string[]> = {
  "asaas_links.create": [
    "src/app-ui/asaas/Links.tsx"
  ],
  "asaas_links.edit": [
    "src/app-ui/asaas/Links.tsx"
  ],
  "asaas_recorrencias.delete": [
    "src/app-ui/asaas/Recorrencias.tsx"
  ],
  "asaas_recorrencias.edit": [
    "src/app-ui/asaas/Recorrencias.tsx"
  ],
  "asaas_vendas.delete": [
    "src/app-ui/asaas/Vendas.tsx"
  ],
  "assets.create": [
    "src/app-ui/assets/AssetsList.tsx"
  ],
  "assets.delete": [
    "src/app-ui/assets/AssetsList.tsx"
  ],
  "assets.edit": [
    "src/app-ui/assets/AssetsList.tsx"
  ],
  "cell_group_members.delete": [
    "src/components/app-ui/CellDetail.tsx"
  ],
  "cell_group_members.edit": [
    "src/components/app-ui/CellDetail.tsx"
  ],
  "cells.create": [
    "src/components/app-ui/CellGroups.tsx"
  ],
  "cells.delete": [
    "src/components/app-ui/CellGroups.tsx"
  ],
  "cells.edit": [
    "src/components/app-ui/CellGroups.tsx"
  ],
  "churches.create": [
    "src/app-ui/finance/DizimoBlocos.tsx"
  ],
  "churches.delete": [
    "src/app-ui/finance/DizimoBlocos.tsx"
  ],
  "churches.edit": [
    "src/app-ui/finance/DizimoBlocos.tsx"
  ],
  "contas_pagar.create": [
    "src/app-ui/finance/ContasPagar.tsx"
  ],
  "contas_pagar.delete": [
    "src/app-ui/finance/ContasPagar.tsx"
  ],
  "contas_pagar.edit": [
    "src/app-ui/finance/ContasPagar.tsx"
  ],
  "credential_models.create": [
    "src/app-ui/ecclesiastical/ModelosCredencial.tsx"
  ],
  "credential_models.delete": [
    "src/app-ui/ecclesiastical/ModelosCredencial.tsx"
  ],
  "credential_models.edit": [
    "src/app-ui/ecclesiastical/ModelosCredencial.tsx"
  ],
  "dizimo_blocos.create": [
    "src/app-ui/finance/DizimoBlocos.tsx"
  ],
  "dizimo_blocos.delete": [
    "src/app-ui/finance/DizimoBlocos.tsx"
  ],
  "dizimo_blocos.edit": [
    "src/app-ui/finance/DizimoBlocos.tsx"
  ],
  "events.create": [
    "src/components/app-ui/Agenda.tsx"
  ],
  "events.delete": [
    "src/components/app-ui/Agenda.tsx"
  ],
  "events.edit": [
    "src/components/app-ui/Agenda.tsx"
  ],
  "internal_chat.create": [
    "src/components/app-ui/ChatFAB.tsx"
  ],
  "internal_chat.delete": [
    "src/components/app-ui/ChatFAB.tsx"
  ],
  "members.create": [
    "src/components/app-ui/AppUI.tsx"
  ],
  "membership_requests.edit": [
    "src/app-ui/ecclesiastical/QueroSerMembroRequests.tsx"
  ],
  "ministries.create": [
    "src/components/app-ui/Ministries.tsx"
  ],
  "ministries.delete": [
    "src/components/app-ui/Ministries.tsx"
  ],
  "ministries.edit": [
    "src/components/app-ui/Ministries.tsx"
  ],
  "mobile_alertas.create": [
    "src/app-ui/mobile/MobileRecurso.tsx"
  ],
  "mobile_alertas.delete": [
    "src/app-ui/mobile/MobileRecurso.tsx"
  ],
  "mobile_alertas.edit": [
    "src/app-ui/mobile/MobileRecurso.tsx"
  ],
  "mobile_comunidade.create": [
    "src/app-ui/mobile/MobileRecurso.tsx"
  ],
  "mobile_comunidade.delete": [
    "src/app-ui/mobile/MobileRecurso.tsx"
  ],
  "mobile_comunidade.edit": [
    "src/app-ui/mobile/MobileRecurso.tsx"
  ],
  "mobile_config.create": [
    "src/app-ui/mobile/MobileRecurso.tsx"
  ],
  "mobile_config.delete": [
    "src/app-ui/mobile/MobileRecurso.tsx"
  ],
  "mobile_config.edit": [
    "src/app-ui/mobile/MobileConfig.tsx",
    "src/app-ui/mobile/MobileRecurso.tsx"
  ],
  "mobile_ebd.create": [
    "src/app-ui/mobile/MobileRecurso.tsx"
  ],
  "mobile_ebd.delete": [
    "src/app-ui/mobile/MobileRecurso.tsx"
  ],
  "mobile_ebd.edit": [
    "src/app-ui/mobile/MobileRecurso.tsx"
  ],
  "mobile_eventos.create": [
    "src/app-ui/mobile/MobileRecurso.tsx"
  ],
  "mobile_eventos.delete": [
    "src/app-ui/mobile/MobileRecurso.tsx"
  ],
  "mobile_eventos.edit": [
    "src/app-ui/mobile/MobileRecurso.tsx"
  ],
  "mobile_loja.create": [
    "src/app-ui/mobile/MobileRecurso.tsx"
  ],
  "mobile_loja.delete": [
    "src/app-ui/mobile/MobileRecurso.tsx"
  ],
  "mobile_loja.edit": [
    "src/app-ui/mobile/MobileRecurso.tsx"
  ],
  "mobile_membros.create": [
    "src/app-ui/mobile/MobileRecurso.tsx"
  ],
  "mobile_membros.delete": [
    "src/app-ui/mobile/MobileRecurso.tsx"
  ],
  "mobile_membros.edit": [
    "src/app-ui/mobile/MobileRecurso.tsx"
  ],
  "mobile_midias.create": [
    "src/app-ui/mobile/MobileRecurso.tsx"
  ],
  "mobile_midias.delete": [
    "src/app-ui/mobile/MobileRecurso.tsx"
  ],
  "mobile_midias.edit": [
    "src/app-ui/mobile/MobileRecurso.tsx"
  ],
  "mobile_noticias.create": [
    "src/app-ui/mobile/MobileRecurso.tsx"
  ],
  "mobile_noticias.delete": [
    "src/app-ui/mobile/MobileRecurso.tsx"
  ],
  "mobile_noticias.edit": [
    "src/app-ui/mobile/MobileRecurso.tsx"
  ],
  "mobile_pao_diario.create": [
    "src/app-ui/mobile/MobileRecurso.tsx"
  ],
  "mobile_pao_diario.delete": [
    "src/app-ui/mobile/MobileRecurso.tsx"
  ],
  "mobile_pao_diario.edit": [
    "src/app-ui/mobile/MobileRecurso.tsx"
  ],
  "mobile_pedidos.create": [
    "src/app-ui/mobile/MobileRecurso.tsx"
  ],
  "mobile_pedidos.delete": [
    "src/app-ui/mobile/MobileRecurso.tsx"
  ],
  "mobile_pedidos.edit": [
    "src/app-ui/mobile/MobileRecurso.tsx"
  ],
  "mobile_secretaria.create": [
    "src/app-ui/mobile/MobileRecurso.tsx"
  ],
  "mobile_secretaria.delete": [
    "src/app-ui/mobile/MobileRecurso.tsx"
  ],
  "mobile_secretaria.edit": [
    "src/app-ui/mobile/MobileRecurso.tsx"
  ],
  "mobile_tesouraria.create": [
    "src/app-ui/mobile/MobileRecurso.tsx"
  ],
  "mobile_tesouraria.delete": [
    "src/app-ui/mobile/MobileRecurso.tsx"
  ],
  "mobile_tesouraria.edit": [
    "src/app-ui/mobile/MobileRecurso.tsx"
  ],
  "reports.create": [
    "src/components/app-ui/Reports.tsx"
  ],
  "reports.edit": [
    "src/components/app-ui/Reports.tsx"
  ],
  "santander_conciliar.edit": [
    "src/app-ui/finance/SantanderPage.tsx"
  ],
  "santander_export.create": [
    "src/app-ui/finance/SantanderPage.tsx"
  ],
  "santander_ignorar.create": [
    "src/app-ui/finance/SantanderPage.tsx"
  ],
  "santander_import.create": [
    "src/app-ui/finance/SantanderPage.tsx"
  ],
  "santander_lancar.edit": [
    "src/app-ui/finance/SantanderPage.tsx"
  ],
  "santander_sync.create": [
    "src/app-ui/finance/SantanderPage.tsx"
  ],
  "whatsapp_campaigns.create": [
    "src/app-ui/pastoral/PastoralMassSend.tsx",
    "src/app-ui/pastoral/PastoralSendHistory.tsx",
    "src/components/app-ui-screens/pastoral/PastoralMassSend.tsx",
    "src/components/app-ui-screens/pastoral/PastoralSendHistory.tsx"
  ],
  "whatsapp_campaigns.edit": [
    "src/app-ui/pastoral/PastoralSendHistory.tsx",
    "src/components/app-ui-screens/pastoral/PastoralSendHistory.tsx"
  ]
};
