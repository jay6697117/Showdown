import Phaser from "phaser";

export type SceneTone = "menu" | "lobby" | "result" | "combat";
export type TextPreset = "title" | "subtitle" | "body" | "meta" | "button" | "hudTitle" | "hudBody";

export const UI_THEME = {
  fonts: {
    title: '"Press Start 2P", "Noto Sans SC", "Microsoft YaHei", sans-serif',
    body: '"Rajdhani", "Noto Sans SC", "Microsoft YaHei", sans-serif',
    mono: '"JetBrains Mono", "Cascadia Mono", "Consolas", monospace',
  },
  colors: {
    textPrimary: "#f8f2dd",
    textSecondary: "#c7d4ff",
    textMuted: "#8fa0cc",
    textWarning: "#ffd166",
    textDanger: "#ff8fa8",
    textSuccess: "#7cf2b5",
    panelBase: 0x121a35,
    panelAlt: 0x1b2a52,
    panelStroke: 0x6cc8ff,
    panelMutedStroke: 0x7e8cb8,
    buttonBase: 0x1d2f5f,
    buttonStroke: 0x72d2ff,
    buttonDanger: 0x7a2240,
    buttonDangerStroke: 0xff7a9c,
    overlayShadow: 0x070c17,
    minimapFrame: 0x2f4c86,
  },
};

interface BackdropPalette {
  base: number;
  stripe: number;
  grid: number;
  glowA: number;
  glowB: number;
  spark: number;
}

const BACKDROP: Record<SceneTone, BackdropPalette> = {
  menu: {
    base: 0x0c1026,
    stripe: 0x152552,
    grid: 0x315190,
    glowA: 0x2c6ed5,
    glowB: 0x5d3c99,
    spark: 0x7ef9ff,
  },
  lobby: {
    base: 0x0d132b,
    stripe: 0x1f2d55,
    grid: 0x375088,
    glowA: 0x3d7dff,
    glowB: 0x35667d,
    spark: 0x8ffff0,
  },
  result: {
    base: 0x151122,
    stripe: 0x33254a,
    grid: 0x5f4b7d,
    glowA: 0xff9f43,
    glowB: 0xfec84b,
    spark: 0xfff5b5,
  },
  combat: {
    base: 0x10172d,
    stripe: 0x1b2e5a,
    grid: 0x294875,
    glowA: 0x2e88dd,
    glowB: 0x2ec4b6,
    spark: 0xb4ffdd,
  },
};

const TEXT_STYLES: Record<TextPreset, Phaser.Types.GameObjects.Text.TextStyle> = {
  title: {
    fontSize: "46px",
    fontFamily: UI_THEME.fonts.title,
    color: UI_THEME.colors.textPrimary,
    stroke: "#11182e",
    strokeThickness: 8,
    shadow: {
      offsetX: 0,
      offsetY: 6,
      color: "#000000",
      blur: 4,
      fill: true,
      stroke: true,
    },
  },
  subtitle: {
    fontSize: "22px",
    fontFamily: UI_THEME.fonts.body,
    color: UI_THEME.colors.textSecondary,
    stroke: "#0a1020",
    strokeThickness: 5,
    shadow: {
      offsetX: 0,
      offsetY: 3,
      color: "#000000",
      blur: 2,
      fill: true,
      stroke: true,
    },
  },
  body: {
    fontSize: "30px",
    fontFamily: UI_THEME.fonts.body,
    color: UI_THEME.colors.textPrimary,
    stroke: "#0b1226",
    strokeThickness: 4,
    shadow: {
      offsetX: 0,
      offsetY: 2,
      color: "#000000",
      blur: 0,
      fill: true,
      stroke: false,
    },
  },
  meta: {
    fontSize: "19px",
    fontFamily: UI_THEME.fonts.mono,
    color: UI_THEME.colors.textMuted,
    stroke: "#0b1226",
    strokeThickness: 3,
  },
  button: {
    fontSize: "20px",
    fontFamily: UI_THEME.fonts.title,
    color: UI_THEME.colors.textPrimary,
    stroke: "#060a14",
    strokeThickness: 4,
    shadow: {
      offsetX: 0,
      offsetY: 4,
      color: "#000000",
      blur: 0,
      fill: true,
      stroke: true,
    },
  },
  hudTitle: {
    fontSize: "24px",
    fontFamily: UI_THEME.fonts.body,
    color: UI_THEME.colors.textPrimary,
    stroke: "#0c142a",
    strokeThickness: 5,
    shadow: {
      offsetX: 0,
      offsetY: 2,
      color: "#000000",
      blur: 2,
      fill: true,
      stroke: true,
    },
  },
  hudBody: {
    fontSize: "19px",
    fontFamily: UI_THEME.fonts.mono,
    color: UI_THEME.colors.textSecondary,
    stroke: "#0c142a",
    strokeThickness: 4,
  },
};

export function getTextStyle(
  preset: TextPreset,
  overrides: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {}
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    ...TEXT_STYLES[preset],
    ...overrides,
  };
}

export function drawSceneBackdrop(scene: Phaser.Scene, tone: SceneTone): Phaser.GameObjects.Graphics {
  const palette = BACKDROP[tone];
  const width = scene.scale.width;
  const height = scene.scale.height;

  scene.cameras.main.setBackgroundColor(toCssHex(palette.base));

  const graphics = scene.add.graphics();
  graphics.setScrollFactor(0).setDepth(-40);

  graphics.fillStyle(palette.base, 1);
  graphics.fillRect(0, 0, width, height);

  const stripeHeight = Math.max(8, Math.floor(height / 44));
  for (let y = 0; y < height; y += stripeHeight) {
    const progress = y / height;
    graphics.fillStyle(palette.stripe, 0.04 + progress * 0.18);
    graphics.fillRect(0, y, width, stripeHeight);
  }

  graphics.lineStyle(1, palette.grid, 0.22);
  for (let x = 0; x <= width; x += 64) {
    graphics.beginPath();
    graphics.moveTo(x, 0);
    graphics.lineTo(x, height);
    graphics.strokePath();
  }
  for (let y = 0; y <= height; y += 64) {
    graphics.beginPath();
    graphics.moveTo(0, y);
    graphics.lineTo(width, y);
    graphics.strokePath();
  }

  graphics.fillStyle(palette.glowA, 0.15);
  graphics.fillCircle(width * 0.2, height * 0.18, 170);
  graphics.fillStyle(palette.glowB, 0.12);
  graphics.fillCircle(width * 0.82, height * 0.2, 200);
  graphics.fillStyle(palette.glowA, 0.08);
  graphics.fillCircle(width * 0.7, height * 0.78, 220);

  graphics.fillStyle(palette.spark, 0.25);
  for (let i = 0; i < 18; i++) {
    const sparkX = (width / 17) * i + 18;
    const sparkY = ((i * 73) % (height - 40)) + 20;
    graphics.fillRect(sparkX, sparkY, 2, 2);
  }

  return graphics;
}

export interface PixelPanelOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  depth?: number;
  scrollFactor?: number;
  fillColor?: number;
  strokeColor?: number;
  glowColor?: number;
  shadowColor?: number;
  alpha?: number;
}

export interface PixelPanel {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Rectangle;
  border: Phaser.GameObjects.Rectangle;
  gloss: Phaser.GameObjects.Rectangle;
}

export function createPixelPanel(scene: Phaser.Scene, options: PixelPanelOptions): PixelPanel {
  const fillColor = options.fillColor ?? UI_THEME.colors.panelBase;
  const strokeColor = options.strokeColor ?? UI_THEME.colors.panelStroke;
  const glowColor = options.glowColor ?? UI_THEME.colors.buttonStroke;
  const shadowColor = options.shadowColor ?? UI_THEME.colors.overlayShadow;
  const alpha = options.alpha ?? 0.94;

  const container = scene.add.container(options.x, options.y);
  
  // Soft drop shadow
  const shadow = scene.add
    .rectangle(8, 12, options.width, options.height, shadowColor, 0.6)
    .setOrigin(0.5);
  
  // Base body with solid color
  const body = scene.add
    .rectangle(0, 0, options.width, options.height, fillColor, alpha)
    .setOrigin(0.5);
  
  // Subtle tech scanline/grid overlay logic (handled by fill alpha & stroke)
  const inner = scene.add
    .rectangle(0, 0, options.width - 6, options.height - 6, 0x000000, 0.15)
    .setOrigin(0.5)
    .setStrokeStyle(2, 0xffffff, 0.05);
  
  // Top glow/gloss for glass feel
  const gloss = scene.add
    .rectangle(0, -options.height / 2 + 4, options.width - 8, Math.min(12, options.height * 0.15), glowColor, 0.35)
    .setOrigin(0.5);
    
  // Bottom darker shade for depth
  const bottomShade = scene.add
    .rectangle(0, options.height / 2 - 4, options.width - 8, Math.min(12, options.height * 0.15), 0x000000, 0.4)
    .setOrigin(0.5);

  // Outer border with multi-layer stroke effect
  const border = scene.add.rectangle(0, 0, options.width, options.height).setOrigin(0.5).setStrokeStyle(4, strokeColor, 1);
  const innerBorder = scene.add.rectangle(0, 0, options.width - 8, options.height - 8).setOrigin(0.5).setStrokeStyle(1, strokeColor, 0.5);

  container.add([shadow, body, inner, gloss, bottomShade, border, innerBorder]);
  
  if (typeof options.depth === "number") {
    container.setDepth(options.depth);
  }
  if (typeof options.scrollFactor === "number") {
    container.setScrollFactor(options.scrollFactor);
  }

  return {
    container,
    body,
    border,
    gloss,
  };
}

export interface PixelButtonOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  onClick: () => void | Promise<void>;
  depth?: number;
  scrollFactor?: number;
  fillColor?: number;
  strokeColor?: number;
  glowColor?: number;
  textColor?: string;
  fontSize?: string;
  disabled?: boolean;
}

export interface PixelButtonHandle {
  container: Phaser.GameObjects.Container;
  label: Phaser.GameObjects.Text;
  setEnabled: (enabled: boolean) => void;
  setLabel: (label: string) => void;
}

export function createPixelButton(scene: Phaser.Scene, options: PixelButtonOptions): PixelButtonHandle {
  const panel = createPixelPanel(scene, {
    x: options.x,
    y: options.y,
    width: options.width,
    height: options.height,
    depth: options.depth,
    scrollFactor: options.scrollFactor,
    fillColor: options.fillColor ?? UI_THEME.colors.buttonBase,
    strokeColor: options.strokeColor ?? UI_THEME.colors.buttonStroke,
    glowColor: options.glowColor ?? UI_THEME.colors.buttonStroke,
    alpha: 0.98,
  });

  const label = scene.add
    .text(
      0,
      0,
      options.label,
      getTextStyle("button", {
        fontSize: options.fontSize ?? "20px",
        color: options.textColor ?? UI_THEME.colors.textPrimary,
      })
    )
    .setOrigin(0.5);
  panel.container.add(label);

  const hitArea = new Phaser.Geom.Rectangle(-options.width / 2, -options.height / 2, options.width, options.height);
  panel.container
    .setSize(options.width, options.height)
    .setInteractive({
      hitArea,
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });

  let enabled = options.disabled !== true;
  const baseFill = options.fillColor ?? UI_THEME.colors.buttonBase;
  const hoverFill = shiftColor(baseFill, 18);
  const pressedFill = shiftColor(baseFill, -20);

  let isDown = false;
  let isPointerOver = false;
  let downX = 0;
  let downY = 0;

  panel.container.on("pointerover", () => {
    isPointerOver = true;
    if (!enabled) {
      return;
    }
    panel.body.setFillStyle(isDown ? pressedFill : hoverFill, 1);
    panel.border.setStrokeStyle(4, parseInt(UI_THEME.colors.textPrimary.replace("#", "0x")), 1);
    panel.gloss.setFillStyle(options.glowColor ?? UI_THEME.colors.buttonStroke, 0.5);
    label.setY(isDown ? 2 : -2);
  });

  panel.container.on("pointerout", () => {
    isPointerOver = false;
    panel.body.setFillStyle(baseFill, enabled ? 0.98 : 0.55);
    panel.border.setStrokeStyle(4, options.strokeColor ?? UI_THEME.colors.buttonStroke, 1);
    panel.gloss.setFillStyle(options.glowColor ?? UI_THEME.colors.buttonStroke, 0.35);
    panel.container.setScale(1);
    label.setY(0);
  });

  panel.container.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
    if (!enabled) {
      return;
    }
    isDown = true;
    downX = pointer.x;
    downY = pointer.y;
    panel.body.setFillStyle(pressedFill, 1);
    panel.border.setStrokeStyle(4, options.strokeColor ?? UI_THEME.colors.buttonStroke, 1);
    panel.gloss.setFillStyle(0x000000, 0.2); // Darken gloss on press
    panel.container.setScale(0.96);
    label.setY(2);
  });

  panel.container.on("pointerup", () => {
    if (!enabled) {
      return;
    }
    const shouldTrigger = isDown;
    isDown = false;
    panel.body.setFillStyle(isPointerOver ? hoverFill : baseFill, isPointerOver ? 1 : 0.98);
    panel.border.setStrokeStyle(4, isPointerOver ? parseInt(UI_THEME.colors.textPrimary.replace("#", "0x")) : (options.strokeColor ?? UI_THEME.colors.buttonStroke), 1);
    panel.gloss.setFillStyle(options.glowColor ?? UI_THEME.colors.buttonStroke, isPointerOver ? 0.5 : 0.35);
    panel.container.setScale(1);
    label.setY(isPointerOver ? -2 : 0);
    if (shouldTrigger) {
      void Promise.resolve(options.onClick());
    }
  });

  panel.container.on("pointerupoutside", (pointer: Phaser.Input.Pointer) => {
    if (!enabled) {
      return;
    }
    const distance = Phaser.Math.Distance.Between(downX, downY, pointer.x, pointer.y);
    const shouldTrigger = isDown && distance < 30;
    isDown = false;
    panel.body.setFillStyle(baseFill, enabled ? 0.98 : 0.55);
    panel.border.setStrokeStyle(4, options.strokeColor ?? UI_THEME.colors.buttonStroke, 1);
    panel.gloss.setFillStyle(options.glowColor ?? UI_THEME.colors.buttonStroke, 0.35);
    panel.container.setScale(1);
    label.setY(0);
    if (shouldTrigger) {
      void Promise.resolve(options.onClick());
    }
  });

  const setEnabled = (nextEnabled: boolean): void => {
    enabled = nextEnabled;
    if (!nextEnabled) {
      isDown = false;
      isPointerOver = false;
    }
    panel.container.alpha = nextEnabled ? 1 : 0.64;
    panel.body.setFillStyle(baseFill, nextEnabled ? 0.98 : 0.55);
    label.setY(0);
  };
  setEnabled(enabled);

  return {
    container: panel.container,
    label,
    setEnabled,
    setLabel: (nextLabel: string) => {
      label.setText(nextLabel);
    },
  };
}

export function toCssHex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

function shiftColor(color: number, delta: number): number {
  const source = Phaser.Display.Color.IntegerToColor(color);
  return Phaser.Display.Color.GetColor(
    Phaser.Math.Clamp(source.red + delta, 0, 255),
    Phaser.Math.Clamp(source.green + delta, 0, 255),
    Phaser.Math.Clamp(source.blue + delta, 0, 255)
  );
}
