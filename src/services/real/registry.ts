/** 由 src/types/hq 契约生成的真实模块绑定；每个操作调用对应的具名 API 函数。 */
import * as api from '../../api'
import type { HqEndpoints } from '../../types/hq'
import { requiredPath, type LiveModule } from './modules'

export const liveModules: LiveModule[] = [
  { name: 'auth', title: '登录与会话', route: '/session', operations: [
    {
      key: 'GET /auth/me', method: 'GET', path: '/auth/me',
      title: '返回当前管理员资料与 token 过期时间。', params: [], actions: [],
      invoke: (input) => api.getAuthMe(input.query, input.options),
    },
    {
      key: 'POST /auth/password', method: 'POST', path: '/auth/password',
      title: '修改当前管理员口令（校验原口令；改密后强制重登）。', params: [], actions: [],
      invoke: (input) => api.postAuthPassword(input.request?.body as HqEndpoints['POST /auth/password']['request'], input.options),
    },
  ] },
  { name: 'users', title: '账号管理', route: '/users', operations: [
    {
      key: 'GET /users', method: 'GET', path: '/users',
      title: '账号分页列表，支持 `keyword` / `frozen` / `tier` 过滤。', params: [], actions: [],
      invoke: (input) => api.getUsers(input.query, input.options),
    },
    {
      key: 'GET /users/catalog', method: 'GET', path: '/users/catalog',
      title: '筛选项与汇总（总数/冻结数/活跃数）。', params: [], actions: [],
      invoke: (input) => api.getUsersCatalog(input.query, input.options),
    },
    {
      key: 'GET /users/:accountId', method: 'GET', path: '/users/:accountId',
      title: '账号详情：profile + 关联会员 + 审计摘要（手机号完整）。', params: ['accountId'], actions: [],
      invoke: (input) => api.getUsersByAccountId({ accountId: requiredPath(input, 'accountId') }, input.query, input.options),
    },
    {
      key: 'POST /users/:accountId/mutate', method: 'POST', path: '/users/:accountId/mutate',
      title: '账号写操作：冻结/解冻/备注（reason + version + 幂等）。', params: ['accountId'], actions: ['freeze', 'unfreeze', 'update-note'],
      invoke: (input) => api.postUsersByAccountIdMutate({ accountId: requiredPath(input, 'accountId') }, input.request as HqEndpoints['POST /users/:accountId/mutate']['request'], input.options),
    },
  ] },
  { name: 'members', title: '会员档案', route: '/members', operations: [
    {
      key: 'GET /members', method: 'GET', path: '/members',
      title: '会员分页列表。', params: [], actions: [],
      invoke: (input) => api.getMembers(input.query, input.options),
    },
    {
      key: 'GET /members/catalog', method: 'GET', path: '/members/catalog',
      title: '筛选项与汇总。', params: [], actions: [],
      invoke: (input) => api.getMembersCatalog(input.query, input.options),
    },
    {
      key: 'GET /members/:memberId', method: 'GET', path: '/members/:memberId',
      title: '会员详情（含归属门店名）。', params: ['memberId'], actions: [],
      invoke: (input) => api.getMembersByMemberId({ memberId: requiredPath(input, 'memberId') }, input.query, input.options),
    },
    {
      key: 'POST /members/:memberId/mutate', method: 'POST', path: '/members/:memberId/mutate',
      title: '会员写操作：改资料/绑定或解绑门店/设状态。', params: ['memberId'], actions: ['update-profile', 'bind-store', 'unbind-store', 'set-status'],
      invoke: (input) => api.postMembersByMemberIdMutate({ memberId: requiredPath(input, 'memberId') }, input.request as HqEndpoints['POST /members/:memberId/mutate']['request'], input.options),
    },
  ] },
  { name: 'course', title: '课程权益', route: '/course', operations: [
    {
      key: 'GET /course/entitlements', method: 'GET', path: '/course/entitlements',
      title: '课程权益分页列表。', params: [], actions: [],
      invoke: (input) => api.getCourseEntitlements(input.query, input.options),
    },
    {
      key: 'GET /course/catalog', method: 'GET', path: '/course/catalog',
      title: '筛选项与汇总。', params: [], actions: [],
      invoke: (input) => api.getCourseCatalog(input.query, input.options),
    },
    {
      key: 'GET /course/entitlements/:entitlementId', method: 'GET', path: '/course/entitlements/:entitlementId',
      title: '单条权益详情。', params: ['entitlementId'], actions: [],
      invoke: (input) => api.getCourseEntitlementsByEntitlementId({ entitlementId: requiredPath(input, 'entitlementId') }, input.query, input.options),
    },
    {
      key: 'POST /course/entitlements/:entitlementId/mutate', method: 'POST', path: '/course/entitlements/:entitlementId/mutate',
      title: '权益写操作：发放/撤回/延期/改属性。', params: ['entitlementId'], actions: ['grant', 'revoke', 'extend', 'update'],
      invoke: (input) => api.postCourseEntitlementsByEntitlementIdMutate({ entitlementId: requiredPath(input, 'entitlementId') }, input.request as HqEndpoints['POST /course/entitlements/:entitlementId/mutate']['request'], input.options),
    },
    {
      key: 'POST /course/entitlements', method: 'POST', path: '/course/entitlements',
      title: '新建课程权益发放记录。', params: [], actions: [],
      invoke: (input) => api.postCourseEntitlements(input.request as HqEndpoints['POST /course/entitlements']['request'], input.options),
    },
  ] },
  { name: 'columns', title: '专栏内容', route: '/columns', operations: [
    {
      key: 'GET /columns/catalog', method: 'GET', path: '/columns/catalog',
      title: '专栏筛选项与汇总。', params: [], actions: [],
      invoke: (input) => api.getColumnsCatalog(input.query, input.options),
    },
    {
      key: 'GET /columns/:columnId', method: 'GET', path: '/columns/:columnId',
      title: '专栏详情（含已发布章节）。', params: ['columnId'], actions: [],
      invoke: (input) => api.getColumnsByColumnId({ columnId: requiredPath(input, 'columnId') }, input.query, input.options),
    },
    {
      key: 'GET /columns/:columnId/records', method: 'GET', path: '/columns/:columnId/records',
      title: '专栏下的学习/购买记录。', params: ['columnId'], actions: [],
      invoke: (input) => api.getColumnsByColumnIdRecords({ columnId: requiredPath(input, 'columnId') }, input.query, input.options),
    },
    {
      key: 'POST /columns/:columnId/mutate', method: 'POST', path: '/columns/:columnId/mutate',
      title: '专栏写操作：发布/下架/更新/归档。', params: ['columnId'], actions: ['publish', 'unpublish', 'update', 'archive'],
      invoke: (input) => api.postColumnsByColumnIdMutate({ columnId: requiredPath(input, 'columnId') }, input.request as HqEndpoints['POST /columns/:columnId/mutate']['request'], input.options),
    },
    {
      key: 'POST /columns/assets', method: 'POST', path: '/columns/assets',
      title: '上传/关联专栏素材资源。', params: [], actions: [],
      invoke: (input) => api.postColumnsAssets(input.request as HqEndpoints['POST /columns/assets']['request'], input.options),
    },
  ] },
  { name: 'announcements', title: '公告', route: '/announcements', operations: [
    {
      key: 'GET /announcements', method: 'GET', path: '/announcements',
      title: '公告分页列表。', params: [], actions: [],
      invoke: (input) => api.getAnnouncements(input.query, input.options),
    },
    {
      key: 'GET /announcements/catalog', method: 'GET', path: '/announcements/catalog',
      title: '筛选项与汇总。', params: [], actions: [],
      invoke: (input) => api.getAnnouncementsCatalog(input.query, input.options),
    },
    {
      key: 'GET /announcements/:announcementId', method: 'GET', path: '/announcements/:announcementId',
      title: '公告详情。', params: ['announcementId'], actions: [],
      invoke: (input) => api.getAnnouncementsByAnnouncementId({ announcementId: requiredPath(input, 'announcementId') }, input.query, input.options),
    },
    {
      key: 'POST /announcements/mutate', method: 'POST', path: '/announcements/mutate',
      title: '新建公告。', params: [], actions: [],
      invoke: (input) => api.postAnnouncementsMutate(input.request as HqEndpoints['POST /announcements/mutate']['request'], input.options),
    },
    {
      key: 'POST /announcements/:announcementId/mutate', method: 'POST', path: '/announcements/:announcementId/mutate',
      title: '公告写操作：发布/撤回/更新/删除。', params: ['announcementId'], actions: ['publish', 'unpublish', 'update', 'delete'],
      invoke: (input) => api.postAnnouncementsByAnnouncementIdMutate({ announcementId: requiredPath(input, 'announcementId') }, input.request as HqEndpoints['POST /announcements/:announcementId/mutate']['request'], input.options),
    },
  ] },
  { name: 'materials', title: '资料中心', route: '/materials', operations: [
    {
      key: 'GET /materials', method: 'GET', path: '/materials',
      title: '资料分页列表。', params: [], actions: [],
      invoke: (input) => api.getMaterials(input.query, input.options),
    },
    {
      key: 'GET /materials/catalog', method: 'GET', path: '/materials/catalog',
      title: '筛选项与汇总。', params: [], actions: [],
      invoke: (input) => api.getMaterialsCatalog(input.query, input.options),
    },
    {
      key: 'GET /materials/:materialId', method: 'GET', path: '/materials/:materialId',
      title: '资料详情与下载信息。', params: ['materialId'], actions: [],
      invoke: (input) => api.getMaterialsByMaterialId({ materialId: requiredPath(input, 'materialId') }, input.query, input.options),
    },
    {
      key: 'POST /materials/mutate', method: 'POST', path: '/materials/mutate',
      title: '新建资料。', params: [], actions: [],
      invoke: (input) => api.postMaterialsMutate(input.request as HqEndpoints['POST /materials/mutate']['request'], input.options),
    },
    {
      key: 'POST /materials/assets', method: 'POST', path: '/materials/assets',
      title: '上传资料素材文件。', params: [], actions: [],
      invoke: (input) => api.postMaterialsAssets(input.request as HqEndpoints['POST /materials/assets']['request'], input.options),
    },
  ] },
  { name: 'activationCodes', title: '激活码', route: '/activation-codes', operations: [
    {
      key: 'GET /activation-codes/batches', method: 'GET', path: '/activation-codes/batches',
      title: '激活码批次列表。', params: [], actions: [],
      invoke: (input) => api.getActivationCodesBatches(input.query, input.options),
    },
    {
      key: 'GET /activation-codes/batches/:batchId', method: 'GET', path: '/activation-codes/batches/:batchId',
      title: '批次详情与统计。', params: ['batchId'], actions: [],
      invoke: (input) => api.getActivationCodesBatchesByBatchId({ batchId: requiredPath(input, 'batchId') }, input.query, input.options),
    },
    {
      key: 'GET /activation-codes', method: 'GET', path: '/activation-codes',
      title: '激活码分页列表（码面脱敏）。', params: [], actions: [],
      invoke: (input) => api.getActivationCodes(input.query, input.options),
    },
    {
      key: 'GET /activation-codes/catalog', method: 'GET', path: '/activation-codes/catalog',
      title: '筛选项与汇总。', params: [], actions: [],
      invoke: (input) => api.getActivationCodesCatalog(input.query, input.options),
    },
    {
      key: 'POST /activation-codes/batches', method: 'POST', path: '/activation-codes/batches',
      title: '新建激活码批次（生成 N 个码）。', params: [], actions: [],
      invoke: (input) => api.postActivationCodesBatches(input.request as HqEndpoints['POST /activation-codes/batches']['request'], input.options),
    },
    {
      key: 'POST /activation-codes/mutate', method: 'POST', path: '/activation-codes/mutate',
      title: '激活码写操作：启用/停用/作废/改归属。', params: [], actions: ['activate', 'deactivate', 'revoke', 'reassign'],
      invoke: (input) => api.postActivationCodesMutate(input.request as HqEndpoints['POST /activation-codes/mutate']['request'], input.options),
    },
  ] },
  { name: 'softwareCards', title: '软件卡', route: '/software-cards', operations: [
    {
      key: 'GET /software-cards', method: 'GET', path: '/software-cards',
      title: '软件卡分页列表。', params: [], actions: [],
      invoke: (input) => api.getSoftwareCards(input.query, input.options),
    },
    {
      key: 'GET /software-cards/batches', method: 'GET', path: '/software-cards/batches',
      title: '软件卡批次列表。', params: [], actions: [],
      invoke: (input) => api.getSoftwareCardsBatches(input.query, input.options),
    },
    {
      key: 'GET /software-cards/catalog', method: 'GET', path: '/software-cards/catalog',
      title: '筛选项与汇总。', params: [], actions: [],
      invoke: (input) => api.getSoftwareCardsCatalog(input.query, input.options),
    },
    {
      key: 'POST /software-cards/batches', method: 'POST', path: '/software-cards/batches',
      title: '新建软件卡批次。', params: [], actions: [],
      invoke: (input) => api.postSoftwareCardsBatches(input.request as HqEndpoints['POST /software-cards/batches']['request'], input.options),
    },
    {
      key: 'POST /software-cards/mutate', method: 'POST', path: '/software-cards/mutate',
      title: '软件卡写操作：激活/停用/作废/绑定用户。', params: [], actions: ['activate', 'deactivate', 'revoke', 'bind'],
      invoke: (input) => api.postSoftwareCardsMutate(input.request as HqEndpoints['POST /software-cards/mutate']['request'], input.options),
    },
  ] },
  { name: 'quotas', title: '配额', route: '/quotas', operations: [
    {
      key: 'GET /quotas', method: 'GET', path: '/quotas',
      title: '配额账户分页列表。', params: [], actions: [],
      invoke: (input) => api.getQuotas(input.query, input.options),
    },
    {
      key: 'GET /quotas/catalog', method: 'GET', path: '/quotas/catalog',
      title: '筛选项与汇总。', params: [], actions: [],
      invoke: (input) => api.getQuotasCatalog(input.query, input.options),
    },
    {
      key: 'GET /quotas/:quotaId', method: 'GET', path: '/quotas/:quotaId',
      title: '配额账户详情与流水。', params: ['quotaId'], actions: [],
      invoke: (input) => api.getQuotasByQuotaId({ quotaId: requiredPath(input, 'quotaId') }, input.query, input.options),
    },
    {
      key: 'POST /quotas/:quotaId/mutate', method: 'POST', path: '/quotas/:quotaId/mutate',
      title: '配额写操作：调整/冻结/解冻/重置。', params: ['quotaId'], actions: ['adjust', 'freeze', 'unfreeze', 'reset'],
      invoke: (input) => api.postQuotasByQuotaIdMutate({ quotaId: requiredPath(input, 'quotaId') }, input.request as HqEndpoints['POST /quotas/:quotaId/mutate']['request'], input.options),
    },
  ] },
  { name: 'products', title: '商品', route: '/products', operations: [
    {
      key: 'GET /products', method: 'GET', path: '/products',
      title: '商品分页列表。', params: [], actions: [],
      invoke: (input) => api.getProducts(input.query, input.options),
    },
    {
      key: 'GET /products/catalog', method: 'GET', path: '/products/catalog',
      title: '筛选项与汇总。', params: [], actions: [],
      invoke: (input) => api.getProductsCatalog(input.query, input.options),
    },
    {
      key: 'GET /products/:productId', method: 'GET', path: '/products/:productId',
      title: '商品详情（含 SKU 与价格，两位小数）。', params: ['productId'], actions: [],
      invoke: (input) => api.getProductsByProductId({ productId: requiredPath(input, 'productId') }, input.query, input.options),
    },
    {
      key: 'POST /products/mutate', method: 'POST', path: '/products/mutate',
      title: '新建商品（含 SKU）。', params: [], actions: ['create'],
      invoke: (input) => api.postProductsMutate(input.request as HqEndpoints['POST /products/mutate']['request'], input.options),
    },
    {
      key: 'POST /products/:productId/mutate', method: 'POST', path: '/products/:productId/mutate',
      title: '商品写操作：改资料/上下架/改价。', params: ['productId'], actions: ['create', 'update', 'on-shelf', 'off-shelf', 'update-price'],
      invoke: (input) => api.postProductsByProductIdMutate({ productId: requiredPath(input, 'productId') }, input.request as HqEndpoints['POST /products/:productId/mutate']['request'], input.options),
    },
  ] },
  { name: 'delivery', title: '履约发货', route: '/delivery', operations: [
    {
      key: 'GET /delivery/shipments', method: 'GET', path: '/delivery/shipments',
      title: '发货单分页列表。', params: [], actions: [],
      invoke: (input) => api.getDeliveryShipments(input.query, input.options),
    },
    {
      key: 'GET /delivery/catalog', method: 'GET', path: '/delivery/catalog',
      title: '筛选项与汇总。', params: [], actions: [],
      invoke: (input) => api.getDeliveryCatalog(input.query, input.options),
    },
    {
      key: 'GET /delivery/shipments/:shipmentId', method: 'GET', path: '/delivery/shipments/:shipmentId',
      title: '发货单详情。', params: ['shipmentId'], actions: [],
      invoke: (input) => api.getDeliveryShipmentsByShipmentId({ shipmentId: requiredPath(input, 'shipmentId') }, input.query, input.options),
    },
    {
      key: 'POST /delivery/shipments/:shipmentId/mutate', method: 'POST', path: '/delivery/shipments/:shipmentId/mutate',
      title: '发货单写操作：发货/妥投/取消/更新物流。', params: ['shipmentId'], actions: ['ship', 'deliver', 'cancel', 'update-tracking'],
      invoke: (input) => api.postDeliveryShipmentsByShipmentIdMutate({ shipmentId: requiredPath(input, 'shipmentId') }, input.request as HqEndpoints['POST /delivery/shipments/:shipmentId/mutate']['request'], input.options),
    },
    {
      key: 'POST /delivery/shipments', method: 'POST', path: '/delivery/shipments',
      title: '新建发货单。', params: [], actions: [],
      invoke: (input) => api.postDeliveryShipments(input.request as HqEndpoints['POST /delivery/shipments']['request'], input.options),
    },
  ] },
  { name: 'orders', title: '订单', route: '/orders', operations: [
    {
      key: 'GET /orders', method: 'GET', path: '/orders',
      title: '订单分页列表。', params: [], actions: [],
      invoke: (input) => api.getOrders(input.query, input.options),
    },
    {
      key: 'GET /orders/catalog', method: 'GET', path: '/orders/catalog',
      title: '筛选项与汇总。', params: [], actions: [],
      invoke: (input) => api.getOrdersCatalog(input.query, input.options),
    },
    {
      key: 'GET /orders/:orderId', method: 'GET', path: '/orders/:orderId',
      title: '订单详情（支付+履约双状态映射）。', params: ['orderId'], actions: [],
      invoke: (input) => api.getOrdersByOrderId({ orderId: requiredPath(input, 'orderId') }, input.query, input.options),
    },
    {
      key: 'POST /orders/:orderId/mutate', method: 'POST', path: '/orders/:orderId/mutate',
      title: '订单写操作：标记已付/退款/取消/完结。', params: ['orderId'], actions: ['mark-paid', 'refund', 'cancel', 'complete'],
      invoke: (input) => api.postOrdersByOrderIdMutate({ orderId: requiredPath(input, 'orderId') }, input.request as HqEndpoints['POST /orders/:orderId/mutate']['request'], input.options),
    },
  ] },
  { name: 'coupons', title: '优惠券', route: '/coupons', operations: [
    {
      key: 'GET /coupons/catalog', method: 'GET', path: '/coupons/catalog',
      title: '筛选项与汇总。', params: [], actions: [],
      invoke: (input) => api.getCouponsCatalog(input.query, input.options),
    },
    {
      key: 'GET /coupons/templates', method: 'GET', path: '/coupons/templates',
      title: '优惠券模板列表。', params: [], actions: [],
      invoke: (input) => api.getCouponsTemplates(input.query, input.options),
    },
    {
      key: 'GET /coupons', method: 'GET', path: '/coupons',
      title: '已发放优惠券分页列表。', params: [], actions: [],
      invoke: (input) => api.getCoupons(input.query, input.options),
    },
    {
      key: 'POST /coupons/mutate', method: 'POST', path: '/coupons/mutate',
      title: '优惠券写操作：建模板/改模板/发放/撤回。', params: [], actions: ['create-template', 'update-template', 'issue', 'revoke'],
      invoke: (input) => api.postCouponsMutate(input.request as HqEndpoints['POST /coupons/mutate']['request'], input.options),
    },
  ] },
  { name: 'payments', title: '支付对账', route: '/payments', operations: [
    {
      key: 'GET /payments/catalog', method: 'GET', path: '/payments/catalog',
      title: '筛选项与汇总。', params: [], actions: [],
      invoke: (input) => api.getPaymentsCatalog(input.query, input.options),
    },
    {
      key: 'GET /payments', method: 'GET', path: '/payments',
      title: '支付流水分页列表。', params: [], actions: [],
      invoke: (input) => api.getPayments(input.query, input.options),
    },
    {
      key: 'GET /payments/:paymentId', method: 'GET', path: '/payments/:paymentId',
      title: '单笔支付详情。', params: ['paymentId'], actions: [],
      invoke: (input) => api.getPaymentsByPaymentId({ paymentId: requiredPath(input, 'paymentId') }, input.query, input.options),
    },
    {
      key: 'GET /payments/jobs/:jobId', method: 'GET', path: '/payments/jobs/:jobId',
      title: '对账任务详情。', params: ['jobId'], actions: [],
      invoke: (input) => api.getPaymentsJobsByJobId({ jobId: requiredPath(input, 'jobId') }, input.query, input.options),
    },
    {
      key: 'GET /payments/export', method: 'GET', path: '/payments/export',
      title: '导出对账 CSV。', params: [], actions: [],
      invoke: (input) => api.getPaymentsExport(input.query, input.options),
    },
    {
      key: 'POST /payments/mutate', method: 'POST', path: '/payments/mutate',
      title: '支付写操作：触发对账/标记已结算/标异常/忽略。', params: [], actions: ['reconcile', 'mark-settled', 'flag-exception', 'ignore'],
      invoke: (input) => api.postPaymentsMutate(input.request as HqEndpoints['POST /payments/mutate']['request'], input.options),
    },
  ] },
  { name: 'revenue', title: '收益', route: '/revenue', operations: [
    {
      key: 'GET /revenue/accounts', method: 'GET', path: '/revenue/accounts',
      title: '收益账户分页列表。', params: [], actions: [],
      invoke: (input) => api.getRevenueAccounts(input.query, input.options),
    },
    {
      key: 'GET /revenue/catalog', method: 'GET', path: '/revenue/catalog',
      title: '筛选项与汇总。', params: [], actions: [],
      invoke: (input) => api.getRevenueCatalog(input.query, input.options),
    },
    {
      key: 'GET /revenue/ledgers', method: 'GET', path: '/revenue/ledgers',
      title: '收益明细流水。', params: [], actions: [],
      invoke: (input) => api.getRevenueLedgers(input.query, input.options),
    },
    {
      key: 'GET /revenue/accounts/:accountId', method: 'GET', path: '/revenue/accounts/:accountId',
      title: '单账户收益详情。', params: ['accountId'], actions: [],
      invoke: (input) => api.getRevenueAccountsByAccountId({ accountId: requiredPath(input, 'accountId') }, input.query, input.options),
    },
    {
      key: 'POST /revenue/mutate', method: 'POST', path: '/revenue/mutate',
      title: '收益写操作：调整/冻结/解冻/结算。', params: [], actions: ['adjust', 'freeze', 'unfreeze', 'settle'],
      invoke: (input) => api.postRevenueMutate(input.request as HqEndpoints['POST /revenue/mutate']['request'], input.options),
    },
  ] },
  { name: 'withdrawals', title: '提现', route: '/withdrawals', operations: [
    {
      key: 'GET /withdrawals', method: 'GET', path: '/withdrawals',
      title: '提现申请分页列表。', params: [], actions: [],
      invoke: (input) => api.getWithdrawals(input.query, input.options),
    },
    {
      key: 'GET /withdrawals/catalog', method: 'GET', path: '/withdrawals/catalog',
      title: '筛选项与汇总。', params: [], actions: [],
      invoke: (input) => api.getWithdrawalsCatalog(input.query, input.options),
    },
    {
      key: 'GET /withdrawals/:withdrawalId', method: 'GET', path: '/withdrawals/:withdrawalId',
      title: '提现详情（含手续费）。', params: ['withdrawalId'], actions: [],
      invoke: (input) => api.getWithdrawalsByWithdrawalId({ withdrawalId: requiredPath(input, 'withdrawalId') }, input.query, input.options),
    },
    {
      key: 'POST /withdrawals/:withdrawalId/mutate', method: 'POST', path: '/withdrawals/:withdrawalId/mutate',
      title: '提现写操作：通过/驳回/已打款/冲正。', params: ['withdrawalId'], actions: ['approve', 'reject', 'paid', 'reverse'],
      invoke: (input) => api.postWithdrawalsByWithdrawalIdMutate({ withdrawalId: requiredPath(input, 'withdrawalId') }, input.request as HqEndpoints['POST /withdrawals/:withdrawalId/mutate']['request'], input.options),
    },
  ] },
  { name: 'staff', title: '员工与角色', route: '/staff-roles', operations: [
    {
      key: 'GET /staff', method: 'GET', path: '/staff',
      title: '员工分页列表。', params: [], actions: [],
      invoke: (input) => api.getStaff(input.query, input.options),
    },
    {
      key: 'GET /staff/catalog', method: 'GET', path: '/staff/catalog',
      title: '筛选项与汇总。', params: [], actions: [],
      invoke: (input) => api.getStaffCatalog(input.query, input.options),
    },
    {
      key: 'GET /staff/:staffId', method: 'GET', path: '/staff/:staffId',
      title: '员工详情与归属门店。', params: ['staffId'], actions: [],
      invoke: (input) => api.getStaffByStaffId({ staffId: requiredPath(input, 'staffId') }, input.query, input.options),
    },
    {
      key: 'POST /staff/mutate', method: 'POST', path: '/staff/mutate',
      title: '新建员工。', params: [], actions: ['create'],
      invoke: (input) => api.postStaffMutate(input.request as HqEndpoints['POST /staff/mutate']['request'], input.options),
    },
    {
      key: 'POST /staff/:staffId/mutate', method: 'POST', path: '/staff/:staffId/mutate',
      title: '员工写操作：改资料/停用/分配门店。', params: ['staffId'], actions: ['create', 'update', 'disable', 'assign-store'],
      invoke: (input) => api.postStaffByStaffIdMutate({ staffId: requiredPath(input, 'staffId') }, input.request as HqEndpoints['POST /staff/:staffId/mutate']['request'], input.options),
    },
  ] },
  { name: 'stores', title: '门店', route: '/stores', operations: [
    {
      key: 'GET /stores', method: 'GET', path: '/stores',
      title: '门店分页列表（合并视图）。', params: [], actions: [],
      invoke: (input) => api.getStores(input.query, input.options),
    },
    {
      key: 'GET /stores/catalog', method: 'GET', path: '/stores/catalog',
      title: '筛选项与汇总。', params: [], actions: [],
      invoke: (input) => api.getStoresCatalog(input.query, input.options),
    },
    {
      key: 'GET /stores/:storeId', method: 'GET', path: '/stores/:storeId',
      title: '门店详情与负责人。', params: ['storeId'], actions: [],
      invoke: (input) => api.getStoresByStoreId({ storeId: requiredPath(input, 'storeId') }, input.query, input.options),
    },
    {
      key: 'POST /stores/mutate', method: 'POST', path: '/stores/mutate',
      title: '新建门店。', params: [], actions: ['create'],
      invoke: (input) => api.postStoresMutate(input.request as HqEndpoints['POST /stores/mutate']['request'], input.options),
    },
    {
      key: 'POST /stores/:storeId/mutate', method: 'POST', path: '/stores/:storeId/mutate',
      title: '门店写操作：改资料/停用/分配店主。', params: ['storeId'], actions: ['create', 'update', 'disable', 'assign-owner'],
      invoke: (input) => api.postStoresByStoreIdMutate({ storeId: requiredPath(input, 'storeId') }, input.request as HqEndpoints['POST /stores/:storeId/mutate']['request'], input.options),
    },
  ] },
  { name: 'training', title: '培训课时', route: '/training', operations: [
    {
      key: 'GET /training/balances', method: 'GET', path: '/training/balances',
      title: '课时余额分页列表。', params: [], actions: [],
      invoke: (input) => api.getTrainingBalances(input.query, input.options),
    },
    {
      key: 'GET /training/feedback', method: 'GET', path: '/training/feedback',
      title: '培训反馈列表。', params: [], actions: [],
      invoke: (input) => api.getTrainingFeedback(input.query, input.options),
    },
    {
      key: 'GET /training/catalog', method: 'GET', path: '/training/catalog',
      title: '筛选项与汇总。', params: [], actions: [],
      invoke: (input) => api.getTrainingCatalog(input.query, input.options),
    },
    {
      key: 'GET /training/members/:memberId', method: 'GET', path: '/training/members/:memberId',
      title: '单会员课时明细。', params: ['memberId'], actions: [],
      invoke: (input) => api.getTrainingMembersByMemberId({ memberId: requiredPath(input, 'memberId') }, input.query, input.options),
    },
    {
      key: 'POST /training/mutate', method: 'POST', path: '/training/mutate',
      title: '课时写操作：发放/扣减/冻结/重置。', params: [], actions: ['grant', 'deduct', 'freeze', 'reset'],
      invoke: (input) => api.postTrainingMutate(input.request as HqEndpoints['POST /training/mutate']['request'], input.options),
    },
  ] },
  { name: 'transfers', title: '转店', route: '/transfers', operations: [
    {
      key: 'GET /transfers', method: 'GET', path: '/transfers',
      title: '转店申请分页列表。', params: [], actions: [],
      invoke: (input) => api.getTransfers(input.query, input.options),
    },
    {
      key: 'GET /transfers/catalog', method: 'GET', path: '/transfers/catalog',
      title: '筛选项与汇总。', params: [], actions: [],
      invoke: (input) => api.getTransfersCatalog(input.query, input.options),
    },
    {
      key: 'GET /transfers/:applicationId', method: 'GET', path: '/transfers/:applicationId',
      title: '转店申请详情（含双方同意态）。', params: ['applicationId'], actions: [],
      invoke: (input) => api.getTransfersByApplicationId({ applicationId: requiredPath(input, 'applicationId') }, input.query, input.options),
    },
    {
      key: 'POST /transfers/:applicationId/mutate', method: 'POST', path: '/transfers/:applicationId/mutate',
      title: '转店写操作：通过/驳回/完成/取消。', params: ['applicationId'], actions: ['approve', 'reject', 'complete', 'cancel'],
      invoke: (input) => api.postTransfersByApplicationIdMutate({ applicationId: requiredPath(input, 'applicationId') }, input.request as HqEndpoints['POST /transfers/:applicationId/mutate']['request'], input.options),
    },
  ] },
  { name: 'partners', title: '合伙人', route: '/partners', operations: [
    {
      key: 'GET /partners', method: 'GET', path: '/partners',
      title: '合伙人分页列表。', params: [], actions: [],
      invoke: (input) => api.getPartners(input.query, input.options),
    },
    {
      key: 'GET /partners/catalog', method: 'GET', path: '/partners/catalog',
      title: '筛选项与汇总。', params: [], actions: [],
      invoke: (input) => api.getPartnersCatalog(input.query, input.options),
    },
    {
      key: 'GET /partners/:contextId', method: 'GET', path: '/partners/:contextId',
      title: '合伙人档案详情（含权益，手机号脱敏）。', params: ['contextId'], actions: [],
      invoke: (input) => api.getPartnersByContextId({ contextId: requiredPath(input, 'contextId') }, input.query, input.options),
    },
    {
      key: 'POST /partners/mutate', method: 'POST', path: '/partners/mutate',
      title: '合伙人写操作：存档案/存权益/升级/降级。', params: [], actions: ['save-context', 'save-benefits', 'promote', 'demote'],
      invoke: (input) => api.postPartnersMutate(input.request as HqEndpoints['POST /partners/mutate']['request'], input.options),
    },
  ] },
  { name: 'invitations', title: '邀请关系', route: '/invitations', operations: [
    {
      key: 'GET /invitations', method: 'GET', path: '/invitations',
      title: '邀请关系分页列表。', params: [], actions: [],
      invoke: (input) => api.getInvitations(input.query, input.options),
    },
    {
      key: 'GET /invitations/:accountId', method: 'GET', path: '/invitations/:accountId',
      title: '单账号邀请关系。', params: ['accountId'], actions: [],
      invoke: (input) => api.getInvitationsByAccountId({ accountId: requiredPath(input, 'accountId') }, input.query, input.options),
    },
    {
      key: 'GET /invitations/:accountId/team', method: 'GET', path: '/invitations/:accountId/team',
      title: '团队树（含 `graphVersion`）。', params: ['accountId'], actions: [],
      invoke: (input) => api.getInvitationsByAccountIdTeam({ accountId: requiredPath(input, 'accountId') }, input.query, input.options),
    },
    {
      key: 'POST /invitations/mutate', method: 'POST', path: '/invitations/mutate',
      title: '邀请写操作：绑定/解绑/重建/纠错。', params: [], actions: ['bind', 'unbind', 'rebuild', 'correct'],
      invoke: (input) => api.postInvitationsMutate(input.request as HqEndpoints['POST /invitations/mutate']['request'], input.options),
    },
  ] },
  { name: 'costore', title: '共创店', route: '/costore', operations: [
    {
      key: 'GET /costore/applications', method: 'GET', path: '/costore/applications',
      title: '共创店申请分页列表。', params: [], actions: [],
      invoke: (input) => api.getCostoreApplications(input.query, input.options),
    },
    {
      key: 'GET /costore/catalog', method: 'GET', path: '/costore/catalog',
      title: '筛选项与汇总。', params: [], actions: [],
      invoke: (input) => api.getCostoreCatalog(input.query, input.options),
    },
    {
      key: 'GET /costore/applications/:applicationId', method: 'GET', path: '/costore/applications/:applicationId',
      title: '申请详情与方案。', params: ['applicationId'], actions: [],
      invoke: (input) => api.getCostoreApplicationsByApplicationId({ applicationId: requiredPath(input, 'applicationId') }, input.query, input.options),
    },
    {
      key: 'POST /costore/mutate', method: 'POST', path: '/costore/mutate',
      title: '共创店写操作：通过/驳回/激活/终止。', params: [], actions: ['approve', 'reject', 'activate', 'terminate'],
      invoke: (input) => api.postCostoreMutate(input.request as HqEndpoints['POST /costore/mutate']['request'], input.options),
    },
  ] },
  { name: 'support', title: '客服工单', route: '/support', operations: [
    {
      key: 'GET /support/tickets', method: 'GET', path: '/support/tickets',
      title: '工单分页列表。', params: [], actions: [],
      invoke: (input) => api.getSupportTickets(input.query, input.options),
    },
    {
      key: 'GET /support/catalog', method: 'GET', path: '/support/catalog',
      title: '筛选项与汇总。', params: [], actions: [],
      invoke: (input) => api.getSupportCatalog(input.query, input.options),
    },
    {
      key: 'GET /support/tickets/:ticketId', method: 'GET', path: '/support/tickets/:ticketId',
      title: '工单详情与对话。', params: ['ticketId'], actions: [],
      invoke: (input) => api.getSupportTicketsByTicketId({ ticketId: requiredPath(input, 'ticketId') }, input.query, input.options),
    },
    {
      key: 'POST /support/tickets/:ticketId/mutate', method: 'POST', path: '/support/tickets/:ticketId/mutate',
      title: '工单写操作：回复/关闭/重开/分派/升级。', params: ['ticketId'], actions: ['reply', 'close', 'reopen', 'assign', 'escalate'],
      invoke: (input) => api.postSupportTicketsByTicketIdMutate({ ticketId: requiredPath(input, 'ticketId') }, input.request as HqEndpoints['POST /support/tickets/:ticketId/mutate']['request'], input.options),
    },
    {
      key: 'POST /support/tickets', method: 'POST', path: '/support/tickets',
      title: '新建工单。', params: [], actions: [],
      invoke: (input) => api.postSupportTickets(input.request as HqEndpoints['POST /support/tickets']['request'], input.options),
    },
  ] },
  { name: 'trace', title: '追踪溯源', route: '/trace', operations: [
    {
      key: 'GET /trace', method: 'GET', path: '/trace',
      title: '全量审计轨迹分页（只读）。', params: [], actions: [],
      invoke: (input) => api.getTrace(input.query, input.options),
    },
    {
      key: 'GET /trace/catalog', method: 'GET', path: '/trace/catalog',
      title: '筛选项与汇总。', params: [], actions: [],
      invoke: (input) => api.getTraceCatalog(input.query, input.options),
    },
    {
      key: 'GET /trace/:traceId', method: 'GET', path: '/trace/:traceId',
      title: '单条审计详情。', params: ['traceId'], actions: [],
      invoke: (input) => api.getTraceByTraceId({ traceId: requiredPath(input, 'traceId') }, input.query, input.options),
    },
    {
      key: 'GET /trace/by-request/:requestId', method: 'GET', path: '/trace/by-request/:requestId',
      title: '按请求 ID 追溯。', params: ['requestId'], actions: [],
      invoke: (input) => api.getTraceByRequestByRequestId({ requestId: requiredPath(input, 'requestId') }, input.query, input.options),
    },
  ] },
]
