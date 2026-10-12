// Web Audio API Procedural Sound Synthesizer & Mobile-Optimized Audio Manager
// 100% Offline, không phụ thuộc file mp3 bên ngoài, tự động mở khóa (unlock) trên iOS Safari & Android.

class SoundManager {
  private ctx: AudioContext | null = null;
  public isMuted: boolean = false;
  private bgmTimer: number | null = null;
  private bgmIndex: number = 0;
  private isBgmPlaying: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      // Đăng ký mở khóa âm thanh ngay từ thao tác chạm đầu tiên trên điện thoại
      const unlockHandler = () => {
        this.unlockAudio();
        window.removeEventListener('touchstart', unlockHandler, true);
        window.removeEventListener('touchend', unlockHandler, true);
        window.removeEventListener('click', unlockHandler, true);
      };
      window.addEventListener('touchstart', unlockHandler, true);
      window.addEventListener('touchend', unlockHandler, true);
      window.addEventListener('click', unlockHandler, true);
    }
  }

  // Khởi tạo AudioContext an toàn trên cả iOS và Android
  private initContext(): AudioContext | null {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  // Mở khóa phần cứng âm thanh cho thiết bị di động (Bypass iOS WebKit Autoplay Policy)
  public unlockAudio() {
    const ctx = this.initContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        if (!this.isMuted && !this.isBgmPlaying) {
          this.startBgm();
        }
      }).catch(() => {});
    } else {
      if (!this.isMuted && !this.isBgmPlaying) {
        this.startBgm();
      }
    }

    // Phát 1 frame buffer rỗng để kích hoạt kênh loa ngoài
    try {
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch {
      // Ignore
    }
  }

  // Bắt đầu phát nhạc nền thư giãn (Procedural Village Lofi BGM)
  public startBgm() {
    if (this.isMuted || this.isBgmPlaying) return;
    this.initContext();
    this.isBgmPlaying = true;
    this.playNextBgmNote();
  }

  // Dừng nhạc nền
  public stopBgm() {
    this.isBgmPlaying = false;
    if (this.bgmTimer) {
      clearTimeout(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  // Bộ tổng hợp chuỗi giai điệu nhạc nền đồng quê êm dịu (Pentatonic Relaxing Chords)
  private playNextBgmNote() {
    if (!this.isBgmPlaying || this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    // Giai điệu mộc mạc thư giãn: C4, E4, G4, A4, C5, B4, G4, E4, D4, F4...
    const melodyNotes = [
      261.63, 329.63, 392.00, 440.00,
      523.25, 493.88, 392.00, 329.63,
      293.66, 349.23, 392.00, 440.00,
      392.00, 329.63, 293.66, 261.63,
    ];

    const freq = melodyNotes[this.bgmIndex % melodyNotes.length];
    this.bgmIndex++;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      // Lowpass filter tạo âm thanh ấm áp, không chói tai
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(850, now);

      // Âm lượng nhạc nền êm dịu, rõ nét trên loa điện thoại (gain ~0.12)
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.7);
    } catch {
      // Ignore
    }

    // Mỗi nốt cách nhau 600ms
    this.bgmTimer = window.setTimeout(() => {
      this.playNextBgmNote();
    }, 620);
  }

  // Tiếng bấm nút (Click / Tap)
  public playClick() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(700, now);
      osc.frequency.exponentialRampToValueAtTime(350, now + 0.08);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch {
      // Ignore
    }
  }

  // Tiếng lắc xúc xắc (Dice Tumble & Roll)
  public playDiceRoll() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        if (!this.ctx || this.isMuted) return;
        try {
          const now = this.ctx.currentTime;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(260 + Math.random() * 220, now);
          osc.frequency.exponentialRampToValueAtTime(110, now + 0.07);

          gain.gain.setValueAtTime(0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.07);

          osc.connect(gain);
          gain.connect(this.ctx.destination);

          osc.start(now);
          osc.stop(now + 0.07);
        } catch {
          // Ignore
        }
      }, i * 110);
    }
  }

  // Tiếng quân cờ nhảy từng ô (Hop / Step)
  public playHop() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(620, now + 0.1);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.1);
    } catch {
      // Ignore
    }
  }

  // Tiếng nhận tiền / Tiền keng (Coin Ping)
  public playCoin() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [987.77, 1318.51].forEach((freq, idx) => {
      if (!this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const startTime = now + idx * 0.09;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.45, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.4);
      } catch {
        // Ignore
      }
    });
  }

  // Tiếng trừ tiền / Thanh toán chi phí
  public playPay() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(360, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.2);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.2);
    } catch {
      // Ignore
    }
  }

  // Tiếng cảnh báo biến cố / Sốc tài chính (Alert Shock)
  public playAlert() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.setValueAtTime(160, now + 0.1);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch {
      // Ignore
    }
  }

  // Tiếng mở hòm cơ hội / Sự kiện ô dừng (Fanfare Keng)
  public playEventShow() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    const now = ctx.currentTime;
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const startTime = now + idx * 0.08;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.35, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.3);
      } catch {
        // Ignore
      }
    });
  }

  // Tiếng hợp âm chúc mừng chiến thắng (Victory Fanfare)
  public playVictory() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    const now = ctx.currentTime;

    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const startTime = now + idx * 0.12;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.45, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.45);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.45);
      } catch {
        // Ignore
      }
    });
  }

  // Tiếng chào vui nhộn của Mascot 3D khi chạm vào (Cute Chirp)
  public playMascotHello() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, idx) => {
      if (!this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const startTime = now + idx * 0.07;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.35, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.2);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.2);
      } catch {
        // Ignore
      }
    });
    this.triggerHaptic('light');
  }

  // Rung phản hồi haptic
  public triggerHaptic(type: 'light' | 'medium' | 'heavy' = 'light') {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        if (type === 'light') navigator.vibrate(15);
        else if (type === 'medium') navigator.vibrate([25, 30, 25]);
        else navigator.vibrate([40, 50, 60]);
      } catch {
        // Ignore
      }
    }
  }
}

export const sound = new SoundManager();
