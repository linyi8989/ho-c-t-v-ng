/**
 * Web Speech API wrapper for pronouncing English words.
 */
let activeAudio: HTMLAudioElement | null = null;

export function normalizeAudioPlaybackRate(value?: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(1.5, Math.max(0.5, parsed)) : 1;
}

export function resolveTtsPlaybackRate(provider?: string, speed?: number) {
  return provider?.toLowerCase() === 'yupvox'
    ? normalizeAudioPlaybackRate(speed)
    : 1;
}

export function stopManagedAudio() {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }

  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

export function speakEnglish(text: string, rate = 0.9) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    console.warn('Speech synthesis not supported in this browser.');
    return;
  }

  stopManagedAudio();

  // Clean the text from symbols/IPA slash patterns
  const cleanText = text.replace(/[\/\\#]/g, '').trim();
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = 'en-US';
  
  // Try to find a standard US English voice
  const voices = window.speechSynthesis.getVoices();
  const usVoice = voices.find(v => v.lang === 'en-US' || v.lang.includes('en_US'));
  if (usVoice) {
    utterance.voice = usVoice;
  }
  
  utterance.rate = normalizeAudioPlaybackRate(rate);
  window.speechSynthesis.speak(utterance);
}

export function playAudioUrl(audioUrl: string, fallbackText?: string, playbackRate = 1) {
  if (typeof window === 'undefined') return;
  stopManagedAudio();
  const audio = new Audio(audioUrl);
  activeAudio = audio;
  audio.volume = 0.85;
  audio.playbackRate = normalizeAudioPlaybackRate(playbackRate);
  audio.addEventListener('ended', () => {
    if (activeAudio === audio) activeAudio = null;
  }, { once: true });
  audio.play().catch(() => {
    if (activeAudio === audio) activeAudio = null;
    if (fallbackText) speakEnglish(fallbackText, playbackRate);
  });
}

export function playVocabAudio(
  item: { term?: string; audioUrl?: string; ttsProvider?: string; ttsSpeed?: number } | undefined,
  fallbackText?: string
) {
  const text = fallbackText || item?.term || '';
  if (item?.audioUrl) {
    playAudioUrl(item.audioUrl, text, resolveTtsPlaybackRate(item.ttsProvider, item.ttsSpeed));
    return;
  }
  if (text.trim()) speakEnglish(text);
}
