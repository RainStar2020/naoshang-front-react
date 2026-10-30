// ====== 分润 / 服务费 / 代理机制方案静态数据 ======
// 说明：数值照录《脑商合伙人方案简版》文档原值，前端仅做展示，不参与任何计算。

// ---------- 合伙人 · 批发商分润 ----------
export interface ProfitProductRow {
  product: string
  vip: number
  price: number
  costPrice: number
  profit: number
}

export interface ProfitTier {
  id: string
  name: string
  threshold: string
  ratioLabel: string
  benefits: string[]
  rows: ProfitProductRow[]
}

export const wholesaleTiers: ProfitTier[] = [
  {
    id: 'tier-small',
    name: '小批发商',
    threshold: '1阶 VIP 9980 · 年费 200 元',
    ratioLabel: '约 20%',
    benefits: ['VIP 拿货价：7980 元', '复购产品折扣：8 折', '产品与代理直推奖：5%'],
    rows: [
      { product: '1阶会员', vip: 1, price: 9980, costPrice: 7980, profit: 2000 },
      { product: '2阶会员', vip: 3, price: 29800, costPrice: 23940, profit: 5860 },
      { product: '3阶会员', vip: 6, price: 59800, costPrice: 47880, profit: 11920 },
      { product: '联创会员', vip: 24, price: 239800, costPrice: 191520, profit: 48280 },
    ],
  },
  {
    id: 'tier-mid',
    name: '中批发商',
    threshold: '2阶天使 29800 · 年费 200 元',
    ratioLabel: '约 25%',
    benefits: ['VIP 拿货价：7500 元', '复购产品折扣：7.5 折', '产品与代理直推奖：10%'],
    rows: [
      { product: '1阶会员', vip: 1, price: 9980, costPrice: 7500, profit: 2480 },
      { product: '2阶会员', vip: 3, price: 29800, costPrice: 22500, profit: 7300 },
      { product: '3阶会员', vip: 6, price: 59800, costPrice: 45000, profit: 14800 },
      { product: '联创会员', vip: 24, price: 239800, costPrice: 180000, profit: 59800 },
    ],
  },
  {
    id: 'tier-big',
    name: '大批发商',
    threshold: '3阶私董 59800 · 年费 200 元',
    ratioLabel: '约 30%',
    benefits: ['VIP 拿货价：6980 元', '复购产品折扣：7 折', '产品与代理直推奖：15%'],
    rows: [
      { product: '1阶会员', vip: 1, price: 9980, costPrice: 6980, profit: 3000 },
      { product: '2阶会员', vip: 3, price: 29800, costPrice: 20940, profit: 8860 },
      { product: '3阶会员', vip: 6, price: 59800, costPrice: 41880, profit: 17920 },
      { product: '联创会员', vip: 24, price: 239800, costPrice: 167520, profit: 72280 },
    ],
  },
  {
    id: 'tier-head',
    name: '总批发商',
    threshold: '联创 23.98w · 年费 200 元',
    ratioLabel: '约 35%',
    benefits: ['VIP 拿货价：6500 元', '复购产品折扣：6.5 折', '产品与代理直推奖：15%'],
    rows: [
      { product: '1阶会员', vip: 1, price: 9980, costPrice: 6500, profit: 3480 },
      { product: '2阶会员', vip: 3, price: 29800, costPrice: 19500, profit: 10300 },
      { product: '3阶会员', vip: 6, price: 59800, costPrice: 39000, profit: 20800 },
      { product: '联创会员', vip: 24, price: 239800, costPrice: 156000, profit: 83800 },
    ],
  },
]

export interface NoteGroup {
  title: string
  items: string[]
}

export const partnerNotes: NoteGroup[] = [
  {
    title: '全球奖',
    items: [
      '标准：150 元 / VIP / 个；资格：联创合伙人；时间：按月分。',
      '分配：一半均分，一半按业绩。',
      '年限：3 年内无条件分红；3 年后每个月需直推 1 个 VIP，当月才有分红权。',
    ],
  },
  {
    title: '创始奖（永久、可传承）',
    items: [
      '基数：3500 × 10% / VIP。',
      '五十联席：首批私董合伙人（前 50 名），享全球总部合伙人实收分红 0.1%（3.5 元 / VIP）。',
      '十大元帅：首批联创合伙人（前 10 名），享全球总部合伙人实收分红 0.5%（17.5 元 / VIP）。',
    ],
  },
  {
    title: '其它说明',
    items: [
      '产品权益：合伙人亲子仅收取行政费，即可参加对应级别集训营。',
      '城市代理：市代本身自动获得联创合伙人分润权益；区县代本身自动获得私董合伙人分润权益。',
      '升级方式：1 年内直推三个本级的可往上升一级（无产品额度）；或补对应差价，享有差价产品额度。',
      '管理奖：平级奖 2%、复购奖 2%；升级换算：1 联创 = 4 私董 = 8 天使 = 24 VIP。',
    ],
  },
]

// ---------- 门店 · 服务费 ----------
export interface ServiceFeeRow {
  product: string
  fee: number
  store: number
  district: number
  city: number
  province: number
  subtotal: number
  ratio: string
}

export const storeServiceRows: ServiceFeeRow[] = [
  { product: '1阶会员', fee: 9980, store: 2400, district: 300, city: 200, province: 100, subtotal: 3000, ratio: '30.06%' },
  { product: '2阶会员', fee: 29800, store: 7200, district: 900, city: 600, province: 300, subtotal: 9000, ratio: '30.20%' },
  { product: '3阶会员', fee: 59800, store: 14400, district: 1800, city: 1200, province: 600, subtotal: 18000, ratio: '30.10%' },
  { product: '联创会员', fee: 239800, store: 57600, district: 7200, city: 4800, province: 2400, subtotal: 72000, ratio: '30.03%' },
]

export const storeServiceNote =
  '单店服务费包含销售提成约 500–1000 元 / 个 VIP；交付费用约 500–1000 元 / 个 VIP（具体以实际情况为准）。'

// ---------- 门店 · 合店老板（简版） ----------
export interface ShopkeeperRow {
  category: string
  content: string
  remark: string
}

export const shopkeeperRows: ShopkeeperRow[] = [
  {
    category: '资格 · 价格',
    content: '合店费：698 元起 / 月（6 个月 / 12 个月起付）',
    remark: '根据城市标准',
  },
  {
    category: '权益 · 赠卡收入',
    content: '赠送 1 张软件卡',
    remark: '按月发放，可自用，可售卖',
  },
  {
    category: '权益 · 直推收入',
    content: '直推合店老板：15% 提分',
    remark: '包含直接上级合伙人 2% 复购奖',
  },
  {
    category: '权益 · 合店收入',
    content: '1、所属门店合店费分红：10%；2、所属门店软件卡：100 元 / 张 / 月卡；3、所属门店 VIP 会员分红：100 元 / 个 VIP（一半按人数均分、一半按合店费 / 软件卡业绩比例分）',
    remark: '每个月至少直推 1 个合店老板 / 季卡会员 / VIP 合伙人（首月无条件分红）',
  },
]

export const shopkeeperSplitNote: NoteGroup = {
  title: '合店费分配规则（详版）',
  items: [
    '总部 15%（省 2%、市 8%、区县 10%），合计 35%。',
    '门店股东 65%：服务 40%、利润 25%；其中 15% 业务（包含直接上级合伙人 2% 复购奖）、10% 分红（合店费，一半按人数均分、一半按合店费业绩比例分）。',
    '合店老板至少是 VIP 合伙人。',
  ],
}

// ---------- 代理机制 ----------
export interface AgentFee {
  tech: number
  device: number
  deposit: number
  total: number
}

export interface AgentRow {
  id: string
  positioning: string
  name: string
  population?: string
  fee: AgentFee
  vipPartner: string
  regionCommission: string
  virtualProduct: string
  physicalProduct: string
}

export interface AgentGroup {
  id: string
  label: string
  rows: AgentRow[]
}

export const agentGroups: AgentGroup[] = [
  {
    id: 'agent-b',
    label: '运营中心（B 端）',
    rows: [
      {
        id: 'ag-province',
        positioning: '省级代理',
        name: '3阶 Plus · 联创',
        fee: { tech: 200, device: 30, deposit: 30, total: 260 },
        vipPartner: '100 元',
        regionCommission: '业务提成：20%',
        virtualProduct: '1、地市管理提成：拨比 2%；2、软件卡拿货价：150 元 / 月',
        physicalProduct: '拿货价：3 折',
      },
      {
        id: 'ag-city-1000',
        positioning: '地市代理',
        name: '3阶 Plus · 联创',
        population: '人口 ≥ 1000 万',
        fee: { tech: 35, device: 5, deposit: 5, total: 45 },
        vipPartner: '200 元',
        regionCommission: '业务提成：18%',
        virtualProduct: '1、区县管理提成：拨比 8%；2、软件卡拿货价：170 元 / 月',
        physicalProduct: '拿货价：3.5 折',
      },
      {
        id: 'ag-city-500',
        positioning: '地市代理',
        name: '3阶 Plus · 联创',
        population: '500 万 ≤ 人口 < 1000 万',
        fee: { tech: 30, device: 5, deposit: 5, total: 40 },
        vipPartner: '200 元',
        regionCommission: '业务提成：18%',
        virtualProduct: '1、区县管理提成：拨比 8%；2、软件卡拿货价：170 元 / 月',
        physicalProduct: '拿货价：3.5 折',
      },
      {
        id: 'ag-city-low',
        positioning: '地市代理',
        name: '3阶 Plus · 联创',
        population: '人口 < 500 万',
        fee: { tech: 25, device: 5, deposit: 5, total: 35 },
        vipPartner: '200 元',
        regionCommission: '业务提成：18%',
        virtualProduct: '1、区县管理提成：拨比 8%；2、软件卡拿货价：170 元 / 月',
        physicalProduct: '拿货价：3.5 折',
      },
    ],
  },
  {
    id: 'agent-c',
    label: '门店（C 端）',
    rows: [
      {
        id: 'ag-district',
        positioning: '区县代理',
        name: '3阶 · 私董',
        fee: { tech: 10, device: 3, deposit: 3, total: 16 },
        vipPartner: '300 元',
        regionCommission: '业务提成：15%',
        virtualProduct: '1、特色产品：门店交付拨比 75%（交付）、总部交付拨比 35%（业务）；2、软件卡拿货价：250 元 / 月',
        physicalProduct: '拿货价：4 折',
      },
      {
        id: 'ag-store',
        positioning: '单店代理',
        name: '2阶 · 天使',
        fee: { tech: 4, device: 2, deposit: 2, total: 8 },
        vipPartner: '2400 元',
        regionCommission: '业务提成：10%',
        virtualProduct: '1、特色产品：门店交付拨比 65%（交付）、总部交付拨比 30%（业务）；2、软件卡拿货价：350 元 / 月',
        physicalProduct: '拿货价：5 折',
      },
    ],
  },
]

export const agentNotes: NoteGroup[] = [
  {
    title: '资格与对应权益',
    items: [
      '单店代理需要首先成为天使合伙人，才有开店权益。',
      '对应权益：单店代理 — 天使合伙人；区县代理 — 私董合伙人；地市（省级）代理 — 联创合伙人。',
    ],
  },
  {
    title: '费用收取',
    items: [
      '市代技术费由省公司收、区县代技术费由市公司收、单店技术费由区县代收。',
      '技术费：75% 交由当地，上交 8% 市代、2% 省代、15% 总部；设备费与保证金由上级公司收取交由总部。',
    ],
  },
  {
    title: '协议年限',
    items: ['三年一签，可以优先续签，无其它续签费用；省公司、市公司可送一个区县直营店先打样。'],
  },
  {
    title: '产品说明',
    items: [
      '新产品（特殊产品）以新比例（特殊比例）分配机制为准（如日用百货商城系统）。',
      '拨比分成：若有硬性成本，先去掉硬性成本，按 PV 值、相应比例分成（如陪练卡、特色营等）。',
      '软件卡分类：百科记忆卡、单词记忆卡、语文记忆卡、速读卡、潜能卡、督学卡（全科智习）、智学卡（单科提分：语文、数学、英语、物理、化学、生物、政治、历史、地理、科学）等。',
      '实物产品价格：脑商 Pad 9980 元 / 台、脑商智慧仪 9980 元 / 台、脑商营养素 598 元 / 盒、脑商皮纹采集器 5000 元（含 50 份报告，无折扣；超出 100 元 / 份，享有虚拟产品拿货价）、脑商智学系统 1w5 元（含 100 张月卡，无折扣；超出 100 张月卡按软件卡拿货价拿货）。',
      '行政费：俱乐部 5%、总部 5%、开营方 90%；合伙人系统费 200 元：5% 俱乐部、95% 总部。',
    ],
  },
]

// ---------- 总分成表（收益模块三栏汇总） ----------
export interface MasterWholesaleRow {
  tier: string
  product: string
  vip: number
  price: number
  costPrice: number
  profit: number
  ratio: string
}

export const masterWholesale: MasterWholesaleRow[] = [
  { tier: '小批发商', product: '1阶会员', vip: 1, price: 9980, costPrice: 7980, profit: 2000, ratio: '20.04%' },
  { tier: '中批发商', product: '1阶会员', vip: 1, price: 9980, costPrice: 7500, profit: 2480, ratio: '24.85%' },
  { tier: '大批发商', product: '1阶会员', vip: 1, price: 9980, costPrice: 6980, profit: 3000, ratio: '30.06%' },
  { tier: '总批发商', product: '1阶会员', vip: 1, price: 9980, costPrice: 6500, profit: 3480, ratio: '34.87%' },
]

export interface MasterHeadquartersRow {
  product: string
  fee: number
  vipCount: number
  productFee: number
  profit: number
  ratio: string
}

export const masterHeadquarters: MasterHeadquartersRow[] = [
  { product: '1阶 VIP', fee: 9980, vipCount: 1, productFee: 3500, profit: 3500, ratio: '35.07%' },
  { product: '2阶天使', fee: 29800, vipCount: 3, productFee: 3500, profit: 10500, ratio: '35.23%' },
  { product: '3阶私董', fee: 59800, vipCount: 6, productFee: 3500, profit: 21000, ratio: '35.12%' },
  { product: '3阶 Plus / 联创', fee: 239800, vipCount: 24, productFee: 3500, profit: 84000, ratio: '35.03%' },
]

export const masterNotes: NoteGroup[] = [
  {
    title: '批发商业务费备注',
    items: [
      '管理奖：平级奖 2%、复购奖 2%。',
      '全球奖：联创合伙人专享；创始奖：五十联席、十大元帅专享，详情咨询。',
      '升级方式：1 年内直推三个本级的（1 联创 = 4 私董 = 8 天使 = 24 VIP），可往上升一级。',
    ],
  },
  {
    title: '门店服务费备注',
    items: ['包含销售提成约 500–1000 元 / 个 VIP；交付费用约 500–1000 元 / 个 VIP（具体以实际情况为准）。'],
  },
]
