import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Carousel,
  Checkbox,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from "antd";
import {
  fulfillmentTypeLabels,
  fulfillmentTypes,
  productCategoryOptions,
  type FulfillmentType,
  type ManagedProduct,
  type ProductCatalog,
  type ProductDraft,
  type ProductMutation,
  type ProductPriceTier,
} from "../types/products";
import { productsService } from "../services/products";
import { emptyContent } from "../utils/richContent";
import { generateProductSkus } from "../utils/productSkus";
import { assertProductContentAllowsSave } from "../utils/productContent";
import { formatProfitYuan, isSaleBelowCost } from "../utils/productPricing";
import {
  clearProductDraftCache,
  contentHasLocalMedia,
  isLocalMediaUrl,
  loadProductDraftCache,
  productDraftCacheKey,
  readFileAsDataUrl,
  saveProductDraftCache,
  dataUrlToFile,
  uploadLocalUrlsInContent,
} from "../utils/productDraftCache";
import {
  ASSETS_UPLOAD_UNAVAILABLE_MESSAGE,
  isAssetsUploadUnavailableError,
} from "../utils/assetsUploadErrors";
import CmsContentEditor from "./CmsContentEditor";

export function MoneyInput({
  value,
  onChange,
  label,
  nullable = false,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  label: string;
  nullable?: boolean;
}) {
  return (
    <Space size={4}>
      <InputNumber
        aria-label={label}
        min={0}
        max={10000000}
        precision={2}
        value={value === null ? null : value / 100}
        onChange={(next) =>
          onChange(
            next === null
              ? nullable
                ? null
                : 0
              : Math.round(Number(next) * 100),
          )
        }
      />
      <span>元</span>
    </Space>
  );
}

function PriceTiers({
  value,
  change,
  label,
}: {
  value: ProductPriceTier[];
  change: (value: ProductPriceTier[]) => void;
  label: string;
}) {
  return (
    <Card size="small" title={label}>
      <Space direction="vertical" style={{ width: "100%" }}>
        {value.map((tier, index) => (
          <Space key={tier.id} wrap>
            <Input
              aria-label={`${label}${index + 1}名称`}
              placeholder="档位名称"
              style={{ width: 140 }}
              maxLength={40}
              value={tier.label}
              onChange={(event) =>
                change(
                  value.map((item) =>
                    item.id === tier.id
                      ? { ...item, label: event.target.value }
                      : item,
                  ),
                )
              }
            />
            <Input
              aria-label={`${label}${index + 1}折扣标签`}
              placeholder="仅展示，不算价"
              style={{ width: 140 }}
              maxLength={40}
              value={tier.discountLabel}
              onChange={(event) =>
                change(
                  value.map((item) =>
                    item.id === tier.id
                      ? { ...item, discountLabel: event.target.value }
                      : item,
                  ),
                )
              }
            />
            <MoneyInput
              label={`${label}${index + 1}金额`}
              value={tier.amount}
              onChange={(amount) =>
                change(
                  value.map((item) =>
                    item.id === tier.id
                      ? { ...item, amount: amount ?? 0 }
                      : item,
                  ),
                )
              }
            />
            <Button
              danger
              onClick={() =>
                change(value.filter((item) => item.id !== tier.id))
              }
            >
              移除档位
            </Button>
          </Space>
        ))}
        <Button
          disabled={value.length >= 20}
          onClick={() =>
            change([
              ...value,
              {
                id: crypto.randomUUID(),
                label: "",
                discountLabel: "",
                amount: 0,
              },
            ])
          }
        >
          添加{label}
        </Button>
      </Space>
    </Card>
  );
}

function syncCover(carouselUrls: string[], coverUrl: string) {
  return carouselUrls[0] || coverUrl || "";
}

function emptyDraft(): ProductDraft {
  return {
    productId: "",
    categoryId: "",
    title: "",
    summary: "",
    coverUrl: "",
    carouselUrls: [],
    content: emptyContent(),
    // 新建必须显式选择；空串在保存/Mock 层会被拒
    fulfillmentType: "" as FulfillmentType,
    costAmount: 0,
    requiresMember: false,
    pricePresentation: "tiered",
    originalAmount: null,
    standardAmount: 0,
    activityAmount: null,
    memberPrices: [],
    rolePrices: [],
    specGroups: [],
    skus: [
      {
        id: `sku-${crypto.randomUUID()}`,
        label: "默认",
        specs: {},
        amount: 0,
        stock: 0,
      },
    ],
  };
}

function normalizeDraft(row: ManagedProduct | null): ProductDraft {
  const draft = structuredClone(row?.draft ?? emptyDraft());
  if (!Array.isArray(draft.carouselUrls)) draft.carouselUrls = [];
  if (!draft.carouselUrls.length && draft.coverUrl)
    draft.carouselUrls = [draft.coverUrl];
  draft.coverUrl = syncCover(draft.carouselUrls, draft.coverUrl);
  return draft;
}

function CarouselGallery({
  urls,
  onChange,
}: {
  urls: string[];
  onChange: (urls: string[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const preview = (url: string) => {
    if (isLocalMediaUrl(url) || url.startsWith("data:")) return url;
    try {
      return productsService.resolveAsset(url);
    } catch {
      return url;
    }
  };

  const move = (index: number, delta: number) => {
    const next = index + delta;
    if (next < 0 || next >= urls.length) return;
    const copy = [...urls];
    const [item] = copy.splice(index, 1);
    copy.splice(next, 0, item);
    onChange(copy);
  };

  return (
    <Card size="small" title="商品首页轮播图（本地预览）">
      {contextHolder}
      <Space direction="vertical" style={{ width: "100%" }} size={12}>
        {urls.length > 0 ? (
          <div
            style={{
              background: "#0b1b33",
              borderRadius: 8,
              overflow: "hidden",
              width: "min(100%, 360px)",
              aspectRatio: "1 / 1",
              margin: "0 auto",
            }}
          >
            <Carousel autoplay dots style={{ height: "100%" }}>
              {urls.map((url, index) => (
                <div key={`${index}-${url.slice(0, 48)}`}>
                  <div
                    style={{
                      width: "100%",
                      aspectRatio: "1 / 1",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                    }}
                  >
                    <img
                      src={preview(url)}
                      alt="轮播预览"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  </div>
                </div>
              ))}
            </Carousel>
          </div>
        ) : (
          <Alert
            type="info"
            message="选择本地图片后立即在此预览轮播；不会调用上传接口。提交到服务端时才上传。"
          />
        )}
        <Space wrap>
          {urls.map((url, index) => (
            <Card
              key={`${index}-${url.slice(0, 32)}`}
              size="small"
              style={{ width: 104 }}
              styles={{ body: { padding: 8 } }}
            >
              <img
                src={preview(url)}
                alt={`轮播${index + 1}`}
                style={{
                  width: "100%",
                  aspectRatio: "1 / 1",
                  objectFit: "cover",
                  borderRadius: 4,
                  display: "block",
                }}
              />
              <Space size={4} style={{ marginTop: 8 }} wrap>
                <Button
                  size="small"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  左移
                </Button>
                <Button
                  size="small"
                  disabled={index === urls.length - 1}
                  onClick={() => move(index, 1)}
                >
                  右移
                </Button>
                <Button
                  size="small"
                  danger
                  onClick={() => onChange(urls.filter((_, i) => i !== index))}
                >
                  删除
                </Button>
              </Space>
            </Card>
          ))}
          <Upload
            showUploadList={false}
            accept="image/png,image/jpeg,image/webp"
            disabled={busy || urls.length >= 12}
            beforeUpload={(file) => {
              if (!file.type.startsWith("image/")) {
                messageApi.error("仅支持图片");
                return false;
              }
              if (file.size > 2.5 * 1024 * 1024) {
                messageApi.error("单张建议不超过 2.5MB，以便本机缓存");
                return false;
              }
              setBusy(true);
              readFileAsDataUrl(file)
                .then((dataUrl) => {
                  onChange([...urls, dataUrl]);
                  messageApi.success("已加入本地预览（未上传）");
                })
                .catch((err) =>
                  messageApi.error(
                    err instanceof Error ? err.message : "读取本地图片失败",
                  ),
                )
                .finally(() => setBusy(false));
              return false;
            }}
          >
            <Button loading={busy} disabled={urls.length >= 12}>
              选择本地图片
            </Button>
          </Upload>
        </Space>
        <Typography.Text type="secondary">
          最多 12 张；本地 data URL
          预览并写入浏览器缓存。提交到服务端时才会调用上传接口，第一张同步为封面。
        </Typography.Text>
      </Space>
    </Card>
  );
}

export default function ProductEditor({
  row,
  catalog,
  token,
  close,
  save,
}: {
  row: ManagedProduct | null;
  catalog: ProductCatalog;
  token: string;
  close: () => void;
  save: (input: ProductMutation) => void;
}) {
  const isNew = !row;
  const cacheKey = productDraftCacheKey(row?.draft.productId);
  const [draft, setDraft] = useState<ProductDraft>(() => {
    const cached = loadProductDraftCache(cacheKey);
    if (cached?.draft)
      return normalizeDraft({ draft: cached.draft } as ManagedProduct);
    return normalizeDraft(row);
  });
  const [error, setError] = useState("");
  const [regenerate, setRegenerate] = useState(false);
  const [pendingOption, setPendingOption] = useState<Record<string, string>>(
    {},
  );
  const [submitting, setSubmitting] = useState(false);
  const [cacheHint, setCacheHint] = useState("");
  const skipFirstCache = useRef(true);
  const [messageApi, messageHolder] = message.useMessage();

  const change = (value: Partial<ProductDraft>) =>
    setDraft((current) => ({ ...current, ...value }));

  const setCarousel = (carouselUrls: string[]) => {
    change({ carouselUrls, coverUrl: syncCover(carouselUrls, "") });
  };

  useEffect(() => {
    if (skipFirstCache.current) {
      skipFirstCache.current = false;
      const cached = loadProductDraftCache(cacheKey);
      if (cached?.updatedAt)
        setCacheHint(`已从本机缓存恢复（${cached.updatedAt}）`);
      return;
    }
    const timer = window.setTimeout(() => {
      try {
        const saved = saveProductDraftCache({
          productId: cacheKey === "new" ? "" : cacheKey,
          draft: {
            ...draft,
            coverUrl: syncCover(draft.carouselUrls || [], draft.coverUrl),
          },
          serverVersion: row?.version ?? 0,
        });
        setCacheHint(`本机已缓存 ${saved.updatedAt}`);
      } catch (err) {
        setCacheHint(err instanceof Error ? err.message : "本机缓存失败");
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [draft, cacheKey, row?.version]);

  const typeOptions = useMemo(
    () =>
      catalog.types
        .filter((type) =>
          (fulfillmentTypes as readonly string[]).includes(type.code),
        )
        .map((type) => ({
          value: type.code,
          label:
            type.title?.trim() || fulfillmentTypeLabels[type.code] || type.code,
        })),
    [catalog.types],
  );

  const categoryOptions = useMemo(() => {
    return productCategoryOptions.map((fixed) => {
      const matched =
        catalog.categories.find(
          (item) => item.categoryId === fixed.categoryId,
        ) ||
        catalog.categories.find(
          (item) => item.categoryLabel === fixed.categoryLabel,
        );
      const categoryId = matched?.categoryId || fixed.categoryId;
      const enabled = matched ? matched.enabled : true;
      return {
        value: categoryId,
        label: fixed.categoryLabel + (enabled ? "" : "（已停用）"),
        disabled: !enabled && categoryId !== draft.categoryId,
      };
    });
  }, [catalog.categories, draft.categoryId]);

  const saleBelowCost = isSaleBelowCost(draft.standardAmount, draft.costAmount);
  const profitLabel = formatProfitYuan(draft.standardAmount, draft.costAmount);

  const generate = () => {
    try {
      change({ skus: generateProductSkus(draft) });
      setRegenerate(false);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "组合生成失败");
      setRegenerate(false);
    }
  };

  const validateDraft = () => {
    if (
      !(fulfillmentTypes as readonly string[]).includes(draft.fulfillmentType)
    ) {
      setError("请先选择履约类型");
      return false;
    }
    if (!draft.title.trim() || !draft.categoryId) {
      setError("请填写标题并选择商品分类");
      return false;
    }
    // 固定五项中文分类始终允许新建；避免后端 catalog id 不一致时误报「只能选择启用中的分类」
    const fixedCategoryOk = productCategoryOptions.some(
      (item) => item.categoryId === draft.categoryId,
    );
    const catalogCategoryOk = catalog.categories.some(
      (item) => item.categoryId === draft.categoryId && item.enabled,
    );
    if (isNew && !fixedCategoryOk && !catalogCategoryOk) {
      setError("新建商品只能选择启用中的商品分类");
      return false;
    }
    try {
      assertProductContentAllowsSave(draft.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "详细简介含禁止媒体");
      return false;
    }
    setError("");
    return true;
  };

  const cacheLocalOnly = () => {
    try {
      const saved = saveProductDraftCache({
        productId: cacheKey === "new" ? "" : cacheKey,
        draft: {
          ...draft,
          coverUrl: syncCover(draft.carouselUrls || [], draft.coverUrl),
        },
        serverVersion: row?.version ?? 0,
      });
      setCacheHint(`本机已缓存 ${saved.updatedAt}`);
      messageApi.success("已保存到本机缓存（未调用后端）");
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : "本机缓存失败");
    }
  };

  const submitToServer = async () => {
    if (!validateDraft()) return;
    setSubmitting(true);
    try {
      // 选图阶段绝不打 upload；仅提交时处理本地 data:/blob:
      const localCarousel = Array.isArray(draft.carouselUrls)
        ? draft.carouselUrls
        : [];
      const needsCarouselUpload = localCarousel.some((url) =>
        isLocalMediaUrl(url),
      );
      const needsContentUpload = contentHasLocalMedia(draft.content);
      let uploadedCarousel = localCarousel;
      let uploadedContent = draft.content;

      if (needsCarouselUpload || needsContentUpload) {
        const uploadOnce = async (file: File) => {
          try {
            return await productsService.upload(token, file);
          } catch (err) {
            if (isAssetsUploadUnavailableError(err)) {
              throw new Error(ASSETS_UPLOAD_UNAVAILABLE_MESSAGE);
            }
            throw err;
          }
        };
        uploadedCarousel = [];
        for (let index = 0; index < localCarousel.length; index += 1) {
          const url = localCarousel[index];
          if (!isLocalMediaUrl(url)) {
            uploadedCarousel.push(url);
            continue;
          }
          const file = await dataUrlToFile(url, `carousel-${index + 1}`);
          const asset = await uploadOnce(file);
          uploadedCarousel.push(asset.url);
        }
        uploadedContent = needsContentUpload
          ? await uploadLocalUrlsInContent(draft.content, uploadOnce)
          : draft.content;
      }
      // 无本地新图时跳过 upload API，直接提交商品 JSON
      const value = {
        ...draft,
        content: uploadedContent,
        carouselUrls: uploadedCarousel,
        coverUrl: syncCover(uploadedCarousel, draft.coverUrl),
      };
      // 先写入本机，确认弹窗取消时仍可恢复
      saveProductDraftCache({
        productId: cacheKey === "new" ? "" : cacheKey,
        draft: value,
        serverVersion: row?.version ?? 0,
      });
      save({
        action: "save-product",
        value,
        version: row?.version ?? 0,
        reason: "",
        idempotencyKey: "",
      });
    } catch (err) {
      if (isAssetsUploadUnavailableError(err)) {
        setError(ASSETS_UPLOAD_UNAVAILABLE_MESSAGE);
      } else {
        setError(err instanceof Error ? err.message : "上传图片或提交失败");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const discardLocalCache = () => {
    clearProductDraftCache(cacheKey);
    setDraft(normalizeDraft(row));
    setCacheHint("已清除本机缓存并恢复服务端数据");
    messageApi.success("已清除本机缓存");
  };

  return (
    <Modal
      open
      width={1100}
      title={row ? "编辑商品草稿" : "新建商品"}
      onCancel={close}
      maskClosable={false}
      footer={[
        <Button key="close" onClick={close}>
          关闭
        </Button>,
        <Button key="discard" onClick={discardLocalCache}>
          清除本机缓存
        </Button>,
        <Button key="cache" onClick={cacheLocalOnly}>
          仅缓存到本机
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={submitting}
          onClick={() => void submitToServer()}
        >
          提交到服务端
        </Button>,
      ]}
    >
      {messageHolder}
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Alert
          type="info"
          message="轮播/详情选图仅本机预览，编辑内容自动写入浏览器缓存，不会调用上传/保存接口。点「提交到服务端」时若有本地新图才会走资产上传，再进入核对保存；无新图则只提交商品信息。金额按元录入（内部仍按分）。履约类型创建后不可更改。"
        />
        {cacheHint && <Alert type="success" showIcon message={cacheHint} />}
        {error && <Alert type="error" message={error} />}

        <CarouselGallery
          urls={draft.carouselUrls || []}
          onChange={setCarousel}
        />

        <div className="cms-form-grid">
          <label>
            履约类型（必选，保存后锁定）
            <Select
              aria-label="商品履约类型"
              disabled={!isNew}
              style={{ width: "100%" }}
              placeholder="请先选择履约类型"
              value={
                (fulfillmentTypes as readonly string[]).includes(
                  draft.fulfillmentType,
                )
                  ? draft.fulfillmentType
                  : undefined
              }
              options={typeOptions}
              onChange={(fulfillmentType) => change({ fulfillmentType })}
            />
          </label>
          <label>
            商品分类
            <Select
              aria-label="商品分类"
              style={{ width: "100%" }}
              placeholder="选择商品分类"
              value={draft.categoryId || undefined}
              options={categoryOptions}
              onChange={(categoryId) => change({ categoryId })}
            />
          </label>
          <label>
            标题
            <Input
              aria-label="商品标题"
              maxLength={80}
              placeholder="纯文本标题"
              value={draft.title}
              onChange={(event) => change({ title: event.target.value })}
            />
          </label>
        </div>

        <label style={{ display: "block" }}>
          简介
          <Input.TextArea
            aria-label="商品简介"
            placeholder="纯文本简介"
            rows={2}
            maxLength={500}
            value={draft.summary}
            onChange={(event) => change({ summary: event.target.value })}
          />
        </label>
        <Checkbox
          checked={draft.requiresMember}
          onChange={(event) => change({ requiresMember: event.target.checked })}
        >
          下单需要选择孩子会员
        </Checkbox>

        <CmsContentEditor
          token={token}
          localMedia
          label="详细简介"
          value={draft.content}
          onChange={(content) => change({ content })}
          mediaPolicy="image-text"
        />

        <Typography.Title level={5}>
          成本价 / 售价 / 盈利（单位：元）
        </Typography.Title>
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 280px))",
              gap: 16,
              alignItems: "end",
            }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span>成本价</span>
              <MoneyInput
                label="商品成本价"
                value={draft.costAmount}
                onChange={(costAmount) =>
                  change({ costAmount: costAmount ?? 0 })
                }
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span>售价（标准价）</span>
              <MoneyInput
                label="商品售价"
                value={draft.standardAmount}
                onChange={(standardAmount) =>
                  change({ standardAmount: standardAmount ?? 0 })
                }
              />
            </label>
          </div>
          <Alert
            style={{ width: "100%", maxWidth: 560 }}
            type={saleBelowCost ? "warning" : "success"}
            showIcon
            message={`盈利提示：${profitLabel} 元`}
          />
        </Space>

        <Typography.Title level={5}>其它价格展示（可选）</Typography.Title>
        <Space wrap>
          <label>
            原价（可空）
            <MoneyInput
              nullable
              label="商品原价"
              value={draft.originalAmount}
              onChange={(originalAmount) => change({ originalAmount })}
            />
          </label>
          <label>
            活动价（可空）
            <MoneyInput
              nullable
              label="商品活动价"
              value={draft.activityAmount}
              onChange={(activityAmount) => change({ activityAmount })}
            />
          </label>
          <Select
            aria-label="商品价格展示"
            value={draft.pricePresentation}
            options={[
              { value: "tiered", label: "多档价格展示" },
              { value: "standard-only", label: "仅标准价展示" },
            ]}
            onChange={(pricePresentation) => change({ pricePresentation })}
          />
        </Space>
        <PriceTiers
          label="会员价"
          value={draft.memberPrices}
          change={(memberPrices) => change({ memberPrices })}
        />
        <PriceTiers
          label="身份价"
          value={draft.rolePrices}
          change={(rolePrices) => change({ rolePrices })}
        />

        <Typography.Title level={5}>规格组</Typography.Title>
        <Alert
          type="info"
          message="每个规格组先填组名（如「变速」「档位」），再添加可选值标签。增删选项后请显式生成 SKU 组合；相同组合保留原 SKU ID、售价和库存。"
        />
        {draft.specGroups.map((group, i) => (
          <Card
            key={group.id}
            size="small"
            title={
              <Space>
                <Typography.Text type="secondary">
                  规格组 {i + 1}
                </Typography.Text>
                <Input
                  aria-label={`规格组${i + 1}名称`}
                  placeholder="组名，例如：变速 / 档位"
                  maxLength={40}
                  style={{ width: 220 }}
                  value={group.label}
                  onChange={(event) =>
                    change({
                      specGroups: draft.specGroups.map((item) =>
                        item.id === group.id
                          ? { ...item, label: event.target.value }
                          : item,
                      ),
                    })
                  }
                />
              </Space>
            }
            extra={
              <Button
                danger
                onClick={() =>
                  change({
                    specGroups: draft.specGroups.filter(
                      (item) => item.id !== group.id,
                    ),
                  })
                }
              >
                移除规格组
              </Button>
            }
          >
            <Space direction="vertical" style={{ width: "100%" }} size={12}>
              <div>
                <Typography.Text strong>
                  {group.label.trim() || "未命名规格组"}
                </Typography.Text>
                <div style={{ marginTop: 8 }}>
                  <Space size={[8, 8]} wrap>
                    {group.options.map((option) => (
                      <Tag
                        key={option.id}
                        closable
                        color="processing"
                        style={{ padding: "4px 10px", borderRadius: 999 }}
                        onClose={(event) => {
                          event.preventDefault();
                          change({
                            specGroups: draft.specGroups.map((item) =>
                              item.id === group.id
                                ? {
                                    ...item,
                                    options: item.options.filter(
                                      (value) => value.id !== option.id,
                                    ),
                                  }
                                : item,
                            ),
                          });
                        }}
                      >
                        <Input
                          aria-label={`规格组${i + 1}选项${option.label || option.id}`}
                          variant="borderless"
                          size="small"
                          style={{
                            width: Math.max(
                              72,
                              (option.label?.length || 2) * 14,
                            ),
                            padding: 0,
                          }}
                          maxLength={40}
                          value={option.label}
                          placeholder="选项"
                          onChange={(event) =>
                            change({
                              specGroups: draft.specGroups.map((item) =>
                                item.id === group.id
                                  ? {
                                      ...item,
                                      options: item.options.map((value) =>
                                        value.id === option.id
                                          ? {
                                              ...value,
                                              label: event.target.value,
                                            }
                                          : value,
                                      ),
                                    }
                                  : item,
                              ),
                            })
                          }
                        />
                      </Tag>
                    ))}
                    {!group.options.length && (
                      <Typography.Text type="secondary">
                        暂无选项，请在下方添加
                      </Typography.Text>
                    )}
                  </Space>
                </div>
              </div>
              <Space.Compact style={{ maxWidth: 420 }}>
                <Input
                  aria-label={`规格组${i + 1}新选项`}
                  placeholder="输入选项后回车，例如：智能变速"
                  maxLength={40}
                  value={pendingOption[group.id] || ""}
                  onChange={(event) =>
                    setPendingOption((current) => ({
                      ...current,
                      [group.id]: event.target.value,
                    }))
                  }
                  onPressEnter={() => {
                    const label = (pendingOption[group.id] || "").trim();
                    if (!label || group.options.length >= 30) return;
                    change({
                      specGroups: draft.specGroups.map((item) =>
                        item.id === group.id
                          ? {
                              ...item,
                              options: [
                                ...item.options,
                                { id: crypto.randomUUID(), label },
                              ],
                            }
                          : item,
                      ),
                    });
                    setPendingOption((current) => ({
                      ...current,
                      [group.id]: "",
                    }));
                  }}
                />
                <Button
                  disabled={
                    group.options.length >= 30 ||
                    !(pendingOption[group.id] || "").trim()
                  }
                  onClick={() => {
                    const label = (pendingOption[group.id] || "").trim();
                    if (!label) return;
                    change({
                      specGroups: draft.specGroups.map((item) =>
                        item.id === group.id
                          ? {
                              ...item,
                              options: [
                                ...item.options,
                                { id: crypto.randomUUID(), label },
                              ],
                            }
                          : item,
                      ),
                    });
                    setPendingOption((current) => ({
                      ...current,
                      [group.id]: "",
                    }));
                  }}
                >
                  添加选项
                </Button>
              </Space.Compact>
            </Space>
          </Card>
        ))}
        <Space>
          <Button
            disabled={draft.specGroups.length >= 5}
            onClick={() =>
              change({
                specGroups: [
                  ...draft.specGroups,
                  { id: crypto.randomUUID(), label: "", options: [] },
                ],
              })
            }
          >
            添加规格组
          </Button>
          <Button onClick={() => setRegenerate(true)}>生成并核对SKU组合</Button>
        </Space>
        <Table
          rowKey="id"
          size="small"
          dataSource={draft.skus}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 750 }}
          columns={[
            {
              title: "规格",
              key: "sku",
              render: (_, sku) => sku.label,
            },
            {
              title: "售价（元）",
              key: "amount",
              render: (_, sku) => (
                <MoneyInput
                  label={`SKU ${sku.label} 售价`}
                  value={sku.amount}
                  onChange={(amount) =>
                    change({
                      skus: draft.skus.map((item) =>
                        item.id === sku.id
                          ? { ...item, amount: amount ?? 0 }
                          : item,
                      ),
                    })
                  }
                />
              ),
            },
            {
              title: "库存",
              key: "stock",
              render: (_, sku) => (
                <InputNumber
                  aria-label={`SKU ${sku.label} 库存`}
                  precision={0}
                  min={0}
                  max={1000000000}
                  value={sku.stock}
                  onChange={(stock) =>
                    change({
                      skus: draft.skus.map((item) =>
                        item.id === sku.id
                          ? { ...item, stock: stock ?? 0 }
                          : item,
                      ),
                    })
                  }
                />
              ),
            },
          ]}
        />
      </Space>
      {regenerate && (
        <Modal
          open
          title="重新生成SKU组合"
          onCancel={() => setRegenerate(false)}
          onOk={generate}
          okText="确认生成"
          cancelText="返回"
        >
          <p>
            相同规格组合保留原SKU；不再存在的组合从当前草稿移除，新组合库存和售价为
            0。历史发布快照和订单不受此步骤影响。
          </p>
        </Modal>
      )}
    </Modal>
  );
}
