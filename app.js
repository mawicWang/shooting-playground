// ============================================
// 塔防游戏 - 优化版
// ============================================

// ============ 配置常量 ============
const CONFIG = {


// ============ 本地存储 ============


    GRID_SIZE: 5,
    CELL_MIN_SIZE: 80,
    CELL_GAP: 4,
    GAME_TICK: 16, // ~60fps
    
    // 技能配置
    SKILLS: {
        airstrike: {
            name: '空袭',
            cooldown: 30000,      // 30秒
            cost: 200,
            damage: 500,
            radius: 150
        },
        frost: {
            name: '冰冻',
            cooldown: 60000,      // 60秒
            cost: 150,
            duration: 3000,       // 冰冻3秒
            slowFactor: 0.1       // 10%速度
        }
    },
    
    // 炮塔升级配置
    TOWER_UPGRADE: {
        multiplier: 1.5,
        maxLevel: 3,
        sellRate: 0.7
    },
    
    // 炮塔类型配置
    TOWER_TYPES: {
        tower1: {
            name: '固定炮塔',
            description: '向正前方持续射击',
            color: '#4ecca3',
            damage: 10,
            fireRate: 1000, // ms
            range: 300,
            bulletSpeed: 8,
            rotation: false,
            shootDirection: 'up' // up, right, down, left
        },
        tower2: {
            name: '旋转炮塔',
            description: '自动瞄准最近敌人',
            color: '#ffeb3b',
            damage: 8,
            fireRate: 800,
            range: 250,
            bulletSpeed: 10,
            rotation: true,
            shootDirection: null
        },
        tower3: {
            name: '狙击炮塔',
            description: '高伤害、射速慢',
            color: '#ff4444',
            damage: 50,
            fireRate: 2000,
            range: 400,
            bulletSpeed: 15,
            rotation: true,
            shootDirection: null
        },
        tower4: {
            name: '高速炮塔',
            description: '射速快、伤害低',
            color: '#2196f3',
            damage: 5,
            fireRate: 300,
            range: 200,
            bulletSpeed: 12,
            rotation: true,
            shootDirection: null
        }
    },
    
    // 敌人配置
    ENEMY_TYPES: [
        { name: '轻甲', health: 50, speed: 1, color: '#aaa', reward: 10 },
        { name: '重甲', health: 150, speed: 0.6, color: '#888', reward: 30 },
        { name: '快速', health: 30, speed: 2, color: '#ff9800', reward: 20 },
        { name: 'Boss', health: 500, speed: 0.4, color: '#f44336', reward: 100 }
    ],
    
    // 游戏平衡
    SPAWN_INTERVAL_BASE: 2000,
    SPAWN_DECREASE_PER_ENEMY: 20,
    WAVE_ENEMY_COUNT_BASE: 5,
    WAVE_ENEMY_INCREMENT: 2,
    MAX_WAVES: 20,
    
    // 玩家资源
    STARTING_LIVES: 5, // 保留生命值
    STARTING_MONEY: 0, // 沙盒模式，无需金钱
    MONEY_PER_KILL: 10,
    MONEY_PER_WAVE: 50
};

// ============ 全局状态 ============
const state = {
    towers: new Map(), // cellId -> towerData
    bullets: [],
    enemies: [],
    particles: [],
    
    game: {
        running: false,
        wave: 1,
        lives: CONFIG.STARTING_LIVES,
        // 沙盒模式：移除 money 和 score
        enemiesKilled: 0,
        enemiesSpawned: 0,
        spawnTimer: 0,
        score: 0,
        lastTime: 0
    },
    
    // 点击选择状态
    selectedTowerType: null,
    
    // 技能状态
    skills: {
        airstrike: { ready: true, lastUsed: 0 },
        frost: { ready: true, lastUsed: 0 }
    }
};

const Storage = {
    HIGH_SCORE_KEY: 'tower_defense_high_score',
    MAX_WAVE_KEY: 'tower_defense_max_wave',
    
    getHighScore() {
        return parseInt(localStorage.getItem(this.HIGH_SCORE_KEY)) || 0;
    },
    
    saveHighScore(score) {
        const current = this.getHighScore();
        if (score > current) {
            localStorage.setItem(this.HIGH_SCORE_KEY, score);
            return true;
        }
        return false;
    },
    
    getMaxWave() {
        return parseInt(localStorage.getItem(this.MAX_WAVE_KEY)) || 0;
    },
    
    saveMaxWave(wave) {
        const current = this.getMaxWave();
        if (wave > current) {
            localStorage.setItem(this.MAX_WAVE_KEY, wave);
            return true;
        }
        return false;
    }
};

// ============ DOM 元素 ============
const elements = {
    battlefield: null,
    startBtn: null,
    livesDisplay: null,
    moneyDisplay: null,
    waveDisplay: null,
    scoreDisplay: null,
    highScoreDisplay: null,
    skillsBar: null
};

// ============ 实用函数 ============
function $(selector) {
    return document.querySelector(selector);
}

function $$(selector) {
    return document.querySelectorAll(selector);
}

function getCellId(row, col) {
    return `${row}-${col}`;
}

function getCellCoords(cellId) {
    const [row, col] = cellId.split('-').map(Number);
    return { row, col };
}

function distance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function waveEnemyCount(wave) {
    return CONFIG.WAVE_ENEMY_COUNT_BASE + (wave - 1) * CONFIG.WAVE_ENEMY_INCREMENT;
}

function spawnInterval(wave) {
    const base = CONFIG.SPAWN_INTERVAL_BASE - (wave - 1) * CONFIG.SPAWN_DECREASE_PER_ENEMY;
    return Math.max(500, base);
}

// ============ 粒子系统 ============
class Particle {
    constructor(x, y, color, lifetime = 30) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.lifetime = lifetime;
        this.maxLifetime = lifetime;
        this.vx = randomInt(-3, 3) * 0.5;
        this.vy = randomInt(-3, 3) * 0.5;
        this.radius = randomInt(2, 4);
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.lifetime--;
    }
    
    draw(ctx, cellRect) {
        const alpha = this.lifetime / this.maxLifetime;
        ctx.fillStyle = this.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

// ============ 炮弹类 ============
class Bullet {
    constructor(x, y, targetX, targetY, config) {
        this.x = x;
        this.y = y;
        this.config = config;
        
        // 计算方向
        const angle = Math.atan2(targetY - y, targetX - x);
        this.vx = Math.cos(angle) * config.bulletSpeed;
        this.vy = Math.sin(angle) * config.bulletSpeed;
        
        this.radius = 4;
        this.damage = config.damage;
        this.alive = true;
    }
    
    update(dt) {
        this.x += this.vx;
        this.y += this.vy;
        
        // 边界检查
        const battlefield = elements.battlefield;
        const rect = battlefield.getBoundingClientRect();
        if (this.x < 0 || this.x > rect.width || this.y < 0 || this.y > rect.height) {
            this.alive = false;
        }
    }
    
    draw(ctx) {
        ctx.fillStyle = this.config.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ============ 炮塔类 ============
class Tower {
    constructor(cellId, type) {
        this.cellId = cellId;
        this.type = type;
        this.config = CONFIG.TOWER_TYPES[type];
        this.lastShot = 0;
        this.target = null;
        this.rotation = 0;
        this.element = null;
        this.level = 1;
        this.totalInvested = 0; // 沙盒模式
    }
    
    getCell() {
        return getCellCoords(this.cellId);
    }
    
    getCenter(battlefieldRect) {
        const cell = this.element.closest('.cell');
        const cellRect = cell.getBoundingClientRect();
        return {
            x: cellRect.left - battlefieldRect.left + cellRect.width / 2,
            y: cellRect.top - battlefieldRect.top + cellRect.height / 2
        };
    }
    
    update(currentTime, enemies, bullets, battlefieldRect) {
        if (!this.element) return;
        
        const center = this.getCenter(battlefieldRect);
        const range = this.config.range;
        
        // 寻找目标
        if (this.config.rotation) {
            this.target = this.findTarget(center, enemies, range);
        }
        
        // 射击
        if (this.canShoot(currentTime) && this.target) {
            this.shoot(bullets, battlefieldRect, currentTime);
        }
    }
    
    findTarget(center, enemies, range) {
        let closest = null;
        let closestDist = Infinity;
        
        for (const enemy of enemies) {
            if (!enemy.alive) continue;
            const dist = distance(center.x, center.y, enemy.x, enemy.y);
            if (dist <= range && dist < closestDist) {
                closest = enemy;
                closestDist = dist;
            }
        }
        return closest;
    }
    
    canShoot(currentTime) {
        return currentTime - this.lastShot >= this.config.fireRate;
    }
    
    shoot(bullets, battlefieldRect, currentTime) {
        const center = this.getCenter(battlefieldRect);
        let targetX, targetY;
        
        if (this.target) {
            targetX = this.target.x;
            targetY = this.target.y;
        } else {
            // 固定方向
            switch (this.config.shootDirection) {
                case 'up': targetX = center.x; targetY = 0; break;
                case 'right': targetX = battlefieldRect.width; targetY = center.y; break;
                case 'down': targetX = center.x; targetY = battlefieldRect.height; break;
                case 'left': targetX = 0; targetY = center.y; break;
                default: return;
            }
        }
        
        bullets.push(new Bullet(center.x, center.y, targetX, targetY, this.config));
        this.lastShot = currentTime;
        
        // 后坐力效果
        if (this.element) {
            this.element.style.transform = `scale(0.95)`;
            setTimeout(() => {
                if (this.element) this.element.style.transform = 'scale(1)';
            }, 50);
        }
    }
    
    draw(ctx, battlefieldRect) {
        if (!this.element) return;
        
        const center = this.getCenter(battlefieldRect);
        const cell = this.element.closest('.cell');
        const size = cell.getBoundingClientRect().width;
        
        // 绘制炮塔底座
        ctx.fillStyle = this.config.color + '40';
        ctx.fillRect(center.x - size/3, center.y - size/3, size/1.5, size/1.5);
        
        // 如果旋转，绘制瞄准线
        if (this.config.rotation && this.target) {
            ctx.strokeStyle = this.config.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(center.x, center.y);
            const angle = Math.atan2(this.target.y - center.y, this.target.x - center.x);
            ctx.lineTo(center.x + Math.cos(angle) * 30, center.y + Math.sin(angle) * 30);
            ctx.stroke();
        }
    }
}

// ============ 敌人类 ============
class Enemy {
    constructor(wave) {
        // 随机选择敌人类型
        const typeIndex = Math.min(wave - 1, CONFIG.ENEMY_TYPES.length - 1);
        const type = CONFIG.ENEMY_TYPES[typeIndex];
        
        this.type = type.name;
        this.color = type.color;
        this.health = type.health + wave * 20;
        this.maxHealth = this.health;
        this.speed = type.speed;
        this.reward = type.reward + wave * 5;
        
        this.spawnFromEdge();
        this.alive = true;
        this.path = [];
    }
    
    spawnFromEdge() {
        const side = randomInt(0, 3);
        switch (side) {
            case 0: // top
                this.x = randomInt(0, battlefieldWidth());
                this.y = -20;
                break;
            case 1: // right
                this.x = battlefieldWidth() + 20;
                this.y = randomInt(0, battlefieldHeight());
                break;
            case 2: // bottom
                this.x = randomInt(0, battlefieldWidth());
                this.y = battlefieldHeight() + 20;
                break;
            case 3: // left
                this.x = -20;
                this.y = randomInt(0, battlefieldHeight());
                break;
        }
        this.radius = 12;
    }
    
    update(towers, dt) {
        // 寻找最近的炮塔作为目标
        let target = null;
        let minDist = Infinity;
        
        for (const [cellId, tower] of state.towers) {
            const coords = getCellCoords(cellId);
            const cellRect = getCellRect(coords.row, coords.col);
            const centerX = cellRect.left + cellRect.width / 2;
            const centerY = cellRect.top + cellRect.height / 2;
            const dist = distance(this.x, this.y, centerX, centerY);
            
            if (dist < minDist) {
                minDist = dist;
                target = { x: centerX, y: centerY };
            }
        }
        
        // 向目标移动
        if (target) {
            const dx = target.x - this.x;
            const dy = target.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist > this.radius * 2) {
                this.x += (dx / dist) * this.speed;
                this.y += (dy / dist) * this.speed;
            } else {
                // 到达炮塔位置，造成伤害
                this.dealDamageToTower(target);
            }
        }
    }
    
    dealDamageToTower(target) {
        // 这里可以实现塔防逻辑：敌人到达塔的位置
        // 暂时简化为减少生命
    }
    
    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0) {
            this.die();
            return true;
        }
        return false;
    }
    
    die() {
        this.alive = false;
        state.game.money += this.reward;
        state.game.score += this.reward * 10;
        state.game.enemiesKilled++;
        createParticles(this.x, this.y, this.color, 15);
        updateUI();
    }
    
    draw(ctx) {
        if (!this.alive) return;
        
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // 血条
        if (this.health < this.maxHealth) {
            const barWidth = this.radius * 2;
            const barHeight = 3;
            const pct = this.health / this.maxHealth;
            
            ctx.fillStyle = '#333';
            ctx.fillRect(this.x - barWidth/2, this.y - this.radius - 8, barWidth, barHeight);
            
            ctx.fillStyle = pct > 0.5 ? '#4ecca3' : pct > 0.25 ? '#ffeb3b' : '#ff4444';
            ctx.fillRect(this.x - barWidth/2, this.y - this.radius - 8, barWidth * pct, barHeight);
        }
    }
}

// ============ 战场管理 ============
function battlefieldWidth() {
    return elements.battlefield.clientWidth;
}

function battlefieldHeight() {
    return elements.battlefield.clientHeight;
}

function getCellRect(row, col) {
    const cell = elements.battlefield.children[row * CONFIG.GRID_SIZE + col];
    return cell.getBoundingClientRect();
}

// ============ 初始化 ============
function initBattlefield() {
    const battlefield = elements.battlefield;
    battlefield.innerHTML = '';
    state.towers.clear();
    
    const rect = battlefield.getBoundingClientRect();
    const cellSize = Math.floor((rect.width - (CONFIG.GRID_SIZE - 1) * CONFIG.CELL_GAP) / CONFIG.GRID_SIZE);
    
    battlefield.style.gridTemplateColumns = `repeat(${CONFIG.GRID_SIZE}, ${cellSize}px)`;
    battlefield.style.gridTemplateRows = `repeat(${CONFIG.GRID_SIZE}, ${cellSize}px)`;
    
    // 创建网格
    for (let row = 0; row < CONFIG.GRID_SIZE; row++) {
        for (let col = 0; col < CONFIG.GRID_SIZE; col++) {
            const cellId = getCellId(row, col);
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = row;
            cell.dataset.col = col;
            cell.dataset.cellId = cellId;
            
            cell.addEventListener('click', handleCellClick);
            
            battlefield.appendChild(cell);
        }
    }
    
    // 绑定炮塔面板事件
    const towerItems = $$('.tower-item');
    towerItems.forEach(item => {
        item.addEventListener('click', handleTowerItemClick);
    });
    
    }

// ============ 拖拽处理 ============
function handleDragStart(e) {
    const towerItem = e.target.closest('.tower-item');
    if (!towerItem) return;
    
    state.drag.active = true;
    state.drag.sourceType = towerItem.dataset.tower;
    state.drag.isMoving = false;
    towerItem.style.opacity = '0.5';
    e.dataTransfer.effectAllowed = 'copy';
}

function handleDragOver(e) {
    e.preventDefault();
    const cell = e.target.closest('.cell');
    if (cell) {
        cell.classList.add('hovering');
    }
}

function handleDragLeave(e) {
    const cell = e.target.closest('.cell');
    if (cell) {
        cell.classList.remove('hovering');
    }
}

function handleDrop(e) {
    e.preventDefault();
    const cell = e.target.closest('.cell');
    if (!cell) return;
    
    cell.classList.remove('hovering');
    const cellId = cell.dataset.cellId;
    
    if (!state.drag.active) return;
    
    // 检查格子是否已有炮塔
    const existingTower = state.towers.get(cellId);
    
    if (existingTower) {
        // 尝试交换（如果是从其他格子拖来的）
        if (state.drag.isMoving) {
            const sourceTower = state.drag.sourceTower;
            if (sourceTower.cellId !== cellId) {
                // 交换位置
                state.towers.delete(sourceTower.cellId);
                sourceTower.cellId = cellId;
                state.towers.set(cellId, sourceTower);
                
                // 更新 DOM
                const sourceCell = sourceTower.element.closest('.cell');
                cell.appendChild(sourceTower.element);
                cell.dataset.cellId = cellId;
                sourceCell.dataset.cellId = sourceTower.cellId;
            }
            sourceTower.element.classList.remove('dragging');
        }
    } else {
        // 放置新炮塔
        if (state.drag.isMoving) {
            // 移动已有炮塔
            const sourceTower = state.drag.sourceTower;
            state.towers.delete(sourceTower.cellId);
            sourceTower.cellId = cellId;
            state.towers.set(cellId, sourceTower);
            cell.appendChild(sourceTower.element);
            sourceTower.element.classList.remove('dragging');
        } else {
            // 新建炮塔
            createTowerInCell(cellId, state.drag.sourceType);
        }
    }
    
        updateUI();
}


function replaceTowerInCell(cellId, newType, oldTower) {
    state.towers.delete(cellId);
    if (oldTower.element && oldTower.element.parentNode) {
        oldTower.element.remove();
    }
    createTowerInCell(cellId, newType);
}


function createTowerInCell(cellId, type) {
    const coords = getCellCoords(cellId);
    const cell = elements.battlefield.children[coords.row * CONFIG.GRID_SIZE + coords.col];
    
    const towerElement = document.createElement('div');
    towerElement.className = 'turret';
    towerElement.dataset.type = type;
        // 炮塔图标（SVG）
    towerElement.innerHTML = `
        <svg viewBox="0 0 60 60" width="100%" height="100%">
            <circle cx="30" cy="30" r="25" fill="${CONFIG.TOWER_TYPES[type].color}" />
            <polygon points="30,10 30,50 50,30" fill="#fff" />
        </svg>
    `;
    
    
    
    const tower = new Tower(cellId, type);
    tower.element = towerElement;
    state.towers.set(cellId, tower);
    cell.appendChild(towerElement);
    
    // 扣除费用
    updateUI();
}

function resetDrag() {
    state.drag.active = false;
    state.drag.sourceType = null;
    state.drag.isMoving = false;
    state.drag.sourceTower = null;
    
    // 清除所有高亮
    $$('.cell.hovering').forEach(c => c.classList.remove('hovering'));
}


// ============ 点击处理 ============
function handleTowerItemClick(e) {
    const towerItem = e.target.closest('.tower-item');
    if (!towerItem) return;
    
    const towerType = towerItem.dataset.tower;
    
    if (state.selectedTowerType === towerType) {
        state.selectedTowerType = null;
        towerItem.classList.remove('selected');
        clearCellHighlights();
        updateStatus('准备部署炮塔');
        return;
    }
    
    $$('.tower-item.selected').forEach(el => el.classList.remove('selected'));
    towerItem.classList.add('selected');
    state.selectedTowerType = towerType;
    
    updateCellHighlights();
    updateStatus('选中: ' + CONFIG.TOWER_TYPES[towerType].name + ' - 点击战场格子部署');
}

function handleCellClick(e) {
    const cell = e.target.closest('.cell');
    if (!cell) return;
    
    // 战斗进行中不允许修改炮塔
    if (state.game.running) {
        alert('战斗进行中，无法修改炮塔布局！请先停止战斗。');
        return;
    }
    
    const cellId = cell.dataset.cellId;
    const existingTower = state.towers.get(cellId);
    
    if (!state.selectedTowerType) return;
    
    const selectedType = state.selectedTowerType;
    
    if (existingTower) {
        // 有炮塔，直接替换（沙盒模式免费替换）
        if (selectedType === existingTower.type) {
            // 相同类型，取消选中
            state.selectedTowerType = null;
            clearCellHighlights();
            $$('.tower-item.selected').forEach(el => el.classList.remove('selected'));
            updateStatus('准备部署炮塔');
            return;
        }
        
        // 替换炮塔
        replaceTowerInCell(cellId, selectedType, existingTower);
        updateStatus('替换成功！');
    } else {
        // 空格子，直接部署（沙盒模式免费）
        createTowerInCell(cellId, selectedType);
        updateStatus('部署成功！');
    }
    
    // 保持选中状态，方便连续部署
    updateCellHighlights();
}


function clearCellHighlights() {
    $$('.cell.hovering, .cell.selected, .cell.valid, .cell.invalid').forEach(c => {
        c.classList.remove('hovering', 'selected', 'valid', 'invalid');
    });
}


function updateCellHighlights() {
    clearCellHighlights();
    
    if (!state.selectedTowerType) return;
    
    // 沙盒模式：所有格子都有效
    for (let row = 0; row < CONFIG.GRID_SIZE; row++) {
        for (let col = 0; col < CONFIG.GRID_SIZE; col++) {
            const cellId = getCellId(row, col);
            const cell = document.querySelector('[data-cell-id="' + cellId + '"]');
            if (!cell) continue;
            
            const hasTower = state.towers.has(cellId);
            if (hasTower) {
                cell.classList.add('valid'); // 有炮塔也允许替换
            } else {
                cell.classList.add('valid'); // 空格子可部署
            }
        }
    }
}


// ============ 游戏循环 ============
function gameLoop(timestamp) {
    if (!state.game.running) return;
    
    const dt = timestamp - state.game.lastTime;
    state.game.lastTime = timestamp;
    
    update(dt);
    draw();
    
    requestAnimationFrame(gameLoop);
}

function update(dt) {
    const currentTime = Date.now();
    const battlefieldRect = elements.battlefield.getBoundingClientRect();
    
    // 生成敌人
    updateSpawning(currentTime);
    
    // 更新炮塔
    for (const tower of state.towers.values()) {
        tower.update(currentTime, state.enemies, state.bullets, battlefieldRect);
    }
    
    // 更新子弹
    for (let i = state.bullets.length - 1; i >= 0; i--) {
        const bullet = state.bullets[i];
        bullet.update(dt);
        if (!bullet.alive) {
            state.bullets.splice(i, 1);
        }
    }
    
    // 更新敌人
    for (let i = state.enemies.length - 1; i >= 0; i--) {
        const enemy = state.enemies[i];
        enemy.update([], dt);
        
        if (!enemy.alive) {
            state.enemies.splice(i, 1);
            continue;
        }
        
        // 子弹击中敌人检测
        for (let j = state.bullets.length - 1; j >= 0; j--) {
            const bullet = state.bullets[j];
            // 子弹只打敌人（这里简化，不检查炮塔来源）
            if (distance(bullet.x, bullet.y, enemy.x, enemy.y) < bullet.radius + enemy.radius) {
                if (enemy.takeDamage(bullet.damage)) {
                    state.bullets.splice(j, 1);
                } else {
                    createParticles(bullet.x, bullet.y, bullet.config.color, 3);
                }
            }
        }
    }
    
    // 更新粒子
    for (let i = state.particles.length - 1; i >= 0; i--) {
        state.particles[i].update();
        if (state.particles[i].lifetime <= 0) {
            state.particles.splice(i, 1);
        }
    }
    
    // 检查波次完成
    checkWaveComplete();
}

function updateSpawning(currentTime) {
    const totalEnemies = waveEnemyCount(state.game.wave);
    
    if (state.game.enemiesSpawned >= totalEnemies && state.enemies.length === 0) {
        // 波次完成
        return;
    }
    
    if (state.game.spawnTimer <= 0) {
        if (state.game.enemiesSpawned < totalEnemies) {
            state.enemies.push(new Enemy(state.game.wave));
            state.game.enemiesSpawned++;
            updateUI();
            updateSkillCooldowns(); // 每秒也更新技能冷却
        }
        state.game.spawnTimer = spawnInterval(state.game.wave);
    } else {
        state.game.spawnTimer -= CONFIG.GAME_TICK;
    }
}

function draw() {
    const ctx = elements.battlefield.getContext('2d');
    const rect = elements.battlefield.getBoundingClientRect();
    
    // 清空战场
    ctx.clearRect(0, 0, rect.width, rect.height);
    
    // 绘制子弹
    for (const bullet of state.bullets) {
        bullet.draw(ctx);
    }
    
    // 绘制敌人
    for (const enemy of state.enemies) {
        enemy.draw(ctx);
    }
    
    // 绘制炮塔
    for (const tower of state.towers.values()) {
        tower.draw(ctx, rect);
    }
    
    // 绘制粒子
    for (const particle of state.particles) {
        particle.draw(ctx, rect);
    }
    
    // 绘制敌人路径预览（调试用，可选）
}

function createParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        state.particles.push(new Particle(x, y, color));
    }
}

// ============ 游戏控制 ============
function startGame() {
    if (state.game.running) return;
    
    // 检查是否有炮塔
    if (state.towers.size === 0) {
        updateStatus('请先部署至少一个炮塔！');
        return;
    }
    
    // 显示技能栏
    if (elements.skillsBar) elements.skillsBar.style.display = 'flex';
    
    // 重置游戏状态（保留炮塔布局和剩余金钱）
    state.game.running = true;
    state.game.wave = 1;
    state.game.lives = CONFIG.STARTING_LIVES;
    // 保留部署阶段剩余的金钱，不重置
    state.game.score = 0;
    state.game.enemiesKilled = 0;
    state.game.enemiesSpawned = 0;
    state.game.spawnTimer = 0;
    state.game.lastTime = performance.now();
    
    state.enemies = [];
    state.bullets = [];
    state.particles = [];
    
    elements.startBtn.textContent = '停止战斗';
    updateStatus();
    requestAnimationFrame(gameLoop);
    // 启动技能冷却检查
    checkSkillCooldowns();
}

function stopGame() {
    state.game.running = false;
    elements.startBtn.textContent = '开始战斗';
    // 隐藏技能栏
    if (elements.skillsBar) elements.skillsBar.style.display = 'none';
    // 停止时重置部分状态，保留金钱（剩余）和炮塔布局
    state.game.wave = 1;
    state.game.lives = CONFIG.STARTING_LIVES;
    state.game.score = 0;
    state.game.enemiesKilled = 0;
    state.game.enemiesSpawned = 0;
    state.game.spawnTimer = 0;
    state.enemies = [];
    state.bullets = [];
    state.particles = [];
    updateStatus('战斗已停止，可以调整炮塔布局');
}

function checkWaveComplete() {
    const totalEnemies = waveEnemyCount(state.game.wave);
    if (state.game.enemiesSpawned >= totalEnemies && state.enemies.length === 0) {
        // 波次完成
        state.game.wave++;
        state.game.money += CONFIG.MONEY_PER_WAVE;
        
        if (state.game.wave > CONFIG.MAX_WAVES) {
            gameWin();
            return;
        }
        
        updateStatus(`第 ${state.game.wave} 波敌人即将到来！`);
        setTimeout(() => {
            if (state.game.running) {
                updateStatus(`第 ${state.game.wave} 波开始！`);
            }
        }, 2000);
    }
}

function gameOver() {
    state.game.running = false;
    updateStatus(`游戏结束！最终得分: ${state.game.score}`);
    elements.startBtn.textContent = '重新开始';
    // 保存记录
    Storage.saveHighScore(state.game.score);
    Storage.saveMaxWave(state.game.wave - 1);
    audio.playExplosion();
    // 这里可以显示游戏结束界面
}

function gameWin() {
    state.game.running = false;
    updateStatus(`胜利！所有波次完成！得分: ${state.game.score}`);
    elements.startBtn.textContent = '重新开始';
    // 保存记录
    Storage.saveHighScore(state.game.score);
    Storage.saveMaxWave(CONFIG.MAX_WAVES);
    audio.playVictory();
}

// ============ UI 更新 ============
function updateStatus(customMsg) {
    // 更新状态栏元素（沙盒模式）
    if (elements.livesDisplay) elements.livesDisplay.textContent = state.game.lives;
    if (elements.waveDisplay) elements.waveDisplay.textContent = state.game.wave + '/' + CONFIG.MAX_WAVES;
    if (elements.scoreDisplay) elements.scoreDisplay.textContent = state.game.score;
    if (elements.highScoreDisplay) elements.highScoreDisplay.textContent = Storage.getHighScore();
    
    if (customMsg) console.log('Status:', customMsg);
}


function updateUI() {
    // 更新状态栏
    if (elements.livesDisplay) elements.livesDisplay.textContent = state.game.lives;
    if (elements.waveDisplay) elements.waveDisplay.textContent = state.game.wave + '/' + CONFIG.MAX_WAVES;
    if (elements.scoreDisplay) elements.scoreDisplay.textContent = state.game.score;
    if (elements.highScoreDisplay) elements.highScoreDisplay.textContent = Storage.getHighScore();
    
    // 更新技能栏冷却显示
    updateSkillCooldowns();
    
    // 同时更新状态文本
    updateStatus();
}





// ============ 炮塔菜单 ============
let currentMenu = null;

function showTowerMenu(e, cellId) {
    const tower = state.towers.get(cellId);
    if (!tower) return;
    
    hideTowerMenu();
    
    const menu = document.createElement('div');
    menu.className = 'tower-menu';
    menu.style.cssText = 'position: fixed; left:' + e.pageX + 'px; top:' + e.pageY + 'px; background: rgba(30,40,70,0.95); border: 2px solid #4ecca3; border-radius: 8px; padding: 10px 0; min-width: 150px; z-index: 1000; box-shadow: 0 4px 20px rgba(0,0,0,0.5);';
    
    const config = CONFIG.TOWER_TYPES[tower.type];
    const upgradeCost = Math.floor(getTowerCost(tower.type) * CONFIG.TOWER_UPGRADE.multiplier);
    const sellValue = Math.floor(tower.totalInvested * CONFIG.TOWER_UPGRADE.sellRate);
    
    const title = document.createElement('div');
    title.textContent = config.name + ' Lv.' + tower.level + '/' + CONFIG.TOWER_UPGRADE.maxLevel;
    title.style.cssText = 'color:#4ecca3;padding:5px 15px;font-weight:bold;border-bottom:1px solid #4ecca340;margin-bottom:5px;';
    menu.appendChild(title);
    
    // 升级按钮
    if (tower.level < CONFIG.TOWER_UPGRADE.maxLevel) {
        const upgradeBtn = document.createElement('button');
        upgradeBtn.textContent = '升级 ($' + upgradeCost + ')';
        upgradeBtn.style.cssText = 'display:block;width:100%;padding:8px 15px;background:rgba(78,204,163,0.2);color:#4ecca3;border:none;text-align:left;cursor:pointer;font-size:14px;';
        upgradeBtn.onclick = () => { upgradeTower(cellId, upgradeCost); };
        menu.appendChild(upgradeBtn);
    }
    
    // 出售按钮
    const sellBtn = document.createElement('button');
    sellBtn.textContent = '出售 (+$' + sellValue + ')';
    sellBtn.style.cssText = 'display:block;width:100%;padding:8px 15px;background:rgba(244,67,54,0.2);color:#f44336;border:none;text-align:left;cursor:pointer;font-size:14px;';
    sellBtn.onclick = () => { sellTower(cellId, sellValue); };
    menu.appendChild(sellBtn);
    
    document.body.appendChild(menu);
    currentMenu = menu;
    
    // 点击外部关闭
    setTimeout(() => {
        document.addEventListener('click', closeMenuOnClickOutside);
    }, 0);
}

function closeMenuOnClickOutside(e) {
    if (currentMenu && !currentMenu.contains(e.target)) {
        hideTowerMenu();
    }
}

function hideTowerMenu() {
    if (currentMenu) {
        currentMenu.remove();
        currentMenu = null;
    }
    document.removeEventListener('click', closeMenuOnClickOutside);
}

function upgradeTower(cellId, cost) {
    if (state.game.money < cost) {
        alert('金钱不足！');
        hideTowerMenu();
        return;
    }
    
    state.game.money -= cost;
    
    const tower = state.towers.get(cellId);
    if (!tower) return;
    
    tower.level++;
    tower.totalInvested += cost;
    
    // 升级属性（基于升级倍率）
    const config = CONFIG.TOWER_TYPES[tower.type];
    config.damage = Math.floor(config.damage * CONFIG.TOWER_UPGRADE.multiplier);
    config.fireRate = Math.max(100, Math.floor(config.fireRate / CONFIG.TOWER_UPGRADE.multiplier));
    config.range = Math.floor(config.range * CONFIG.TOWER_UPGRADE.multiplier);
    
    audio.playUpgrade();
    updateStatus(config.name + ' 升级到 Lv.' + tower.level + '！');
    updateCellHighlights();
    hideTowerMenu();
    updateUI();
}

function sellTower(cellId, value) {
    const tower = state.towers.get(cellId);
    if (!tower) return;
    
    state.game.money += value;
    state.towers.delete(cellId);
    if (tower.element && tower.element.parentNode) {
        tower.element.remove();
    }
    
    updateStatus('出售 ' + CONFIG.TOWER_TYPES[tower.type].name + '，获得 $' + value);
    updateCellHighlights();
    hideTowerMenu();
    updateUI();
}

// ============ 事件绑定 ============
function bindEvents() {
    elements.startBtn.addEventListener('click', () => {
        if (state.game.running) {
            stopGame();
        } else {
            startGame();
        }
    });
    
    // 菜单按钮绑定
    const menuBtn = document.getElementById('menuBtn');
    if (menuBtn) {
        menuBtn.addEventListener('click', () => {
            const menuOverlay = document.getElementById('menuOverlay');
            const isOpen = menuOverlay.style.display === 'flex';
            
            if (isOpen) {
                menuOverlay.style.display = 'none';
                menuBtn.textContent = '☰';
            } else {
                // 更新统计数据
                if (typeof Storage !== 'undefined' && Storage.getHighScore) {
                    document.getElementById('menuHighScore').textContent = Storage.getHighScore();
                    document.getElementById('menuMaxWave').textContent = Storage.getMaxWave();
                }
                menuOverlay.style.display = 'flex';
                menuBtn.textContent = '×';
            }
        });
    }
    
    window.addEventListener('resize', () => {
        // 重新计算网格但不重置炮塔（需要更复杂的处理）
        // 暂时不做处理
    });
}

// ============ 初始化入口 ============
document.addEventListener('DOMContentLoaded', () => {
    // 获取 DOM 元素
    elements.battlefield = $('#battlefield');
    elements.startBtn = $('#startBtn');
    elements.livesDisplay = $('#livesDisplay');
    elements.waveDisplay = $('#waveDisplay');
    elements.scoreDisplay = $('#scoreDisplay');
    elements.highScoreDisplay = $('#highScoreDisplay');
    elements.skillsBar = $('#skillsBar');
    
    if (!elements.battlefield || !elements.startBtn) {
        console.error('Missing required DOM elements');
        return;
    }
    
    bindEvents();
    initBattlefield();
    updateUI();
    
    console.log('Tower Defense Game initialized!');
});
