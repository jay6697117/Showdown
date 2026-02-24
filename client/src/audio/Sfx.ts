import { Howl } from "howler";

type SfxType = "shoot" | "hit" | "death" | "pickup";

export class Sfx {
  private sounds: Record<SfxType, Howl> | null = null;

  init(): void {
    if (this.sounds) {
      return;
    }

    this.sounds = {
      shoot: new Howl({ src: [toneToWavDataUri(820, 0.08)], volume: 0.12 }),
      hit: new Howl({ src: [toneToWavDataUri(420, 0.11)], volume: 0.13 }),
      death: new Howl({ src: [toneToWavDataUri(210, 0.17)], volume: 0.16 }),
      pickup: new Howl({ src: [toneToWavDataUri(1180, 0.08)], volume: 0.12 }),
    };
  }

  play(type: SfxType): void {
    this.sounds?.[type]?.play();
  }
}

function toneToWavDataUri(frequency: number, durationSeconds: number): string {
  const sampleRate = 22050;
  const sampleCount = Math.max(1, Math.floor(sampleRate * durationSeconds));
  const dataSize = sampleCount * 2;
  const totalSize = 44 + dataSize;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  const fadeInSamples = Math.floor(sampleRate * 0.01);
  const fadeOutSamples = Math.floor(sampleRate * 0.02);
  for (let i = 0; i < sampleCount; i++) {
    const t = i / sampleRate;
    const wave = Math.sin(2 * Math.PI * frequency * t);
    const fadeIn = i < fadeInSamples ? i / Math.max(1, fadeInSamples) : 1;
    const fadeOut = i > sampleCount - fadeOutSamples ? (sampleCount - i) / Math.max(1, fadeOutSamples) : 1;
    const amplitude = Math.max(0, Math.min(1, fadeIn * fadeOut));
    const sample = Math.max(-1, Math.min(1, wave * amplitude));
    view.setInt16(44 + i * 2, sample * 0x7fff, true);
  }

  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}
