/* Converts microphone audio into 16 kHz PCM for the ESP32 speaker pipeline.
   Browsers often keep the capture graph at 48 kHz even when 16 kHz is requested,
   so we downsample here to avoid the ESP32 playing audio late and choppy. */

const TARGET_SAMPLE_RATE = 16000;

class PCMProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.sourceRate = sampleRate;
        this.sourcePosition = 0;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if(input.length === 0 || input[0].length === 0) {
            return true;
        }

        const samples = input[0];

        if(this.sourceRate === TARGET_SAMPLE_RATE) {
            const pcm = new Int16Array(samples.length);
            for(let i = 0; i < samples.length; i++) {
                const s = Math.max(-1, Math.min(1, samples[i]));
                pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            this.port.postMessage(pcm.buffer, [pcm.buffer]);
            return true;
        }

        const ratio = this.sourceRate / TARGET_SAMPLE_RATE;
        const maxOutput = Math.max(1, Math.ceil(samples.length / ratio));
        const pcm = new Int16Array(maxOutput);
        let outIndex = 0;
        let position = this.sourcePosition;

        while(position < samples.length - 1 && outIndex < maxOutput) {
            const index = Math.floor(position);
            const frac = position - index;
            const interpolated = samples[index] * (1 - frac) + samples[index + 1] * frac;
            const s = Math.max(-1, Math.min(1, interpolated));
            pcm[outIndex++] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            position += ratio;
        }

        this.sourcePosition = position - samples.length;

        if(outIndex > 0) {
            const payload = pcm.slice(0, outIndex);
            this.port.postMessage(payload.buffer, [payload.buffer]);
        }

        return true;
    }
}

registerProcessor('pcm-processor', PCMProcessor);
