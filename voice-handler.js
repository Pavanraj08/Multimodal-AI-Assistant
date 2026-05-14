// ===== VOICE HANDLER (Web Speech API) =====

class VoiceHandler {
  constructor() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.supported = !!SpeechRecognition;
    this.recognition = this.supported ? new SpeechRecognition() : null;
    this.listening = false;
    this._onResult = null;
    this._onInterim = null;
    this._onEnd = null;
    this._onError = null;

    if (this.recognition) {
      this.recognition.lang = 'en-US';
      this.recognition.continuous = false;
      this.recognition.interimResults = true;

      this.recognition.onresult = (e) => {
        let finalTranscript = '';
        let interimTranscript = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const transcript = e.results[i][0].transcript;
          if (e.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }
        if (interimTranscript && this._onInterim) {
          this._onInterim(interimTranscript);
        }
        if (finalTranscript && this._onResult) {
          this._onResult(finalTranscript);
        }
      };

      this.recognition.onend = () => {
        this.listening = false;
        if (this._onEnd) this._onEnd();
      };

      this.recognition.onerror = (e) => {
        this.listening = false;
        if (this._onError) this._onError(e.error);
      };
    }
  }

  start() {
    if (!this.supported) {
      if (this._onError) this._onError('Speech recognition not supported in this browser');
      return false;
    }
    try {
      this.recognition.start();
      this.listening = true;
      return true;
    } catch (e) {
      if (this._onError) this._onError(e.message);
      return false;
    }
  }

  stop() {
    if (this.recognition && this.listening) {
      this.recognition.stop();
      this.listening = false;
    }
  }

  isListening() { return this.listening; }
  isSupported() { return this.supported; }

  onResult(cb) { this._onResult = cb; }
  onInterim(cb) { this._onInterim = cb; }
  onEnd(cb) { this._onEnd = cb; }
  onError(cb) { this._onError = cb; }
}
