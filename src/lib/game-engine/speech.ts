/**
 * Web Speech API wrapper for pronouncing English words.
 */
let activeAudio: HTMLAudioElement | null = null;
let activeUtterance: SpeechSynthesisUtterance | null = null;
let pendingSpeechTimer: ReturnType<typeof setTimeout> | null = null;
let speechGeneration = 0;
let speechCancellationPending = false;

function cancelSpeechSynthesis(synthesis: SpeechSynthesis) {
  synthesis.cancel();
  speechCancellationPending = true;
  setTimeout(() => { speechCancellationPending = false; }, 0);
}

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
  speechGeneration += 1;
  if (pendingSpeechTimer) {
    clearTimeout(pendingSpeechTimer);
    pendingSpeechTimer = null;
  }
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }

  if (typeof window !== 'undefined' && window.speechSynthesis
    && (activeUtterance || window.speechSynthesis.speaking || window.speechSynthesis.pending)) {
    cancelSpeechSynthesis(window.speechSynthesis);
  }
  activeUtterance = null;
}

export function speakEnglish(text: string, rate = 0.9) {
  if (typeof window === 'undefined' || !window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') {
    console.warn('Speech synthesis not supported in this browser.');
    return;
  }

  // Clean the text from symbols/IPA slash patterns
  const cleanText = text.replace(/[\/\\#]/g, '').trim();
  if (!cleanText) return;

  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }
  if (pendingSpeechTimer) {
    clearTimeout(pendingSpeechTimer);
    pendingSpeechTimer = null;
  }

  const synthesis = window.speechSynthesis;
  const mustCancelPreviousSpeech = Boolean(activeUtterance || synthesis.speaking || synthesis.pending);
  const mustWaitForCancellation = speechCancellationPending;
  const generation = ++speechGeneration;

  const speak = () => {
    pendingSpeechTimer = null;
    if (generation !== speechGeneration) return;
    const utterance = new SpeechSynthesisUtterance(cleanText);
    activeUtterance = utterance;
    utterance.lang = 'en-US';
    const voices = synthesis.getVoices();
    const englishVoice = voices.find(voice => voice.lang === 'en-US' || voice.lang.includes('en_US'))
      || voices.find(voice => voice.lang.toLowerCase().startsWith('en'));
    if (englishVoice) utterance.voice = englishVoice;
    utterance.rate = normalizeAudioPlaybackRate(rate);
    const release = () => {
      if (activeUtterance === utterance) activeUtterance = null;
    };
    utterance.onend = release;
    utterance.onerror = release;
    if (synthesis.paused) synthesis.resume();
    synthesis.speak(utterance);
  };

  if (mustCancelPreviousSpeech) {
    cancelSpeechSynthesis(synthesis);
    activeUtterance = null;
    // Chromium needs a new task after cancel() or it can silently discard speak().
    pendingSpeechTimer = setTimeout(speak, 0);
    return;
  }
  if (mustWaitForCancellation) {
    pendingSpeechTimer = setTimeout(speak, 0);
    return;
  }
  // Do not cancel an idle engine: doing so immediately before speak() is the
  // cause of silent browser fallback on Chromium-based browsers.
  speak();
}

export function playAudioUrl(audioUrl: string, fallbackText?: string, playbackRate = 1) {
  if (typeof window === 'undefined') return;
  stopManagedAudio();
  const audio = new Audio(audioUrl);
  activeAudio = audio;
  audio.volume = 0.85;
  audio.playbackRate = normalizeAudioPlaybackRate(playbackRate);
  let fallbackStarted = false;
  const fallbackToSpeech = () => {
    if (fallbackStarted || activeAudio !== audio) return;
    fallbackStarted = true;
    activeAudio = null;
    audio.removeEventListener('error', fallbackToSpeech);
    if (fallbackText?.trim()) speakEnglish(fallbackText, playbackRate);
  };
  audio.addEventListener('ended', () => {
    if (activeAudio === audio) activeAudio = null;
  }, { once: true });
  // play() may resolve before the media decoder or network reports failure.
  // The media error event is therefore required in addition to the promise.
  audio.addEventListener('error', fallbackToSpeech, { once: true });
  audio.play().catch(fallbackToSpeech);
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
