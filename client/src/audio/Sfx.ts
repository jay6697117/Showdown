export class Sfx {
  private audioContext: AudioContext | null = null;

  init(): void {
    this.audioContext = new AudioContext();
  }

  play(type: "shoot" | "hit" | "death" | "pickup"): void {
    if (!this.audioContext) return;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    const freqMap: Record<string, number> = {
      shoot: 800,
      hit: 400,
      death: 200,
      pickup: 1200,
    };

    osc.frequency.value = freqMap[type] ?? 440;
    gain.gain.value = 0.1;
    osc.start();
    osc.stop(this.audioContext.currentTime + 0.1);
  }
}
