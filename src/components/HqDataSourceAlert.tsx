import { Alert } from 'antd'
import type { ReactNode } from 'react'
import { isMockAuth } from '../services/auth'

type Props = {
  mockMessage: string
  mockDescription?: ReactNode
  /** Shown only in real API mode; keep short and accurate. */
  apiMessage?: string
  apiDescription?: ReactNode
}

const DEFAULT_API_MESSAGE = '已接总部正式 API；写操作会提交到后端。'

/** Page-level data-source banner: mock warning vs real-API info. */
export default function HqDataSourceAlert({
  mockMessage,
  mockDescription,
  apiMessage = DEFAULT_API_MESSAGE,
  apiDescription,
}: Props) {
  if (isMockAuth) {
    return <Alert type="warning" showIcon message={mockMessage} description={mockDescription} />
  }
  return <Alert type="info" showIcon message={apiMessage} description={apiDescription} />
}
