interface TtsServiceOptions {
  normalizeSettings: (value: any) => any;
  sanitizeInput: (value: any) => { text: string; warnings: string[] };
  createAudioHash: (text: string, settings: any) => string;
  generateCachedAudio: (text: string, settings: any, force?: boolean) => Promise<any>;
  runWithConcurrency: (items: any[], limit: number, worker: (item: any) => Promise<any>) => Promise<any[]>;
  concurrency: number;
  voiceProvider: { listVoices(query: any): Promise<{ status: number; data: any }> };
}

function ttsHttpError(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}

export function createTtsService(options: TtsServiceOptions) {
  const preview = async (payload: any) => {
    const settings = options.normalizeSettings(payload?.settings || payload || {});
    const text = String(payload?.text || 'apple').trim();
    const force = Boolean(payload?.force);
    if (!text) throw ttsHttpError(400, 'Missing preview text.');
    const result = await options.generateCachedAudio(text, settings, force);
    return {
      audioUrl: result.audioUrl,
      audioHash: result.audioHash,
      cached: result.cached,
      ttsText: result.ttsText,
      warnings: result.warnings,
    };
  };

  const batchPreview = async (payload: any) => {
    const settings = options.normalizeSettings(payload?.settings || {});
    const force = Boolean(payload?.force);
    const rawItems = Array.isArray(payload?.items) ? payload.items.slice(0, 200) : [];
    if (rawItems.length === 0) throw ttsHttpError(400, 'Missing TTS items.');
    const prepared = rawItems.map((item: any, index: number) => {
      const text = String(item?.text || item?.term || '').trim();
      const sanitized = options.sanitizeInput(text);
      return {
        id: String(item?.id || `item-${index + 1}`),
        text,
        sanitized,
        audioHash: sanitized.text ? options.createAudioHash(sanitized.text, settings) : '',
      };
    });
    const grouped = new Map<string, typeof prepared>();
    const invalidResults = new Map<string, any>();
    for (const item of prepared) {
      if (!item.sanitized.text) {
        invalidResults.set(item.id, {
          id: item.id,
          audioStatus: 'failed',
          audioError: 'Missing TTS text after cleanup.',
          ttsText: '',
          warnings: item.sanitized.warnings,
        });
        continue;
      }
      const group = grouped.get(item.audioHash) || [];
      group.push(item);
      grouped.set(item.audioHash, group);
    }
    const generated = await options.runWithConcurrency(
      [...grouped.entries()],
      options.concurrency,
      async ([audioHash, group]: [string, typeof prepared]) => {
        try {
          const result = await options.generateCachedAudio(group[0].sanitized.text, settings, force);
          return { audioHash, result, error: null as any };
        } catch (error: any) {
          return { audioHash, result: null as any, error };
        }
      },
    );
    const generatedByHash = new Map(generated.map(item => [item.audioHash, item]));
    const items = prepared.map(item => {
      const invalid = invalidResults.get(item.id);
      if (invalid) return invalid;
      const generatedResult = generatedByHash.get(item.audioHash);
      if (!generatedResult || generatedResult.error) {
        return {
          id: item.id, audioHash: item.audioHash, audioStatus: 'failed',
          audioError: generatedResult?.error?.message || 'TTS generation failed.',
          ttsText: item.sanitized.text, warnings: item.sanitized.warnings,
          ttsProvider: settings.provider, ttsVoice: settings.voice,
          ttsLang: settings.lang, ttsSpeed: settings.speed,
        };
      }
      return {
        id: item.id,
        audioUrl: generatedResult.result.audioUrl,
        audioHash: generatedResult.result.audioHash,
        audioStatus: 'ready',
        audioError: '',
        cached: generatedResult.result.cached,
        ttsText: generatedResult.result.ttsText,
        warnings: generatedResult.result.warnings,
        ttsProvider: settings.provider,
        ttsVoice: settings.voice,
        ttsLang: settings.lang,
        ttsSpeed: settings.speed,
      };
    });
    return { items, concurrency: options.concurrency };
  };

  return {
    batchPreview,
    listVoices: (query: any) => options.voiceProvider.listVoices(query),
    preview,
  };
}
