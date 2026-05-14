// System Settings Screens
export { ChurchInfo } from './ChurchInfo';
export { Branding } from './Branding';
export { AuditLog } from './AuditLog';
export { Security } from './Security';
export { ApiKeys } from './ApiKeys';
export { Backup } from './Backup';
export { Webhooks } from './Webhooks';
export { Roles } from './Roles';
export { Import, Export } from './ImportExport';
export { Permissions } from './Permissions';
export { NotificationSettings } from './NotificationSettings';
export { Templates } from './Templates';
export { EmailSettings } from './EmailSettings';
export { WhatsAppSettings } from './WhatsAppSettings';
export { SmsSettings } from './SmsSettings';
export { Integrations } from './Integrations';
export { Api } from './Api';

// Re-export with specific configurations
import { SettingsPlaceholder } from './SettingsPlaceholder';
import { Globe } from 'lucide-react';

export const Localization = () => <SettingsPlaceholder title="Localização e Idioma" description="Configure fuso horário, moeda e idioma" icon={Globe} />;
