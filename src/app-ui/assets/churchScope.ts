function normalizeText(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Mesma regra de isRestrictedToOwnChurch do backend (src/lib/helpers.ts):
 * perfil "church" ou funcao de secretaria/tesouraria ficam presos a propria
 * igreja - o campo de igreja nasce preenchido e nao pode ser trocado. Master,
 * admin e campo continuam livres para escolher.
 */
export function hasFixedChurchScope(user: { profileType?: string; roleName?: string }): boolean {
  const normalizedRole = normalizeText(user.roleName || '');
  const isSecretaryOrTreasurer = normalizedRole.includes('secret') || normalizedRole.includes('tesour');
  const isChurchScopedUser = user.profileType === 'church';
  return isChurchScopedUser || isSecretaryOrTreasurer;
}
