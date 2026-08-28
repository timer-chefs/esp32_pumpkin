import {
  convertFloatToInt16,
  mixToMono,
  resampleAudioHighQuality,
} from "./audio_file_utils.ts";

const TARGET_SAMPLE_RATE = 16_000;

export async function processAudioFile(
  file: File,
): Promise<Int16Array<ArrayBuffer>> {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new AudioContext();

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    console.log("Audio decoded");

    const monoData = mixToMono(audioBuffer);
    const resampledData =
      audioBuffer.sampleRate === TARGET_SAMPLE_RATE
        ? monoData
        : resampleAudioHighQuality(
            monoData,
            audioBuffer.sampleRate,
            TARGET_SAMPLE_RATE,
          );
    const { int16Data, peak } = convertFloatToInt16(resampledData);

    console.log(
      `Converted to Int16: ${int16Data.length} samples, peak level: ${(peak * 100).toFixed(1)}%`,
    );
    if (peak < 0.1) {
      console.warn(
        "Warning: Audio level very quiet (peak < 10%). File might be silent or very compressed.",
      );
    }

    return int16Data;
  } catch (error) {
    console.error("Error processing audio:", error);
    throw error;
  } finally {
    await audioContext.close();
  }
}
