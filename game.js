// Canvas 및 기본 렌더링 컨텍스트
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI DOM 요소
const levelDisplay = document.getElementById('levelDisplay');
const expBarFill = document.getElementById('expBarFill');
const expText = document.getElementById('expText');
const levelupNotice = document.getElementById('levelup-notice');

// 탄약 HUD DOM 요소
const currentAmmoEl = document.getElementById('currentAmmo');
const maxAmmoEl = document.getElementById('maxAmmo');
const ammoBarFill = document.getElementById('ammoBarFill');
const reloadHint = document.getElementById('reloadHint');
const weaponNameEl = document.querySelector('.weapon-name');

// 무기 진화 모달 DOM 요소
const evolutionModal = document.getElementById('evolution-modal');
let isEvolutionPending = false;

// 스탯 HUD DOM 요소
const statPointsBadge = document.getElementById('statPointsBadge');
const statPointsCount = document.getElementById('statPointsCount');
const statElements = {
  hp: {
    btn: document.getElementById('btn-upgrade-hp'),
    bar: document.getElementById('bar-hp'),
    val: document.getElementById('val-hp'),
  },
  def: {
    btn: document.getElementById('btn-upgrade-def'),
    bar: document.getElementById('bar-def'),
    val: document.getElementById('val-def'),
  },
  atk: {
    btn: document.getElementById('btn-upgrade-atk'),
    bar: document.getElementById('bar-atk'),
    val: document.getElementById('val-atk'),
  },
  spd: {
    btn: document.getElementById('btn-upgrade-spd'),
    bar: document.getElementById('bar-spd'),
    val: document.getElementById('val-spd'),
  },
};

// 아레나 설정 (Diep.io 스타일 초대형 맵: 8000 x 8000)
const ARENA_SIZE = 8000;
const HALF_ARENA = ARENA_SIZE / 2;
const GRID_SIZE = 40;

// 화면 크기 조정 및 고해상도(DPI) 대응
let screenWidth = window.innerWidth;
let screenHeight = window.innerHeight;

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  screenWidth = window.innerWidth;
  screenHeight = window.innerHeight;

  canvas.width = screenWidth * dpr;
  canvas.height = screenHeight * dpr;
  canvas.style.width = screenWidth + 'px';
  canvas.style.height = screenHeight + 'px';

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// 입력 상태 관리
const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
};

let mousePos = { x: screenWidth / 2, y: screenHeight / 2 };
let isMouseDown = false;

window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if (key === 'w' || key === 'arrowup') keys.w = true;
  if (key === 'a' || key === 'arrowleft') keys.a = true;
  if (key === 's' || key === 'arrowdown') keys.s = true;
  if (key === 'd' || key === 'arrowright') keys.d = true;
  if (key === 'r') tryReload();
  if (e.code === 'Space') isMouseDown = true;

  // 스탯 업그레이드 단축키 (1: 체력, 2: 방어력, 3: 공격력, 4: 이동속도)
  if (e.key === '1') upgradeStat('hp');
  if (e.key === '2') upgradeStat('def');
  if (e.key === '3') upgradeStat('atk');
  if (e.key === '4') upgradeStat('spd');
});

window.addEventListener('keyup', (e) => {
  const key = e.key.toLowerCase();
  if (key === 'w' || key === 'arrowup') keys.w = false;
  if (key === 'a' || key === 'arrowleft') keys.a = false;
  if (key === 's' || key === 'arrowdown') keys.s = false;
  if (key === 'd' || key === 'arrowright') keys.d = false;
  if (e.code === 'Space') isMouseDown = false;
});

window.addEventListener('mousemove', (e) => {
  mousePos.x = e.clientX;
  mousePos.y = e.clientY;
});

window.addEventListener('mousedown', (e) => {
  if (e.button === 0) isMouseDown = true;
});

window.addEventListener('mouseup', (e) => {
  if (e.button === 0) isMouseDown = false;
});

// ==========================================
// 모바일 듀얼 가상 조이스틱 시스템 (이동 & 조준/사격)
// ==========================================
const joystickMoveEl = document.getElementById('joystick-move');
const joystickMoveThumb = document.getElementById('joystick-move-thumb');
const joystickAimEl = document.getElementById('joystick-aim');
const joystickAimThumb = document.getElementById('joystick-aim-thumb');
const mobileReloadBtn = document.getElementById('btn-mobile-reload');

// 조이스틱 입력 상태 벡터 (-1.0 ~ 1.0)
const joystickInput = {
  move: { x: 0, y: 0, active: false, touchId: null },
  aim: { x: 0, y: 0, active: false, touchId: null },
};

function setupJoysticks() {
  const maxRadius = 42; // 노브 이동 한계 반경

  // 1. 이동 조이스틱 터치 핸들러
  if (joystickMoveEl) {
    joystickMoveEl.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (joystickInput.move.active) return;
      const touch = e.changedTouches[0];
      joystickInput.move.touchId = touch.identifier;
      joystickInput.move.active = true;
      handleJoystickMoveTouch(touch);
    }, { passive: false });

    joystickMoveEl.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === joystickInput.move.touchId) {
          handleJoystickMoveTouch(touch);
          break;
        }
      }
    }, { passive: false });

    const endMove = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === joystickInput.move.touchId) {
          joystickInput.move.active = false;
          joystickInput.move.touchId = null;
          joystickInput.move.x = 0;
          joystickInput.move.y = 0;
          if (joystickMoveThumb) {
            joystickMoveThumb.style.transform = `translate(0px, 0px)`;
          }
          break;
        }
      }
    };
    joystickMoveEl.addEventListener('touchend', endMove);
    joystickMoveEl.addEventListener('touchcancel', endMove);
  }

  function handleJoystickMoveTouch(touch) {
    const base = joystickMoveEl.querySelector('.joystick-base');
    const rect = base.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = touch.clientX - centerX;
    const dy = touch.clientY - centerY;
    const dist = Math.hypot(dx, dy);

    if (dist === 0) {
      joystickInput.move.x = 0;
      joystickInput.move.y = 0;
      if (joystickMoveThumb) joystickMoveThumb.style.transform = `translate(0px, 0px)`;
      return;
    }

    const clampedDist = Math.min(dist, maxRadius);
    const normX = dx / dist;
    const normY = dy / dist;

    // 조이스틱 축 벡터 정규화
    joystickInput.move.x = normX * (clampedDist / maxRadius);
    joystickInput.move.y = normY * (clampedDist / maxRadius);

    if (joystickMoveThumb) {
      joystickMoveThumb.style.transform = `translate(${normX * clampedDist}px, ${normY * clampedDist}px)`;
    }
  }

  // 2. 조준 & 사격 조이스틱 터치 핸들러
  if (joystickAimEl) {
    joystickAimEl.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (joystickInput.aim.active) return;
      const touch = e.changedTouches[0];
      joystickInput.aim.touchId = touch.identifier;
      joystickInput.aim.active = true;
      handleJoystickAimTouch(touch);
    }, { passive: false });

    joystickAimEl.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === joystickInput.aim.touchId) {
          handleJoystickAimTouch(touch);
          break;
        }
      }
    }, { passive: false });

    const endAim = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === joystickInput.aim.touchId) {
          joystickInput.aim.active = false;
          joystickInput.aim.touchId = null;
          joystickInput.aim.x = 0;
          joystickInput.aim.y = 0;
          if (joystickAimThumb) {
            joystickAimThumb.style.transform = `translate(0px, 0px)`;
          }
          break;
        }
      }
    };
    joystickAimEl.addEventListener('touchend', endAim);
    joystickAimEl.addEventListener('touchcancel', endAim);
  }

  function handleJoystickAimTouch(touch) {
    const base = joystickAimEl.querySelector('.joystick-base');
    const rect = base.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = touch.clientX - centerX;
    const dy = touch.clientY - centerY;
    const dist = Math.hypot(dx, dy);

    if (dist === 0) {
      joystickInput.aim.x = 0;
      joystickInput.aim.y = 0;
      if (joystickAimThumb) joystickAimThumb.style.transform = `translate(0px, 0px)`;
      return;
    }

    const clampedDist = Math.min(dist, maxRadius);
    const normX = dx / dist;
    const normY = dy / dist;

    joystickInput.aim.x = normX * (clampedDist / maxRadius);
    joystickInput.aim.y = normY * (clampedDist / maxRadius);

    if (joystickAimThumb) {
      joystickAimThumb.style.transform = `translate(${normX * clampedDist}px, ${normY * clampedDist}px)`;
    }
  }

  // 3. 모바일 재장전 버튼
  if (mobileReloadBtn) {
    mobileReloadBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      tryReload();
    }, { passive: false });
    mobileReloadBtn.addEventListener('click', (e) => {
      e.preventDefault();
      tryReload();
    });
  }
}
setupJoysticks();

// 무기 스펙 정의 (5레벨 주기 진화 선택지 5종)
const WEAPONS = {
  pistol: {
    id: 'pistol',
    name: '일반 권총',
    maxAmmo: 10,
    fireInterval: 25,
    reloadDuration: 75,
    bulletSpeed: 16,
    baseDamage: 18,
    isMelee: false,
  },
  rifle: {
    id: 'rifle',
    name: '연발소총',
    maxAmmo: 30,
    fireInterval: 7,
    reloadDuration: 80,
    bulletSpeed: 19,
    baseDamage: 11,
    isMelee: false,
  },
  shotgun: {
    id: 'shotgun',
    name: '샷건',
    maxAmmo: 6,
    fireInterval: 38,
    reloadDuration: 85,
    bulletSpeed: 17,
    baseDamage: 13, // 펠릿당 데미지 (6발 발사 시 78+ 데미지)
    pelletCount: 6,
    isMelee: false,
  },
  sniper: {
    id: 'sniper',
    name: '저격총',
    maxAmmo: 4,
    fireInterval: 55,
    reloadDuration: 95,
    bulletSpeed: 27,
    baseDamage: 58,
    isMelee: false,
  },
  knife: {
    id: 'knife',
    name: '칼 (검기)',
    maxAmmo: Infinity,
    fireInterval: 18,
    reloadDuration: 0,
    bulletSpeed: 13,
    baseDamage: 32,
    isMelee: true,
  },
};

// 플레이어 객체 (기본 이동속도 하향 조정 및 4대 스탯 시스템 탑재)
const player = {
  x: 0,
  y: 0,
  radius: 22,
  angle: 0,
  vx: 0,
  vy: 0,

  // 기본 이동속도 하향 조정 (기존 5.6 -> 4.5, 가속도 0.85 -> 0.70)
  baseMaxSpeed: 4.5,
  baseAcceleration: 0.70,
  maxSpeed: 4.5,
  acceleration: 0.70,
  friction: 0.90,

  bodyColor: '#00b2e1',
  strokeColor: '#444444',
  strokeWidth: 3.5,

  // 체력 및 방어력
  baseMaxHp: 100,
  maxHp: 100,
  hp: 100,
  defense: 0, // 피해 감소율 (0 ~ 56%)

  // 무기 시스템 (기본: 권총)
  currentWeapon: 'pistol',
  baseBulletDamage: 18,
  bulletDamage: 18,
  bulletSpeed: 16,
  maxAmmo: 10,
  ammo: 10,
  isReloading: false,
  reloadDuration: 75,
  reloadTimer: 0,
  fireCooldown: 0,
  fireInterval: 25,
  slashSwingTimer: 0, // 칼 휘두르기 시각 효과 타이머

  magnetRadius: 115,

  // 레벨 & 경험치
  level: 1,
  exp: 0,
  maxExp: 50,
  pendingEvolutions: 0, // 누적된 무기 진화 기회 카운트

  // 스탯 포인트 및 4대 스탯 레벨 (각 최대 7)
  statPoints: 0,
  stats: {
    hp: 0,
    def: 0,
    atk: 0,
    spd: 0,
  },
};

// 스탯 업그레이드 함수 (Diep.io 방식)
function upgradeStat(statName) {
  if (player.statPoints <= 0) return;
  if (player.stats[statName] >= 7) return;

  player.statPoints--;
  player.stats[statName]++;

  if (statName === 'hp') {
    const hpBonus = 20;
    player.maxHp = player.baseMaxHp + player.stats.hp * hpBonus;
    player.hp = Math.min(player.maxHp, player.hp + hpBonus);
    addFloatingText(player.x, player.y - 28, `+체력 UP! (HP ${player.maxHp})`, '#00e676');
  } else if (statName === 'def') {
    player.defense = player.stats.def * 0.08; // 레벨당 8% 피해 감소
    addFloatingText(player.x, player.y - 28, `+방어력 UP! (경감 ${Math.round(player.defense * 100)}%)`, '#00b0ff');
  } else if (statName === 'atk') {
    player.bulletDamage = player.baseBulletDamage + player.stats.atk * 4;
    addFloatingText(player.x, player.y - 28, `+공격력 UP! (DMG ${player.bulletDamage})`, '#ff5252');
  } else if (statName === 'spd') {
    player.maxSpeed = player.baseMaxSpeed + player.stats.spd * 0.35;
    player.acceleration = player.baseAcceleration + player.stats.spd * 0.05;
    addFloatingText(player.x, player.y - 28, `+이동속도 UP!`, '#ffd600');
  }

  updateStatUI();
}

// 스탯 UI 갱신 함수 (스탯 포인트가 있을 때만 노출, 다 찍으면 다시 숨김)
function updateStatUI() {
  const statHud = document.getElementById('stat-hud');
  if (statHud) {
    if (player.statPoints > 0) {
      statHud.classList.remove('hidden');
    } else {
      statHud.classList.add('hidden');
    }
  }

  if (statPointsCount) {
    statPointsCount.textContent = player.statPoints;
  }

  if (statPointsBadge) {
    if (player.statPoints > 0) {
      statPointsBadge.classList.remove('hidden');
    } else {
      statPointsBadge.classList.add('hidden');
    }
  }

  const statKeys = ['hp', 'def', 'atk', 'spd'];
  for (let i = 0; i < statKeys.length; i++) {
    const key = statKeys[i];
    const lvl = player.stats[key];
    const el = statElements[key];
    if (!el) continue;

    el.bar.style.width = `${(lvl / 7) * 100}%`;
    el.val.textContent = `${lvl}/7`;

    if (lvl >= 7) {
      el.btn.disabled = true;
      el.btn.textContent = 'MAX';
      el.btn.classList.remove('active');
    } else if (player.statPoints > 0) {
      el.btn.disabled = false;
      el.btn.textContent = '+';
      el.btn.classList.add('active');
    } else {
      el.btn.disabled = true;
      el.btn.textContent = '+';
      el.btn.classList.remove('active');
    }
  }
}

// 버튼 클릭 이벤트 리스너 등록
statElements.hp.btn.addEventListener('click', () => upgradeStat('hp'));
statElements.def.btn.addEventListener('click', () => upgradeStat('def'));
statElements.atk.btn.addEventListener('click', () => upgradeStat('atk'));
statElements.spd.btn.addEventListener('click', () => upgradeStat('spd'));

// ==========================================
// 무기 진화 (Weapon Evolution) 시스템
// ==========================================
function selectWeaponEvolution(weaponId) {
  const spec = WEAPONS[weaponId];
  if (!spec) return;

  player.currentWeapon = weaponId;
  player.baseBulletDamage = spec.baseDamage;
  player.bulletDamage = spec.baseDamage + player.stats.atk * 4;
  player.bulletSpeed = spec.bulletSpeed;
  player.maxAmmo = spec.maxAmmo;
  player.ammo = spec.maxAmmo;
  player.fireInterval = spec.fireInterval;
  player.reloadDuration = spec.reloadDuration;
  player.isReloading = false;
  player.reloadTimer = 0;
  player.fireCooldown = 0;

  if (weaponNameEl) {
    weaponNameEl.textContent = spec.name;
  }

  updateAmmoUI();
  addFloatingText(player.x, player.y - 35, `무기 진화: [${spec.name}]!`, '#00e5ff');

  // 모달 닫기
  if (player.pendingEvolutions > 0) {
    player.pendingEvolutions--;
  }
  if (player.pendingEvolutions > 0) {
    // 아직 남아있는 진화 기회가 있으면 계속 표시
    showEvolutionModal();
  } else {
    hideEvolutionModal();
  }
}

function showEvolutionModal() {
  if (!evolutionModal) return;
  isEvolutionPending = true;
  evolutionModal.classList.remove('hidden');
}

function hideEvolutionModal() {
  if (!evolutionModal) return;
  isEvolutionPending = false;
  evolutionModal.classList.add('hidden');
}

// 무기 진화 카드 클릭 이벤트 바인딩
document.querySelectorAll('.evolution-card').forEach((card) => {
  card.addEventListener('click', () => {
    const wId = card.getAttribute('data-weapon');
    selectWeaponEvolution(wId);
  });
});

// 키보드 숫자키(1~5)로 진화 선택 지원
window.addEventListener('keydown', (e) => {
  if (!isEvolutionPending) return;
  const numKeyMap = {
    '1': 'pistol',
    '2': 'rifle',
    '3': 'shotgun',
    '4': 'sniper',
    '5': 'knife',
  };
  if (numKeyMap[e.key]) {
    selectWeaponEvolution(numKeyMap[e.key]);
  }
});

// ==========================================
// Arrow.io 스타일 벽(Wall) 시스템 - 길이 증가 및 고밀도 배치
// ==========================================
const WALL_THICKNESS = 36;
const walls = [];

function generateWalls() {
  walls.length = 0;
  const cellSize = 550; // 더 촘촘한 간격으로 벽 밀도 대폭 증가
  const range = 3600;   // 8000x8000 맵 전역 커버

  for (let gx = -range; gx <= range; gx += cellSize) {
    for (let gy = -range; gy <= range; gy += cellSize) {
      // 시작 지점(중앙) 주변은 안전한 오픈 광장 유지
      if (Math.hypot(gx, gy) < 450) continue;

      const seed = Math.abs(Math.sin(gx * 17.123 + gy * 91.456) * 43758.5453);
      const pattern = Math.floor(seed) % 6;

      // 벽 길이를 기존보다 약 40~50% 늘려 장대한 전투 회랑 구축
      if (pattern === 0) {
        // [T자형 벽 - 롱 바 버전]
        walls.push({ x: gx - 190, y: gy - 90, w: 380, h: WALL_THICKNESS });
        walls.push({ x: gx - WALL_THICKNESS / 2, y: gy - 90 + WALL_THICKNESS, w: WALL_THICKNESS, h: 240 });
      } else if (pattern === 1) {
        // [회전 T자형 벽]
        walls.push({ x: gx - 90, y: gy - 190, w: WALL_THICKNESS, h: 380 });
        walls.push({ x: gx - 90 + WALL_THICKNESS, y: gy - WALL_THICKNESS / 2, w: 240, h: WALL_THICKNESS });
      } else if (pattern === 2) {
        // [L자형 코너 롱 월]
        walls.push({ x: gx - 160, y: gy - 160, w: 320, h: WALL_THICKNESS });
        walls.push({ x: gx - 160, y: gy - 160 + WALL_THICKNESS, w: WALL_THICKNESS, h: 250 });
      } else if (pattern === 3) {
        // [역 L자형 코너 롱 월]
        walls.push({ x: gx - 160, y: gy + 160 - WALL_THICKNESS, w: 320, h: WALL_THICKNESS });
        walls.push({ x: gx + 160 - WALL_THICKNESS, y: gy - 100, w: WALL_THICKNESS, h: 260 });
      } else if (pattern === 4) {
        // [평행 회랑 통로 벽]
        walls.push({ x: gx - 200, y: gy - 100, w: 400, h: WALL_THICKNESS });
        walls.push({ x: gx - 200, y: gy + 100, w: 400, h: WALL_THICKNESS });
      } else {
        // [십자형 롱 크로스 벽]
        walls.push({ x: gx - 140, y: gy - WALL_THICKNESS / 2, w: 280, h: WALL_THICKNESS });
        walls.push({ x: gx - WALL_THICKNESS / 2, y: gy - 140, w: WALL_THICKNESS, h: 280 });
      }
    }
  }
}
generateWalls();

// 벽과의 충돌/겹침 검사
function checkWallOverlap(x, y, radius, padding = 18) {
  const checkR = radius + padding;
  for (let i = 0; i < walls.length; i++) {
    const w = walls[i];
    const closestX = Math.max(w.x, Math.min(x, w.x + w.w));
    const closestY = Math.max(w.y, Math.min(y, w.y + w.h));
    const dx = x - closestX;
    const dy = y - closestY;
    if (dx * dx + dy * dy < checkR * checkR) {
      return true;
    }
  }
  return false;
}

// ==========================================
// 7단계 상자 스펙 정의 (검은색 제거 & 신규 크리스탈/실버 디자인)
// ==========================================
const CRATE_TYPES = [
  {
    tier: 0,
    name: '낡은 나무 상자',
    size: 32,
    hp: 25,
    fixedPellets: 1,
    pelletValue: 10,
    pelletTheme: 'amber',
    color: '#b87b44',
    weight: 0.30
  },
  {
    tier: 1,
    name: '튼튼한 목재 보급함',
    size: 36,
    hp: 45,
    fixedPellets: 2,
    pelletValue: 10,
    pelletTheme: 'amber',
    color: '#8d5524',
    weight: 0.24
  },
  {
    tier: 2,
    name: '청동 보급함',
    size: 40,
    hp: 70,
    fixedPellets: 2,
    pelletValue: 20,
    pelletTheme: 'bronze',
    color: '#d84315',
    weight: 0.18
  },
  {
    tier: 3,
    name: '철제 강화 금고',
    size: 46,
    hp: 110,
    fixedPellets: 3,
    pelletValue: 25,
    pelletTheme: 'steel',
    color: '#546e7a',
    weight: 0.12
  },
  {
    tier: 4,
    name: '테크노 실버 컨테이너',
    size: 52,
    hp: 175,
    fixedPellets: 3,
    pelletValue: 40,
    pelletTheme: 'plasma',
    color: '#78909c',
    weight: 0.08
  },
  {
    tier: 5,
    name: '황금 보물 상자',
    size: 58,
    hp: 260,
    fixedPellets: 4,
    pelletValue: 60,
    pelletTheme: 'gold',
    color: '#ffb300',
    weight: 0.05
  },
  {
    tier: 6,
    name: '신비의 크리스탈 프리즘 큐브',
    size: 66,
    hp: 420,
    fixedPellets: 5,
    pelletValue: 100,
    pelletTheme: 'crystal',
    color: '#00e5ff',
    weight: 0.03
  }
];

// 8000x8000 맵에 320개 상자 배치 (상자 밀도 증가 및 무겹침 유지)
const crates = [];
const spawningCrates = []; // 스폰 애니메이션 중인 상자 큐
const TOTAL_CRATES = 320;

function spawnCrate(forceFar = false) {
  const rand = Math.random();
  let tier = 0;
  let accumulated = 0;
  for (let i = 0; i < CRATE_TYPES.length; i++) {
    accumulated += CRATE_TYPES[i].weight;
    if (rand <= accumulated) {
      tier = i;
      break;
    }
  }

  const spec = CRATE_TYPES[tier];
  let x = 0;
  let y = 0;
  let attempts = 0;

  while (attempts < 200) {
    attempts++;
    x = (Math.random() - 0.5) * (ARENA_SIZE - 400);
    y = (Math.random() - 0.5) * (ARENA_SIZE - 400);

    if (forceFar && Math.hypot(x - player.x, y - player.y) < 700) continue;

    // 1. 벽과 겹치는지 검사
    if (checkWallOverlap(x, y, spec.size / 2, 20)) continue;

    // 2. 다른 상자들과 겹치는지 엄격 검사 (상자 간 최소 30px 간격 보장)
    let overlapCrate = false;
    for (let c = 0; c < crates.length; c++) {
      const existing = crates[c];
      const minDist = (spec.size + existing.size) / 2 + 30;
      if (Math.hypot(x - existing.x, y - existing.y) < minDist) {
        overlapCrate = true;
        break;
      }
    }
    if (overlapCrate) continue;

    // 3. 스폰 대기 중인 상자들과도 겹치는지 검사
    for (let c = 0; c < spawningCrates.length; c++) {
      const existing = spawningCrates[c];
      const minDist = (spec.size + existing.size) / 2 + 30;
      if (Math.hypot(x - existing.x, y - existing.y) < minDist) {
        overlapCrate = true;
        break;
      }
    }
    if (overlapCrate) continue;

    // 통과 시 배치 확정
    break;
  }

  return {
    tier: tier,
    spec: spec,
    x: x,
    y: y,
    size: spec.size,
    halfSize: spec.size / 2,
    hp: spec.hp,
    maxHp: spec.hp,
    hitFlash: 0,
    shakeX: 0,
    shakeY: 0,
  };
}

// 상자 스폰 큐에 등록 (애니메이션 포함)
function queueCrateSpawn(forceFar = false) {
  const data = spawnCrate(forceFar);
  // 단계가 높을수록 애니메이션 시간 길어짐
  const maxTimer = 25 + data.tier * 22;
  spawningCrates.push({
    ...data,
    timer: 0,
    maxTimer: maxTimer,
    // 파티클 조립 애니메이션용 오비터들 (Tier 3+)
    orbiters: data.tier >= 3 ? Array.from({ length: 4 + data.tier }, (_, i) => ({
      angle: (Math.PI * 2 * i) / (4 + data.tier),
      dist: 60 + data.tier * 15,
      speed: 0.07 + data.tier * 0.015,
    })) : [],
  });
}

// 초기 상자 배치 (애니메이션 없이 즉시 배치)
for (let i = 0; i < TOTAL_CRATES; i++) {
  crates.push(spawnCrate());
}

// 투사체, 알갱이, 파티클, 텍스트
const bullets = [];
const expPellets = [];
const particles = [];
const floatingTexts = [];

// 재장전
function tryReload() {
  if (player.currentWeapon === 'knife') return; // 칼은 재장전 불필요
  if (player.isReloading || player.ammo >= player.maxAmmo) return;
  player.isReloading = true;
  player.reloadTimer = player.reloadDuration;
  updateAmmoUI();
}

function updateAmmoUI() {
  if (player.currentWeapon === 'knife') {
    currentAmmoEl.textContent = '∞';
    maxAmmoEl.textContent = '∞';
    ammoBarFill.style.width = '100%';
    ammoBarFill.style.background = '#00e676';
    reloadHint.classList.add('hidden');
    return;
  }

  currentAmmoEl.textContent = player.ammo;
  maxAmmoEl.textContent = player.maxAmmo;
  
  if (player.isReloading) {
    const reloadProgress = 1 - (player.reloadTimer / player.reloadDuration);
    ammoBarFill.style.width = `${reloadProgress * 100}%`;
    ammoBarFill.style.background = '#ff5252';
    reloadHint.classList.remove('hidden');
    reloadHint.textContent = `재장전 중... (${(player.reloadTimer / 60).toFixed(1)}s)`;
  } else {
    const ammoPercent = (player.ammo / player.maxAmmo) * 100;
    ammoBarFill.style.width = `${ammoPercent}%`;
    ammoBarFill.style.background = player.ammo <= Math.ceil(player.maxAmmo * 0.3) ? '#ff5252' : '#ffcc00';
    reloadHint.classList.add('hidden');
  }
}

function gainExp(amount) {
  player.exp += amount;
  while (player.exp >= player.maxExp) {
    player.exp -= player.maxExp;
    player.level++;
    player.statPoints++; // 1레벨 상승 시 스탯 포인트 1 획득!

    // 5레벨 주기마다 무기 진화 기회 부여 (5, 10, 15, 20...)
    if (player.level % 5 === 0) {
      player.pendingEvolutions++;
      showEvolutionModal();
      addFloatingText(player.x, player.y - 45, '★ 무기 진화 기회 획득! ★', '#00e5ff');
    }

    player.maxExp = Math.floor(50 * Math.pow(1.25, player.level - 1));
    triggerLevelUp();
  }
  updateExpUI();
  updateStatUI();
}

function updateExpUI() {
  levelDisplay.textContent = `Lv. ${player.level}`;
  const percent = Math.min(100, Math.max(0, (player.exp / player.maxExp) * 100));
  expBarFill.style.width = `${percent}%`;
  expText.textContent = `${player.exp} / ${player.maxExp} EXP`;
}

let noticeTimeout = null;
function triggerLevelUp() {
  if (!levelupNotice) return;
  levelupNotice.classList.remove('hidden');
  levelupNotice.textContent = `LEVEL UP! (Lv. ${player.level})`;
  levelupNotice.style.animation = 'none';
  levelupNotice.offsetHeight;
  levelupNotice.style.animation = 'levelPop 1.2s ease-out forwards';

  clearTimeout(noticeTimeout);
  noticeTimeout = setTimeout(() => {
    levelupNotice.classList.add('hidden');
  }, 1200);

  for (let i = 0; i < 20; i++) {
    const angle = (Math.PI * 2 * i) / 20;
    const speed = 3 + Math.random() * 4;
    particles.push({
      x: player.x,
      y: player.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 3.5 + Math.random() * 3,
      color: ['#00b2e1', '#ff9800', '#ffd700', '#00e5ff'][Math.floor(Math.random() * 4)],
      alpha: 1,
      decay: 0.03,
    });
  }
}

const camera = {
  x: 0,
  y: 0,
  smoothFactor: 0.15,
  update() {
    this.x += (player.x - this.x) * this.smoothFactor;
    this.y += (player.y - this.y) * this.smoothFactor;
  }
};

function spawnSplinters(x, y, color, count = 5) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 3.5;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 2 + Math.random() * 2.5,
      color,
      alpha: 1,
      decay: 0.04 + Math.random() * 0.03,
    });
  }
}

function addFloatingText(x, y, text, color = '#ffffff') {
  floatingTexts.push({
    x,
    y,
    text,
    color,
    alpha: 1,
    vy: -1.0,
    life: 40,
  });
}

function dropExpPellets(x, y, spec) {
  const count = spec.fixedPellets;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2.2 + Math.random() * 2.8;
    expPellets.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      tier: spec.tier,
      theme: spec.pelletTheme,
      value: spec.pelletValue,
      radius: 5 + spec.tier * 0.9,
      pulse: Math.random() * Math.PI * 2,
    });
  }
}

// ==========================================
// 무기 발사 통합 시스템 (5종 무기 특징별 탄환 생성)
// ==========================================
function shootWeapon() {
  if (player.isReloading) return;

  const wType = player.currentWeapon || 'pistol';

  // 칼이 아닌 총기류는 탄약 체크
  if (wType !== 'knife') {
    if (player.ammo <= 0) {
      tryReload();
      return;
    }
    player.ammo--;
    updateAmmoUI();
  }

  const baseAngle = player.angle;
  const dirX = Math.cos(baseAngle);
  const dirY = Math.sin(baseAngle);
  const spawnDist = player.radius + 6;
  const startX = player.x + dirX * spawnDist;
  const startY = player.y + dirY * spawnDist;

  if (wType === 'pistol') {
    // 1. 일반 권총 (단발 고위력 노란 탄환)
    bullets.push({
      weapon: 'pistol',
      x: startX,
      y: startY,
      prevX: startX,
      prevY: startY,
      vx: dirX * player.bulletSpeed + player.vx * 0.2,
      vy: dirY * player.bulletSpeed + player.vy * 0.2,
      radius: 5.5,
      damage: player.bulletDamage,
      life: 55,
      piercing: 1,
    });
    spawnSplinters(startX, startY, '#fff59d', 3);

  } else if (wType === 'rifle') {
    // 2. 연발소총 (초고속 연사 청록 슬림 탄환 + 약간의 반동 분산)
    const spread = (Math.random() - 0.5) * 0.08;
    const finalAngle = baseAngle + spread;
    const rDirX = Math.cos(finalAngle);
    const rDirY = Math.sin(finalAngle);
    bullets.push({
      weapon: 'rifle',
      x: startX,
      y: startY,
      prevX: startX,
      prevY: startY,
      vx: rDirX * player.bulletSpeed + player.vx * 0.15,
      vy: rDirY * player.bulletSpeed + player.vy * 0.15,
      radius: 4.2,
      damage: player.bulletDamage,
      life: 50,
      piercing: 1,
    });
    spawnSplinters(startX, startY, '#80deea', 2);

  } else if (wType === 'shotgun') {
    // 3. 샷건 (부채꼴 6발 펠릿 산탄 확산)
    const pelletCount = 6;
    const spreadArc = 0.42; // 약 24도 각도 분산
    for (let i = 0; i < pelletCount; i++) {
      const offset = ((i / (pelletCount - 1)) - 0.5) * spreadArc + (Math.random() - 0.5) * 0.05;
      const pAngle = baseAngle + offset;
      const pDirX = Math.cos(pAngle);
      const pDirY = Math.sin(pAngle);
      const speedVar = player.bulletSpeed * (0.9 + Math.random() * 0.2);
      bullets.push({
        weapon: 'shotgun',
        x: startX,
        y: startY,
        prevX: startX,
        prevY: startY,
        vx: pDirX * speedVar + player.vx * 0.2,
        vy: pDirY * speedVar + player.vy * 0.2,
        radius: 4.0,
        damage: player.bulletDamage,
        life: 38, // 샷건은 사거리가 짧고 굵음
        piercing: 1,
      });
    }
    spawnSplinters(startX, startY, '#ff8a80', 7);

  } else if (wType === 'sniper') {
    // 4. 저격총 (초고속 대구경 관통 레일탄)
    bullets.push({
      weapon: 'sniper',
      x: startX,
      y: startY,
      prevX: startX,
      prevY: startY,
      vx: dirX * player.bulletSpeed + player.vx * 0.1,
      vy: dirY * player.bulletSpeed + player.vy * 0.1,
      radius: 7.5,
      damage: player.bulletDamage,
      life: 80, // 장거리 사거리
      piercing: 3, // 최대 3개 상자/오브젝트 관통!
      piercedTargets: [],
    });
    spawnSplinters(startX, startY, '#e1bee7', 6);

  } else if (wType === 'knife') {
    // 5. 칼 (에메랄드 초승달 검기 참격파 + 관통)
    player.slashSwingTimer = 10; // 플레이어 몸체에 휘두르기 궤적 표시용
    bullets.push({
      weapon: 'knife',
      x: startX,
      y: startY,
      prevX: startX,
      prevY: startY,
      angle: baseAngle,
      vx: dirX * player.bulletSpeed + player.vx * 0.2,
      vy: dirY * player.bulletSpeed + player.vy * 0.2,
      radius: 14,
      damage: player.bulletDamage,
      life: 30, // 근~중거리 전진형 검기
      piercing: 2, // 다중 적/상자 베어냄
      piercedTargets: [],
    });
    spawnSplinters(startX, startY, '#b9f6ca', 5);
  }

  // 총기류 탄약 소진 시 자동 재장전 시작
  if (wType !== 'knife' && player.ammo <= 0) {
    tryReload();
  }
}

// 원형 vs 사각형(AABB) 충돌 및 미끄러짐 해결 함수
function resolveCircleAABB(circle, boxX, boxY, boxW, boxH) {
  const closestX = Math.max(boxX, Math.min(circle.x, boxX + boxW));
  const closestY = Math.max(boxY, Math.min(circle.y, boxY + boxH));

  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  const distSq = dx * dx + dy * dy;

  if (distSq < circle.radius * circle.radius) {
    const dist = Math.sqrt(distSq);
    if (dist > 0.0001) {
      const overlap = circle.radius - dist;
      const nx = dx / dist;
      const ny = dy / dist;

      circle.x += nx * overlap;
      circle.y += ny * overlap;

      const dot = circle.vx * nx + circle.vy * ny;
      if (dot < 0) {
        circle.vx -= dot * nx;
        circle.vy -= dot * ny;
      }
    } else {
      // 중심점이 완전히 박스 내부에 들어간 경우: 가장 가까운 바깥쪽 면으로 탈출
      const dl = circle.x - boxX;
      const dr = (boxX + boxW) - circle.x;
      const dt = circle.y - boxY;
      const db = (boxY + boxH) - circle.y;
      const minD = Math.min(dl, dr, dt, db);
      if (minD === dl) {
        circle.x = boxX - circle.radius;
        circle.vx = 0;
      } else if (minD === dr) {
        circle.x = boxX + boxW + circle.radius;
        circle.vx = 0;
      } else if (minD === dt) {
        circle.y = boxY - circle.radius;
        circle.vy = 0;
      } else {
        circle.y = boxY + boxH + circle.radius;
        circle.vy = 0;
      }
    }
    return true;
  }
  return false;
}

// 물리 및 게임 상태 업데이트
function update() {
  // 1. 플레이어 이동 (키보드 WASD + 모바일 가상 조이스틱)
  let moveX = 0;
  let moveY = 0;

  if (keys.w) moveY -= 1;
  if (keys.s) moveY += 1;
  if (keys.a) moveX -= 1;
  if (keys.d) moveX += 1;

  // 키보드 대각선 이동 정규화
  if (moveX !== 0 && moveY !== 0) {
    const invLen = 1 / Math.SQRT2;
    moveX *= invLen;
    moveY *= invLen;
  }

  // 모바일 이동 조이스틱 입력 결합
  if (joystickInput.move.active) {
    moveX += joystickInput.move.x;
    moveY += joystickInput.move.y;
    const jDist = Math.hypot(moveX, moveY);
    if (jDist > 1) {
      moveX /= jDist;
      moveY /= jDist;
    }
  }

  player.vx += moveX * player.acceleration;
  player.vy += moveY * player.acceleration;
  player.vx *= player.friction;
  player.vy *= player.friction;

  const speed = Math.hypot(player.vx, player.vy);
  if (speed > player.maxSpeed) {
    player.vx = (player.vx / speed) * player.maxSpeed;
    player.vy = (player.vy / speed) * player.maxSpeed;
  }

  player.x += player.vx;
  player.y += player.vy;

  // 2. 플레이어와 벽(Wall) 물리 충돌 처리 (모든 벽의 길이와 면적을 완벽히 포함)
  for (let i = 0; i < walls.length; i++) {
    const w = walls[i];
    const pad = player.radius + 15;
    if (
      player.x >= w.x - pad &&
      player.x <= w.x + w.w + pad &&
      player.y >= w.y - pad &&
      player.y <= w.y + w.h + pad
    ) {
      resolveCircleAABB(player, w.x, w.y, w.w, w.h);
    }
  }

  // 3. 플레이어와 상자 물리 충돌 처리 (상자에 몸 막힘)
  for (let i = 0; i < crates.length; i++) {
    const c = crates[i];
    if (Math.abs(c.x - player.x) < 160 && Math.abs(c.y - player.y) < 160) {
      resolveCircleAABB(player, c.x - c.halfSize, c.y - c.halfSize, c.size, c.size);
    }
  }

  // 아레나 외곽벽 충돌
  const minPos = -HALF_ARENA + player.radius;
  const maxPos = HALF_ARENA - player.radius;
  player.x = Math.max(minPos, Math.min(maxPos, player.x));
  player.y = Math.max(minPos, Math.min(maxPos, player.y));

  // 플레이어 시선 각도 (모바일 조준 조이스틱 우선, 비활성 시 마우스 각도)
  if (joystickInput.aim.active) {
    player.angle = Math.atan2(joystickInput.aim.y, joystickInput.aim.x);
  } else {
    const screenPlayerX = screenWidth / 2 + (player.x - camera.x);
    const screenPlayerY = screenHeight / 2 + (player.y - camera.y);
    player.angle = Math.atan2(mousePos.y - screenPlayerY, mousePos.x - screenPlayerX);
  }

  // 재장전 타이머 처리
  if (player.isReloading) {
    player.reloadTimer--;
    updateAmmoUI();
    if (player.reloadTimer <= 0) {
      player.isReloading = false;
      player.ammo = player.maxAmmo;
      updateAmmoUI();
    }
  }

  // 플레이어 칼 휘두르기 타이머 감소
  if (player.slashSwingTimer > 0) {
    player.slashSwingTimer--;
  }

  // 발사 처리 (마우스 클릭 또는 모바일 조준 조이스틱이 충분히 당겨졌을 때 자동 사격)
  if (player.fireCooldown > 0) {
    player.fireCooldown--;
  }

  const isAimJoystickFiring = joystickInput.aim.active && Math.hypot(joystickInput.aim.x, joystickInput.aim.y) > 0.35;
  const shouldFire = (isMouseDown || isAimJoystickFiring) && !player.isReloading;

  if (shouldFire && player.fireCooldown <= 0) {
    shootWeapon();
    player.fireCooldown = player.fireInterval;
  }

  // 4. 총알 업데이트 (벽 & 상자 충돌 + 관통 로직)
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.prevX = b.x;
    b.prevY = b.y;
    b.x += b.vx;
    b.y += b.vy;
    b.life--;

    // 사거리 초과나 아레나 외곽선 도달
    if (
      b.life <= 0 ||
      b.x < -HALF_ARENA || b.x > HALF_ARENA ||
      b.y < -HALF_ARENA || b.y > HALF_ARENA
    ) {
      bullets.splice(i, 1);
      continue;
    }

    // 벽에 총알이 막힘
    let hitWall = false;
    for (let wIdx = 0; wIdx < walls.length; wIdx++) {
      const w = walls[wIdx];
      if (
        b.x >= w.x - b.radius &&
        b.x <= w.x + w.w + b.radius &&
        b.y >= w.y - b.radius &&
        b.y <= w.y + w.h + b.radius
      ) {
        spawnSplinters(b.x, b.y, '#9e9e9e', 5);
        bullets.splice(i, 1);
        hitWall = true;
        break;
      }
    }
    if (hitWall) continue;

    // 상자와의 충돌 검사
    let bulletRemoved = false;
    for (let c = 0; c < crates.length; c++) {
      const crate = crates[c];
      const hs = crate.halfSize;
      if (Math.abs(crate.x - b.x) > 100 || Math.abs(crate.y - b.y) > 100) continue;

      // 이미 관통한 상자는 중복 타격 방지
      if (b.piercedTargets && b.piercedTargets.includes(crate)) continue;

      if (
        b.x >= crate.x - hs - b.radius &&
        b.x <= crate.x + hs + b.radius &&
        b.y >= crate.y - hs - b.radius &&
        b.y <= crate.y + hs + b.radius
      ) {
        crate.hp -= b.damage;
        crate.hitFlash = 3;

        crate.shakeX = (Math.random() - 0.5) * 5;
        crate.shakeY = (Math.random() - 0.5) * 5;

        spawnSplinters(b.x, b.y, crate.spec.color, 4);

        if (b.piercedTargets) {
          b.piercedTargets.push(crate);
        }

        if (crate.hp <= 0) {
          spawnSplinters(crate.x, crate.y, crate.spec.color, 14);
          dropExpPellets(crate.x, crate.y, crate.spec);
          crates.splice(c, 1);
          queueCrateSpawn(true);
          c--; // splice 인덱스 보정
        }

        // 관통 횟수 차감
        b.piercing = (b.piercing || 1) - 1;
        if (b.piercing <= 0) {
          bullets.splice(i, 1);
          bulletRemoved = true;
          break;
        }
      }
    }

    if (bulletRemoved) continue;
  }

  // 상자 흔들림 감쇠
  for (let i = 0; i < crates.length; i++) {
    const crate = crates[i];
    if (crate.hitFlash > 0) crate.hitFlash--;
    crate.shakeX *= 0.7;
    crate.shakeY *= 0.7;
  }

  // 5. 경험치 알갱이 업데이트
  for (let i = expPellets.length - 1; i >= 0; i--) {
    const pel = expPellets[i];
    pel.pulse += 0.08;

    pel.vx *= 0.90;
    pel.vy *= 0.90;
    pel.x += pel.vx;
    pel.y += pel.vy;

    for (let wIdx = 0; wIdx < walls.length; wIdx++) {
      const w = walls[wIdx];
      const pad = pel.radius + 8;
      if (
        pel.x >= w.x - pad &&
        pel.x <= w.x + w.w + pad &&
        pel.y >= w.y - pad &&
        pel.y <= w.y + w.h + pad
      ) {
        resolveCircleAABB(pel, w.x, w.y, w.w, w.h);
      }
    }

    const dist = Math.hypot(player.x - pel.x, player.y - pel.y);

    if (dist < player.magnetRadius) {
      const pullAngle = Math.atan2(player.y - pel.y, player.x - pel.x);
      const pullSpeed = 6 + (1 - dist / player.magnetRadius) * 7.5;
      pel.x += Math.cos(pullAngle) * pullSpeed;
      pel.y += Math.sin(pullAngle) * pullSpeed;
    }

    if (dist < player.radius + pel.radius + 6) {
      gainExp(pel.value);
      const floatingColor = pel.theme === 'amber' ? '#ffb74d' : (pel.theme === 'bronze' ? '#ff8a65' : (pel.theme === 'steel' ? '#4dd0e1' : (pel.theme === 'plasma' ? '#00e676' : (pel.theme === 'gold' ? '#ffd54f' : '#00e5ff'))));
      addFloatingText(pel.x, pel.y - 10, `+${pel.value}`, floatingColor);
      spawnSplinters(pel.x, pel.y, floatingColor, 4);
      expPellets.splice(i, 1);
    }
  }

  // 파티클 & 플로팅 텍스트
  for (let i = particles.length - 1; i >= 0; i--) {
    const pt = particles[i];
    pt.x += pt.vx;
    pt.y += pt.vy;
    pt.alpha -= pt.decay;
    if (pt.alpha <= 0) particles.splice(i, 1);
  }

  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    ft.y += ft.vy;
    ft.life--;
    ft.alpha = Math.min(1, ft.life / 15);
    if (ft.life <= 0) floatingTexts.splice(i, 1);
  }

  camera.update();

  // 스폰 애니메이션 큐 업데이트 - 완료된 상자는 활성 목록으로 이동
  for (let i = spawningCrates.length - 1; i >= 0; i--) {
    const sc = spawningCrates[i];
    sc.timer++;
    // 오비터 각도 업데이트 (Tier 3+)
    for (let j = 0; j < sc.orbiters.length; j++) {
      sc.orbiters[j].angle += sc.orbiters[j].speed;
    }
    if (sc.timer >= sc.maxTimer) {
      // 애니메이션 완료 → 실제 상자로 등록
      const { timer, maxTimer, orbiters, ...crateData } = sc;
      crates.push(crateData);
      spawningCrates.splice(i, 1);
    }
  }

  // 상자 수 보충 - 총 개수(활성 + 대기)가 목표치보다 적으면 큐에 추가
  if (crates.length + spawningCrates.length < TOTAL_CRATES) {
    queueCrateSpawn(false);
  }
}

// 렌더링 함수
function draw() {
  ctx.fillStyle = '#b6b6b6';
  ctx.fillRect(0, 0, screenWidth, screenHeight);

  ctx.save();
  ctx.translate(screenWidth / 2 - camera.x, screenHeight / 2 - camera.y);

  // 아레나 바닥
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(-HALF_ARENA, -HALF_ARENA, ARENA_SIZE, ARENA_SIZE);

  // 그리드 라인
  ctx.strokeStyle = '#e2e2e2';
  ctx.lineWidth = 1;
  ctx.beginPath();

  const viewLeft   = Math.max(-HALF_ARENA, camera.x - screenWidth / 2 - GRID_SIZE);
  const viewRight  = Math.min(HALF_ARENA,  camera.x + screenWidth / 2 + GRID_SIZE);
  const viewTop    = Math.max(-HALF_ARENA, camera.y - screenHeight / 2 - GRID_SIZE);
  const viewBottom = Math.min(HALF_ARENA,  camera.y + screenHeight / 2 + GRID_SIZE);

  const startGridX = Math.floor(viewLeft / GRID_SIZE) * GRID_SIZE;
  const startGridY = Math.floor(viewTop / GRID_SIZE) * GRID_SIZE;

  for (let x = startGridX; x <= viewRight; x += GRID_SIZE) {
    if (x >= -HALF_ARENA && x <= HALF_ARENA) {
      ctx.moveTo(x, Math.max(-HALF_ARENA, viewTop));
      ctx.lineTo(x, Math.min(HALF_ARENA, viewBottom));
    }
  }
  for (let y = startGridY; y <= viewBottom; y += GRID_SIZE) {
    if (y >= -HALF_ARENA && y <= HALF_ARENA) {
      ctx.moveTo(Math.max(-HALF_ARENA, viewLeft), y);
      ctx.lineTo(Math.min(HALF_ARENA, viewRight), y);
    }
  }
  ctx.stroke();

  // 아레나 외곽 테두리선
  ctx.strokeStyle = '#606060';
  ctx.lineWidth = 6;
  ctx.strokeRect(-HALF_ARENA, -HALF_ARENA, ARENA_SIZE, ARENA_SIZE);

  // Arrow.io 스타일 벽 렌더링
  drawWalls(viewLeft, viewRight, viewTop, viewBottom);

  // 상자(Crates) 렌더링
  for (let i = 0; i < crates.length; i++) {
    const crate = crates[i];
    if (
      crate.x + crate.size < viewLeft || crate.x - crate.size > viewRight ||
      crate.y + crate.size < viewTop || crate.y - crate.size > viewBottom
    ) continue;
    drawCrate(crate);
  }

  // 스폰 애니메이션 중인 상자 렌더링
  drawSpawningCrates();

  // 경험치 알갱이 렌더링
  for (let i = 0; i < expPellets.length; i++) {
    const pel = expPellets[i];
    if (
      pel.x + 25 < viewLeft || pel.x - 25 > viewRight ||
      pel.y + 25 < viewTop || pel.y - 25 > viewBottom
    ) continue;
    drawExpPellet(pel);
  }

  // 빛나는 총알 렌더링
  for (let i = 0; i < bullets.length; i++) {
    drawGlowingBullet(bullets[i]);
  }

  // 파티클
  for (let i = 0; i < particles.length; i++) {
    const pt = particles[i];
    ctx.save();
    ctx.globalAlpha = Math.max(0, pt.alpha);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 플레이어
  drawPlayer(player);

  // 플로팅 텍스트
  for (let i = 0; i < floatingTexts.length; i++) {
    const ft = floatingTexts[i];
    ctx.save();
    ctx.globalAlpha = Math.max(0, ft.alpha);
    ctx.font = 'bold 13px -apple-system, sans-serif';
    ctx.fillStyle = ft.color;
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 2.5;
    ctx.strokeText(ft.text, ft.x - 10, ft.y);
    ctx.fillText(ft.text, ft.x - 10, ft.y);
    ctx.restore();
  }

  ctx.restore();

  // 대형 맵 미니맵 레이더
  drawMinimap();
}

// 스폰 애니메이션 렌더링 (단계별 연출)
function drawSpawningCrates() {
  for (let i = 0; i < spawningCrates.length; i++) {
    const sc = spawningCrates[i];
    const p = sc.timer / sc.maxTimer; // 진행도 0 → 1
    const x = sc.x;
    const y = sc.y;
    const s = sc.size;
    const hs = s / 2;

    ctx.save();
    ctx.translate(x, y);

    if (sc.tier === 0) {
      // ─── Tier 0: 단순 스케일 팝인 ───
      const scale = p < 0.7 ? p / 0.7 : 1 + Math.sin((p - 0.7) / 0.3 * Math.PI) * 0.08;
      ctx.globalAlpha = p;
      ctx.scale(scale, scale);
      ctx.fillStyle = '#b87b44';
      ctx.fillRect(-hs, -hs, s, s);
      ctx.strokeStyle = '#3e3e3e';
      ctx.lineWidth = 3;
      ctx.strokeRect(-hs, -hs, s, s);

    } else if (sc.tier === 1) {
      // ─── Tier 1: 페이드 + 스케일 팝 ───
      const scale = 0.3 + p * 0.7 + (p > 0.8 ? Math.sin((p - 0.8) / 0.2 * Math.PI) * 0.1 : 0);
      ctx.globalAlpha = p * p;
      ctx.scale(scale, scale);
      ctx.fillStyle = '#8d5524';
      ctx.fillRect(-hs, -hs, s, s);
      ctx.fillStyle = '#455a64';
      ctx.fillRect(-4, -hs, 8, s);
      ctx.strokeStyle = '#3e3e3e';
      ctx.lineWidth = 3;
      ctx.strokeRect(-hs, -hs, s, s);

    } else if (sc.tier === 2) {
      // ─── Tier 2: 4방향 조각이 날아와 조립되는 연출 ───
      ctx.globalAlpha = p;
      const dirs = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
      for (let d = 0; d < 4; d++) {
        const offset = (1 - p) * 40;
        const px = dirs[d][0] * (hs * 0.5 + offset);
        const py = dirs[d][1] * (hs * 0.5 + offset);
        ctx.fillStyle = '#d84315';
        ctx.fillRect(px - hs * 0.5, py - hs * 0.5, hs, hs);
        ctx.strokeStyle = '#3e3e3e';
        ctx.lineWidth = 2;
        ctx.strokeRect(px - hs * 0.5, py - hs * 0.5, hs, hs);
      }
      // 중앙 코어 나타남
      if (p > 0.6) {
        const cp = (p - 0.6) / 0.4;
        ctx.globalAlpha = cp;
        ctx.fillStyle = '#ff7043';
        ctx.beginPath();
        ctx.moveTo(0, -(hs - 7) * cp); ctx.lineTo((hs - 7) * cp, 0); ctx.lineTo(0, (hs - 7) * cp); ctx.lineTo(-(hs - 7) * cp, 0);
        ctx.closePath();
        ctx.fill();
      }

    } else if (sc.tier === 3) {
      // ─── Tier 3: 에너지 링 수축 + 조립 ───
      // 에너지 링들이 수축하며 중심으로 모임
      for (let ring = 0; ring < 3; ring++) {
        const ringP = Math.max(0, p - ring * 0.15);
        const r = hs * 2 * (1 - ringP * 0.75);
        ctx.globalAlpha = ringP * 0.5;
        ctx.strokeStyle = '#00e676';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      // 본체 출현
      if (p > 0.5) {
        const bp = (p - 0.5) / 0.5;
        ctx.globalAlpha = bp;
        const scale = 0.5 + bp * 0.5;
        ctx.scale(scale, scale);
        ctx.fillStyle = '#546e7a';
        ctx.fillRect(-hs, -hs, s, s);
        ctx.fillStyle = '#37474f';
        ctx.fillRect(-hs + 4.5, -hs + 4.5, s - 9, s - 9);
        ctx.fillStyle = '#607d8b';
        ctx.fillRect(-4, -hs + 4.5, 8, s - 9);
        ctx.fillRect(-hs + 4.5, -4, s - 9, 8);
        ctx.strokeStyle = '#3e3e3e';
        ctx.lineWidth = 3;
        ctx.strokeRect(-hs, -hs, s, s);
      }

    } else if (sc.tier === 4) {
      // ─── Tier 4: 오비터 파티클 소용돌이 → 중심 응집 ───
      // 오비터들이 나선형으로 수축
      ctx.globalAlpha = 1;
      for (let j = 0; j < sc.orbiters.length; j++) {
        const orb = sc.orbiters[j];
        const shrink = 1 - p * 0.85;
        const r = orb.dist * shrink;
        const ox = Math.cos(orb.angle) * r;
        const oy = Math.sin(orb.angle) * r;
        ctx.fillStyle = '#ff9800';
        ctx.globalAlpha = p * 0.8;
        ctx.beginPath();
        ctx.arc(ox, oy, 4 + (1 - shrink) * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      // 외곽 에너지 링
      ctx.globalAlpha = (1 - p) * 0.6;
      ctx.strokeStyle = '#ff9800';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ff9800';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(0, 0, hs * 2 * (1 - p * 0.5), 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      // 본체 출현
      if (p > 0.45) {
        const bp = (p - 0.45) / 0.55;
        ctx.globalAlpha = bp;
        ctx.scale(0.4 + bp * 0.6, 0.4 + bp * 0.6);
        ctx.fillStyle = '#78909c';
        ctx.fillRect(-hs, -hs, s, s);
        ctx.fillStyle = '#90a4ae';
        ctx.fillRect(-hs + 4.5, -hs + 4.5, s - 9, s - 9);
        ctx.fillStyle = '#ff9800';
        ctx.fillRect(-hs + 8, -3, s - 16, 6);
        ctx.strokeStyle = '#3e3e3e';
        ctx.lineWidth = 3;
        ctx.strokeRect(-hs, -hs, s, s);
      }

    } else if (sc.tier === 5) {
      // ─── Tier 5: 황금빛 충격파 + 별 파티클 조립 ───
      // 충격파 링 외부에서 수축
      const shockR = hs * 3 * (1 - p);
      ctx.globalAlpha = (1 - p) * 0.7;
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(0, 0, shockR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 황금 오비터 파티클
      for (let j = 0; j < sc.orbiters.length; j++) {
        const orb = sc.orbiters[j];
        const shrink = 1 - p * 0.9;
        const r = orb.dist * shrink;
        const ox = Math.cos(orb.angle) * r;
        const oy = Math.sin(orb.angle) * r;
        ctx.globalAlpha = p * 0.9;
        ctx.fillStyle = '#ffd700';
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        // 다이아 형태 미니 샤드
        ctx.moveTo(ox, oy - 5); ctx.lineTo(ox + 4, oy); ctx.lineTo(ox, oy + 5); ctx.lineTo(ox - 4, oy);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      // 본체 출현
      if (p > 0.4) {
        const bp = (p - 0.4) / 0.6;
        ctx.globalAlpha = bp;
        ctx.scale(0.3 + bp * 0.7, 0.3 + bp * 0.7);
        ctx.fillStyle = '#ffb300';
        ctx.fillRect(-hs, -hs, s, s);
        ctx.fillStyle = '#ffd54f';
        ctx.fillRect(-hs + 5, -hs + 5, s - 10, s - 10);
        ctx.fillStyle = '#ff8f00';
        ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#3e3e3e';
        ctx.lineWidth = 3;
        ctx.strokeRect(-hs, -hs, s, s);
      }

    } else {
      // ─── Tier 6: 보이드 오라 + 파편 소용돌이 + 완성 충격파 ───
      // 외곽 보이드 에너지장
      const auraR = hs * 3.5 * (1 - p * 0.6);
      ctx.globalAlpha = (1 - p) * 0.4;
      const auraGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, auraR);
      auraGrad.addColorStop(0, 'rgba(0,229,255,0.5)');
      auraGrad.addColorStop(1, 'rgba(0,229,255,0)');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(0, 0, auraR, 0, Math.PI * 2);
      ctx.fill();

      // 크리스탈 파편 오비터 (나선형 수축)
      for (let j = 0; j < sc.orbiters.length; j++) {
        const orb = sc.orbiters[j];
        const shrink = 1 - p * 0.92;
        const r = orb.dist * shrink;
        const ox = Math.cos(orb.angle) * r;
        const oy = Math.sin(orb.angle) * r;
        const alpha = p * (0.5 + shrink * 0.5);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#00e5ff';
        ctx.shadowColor = '#00e5ff';
        ctx.shadowBlur = 12;
        // 작은 육각형 샤드
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k * Math.PI) / 3 + orb.angle * 0.3;
          const kx = ox + Math.cos(a) * 5;
          const ky = oy + Math.sin(a) * 5;
          if (k === 0) ctx.moveTo(kx, ky); else ctx.lineTo(kx, ky);
        }
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // 다중 에너지 링
      for (let ring = 0; ring < 4; ring++) {
        const rp = Math.max(0, p * 1.5 - ring * 0.2);
        const ringR = hs * (2.8 - ring * 0.4) * (1 - p * 0.8);
        if (ringR < 0) continue;
        ctx.globalAlpha = Math.min(1, rp) * 0.6;
        ctx.strokeStyle = ring % 2 === 0 ? '#00e5ff' : '#7c4dff';
        ctx.lineWidth = 2;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 0, ringR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // 본체 출현
      if (p > 0.35) {
        const bp = (p - 0.35) / 0.65;
        ctx.globalAlpha = bp;
        const scale = 0.2 + bp * 0.8;
        ctx.scale(scale, scale);
        ctx.fillStyle = '#eceff1';
        ctx.fillRect(-hs, -hs, s, s);
        ctx.strokeStyle = '#00bcd4';
        ctx.lineWidth = 3.5;
        ctx.strokeRect(-hs, -hs, s, s);
        ctx.fillStyle = '#b3e5fc';
        ctx.fillRect(-hs + 5.5, -hs + 5.5, s - 11, s - 11);
        const pulse = 0.85 + Math.sin(Date.now() * 0.007) * 0.15;
        ctx.shadowColor = '#00e5ff';
        ctx.shadowBlur = 20;
        ctx.fillStyle = '#00e5ff';
        ctx.beginPath();
        ctx.arc(0, 0, 11 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // 완성 충격파 (p가 0.95 이상일 때)
        if (bp > 0.9) {
          const waveProg = (bp - 0.9) / 0.1;
          ctx.scale(1 / scale, 1 / scale); // 스케일 취소
          ctx.globalAlpha = (1 - waveProg) * 0.8;
          ctx.strokeStyle = '#00e5ff';
          ctx.lineWidth = 4;
          ctx.shadowColor = '#00e5ff';
          ctx.shadowBlur = 25;
          ctx.beginPath();
          ctx.arc(0, 0, hs * (1 + waveProg * 1.5), 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }
    }

    ctx.restore();
  }
}

// Arrow.io 벽 렌더링
function drawWalls(viewLeft, viewRight, viewTop, viewBottom) {
  const depth = 14;

  // 그림자
  ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
  for (let i = 0; i < walls.length; i++) {
    const w = walls[i];
    if (w.x + w.w < viewLeft || w.x > viewRight || w.y + w.h + depth < viewTop || w.y > viewBottom) continue;
    ctx.fillRect(w.x + 5, w.y + depth, w.w, w.h);
  }

  // 전면 어두운 돌출부
  ctx.fillStyle = '#393a43';
  ctx.strokeStyle = '#282830';
  ctx.lineWidth = 2;
  for (let i = 0; i < walls.length; i++) {
    const w = walls[i];
    if (w.x + w.w < viewLeft || w.x > viewRight || w.y + w.h + depth < viewTop || w.y > viewBottom) continue;
    ctx.fillRect(w.x, w.y + w.h, w.w, depth);
    ctx.strokeRect(w.x, w.y + w.h, w.w, depth);
  }

  // 상단면
  ctx.fillStyle = '#5c5d66';
  ctx.strokeStyle = '#2b2c32';
  ctx.lineWidth = 2.5;
  for (let i = 0; i < walls.length; i++) {
    const w = walls[i];
    if (w.x + w.w < viewLeft || w.x > viewRight || w.y + w.h < viewTop || w.y > viewBottom) continue;
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.strokeRect(w.x, w.y, w.w, w.h);
  }
}

// 상자 디자인 렌더링 (리디자인된 7단계 상자)
function drawCrate(crate) {
  const drawX = crate.x + crate.shakeX;
  const drawY = crate.y + crate.shakeY;
  const s = crate.size;
  const hs = s / 2;

  ctx.save();
  ctx.translate(drawX, drawY);

  if (crate.hitFlash > 0) {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#444444';
    ctx.lineWidth = 3;
    ctx.fillRect(-hs, -hs, s, s);
    ctx.strokeRect(-hs, -hs, s, s);
    ctx.restore();
    return;
  }

  ctx.lineWidth = 3;
  ctx.strokeStyle = '#3e3e3e';

  if (crate.tier === 0) {
    // [Tier 0] 낡은 나무 상자
    ctx.fillStyle = '#b87b44';
    ctx.fillRect(-hs, -hs, s, s);
    ctx.strokeRect(-hs, -hs, s, s);

    ctx.fillStyle = '#9b6332';
    const inset = 3.5;
    ctx.fillRect(-hs + inset, -hs + inset, s - inset * 2, s - inset * 2);

    ctx.strokeStyle = '#b87b44';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-hs + inset, -hs + inset);
    ctx.lineTo(hs - inset, hs - inset);
    ctx.moveTo(hs - inset, -hs + inset);
    ctx.lineTo(-hs + inset, hs - inset);
    ctx.stroke();

  } else if (crate.tier === 1) {
    // [Tier 1] 튼튼한 목재 보급함
    ctx.fillStyle = '#8d5524';
    ctx.fillRect(-hs, -hs, s, s);
    ctx.strokeRect(-hs, -hs, s, s);

    ctx.fillStyle = '#6d3f18';
    const inset = 3.5;
    ctx.fillRect(-hs + inset, -hs + inset, s - inset * 2, s - inset * 2);

    ctx.fillStyle = '#455a64';
    ctx.fillRect(-4, -hs, 8, s);

  } else if (crate.tier === 2) {
    // [Tier 2] 청동 보급함
    ctx.fillStyle = '#d84315';
    ctx.fillRect(-hs, -hs, s, s);
    ctx.strokeRect(-hs, -hs, s, s);

    ctx.fillStyle = '#bf360c';
    const inset = 4;
    ctx.fillRect(-hs + inset, -hs + inset, s - inset * 2, s - inset * 2);

    ctx.fillStyle = '#ff7043';
    ctx.beginPath();
    ctx.moveTo(0, -hs + 7); ctx.lineTo(hs - 7, 0); ctx.lineTo(0, hs - 7); ctx.lineTo(-hs + 7, 0);
    ctx.closePath();
    ctx.fill();

  } else if (crate.tier === 3) {
    // [Tier 3] 철제 강화 금고
    ctx.fillStyle = '#546e7a';
    ctx.fillRect(-hs, -hs, s, s);
    ctx.strokeRect(-hs, -hs, s, s);

    ctx.fillStyle = '#37474f';
    const inset = 4.5;
    ctx.fillRect(-hs + inset, -hs + inset, s - inset * 2, s - inset * 2);

    ctx.fillStyle = '#607d8b';
    const crossW = 8;
    ctx.fillRect(-crossW / 2, -hs + inset, crossW, s - inset * 2);
    ctx.fillRect(-hs + inset, -crossW / 2, s - inset * 2, crossW);

  } else if (crate.tier === 4) {
    // [Tier 4] 테크노 실버 컨테이너 (산뜻한 실버 메탈 + 오렌지 코어)
    ctx.fillStyle = '#78909c';
    ctx.fillRect(-hs, -hs, s, s);
    ctx.strokeRect(-hs, -hs, s, s);

    ctx.fillStyle = '#90a4ae';
    const inset = 4.5;
    ctx.fillRect(-hs + inset, -hs + inset, s - inset * 2, s - inset * 2);

    ctx.fillStyle = '#ff9800';
    ctx.fillRect(-hs + 8, -3, s - 16, 6);

  } else if (crate.tier === 5) {
    // [Tier 5] 황금 보물 상자
    ctx.fillStyle = '#ffb300';
    ctx.fillRect(-hs, -hs, s, s);
    ctx.strokeRect(-hs, -hs, s, s);

    ctx.fillStyle = '#ffd54f';
    const inset = 5;
    ctx.fillRect(-hs + inset, -hs + inset, s - inset * 2, s - inset * 2);

    ctx.fillStyle = '#ff8f00';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#e65100';
    const gSize = 7;
    ctx.fillRect(-hs, -hs, gSize, gSize);
    ctx.fillRect(hs - gSize, -hs, gSize, gSize);
    ctx.fillRect(-hs, hs - gSize, gSize, gSize);
    ctx.fillRect(hs - gSize, hs - gSize, gSize, gSize);

  } else {
    // [Tier 6] 신비의 크리스탈 프리즘 큐브 (기존 검은색 탈피: 플래티넘 화이트 & 사파이어 다이아몬드)
    ctx.fillStyle = '#eceff1'; // 백금/화이트 프레임
    ctx.fillRect(-hs, -hs, s, s);
    ctx.strokeStyle = '#00bcd4';
    ctx.lineWidth = 3.5;
    ctx.strokeRect(-hs, -hs, s, s);

    // 내부 반투명 크리스탈 챔버
    ctx.fillStyle = '#b3e5fc';
    const inset = 5.5;
    ctx.fillRect(-hs + inset, -hs + inset, s - inset * 2, s - inset * 2);

    // 중앙 찬란한 크리스탈 코어
    const pulse = 0.85 + Math.sin(Date.now() * 0.007) * 0.15;
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#00e5ff';
    ctx.beginPath();
    ctx.arc(0, 0, 11 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 코너 사파이어 주얼
    ctx.fillStyle = '#0288d1';
    const cSize = 7;
    ctx.fillRect(-hs, -hs, cSize, cSize);
    ctx.fillRect(hs - cSize, -hs, cSize, cSize);
    ctx.fillRect(-hs, hs - cSize, cSize, cSize);
    ctx.fillRect(hs - cSize, hs - cSize, cSize, cSize);
  }

  // 상자 체력바
  if (crate.hp < crate.maxHp) {
    const barWidth = s + 4;
    const barHeight = 4.5;
    const barX = -barWidth / 2;
    const barY = -hs - 10;

    ctx.fillStyle = '#222222';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    const hpRatio = Math.max(0, crate.hp / crate.maxHp);
    ctx.fillStyle = '#00e676';
    ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);

    ctx.strokeStyle = '#444444';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
  }

  ctx.restore();
}

// 경험치 알갱이 렌더링
function drawExpPellet(pel) {
  ctx.save();
  ctx.translate(pel.x, pel.y);

  const scale = 1 + Math.sin(pel.pulse) * 0.1;
  ctx.scale(scale, scale);

  ctx.lineWidth = 2;
  ctx.strokeStyle = '#333333';

  if (pel.theme === 'amber') {
    ctx.fillStyle = '#ff9800';
    ctx.beginPath();
    ctx.ellipse(0, 0, pel.radius * 0.85, pel.radius * 1.15, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffe082';
    ctx.beginPath();
    ctx.arc(-1.5, -2, pel.radius * 0.35, 0, Math.PI * 2);
    ctx.fill();

  } else if (pel.theme === 'bronze') {
    const s = pel.radius * 1.2;
    ctx.rotate(pel.pulse * 0.5);
    ctx.fillStyle = '#ff7043';
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.strokeRect(-s / 2, -s / 2, s, s);

  } else if (pel.theme === 'steel') {
    const w = pel.radius * 0.9;
    const h = pel.radius * 1.6;
    ctx.fillStyle = '#00e5ff';
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 4);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();

  } else if (pel.theme === 'plasma') {
    const r = pel.radius * 1.1;
    ctx.fillStyle = '#ff9800';
    ctx.shadowColor = '#ff9800';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();

    ctx.fillStyle = '#ffe0b2';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
    ctx.fill();

  } else if (pel.theme === 'gold') {
    const r = pel.radius * 1.3;
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.moveTo(0, -r); ctx.lineTo(r * 0.65, 0); ctx.lineTo(0, r); ctx.lineTo(-r * 0.65, 0);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();

  } else {
    // 크리스탈 큐브 전용 다이아몬드 사파이어 샤드
    const r = pel.radius * 1.35;
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#00e5ff';
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// 무기별 탄환 렌더링 (권총, 소총, 샷건, 저격총, 칼)
function drawGlowingBullet(b) {
  ctx.save();
  const angle = Math.atan2(b.vy, b.vx);
  const w = b.weapon || 'pistol';

  if (w === 'pistol') {
    // 1. 일반 권총: 노란 구형 탄환 + 부드러운 궤적
    const tailLength = 18;
    const tailX = b.x - Math.cos(angle) * tailLength;
    const tailY = b.y - Math.sin(angle) * tailLength;

    const grad = ctx.createLinearGradient(b.x, b.y, tailX, tailY);
    grad.addColorStop(0, 'rgba(255, 235, 59, 0.9)');
    grad.addColorStop(1, 'rgba(255, 193, 7, 0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = b.radius * 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(tailX, tailY);
    ctx.stroke();

    ctx.shadowColor = 'rgba(255, 215, 0, 0.95)';
    ctx.shadowBlur = 10;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#444';
    const bulletGrad = ctx.createRadialGradient(b.x - 1, b.y - 1, 0, b.x, b.y, b.radius);
    bulletGrad.addColorStop(0, '#ffffff');
    bulletGrad.addColorStop(0.5, '#fff176');
    bulletGrad.addColorStop(1, '#ffb300');
    ctx.fillStyle = bulletGrad;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

  } else if (w === 'rifle') {
    // 2. 연발소총: 날렵한 청록색 에너지 슬러그 + 직선 빔 궤적
    const tailLength = 24;
    const tailX = b.x - Math.cos(angle) * tailLength;
    const tailY = b.y - Math.sin(angle) * tailLength;

    ctx.strokeStyle = 'rgba(0, 229, 255, 0.5)';
    ctx.lineWidth = b.radius * 2;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(tailX, tailY);
    ctx.stroke();

    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#00838f';
    ctx.lineWidth = 1.5;
    ctx.translate(b.x, b.y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.roundRect(-b.radius * 1.6, -b.radius * 0.7, b.radius * 3.2, b.radius * 1.4, 3);
    ctx.fill();
    ctx.stroke();

  } else if (w === 'shotgun') {
    // 3. 샷건: 주황/붉은 산탄 불꽃 펠릿
    ctx.shadowColor = '#ff5722';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ff7043';
    ctx.strokeStyle = '#d84315';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffe0b2';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius * 0.45, 0, Math.PI * 2);
    ctx.fill();

  } else if (w === 'sniper') {
    // 4. 저격총: 강력한 보라색 대구경 레일 관통탄 + 번개 에너지 링
    const tailLength = 45;
    const tailX = b.x - Math.cos(angle) * tailLength;
    const tailY = b.y - Math.sin(angle) * tailLength;

    const grad = ctx.createLinearGradient(b.x, b.y, tailX, tailY);
    grad.addColorStop(0, 'rgba(186, 104, 200, 0.95)');
    grad.addColorStop(1, 'rgba(123, 31, 162, 0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = b.radius * 1.8;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(tailX, tailY);
    ctx.stroke();

    ctx.shadowColor = '#ba68c8';
    ctx.shadowBlur = 18;
    ctx.translate(b.x, b.y);
    ctx.rotate(angle);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#4a148c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-b.radius * 2, -b.radius * 0.7, b.radius * 4, b.radius * 1.4, 4);
    ctx.fill();
    ctx.stroke();

  } else if (w === 'knife') {
    // 5. 칼: 에메랄드빛 찬란한 초승달 검기 (반달 아크 참격파)
    ctx.translate(b.x, b.y);
    ctx.rotate(angle);
    ctx.shadowColor = '#00e676';
    ctx.shadowBlur = 16;

    // 검기 외부 발광
    ctx.fillStyle = 'rgba(0, 230, 118, 0.85)';
    ctx.strokeStyle = '#1b5e20';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    // 호 모양 초승달 패스
    ctx.arc(0, 0, 20, -Math.PI * 0.45, Math.PI * 0.45, false);
    ctx.quadraticCurveTo(8, 0, 0, -20 * Math.sin(Math.PI * 0.45));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 검기 중심 백색 코어
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(4, 0, 16, -Math.PI * 0.35, Math.PI * 0.35, false);
    ctx.quadraticCurveTo(9, 0, 4, -16 * Math.sin(Math.PI * 0.35));
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

// 플레이어 렌더링 (원형 본체 + 머리 위 체력바 & 재장전 게이지)
function drawPlayer(p) {
  ctx.save();
  ctx.translate(p.x, p.y);

  // 플레이어 원형 몸체
  ctx.lineWidth = p.strokeWidth;
  ctx.strokeStyle = p.strokeColor;
  ctx.fillStyle = p.bodyColor;
  ctx.beginPath();
  ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 머리 위 체력바 (HP Bar - 체력 스탯을 찍을 때마다 길이가 확실하게 늘어남)
  const hpBarW = 34 + p.stats.hp * 6; // 레벨 0: 34px -> 레벨 7: 76px
  const hpBarH = 4.5;
  const hpY = p.isReloading ? -p.radius - 18 : -p.radius - 12;

  ctx.fillStyle = '#222222';
  ctx.fillRect(-hpBarW / 2, hpY, hpBarW, hpBarH);

  const hpRatio = Math.max(0, p.hp / p.maxHp);
  ctx.fillStyle = hpRatio > 0.5 ? '#00e676' : (hpRatio > 0.25 ? '#ffd600' : '#ff5252');
  ctx.fillRect(-hpBarW / 2, hpY, hpBarW * hpRatio, hpBarH);

  ctx.strokeStyle = '#444444';
  ctx.lineWidth = 1;
  ctx.strokeRect(-hpBarW / 2, hpY, hpBarW, hpBarH);

  // 재장전 게이지 (재장전 중일 때 체력바 아래/위 정돈)
  if (p.isReloading) {
    const barW = 32;
    const barH = 3.5;
    const progress = 1 - (p.reloadTimer / p.reloadDuration);
    const reloadY = -p.radius - 12;

    ctx.fillStyle = 'rgba(20, 20, 20, 0.85)';
    ctx.fillRect(-barW / 2, reloadY, barW, barH);

    ctx.fillStyle = '#ff5252';
    ctx.fillRect(-barW / 2, reloadY, barW * progress, barH);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-barW / 2, reloadY, barW, barH);
  }

  ctx.restore();
}

// 8000x8000 초대형 맵 미니맵
function drawMinimap() {
  const mapSize = 110;
  const padding = 16;
  const mapX = screenWidth - mapSize - padding;
  const mapY = padding;

  ctx.save();
  ctx.fillStyle = 'rgba(22, 24, 28, 0.75)';
  ctx.strokeStyle = '#444444';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(mapX, mapY, mapSize, mapSize, 6);
  ctx.fill();
  ctx.stroke();

  // 플레이어 점 표시
  const pNormX = (player.x + HALF_ARENA) / ARENA_SIZE;
  const pNormY = (player.y + HALF_ARENA) / ARENA_SIZE;
  const dotX = mapX + pNormX * mapSize;
  const dotY = mapY + pNormY * mapSize;

  ctx.fillStyle = '#00b2e1';
  ctx.beginPath();
  ctx.arc(dotX, dotY, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// 초기 세팅
updateExpUI();
updateAmmoUI();
updateStatUI();

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
