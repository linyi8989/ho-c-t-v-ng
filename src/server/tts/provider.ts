interface TtsVoiceProviderOptions {
  getApiKey: () => string;
  fetchWithTimeout: (url: string, init?: RequestInit) => Promise<any>;
}

export function createTtsVoiceProvider(options: TtsVoiceProviderOptions) {
  return {
    async listVoices(query: any) {
      const apiKey = options.getApiKey();
      if (!apiKey) {
        throw Object.assign(new Error('AI33_API_KEY/TTS_API_KEY is not configured.'), { status: 500 });
      }
      const params = new URLSearchParams();
      params.set('provider', String(query.provider || 'edge'));
      if (query.language) params.set('language', String(query.language));
      if (query.gender) params.set('gender', String(query.gender));
      if (query.search || query.q) params.set('q', String(query.search || query.q));
      params.set('page_size', String(query.page_size || query.limit || 50));
      const upstream = await options.fetchWithTimeout(`https://api.ai33.pro/v3/voices?${params.toString()}`, {
        headers: { 'xi-api-key': apiKey },
      });
      return {
        status: upstream.status,
        data: await upstream.json().catch(() => ({})),
      };
    },
  };
}
