// Audio processing worklet
class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.bufferSize = 2048;
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];

        // Real-time audio processing
        for (let channel = 0; channel < input.length; channel++) {
            const inputChannel = input[channel];
            const outputChannel = output[channel];

            for (let i = 0; i < inputChannel.length; i++) {
                // Direct pass-through with optional effects
                outputChannel[i] = inputChannel[i];

                // Store in buffer for future processing
                this.buffer[this.bufferIndex] = inputChannel[i];
                this.bufferIndex = (this.bufferIndex + 1) % this.bufferSize;
            }
        }

        return true;
    }
}

registerProcessor('audio-processor', AudioProcessor);