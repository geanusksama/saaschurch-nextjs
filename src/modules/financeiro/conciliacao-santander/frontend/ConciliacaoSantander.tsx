'use client'

import { useState } from 'react'
import { SantanderHomeView, type SantanderAccount } from './SantanderHomeView'
import { SantanderExtratoView } from './SantanderExtratoView'
import { CredenciaisModal } from './CredenciaisModal'
import { ImportarFebrabanModal } from './ImportarFebrabanModal'

interface ConciliacaoSantanderProps {
  churchId: string
  credentials: { id: string; apelido: string; ambiente: string }[]
  permissions: string[]
  planoDeContasOptions: { value: string; label: string }[]
  formaPagamentoOptions: { value: string; label: string }[]
}

interface ExtratoState {
  credentialId: string
  account: SantanderAccount
}

export function ConciliacaoSantander({
  churchId,
  credentials,
  permissions,
  planoDeContasOptions,
  formaPagamentoOptions,
}: ConciliacaoSantanderProps) {
  const [extrato, setExtrato] = useState<ExtratoState | null>(null)
  const [showConfig, setShowConfig] = useState(false)
  const [importAccounts, setImportAccounts] = useState<SantanderAccount[] | null>(null)

  if (extrato) {
    return (
      <>
        <SantanderExtratoView
          credentialId={extrato.credentialId}
          account={extrato.account}
          permissions={permissions}
          churchId={churchId}
          planoDeContasOptions={planoDeContasOptions}
          formaPagamentoOptions={formaPagamentoOptions}
          onBack={() => setExtrato(null)}
        />
        {importAccounts && (
          <ImportarFebrabanModal
            credentials={credentials}
            accounts={importAccounts}
            onClose={() => setImportAccounts(null)}
            onImported={() => setImportAccounts(null)}
          />
        )}
      </>
    )
  }

  return (
    <>
      <SantanderHomeView
        credentials={credentials}
        permissions={permissions}
        onSelectAccount={(credentialId, account) => setExtrato({ credentialId, account })}
        onOpenConfig={() => setShowConfig(true)}
        onOpenImport={(accounts) => setImportAccounts(accounts)}
      />

      {showConfig && (
        <CredenciaisModal
          onClose={() => setShowConfig(false)}
          onUpdated={() => window.location.reload()}
        />
      )}

      {importAccounts && (
        <ImportarFebrabanModal
          credentials={credentials}
          accounts={importAccounts}
          onClose={() => setImportAccounts(null)}
          onImported={() => setImportAccounts(null)}
        />
      )}
    </>
  )
}
