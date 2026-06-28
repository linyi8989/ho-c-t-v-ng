/**
 * Web Speech API wrapper for pronouncing English words.
 */
export function speakEnglish(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    console.warn('Speech synthesis not supported in this browser.');
    return;
  }

  // Cancel any ongoing speeches
  window.speechSynthesis.cancel();

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
