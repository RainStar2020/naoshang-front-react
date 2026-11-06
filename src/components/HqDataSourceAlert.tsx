import type { ReactNode } from 'react'

type Props = {
  mockMessage: string
  mockDescription?: ReactNode
  apiMessage?: string
  apiDescription?: ReactNode
}

/** 页顶数据源提示已按产品要求移除；组件保留为空渲染以免各页 import 失效。 */
export default function HqDataSourceAlert(_props: Props) {
  return null
}
