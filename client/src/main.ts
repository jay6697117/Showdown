import type Phaser from "phaser";

let gameInstance: Phaser.Game | undefined;
let bootPromise: Promise<Phaser.Game> | undefined;
let bootWatchdogMs: ReturnType<typeof setTimeout> | undefined;
let bootstrapErrorHooksRegistered = false;

const CHUNK_RELOAD_ONCE_KEY = "showdown-chunk-reload-once";

type BootStage = {
  label: string;
  progress: number;
};

type VitePreloadErrorEvent = Event & {
  payload?: unknown;
};

const BOOT_STAGES: Record<"init" | "imports" | "config" | "scene" | "ready", BootStage> = {
  init: { label: "INITIALIZING SYSTEM...", progress: 8 },
  imports: { label: "LOADING ENGINE...", progress: 28 },
  config: { label: "INITIALIZING CONFIG...", progress: 62 },
  scene: { label: "STARTING SCENE...", progress: 88 },
  ready: { label: "SYSTEM READY", progress: 100 },
};

function updateLoadingStatus(status: string, progress: number) {
  const statusEl = document.getElementById("loading-status");
  const barEl = document.getElementById("loading-bar");
  if (statusEl) statusEl.textContent = status;
  if (barEl) barEl.style.width = `${progress}%`;
}

function updateBootStage(stage: keyof typeof BOOT_STAGES): void {
  const current = BOOT_STAGES[stage];
  updateLoadingStatus(current.label, current.progress);
}

function describeError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (typeof error === "object" && error && "message" in error) {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string") {
      return maybeMessage;
    }
  }
  return "Unknown boot error";
}

function isStaleChunkLikeError(error: unknown): boolean {
  const message = describeError(error).toLowerCase();
  if (message.length === 0) {
    return false;
  }

  return (
    message.includes("chunkloaderror") ||
    message.includes("loading chunk") ||
    message.includes("failed to fetch dynamically imported module") ||
    message.includes("unable to preload css")
  );
}

function hasReloadAttemptedForStaleChunk(): boolean {
  try {
    return sessionStorage.getItem(CHUNK_RELOAD_ONCE_KEY) === "1";
  } catch {
    return false;
  }
}

function markReloadAttemptForStaleChunk(): void {
  try {
    sessionStorage.setItem(CHUNK_RELOAD_ONCE_KEY, "1");
  } catch {
    void 0;
  }
}

function clearStaleChunkReloadMarker(): void {
  try {
    sessionStorage.removeItem(CHUNK_RELOAD_ONCE_KEY);
  } catch {
    void 0;
  }
}

function tryRecoverFromStaleChunk(error: unknown): boolean {
  if (!isStaleChunkLikeError(error)) {
    return false;
  }

  if (hasReloadAttemptedForStaleChunk()) {
    return false;
  }

  markReloadAttemptForStaleChunk();
  location.reload();
  return true;
}

function registerBootstrapErrorHooks(): void {
  if (bootstrapErrorHooksRegistered) {
    return;
  }
  bootstrapErrorHooksRegistered = true;

  window.addEventListener("vite:preloadError", (event) => {
    const preloadEvent = event as VitePreloadErrorEvent;
    preloadEvent.preventDefault();
    const payload = preloadEvent.payload ?? preloadEvent;
    if (!tryRecoverFromStaleChunk(payload)) {
      showLoadingError(payload);
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    if (!isStaleChunkLikeError(event.reason)) {
      return;
    }
    event.preventDefault();
    if (!tryRecoverFromStaleChunk(event.reason)) {
      showLoadingError(event.reason);
    }
  });
}

function showLoadingError(error: unknown) {
  const spinnerEl = document.getElementById("loading-spinner");
  const statusEl = document.getElementById("loading-status");
  const barContainerEl = document.getElementById("loading-bar-container");
  const errorEl = document.getElementById("loading-error");
  
  if (spinnerEl) spinnerEl.style.display = "none";
  if (statusEl) statusEl.style.display = "none";
  if (barContainerEl) barContainerEl.style.display = "none";
  if (errorEl) errorEl.style.display = "flex";

  if (bootWatchdogMs) {
    clearTimeout(bootWatchdogMs);
    bootWatchdogMs = undefined;
  }
  
  console.error("Failed to boot game", error);
}

function hideLoadingOverlay() {
  const overlay = document.getElementById("loading-overlay");
  if (overlay) {
    overlay.classList.add("hidden");
    // Remove from DOM after transition
    setTimeout(() => {
      overlay.remove();
    }, 800);
  }

  if (bootWatchdogMs) {
    clearTimeout(bootWatchdogMs);
    bootWatchdogMs = undefined;
  }

  clearStaleChunkReloadMarker();
}

function armBootWatchdog(): void {
  if (bootWatchdogMs) {
    clearTimeout(bootWatchdogMs);
  }
  bootWatchdogMs = setTimeout(() => {
    showLoadingError(new Error("Boot timed out. Please reload."));
  }, 12000);
}

async function bootGame(): Promise<Phaser.Game> {
  if (gameInstance) {
    return gameInstance;
  }

  if (bootPromise) {
    return bootPromise;
  }

  bootPromise = (async () => {
    try {
      updateBootStage("init");
      armBootWatchdog();
      updateBootStage("imports");
      
      const [{ default: PhaserModule }, { createGameConfig }] = await Promise.all([
        import("phaser"),
        import("./config"),
      ]);

      updateBootStage("config");
      
      // Small delay to show progress visually
      await new Promise(resolve => setTimeout(resolve, 100));
      
      updateBootStage("scene");
      
      const instance = new PhaserModule.Game(createGameConfig());
      gameInstance = instance;
      
      // Wait for game to be ready
      await new Promise<void>((resolve) => {
        const finish = () => {
          updateBootStage("ready");
          setTimeout(() => {
            hideLoadingOverlay();
            resolve();
          }, 300);
        };

        let finished = false;
        const safeFinish = () => {
          if (finished) {
            return;
          }
          finished = true;
          finish();
        };

        instance.events.once("ready", safeFinish);
        instance.events.once(PhaserModule.Core.Events.READY, safeFinish);

        setTimeout(() => {
          safeFinish();
        }, 2500);
      });
      
      return instance;
    } catch (error) {
      bootPromise = undefined;
      gameInstance = undefined;
      if (tryRecoverFromStaleChunk(error)) {
        throw error;
      }
      showLoadingError(error);
      throw error;
    }
  })();

  return bootPromise;
}

function scheduleBoot(): void {
  void bootGame().catch(() => {
    // Error already handled in bootGame
  });
}

registerBootstrapErrorHooks();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", scheduleBoot, { once: true });
} else {
  scheduleBoot();
}

export { bootGame };
export default bootGame;
