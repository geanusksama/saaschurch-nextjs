/**
 * Regra de acesso ao módulo de envio automático da contabilidade: função
 * (roleName) de Tesouraria, nunca Secretaria — pedido explícito do usuário.
 * Arquivo sem dependências de servidor (sem supabase-admin) para poder ser
 * importado tanto pelas rotas de API quanto pela UI (client component).
 */

function normalizeRoleName(value = ''): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

export function podeAcessarContabilidadeAgendamento(profileType?: string | null, roleName?: string | null): boolean {
  const role = normalizeRoleName(roleName || '')
  if (role.includes('secret')) return false // nunca pra secretaria, mesmo que master/admin tenham essa função
  if (profileType === 'master' || profileType === 'admin') return true
  return role.includes('tesour')
}
