/* ==========================================================================
   Previo HUD — Voice Input for AI Entry (Web Speech API)
   ==========================================================================
   Feature-detected and hidden entirely where unsupported — browser support
   is solid on Chrome (desktop and Android) but notably inconsistent on iOS
   Safari. Transcribes speech into the AI sheet's textarea for the person to
   review before submitting; it never auto-submits, since a misheard word in
   a financial entry is easy to miss if it goes straight through. */

const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

export function voiceInputSupported() {
  return !!SpeechRecognitionAPI;
}

let recognition = null;
let isListening = false;

const ERROR_MESSAGES = {
  'no-speech': 'Não ouvi nada. Tente de novo.',
  'not-allowed': 'Permissão de microfone negada.',
  'audio-capture': 'Nenhum microfone encontrado.',
  'network': 'Erro de rede no reconhecimento de voz.'
};

// Starts listening once and calls onResult(transcript) when speech is
// recognized, or onError(message) if something goes wrong (permission
// denied, no speech detected, etc). onEnd() always fires when listening
// stops, whatever caused it — a result, an error, or the person tapping
// the mic again to cancel.
export function startVoiceInput({ onStart, onResult, onError, onEnd } = {}) {
  if (!voiceInputSupported()) {
    if (onError) onError('Reconhecimento de voz não é suportado neste navegador.');
    return;
  }
  if (isListening) return;

  recognition = new SpeechRecognitionAPI();
  recognition.lang = 'pt-BR';
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  isListening = true;

  recognition.onstart = () => { if (onStart) onStart(); };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    if (onResult) onResult(transcript);
  };

  recognition.onerror = (event) => {
    if (onError) onError(ERROR_MESSAGES[event.error] || 'Não foi possível reconhecer a fala.');
  };

  recognition.onend = () => {
    isListening = false;
    if (onEnd) onEnd();
  };

  try {
    recognition.start();
  } catch (e) {
    isListening = false;
    if (onError) onError('Não foi possível iniciar o microfone.');
  }
}

export function stopVoiceInput() {
  if (recognition && isListening) {
    recognition.stop();
  }
}
