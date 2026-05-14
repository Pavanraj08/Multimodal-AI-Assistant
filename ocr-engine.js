// ===== OCR ENGINE (Tesseract.js) =====

class OCREngine {
  constructor() {
    this.worker = null;
    this.ready = false;
    this.initializing = false;
  }

  async initialize() {
    if (this.ready || this.initializing) return;
    this.initializing = true;

    try {
      if (typeof Tesseract === 'undefined') {
        throw new Error('Tesseract.js not loaded');
      }
      this.worker = await Tesseract.createWorker('eng', 1, {
        logger: m => {
          if (this._progressCallback && m.status === 'recognizing text') {
            this._progressCallback(m.progress);
          }
        }
      });
      this.ready = true;
    } catch (e) {
      console.error('OCR init failed:', e);
      this.ready = false;
      throw e;
    } finally {
      this.initializing = false;
    }
  }

  async recognize(imageSource, onProgress) {
    if (!this.ready) await this.initialize();

    this._progressCallback = onProgress || null;

    try {
      const result = await this.worker.recognize(imageSource);
      return {
        text: result.data.text.trim(),
        confidence: result.data.confidence,
        words: result.data.words ? result.data.words.length : 0
      };
    } catch (e) {
      console.error('OCR error:', e);
      throw new Error('Failed to extract text from image');
    }
  }

  isReady() {
    return this.ready;
  }

  async terminate() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.ready = false;
    }
  }
}
