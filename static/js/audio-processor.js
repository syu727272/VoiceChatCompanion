// Audio processing worklet
class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.bufferSize = 2048;
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
        this.delayTime = 0.1; // 100ms delay
        this.feedback = 0.5;  // 50% feedback
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];

        if (!input || !output || !input[0] || !output[0]) return true;

        // Real-time audio processing with echo effect
        for (let channel = 0; channel < input.length; channel++) {
            const inputChannel = input[channel];
            const outputChannel = output[channel];

            for (let i = 0; i < inputChannel.length; i++) {
                // Add echo effect
                const delayedSample = this.buffer[this.bufferIndex];
                outputChannel[i] = inputChannel[i] + this.feedback * delayedSample;

                // Store current sample in buffer
                this.buffer[this.bufferIndex] = inputChannel[i];
                this.bufferIndex = (this.bufferIndex + 1) % this.bufferSize;
            }
        }

        return true;
    }
}

registerProcessor('audio-processor', AudioProcessor);