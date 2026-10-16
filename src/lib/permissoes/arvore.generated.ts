/**
 * GERADO por scripts/gerar-arvore-permissoes.mjs — não edite à mão.
 * Rode `npm run permissoes:arvore` depois de marcar ou desmarcar um componente.
 */
import type { DefPermissao } from './definir';

export const COMPONENTES_PERMISSAO: DefPermissao[] = [
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
