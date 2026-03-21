// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('塔防游戏 - 沙盒模式基础测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('页面加载正常，显示所有主要元素', async ({ page }) => {
    // 检查标题
    await expect(page).toHaveTitle(/塔防游戏/);
    
    // 检查状态栏元素（沙盒模式无金钱显示）
    await expect(page.locator('#livesDisplay')).toHaveText('5');
    await expect(page.locator('#waveDisplay')).toHaveText('1/20');
    await expect(page.locator('#scoreDisplay')).toBeVisible();
    
    // 检查菜单按钮
    await expect(page.locator('#menuBtn')).toBeVisible();
    await expect(page.locator('#menuBtn')).toHaveText('☰');
    
    // 检查开始按钮
    await expect(page.locator('#startBtn')).toBeVisible();
    await expect(page.locator('#startBtn')).toHaveText('开始战斗');
    
    // 检查战场网格
    const cells = page.locator('.cell');
    await expect(cells).toHaveCount(25); // 5x5
    
    // 检查炮塔选择器
    const towerItems = page.locator('.tower-item');
    await expect(towerItems).toHaveCount(4);
    
    // 检查技能栏默认隐藏
    await expect(page.locator('#skillsBar')).not.toBeVisible();
  });

  test('菜单按钮点击切换显示', async ({ page }) => {
    const menuBtn = page.locator('#menuBtn');
    const menuOverlay = page.locator('#menuOverlay');
    
    // 初始关闭
    await expect(menuOverlay).not.toBeVisible();
    await expect(menuBtn).toHaveText('☰');
    
    // 点击打开
    await menuBtn.click();
    await expect(menuOverlay).toBeVisible();
    await expect(menuBtn).toHaveText('×');
    
    // 再次点击关闭
    await menuBtn.click();
    await expect(menuOverlay).not.toBeVisible();
    await expect(menuBtn).toHaveText('☰');
  });

  test('点击炮塔卡片显示选中状态', async ({ page }) => {
    const tower1 = page.locator('.tower-item[data-tower="tower1"]');
    await tower1.click();
    await expect(tower1).toHaveClass(/selected/);
  });

  test('点击炮塔卡片两次取消选中', async ({ page }) => {
    const tower1 = page.locator('.tower-item[data-tower="tower1"]');
    await tower1.click();
    await expect(tower1).toHaveClass(/selected/);
    
    await tower1.click();
    await expect(tower1).not.toHaveClass(/selected/);
  });

  test('选择炮塔后点击格子显示有效高亮', async ({ page }) => {
    await page.locator('.tower-item[data-tower="tower1"]').click();
    
    // 检查有效格子显示
    const validCells = page.locator('.cell.valid');
    await expect(validCells.first()).toBeVisible();
  });

  test('炮塔部署功能（沙盒模式免费）', async ({ page }) => {
    // 选择固定炮塔
    await page.locator('.tower-item[data-tower="tower1"]').click();
    
    // 部署到第一个格子
    const firstCell = page.locator('.cell').first();
    await firstCell.click();
    
    // 检查炮塔已部署
    const turretInCell = firstCell.locator('.turret');
    await expect(turretInCell).toBeVisible();
    await expect(turretInCell).toHaveAttribute('data-type', 'tower1');
  });

  test('开始按钮点击切换文本', async ({ page }) => {
    const startBtn = page.locator('#startBtn');
    await expect(startBtn).toHaveText('开始战斗');
    
    // 需要先部署一个炮塔才能开始
    await page.locator('.tower-item[data-tower="tower1"]').click();
    await page.locator('.cell').first().click();
    
    await startBtn.click();
    await expect(startBtn).toHaveText('停止战斗');
    
    await startBtn.click();
    await expect(startBtn).toHaveText('开始战斗');
  });

  test('技能栏战斗开始后显示', async ({ page }) => {
    // 需要先部署炮塔
    await page.locator('.tower-item[data-tower="tower1"]').click();
    await page.locator('.cell').first().click();
    
    await page.locator('#startBtn').click();
    await expect(page.locator('#skillsBar')).toBeVisible();
    
    // 停止后隐藏
    await page.locator('#startBtn').click();
    await expect(page.locator('#skillsBar')).not.toBeVisible();
  });

  test('战斗进行中禁止修改炮塔', async ({ page }) => {
    // 部署炮塔
    await page.locator('.tower-item[data-tower="tower1"]').click();
    await page.locator('.cell').first().click();
    
    // 开始战斗
    await page.locator('#startBtn').click();
    
    // 尝试选择新炮塔并点击格子
    await page.locator('.tower-item[data-tower="tower2"]').click();
    await page.locator('.cell').nth(1).click();
    
    // 应该弹出警告
    page.on('dialog', dialog => {
      expect(dialog.message()).toContain('战斗进行中');
      dialog.accept();
    });
    
    // 战斗应仍在进行
    await expect(page.locator('#startBtn')).toHaveText('停止战斗');
  });
});
