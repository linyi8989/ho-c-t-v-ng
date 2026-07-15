/**
 * Web Speech API wrapper for pronouncing English words.
 */
let activeAudio: HTMLAudioElement | null = null;

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

export function speakEnglish(text: string) {
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
  
  utterance.rate = 0.9; // Slightly slower for better learning clarity
  window.speechSynthesis.speak(utterance);
}

export function playAudioUrl(audioUrl: string, fallbackText?: string) {
  if (typeof window === 'undefined') return;
  stopManagedAudio();
  const audio = new Audio(audioUrl);
  activeAudio = audio;
  audio.volume = 0.85;
  audio.addEventListener('ended', () => {
    if (activeAudio === audio) activeAudio = null;
  }, { once: true });
  audio.play().catch(() => {
    if (activeAudio === audio) activeAudio = null;
    if (fallbackText) speakEnglish(fallbackText);
  });
}

export function playVocabAudio(item: { term?: string; audioUrl?: string } | undefined, fallbackText?: string) {
  const text = fallbackText || item?.term || '';
  if (item?.audioUrl) {
    playAudioUrl(item.audioUrl, text);
    return;
  }
  if (text.trim()) speakEnglish(text);
}
