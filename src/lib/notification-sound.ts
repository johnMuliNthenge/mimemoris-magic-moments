// Generates notification sounds using Web Audio API - no external files needed

let audioCtx: AudioContext | null = null;

function getAudioContext() {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

export function playIncomingCallSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // Play a ringtone-like pattern: two-tone repeated
    for (let i = 0; i < 3; i++) {
      const offset = i * 0.8;
      
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.value = 440;
      gain1.gain.setValueAtTime(0.15, now + offset);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.3);
      osc1.connect(gain1).connect(ctx.destination);
      osc1.start(now + offset);
      osc1.stop(now + offset + 0.3);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.value = 554;
      gain2.gain.setValueAtTime(0.15, now + offset + 0.3);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.6);
      osc2.connect(gain2).connect(ctx.destination);
      osc2.start(now + offset + 0.3);
      osc2.stop(now + offset + 0.6);
    }
  } catch (e) {
    console.warn('Could not play notification sound:', e);
  }
}

export function playMessageSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.1);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  } catch (e) {
    console.warn('Could not play message sound:', e);
  }
}
