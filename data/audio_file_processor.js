import {
    mixToMono,
    resampleAudioHighQuality,
    convertFloatToInt16
} from "./audio_file_utils.js";


export async function processAudioFile(file)
{
    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Decode audio to PCM 16-bit
    let audioContext;
    try
    {
        audioContext = new window.AudioContext(); 
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        console.log(`Audio decoded`);
        
        const monoData = mixToMono(audioBuffer);
        
        const sampleRate = audioBuffer.sampleRate;
        
        // Resample to 16000 Hz if needed (typical for I2S on ESP32)
        const targetSampleRate = 16000;
        let resampledData;
        
        if(sampleRate === targetSampleRate)
        {
            resampledData = monoData;
        } else
        {
            resampledData = resampleAudioHighQuality(monoData,
                sampleRate,
                targetSampleRate);
        }

        const {int16Data, peak} = convertFloatToInt16(resampledData);
        console.log(`Converted to Int16: ${int16Data.length} samples, peak level: ${(peak * 100).toFixed(1)}%`);
        if(peak < 0.1)
        {
            console.warn("Warning: Audio level very quiet (peak < 10%). File might be silent or very compressed.");
        }
        
        return int16Data;
    
    } catch(err)
    {
        console.error("Error processing audio:", err);
        throw err;
    } finally
    {
        if(audioContext)
        {
            await audioContext.close();
        }
    }
}
