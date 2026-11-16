// Sound, synthesized live with WebAudio: no audio files, no network.
// Each effect is a short oscillator blip (or two) with a fast decay.
// The context is created lazily on the first user gesture, since browsers
// refuse audio before one; calls before that are silently ignored.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (context !== null) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.16;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function blip(frequency, endFrequency, duration, type, volume, delay) {
    if (muted || !ensure()) return;
    if (context.state === 'suspended') context.resume();
    const start = context.currentTime + (delay || 0);
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  return {
    /** Call from any user gesture (click, key) so audio is allowed afterwards. */
    unlock() {
      ensure();
    },
    shoot() {
      blip(880, 320, 0.09, 'square', 0.25);
    },
    hit() {
      blip(220, 55, 0.28, 'sawtooth', 0.5);
      blip(110, 40, 0.32, 'triangle', 0.4, 0.02);
    },
    kill() {
      blip(520, 90, 0.16, 'triangle', 0.4);
    },
    shard() {
      blip(1180, 1760, 0.1, 'sine', 0.35);
    },
    powerup() {
      blip(660, 660, 0.09, 'sine', 0.35);
      blip(990, 990, 0.12, 'sine', 0.35, 0.09);
      blip(1320, 1320, 0.16, 'sine', 0.3, 0.18);
    },
    wave() {
      blip(392, 392, 0.12, 'triangle', 0.35);
      blip(523, 523, 0.12, 'triangle', 0.35, 0.12);
      blip(784, 784, 0.2, 'triangle', 0.35, 0.24);
    },
    over() {
      blip(392, 392, 0.22, 'sawtooth', 0.3);
      blip(311, 311, 0.22, 'sawtooth', 0.3, 0.22);
      blip(233, 110, 0.5, 'sawtooth', 0.35, 0.44);
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
  };
}
