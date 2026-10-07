class SpeakingPcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super(); this.block = new Float32Array(2048); this.used = 0; this.stopped = false;
    this.port.onmessage = e => { if (e.data === 'flush') { this.flush(); this.stopped = true; this.port.postMessage({ flushed: true }); } };
  }
  flush() { if (!this.used) return; const block = this.block.slice(0, this.used); this.port.postMessage({ samples: block }, [block.buffer]); this.used = 0; }
  process(inputs) {
    if (this.stopped) return false;
    const channels = inputs[0]; if (!channels?.length) return true;
    for (let i = 0; i < channels[0].length; i++) {
      let value = 0; for (const channel of channels) value += channel[i] || 0;
      this.block[this.used++] = value / channels.length; if (this.used === this.block.length) this.flush();
    }
    return true;
  }
}
registerProcessor('speaking-pcm', SpeakingPcmProcessor);
