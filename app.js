// ===== MULTIMODAL AI ASSISTANT - MAIN APP =====

class MultimodalAssistant {
  constructor() {
    this.ai = new AIService();
    this.ocr = new OCREngine();
    this.voice = new VoiceHandler();
    this.rag = new RAGPipeline();

    this.conversations = JSON.parse(localStorage.getItem('conversations') || '[]');
    this.currentConvId = null;
    this.messages = [];
    this.attachedFiles = []; // { id, file, base64, dataUrl, name }
    this.isGenerating = false;

    this.init();
  }

  async init() {
    this.bindElements();
    this.bindEvents();
    this.setupVoice();
    this.renderConversations();

    // Load last conversation or show welcome
    if (this.conversations.length > 0) {
      this.loadConversation(this.conversations[0].id);
    }

    // Check connection
    const connected = await this.checkConnection();
    // Auto-open settings if Gemini backend and no key
    if (!connected && this.ai.backend === 'gemini' && !this.ai.geminiKey) {
      this.openSettings();
      showToast('Please enter your Gemini API key to get started', 'info');
    }
    // Re-check every 15s
    setInterval(() => this.checkConnection(), 15000);
  }

  bindElements() {
    this.$ = {
      sidebar: document.getElementById('sidebar'),
      sidebarOverlay: document.getElementById('sidebarOverlay'),
      conversationList: document.getElementById('conversationList'),
      chatContainer: document.getElementById('chatContainer'),
      welcomeScreen: document.getElementById('welcomeScreen'),
      messagesWrapper: document.getElementById('messagesWrapper'),
      messageInput: document.getElementById('messageInput'),
      btnSend: document.getElementById('btnSend'),
      btnAttach: document.getElementById('btnAttach'),
      btnVoice: document.getElementById('btnVoice'),
      btnNewChat: document.getElementById('btnNewChat'),
      btnSidebarToggle: document.getElementById('btnSidebarToggle'),
      btnSettings: document.getElementById('btnSettings'),
      btnDocPanel: document.getElementById('btnDocPanel'),
      btnCloseDocPanel: document.getElementById('btnCloseDocPanel'),
      fileInput: document.getElementById('fileInput'),
      attachmentsPreview: document.getElementById('attachmentsPreview'),
      modelSelector: document.getElementById('modelSelector'),
      headerModelBadge: document.getElementById('headerModelBadge'),
      statusDot: document.getElementById('statusDot'),
      statusText: document.getElementById('statusText'),
      settingsModal: document.getElementById('settingsModal'),
      docPanel: document.getElementById('docPanel'),
      docUploadZone: document.getElementById('docUploadZone'),
      docFileInput: document.getElementById('docFileInput'),
      docList: document.getElementById('docList'),
      contextBanner: document.getElementById('contextBanner'),
      contextInfo: document.getElementById('contextInfo'),
      lightbox: document.getElementById('lightbox'),
      lightboxImg: document.getElementById('lightboxImg'),
    };
  }

  bindEvents() {
    // Input
    this.$.messageInput.addEventListener('input', () => this.onInputChange());
    this.$.messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Buttons
    this.$.btnSend.addEventListener('click', () => this.sendMessage());
    this.$.btnAttach.addEventListener('click', () => this.$.fileInput.click());
    this.$.btnVoice.addEventListener('click', () => this.toggleVoice());
    this.$.btnNewChat.addEventListener('click', () => this.newConversation());
    this.$.btnSidebarToggle.addEventListener('click', () => this.toggleSidebar());
    this.$.sidebarOverlay.addEventListener('click', () => this.toggleSidebar());
    this.$.btnSettings.addEventListener('click', () => this.openSettings());
    this.$.btnDocPanel.addEventListener('click', () => this.toggleDocPanel());
    this.$.btnCloseDocPanel.addEventListener('click', () => this.toggleDocPanel());

    // Document upload from input bar
    const btnDocUpload = document.getElementById('btnDocUpload');
    const docFileInputMain = document.getElementById('docFileInputMain');
    if (btnDocUpload && docFileInputMain) {
      btnDocUpload.addEventListener('click', () => docFileInputMain.click());
      docFileInputMain.addEventListener('change', (e) => {
        this.handleDocUpload(e.target.files);
        if (!this.$.docPanel.classList.contains('hidden')) { /* already visible */ }
        else { this.toggleDocPanel(); }
        docFileInputMain.value = '';
      });
    }

    // File inputs
    this.$.fileInput.addEventListener('change', (e) => this.handleFileAttach(e.target.files));
    this.$.docFileInput.addEventListener('change', (e) => this.handleDocUpload(e.target.files));

    // Model selector
    this.$.modelSelector.addEventListener('change', (e) => {
      this.ai.setModel(e.target.value);
      this.$.headerModelBadge.textContent = e.target.value.split(':')[0];
    });

    // Doc upload zone
    this.$.docUploadZone.addEventListener('click', () => this.$.docFileInput.click());
    this.$.docUploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.currentTarget.classList.add('dragover');
    });
    this.$.docUploadZone.addEventListener('dragleave', (e) => {
      e.currentTarget.classList.remove('dragover');
    });
    this.$.docUploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.currentTarget.classList.remove('dragover');
      this.handleDocUpload(e.dataTransfer.files);
    });

    // Context banner
    document.getElementById('btnClearContext').addEventListener('click', () => {
      this.rag.clear();
      this.$.contextBanner.style.display = 'none';
      this.$.docList.innerHTML = '';
      showToast('Document context cleared', 'info');
    });

    // Feature cards
    document.querySelectorAll('.feature-card').forEach(card => {
      card.addEventListener('click', () => {
        const prompt = card.dataset.prompt;
        const action = card.dataset.action;
        if (prompt) {
          this.$.messageInput.value = prompt;
          this.onInputChange();
          this.$.messageInput.focus();
        } else if (action === 'voice') {
          this.toggleVoice();
        } else if (action === 'upload') {
          this.toggleDocPanel();
        }
      });
    });

    // Settings modal
    document.getElementById('btnCancelSettings').addEventListener('click', () => this.closeSettings());
    document.getElementById('btnSaveSettings').addEventListener('click', () => this.saveSettings());

    // Lightbox
    this.$.lightbox.addEventListener('click', () => {
      this.$.lightbox.classList.remove('active');
    });

    // Drag and drop on chat
    this.$.chatContainer.addEventListener('dragover', (e) => e.preventDefault());
    this.$.chatContainer.addEventListener('drop', (e) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      if (files.length > 0) this.handleFileAttach(files);
    });
  }

  // ===== CONNECTION =====
  async checkConnection() {
    const connected = await this.ai.checkConnection();
    this.$.statusDot.classList.toggle('connected', connected);
    const backendName = this.ai.backend === 'gemini' ? 'Gemini' : 'Ollama';
    this.$.statusText.textContent = connected
      ? `${backendName} connected (${this.ai.models.length} models)`
      : this.ai.backend === 'gemini' && !this.ai.geminiKey
        ? 'Set API key in ⚙️ Settings'
        : `${backendName} not connected`;

    if (connected) {
      this.populateModelSelector();
    }
    return connected;
  }

  populateModelSelector() {
    this.$.modelSelector.innerHTML = '';
    if (this.ai.models.length === 0) {
      this.$.modelSelector.innerHTML = '<option value="">No models found</option>';
      this.$.headerModelBadge.textContent = 'No model';
      return;
    }
    this.ai.models.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.name;
      opt.textContent = m.name;
      if (m.name === this.ai.model) opt.selected = true;
      this.$.modelSelector.appendChild(opt);
    });
    this.$.headerModelBadge.textContent = (this.ai.model || this.ai.models[0].name).split(':')[0];
  }

  // ===== CONVERSATIONS =====
  newConversation() {
    const conv = {
      id: generateId(),
      title: 'New chat',
      messages: [],
      createdAt: Date.now()
    };
    this.conversations.unshift(conv);
    this.saveConversations();
    this.loadConversation(conv.id);
    this.renderConversations();
    this.closeSidebar();
  }

  loadConversation(id) {
    const conv = this.conversations.find(c => c.id === id);
    if (!conv) return;
    this.currentConvId = id;
    this.messages = conv.messages || [];
    this.attachedFiles = [];
    this.$.attachmentsPreview.innerHTML = '';
    this.renderMessages();
    this.renderConversations();
  }

  deleteConversation(id, e) {
    e.stopPropagation();
    this.conversations = this.conversations.filter(c => c.id !== id);
    this.saveConversations();
    if (this.currentConvId === id) {
      if (this.conversations.length > 0) {
        this.loadConversation(this.conversations[0].id);
      } else {
        this.currentConvId = null;
        this.messages = [];
        this.showWelcome();
      }
    }
    this.renderConversations();
  }

  saveConversations() {
    localStorage.setItem('conversations', JSON.stringify(this.conversations));
  }

  updateCurrentConversation() {
    const conv = this.conversations.find(c => c.id === this.currentConvId);
    if (conv) {
      conv.messages = this.messages;
      // Auto-title from first user message
      if (conv.title === 'New chat' && this.messages.length > 0) {
        const first = this.messages.find(m => m.role === 'user');
        if (first) conv.title = first.content.substring(0, 40) + (first.content.length > 40 ? '...' : '');
      }
      this.saveConversations();
      this.renderConversations();
    }
  }

  renderConversations() {
    this.$.conversationList.innerHTML = '';
    this.conversations.forEach(conv => {
      const el = document.createElement('div');
      el.className = `conv-item ${conv.id === this.currentConvId ? 'active' : ''}`;
      el.innerHTML = `
        <span>💬</span>
        <span class="conv-title">${escapeHtml(conv.title)}</span>
        <button class="conv-delete" title="Delete">🗑</button>
      `;
      el.addEventListener('click', () => this.loadConversation(conv.id));
      el.querySelector('.conv-delete').addEventListener('click', (e) => this.deleteConversation(conv.id, e));
      this.$.conversationList.appendChild(el);
    });
  }

  // ===== MESSAGES =====
  renderMessages() {
    if (this.messages.length === 0) {
      this.showWelcome();
      return;
    }
    this.$.welcomeScreen.style.display = 'none';
    this.$.messagesWrapper.style.display = 'block';
    this.$.messagesWrapper.innerHTML = '';

    this.messages.forEach(msg => {
      this.$.messagesWrapper.appendChild(this.createMessageElement(msg));
    });
    this.scrollToBottom();
  }

  createMessageElement(msg) {
    const el = document.createElement('div');
    el.className = `message ${msg.role}`;
    const avatarText = msg.role === 'user' ? '👤' : '✦';

    let attachmentsHtml = '';
    if (msg.images && msg.images.length > 0) {
      attachmentsHtml = '<div class="message-attachments">' +
        msg.images.map(img => `<img class="message-image-thumb" src="${img}" alt="Attached image">`).join('') +
        '</div>';
    }

    const contentHtml = msg.role === 'assistant' ? renderMarkdown(msg.content) : escapeHtml(msg.content).replace(/\n/g, '<br>');
    const roleName = msg.role === 'user' ? 'You' : 'Assistant';

    el.innerHTML = `
      <div class="message-inner">
        <div class="message-avatar">${avatarText}</div>
        <div class="message-content">
          <div class="message-role">${roleName}</div>
          ${attachmentsHtml}
          <div class="message-text">${contentHtml}</div>
        </div>
      </div>
    `;

    // Lightbox for images
    el.querySelectorAll('.message-image-thumb').forEach(img => {
      img.addEventListener('click', () => {
        this.$.lightboxImg.src = img.src;
        this.$.lightbox.classList.add('active');
      });
    });

    // Copy buttons on code blocks
    el.querySelectorAll('pre').forEach(pre => {
      const btn = document.createElement('button');
      btn.className = 'code-copy-btn';
      btn.textContent = 'Copy';
      btn.addEventListener('click', () => {
        copyToClipboard(pre.textContent);
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy', 2000);
      });
      pre.style.position = 'relative';
      pre.appendChild(btn);
    });

    return el;
  }

  showWelcome() {
    this.$.welcomeScreen.style.display = 'flex';
    this.$.messagesWrapper.style.display = 'none';
  }

  addTypingIndicator() {
    const el = document.createElement('div');
    el.className = 'typing-indicator';
    el.id = 'typingIndicator';
    el.innerHTML = `
      <div class="typing-inner">
        <div class="message-avatar" style="background:linear-gradient(135deg,var(--accent),#c084fc);color:#000;font-weight:700;width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;">✦</div>
        <div class="typing-dots"><span></span><span></span><span></span></div>
      </div>
    `;
    this.$.messagesWrapper.appendChild(el);
    this.scrollToBottom();
  }

  removeTypingIndicator() {
    const el = document.getElementById('typingIndicator');
    if (el) el.remove();
  }

  scrollToBottom() {
    requestAnimationFrame(() => {
      this.$.chatContainer.scrollTop = this.$.chatContainer.scrollHeight;
    });
  }

  // ===== SEND MESSAGE =====
  async sendMessage() {
    const text = this.$.messageInput.value.trim();
    if ((!text && this.attachedFiles.length === 0) || this.isGenerating) return;
    if (!this.ai.isConnected) {
      const msg = this.ai.backend === 'gemini'
        ? 'Not connected. Please add your Gemini API key in ⚙️ Settings.'
        : 'Ollama is not connected. Make sure it is running on localhost:11434';
      showToast(msg, 'error');
      return;
    }

    // Ensure conversation exists
    if (!this.currentConvId) this.newConversation();

    // Build user message
    const userMsg = { role: 'user', content: text || 'What is in this image?', images: [] };
    const base64Images = [];

    // Save file data for OCR fallback before clearing
    this.attachedFilesData = [];
    this.attachedFilesNames = [];
    for (const f of this.attachedFiles) {
      userMsg.images.push(f.dataUrl);
      base64Images.push(f.base64);
      this.attachedFilesData.push(f.dataUrl);
      this.attachedFilesNames.push(f.name);
    }

    this.messages.push(userMsg);
    this.$.messageInput.value = '';
    this.onInputChange();
    this.attachedFiles = [];
    this.$.attachmentsPreview.innerHTML = '';

    // Show messages
    this.$.welcomeScreen.style.display = 'none';
    this.$.messagesWrapper.style.display = 'block';
    this.$.messagesWrapper.appendChild(this.createMessageElement(userMsg));
    this.scrollToBottom();

    // Prepare API messages
    const apiMessages = [];

    // System prompt (RAG context + custom)
    const customPrompt = localStorage.getItem('system_prompt') || '';
    const ragPrompt = this.rag.hasDocuments() ? this.rag.getSystemPrompt(text) : '';
    const systemContent = [ragPrompt, customPrompt].filter(Boolean).join('\n\n');
    if (systemContent) {
      apiMessages.push({ role: 'system', content: systemContent });
    }

    // Conversation history (last 20 messages)
    const history = this.messages.slice(-20);
    for (const m of history) {
      apiMessages.push({ role: m.role, content: m.content });
    }

    // Determine model and handle images
    let options = {};
    let ocrImageText = '';

    if (base64Images.length > 0) {
      const visionModel = this.ai.getBestVisionModel();
      if (visionModel && this.ai.backend === 'ollama') {
        // Use vision model directly
        options.model = visionModel;
        options.images = base64Images;
      } else if (this.ai.backend === 'gemini') {
        // Gemini always supports vision
        options.images = base64Images;
      } else {
        // No vision model — use OCR to extract text from images
        showToast('Analyzing image with OCR...', 'info');
        for (let i = 0; i < this.attachedFilesData.length; i++) {
          try {
            const result = await this.ocr.recognize(this.attachedFilesData[i]);
            if (result.text) {
              ocrImageText += `\n\n--- Image ${i + 1}: ${this.attachedFilesNames[i]} (OCR confidence: ${result.confidence.toFixed(0)}%) ---\n${result.text}`;
            } else {
              ocrImageText += `\n\n--- Image ${i + 1}: ${this.attachedFilesNames[i]} ---\n[No text detected in this image]`;
            }
          } catch (e) {
            ocrImageText += `\n\n--- Image ${i + 1} ---\n[OCR failed: ${e.message}]`;
          }
        }
      }
    }

    // If OCR text was extracted, inject it into the last user message
    if (ocrImageText) {
      const lastUserMsg = apiMessages[apiMessages.length - 1];
      lastUserMsg.content = `The user has attached image(s). Here is the text/content extracted from the image(s) via OCR:\n${ocrImageText}\n\nUser's message: ${lastUserMsg.content}\n\nPlease analyze the extracted content and respond to the user's question. Describe any structure, data, or information you can infer from the text.`;
    }

    // Generate response
    this.isGenerating = true;
    this.addTypingIndicator();
    const assistantMsg = { role: 'assistant', content: '' };

    try {
      let streamEl = null;
      for await (const chunk of this.ai.chat(apiMessages, options)) {
        if (!streamEl) {
          this.removeTypingIndicator();
          this.messages.push(assistantMsg);
          streamEl = this.createMessageElement(assistantMsg);
          this.$.messagesWrapper.appendChild(streamEl);
        }
        assistantMsg.content += chunk;
        const textEl = streamEl.querySelector('.message-text');
        textEl.innerHTML = renderMarkdown(assistantMsg.content);
        this.scrollToBottom();
      }
      // Add copy buttons to code blocks in final render
      if (streamEl) {
        streamEl.querySelectorAll('pre').forEach(pre => {
          if (!pre.querySelector('.code-copy-btn')) {
            const btn = document.createElement('button');
            btn.className = 'code-copy-btn';
            btn.textContent = 'Copy';
            btn.addEventListener('click', () => {
              copyToClipboard(pre.textContent.replace('Copy', '').trim());
              btn.textContent = 'Copied!';
              setTimeout(() => btn.textContent = 'Copy', 2000);
            });
            pre.style.position = 'relative';
            pre.appendChild(btn);
          }
        });
      }
    } catch (e) {
      this.removeTypingIndicator();
      showToast(`Error: ${e.message}`, 'error');
      console.error(e);
    } finally {
      this.isGenerating = false;
      this.updateCurrentConversation();
    }
  }

  // ===== INPUT =====
  onInputChange() {
    const input = this.$.messageInput;
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 160) + 'px';
    const hasContent = input.value.trim().length > 0 || this.attachedFiles.length > 0;
    this.$.btnSend.classList.toggle('active', hasContent);
  }

  // ===== FILE ATTACHMENT =====
  async handleFileAttach(fileList) {
    const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
    for (const file of files) {
      const base64 = await fileToBase64(file);
      const dataUrl = await fileToDataURL(file);
      const attachment = { id: generateId(), file, base64, dataUrl, name: file.name };
      this.attachedFiles.push(attachment);
      this.renderAttachmentChip(attachment);
    }
    this.onInputChange();
    this.$.fileInput.value = '';
  }

  renderAttachmentChip(attachment) {
    const chip = document.createElement('div');
    chip.className = 'attachment-chip';
    chip.id = `attach-${attachment.id}`;
    chip.innerHTML = `
      <img src="${attachment.dataUrl}" alt="${escapeHtml(attachment.name)}">
      <span>${escapeHtml(attachment.name)}</span>
      <button class="remove-attachment" title="Remove">✕</button>
    `;
    chip.querySelector('.remove-attachment').addEventListener('click', () => {
      this.attachedFiles = this.attachedFiles.filter(f => f.id !== attachment.id);
      chip.remove();
      this.onInputChange();
    });
    this.$.attachmentsPreview.appendChild(chip);
  }

  // ===== VOICE =====
  setupVoice() {
    if (!this.voice.isSupported()) {
      this.$.btnVoice.title = 'Voice not supported in this browser';
      this.$.btnVoice.style.opacity = '0.3';
      return;
    }
    this.voice.onResult((text) => {
      this.$.messageInput.value += text;
      this.onInputChange();
    });
    this.voice.onInterim((text) => {
      // Show interim in placeholder
      this.$.messageInput.placeholder = text || 'Listening...';
    });
    this.voice.onEnd(() => {
      this.$.btnVoice.classList.remove('recording');
      this.$.messageInput.placeholder = 'Send a message...';
    });
    this.voice.onError((err) => {
      this.$.btnVoice.classList.remove('recording');
      this.$.messageInput.placeholder = 'Send a message...';
      if (err !== 'aborted') showToast(`Voice error: ${err}`, 'error');
    });
  }

  toggleVoice() {
    if (!this.voice.isSupported()) {
      showToast('Voice input is not supported in this browser. Use Chrome or Edge.', 'error');
      return;
    }
    if (this.voice.isListening()) {
      this.voice.stop();
      this.$.btnVoice.classList.remove('recording');
    } else {
      const lang = localStorage.getItem('voice_lang') || 'en-US';
      this.voice.recognition.lang = lang;
      this.voice.start();
      this.$.btnVoice.classList.add('recording');
      this.$.messageInput.placeholder = 'Listening...';
    }
  }

  // ===== DOCUMENT PANEL & OCR =====
  toggleDocPanel() {
    this.$.docPanel.classList.toggle('hidden');
  }

  async handleDocUpload(fileList) {
    const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) return;

    for (const file of files) {
      const docId = generateId();
      const dataUrl = await fileToDataURL(file);

      // Add to doc list UI
      const item = document.createElement('div');
      item.className = 'doc-item';
      item.id = `doc-${docId}`;
      item.innerHTML = `
        <img class="doc-thumb" src="${dataUrl}" alt="${escapeHtml(file.name)}">
        <div class="doc-info">
          <div class="doc-name">${escapeHtml(file.name)}</div>
          <div class="doc-meta">${formatFileSize(file.size)}</div>
          <div class="doc-progress"><div class="doc-progress-bar" id="progress-${docId}" style="width:0%"></div></div>
        </div>
        <span class="doc-status extracting" id="status-${docId}">Extracting...</span>
      `;
      this.$.docList.appendChild(item);

      // Run OCR
      try {
        const result = await this.ocr.recognize(dataUrl, (progress) => {
          const bar = document.getElementById(`progress-${docId}`);
          if (bar) bar.style.width = Math.round(progress * 100) + '%';
        });

        // Update UI
        const statusEl = document.getElementById(`status-${docId}`);
        const progressEl = item.querySelector('.doc-progress');
        if (statusEl) { statusEl.className = 'doc-status ready'; statusEl.textContent = 'Ready'; }
        if (progressEl) progressEl.remove();

        // Add to RAG
        if (result.text) {
          this.rag.addDocument(docId, result.text, { name: file.name, confidence: result.confidence });
          this.$.contextBanner.style.display = 'flex';
          const docs = this.rag.getDocuments();
          this.$.contextInfo.textContent = `Using context from ${docs.length} document(s)`;
          showToast(`Extracted text from ${file.name} (${result.confidence.toFixed(0)}% confidence)`, 'success');
        } else {
          showToast(`No text found in ${file.name}`, 'warning');
          if (statusEl) { statusEl.className = 'doc-status error'; statusEl.textContent = 'No text'; }
        }
      } catch (e) {
        const statusEl = document.getElementById(`status-${docId}`);
        if (statusEl) { statusEl.className = 'doc-status error'; statusEl.textContent = 'Error'; }
        showToast(`OCR failed for ${file.name}: ${e.message}`, 'error');
      }
    }
    this.$.docFileInput.value = '';
  }

  // ===== SIDEBAR =====
  toggleSidebar() {
    this.$.sidebar.classList.toggle('open');
    this.$.sidebarOverlay.classList.toggle('active');
  }

  closeSidebar() {
    this.$.sidebar.classList.remove('open');
    this.$.sidebarOverlay.classList.remove('active');
  }

  // ===== SETTINGS =====
  openSettings() {
    const backendEl = document.getElementById('settingsBackend');
    const geminiKeyEl = document.getElementById('settingsGeminiKey');
    const geminiKeyGroup = document.getElementById('geminiKeyGroup');
    const ollamaUrlGroup = document.getElementById('ollamaUrlGroup');

    backendEl.value = this.ai.backend;
    geminiKeyEl.value = this.ai.geminiKey;
    document.getElementById('settingsUrl').value = this.ai.ollamaUrl;
    document.getElementById('settingsSystemPrompt').value = localStorage.getItem('system_prompt') || '';
    document.getElementById('settingsVoiceLang').value = localStorage.getItem('voice_lang') || 'en-US';

    // Toggle visibility based on backend
    const toggleBackendFields = () => {
      const isGemini = backendEl.value === 'gemini';
      geminiKeyGroup.style.display = isGemini ? 'block' : 'none';
      ollamaUrlGroup.style.display = isGemini ? 'none' : 'block';
    };
    toggleBackendFields();
    backendEl.onchange = toggleBackendFields;

    this.$.settingsModal.classList.add('active');
  }

  closeSettings() {
    this.$.settingsModal.classList.remove('active');
  }

  saveSettings() {
    const backend = document.getElementById('settingsBackend').value;
    const geminiKey = document.getElementById('settingsGeminiKey').value.trim();
    const ollamaUrl = document.getElementById('settingsUrl').value.trim();
    const sysPrompt = document.getElementById('settingsSystemPrompt').value.trim();
    const voiceLang = document.getElementById('settingsVoiceLang').value;

    this.ai.setBackend(backend);
    if (geminiKey) this.ai.setGeminiKey(geminiKey);
    if (ollamaUrl) this.ai.ollamaUrl = ollamaUrl;
    localStorage.setItem('system_prompt', sysPrompt);
    localStorage.setItem('voice_lang', voiceLang);

    this.closeSettings();
    this.checkConnection();
    showToast('Settings saved', 'success');
  }
}

// ===== BOOT =====
document.addEventListener('DOMContentLoaded', () => {
  window.app = new MultimodalAssistant();
});
