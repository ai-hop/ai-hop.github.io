# 新增 Geili 付费中转站 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 AI Hop 站点导航中新增 Geili 付费中转站，并完整展示其福利、截止时间、模型覆盖、倍率和一般推荐状态。

**Architecture:** 采用现有 `data/providers.js` 的静态站点数据结构，仅追加一个 provider 对象，不修改页面组件或样式。福利截止时间直接写入福利文案，避免为单个站点引入新的数据字段和渲染逻辑。

**Tech Stack:** 原生 JavaScript ES Modules、静态 HTML/CSS、Node.js `node:test`。

## Global Constraints

- 站点名称必须为 `Geili`。
- 地址必须为 `https://sub.geiliapi.com/register?aff=AW6UN6LC8PKN`。
- 分类必须为付费中转站，即 `category: 'router'`。
- 推荐状态必须为一般，即 `status: 'average'`，星级沿用现有一般站点的 3 星规则。
- 福利必须包含“使用邀请码进群20刀额度券”，并注明获取截止时间 `2026.09.18 18:00`。
- 模型必须包含 `claude系列`、`gpt系列`、`国模系列`。
- 倍率必须为：gpt `0.15-0.2x`、claude `0.2-1.1x`、国模 `0.2-0.45x`。
- 福利验证日期按当前日期 `2026-09-01` 记录，仅显示到日。

---

### Task 1: 追加 Geili 站点数据

**Files:**
- Modify: `data/providers.js`，在现有付费中转站记录中追加 Geili
- Test: `tests/app.test.mjs`，增加 Geili 数据契约测试

**Interfaces:**
- Consumes: 现有 `providers` 数组及 `categories`、`statuses` 枚举值。
- Produces: 可被分类筛选、推荐排序和站点卡片渲染使用的完整 Geili provider 记录。

- [ ] **Step 1: 写数据契约测试**

```js
test('contains the Geili paid router provider with the requested offer', () => {
  const geili = providers.find((provider) => provider.id === 'geili');

  assert.deepEqual(geili, {
    id: 'geili',
    name: 'Geili',
    url: 'https://sub.geiliapi.com/register?aff=AW6UN6LC8PKN',
    category: 'router',
    status: 'average',
    rating: 3,
    benefits: ['使用邀请码进群20刀额度券（获取截止：2026.09.18 18:00）'],
    models: ['claude系列', 'gpt系列', '国模系列'],
    modelTypes: ['Claude', 'OpenAI', '国产模型'],
    benefitTypes: ['邀请返利', '低倍率'],
    benefitVerifiedAt: '2026-09-01',
    rates: [
      { model: 'gpt', rate: '0.15-0.2x' },
      { model: 'claude', rate: '0.2-1.1x' },
      { model: '国模', rate: '0.2-0.45x' },
    ],
    requirements: '限制：需使用邀请码并进群领取额度券',
    note: '',
  });
});
```

- [ ] **Step 2: 运行测试确认测试先失败**

Run: `npm test`

Expected: 新增的 Geili 数据契约测试失败，因为 `providers` 中还没有 `id: 'geili'` 的记录。

- [ ] **Step 3: 追加最小 provider 数据**

在 `data/providers.js` 的付费中转站记录区域追加：

```js
  {
    id: 'geili',
    name: 'Geili',
    url: 'https://sub.geiliapi.com/register?aff=AW6UN6LC8PKN',
    category: 'router',
    status: 'average',
    rating: 3,
    benefits: ['使用邀请码进群20刀额度券（获取截止：2026.09.18 18:00）'],
    models: ['claude系列', 'gpt系列', '国模系列'],
    modelTypes: ['Claude', 'OpenAI', '国产模型'],
    benefitTypes: ['邀请返利', '低倍率'],
    benefitVerifiedAt: '2026-09-01',
    rates: [
      { model: 'gpt', rate: '0.15-0.2x' },
      { model: 'claude', rate: '0.2-1.1x' },
      { model: '国模', rate: '0.2-0.45x' },
    ],
    requirements: '限制：需使用邀请码并进群领取额度券',
    note: '',
  },
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test`

Expected: 全部测试通过。

- [ ] **Step 5: 校验差异并提交**

Run: `git diff --check && git add data/providers.js tests/app.test.mjs docs/superpowers/plans/2026-09-01-add-geili-provider.md && git commit -m "feat: add Geili provider"`

Expected: 无空白错误，并创建提交 `feat: add Geili provider`。
