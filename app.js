// ============================================
// 塔防游戏 - 优化版
// ============================================

// ============ 配置常量 ============
const CONFIG = {
    GRID_SIZE: 5,
    CELL_MIN_SIZE: 80,
    CELL_GAP: 4,
    GAME_TICK: 16, // ~60fps
    
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
    STARTING_LIVES: 5,
    STARTING_MONEY: 200,
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
        money: CONFIG.STARTING_MONEY,
        score: 0,
        enemiesKilled: 0,
        enemiesSpawned: 0,
        spawnTimer: 0,
        lastTime: 0
    },
    
    drag: {
        active: false,
        sourceType: null,
        sourceCellId: null,
        isMoving: false
    }
};

// ============ DOM 元素 ============
const elements = {
    battlefield: null,
    startBtn: null,
    status: null,
    stats: {}
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
            
            cell.addEventListener('dragover', handleDragOver);
            cell.addEventListener('dragleave', handleDragLeave);
            cell.addEventListener('drop', handleDrop);
            
            battlefield.appendChild(cell);
        }
    }
    
    // 绑定炮塔面板事件
    const towerItems = $$('.tower-item');
    towerItems.forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
    });
    
    // 初始化拖拽状态
    state.drag.active = false;
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
    
    resetDrag();
    updateUI();
}

function createTowerInCell(cellId, type) {
    const coords = getCellCoords(cellId);
    const cell = elements.battlefield.children[coords.row * CONFIG.GRID_SIZE + coords.col];
    
    const towerElement = document.createElement('div');
    towerElement.className = 'turret';
    towerElement.dataset.type = type;
    towerElement.setAttribute('draggable', 'true');
    
    // 炮塔图标（SVG）
    towerElement.innerHTML = `
        <svg viewBox="0 0 60 60" width="100%" height="100%">
            <circle cx="30" cy="30" r="25" fill="${CONFIG.TOWER_TYPES[type].color}" />
            <polygon points="30,10 30,50 50,30" fill="#fff" />
        </svg>
    `;
    
    towerElement.addEventListener('dragstart', (e) => {
        towerElement.classList.add('dragging');
        state.drag.active = true;
        state.drag.sourceType = type;
        state.drag.isMoving = true;
        state.drag.sourceTower = Object.values(state.towers).find(t => t.element === towerElement);
        e.dataTransfer.effectAllowed = 'move';
    });
    
    towerElement.addEventListener('dragend', () => {
        towerElement.classList.remove('dragging');
    });
    
    const tower = new Tower(cellId, type);
    tower.element = towerElement;
    state.towers.set(cellId, tower);
    cell.appendChild(towerElement);
}

function resetDrag() {
    state.drag.active = false;
    state.drag.sourceType = null;
    state.drag.isMoving = false;
    state.drag.sourceTower = null;
    
    // 清除所有高亮
    $$('.cell.hovering').forEach(c => c.classList.remove('hovering'));
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
    
    // 重置游戏状态（保留炮塔布局）
    state.game.running = true;
    state.game.wave = 1;
    state.game.lives = CONFIG.STARTING_LIVES;
    state.game.money = CONFIG.STARTING_MONEY;
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
}

function stopGame() {
    state.game.running = false;
    elements.startBtn.textContent = '开始战斗';
    updateStatus('战斗已停止');
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
    // 这里可以显示游戏结束界面
}

function gameWin() {
    state.game.running = false;
    updateStatus(`胜利！所有波次完成！得分: ${state.game.score}`);
    elements.startBtn.textContent = '重新开始';
}

// ============ UI 更新 ============
function updateStatus(customMsg) {
    const msg = customMsg || (
        state.game.running 
            ? `战斗进行中... 金钱: $${state.game.money} | 生命: ${state.game.lives} | 波次: ${state.game.wave}`
            : `准备部署炮塔 | 已部署: ${state.towers.size} | 金钱: $${state.game.money}`
    );
    elements.status.textContent = msg;
}

function updateUI() {
    updateStatus();
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
    elements.status = $('.status');
    
    if (!elements.battlefield || !elements.startBtn) {
        console.error('Missing required DOM elements');
        return;
    }
    
    bindEvents();
    initBattlefield();
    updateUI();
    
    console.log('Tower Defense Game initialized!');
});
