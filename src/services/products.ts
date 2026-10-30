import { authService, isMockAuth } from './auth'
import { hasPermission } from '../auth/access'
import type { HqPermission } from '../types/auth'
import { ProductError, type ProductMutation } from '../types/products'
import { mockProductCatalog, mockProductMutate } from './mock/products'
import { mockAssetUrl, mockCmsUpload } from './mock/cms'
import * as real from './real/products'

async function authorize(token: string, permission: HqPermission = 'products:access') {
  const { account } = await authService.getSession(token)
  if (!hasPermission(account, 'products:access') || !hasPermission(account, permission)) throw new ProductError('FORBIDDEN', '没有商品查询或操作权限')
  return account
}

export const productsService = {
  async catalog(token: string) {
    await authorize(token)
    if (isMockAuth) return mockProductCatalog()
    return (await real.realProductCatalog()) as Awaited<ReturnType<typeof mockProductCatalog>>
  },
  async mutate(token: string, input: ProductMutation) {
    const permissions = { 'save-category': 'products:categories', 'rename-type': 'products:types', 'save-product': 'products:edit', 'on-sale': 'products:publish', 'off-sale': 'products:publish' } as const
    const permission = permissions[input.action]
    if (!permission) throw new ProductError('INVALID_INPUT', '商品操作类型无效')
    const account = await authorize(token, permission)
    if (isMockAuth) return mockProductMutate(input, account)
    return (await real.realProductMutate(input)) as Awaited<ReturnType<typeof mockProductMutate>>
  },
  async upload(token: string, file: File) {
    await authorize(token, 'products:edit')
    if (isMockAuth) return mockCmsUpload(file)
    return (await real.realProductUpload(file)) as Awaited<ReturnType<typeof mockCmsUpload>>
  },
  resolveAsset: (url: string) => (isMockAuth ? mockAssetUrl(url) : real.realProductAssetUrl(url)),
}
