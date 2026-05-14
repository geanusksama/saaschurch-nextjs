import { createBrowserRouter } from "react-router";
import { Root } from "../components/Root";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { Overview } from "../components/Overview";
import { InformationArchitecture } from "../components/InformationArchitecture";
import { UserFlows } from "../components/UserFlows";
import { Navigation } from "../components/Navigation";
import { ModuleRelationships } from "../components/ModuleRelationships";
import { Hierarchy } from "../components/Hierarchy";
import { ScreenCatalog } from "../components/ScreenCatalog";
import { ScreenCatalogComplete } from "../components/ScreenCatalogComplete";
import { DesignSystem } from "../components/DesignSystem";

// Public Website
import { PublicWebsite } from "../components/public/PublicWebsite";
import { PublicHome } from "../components/public/PublicHome";
import { PublicEvents } from "../components/public/PublicEvents";
import { LiveStreaming } from "../components/public/LiveStreaming";
import { About } from "../components/public/About";
import { Contact } from "../components/public/Contact";
import { Vision } from "../components/public/Vision";
import { History } from "../components/public/History";
import { Leadership } from "../components/public/Leadership";
import { Timeline } from "../components/public/Timeline";
import { MinistriesPublic } from "../components/public/MinistriesPublic";
import { CIBETickets } from "../components/public/CIBETickets";
import { KidsPortal } from "../components/public/KidsPortal";
import { Radio } from "../components/public/Radio";
import { Locations } from "../components/public/Locations";
import { Blog } from "../components/public/Blog";
import { ChurchSelector, Onboarding } from "../components/app-ui/AllScreens";

// Auth
import { Login } from "../components/auth/Login";
import { Register } from "../components/auth/Register";
import { PendingActivation } from "../components/auth/PendingActivation";
import ForgotPassword from "../auth/ForgotPassword";
import ResetPassword from "../auth/ResetPassword";
import { TwoFactorSetup } from "../components/auth/TwoFactorSetup";
import { TwoFactorVerify } from "../components/auth/TwoFactorVerify";

// App UI
import { AppUI } from "../components/app-ui/AppUI";
import { AppLanding } from "../components/app-ui/AppLanding";
import { Dashboard } from "../components/app-ui/Dashboard";
import FieldDashboard from "../app-ui/dashboard/FieldDashboard";
import RegionalDashboard from "../app-ui/dashboard/RegionalDashboard";
import { Members } from "../components/app-ui/Members";
import { MembersGrid } from "../components/app-ui/MembersGrid";
import { MemberProfile } from "../components/app-ui/MemberProfile";
import { MemberRegistration } from "../components/app-ui/MemberRegistration";
import { MemberEdit } from "../components/app-ui/MemberEdit";
import { MemberDocuments } from "../components/app-ui/MemberDocuments";
import { MemberNotes } from "../components/app-ui/MemberNotes";
import { FamilyRelationships } from "../components/app-ui/FamilyRelationships";
import { MemberImport } from "../components/app-ui/MemberImport";
import { CRM } from "../components/app-ui/CRM";
import { CRMPipeline } from "../components/app-ui/CRMPipeline";
import { LeadDetail } from "../components/app-ui/LeadDetail";
import { CRMDetail } from "../components/app-ui/CRMDetail";
import { Finance } from "../components/app-ui/Finance";
import Cashbook from "../app-ui/finance/Cashbook";
import LancamentoNew from "../app-ui/finance/LancamentoNew";
import { Events } from "../components/app-ui/Events";
import { Communication } from "../components/app-ui/Communication";
import WhatsAppInbox from "../app-ui/communication/WhatsAppInbox";
import { Ministries } from "../components/app-ui/Ministries";
import MinistryDetail from "../app-ui/ministries/MinistryDetail";
import { System } from "../components/app-ui/System";
import { Pastoral } from "../components/app-ui/Pastoral";
import VisitDetail from "../app-ui/pastoral/VisitDetail";
import VisitNew from "../app-ui/pastoral/VisitNew";
import VisitReport from "../app-ui/pastoral/VisitReport";
import CounselingList from "../app-ui/pastoral/CounselingList";
import CounselingNew from "../app-ui/pastoral/CounselingNew";
import CounselingSession from "../app-ui/pastoral/CounselingSession";
import PrayerNew from "../app-ui/pastoral/PrayerNew";
import PrayerWall from "../app-ui/pastoral/PrayerWall";
import FollowupDashboard from "../app-ui/pastoral/FollowupDashboard";
import DiscipleshipTracking from "../app-ui/pastoral/DiscipleshipTracking";
import DiscipleshipCurriculum from "../app-ui/pastoral/DiscipleshipCurriculum";
import DiscipleshipNew from "../app-ui/pastoral/DiscipleshipNew";
import PastoralTimeline from "../app-ui/pastoral/PastoralTimeline";
import PastoralReports from "../app-ui/pastoral/PastoralReports";
import PastoralKanban from "../app-ui/pastoral/PastoralKanban";
import { Automation } from "../components/app-ui/Automation";
import { AutomationBuilderComponent } from "../components/app-ui/AutomationBuilder";
import { EventDetail } from "../components/app-ui/EventDetail";
import { Baptism } from "../components/app-ui/Baptism";
import { BaptismEventDetail } from "../components/app-ui/BaptismEventDetail";
import { CellGroups } from "../components/app-ui/CellGroups";
import { CellReports } from "../components/app-ui/CellReports";
import { CellDetail } from "../components/app-ui/CellDetail";
import CellsList from "../app-ui/cells/CellsList";
import { CheckIn } from "../components/app-ui/CheckIn";
import CheckinHome from "../app-ui/checkin/CheckinHome";
import MemberCheckin from "../app-ui/checkin/MemberCheckin";
import { WhatsApp } from "../components/app-ui/WhatsApp";
import { EmailCampaigns } from "../components/app-ui/EmailCampaigns";
import { Reports } from "../components/app-ui/Reports";
import ReportsDashboard from "../app-ui/reports/ReportsDashboard";
import { SystemSettings } from "../components/app-ui/SystemSettings";
import UsersList from "../app-ui/system/UsersList";
import UserNew from "../app-ui/system/UserNew";
import UserEdit from "../app-ui/system/UserEdit";
import { PermissionsMatrix } from "../app-ui/system/PermissionsMatrix";
import UserPermissions from "../app-ui/system/UserPermissions";
import {
  ChurchInfo,
  Branding,
  Localization,
  Roles,
  Permissions,
  Security,
  AuditLog as SystemAuditLog,
  ApiKeys,
  NotificationSettings as SystemNotificationSettings,
  Templates,
  EmailSettings as SystemEmailSettings,
  WhatsAppSettings as SystemWhatsAppSettings,
  SmsSettings,
  Integrations,
  Webhooks,
  Api,
  Import,
  Export,
  Backup
} from "../components/app-ui/system/index";
import { Notifications } from "../components/app-ui/Notifications";
import {
  LeadNew as LeadNewForm,
  BaptismRequestNew,
  ConsecrationNew as ConsecrationNewForm,
  TransferNew as TransferNewForm,
  CheckInNew as CheckInNewForm,
  RequirementNew as RequirementNewForm,
  CredentialNew as CredentialNewForm
} from "../components/app-ui/forms";
import { Inbox } from "../components/app-ui/Inbox";
import { Consecration } from "../components/app-ui/Consecration";
import { Transfer } from "../components/app-ui/Transfer";
import { Credentials } from "../components/app-ui/Credentials";
import ModelosCredencial from "../app-ui/ecclesiastical/ModelosCredencial";
import SolicitacoesCredencial from "../app-ui/ecclesiastical/SolicitacoesCredencial";
import { Birthdays } from "../components/app-ui/Birthdays";
import { ConfigurationCenter } from "../components/app-ui/ConfigurationCenter";
import { FinanceCashFlow } from "../components/app-ui/FinanceCashFlow";
import { FinanceTransactions } from "../components/app-ui/FinanceTransactions";
import { FinanceIncomeForm } from "../components/app-ui/FinanceIncomeForm";
import { FinanceExpenseForm } from "../components/app-ui/FinanceExpenseForm";
import { Agenda } from "../components/app-ui/Agenda";
import { DailyBread } from "../components/app-ui/DailyBread";
import { ContactsModule } from "../components/app-ui/ContactsModule";
import { ProspectingModule } from "../components/app-ui/ProspectingModule";
import { AttendanceModule } from "../components/app-ui/AttendanceModule";
import { Churches } from "../components/app-ui/Churches";
import BaptismRequests from "../app-ui/ecclesiastical/BaptismRequests";
import ConsecrationRequests from "../app-ui/ecclesiastical/ConsecrationRequests";
import TransferRequests from "../app-ui/ecclesiastical/TransferRequests";
import SecretariatPipeline from "../app-ui/ecclesiastical/SecretariatPipeline";
import ServicesMatrix from "../app-ui/ecclesiastical/ServicesMatrix";
import PipelinesAdmin from "../app-ui/ecclesiastical/PipelinesAdmin";
import Requerimentos from "../app-ui/ecclesiastical/Requerimentos";
import TicketPurchase from "../app-ui/events/TicketPurchase";
import Spreadsheet from "../app-ui/spreadsheet/Spreadsheet";
import {
  CRMNew,
  FinanceNew,
  EventsNew,
  BaptismNew,
  CheckInManual,
  CheckInHistory,
  EmailNew,
  AutomationBuilder,
  RequirementsNew
} from "../components/app-ui/Placeholder";

import {
  ChurchDashboard, MinistryDashboard, FinancialDashboard,
  MemberPhoto, FamilyTree, MembershipHistory, MemberExport, MemberMerge, MemberArchive,
  VisitorCheckin, KidsCheckin, KidsPickup, ServiceSelector, CheckinKiosk, AttendanceLive
} from "../components/app-ui/AllScreens";

import {
  WhatsAppConversation, WhatsAppContacts, WhatsAppAutoReply, WhatsAppCampaign,
  EmailCampaigns as EmailCampaignsScreen, EmailComposer, EmailTemplates, EmailTemplateEditor, EmailAnalytics,
  SMSCampaigns, NotificationCenter, BroadcastMessage,
  MinistryNew, MinistryLeaders, MinistryDepartments, MinistryTeams, MinistryVolunteers, MinistrySchedule, VolunteerApplication
} from "../components/app-ui/AllScreensPart2";

import {
  CellNew as CellNewScreen, CellDetail as CellDetailScreen, CellLeaders, CellMembers, CellMeetingReport, CellAttendance, CellGrowth, CellMultiplication,
  MemberGrowthReport, FinancialAnalyticsReport, AttendanceAnalyticsReport, MinistryDistributionReport, EventParticipationReport, GivingAnalyticsReport, CustomReports, ReportBuilder, DataExport
} from "../components/app-ui/AllScreensPart2";

import {
  UserNew as UserNewPlaceholder, UserEdit as UserEditPlaceholder, RolesList, RoleNew, PermissionsMatrix as PermissionsMatrixPlaceholder, ChurchSettings, ThemeSettings, IntegrationSettings, WebhookSettings, APIKeys,
  NotificationSettings, EmailSettings, WhatsAppSettings, BackupSettings, AuditLog,
  FieldSwitcher, ChurchHierarchy, RegionalView, ChurchTransfer, ConsolidatedReports,
  CategoryManagement, ChartOfAccounts, MonthlyClosing, BudgetPlanning, BudgetVsActual, GivingDashboard, GivingStatements, RecurringTransactions, BankReconciliation, FinancialReports
} from "../components/app-ui/AllScreensPart3";

import {
  LeadNew, LeadEdit, LeadTimeline, LeadNotes, LeadTasks, LeadEmails, LeadCalls, DealDetail, DealStages, ContactProperties, CustomFields, Assignments, CRMReports,
  AutomationTriggers, AutomationActions, AutomationConditions, AutomationTemplates, AutomationAnalytics, AutomationLogs, AutomationTest,
  EventNew, EventEdit, TicketTypes, TicketPayment, TicketConfirmation, TicketQRCode, CheckinDashboard, CheckinScanner, CheckinManual as CheckinManualScreen, AttendanceReports, EventRegistration,
  BaptismForm, BaptismApproval, BaptismWorkflow, BaptismCertificate, ConsecrationWorkflow, TransferForm,
  Credentials as CredentialsScreen, CredentialsNew, WeddingRequests, DedicationRequests
} from "../components/app-ui/AllScreensPart4";

export const router = createBrowserRouter([
  {
    path: "/documentation",
    Component: Root,
    errorElement: <ErrorBoundary />,
    children: [
      { index: true, Component: Overview },
      { path: "information-architecture", Component: InformationArchitecture },
      { path: "user-flows", Component: UserFlows },
      { path: "navigation", Component: Navigation },
      { path: "module-relationships", Component: ModuleRelationships },
      { path: "hierarchy", Component: Hierarchy },
      { path: "screen-catalog", Component: ScreenCatalog },
      { path: "screen-catalog-complete", Component: ScreenCatalogComplete },
      { path: "design-system", Component: DesignSystem },
    ]
  },
  {
    path: "/design-system",
    Component: DesignSystem,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/",
    Component: PublicWebsite,
    errorElement: <ErrorBoundary />,
    children: [
      { index: true, Component: PublicHome },
    ]
  },
  {
    path: "/public",
    Component: PublicWebsite,
    errorElement: <ErrorBoundary />,
    children: [
      { index: true, Component: PublicHome },
      { path: "events", Component: PublicEvents },
      { path: "live-streaming", Component: LiveStreaming },
      { path: "about", Component: About },
      { path: "contact", Component: Contact },
      { path: "vision", Component: Vision },
      { path: "history", Component: History },
      { path: "leadership", Component: Leadership },
      { path: "timeline", Component: Timeline },
      { path: "ministries-public", Component: MinistriesPublic },
      { path: "cibe-tickets", Component: CIBETickets },
      { path: "kids-portal", Component: KidsPortal },
      { path: "radio", Component: Radio },
      { path: "locations", Component: Locations },
      { path: "blog", Component: Blog },
    ],
  },
  {
    path: "/pending-activation",
    Component: PendingActivation,
  },
  {
    path: "/auth",
    errorElement: <ErrorBoundary />,
    children: [
      { path: "login", Component: Login },
      { path: "register", Component: Register },
      { path: "forgot-password", Component: ForgotPassword },
      { path: "reset-password", Component: ResetPassword },
      { path: "two-factor-setup", Component: TwoFactorSetup },
      { path: "two-factor-verify", Component: TwoFactorVerify },
      { path: "church-selector", Component: ChurchSelector },
      { path: "onboarding", Component: Onboarding },
    ],
  },
  {
    path: "/app-ui",
    Component: AppUI,
    errorElement: <ErrorBoundary />,
    children: [
      { index: true, Component: AppLanding },
      { path: "dashboard", Component: Dashboard },
      { path: "dashboard/field", Component: FieldDashboard },
      { path: "dashboard/regional", Component: RegionalDashboard },
      { path: "members", Component: Members },
      { path: "members/grid", Component: MembersGrid },
      { path: "members/new", Component: MemberRegistration },
      { path: "members/:id", Component: MemberProfile },
      { path: "members/:id/edit", Component: MemberEdit },
      { path: "members/:id/documents", Component: MemberDocuments },
      { path: "members/:id/family", Component: FamilyRelationships },
      { path: "members/:id/notes", Component: MemberNotes },
      { path: "members/import", Component: MemberImport },
      { path: "crm", Component: CRM },
      { path: "crm/new", Component: CRMNew },
      { path: "crm/spreadsheet", Component: Spreadsheet },
      { path: "crm/pipeline", Component: CRMPipeline },
      { path: "secretariat/pipeline", Component: SecretariatPipeline },
      { path: "secretariat/services", Component: ServicesMatrix },
      { path: "secretariat/pipelines", Component: PipelinesAdmin },
      { path: "crm/:id", Component: LeadDetail },
      { path: "crm/detail/:id", Component: CRMDetail },
      { path: "finance", Component: Finance },
      { path: "finance/new", Component: FinanceNew },
      { path: "finance/cashbook", Component: Cashbook },
      { path: "finance/income/new", Component: LancamentoNew },
      { path: "finance/expense/new", Component: LancamentoNew },
      { path: "finance/lancamento/new", Component: LancamentoNew },
      { path: "ministries", Component: Ministries },
      { path: "ministries/:id", Component: MinistryDetail },
      { path: "communication", Component: Communication },
      { path: "communication/whatsapp-inbox", Component: WhatsAppInbox },
      { path: "whatsapp", Component: WhatsApp },
      { path: "email", Component: EmailCampaigns },
      { path: "email/new", Component: EmailNew },
      { path: "events", Component: Agenda },
      { path: "daily-bread", Component: DailyBread },
      { path: "events/:id", Component: EventDetail },
      { path: "events/new", Component: EventsNew },
      { path: "system", Component: System },
      { path: "pastoral", Component: Pastoral },
      { path: "pastoral/visit-detail", Component: VisitDetail },
      { path: "pastoral/prayer-requests", Component: PrayerWall },
      { path: "baptism", Component: Baptism },
      { path: "baptism/new", Component: BaptismNew },
      { path: "baptism/events/:id", Component: BaptismEventDetail },
      { path: "cells", Component: CellGroups },
      { path: "cells/list", Component: CellsList },
      { path: "cells/reports", Component: CellReports },
      { path: "cells/new", Component: CellNewScreen },
      { path: "cells/:id", Component: CellDetail },
      { path: "checkin", Component: CheckIn },
      { path: "checkin/home", Component: CheckinHome },
      { path: "checkin/members", Component: MemberCheckin },
      { path: "checkin/manual", Component: CheckInManual },
      { path: "checkin/history", Component: CheckInHistory },
      { path: "automation", Component: Automation },
      { path: "automation/builder", Component: AutomationBuilderComponent },
      { path: "reports", Component: Reports },
      { path: "reports/dashboard", Component: ReportsDashboard },
      { path: "system-settings", Component: SystemSettings },
      { path: "system/users", Component: UsersList },
      { path: "system/users/new", Component: UserNew },
      { path: "system/users/:id/edit", Component: UserEdit },
      { path: "system/users/:id/permissions", Component: UserPermissions },
      { path: "system/church-info", Component: ChurchInfo },
      { path: "system/branding", Component: Branding },
      { path: "system/localization", Component: Localization },
      { path: "system/roles", Component: Roles },
      { path: "system/permissions", Component: Permissions },
      { path: "system/security", Component: Security },
      { path: "system/audit-log", Component: SystemAuditLog },
      { path: "system/api-keys", Component: ApiKeys },
      { path: "system/notifications", Component: SystemNotificationSettings },
      { path: "system/templates", Component: Templates },
      { path: "system/email", Component: SystemEmailSettings },
      { path: "system/whatsapp", Component: SystemWhatsAppSettings },
      { path: "system/sms", Component: SmsSettings },
      { path: "system/integrations", Component: Integrations },
      { path: "system/webhooks", Component: Webhooks },
      { path: "system/api", Component: Api },
      { path: "system/import", Component: Import },
      { path: "system/export", Component: Export },
      { path: "system/backup", Component: Backup },
      { path: "notifications", Component: Notifications },
      { path: "inbox", Component: Inbox },
      { path: "consecration", Component: Consecration },
      { path: "transfer", Component: Transfer },
      { path: "credentials", Component: Credentials },
      { path: "birthdays", Component: Birthdays },
      { path: "configuration-center", Component: ConfigurationCenter },
      { path: "churches", Component: Churches },
      { path: "contacts", Component: ContactsModule },
      { path: "prospecting", Component: ProspectingModule },
      { path: "attendance", Component: AttendanceModule },
      { path: "finance/transactions", Component: FinanceTransactions },
      { path: "finance/cash-flow", Component: FinanceCashFlow },
      { path: "requirements", Component: Requerimentos },
      { path: "requirements/new", Component: RequirementsNew },
      { path: "baptism-requests", Component: BaptismRequests },
      { path: "consecration-requests", Component: ConsecrationRequests },
      { path: "transfer-requests", Component: TransferRequests },
      { path: "ticket-purchase", Component: TicketPurchase },
      { path: "church-dashboard", Component: ChurchDashboard },
      { path: "ministry-dashboard", Component: MinistryDashboard },
      { path: "financial-dashboard", Component: FinancialDashboard },
      { path: "member-photo", Component: MemberPhoto },
      { path: "family-tree", Component: FamilyTree },
      { path: "membership-history", Component: MembershipHistory },
      { path: "member-export", Component: MemberExport },
      { path: "member-merge", Component: MemberMerge },
      { path: "member-archive", Component: MemberArchive },
      { path: "visitor-checkin", Component: VisitorCheckin },
      { path: "kids-checkin", Component: KidsCheckin },
      { path: "kids-pickup", Component: KidsPickup },
      { path: "service-selector", Component: ServiceSelector },
      { path: "checkin-kiosk", Component: CheckinKiosk },
      { path: "attendance-live", Component: AttendanceLive },
      { path: "whatsapp-conversation", Component: WhatsAppConversation },
      { path: "whatsapp-contacts", Component: WhatsAppContacts },
      { path: "whatsapp-auto-reply", Component: WhatsAppAutoReply },
      { path: "whatsapp-campaign", Component: WhatsAppCampaign },
      { path: "email-campaigns-screen", Component: EmailCampaignsScreen },
      { path: "email-composer", Component: EmailComposer },
      { path: "email-templates", Component: EmailTemplates },
      { path: "email-template-editor", Component: EmailTemplateEditor },
      { path: "email-analytics", Component: EmailAnalytics },
      { path: "sms-campaigns", Component: SMSCampaigns },
      { path: "notification-center", Component: NotificationCenter },
      { path: "broadcast-message", Component: BroadcastMessage },
      { path: "ministry-new", Component: MinistryNew },
      { path: "ministry-leaders", Component: MinistryLeaders },
      { path: "ministry-departments", Component: MinistryDepartments },
      { path: "ministry-teams", Component: MinistryTeams },
      { path: "ministry-volunteers", Component: MinistryVolunteers },
      { path: "ministry-schedule", Component: MinistrySchedule },
      { path: "volunteer-application", Component: VolunteerApplication },
      { path: "cell-new-screen", Component: CellNewScreen },
      { path: "cell-detail-screen", Component: CellDetailScreen },
      { path: "cell-leaders", Component: CellLeaders },
      { path: "cell-members", Component: CellMembers },
      { path: "cell-meeting-report", Component: CellMeetingReport },
      { path: "cell-attendance", Component: CellAttendance },
      { path: "cell-growth", Component: CellGrowth },
      { path: "cell-multiplication", Component: CellMultiplication },
      { path: "member-growth-report", Component: MemberGrowthReport },
      { path: "financial-analytics-report", Component: FinancialAnalyticsReport },
      { path: "attendance-analytics-report", Component: AttendanceAnalyticsReport },
      { path: "ministry-distribution-report", Component: MinistryDistributionReport },
      { path: "event-participation-report", Component: EventParticipationReport },
      { path: "giving-analytics-report", Component: GivingAnalyticsReport },
      { path: "custom-reports", Component: CustomReports },
      { path: "report-builder", Component: ReportBuilder },
      { path: "data-export", Component: DataExport },
      { path: "user-new", Component: UserNewPlaceholder },
      { path: "user-edit", Component: UserEditPlaceholder },
      { path: "roles-list", Component: RolesList },
      { path: "role-new", Component: RoleNew },
      { path: "permissions-matrix", Component: PermissionsMatrixPlaceholder },
      { path: "church-settings", Component: ChurchSettings },
      { path: "theme-settings", Component: ThemeSettings },
      { path: "integration-settings", Component: IntegrationSettings },
      { path: "webhook-settings", Component: WebhookSettings },
      { path: "api-keys", Component: APIKeys },
      { path: "notification-settings", Component: NotificationSettings },
      { path: "email-settings", Component: EmailSettings },
      { path: "whatsapp-settings", Component: WhatsAppSettings },
      { path: "backup-settings", Component: BackupSettings },
      { path: "audit-log", Component: AuditLog },
      { path: "field-switcher", Component: FieldSwitcher },
      { path: "church-hierarchy", Component: ChurchHierarchy },
      { path: "regional-view", Component: RegionalView },
      { path: "church-transfer", Component: ChurchTransfer },
      { path: "consolidated-reports", Component: ConsolidatedReports },
      { path: "visit-new", Component: VisitNew },
      { path: "visit-report", Component: VisitReport },
      { path: "counseling-list", Component: CounselingList },
      { path: "counseling-new", Component: CounselingNew },
      { path: "counseling-session", Component: CounselingSession },
      { path: "prayer-new", Component: PrayerNew },
      { path: "prayer-wall", Component: PrayerWall },
      { path: "followup-dashboard", Component: FollowupDashboard },
      { path: "discipleship-tracking", Component: DiscipleshipTracking },
      { path: "discipleship-new", Component: DiscipleshipNew },
      { path: "discipleship-curriculum", Component: DiscipleshipCurriculum },
      { path: "pastoral-timeline", Component: PastoralTimeline },
      { path: "pastoral-kanban", Component: PastoralKanban },
      { path: "pastoral-reports", Component: PastoralReports },
      { path: "category-management", Component: CategoryManagement },
      { path: "chart-of-accounts", Component: ChartOfAccounts },
      { path: "monthly-closing", Component: MonthlyClosing },
      { path: "budget-planning", Component: BudgetPlanning },
      { path: "budget-vs-actual", Component: BudgetVsActual },
      { path: "giving-dashboard", Component: GivingDashboard },
      { path: "giving-statements", Component: GivingStatements },
      { path: "recurring-transactions", Component: RecurringTransactions },
      { path: "bank-reconciliation", Component: BankReconciliation },
      { path: "financial-reports", Component: FinancialReports },
      { path: "lead-new", Component: LeadNewForm },
      { path: "lead-edit", Component: LeadEdit },
      { path: "lead-timeline", Component: LeadTimeline },
      { path: "lead-notes", Component: LeadNotes },
      { path: "lead-tasks", Component: LeadTasks },
      { path: "lead-emails", Component: LeadEmails },
      { path: "lead-calls", Component: LeadCalls },
      { path: "deal-detail", Component: DealDetail },
      { path: "deal-stages", Component: DealStages },
      { path: "contact-properties", Component: ContactProperties },
      { path: "custom-fields", Component: CustomFields },
      { path: "assignments", Component: Assignments },
      { path: "crm-reports", Component: CRMReports },
      { path: "automation-triggers", Component: AutomationTriggers },
      { path: "automation-actions", Component: AutomationActions },
      { path: "automation-conditions", Component: AutomationConditions },
      { path: "automation-templates", Component: AutomationTemplates },
      { path: "automation-analytics", Component: AutomationAnalytics },
      { path: "automation-logs", Component: AutomationLogs },
      { path: "automation-test", Component: AutomationTest },
      { path: "event-new", Component: EventNew },
      { path: "event-edit", Component: EventEdit },
      { path: "ticket-types", Component: TicketTypes },
      { path: "ticket-payment", Component: TicketPayment },
      { path: "ticket-confirmation", Component: TicketConfirmation },
      { path: "ticket-qrcode", Component: TicketQRCode },
      { path: "checkin-dashboard", Component: CheckinDashboard },
      { path: "checkin-scanner", Component: CheckinScanner },
      { path: "checkin-manual-screen", Component: CheckinManualScreen },
      { path: "attendance-reports", Component: AttendanceReports },
      { path: "event-registration", Component: EventRegistration },
      { path: "baptism-form", Component: BaptismForm },
      { path: "baptism/request/new", Component: BaptismRequestNew },
      { path: "baptism-approval", Component: BaptismApproval },
      { path: "baptism-workflow", Component: BaptismWorkflow },
      { path: "baptism-certificate", Component: BaptismCertificate },
      { path: "consecration/new", Component: ConsecrationNewForm },
      { path: "consecration-workflow", Component: ConsecrationWorkflow },
      { path: "transfer/new", Component: TransferNewForm },
      { path: "transfer-form", Component: TransferForm },
      { path: "credentials-new", Component: CredentialNewForm },
      { path: "wedding-requests", Component: WeddingRequests },
      { path: "dedication-requests", Component: DedicationRequests },
      { path: "credential-models", Component: ModelosCredencial },
      { path: "credential-requests", Component: SolicitacoesCredencial },
    ],
  },
]);
