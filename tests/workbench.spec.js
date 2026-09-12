const { test, expect } = require('@playwright/test');

test.describe('个人工作台 - 整体测试', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('页面正确加载', async ({ page }) => {
    await expect(page).toHaveTitle(/工作台|Workbench/i);
    await expect(page.locator('.app-container')).toBeVisible();
  });

  test('左侧导航栏包含5个模块', async ({ page }) => {
    const navItems = page.locator('.nav-item');
    await expect(navItems).toHaveCount(5);
    await expect(page.locator('[data-module="schedule"]')).toBeVisible();
    await expect(page.locator('[data-module="accounting"]')).toBeVisible();
    await expect(page.locator('[data-module="ai-daily"]')).toBeVisible();
    await expect(page.locator('[data-module="language"]')).toBeVisible();
    await expect(page.locator('[data-module="settings"]')).toBeVisible();
  });

  test('每个导航项都有图标', async ({ page }) => {
    const navItems = page.locator('.nav-item');
    const count = await navItems.count();
    for (let i = 0; i < count; i++) {
      const icon = navItems.nth(i).locator('svg, .icon, img');
      await expect(icon).toBeVisible();
    }
  });
});

test.describe('日程模块', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.click('[data-module="schedule"]');
  });

  test('显示本周日期条', async ({ page }) => {
    await expect(page.locator('.week-bar, .date-bar, .schedule-week')).toBeVisible();
  });

  test('显示今日事项列表', async ({ page }) => {
    await expect(page.locator('.schedule-list, .today-schedule, .task-list')).toBeVisible();
  });

  test('点击+按钮弹出添加表单', async ({ page }) => {
    const addBtn = page.locator('.fab, .add-btn, [data-action="add-schedule"]');
    await expect(addBtn).toBeVisible();
    await addBtn.click();
    await expect(page.locator('.modal, .bottom-sheet, .form-modal')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('记账模块', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.click('[data-module="accounting"]');
  });

  test('显示本月支出汇总', async ({ page }) => {
    await expect(page.locator('.summary-card, .expense-summary, .month-summary')).toBeVisible();
  });

  test('显示分类占比', async ({ page }) => {
    await expect(page.locator('.category-bar, .category-list, .expense-categories')).toBeVisible();
  });

  test('显示最近记录列表', async ({ page }) => {
    await expect(page.locator('.record-list, .recent-records, .accounting-list')).toBeVisible();
  });

  test('点击+按钮弹出记账表单', async ({ page }) => {
    const addBtn = page.locator('.fab, .add-btn, [data-action="add-record"]');
    await expect(addBtn).toBeVisible();
    await addBtn.click();
    await expect(page.locator('.modal, .bottom-sheet, .form-modal')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('AI要点模块', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.click('[data-module="ai-daily"]');
  });

  test('显示速览总结', async ({ page }) => {
    await expect(page.locator('.ai-summary, .daily-summary, .overview-section')).toBeVisible();
  });

  test('显示AI要闻列表', async ({ page }) => {
    const newsItems = page.locator('.news-item, .ai-news-item, .article-card');
    const count = await newsItems.count();
    expect(count).toBeGreaterThan(0);
  });

  test('要闻包含链接', async ({ page }) => {
    const links = page.locator('.news-item a, .ai-news-item a, .article-card a');
    const count = await links.count();
    if (count > 0) {
      const href = await links.first().getAttribute('href');
      expect(href).toBeTruthy();
    }
  });

  test('显示AI产品知识卡片', async ({ page }) => {
    const knowledgeCards = page.locator('.knowledge-card, .ai-knowledge, .product-card');
    const count = await knowledgeCards.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('外语学习模块', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.click('[data-module="language"]');
  });

  test('显示Tab切换(口语/外刊)', async ({ page }) => {
    const tabs = page.locator('.tab, .lang-tab');
    const count = await tabs.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('显示文章列表', async ({ page }) => {
    const articles = page.locator('.article-card, .lang-article, .reading-item');
    const count = await articles.count();
    expect(count).toBeGreaterThan(0);
  });

  test('文章包含原站链接', async ({ page }) => {
    const links = page.locator('.article-card a, .lang-article a, .reading-item a');
    const count = await links.count();
    if (count > 0) {
      const href = await links.first().getAttribute('href');
      expect(href).toBeTruthy();
    }
  });

  test('Tab切换功能正常', async ({ page }) => {
    const tabs = page.locator('.tab, .lang-tab');
    if (await tabs.count() >= 2) {
      await tabs.last().click();
      await page.waitForTimeout(500);
      const articles = page.locator('.article-card, .lang-article, .reading-item');
      expect(await articles.count()).toBeGreaterThan(0);
    }
  });
});

test.describe('设置模块', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.click('[data-module="settings"]');
  });

  test('显示皮肤选择区', async ({ page }) => {
    const skins = page.locator('.skin-option, .theme-option, .color-option');
    const count = await skins.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test('切换皮肤生效', async ({ page }) => {
    const skins = page.locator('.skin-option, .theme-option, .color-option');
    if (await skins.count() > 1) {
      const currentTheme = await page.evaluate(() => document.body.dataset.theme || '');
      await skins.nth(1).click();
      await page.waitForTimeout(300);
      const newTheme = await page.evaluate(() => document.body.dataset.theme || '');
      expect(newTheme).not.toBe(currentTheme);
    }
  });

  test('显示天气区域', async ({ page }) => {
    await expect(page.locator('.weather-section, .weather-card, .weather-info')).toBeVisible();
  });

  test('显示云同步配置区', async ({ page }) => {
    await expect(page.locator('.sync-section, .cloud-sync, .sync-config')).toBeVisible();
  });
});

test.describe('皮肤系统', () => {

  test('默认主题正确设置', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const theme = await page.evaluate(() => document.body.dataset.theme);
    expect(theme).toBeTruthy();
  });

  test('切换到暗色主题', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.click('[data-module="settings"]');
    const skins = page.locator('.skin-option, .theme-option, .color-option');
    const count = await skins.count();
    if (count >= 5) {
      await skins.nth(count - 1).click();
      await page.waitForTimeout(300);
      const theme = await page.evaluate(() => document.body.dataset.theme);
      expect(theme).toBeTruthy();
    }
  });

  test('皮肤切换后刷新保持', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.click('[data-module="settings"]');
    const skins = page.locator('.skin-option, .theme-option, .color-option');
    if (await skins.count() > 2) {
      await skins.nth(2).click();
      await page.waitForTimeout(300);
      const themeBefore = await page.evaluate(() => document.body.dataset.theme);
      await page.reload();
      await page.waitForLoadState('networkidle');
      const themeAfter = await page.evaluate(() => document.body.dataset.theme);
      expect(themeAfter).toBe(themeBefore);
    }
  });
});

test.describe('PWA配置', () => {

  test('manifest.json 可访问', async ({ page }) => {
    const response = await page.goto('/manifest.json');
    expect(response?.status()).toBe(200);
  });

  test('Service Worker 文件可访问', async ({ page }) => {
    const response = await page.goto('/sw.js');
    expect(response?.status()).toBe(200);
  });

  test('viewport meta 标签正确', async ({ page }) => {
    await page.goto('/');
    const viewport = page.locator('meta[name="viewport"]');
    await expect(viewport).toHaveAttribute('content', /width=device-width/);
  });

  test('apple-mobile-web-app-capable 设置', async ({ page }) => {
    await page.goto('/');
    const meta = page.locator('meta[name="apple-mobile-web-app-capable"]');
    await expect(meta).toHaveAttribute('content', 'yes');
  });
});

test.describe('移动端适配', () => {

  test('390px 宽度下无水平溢出', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });

  test('导航栏在移动端可见', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const nav = page.locator('.nav-bar, .sidebar, nav');
    await expect(nav).toBeVisible();
  });

  test('内容区可滚动', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.click('[data-module="ai-daily"]');
    const contentArea = page.locator('.content-area, .main-content, .module-content');
    await expect(contentArea).toBeVisible();
  });
});
