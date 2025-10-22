class CircularBufferProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._bufferSize = 8192;
    this._buffer = new Float32Array(this._bufferSize);
    this._writeIndex = 0;
    this._readIndex = 0;
    this._bufferedSamples = 0;

    this.port.onmessage = (event) => {
      const data = event.data;
      for (let i = 0; i < data.length; i++) {
        this._buffer[this._writeIndex] = data[i];
        this._writeIndex = (this._writeIndex + 1) % this._bufferSize;

        if (this._bufferedSamples < this._bufferSize) {
          this._bufferedSamples++;
        } else {
          // Sovrascrittura: avanza anche il readIndex per non leggere dati vecchi
          this._readIndex = (this._readIndex + 1) % this._bufferSize;
        }
      }
    };
  }

  process(inputs, outputs) {
    const output = outputs[0];
    const channel = output[0];

    for (let i = 0; i < channel.length; i++) {
      if (this._bufferedSamples > 0) {
        channel[i] = this._buffer[this._readIndex];
        this._readIndex = (this._readIndex + 1) % this._bufferSize;
        this._bufferedSamples--;
      } else {
        channel[i] = 0; // Silenzio se buffer vuoto
      }
    }

    return true;
  }
}

registerProcessor('circular-buffer-processor', CircularBufferProcessor);