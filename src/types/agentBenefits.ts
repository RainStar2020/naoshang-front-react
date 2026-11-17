export type AgentBenefitLevel = 'province' | 'city' | 'district' | 'store' | 'costore_owner'

export interface AgentBenefit {
  agentLevel: AgentBenefitLevel
  title: string
  content: string
  version: number
}

export interface AgentBenefitsCatalog {
  total: number
  items: AgentBenefit[]
}

export interface AgentBenefitMutationReceipt {
  receiptId: string
  operationId: string
  benefit: AgentBenefit
}
