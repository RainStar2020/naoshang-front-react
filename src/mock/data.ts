// ====== 课程素材 ======
export interface MaterialImage {
  id: string
  name: string
  thumb: string
  size: string
  category: string
  uploadedAt: string
}

export interface MaterialArticle {
  id: string
  title: string
  cover: string
  summary: string
  bodyHtml: string
  category: string
  wordCount: number
  updatedAt: string
}

export interface MaterialVideo {
  id: string
  name: string
  poster: string
  duration: string
  size: string
  category: string
  uploadedAt: string
}

// ====== 定价：商品 ======
export type ProductType = '课程' | '套餐' | '会员卡'

export interface Product {
  id: string
  name: string
  type: ProductType
  cover: string
  costPrice: number
  salePrice: number
  stock: number
  status: '上架中' | '已下架'
  updatedAt: string
}

// ====== 定价：会员等级 ======
export interface MemberPlan {
  id: string
  name: string
  level: number
  period: string
  price: number
  originalPrice: number
  discount: number // 折扣（如 0.8 表示八折）
  benefits: string[]
  enabled: boolean
}

// ====== 收益 ======
export interface RevenueUser {
  id: string
  name: string
  phone: string
  level: '普通会员' | '高级会员' | '合伙人'
  totalEarn: number
  withdrawn: number
  pending: number
  processing: number
  lastActive: string
  status: '已结算' | '待结算' | '提现中'
}

// ====== 门店 / 合伙人 / 代理 ======
export interface Store {
  id: string
  name: string
  city: string
  address: string
  manager: string
  phone: string
  level: '旗舰店' | '标准店' | '社区店'
  courseCount: number
  status: '营业中' | '已停业'
  openedAt: string
}

export interface Partner {
  id: string
  name: string
  phone: string
  region: string
  level: '钻石合伙人' | '金牌合伙人' | '银牌合伙人'
  teamSize: number
  totalCommission: number
  balance: number
  signedAt: string
  status: '合作中' | '已解约'
}

export interface Agent {
  id: string
  name: string
  phone: string
  partner: string
  region: string
  level: '一级代理' | '二级代理' | '三级代理'
  storeCount: number
  totalCommission: number
  status: '在职' | '离职'
}

// ================= Mock 数据 =================

export const mockImages: MaterialImage[] = [
  { id: 'img-01', name: '封面图-职业技能.jpg', thumb: '', size: '386 KB', category: '课程封面', uploadedAt: '2026-10-18 14:22' },
  { id: 'img-02', name: '配图-课堂场景.png', thumb: '', size: '1.2 MB', category: '正文配图', uploadedAt: '2026-10-17 09:40' },
  { id: 'img-03', name: '海报-国庆促销.jpg', thumb: '', size: '640 KB', category: '营销海报', uploadedAt: '2026-10-15 17:05' },
  { id: 'img-04', name: '头像-讲师照片.jpg', thumb: '', size: '218 KB', category: '讲师资料', uploadedAt: '2026-10-12 11:18' },
  { id: 'img-05', name: '配图-思维导图.png', thumb: '', size: '892 KB', category: '正文配图', uploadedAt: '2026-10-10 16:47' },
  { id: 'img-06', name: '封面图-亲子教育.jpg', thumb: '', size: '402 KB', category: '课程封面', uploadedAt: '2026-10-08 10:02' },
]

export const mockArticles: MaterialArticle[] = [
  { id: 'art-01', title: '零基础入门：如何规划第一门线上课程', cover: '', summary: '从选题、大纲到录制准备，完整拆解一门课的上线流程，适合首次开课的讲师参考。', bodyHtml: '', category: '干货文章', wordCount: 2180, updatedAt: '2026-10-19 10:30' },
  { id: 'art-02', title: '职业技能提升路线图：3 个月学习计划', cover: '', summary: '按周拆解的学习计划表，配套练习资源与阶段性检验标准，可直接转发给学员。', bodyHtml: '', category: '学习指南', wordCount: 1560, updatedAt: '2026-10-16 15:20' },
  { id: 'art-03', title: '平台分销政策说明（2026 年 10 月版）', cover: '', summary: '佣金比例、结算周期、提现规则与会员权益汇总，供合伙人对外讲解时引用。', bodyHtml: '', category: '政策说明', wordCount: 980, updatedAt: '2026-10-12 09:10' },
]

export const mockVideos: MaterialVideo[] = [
  { id: 'vid-01', name: '课程宣传片-30秒.mp4', poster: '', duration: '00:32', size: '18.6 MB', category: '宣传视频', uploadedAt: '2026-10-18 13:12' },
  { id: 'vid-02', name: '试讲片段-前端基础第1讲.mp4', poster: '', duration: '18:46', size: '412 MB', category: '课程视频', uploadedAt: '2026-10-17 20:05' },
  { id: 'vid-03', name: '学员案例分享-剪辑实战.mov', poster: '', duration: '09:21', size: '156 MB', category: '学员案例', uploadedAt: '2026-10-14 18:44' },
]

export const mockProducts: Product[] = [
  { id: 'P1001', name: 'React 实战全流程课程（30 讲）', type: '课程', cover: '', costPrice: 42, salePrice: 199, stock: 999, status: '上架中', updatedAt: '2026-10-19 11:20' },
  { id: 'P1002', name: '职业技能年卡（含 12 门课）', type: '套餐', cover: '', costPrice: 188, salePrice: 599, stock: 300, status: '上架中', updatedAt: '2026-10-18 16:02' },
  { id: 'P1003', name: '高级会员月卡', type: '会员卡', cover: '', costPrice: 12, salePrice: 49, stock: 9999, status: '上架中', updatedAt: '2026-10-17 09:41' },
  { id: 'P1004', name: '一对一答疑服务包（10 次）', type: '套餐', cover: '', costPrice: 210, salePrice: 399, stock: 80, status: '已下架', updatedAt: '2026-10-09 14:55' },
]

export const mockMemberPlans: MemberPlan[] = [
  {
    id: 'M01', name: '普通会员', level: 1, period: '按月', price: 19, originalPrice: 29, discount: 1,
    benefits: ['全部公开课观看权限', '社区提问基础权限', '课程资料下载 5 份/月'], enabled: true,
  },
  {
    id: 'M02', name: '高级会员', level: 2, period: '按季', price: 128, originalPrice: 198, discount: 0.8,
    benefits: ['全部付费课程 8 折购买', '专属学习社群', '资料无限下载', '每月 1 次直播答疑'], enabled: true,
  },
  {
    id: 'M03', name: '合伙人会员', level: 3, period: '按年', price: 998, originalPrice: 1580, discount: 0.6,
    benefits: ['全部课程免费观看', '分销佣金 20% 起', '专属招商物料包', '一对一辅导 4 次/年'], enabled: true,
  },
]

export const mockRevenue: RevenueUser[] = [
  { id: 'U2026001', name: '王建国', phone: '138****6201', level: '合伙人', totalEarn: 128640.5, withdrawn: 98200, pending: 22100.8, processing: 8339.7, lastActive: '2026-10-22 09:18', status: '已结算' },
  { id: 'U2026002', name: '李晓梅', phone: '139****3345', level: '高级会员', totalEarn: 42180.2, withdrawn: 36800, pending: 4580.2, processing: 800, lastActive: '2026-10-22 08:52', status: '提现中' },
  { id: 'U2026003', name: '张伟', phone: '137****8890', level: '高级会员', totalEarn: 18930.0, withdrawn: 15000, pending: 3930, processing: 0, lastActive: '2026-10-21 21:40', status: '待结算' },
  { id: 'U2026004', name: '陈静', phone: '150****2217', level: '普通会员', totalEarn: 5620.8, withdrawn: 4200, pending: 1420.8, processing: 0, lastActive: '2026-10-21 17:26', status: '已结算' },
  { id: 'U2026005', name: '刘洋', phone: '186****5563', level: '合伙人', totalEarn: 86420.0, withdrawn: 70000, pending: 12420, processing: 4000, lastActive: '2026-10-22 10:05', status: '提现中' },
  { id: 'U2026006', name: '赵敏', phone: '135****9032', level: '普通会员', totalEarn: 2310.5, withdrawn: 1800, pending: 510.5, processing: 0, lastActive: '2026-10-20 14:11', status: '待结算' },
  { id: 'U2026007', name: '孙浩然', phone: '159****7748', level: '高级会员', totalEarn: 27560.4, withdrawn: 23000, pending: 3560.4, processing: 1000, lastActive: '2026-10-22 10:40', status: '已结算' },
]

export const mockStores: Store[] = [
  { id: 'S001', name: '郑州东站旗舰店', city: '郑州', address: '郑东新区商都路 66 号汇艺广场 1 层', manager: '周强', phone: '138****1102', level: '旗舰店', courseCount: 42, status: '营业中', openedAt: '2025-03-18' },
  { id: 'S002', name: '上海浦江镇标准店', city: '上海', address: '闵行区浦江镇恒南路 1288 号', manager: '吴迪', phone: '137****4456', level: '标准店', courseCount: 28, status: '营业中', openedAt: '2025-06-02' },
  { id: 'S003', name: '新乡牧野社区店', city: '新乡', address: '牧野区东风路 18 号学府商业街', manager: '郑楠', phone: '150****7823', level: '社区店', courseCount: 15, status: '营业中', openedAt: '2026-01-20' },
  { id: 'S004', name: '杭州滨江标准店', city: '杭州', address: '滨江区江陵路 88 号星耀城 2 幢 5 层', manager: '冯涛', phone: '186****3319', level: '标准店', courseCount: 23, status: '已停业', openedAt: '2025-08-11' },
]

export const mockPartners: Partner[] = [
  { id: 'PT001', name: '王建国', phone: '138****6201', region: '河南 · 郑州', level: '钻石合伙人', teamSize: 46, totalCommission: 128640.5, balance: 30440.5, signedAt: '2025-05-09', status: '合作中' },
  { id: 'PT002', name: '刘洋', phone: '186****5563', region: '上海 · 闵行', level: '金牌合伙人', teamSize: 28, totalCommission: 86420.0, balance: 16420.0, signedAt: '2025-09-16', status: '合作中' },
  { id: 'PT003', name: '钱峰', phone: '139****2276', region: '浙江 · 杭州', level: '银牌合伙人', teamSize: 12, totalCommission: 21300.0, balance: 3200.0, signedAt: '2026-02-28', status: '合作中' },
  { id: 'PT004', name: '何丽', phone: '135****8841', region: '江苏 · 南京', level: '银牌合伙人', teamSize: 8, totalCommission: 9860.0, balance: 0, signedAt: '2025-11-03', status: '已解约' },
]

export const mockAgents: Agent[] = [
  { id: 'AG001', name: '吴迪', phone: '137****4456', partner: '刘洋', region: '上海 · 浦江', level: '一级代理', storeCount: 3, totalCommission: 31200.0, status: '在职' },
  { id: 'AG002', name: '郑楠', phone: '150****7823', partner: '王建国', region: '新乡 · 牧野', level: '二级代理', storeCount: 2, totalCommission: 12860.0, status: '在职' },
  { id: 'AG003', name: '冯涛', phone: '186****3319', partner: '钱峰', region: '杭州 · 滨江', level: '三级代理', storeCount: 1, totalCommission: 4200.0, status: '离职' },
  { id: 'AG004', name: '许晴', phone: '158****9910', partner: '王建国', region: '郑州 · 金水', level: '二级代理', storeCount: 4, totalCommission: 18750.5, status: '在职' },
]

export const revenueTrend: { date: string; amount: number }[] = [
  { date: '10/09', amount: 3200 }, { date: '10/10', amount: 4100 }, { date: '10/11', amount: 3680 },
  { date: '10/12', amount: 5200 }, { date: '10/13', amount: 4860 }, { date: '10/14', amount: 6120 },
  { date: '10/15', amount: 5580 }, { date: '10/16', amount: 7300 }, { date: '10/17', amount: 6840 },
  { date: '10/18', amount: 8200 }, { date: '10/19', amount: 7660 }, { date: '10/20', amount: 9100 },
  { date: '10/21', amount: 8540 }, { date: '10/22', amount: 10320 },
]
