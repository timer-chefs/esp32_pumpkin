export interface Voice {
  /**
   * Piper's name for the voice: locale, speaker and quality, which is also
   * where it lives among Piper's voices.
   */
  id: string;
  name: string;
}

/**
 * The voices to speak with, the first being the one picked to begin with.
 * Any of Piper's voices (https://github.com/rhasspy/piper/blob/master/VOICES.md)
 * can go here. The "low" ones speak at 16 kHz, which is what the device plays.
 * Each is a 63 MB download the first time it's used.
 */
export const voices: Voice[] = [
  { id: "en_US-ryan-low", name: "Ryan (American)" },
  { id: "en_GB-alan-low", name: "Alan (British)" },
  { id: "en_US-amy-low", name: "Amy (American)" },
  { id: "en_US-kathleen-low", name: "Kathleen (American)" },
];
