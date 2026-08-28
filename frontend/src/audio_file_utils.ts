export interface Int16AudioData {
  int16Data: Int16Array<ArrayBuffer>;
  peak: number;
}

export function mixToMono(audioBuffer: AudioBuffer): Float32Array<ArrayBuffer> {
  if (audioBuffer.numberOfChannels === 1) {
    return audioBuffer.getChannelData(0);
  }

  if (audioBuffer.numberOfChannels === 2) {
    const left = audioBuffer.getChannelData(0);
    const right = audioBuffer.getChannelData(1);
    const monoData = new Float32Array(left.length);

    for (let index = 0; index < left.length; index++) {
      monoData[index] = (left[index] + right[index]) * 0.5;
    }

    return monoData;
  }

  return audioBuffer.getChannelData(0);
}

export function resampleAudioHighQuality(
  data: Float32Array<ArrayBuffer>,
  fromSampleRate: number,
  toSampleRate: number,
): Float32Array<ArrayBuffer> {
  if (fromSampleRate === toSampleRate) {
    return data;
  }

  const ratio = toSampleRate / fromSampleRate;
  const newLength = Math.round(data.length * ratio);
  const result = new Float32Array(newLength);

  for (let outputIndex = 0; outputIndex < newLength; outputIndex++) {
    const sourceIndex = outputIndex / ratio;
    const lowerIndex = Math.floor(sourceIndex);
    const upperIndex = Math.ceil(sourceIndex);
    const weight = sourceIndex - lowerIndex;

    if (upperIndex >= data.length) {
      result[outputIndex] = data[lowerIndex] || 0;
    } else if (lowerIndex === upperIndex) {
      result[outputIndex] = data[lowerIndex];
    } else {
      result[outputIndex] =
        data[lowerIndex] * (1 - weight) + data[upperIndex] * weight;
    }
  }

  return result;
}

export function convertFloatToInt16(
  data: Float32Array<ArrayBuffer>,
): Int16AudioData {
  const int16Data = new Int16Array(data.length);
  let peak = 0;

  for (let index = 0; index < data.length; index++) {
    let sample = Math.max(-1, Math.min(1, data[index]));
    const dither = (Math.random() - 0.5) * 0.0001;
    sample = Math.max(-1, Math.min(1, sample + dither));

    int16Data[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    peak = Math.max(peak, Math.abs(sample));
  }

  return { int16Data, peak };
}
