/* InkBoard · 秒表 / 倒计时引擎 */
(function (global) {
  'use strict';
  const IB = (global.IB = global.IB || {});

  class TimerEngine {
    constructor(options) {
      const opts = options || {};
      this.onTick = opts.onTick || function () {};
      this.onFinish = opts.onFinish || function () {};
      this.mode = 'stopwatch';
      this.sw = { running: false, base: 0, startedAt: 0 };
      this.cd = {
        running: false,
        total: Math.max(1000, Number(opts.countdownMs) || 25 * 60000),
        remaining: Math.max(1000, Number(opts.countdownMs) || 25 * 60000),
        startedAt: 0,
        done: false
      };
      const self = this;
      this.interval = setInterval(function () { self.tick(); }, 100);
    }

    now() {
      return (global.performance && performance.now) ? performance.now() : Date.now();
    }

    stopwatchElapsed() {
      return this.sw.base + (this.sw.running ? this.now() - this.sw.startedAt : 0);
    }

    countdownRemaining() {
      if (!this.cd.running) return this.cd.remaining;
      return Math.max(0, this.cd.remaining - (this.now() - this.cd.startedAt));
    }

    snapshot() {
      const active = this.mode === 'stopwatch' ? this.sw : this.cd;
      const elapsed = this.stopwatchElapsed();
      const remaining = this.countdownRemaining();
      return {
        mode: this.mode,
        running: active.running,
        done: this.mode === 'countdown' ? this.cd.done : false,
        elapsed: elapsed,
        remaining: remaining,
        total: this.cd.total,
        progress: this.mode === 'countdown'
          ? Math.max(0, Math.min(1, remaining / Math.max(1, this.cd.total)))
          : 1
      };
    }

    setMode(mode) {
      if (mode !== 'stopwatch' && mode !== 'countdown') return;
      if (mode === this.mode) return;
      this.pause();
      this.mode = mode;
      this.emit();
    }

    start() {
      if (this.mode === 'stopwatch') {
        if (this.sw.running) return;
        this.sw.startedAt = this.now();
        this.sw.running = true;
      } else {
        if (this.cd.running) return;
        if (this.cd.remaining <= 0 || this.cd.done) {
          this.cd.remaining = this.cd.total;
          this.cd.done = false;
        }
        this.cd.startedAt = this.now();
        this.cd.running = true;
      }
      this.emit();
    }

    pause() {
      if (this.mode === 'stopwatch') {
        if (!this.sw.running) return;
        this.sw.base = this.stopwatchElapsed();
        this.sw.running = false;
      } else {
        if (!this.cd.running) return;
        this.cd.remaining = this.countdownRemaining();
        this.cd.running = false;
      }
      this.emit();
    }

    toggle() {
      const active = this.mode === 'stopwatch' ? this.sw : this.cd;
      if (active.running) this.pause();
      else this.start();
    }

    reset() {
      if (this.mode === 'stopwatch') {
        this.sw.running = false;
        this.sw.base = 0;
        this.sw.startedAt = 0;
      } else {
        this.cd.running = false;
        this.cd.remaining = this.cd.total;
        this.cd.startedAt = 0;
        this.cd.done = false;
      }
      this.emit();
    }

    setCountdown(ms) {
      const total = Math.max(1000, Number(ms) || 0);
      this.cd.total = total;
      this.cd.remaining = total;
      this.cd.running = false;
      this.cd.startedAt = 0;
      this.cd.done = false;
      if (this.mode === 'countdown') this.emit();
    }

    tick() {
      if (this.mode === 'countdown' && this.cd.running && this.countdownRemaining() <= 0) {
        this.cd.running = false;
        this.cd.remaining = 0;
        this.cd.done = true;
        this.emit();
        this.onFinish();
        return;
      }
      this.emit();
    }

    emit() {
      this.onTick(this.snapshot());
    }

    destroy() {
      clearInterval(this.interval);
    }
  }

  IB.timer = TimerEngine;
})(window);
