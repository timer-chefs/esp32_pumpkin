export function mixToMono(audioBuffer)
{
    // return Float32Array
    // Handle multiple channels - mix down to mono if needed
    let monoData;
    if(audioBuffer.numberOfChannels === 1)
    {
        monoData = audioBuffer.getChannelData(0);
    } else if(audioBuffer.numberOfChannels === 2)
    {
        // Mix stereo to mono
        const left = audioBuffer.getChannelData(0);
        const right = audioBuffer.getChannelData(1);
        monoData = new Float32Array(left.length);
        for(let i = 0; i < left.length; i++)
        {
            monoData[i] = (left[i] + right[i]) * 0.5;
        }
    } else
    {
        // For multi-channel, just use first channel
        monoData = audioBuffer.getChannelData(0);
    }
    return monoData;
}

export function resampleAudioHighQuality(data, fromSampleRate, toSampleRate)
{
    if(fromSampleRate === toSampleRate)
    {
        return data;
    }
    
    const ratio = toSampleRate / fromSampleRate;
    const newLength = Math.round(data.length * ratio);
    const result = new Float32Array(newLength);
    
    // Use "linear interpolation" for better quality
    for(let i = 0; i < newLength; i++)
    {
        const index = i / ratio;
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        const weight = index - lower;
        
        if(upper >= data.length)
        {
            result[i] = data[lower] || 0;
        }
        else if(lower === upper)
        {
            result[i] = data[lower];
        } else
        {
            // Linear interpolation (simpler but effective)
            result[i] = data[lower] * (1 - weight) + data[upper] * weight;
        }
    }
    return result;
}

export function convertFloatToInt16(data)
{
    // Convert float to Int16 with "dithering" for better quality
    const int16Data = new Int16Array(data.length);
    let peak = 0;
    
    for(let i = 0; i < data.length; i++)
    {
        let s = Math.max(-1, Math.min(1, data[i]));
        
        // Add tiny dither noise to reduce quantization artifacts
        const dither = (Math.random() - 0.5) * 0.0001;
        s = Math.max(-1, Math.min(1, s + dither));
        
        const int16 = s < 0 ? s * 0x8000 : s * 0x7FFF;
        int16Data[i] = int16;
        peak = Math.max(peak, Math.abs(s));
    }

    return {int16Data, peak};
}
