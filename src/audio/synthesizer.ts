export type Waveform = 'sine' | 'square' | 'sawtooth' | 'triangle';

export interface SynthNote {
  frequency: number;
  duration: number;
  delay?: number;
  gain?: number;
  waveform?: Waveform;
  attack?: number;
  release?: number;
}

export interface NoiseParams {
  duration: number;
  gain?: number;
  filterFreq?: number;
  filterQ?: number;
  type?: 'white' | 'pink' | 'brown';
}

export interface SweepParams {
  startFreq: number;
  endFreq: number;
  duration: number;
  gain?: number;
  waveform?: Waveform;
}

export class AudioSynthesizer {
  private audioContext: AudioContext | null = null;

  init(context: AudioContext) {
    this.audioContext = context;
  }

  private ensureContext(): AudioContext | null {
    if (!this.audioContext) {
      return null;
    }
    return this.audioContext;
  }

  playNote(
    frequency: number,
    duration: number,
    gain: number = 0.3,
    waveform: Waveform = 'sine',
    attack: number = 0.01,
    release: number = 0.1
  ): AudioBufferSourceNode | null {
    const ctx = this.ensureContext();
    if (!ctx) return null;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = waveform;
    osc.frequency.setValueAtTime(frequency, now);

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(gain, now + attack);
    gainNode.gain.setValueAtTime(gain, now + attack + Math.max(0, duration - attack - release));
    gainNode.gain.linearRampToValueAtTime(0, now + duration);

    osc.connect(gainNode);

    osc.start(now);
    osc.stop(now + duration + 0.05);

    return osc;
  }

  playSequence(notes: SynthNote[]): { source: AudioBufferSourceNode | null; endTime: number }[] {
    const ctx = this.ensureContext();
    if (!ctx) return [];
    const results: { source: AudioBufferSourceNode | null; endTime: number }[] = [];

    notes.forEach((note) => {
      const delay = note.delay || 0;
      const startTime = ctx.currentTime + delay;
      const gain = note.gain ?? 0.3;
      const waveform = note.waveform || 'sine';
      const attack = note.attack ?? 0.01;
      const release = note.release ?? 0.1;

      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = waveform;
      osc.frequency.setValueAtTime(note.frequency, startTime);

      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(gain, startTime + attack);
      gainNode.gain.setValueAtTime(
        gain,
        startTime + attack + Math.max(0, note.duration - attack - release)
      );
      gainNode.gain.linearRampToValueAtTime(0, startTime + note.duration);

      osc.connect(gainNode);

      osc.start(startTime);
      osc.stop(startTime + note.duration + 0.05);

      results.push({ source: osc, endTime: startTime + note.duration });
    });

    return results;
  }

  playNoise(params: NoiseParams): AudioBufferSourceNode | null {
    const ctx = this.ensureContext();
    if (!ctx) return null;
    const { duration, gain = 0.2, filterFreq = 1000, filterQ = 1, type = 'white' } = params;

    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      if (type === 'pink') {
        lastOut = (lastOut + 0.02 * white) / 1.02;
        data[i] = lastOut * 3.5;
      } else if (type === 'brown') {
        lastOut = (lastOut + 0.02 * white) / 1.02;
        data[i] = lastOut * 3.5;
        data[i] = (data[i] + (Math.random() * 2 - 1) * 0.1) * 0.5;
      } else {
        data[i] = white;
      }
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = filterQ;

    const gainNode = ctx.createGain();
    const now = ctx.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(gain, now + 0.01);
    gainNode.gain.setValueAtTime(gain, now + Math.max(0, duration - 0.05));
    gainNode.gain.linearRampToValueAtTime(0, now + duration);

    source.connect(filter);
    filter.connect(gainNode);

    source.start(now);
    source.stop(now + duration + 0.05);

    return source;
  }

  playSweep(params: SweepParams): AudioBufferSourceNode | null {
    const ctx = this.ensureContext();
    if (!ctx) return null;
    const { startFreq, endFreq, duration, gain = 0.3, waveform = 'sawtooth' } = params;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = waveform;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), now + duration);

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(gain, now + 0.02);
    gainNode.gain.setValueAtTime(gain, now + Math.max(0, duration - 0.1));
    gainNode.gain.linearRampToValueAtTime(0, now + duration);

    osc.connect(gainNode);

    osc.start(now);
    osc.stop(now + duration + 0.05);

    return osc;
  }

  createFireSound(): { connect: (node: AudioNode) => void; start: () => void; stop: () => void } {
    const ctx = this.ensureContext();
    const noop = { connect: () => {}, start: () => {}, stop: () => {} };
    if (!ctx) return noop;

    const bufferSize = Math.floor(ctx.sampleRate * 2);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.05 * white) / 1.05;
      data[i] = lastOut * 3;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800;
    filter.Q.value = 0.8;

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 5;
    lfoGain.gain.value = 300;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    const gainNode = ctx.createGain();
    gainNode.gain.value = 0;

    source.connect(filter);
    filter.connect(gainNode);

    return {
      connect: (node: AudioNode) => gainNode.connect(node),
      start: () => {
        const now = ctx.currentTime;
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        gainNode.gain.linearRampToValueAtTime(0.25, now + 0.15);
        if (source.playbackState !== 2) {
          source.start(now);
        }
      },
      stop: () => {
        const now = ctx.currentTime;
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.2);
        setTimeout(() => {
          try {
            source.stop();
            lfo.stop();
          } catch {}
        }, 300);
      },
    };
  }

  createThunderSound(): { connect: (node: AudioNode) => void; play: () => void } {
    const ctx = this.ensureContext();
    const noop = { connect: () => {}, play: () => {} };
    if (!ctx) return noop;

    const gainNode = ctx.createGain();
    gainNode.gain.value = 0;

    return {
      connect: (node: AudioNode) => gainNode.connect(node),
      play: () => {
        const now = ctx.currentTime;

        this.playNoise({
          duration: 0.8,
          gain: 0.5,
          filterFreq: 500,
          filterQ: 2,
          type: 'pink',
        });

        const osc1 = ctx.createOscillator();
        const osc1Gain = ctx.createGain();
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(120, now);
        osc1.frequency.exponentialRampToValueAtTime(40, now + 0.6);
        osc1Gain.gain.setValueAtTime(0.4, now);
        osc1Gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
        osc1.connect(osc1Gain);
        osc1Gain.connect(gainNode);
        osc1.start(now);
        osc1.stop(now + 0.9);

        this.playSweep({
          startFreq: 2000,
          endFreq: 100,
          duration: 0.3,
          gain: 0.3,
          waveform: 'square',
        });
      },
    };
  }

  createWaterSound(): { connect: (node: AudioNode) => void; start: () => void; stop: () => void } {
    const ctx = this.ensureContext();
    const noop = { connect: () => {}, start: () => {}, stop: () => {} };
    if (!ctx) return noop;

    const bufferSize = Math.floor(ctx.sampleRate * 2);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const t = i / ctx.sampleRate;
      data[i] = (Math.random() * 2 - 1) * 0.3 + Math.sin(t * 800) * 0.1 * Math.sin(t * 30);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1500;
    filter.Q.value = 1.5;

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.8;
    lfoGain.gain.value = 500;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    const gainNode = ctx.createGain();
    gainNode.gain.value = 0;

    source.connect(filter);
    filter.connect(gainNode);

    return {
      connect: (node: AudioNode) => gainNode.connect(node),
      start: () => {
        const now = ctx.currentTime;
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        gainNode.gain.linearRampToValueAtTime(0.2, now + 0.2);
        if (source.playbackState !== 2) {
          source.start(now);
        }
      },
      stop: () => {
        const now = ctx.currentTime;
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.3);
        setTimeout(() => {
          try {
            source.stop();
            lfo.stop();
          } catch {}
        }, 400);
      },
    };
  }

  createHeartbeatSound(): { connect: (node: AudioNode) => void; play: () => void; stop: () => void } {
    const ctx = this.ensureContext();
    const noop = { connect: () => {}, play: () => {}, stop: () => {} };
    if (!ctx) return noop;
    const gainNode = ctx.createGain();
    gainNode.gain.value = 0;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const beat = () => {
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const osc1Gain = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(80, now);
      osc1.frequency.exponentialRampToValueAtTime(40, now + 0.12);
      osc1Gain.gain.setValueAtTime(0.5, now);
      osc1Gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc1.connect(osc1Gain);
      osc1Gain.connect(gainNode);
      osc1.start(now);
      osc1.stop(now + 0.2);

      setTimeout(() => {
        const t2 = ctx.currentTime;
        const osc2 = ctx.createOscillator();
        const osc2Gain = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(60, t2);
        osc2.frequency.exponentialRampToValueAtTime(30, t2 + 0.1);
        osc2Gain.gain.setValueAtTime(0.4, t2);
        osc2Gain.gain.exponentialRampToValueAtTime(0.001, t2 + 0.12);
        osc2.connect(osc2Gain);
        osc2Gain.connect(gainNode);
        osc2.start(t2);
        osc2.stop(t2 + 0.15);
      }, 180);
    };

    return {
      connect: (node: AudioNode) => gainNode.connect(node),
      play: () => {
        const now = ctx.currentTime;
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.linearRampToValueAtTime(1, now + 0.3);
        beat();
        intervalId = setInterval(beat, 800);
      },
      stop: () => {
        const now = ctx.currentTime;
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.5);
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      },
    };
  }

  createAmbientDrone(): { connect: (node: AudioNode) => void; start: () => void; stop: () => void } {
    const ctx = this.ensureContext();
    const noop = { connect: () => {}, start: () => {}, stop: () => {} };
    if (!ctx) return noop;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const osc3 = ctx.createOscillator();
    osc1.type = 'sine';
    osc2.type = 'sine';
    osc3.type = 'triangle';
    osc1.frequency.value = 110;
    osc2.frequency.value = 165;
    osc3.frequency.value = 220;

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.1;
    lfoGain.gain.value = 5;
    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);
    lfoGain.connect(osc2.frequency);
    lfoGain.connect(osc3.frequency);

    const gainNode = ctx.createGain();
    gainNode.gain.value = 0;

    const osc1Gain = ctx.createGain();
    const osc2Gain = ctx.createGain();
    const osc3Gain = ctx.createGain();
    osc1Gain.gain.value = 0.15;
    osc2Gain.gain.value = 0.1;
    osc3Gain.gain.value = 0.08;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;

    osc1.connect(osc1Gain);
    osc2.connect(osc2Gain);
    osc3.connect(osc3Gain);
    osc1Gain.connect(filter);
    osc2Gain.connect(filter);
    osc3Gain.connect(filter);
    filter.connect(gainNode);

    return {
      connect: (node: AudioNode) => gainNode.connect(node),
      start: () => {
        const now = ctx.currentTime;
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        gainNode.gain.linearRampToValueAtTime(0.5, now + 1.5);
        osc1.start(now);
        osc2.start(now);
        osc3.start(now);
        lfo.start(now);
      },
      stop: () => {
        const now = ctx.currentTime;
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 2);
        setTimeout(() => {
          try {
            osc1.stop();
            osc2.stop();
            osc3.stop();
            lfo.stop();
          } catch {}
        }, 2500);
      },
    };
  }

  createBattleLoop(): { connect: (node: AudioNode) => void; start: () => void; stop: () => void; setIntensity: (intensity: number) => void } {
    const ctx = this.ensureContext();
    const noop = { connect: () => {}, start: () => {}, stop: () => {}, setIntensity: () => {} };
    if (!ctx) return noop;

    const gainNode = ctx.createGain();
    gainNode.gain.value = 0;

    const bassOsc = ctx.createOscillator();
    const bassGain = ctx.createGain();
    bassOsc.type = 'sawtooth';
    bassOsc.frequency.value = 55;
    bassGain.gain.value = 0;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;

    const drumGain = ctx.createGain();
    drumGain.gain.value = 0;

    const hihatGain = ctx.createGain();
    hihatGain.gain.value = 0;

    bassOsc.connect(bassGain);
    bassGain.connect(filter);
    filter.connect(gainNode);
    drumGain.connect(gainNode);
    hihatGain.connect(gainNode);

    let drumInterval: ReturnType<typeof setInterval> | null = null;
    let beatCount = 0;

    const playDrum = () => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
      oscGain.gain.setValueAtTime(0.4, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(oscGain);
      oscGain.connect(drumGain);
      osc.start(now);
      osc.stop(now + 0.2);
    };

    const playHihat = () => {
      const now = ctx.currentTime;
      const noiseSize = Math.floor(ctx.sampleRate * 0.05);
      const noiseBuffer = ctx.createBuffer(1, noiseSize, ctx.sampleRate);
      const noiseData = noiseBuffer.getChannelData(0);
      for (let i = 0; i < noiseSize; i++) {
        noiseData[i] = Math.random() * 2 - 1;
      }
      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = noiseBuffer;
      const hpf = ctx.createBiquadFilter();
      hpf.type = 'highpass';
      hpf.frequency.value = 7000;
      const hGain = ctx.createGain();
      hGain.gain.setValueAtTime(0.15, now);
      hGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      noiseSrc.connect(hpf);
      hpf.connect(hGain);
      hGain.connect(hihatGain);
      noiseSrc.start(now);
      noiseSrc.stop(now + 0.06);
    };

    let currentIntensity = 0.5;

    return {
      connect: (node: AudioNode) => gainNode.connect(node),
      start: () => {
        const now = ctx.currentTime;
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.linearRampToValueAtTime(0.6, now + 1);
        bassOsc.start(now);
        bassGain.gain.linearRampToValueAtTime(0.25 * currentIntensity, now + 1);

        let bassStep = 0;
        const bassPattern = [55, 55, 82.5, 55, 73.3, 55, 82.5, 98];

        const bassInterval = setInterval(() => {
          const t = ctx.currentTime;
          bassOsc.frequency.setValueAtTime(bassPattern[bassStep % bassPattern.length], t);
          bassStep++;
        }, 250);

        drumInterval = setInterval(() => {
          if (beatCount % 2 === 0) {
            playDrum();
          }
          if (currentIntensity > 0.3) {
            playHihat();
          }
          if (currentIntensity > 0.6 && beatCount % 2 === 1) {
            playDrum();
          }
          beatCount++;
        }, 250);

        (gainNode as any)._bassInterval = bassInterval;
      },
      stop: () => {
        const now = ctx.currentTime;
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.linearRampToValueAtTime(0, now + 1.5);
        bassGain.gain.linearRampToValueAtTime(0, now + 1.5);

        if (drumInterval) {
          clearInterval(drumInterval);
          drumInterval = null;
        }
        if ((gainNode as any)._bassInterval) {
          clearInterval((gainNode as any)._bassInterval);
        }

        setTimeout(() => {
          try {
            bassOsc.stop();
          } catch {}
        }, 2000);
      },
      setIntensity: (intensity: number) => {
        currentIntensity = Math.max(0, Math.min(1, intensity));
        const now = ctx.currentTime;
        bassGain.gain.cancelScheduledValues(now);
        bassGain.gain.linearRampToValueAtTime(0.15 + 0.25 * currentIntensity, now + 0.5);
        drumGain.gain.cancelScheduledValues(now);
        drumGain.gain.linearRampToValueAtTime(0.5 + 0.5 * currentIntensity, now + 0.3);
        hihatGain.gain.cancelScheduledValues(now);
        hihatGain.gain.linearRampToValueAtTime(currentIntensity > 0.3 ? 0.8 : 0, now + 0.3);
        filter.frequency.cancelScheduledValues(now);
        filter.frequency.linearRampToValueAtTime(300 + 500 * currentIntensity, now + 0.5);
      },
    };
  }

  createMenuMusic(): { connect: (node: AudioNode) => void; start: () => void; stop: () => void } {
    const ctx = this.ensureContext();
    const noop = { connect: () => {}, start: () => {}, stop: () => {} };
    if (!ctx) return noop;

    const gainNode = ctx.createGain();
    gainNode.gain.value = 0;

    const pad1 = ctx.createOscillator();
    const pad2 = ctx.createOscillator();
    const pad3 = ctx.createOscillator();
    pad1.type = 'sine';
    pad2.type = 'triangle';
    pad3.type = 'sine';
    pad1.frequency.value = 220;
    pad2.frequency.value = 277.18;
    pad3.frequency.value = 329.63;

    const padLfo = ctx.createOscillator();
    const padLfoGain = ctx.createGain();
    padLfo.frequency.value = 0.08;
    padLfoGain.gain.value = 8;
    padLfo.connect(padLfoGain);
    padLfoGain.connect(pad1.frequency);
    padLfoGain.connect(pad2.frequency);
    padLfoGain.connect(pad3.frequency);

    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 800;

    const pad1Gain = ctx.createGain();
    const pad2Gain = ctx.createGain();
    const pad3Gain = ctx.createGain();
    pad1Gain.gain.value = 0.12;
    pad2Gain.gain.value = 0.08;
    pad3Gain.gain.value = 0.06;

    pad1.connect(pad1Gain);
    pad2.connect(pad2Gain);
    pad3.connect(pad3Gain);
    pad1Gain.connect(padFilter);
    pad2Gain.connect(padFilter);
    pad3Gain.connect(padFilter);
    padFilter.connect(gainNode);

    const melodyGain = ctx.createGain();
    melodyGain.gain.value = 0.15;
    melodyGain.connect(gainNode);

    const melodyNotes = [
      { freq: 440, delay: 0 },
      { freq: 523.25, delay: 1.2 },
      { freq: 659.25, delay: 2.4 },
      { freq: 587.33, delay: 3.6 },
      { freq: 523.25, delay: 4.8 },
      { freq: 440, delay: 6 },
      { freq: 392, delay: 7.2 },
      { freq: 440, delay: 8.4 },
    ];
    let melodyStep = 0;
    let melodyInterval: ReturnType<typeof setInterval> | null = null;

    const playMelodyNote = () => {
      const note = melodyNotes[melodyStep % melodyNotes.length];
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = note.freq;
      oscGain.gain.setValueAtTime(0, now);
      oscGain.gain.linearRampToValueAtTime(0.2, now + 0.1);
      oscGain.gain.setValueAtTime(0.2, now + 0.6);
      oscGain.gain.linearRampToValueAtTime(0, now + 1.1);
      osc.connect(oscGain);
      oscGain.connect(melodyGain);
      osc.start(now);
      osc.stop(now + 1.2);
      melodyStep++;
    };

    return {
      connect: (node: AudioNode) => gainNode.connect(node),
      start: () => {
        const now = ctx.currentTime;
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.linearRampToValueAtTime(0.7, now + 2);
        pad1.start(now);
        pad2.start(now);
        pad3.start(now);
        padLfo.start(now);
        playMelodyNote();
        melodyInterval = setInterval(playMelodyNote, 1200);
      },
      stop: () => {
        const now = ctx.currentTime;
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.linearRampToValueAtTime(0, now + 2);
        if (melodyInterval) {
          clearInterval(melodyInterval);
          melodyInterval = null;
        }
        setTimeout(() => {
          try {
            pad1.stop();
            pad2.stop();
            pad3.stop();
            padLfo.stop();
          } catch {}
        }, 2500);
      },
    };
  }

  createVictoryFanfare(): { connect: (node: AudioNode) => void; play: () => void } {
    const ctx = this.ensureContext();
    const noop = { connect: () => {}, play: () => {} };
    if (!ctx) return noop;
    const gainNode = ctx.createGain();
    gainNode.gain.value = 0;

    return {
      connect: (node: AudioNode) => gainNode.connect(node),
      play: () => {
        const now = ctx.currentTime;
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.8, now + 0.1);
        gainNode.gain.setValueAtTime(0.8, now + 2);
        gainNode.gain.linearRampToValueAtTime(0, now + 2.8);

        const notes = [
          { freq: 523.25, dur: 0.3, delay: 0 },
          { freq: 659.25, dur: 0.3, delay: 0.3 },
          { freq: 783.99, dur: 0.3, delay: 0.6 },
          { freq: 1046.5, dur: 0.8, delay: 0.9 },
          { freq: 880, dur: 0.25, delay: 1.8 },
          { freq: 783.99, dur: 0.25, delay: 2.05 },
          { freq: 659.25, dur: 0.25, delay: 2.3 },
          { freq: 1046.5, dur: 0.6, delay: 2.55 },
        ];

        notes.forEach((n) => {
          const t = now + n.delay;
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.value = n.freq;
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.35, t + 0.02);
          g.gain.setValueAtTime(0.35, t + n.dur - 0.05);
          g.gain.linearRampToValueAtTime(0, t + n.dur);
          osc.connect(g);
          g.connect(gainNode);
          osc.start(t);
          osc.stop(t + n.dur + 0.05);

          const osc2 = ctx.createOscillator();
          const g2 = ctx.createGain();
          osc2.type = 'sine';
          osc2.frequency.value = n.freq * 2;
          g2.gain.setValueAtTime(0, t);
          g2.gain.linearRampToValueAtTime(0.15, t + 0.02);
          g2.gain.linearRampToValueAtTime(0, t + n.dur);
          osc2.connect(g2);
          g2.connect(gainNode);
          osc2.start(t);
          osc2.stop(t + n.dur + 0.05);
        });
      },
    };
  }

  createDefeatMusic(): { connect: (node: AudioNode) => void; play: () => void } {
    const ctx = this.ensureContext();
    const noop = { connect: () => {}, play: () => {} };
    if (!ctx) return noop;
    const gainNode = ctx.createGain();
    gainNode.gain.value = 0;

    return {
      connect: (node: AudioNode) => gainNode.connect(node),
      play: () => {
        const now = ctx.currentTime;
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.7, now + 0.15);
        gainNode.gain.setValueAtTime(0.7, now + 2.5);
        gainNode.gain.linearRampToValueAtTime(0, now + 4);

        const notes = [
          { freq: 392, dur: 0.5, delay: 0 },
          { freq: 349.23, dur: 0.5, delay: 0.5 },
          { freq: 311.13, dur: 0.5, delay: 1 },
          { freq: 261.63, dur: 0.8, delay: 1.5 },
          { freq: 233.08, dur: 0.5, delay: 2.4 },
          { freq: 196, dur: 1.2, delay: 2.9 },
        ];

        notes.forEach((n) => {
          const t = now + n.delay;
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.value = n.freq;
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.25, t + 0.05);
          g.gain.setValueAtTime(0.25, t + n.dur - 0.1);
          g.gain.linearRampToValueAtTime(0, t + n.dur);

          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 1200;

          osc.connect(filter);
          filter.connect(g);
          g.connect(gainNode);
          osc.start(t);
          osc.stop(t + n.dur + 0.05);
        });
      },
    };
  }

  playUIButton(): void {
    this.playNote(880, 0.08, 0.2, 'sine', 0.005, 0.03);
  }

  playUIClick(): void {
    this.playNote(660, 0.05, 0.15, 'square', 0.002, 0.02);
  }

  playUIPositive(): void {
    const ctx = this.ensureContext();
    this.playSequence([
      { frequency: 523.25, duration: 0.1, gain: 0.2, waveform: 'sine' },
      { frequency: 783.99, duration: 0.15, gain: 0.25, waveform: 'sine', delay: 0.08 },
    ]);
  }

  playUINegative(): void {
    this.playSequence([
      { frequency: 220, duration: 0.12, gain: 0.2, waveform: 'sawtooth' },
      { frequency: 165, duration: 0.15, gain: 0.2, waveform: 'sawtooth', delay: 0.1 },
    ]);
  }

  playHit(): void {
    const ctx = this.ensureContext();
    this.playNoise({ duration: 0.12, gain: 0.4, filterFreq: 300, filterQ: 3, type: 'brown' });
    this.playSweep({ startFreq: 200, endFreq: 50, duration: 0.1, gain: 0.3, waveform: 'sine' });
  }

  playCriticalHit(): void {
    const ctx = this.ensureContext();
    this.playNoise({ duration: 0.2, gain: 0.5, filterFreq: 500, filterQ: 2, type: 'pink' });
    this.playSequence([
      { frequency: 180, duration: 0.08, gain: 0.4, waveform: 'sawtooth' },
      { frequency: 90, duration: 0.15, gain: 0.45, waveform: 'square', delay: 0.05 },
    ]);
  }

  playHeal(): void {
    this.playSequence([
      { frequency: 523.25, duration: 0.1, gain: 0.2, waveform: 'sine' },
      { frequency: 659.25, duration: 0.1, gain: 0.2, waveform: 'sine', delay: 0.08 },
      { frequency: 783.99, duration: 0.15, gain: 0.25, waveform: 'sine', delay: 0.16 },
      { frequency: 1046.5, duration: 0.2, gain: 0.2, waveform: 'triangle', delay: 0.24 },
    ]);
  }

  playRuneMatch(comboLevel: number = 1): void {
    const baseFreq = 440 * Math.pow(1.06, Math.min(comboLevel - 1, 12));
    this.playSequence([
      { frequency: baseFreq, duration: 0.06, gain: 0.18, waveform: 'sine' },
      { frequency: baseFreq * 1.25, duration: 0.08, gain: 0.2, waveform: 'sine', delay: 0.04 },
      { frequency: baseFreq * 1.5, duration: 0.1, gain: 0.22, waveform: 'triangle', delay: 0.09 },
    ]);
  }

  playCombo(comboCount: number): void {
    const ctx = this.ensureContext();
    const pitchShift = Math.min((comboCount - 3) * 100, 600);

    if (comboCount >= 5) {
      this.playSequence([
        { frequency: 440 + pitchShift, duration: 0.08, gain: 0.25, waveform: 'square' },
        { frequency: 554 + pitchShift, duration: 0.08, gain: 0.28, waveform: 'square', delay: 0.06 },
        { frequency: 659 + pitchShift, duration: 0.08, gain: 0.3, waveform: 'square', delay: 0.12 },
        { frequency: 880 + pitchShift, duration: 0.2, gain: 0.35, waveform: 'triangle', delay: 0.18 },
      ]);
    } else if (comboCount >= 3) {
      this.playSequence([
        { frequency: 440 + pitchShift, duration: 0.1, gain: 0.22, waveform: 'sine' },
        { frequency: 659 + pitchShift, duration: 0.15, gain: 0.26, waveform: 'sine', delay: 0.08 },
      ]);
    }
  }
}
