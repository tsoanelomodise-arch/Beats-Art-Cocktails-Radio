import { useState, useRef } from 'react';

export function useTts() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizeAudio = (pcmData: Int16Array) => {
    let max = 0;
    for (let i = 0; i < pcmData.length; i++) {
      const abs = Math.abs(pcmData[i]);
      if (abs > max) max = abs;
    }
    if (max === 0) return pcmData;
    const factor = 32767 / max;
    const normalized = new Int16Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      normalized[i] = Math.round(pcmData[i] * factor);
    }
    return normalized;
  };

  const pcmToWav = (pcmData: Int16Array, sampleRate: number) => {
    const buffer = new ArrayBuffer(44 + pcmData.length * 2);
    const view = new DataView(buffer);
    view.setUint32(0, 0x52494646, false);
    view.setUint32(4, 36 + pcmData.length * 2, true);
    view.setUint32(8, 0x57415645, false);
    view.setUint32(12, 0x666d7420, false);
    view.setUint16(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    view.setUint32(36, 0x64617461, false);
    view.setUint32(40, pcmData.length * 2, true);
    for (let i = 0; i < pcmData.length; i++) {
      view.setInt16(44 + i * 2, pcmData[i], true);
    }
    return new Blob([buffer], { type: 'audio/wav' });
  };

  const synthesize = async (text: string, voice: string, stylePrefix: string = "") => {
    setIsLoading(true);
    setError(null);

    let voiceInstruction = "";
    let effectiveVoice = voice;
    if (voice === 'Thandi') {
      voiceInstruction = "Speak with a clear, warm South African accent as Thandi: ";
      effectiveVoice = "Kore";
    }

    const fullText = `${voiceInstruction}${stylePrefix}${text}`;

    const attemptCall = async () => {
      const currentApiKey = process.env.GEMINI_API_KEY;
      if (!currentApiKey) {
        throw new Error('GEMINI_API_KEY is missing');
      }

      // Try multiple model endpoints if the specific TTS one fails
      const modelEndpoints = [
        'gemini-2.0-flash-preview-tts',
        'gemini-2.0-flash-exp'
      ];

      let lastError = null;

      for (const modelName of modelEndpoints) {
        try {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${currentApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: fullText }] }],
              generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: effectiveVoice }
                  }
                }
              }
            })
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            lastError = new Error(`API request failed [${modelName}]: ${response.status} ${errorData.error?.message || response.statusText}`);
            continue; // Try next model
          }
          return response.json();
        } catch (e: any) {
          lastError = e;
          continue;
        }
      }
      throw lastError || new Error('All model endpoints failed');
    };

    try {
      let result;
      let retries = 0;
      while (retries < 3) {
        try {
          result = await attemptCall();
          break;
        } catch (e) {
          retries++;
          if (retries === 3) throw e;
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, retries)));
        }
      }

      const audioPart = result.candidates[0].content.parts[0];
      const base64Data = audioPart.inlineData.data;
      const mimeType = audioPart.inlineData.mimeType;
      const sampleRate = parseInt(mimeType.match(/rate=(\d+)/)?.[1] || "24000");

      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const pcmData = new Int16Array(len / 2);
      for (let i = 0; i < len; i += 2) {
        pcmData[i / 2] = (binaryString.charCodeAt(i + 1) << 8) | binaryString.charCodeAt(i);
      }

      const highQualityPcm = normalizeAudio(pcmData);
      const wavBlob = pcmToWav(highQualityPcm, sampleRate);
      return URL.createObjectURL(wavBlob);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Synthesis failed');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { synthesize, isLoading, error };
}
