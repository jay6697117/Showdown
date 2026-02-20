# Showdown — 荒野决斗复刻版 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 按设计方案交付一个可玩的 Showdown MVP：先跑通单机 + AI 完整对局，再叠加 WebRTC 联网、房间大厅、结算与打磨。  
**Architecture:** 采用 `client/server/shared` 三层 monorepo，先把规则做成可测试的纯逻辑模块（移动、伤害、毒圈、掉落、胜负），再接入 Phaser 场景与网络同步。网络采用 Host 权威模型：非 Host 只发输入，Host 20 tick/s 广播快照，客户端做插值与本地预测修正。  
**Tech Stack:** TypeScript, Phaser 3, Vite, Node.js, ws, WebRTC DataChannel, Vitest, ESLint, npm workspaces

---

## 执行约束（先读）

- 必用技能：`@using-git-worktrees` `@test-driven-development` `@systematic-debugging` `@verification-before-completion`
- 任务节奏：每个 Task 一个小目标，先写失败测试，再最小实现，再跑通过，再提交
- 代码原则：DRY、YAGNI、无 `as any`、无 `@ts-ignore`
- 提交频率：每个 Task 一次原子提交，提交信息写清楚动机（why）

## Preflight（一次性准备）

1. 创建隔离工作区（必须）

```bash
git worktree add ../Showdown-mvp feature/showdown-mvp
```

Expected: 输出新 worktree 路径，无错误。

2. 进入新工作区并初始化根目录 npm workspace

```bash
npm init -y
```

Expected: 根目录生成 `package.json`。

3. 建立顶层脚本（后续命令都依赖这些脚本）

```json
{
  "name": "showdown",
  "private": true,
  "workspaces": ["client", "server", "shared"],
  "scripts": {
    "dev:client": "npm run dev -w client",
    "dev:server": "npm run dev -w server",
    "test": "npm run test -ws",
    "typecheck": "npm run typecheck -ws",
    "build": "npm run build -ws",
    "lint": "npm run lint -ws"
  }
}
```

Expected: 后续 `npm run test`、`npm run typecheck`、`npm run build` 可直接调用。

---

### Task 1: Shared 协议与常量基线

**Files:**
- Create: `shared/package.json`
- Create: `shared/tsconfig.json`
- Create: `shared/src/constants.ts`
- Create: `shared/src/types.ts`
- Create: `shared/src/protocol.ts`
- Test: `shared/src/__tests__/protocol.spec.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { encodeInputPacket, decodeInputPacket, GAME_TICK_RATE } from "../protocol";

describe("protocol", () => {
  it("encodes/decodes input packets symmetrically", () => {
    const input = { seq: 1, dx: 1, dy: 0, attack: true, skill: false, aimX: 200, aimY: 180 };
    const encoded = encodeInputPacket(input);
    expect(decodeInputPacket(encoded)).toEqual(input);
  });

  it("uses 20 tick authoritative rate", () => {
    expect(GAME_TICK_RATE).toBe(20);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -w shared -- protocol.spec.ts -t "protocol"`  
Expected: FAIL with `Cannot find module '../protocol'` or missing export errors.

**Step 3: Write minimal implementation**

```ts
export const GAME_TICK_RATE = 20;

export type InputPacket = {
  seq: number;
  dx: number;
  dy: number;
  attack: boolean;
  skill: boolean;
  aimX: number;
  aimY: number;
};

export function encodeInputPacket(input: InputPacket): string {
  return JSON.stringify(input);
}

export function decodeInputPacket(raw: string): InputPacket {
  return JSON.parse(raw) as InputPacket;
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -w shared -- protocol.spec.ts -t "protocol"`  
Expected: PASS, 2 tests passed.

**Step 5: Commit**

```bash
git add shared package.json
git commit -m "feat(shared): establish protocol and tick-rate baseline"
```

---

### Task 2: Client 启动骨架（Phaser 场景流）

**Files:**
- Create: `client/package.json`
- Create: `client/tsconfig.json`
- Create: `client/vite.config.ts`
- Create: `client/index.html`
- Create: `client/src/main.ts`
- Create: `client/src/config.ts`
- Create: `client/src/scenes/MainMenu.ts`
- Create: `client/src/scenes/Lobby.ts`
- Create: `client/src/scenes/Game.ts`
- Create: `client/src/scenes/Result.ts`
- Test: `client/src/__tests__/config.spec.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { createGameConfig } from "../config";

describe("createGameConfig", () => {
  it("uses 1280x1280 camera world and 4 scenes", () => {
    const config = createGameConfig();
    expect(config.width).toBe(1280);
    expect(config.height).toBe(1280);
    expect(config.scene).toHaveLength(4);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -w client -- config.spec.ts -t "createGameConfig"`  
Expected: FAIL with `Cannot find module '../config'`.

**Step 3: Write minimal implementation**

```ts
import Phaser from "phaser";
import { MainMenu } from "./scenes/MainMenu";
import { Lobby } from "./scenes/Lobby";
import { Game } from "./scenes/Game";
import { Result } from "./scenes/Result";

export function createGameConfig(): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    width: 1280,
    height: 1280,
    scene: [MainMenu, Lobby, Game, Result],
    physics: { default: "arcade", arcade: { debug: false } }
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -w client -- config.spec.ts -t "createGameConfig"`  
Expected: PASS, scene pipeline test passes.

**Step 5: Commit**

```bash
git add client
git commit -m "feat(client): bootstrap Phaser scene pipeline"
```

---

### Task 3: 核心战斗循环（移动 + 弹药 + 子弹）

**Files:**
- Create: `client/src/entities/Player.ts`
- Create: `client/src/entities/Bullet.ts`
- Create: `client/src/systems/InputManager.ts`
- Create: `client/src/systems/CombatSystem.ts`
- Modify: `client/src/scenes/Game.ts`
- Test: `client/src/systems/__tests__/combat.spec.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { regenAmmo, consumeAmmo } from "../CombatSystem";

describe("CombatSystem ammo", () => {
  it("regenerates one ammo every 2 seconds up to 3", () => {
    expect(regenAmmo({ ammo: 1, elapsedMs: 2000 })).toBe(2);
    expect(regenAmmo({ ammo: 3, elapsedMs: 4000 })).toBe(3);
  });

  it("consumes one ammo on attack", () => {
    expect(consumeAmmo(3)).toBe(2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -w client -- combat.spec.ts -t "CombatSystem ammo"`  
Expected: FAIL with missing exports.

**Step 3: Write minimal implementation**

```ts
export function regenAmmo(params: { ammo: number; elapsedMs: number }): number {
  const recovered = Math.floor(params.elapsedMs / 2000);
  return Math.min(3, params.ammo + recovered);
}

export function consumeAmmo(currentAmmo: number): number {
  return Math.max(0, currentAmmo - 1);
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -w client -- combat.spec.ts -t "CombatSystem ammo"`  
Expected: PASS.

**Step 5: Commit**

```bash
git add client/src/entities client/src/systems client/src/scenes/Game.ts
git commit -m "feat(gameplay): add movement and ammo combat loop"
```

---

### Task 4: 地图交互（箱子、能量块、毒圈）

**Files:**
- Create: `client/src/entities/Crate.ts`
- Create: `client/src/entities/PowerCube.ts`
- Create: `client/src/systems/ZoneManager.ts`
- Modify: `client/src/scenes/Game.ts`
- Test: `client/src/systems/__tests__/zone-manager.spec.ts`
- Test: `client/src/entities/__tests__/crate.spec.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { zoneDamagePerSecond } from "../ZoneManager";

describe("ZoneManager", () => {
  it("matches 5-stage damage curve", () => {
    expect(zoneDamagePerSecond(1)).toBe(200);
    expect(zoneDamagePerSecond(5)).toBe(1000);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -w client -- zone-manager.spec.ts -t "ZoneManager"`  
Expected: FAIL with `zoneDamagePerSecond is not defined`.

**Step 3: Write minimal implementation**

```ts
const DAMAGE_TABLE = [200, 400, 600, 800, 1000] as const;

export function zoneDamagePerSecond(stage: number): number {
  const index = Math.min(5, Math.max(1, stage)) - 1;
  return DAMAGE_TABLE[index];
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -w client -- zone-manager.spec.ts -t "ZoneManager"`  
Expected: PASS.

**Step 5: Commit**

```bash
git add client/src/entities client/src/systems client/src/scenes/Game.ts
git commit -m "feat(world): implement crate drops, power cubes, and poison zone"
```

---

### Task 5: 单机完整回合（AI 敌人 + 淘汰判定）

**Files:**
- Create: `client/src/systems/BotController.ts`
- Create: `client/src/systems/MatchState.ts`
- Modify: `client/src/scenes/Game.ts`
- Test: `client/src/systems/__tests__/bot-controller.spec.ts`
- Test: `client/src/systems/__tests__/match-state.spec.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { computeAliveCount, getWinner } from "../MatchState";

describe("MatchState", () => {
  it("returns winner when only one player remains", () => {
    const players = [
      { id: "p1", hp: 100 },
      { id: "p2", hp: 0 }
    ];
    expect(computeAliveCount(players)).toBe(1);
    expect(getWinner(players)).toBe("p1");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -w client -- match-state.spec.ts -t "returns winner"`  
Expected: FAIL with missing module/export.

**Step 3: Write minimal implementation**

```ts
export function computeAliveCount(players: Array<{ hp: number }>): number {
  return players.filter((p) => p.hp > 0).length;
}

export function getWinner(players: Array<{ id: string; hp: number }>): string | null {
  const alive = players.filter((p) => p.hp > 0);
  return alive.length === 1 ? alive[0].id : null;
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -w client -- match-state.spec.ts -t "returns winner"`  
Expected: PASS.

**Step 5: Commit**

```bash
git add client/src/systems client/src/scenes/Game.ts
git commit -m "feat(singleplayer): add bots and elimination flow"
```

---

### Task 6: 角色差异化（Gunner/Bomber/Brawler + Super）

**Files:**
- Create: `client/src/characters/Gunner.ts`
- Create: `client/src/characters/Bomber.ts`
- Create: `client/src/characters/Brawler.ts`
- Create: `client/src/systems/SuperSystem.ts`
- Modify: `client/src/systems/CombatSystem.ts`
- Test: `client/src/characters/__tests__/character-balance.spec.ts`
- Test: `client/src/systems/__tests__/super-system.spec.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { GUNNER, BOMBER, BRAWLER } from "../index";

describe("character balance", () => {
  it("keeps triangle baseline stats", () => {
    expect(GUNNER.hp).toBe(3200);
    expect(BOMBER.hp).toBe(2800);
    expect(BRAWLER.hp).toBe(4800);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -w client -- character-balance.spec.ts -t "triangle baseline"`  
Expected: FAIL with missing character exports.

**Step 3: Write minimal implementation**

```ts
export const GUNNER = { id: "gunner", hp: 3200, ammoMax: 3 };
export const BOMBER = { id: "bomber", hp: 2800, ammoMax: 3 };
export const BRAWLER = { id: "brawler", hp: 4800, ammoMax: 3 };
```

**Step 4: Run test to verify it passes**

Run: `npm run test -w client -- character-balance.spec.ts -t "triangle baseline"`  
Expected: PASS.

**Step 5: Commit**

```bash
git add client/src/characters client/src/systems
git commit -m "feat(characters): implement three brawlers and super charge loop"
```

---

### Task 7: 信令服务器（房间、匹配、信令转发）

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/src/index.ts`
- Create: `server/src/RoomManager.ts`
- Create: `server/src/Matchmaker.ts`
- Create: `server/src/SignalingHandler.ts`
- Test: `server/src/__tests__/room-manager.spec.ts`
- Test: `server/src/__tests__/signaling-handler.spec.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { RoomManager } from "../RoomManager";

describe("RoomManager", () => {
  it("creates 6-digit room code", () => {
    const manager = new RoomManager();
    const room = manager.createRoom("host-1");
    expect(room.code).toMatch(/^\d{6}$/);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -w server -- room-manager.spec.ts -t "6-digit room code"`  
Expected: FAIL with missing RoomManager implementation.

**Step 3: Write minimal implementation**

```ts
export class RoomManager {
  createRoom(hostId: string) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    return { code, hostId, players: [hostId], ready: new Set<string>() };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -w server -- room-manager.spec.ts -t "6-digit room code"`  
Expected: PASS.

**Step 5: Commit**

```bash
git add server
git commit -m "feat(server): add ws signaling room lifecycle"
```

---

### Task 8: WebRTC + Host 权威同步

**Files:**
- Create: `client/src/network/SignalingClient.ts`
- Create: `client/src/network/PeerManager.ts`
- Create: `client/src/network/HostLogic.ts`
- Create: `client/src/network/ClientSync.ts`
- Modify: `shared/src/protocol.ts`
- Test: `client/src/network/__tests__/host-logic.spec.ts`
- Test: `client/src/network/__tests__/client-sync.spec.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { applyInputInOrder } from "../HostLogic";

describe("HostLogic", () => {
  it("drops out-of-order stale input", () => {
    const state = { lastSeq: 10, x: 0, y: 0 };
    const next = applyInputInOrder(state, { seq: 9, dx: 1, dy: 0 });
    expect(next.lastSeq).toBe(10);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -w client -- host-logic.spec.ts -t "drops out-of-order"`  
Expected: FAIL with missing function.

**Step 3: Write minimal implementation**

```ts
export function applyInputInOrder(
  state: { lastSeq: number; x: number; y: number },
  input: { seq: number; dx: number; dy: number }
) {
  if (input.seq <= state.lastSeq) {
    return state;
  }

  return {
    ...state,
    lastSeq: input.seq,
    x: state.x + input.dx,
    y: state.y + input.dy
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -w client -- host-logic.spec.ts -t "drops out-of-order"`  
Expected: PASS.

**Step 5: Commit**

```bash
git add client/src/network shared/src/protocol.ts
git commit -m "feat(network): implement host-authoritative input and sync core"
```

---

### Task 9: 大厅流程（主菜单、房间、准备、单双排）

**Files:**
- Modify: `client/src/scenes/MainMenu.ts`
- Modify: `client/src/scenes/Lobby.ts`
- Modify: `client/src/network/SignalingClient.ts`
- Create: `client/src/ui/LobbyState.ts`
- Test: `client/src/ui/__tests__/lobby-state.spec.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { canStartCountdown } from "../LobbyState";

describe("LobbyState", () => {
  it("starts when all joined players are ready", () => {
    expect(canStartCountdown([{ id: "a", ready: true }, { id: "b", ready: true }])).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -w client -- lobby-state.spec.ts -t "starts when all joined"`  
Expected: FAIL due to missing module.

**Step 3: Write minimal implementation**

```ts
export function canStartCountdown(players: Array<{ ready: boolean }>): boolean {
  return players.length > 1 && players.every((p) => p.ready);
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -w client -- lobby-state.spec.ts -t "starts when all joined"`  
Expected: PASS.

**Step 5: Commit**

```bash
git add client/src/scenes client/src/ui client/src/network/SignalingClient.ts
git commit -m "feat(lobby): implement menu-room-ready flow for solo/duo"
```

---

### Task 10: HUD/小地图/结算 + 全量验收

**Files:**
- Create: `client/src/ui/HUD.ts`
- Create: `client/src/ui/MiniMap.ts`
- Create: `client/src/ui/AmmoBar.ts`
- Modify: `client/src/scenes/Game.ts`
- Modify: `client/src/scenes/Result.ts`
- Create: `client/src/audio/Sfx.ts`
- Test: `client/src/ui/__tests__/hud.spec.ts`
- Test: `e2e/showdown-flow.spec.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { formatAliveCounter } from "../HUD";

describe("HUD", () => {
  it("formats alive counter", () => {
    expect(formatAliveCounter(7, 10)).toBe("存活: 7/10");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -w client -- hud.spec.ts -t "formats alive counter"`  
Expected: FAIL with missing export.

**Step 3: Write minimal implementation**

```ts
export function formatAliveCounter(alive: number, total: number): string {
  return `存活: ${alive}/${total}`;
}
```

**Step 4: Run full verification**

Run:

```bash
npm run test
npm run typecheck
npm run build
```

Expected:
- `test`: PASS (all workspaces green)
- `typecheck`: PASS (0 TypeScript errors)
- `build`: PASS (client/server/shared all build success)

**Step 5: Commit**

```bash
git add client e2e
git commit -m "feat(polish): add HUD/minimap/result flow and full verification"
```

---

## 里程碑映射（对应设计文档）

- Phase 1（单机核心玩法）: Task 2-5
- Phase 2（角色差异 + Super）: Task 6
- Phase 3（信令 + P2P + Host 同步）: Task 7-8
- Phase 4（大厅 UI + 房间系统 + 双排）: Task 9
- Phase 5（HUD + 小地图 + 结算 + 音效）: Task 10

## 关键风险与控制

1. WebRTC NAT 穿透失败率
   - 控制：预留 TURN 配置入口；连接失败 fallback 到重试 + 明确错误提示。
2. Host 迁移复杂度高
   - 控制：第一版只做 Host 断线后结算中断；第二版再做状态迁移（单独 Task）。
3. Phaser 场景与纯逻辑耦合
   - 控制：核心规则全部在 `systems/` 纯函数，Scene 只做渲染与事件绑定。
4. 联网抖动导致穿模/回弹
   - 控制：客户端保持输入序号、Host 按序应用、客户端对账回滚重放。

## 最终验收清单

- 能本地启动 `client` 与 `server`，并完成一局从主菜单到结算全流程
- 单机模式 10 人（含 AI）可玩，毒圈/箱子/能量块/弹药/超级技能生效
- 联网模式下客户端与 Host 状态同步稳定（20 tick/s），无明显瞬移
- 双排模式可组队，结算显示排名、击杀、能量块
- 全量命令通过：`npm run test` `npm run typecheck` `npm run build`
