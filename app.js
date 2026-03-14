const battlefield = document.getElementById('battlefield');
const startBtn = document.getElementById('startBtn');
const statusSpan = document.querySelector('.status');

const GRID_SIZE = 5;
const cells = [];
let currentDraggingTower = null;
let isBattleStarted = false;
let battleInterval = null;

// 初始化战场
function initBattlefield() {
    battlefield.innerHTML = '';
    cells.length = 0;
    
    for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = row;
            cell.dataset.col = col;
            
            // 添加拖拽事件
            cell.addEventListener('dragover', handleDragOver);
            cell.addEventListener('dragleave', handleDragLeave);
            cell.addEventListener('drop', handleDrop);
            
            battlefield.appendChild(cell);
            cells.push(cell);
        }
    }
    
    // 为炮塔面板添加拖拽事件
    const towerItems = document.querySelectorAll('.tower-item');
    towerItems.forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragend', handleDragEnd);
    });
}

// 拖拽炮塔事件
function handleDragStart(e) {
    currentDraggingTower = e.target.closest('.tower-item').dataset.tower;
    e.target.closest('.tower-item').style.opacity = '0.5';
    e.dataTransfer.effectAllowed = 'copy';
}

function handleDragEnd(e) {
    e.target.closest('.tower-item').style.opacity = '1';
    currentDraggingTower = null;
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    e.target.classList.add('hovering');
}

function handleDragLeave(e) {
    e.target.classList.remove('hovering');
}

function handleDrop(e) {
    e.preventDefault();
    e.target.classList.remove('hovering');
    
    if (!currentDraggingTower || e.target.querySelector('.turret')) {
        return;
    }
    
    // 创建炮塔
    const turret = document.createElement('div');
    turret.className = 'turret';
    turret.dataset.type = currentDraggingTower;
    
    const img = document.createElement('img');
    img.src = `assets/${currentDraggingTower}.svg`;
    img.alt = `${currentDraggingTower} turret`;
    img.onerror = function() {
        this.src = `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iOCIgZmlsbD0iIzY2NiIvPgo8Y2lyY2xlIGN4PSIzMiIgY3k9IjMyIiByPSI2IiBmaWxsPSIjOTk5Ii8+CjxwYXRoIGQ9Ik0zMiAxNlYxMC41TDIxIDE5TDMyIDI4TDQzIDE5TDMyIDEwLjVWMjBaIiBmaWxsPSIjRkNGQ0ZDIi8+Cjwvc3ZnPgo=`;
    };
    
    turret.appendChild(img);
    e.target.appendChild(turret);
    
    updateStatus();
}

// 更新状态
function updateStatus() {
    const turretCount = document.querySelectorAll('.turret').length;
    if (isBattleStarted) {
        statusSpan.textContent = `状态: 战斗进行中... 拥有 ${turretCount} 个炮塔`;
    } else {
        statusSpan.textContent = `状态: 准备部署炮塔 (已放置 ${turretCount} 个)`;
    }
}

// 发射炮弹
function fireBullet(turret, row, col) {
    const cell = cells[row * GRID_SIZE + col];
    
    // 创建炮弹
    const bullet = document.createElement('div');
    bullet.className = 'bullet bullet-firing';
    
    const img = document.createElement('img');
    img.src = 'assets/bullet.svg';
    img.alt = 'bullet';
    img.onerror = function() {
        this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTAiIGN5PSIxMCIgcj0iOCIgZmlsbD0iI0VCMDAyQiIvPgo8L3N2Zz4K';
    };
    
    bullet.appendChild(img);
    cell.appendChild(bullet);
    
    // 根据炮塔类型设置炮弹飞行方向
    const towerType = turret.dataset.type;
    switch(towerType) {
        case 'tower1': // 向上
            bullet.style.animation = 'bulletUp 0.5s linear';
            break;
        case 'tower2': // 向右
            bullet.style.animation = 'bulletRight 0.5s linear';
            break;
        case 'tower3': // 向下
            bullet.style.animation = 'bulletDown 0.5s linear';
            break;
        case 'tower4': // 向左
            bullet.style.animation = 'bulletLeft 0.5s linear';
            break;
    }
    
    // 动画结束后移除炮弹
    setTimeout(() => {
        bullet.remove();
    }, 500);
}

// 战斗循环
function battleLoop() {
    const turrets = document.querySelectorAll('.turret');
    turrets.forEach((turret, index) => {
        // 每个炮塔间隔发射
        setTimeout(() => {
            const cell = turret.closest('.cell');
            const row = parseInt(cell.dataset.row);
            const col = parseInt(cell.dataset.col);
            fireBullet(turret, row, col);
        }, index * 100);
    });
}

// 开始/停止战斗
startBtn.addEventListener('click', () => {
    if (isBattleStarted) {
        // 停止战斗
        clearInterval(battleInterval);
        startBtn.textContent = '开始战斗';
        statusSpan.textContent = '状态: 战斗已停止';
        isBattleStarted = false;
    } else {
        // 开始战斗
        const turretCount = document.querySelectorAll('.turret').length;
        if (turretCount === 0) {
            statusSpan.textContent = '状态: 请先部署炮塔再开始战斗';
            return;
        }
        
        startBtn.textContent = '停止战斗';
        statusSpan.textContent = `状态: 战斗进行中... 拥有 ${turretCount} 个炮塔`;
        isBattleStarted = true;
        
        // 立即执行一次，然后每秒执行
        battleLoop();
        battleInterval = setInterval(battleLoop, 1000);
    }
    updateStatus();
});

// 添加炮弹方向动画
const style = document.createElement('style');
style.textContent = `
    @keyframes bulletUp {
        0% {
            opacity: 1;
            transform: scale(1) translateY(0);
        }
        100% {
            opacity: 0;
            transform: scale(0.5) translateY(-200px);
        }
    }
    
    @keyframes bulletRight {
        0% {
            opacity: 1;
            transform: scale(1) translateX(0);
        }
        100% {
            opacity: 0;
            transform: scale(0.5) translateX(200px);
        }
    }
    
    @keyframes bulletDown {
        0% {
            opacity: 1;
            transform: scale(1) translateY(0);
        }
        100% {
            opacity: 0;
            transform: scale(0.5) translateY(200px);
        }
    }
    
    @keyframes bulletLeft {
        0% {
            opacity: 1;
            transform: scale(1) translateX(0);
        }
        100% {
            opacity: 0;
            transform: scale(0.5) translateX(-200px);
        }
    }
`;
document.head.appendChild(style);

// 初始化
initBattlefield();
