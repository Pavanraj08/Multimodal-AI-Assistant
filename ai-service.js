// ===== AI SERVICE (Ollama + Gemini API) =====

class AIService {
  constructor() {
    this.backend = localStorage.getItem('ai_backend') || 'gemini'; // 'ollama' or 'gemini'
    this.ollamaUrl = localStorage.getItem('ollama_url') || 'http://localhost:11434';
    this.geminiKey = localStorage.getItem('gemini_key') || '';
    this.geminiModel = 'gemini-2.0-flash';
    this.geminiEndpoint = 'https://generativelanguage.googleapis.com/v1beta';
    this.model = localStorage.getItem('ai_model') || '';
    this.isConnected = false;
    this.models = [];
    this.abortController = null;
  }

  // ===== CONNECTION =====
  async checkConnection() {
    if (this.backend === 'gemini') return this.checkGeminiConnection();
    return this.checkOllamaConnection();
  }

  async checkOllamaConnection() {
    try {
      const res = await fetch(`${this.ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        this.models = (data.models || []).map(m => ({
          name: m.name,
          size: m.size,
          details: m.details || {}
        }));
        this.isConnected = true;
        if (!this.model && this.models.length > 0) {
          this.model = this.models[0].name;
          localStorage.setItem('ai_model', this.model);
        }
        return true;
      }
    } catch (e) { /* ignore */ }
    this.isConnected = false;
    return false;
  }

  async checkGeminiConnection() {
    if (!this.geminiKey) {
      this.isConnected = false;
      return false;
    }
    try {
      const res = await fetch(
        `${this.geminiEndpoint}/models?key=${this.geminiKey}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (res.ok) {
        const data = await res.json();
        this.models = (data.models || [])
          .filter(m => m.name.includes('gemini'))
          .map(m => ({
            name: m.name.replace('models/', ''),
            displayName: m.displayName || m.name.replace('models/', ''),
            details: { inputTokenLimit: m.inputTokenLimit }
          }));
        this.isConnected = true;
        this.model = this.geminiModel;
        return true;
      } else {
        const err = await res.json().catch(() => ({}));
        console.error('Gemini auth error:', err);
      }
    } catch (e) {
      console.error('Gemini connection error:', e);
    }
    this.isConnected = false;
    return false;
  }

  setModel(name) {
    this.model = name;
    localStorage.setItem('ai_model', name);
  }

  setBackend(backend) {
    this.backend = backend;
    localStorage.setItem('ai_backend', backend);
    this.isConnected = false;
  }

  setGeminiKey(key) {
    this.geminiKey = key;
    localStorage.setItem('gemini_key', key);
  }

  // ===== VISION MODEL DETECTION =====
  getVisionModels() {
    if (this.backend === 'gemini') {
      return this.models.filter(m => m.name.includes('flash') || m.name.includes('pro'));
    }
    const visionKeywords = ['llava', 'vision', 'bakllava', 'moondream', 'minicpm-v', 'gemma3'];
    return this.models.filter(m =>
      visionKeywords.some(k => m.name.toLowerCase().includes(k))
    );
  }

  hasVisionModel() {
    if (this.backend === 'gemini') return true; // Gemini always supports vision
    return this.getVisionModels().length > 0;
  }

  getBestVisionModel() {
    if (this.backend === 'gemini') return this.geminiModel;
    const visionModels = this.getVisionModels();
    return visionModels.length > 0 ? visionModels[0].name : null;
  }

  // ===== CHAT (UNIFIED) =====
  async *chat(messages, options = {}) {
    if (!this.isConnected) throw new Error(`Not connected to ${this.backend}`);
    if (this.backend === 'gemini') {
      yield* this._chatGemini(messages, options);
    } else {
      yield* this._chatOllama(messages, options);
    }
  }

  // ===== OLLAMA CHAT =====
  async *_chatOllama(messages, options = {}) {
    this.abortController = new AbortController();
    const useModel = options.model || this.model;

    const body = { model: useModel, messages: messages, stream: true };

    if (options.images && options.images.length > 0) {
      const lastMsg = body.messages[body.messages.length - 1];
      if (lastMsg.role === 'user') {
        lastMsg.images = options.images;
      }
    }

    try {
      const res = await fetch(`${this.ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: this.abortController.signal
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Ollama error: ${err}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const json = JSON.parse(line);
            if (json.message && json.message.content) yield json.message.content;
            if (json.done) return;
          } catch (e) { /* skip */ }
        }
      }
    } catch (e) {
      if (e.name === 'AbortError') return;
      throw e;
    }
  }

  // ===== GEMINI CHAT =====
  async *_chatGemini(messages, options = {}) {
    this.abortController = new AbortController();
    const model = options.model || this.geminiModel;

    // Convert messages to Gemini format
    let systemInstruction = null;
    const contents = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction = { parts: [{ text: msg.content }] };
        continue;
      }

      const parts = [];
      parts.push({ text: msg.content });

      // Add images for user messages
      if (msg.role === 'user' && options.images && options.images.length > 0 && msg === messages[messages.length - 1]) {
        for (const img of options.images) {
          parts.push({
            inline_data: {
              mime_type: 'image/jpeg',
              data: img
            }
          });
        }
      }

      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: parts
      });
    }

    // Ensure alternating roles (Gemini requirement)
    const cleanedContents = this._ensureAlternatingRoles(contents);

    const body = { contents: cleanedContents };
    if (systemInstruction) body.systemInstruction = systemInstruction;

    const url = `${this.geminiEndpoint}/models/${model}:streamGenerateContent?alt=sse&key=${this.geminiKey}`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: this.abortController.signal
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
        const msg = err.error?.message || `HTTP ${res.status}`;
        throw new Error(`Gemini error: ${msg}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;
          try {
            const json = JSON.parse(jsonStr);
            const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) yield text;
          } catch (e) { /* skip */ }
        }
      }
    } catch (e) {
      if (e.name === 'AbortError') return;
      throw e;
    }
  }

  // Gemini requires strictly alternating user/model roles
  _ensureAlternatingRoles(contents) {
    if (contents.length === 0) return contents;
    const result = [contents[0]];
    for (let i = 1; i < contents.length; i++) {
      if (contents[i].role === result[result.length - 1].role) {
        // Merge consecutive same-role messages
        const last = result[result.length - 1];
        last.parts = [...last.parts, ...contents[i].parts];
      } else {
        result.push(contents[i]);
      }
    }
    // Ensure first message is from user
    if (result.length > 0 && result[0].role !== 'user') {
      result.unshift({ role: 'user', parts: [{ text: 'Hello' }] });
    }
    return result;
  }

  abort() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}
