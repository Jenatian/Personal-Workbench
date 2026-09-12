# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: workbench.spec.js >> 日程模块 >> 点击+按钮弹出添加表单
- Location: tests\workbench.spec.js:51:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.fab, .add-btn, [data-action="add-schedule"]')
Expected: visible
Error: strict mode violation: locator('.fab, .add-btn, [data-action="add-schedule"]') resolved to 2 elements:
    1) <button class="fab" data-action="add-schedule">…</button> aka getByRole('button')
    2) <button class="fab" data-action="add-entry">…</button> aka locator('#view-accounting button')

Call log:
  - Expect "toBeVisible" locator('.fab, .add-btn, [data-action="add-schedule"]') with timeout 10000ms
  - waiting for locator('.fab, .add-btn, [data-action="add-schedule"]')

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - navigation [ref=e3]:
    - link "日程" [active] [ref=e4] [cursor=pointer]:
      - /url: "#schedule"
    - link "记账" [ref=e10] [cursor=pointer]:
      - /url: "#accounting"
    - link "AI要点" [ref=e16] [cursor=pointer]:
      - /url: "#ai-daily"
    - link "外语" [ref=e21] [cursor=pointer]:
      - /url: "#language"
    - link "设置" [ref=e28] [cursor=pointer]:
      - /url: "#settings"
  - main [ref=e34]:
    - generic [ref=e35]:
      - generic [ref=e36]:
        - heading "日程" [level=1] [ref=e37]
        - generic [ref=e38]: 9月12日 周六
      - generic [ref=e39]:
        - generic [ref=e40]:
          - generic [ref=e41]: 一
          - generic [ref=e42]: "7"
        - generic [ref=e43]:
          - generic [ref=e44]: 二
          - generic [ref=e45]: "8"
        - generic [ref=e46]:
          - generic [ref=e47]: 三
          - generic [ref=e48]: "9"
        - generic [ref=e49]:
          - generic [ref=e50]: 四
          - generic [ref=e51]: "10"
        - generic [ref=e52]:
          - generic [ref=e53]: 五
          - generic [ref=e54]: "11"
        - generic [ref=e55]:
          - generic [ref=e56]: 六
          - generic [ref=e57]: "12"
        - generic [ref=e58]:
          - generic [ref=e59]: 日
          - generic [ref=e60]: "13"
      - generic [ref=e62]:
        - generic [ref=e63]: 今日事项
        - generic [ref=e64]:
          - generic [ref=e65]: 📋
          - generic [ref=e66]: 这一天还没有安排点击右下角 + 添加
      - button [ref=e67] [cursor=pointer]
```

# Test source

```ts
  1   | const { test, expect } = require('@playwright/test');
  2   | 
  3   | test.describe('个人工作台 - 整体测试', () => {
  4   | 
  5   |   test.beforeEach(async ({ page }) => {
  6   |     await page.goto('/');
  7   |     await page.waitForLoadState('networkidle');
  8   |   });
  9   | 
  10  |   test('页面正确加载', async ({ page }) => {
  11  |     await expect(page).toHaveTitle(/工作台|Workbench/i);
  12  |     await expect(page.locator('.app-container')).toBeVisible();
  13  |   });
  14  | 
  15  |   test('左侧导航栏包含5个模块', async ({ page }) => {
  16  |     const navItems = page.locator('.nav-item');
  17  |     await expect(navItems).toHaveCount(5);
  18  |     await expect(page.locator('[data-module="schedule"]')).toBeVisible();
  19  |     await expect(page.locator('[data-module="accounting"]')).toBeVisible();
  20  |     await expect(page.locator('[data-module="ai-daily"]')).toBeVisible();
  21  |     await expect(page.locator('[data-module="language"]')).toBeVisible();
  22  |     await expect(page.locator('[data-module="settings"]')).toBeVisible();
  23  |   });
  24  | 
  25  |   test('每个导航项都有图标', async ({ page }) => {
  26  |     const navItems = page.locator('.nav-item');
  27  |     const count = await navItems.count();
  28  |     for (let i = 0; i < count; i++) {
  29  |       const icon = navItems.nth(i).locator('svg, .icon, img');
  30  |       await expect(icon).toBeVisible();
  31  |     }
  32  |   });
  33  | });
  34  | 
  35  | test.describe('日程模块', () => {
  36  | 
  37  |   test.beforeEach(async ({ page }) => {
  38  |     await page.goto('/');
  39  |     await page.waitForLoadState('networkidle');
  40  |     await page.click('[data-module="schedule"]');
  41  |   });
  42  | 
  43  |   test('显示本周日期条', async ({ page }) => {
  44  |     await expect(page.locator('.week-bar, .date-bar, .schedule-week')).toBeVisible();
  45  |   });
  46  | 
  47  |   test('显示今日事项列表', async ({ page }) => {
  48  |     await expect(page.locator('.schedule-list, .today-schedule, .task-list')).toBeVisible();
  49  |   });
  50  | 
  51  |   test('点击+按钮弹出添加表单', async ({ page }) => {
  52  |     const addBtn = page.locator('.fab, .add-btn, [data-action="add-schedule"]');
> 53  |     await expect(addBtn).toBeVisible();
      |                          ^ Error: expect(locator).toBeVisible() failed
  54  |     await addBtn.click();
  55  |     await expect(page.locator('.modal, .bottom-sheet, .form-modal')).toBeVisible({ timeout: 5000 });
  56  |   });
  57  | });
  58  | 
  59  | test.describe('记账模块', () => {
  60  | 
  61  |   test.beforeEach(async ({ page }) => {
  62  |     await page.goto('/');
  63  |     await page.waitForLoadState('networkidle');
  64  |     await page.click('[data-module="accounting"]');
  65  |   });
  66  | 
  67  |   test('显示本月支出汇总', async ({ page }) => {
  68  |     await expect(page.locator('.summary-card, .expense-summary, .month-summary')).toBeVisible();
  69  |   });
  70  | 
  71  |   test('显示分类占比', async ({ page }) => {
  72  |     await expect(page.locator('.category-bar, .category-list, .expense-categories')).toBeVisible();
  73  |   });
  74  | 
  75  |   test('显示最近记录列表', async ({ page }) => {
  76  |     await expect(page.locator('.record-list, .recent-records, .accounting-list')).toBeVisible();
  77  |   });
  78  | 
  79  |   test('点击+按钮弹出记账表单', async ({ page }) => {
  80  |     const addBtn = page.locator('.fab, .add-btn, [data-action="add-record"]');
  81  |     await expect(addBtn).toBeVisible();
  82  |     await addBtn.click();
  83  |     await expect(page.locator('.modal, .bottom-sheet, .form-modal')).toBeVisible({ timeout: 5000 });
  84  |   });
  85  | });
  86  | 
  87  | test.describe('AI要点模块', () => {
  88  | 
  89  |   test.beforeEach(async ({ page }) => {
  90  |     await page.goto('/');
  91  |     await page.waitForLoadState('networkidle');
  92  |     await page.click('[data-module="ai-daily"]');
  93  |   });
  94  | 
  95  |   test('显示速览总结', async ({ page }) => {
  96  |     await expect(page.locator('.ai-summary, .daily-summary, .overview-section')).toBeVisible();
  97  |   });
  98  | 
  99  |   test('显示AI要闻列表', async ({ page }) => {
  100 |     const newsItems = page.locator('.news-item, .ai-news-item, .article-card');
  101 |     const count = await newsItems.count();
  102 |     expect(count).toBeGreaterThan(0);
  103 |   });
  104 | 
  105 |   test('要闻包含链接', async ({ page }) => {
  106 |     const links = page.locator('.news-item a, .ai-news-item a, .article-card a');
  107 |     const count = await links.count();
  108 |     if (count > 0) {
  109 |       const href = await links.first().getAttribute('href');
  110 |       expect(href).toBeTruthy();
  111 |     }
  112 |   });
  113 | 
  114 |   test('显示AI产品知识卡片', async ({ page }) => {
  115 |     const knowledgeCards = page.locator('.knowledge-card, .ai-knowledge, .product-card');
  116 |     const count = await knowledgeCards.count();
  117 |     expect(count).toBeGreaterThan(0);
  118 |   });
  119 | });
  120 | 
  121 | test.describe('外语学习模块', () => {
  122 | 
  123 |   test.beforeEach(async ({ page }) => {
  124 |     await page.goto('/');
  125 |     await page.waitForLoadState('networkidle');
  126 |     await page.click('[data-module="language"]');
  127 |   });
  128 | 
  129 |   test('显示Tab切换(口语/外刊)', async ({ page }) => {
  130 |     const tabs = page.locator('.tab, .lang-tab');
  131 |     const count = await tabs.count();
  132 |     expect(count).toBeGreaterThanOrEqual(2);
  133 |   });
  134 | 
  135 |   test('显示文章列表', async ({ page }) => {
  136 |     const articles = page.locator('.article-card, .lang-article, .reading-item');
  137 |     const count = await articles.count();
  138 |     expect(count).toBeGreaterThan(0);
  139 |   });
  140 | 
  141 |   test('文章包含原站链接', async ({ page }) => {
  142 |     const links = page.locator('.article-card a, .lang-article a, .reading-item a');
  143 |     const count = await links.count();
  144 |     if (count > 0) {
  145 |       const href = await links.first().getAttribute('href');
  146 |       expect(href).toBeTruthy();
  147 |     }
  148 |   });
  149 | 
  150 |   test('Tab切换功能正常', async ({ page }) => {
  151 |     const tabs = page.locator('.tab, .lang-tab');
  152 |     if (await tabs.count() >= 2) {
  153 |       await tabs.last().click();
```