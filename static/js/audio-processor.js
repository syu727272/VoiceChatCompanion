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

        // Simple audio processing - echo effect
        for (let channel = 0; channel < input.length; channel++) {
            const inputChannel = input[channel];
            const outputChannel = output[channel];

            for (let i = 0; i < inputChannel.length; i++) {
                // Add delay and feedback
                outputChannel[i] = inputChannel[i] + 0.5 * this.buffer[this.bufferIndex];
                this.buffer[this.bufferIndex] = inputChannel[i];
                this.bufferIndex = (this.bufferIndex + 1) % this.bufferSize;
            }
        }

        return true;
    }
}

registerProcessor('audio-processor', AudioProcessor);
