// processor.js
class CircularBufferProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 16384; // samples per canale
    this.buffer = new Float32Array(this.bufferSize);
    this.writeIndex = 0;
  }

  process(inputs, outputs) {
    const input = inputs[0];
    if (input.length > 0) {
      const channelData = input[0];
      for (let i = 0; i < channelData.length; i++) {
        this.buffer[this.writeIndex] = channelData[i];
        this.writeIndex = (this.writeIndex + 1) % this.bufferSize;
      }
    }
    // Pass through audio (optional)
    const output = outputs[0];
    if (output.length > 0) {
      output[0].set(inputs[0][0]);
    }
    return true;
  }
}

registerProcessor('circular-buffer-processor', CircularBufferProcessor);