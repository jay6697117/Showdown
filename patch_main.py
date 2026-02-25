import sys

with open('client/src/main.ts', 'r') as f:
    content = f.read()

new_content = """import type Phaser from "phaser";

let gameInstance: Phaser.Game | undefined;
let bootPromise: Promise<Phaser.Game> | undefined;

function updateLoadingStatus(status: string, progress: number) {
  const statusEl = document.getElementById("loading-status");
  const barEl = document.getElementById("loading-bar");
  if (statusEl) statusEl.textContent = status;
  if (barEl) barEl.style.width = `${progress}%`;
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
      updateLoadingStatus("LOADING ENGINE...", 20);
      
      const [{ default: PhaserModule }, { createGameConfig }] = await Promise.all([
        import("phaser"),
        import("./config"),
      ]);

      updateLoadingStatus("INITIALIZING CONFIG...", 60);
      
      // Small delay to show progress visually
      await new Promise(resolve => setTimeout(resolve, 100));
      
      updateLoadingStatus("STARTING SCENE...", 90);
      
      const instance = new PhaserModule.Game(createGameConfig());
      gameInstance = instance;
      
      // Wait for game to be ready
      await new Promise<void>((resolve) => {
        instance.events.once("ready", () => {
          updateLoadingStatus("SYSTEM READY", 100);
          setTimeout(() => {
            hideLoadingOverlay();
            resolve();
          }, 300);
        });
      });
      
      return instance;
    } catch (error) {
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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", scheduleBoot, { once: true });
} else {
  scheduleBoot();
}

export { bootGame };
export default bootGame;
"""

with open('client/src/main.ts', 'w') as f:
    f.write(new_content)
