// ===== RAG PIPELINE =====

class RAGPipeline {
  constructor() {
    this.documents = new Map(); // id -> { text, metadata, chunks }
  }

  addDocument(id, text, metadata = {}) {
    const chunks = this._chunkText(text, 500, 50);
    this.documents.set(id, { text, metadata, chunks });
  }

  removeDocument(id) {
    this.documents.delete(id);
  }

  getDocuments() {
    return Array.from(this.documents.entries()).map(([id, doc]) => ({
      id,
      ...doc.metadata,
      textLength: doc.text.length,
      chunkCount: doc.chunks.length
    }));
  }

  hasDocuments() {
    return this.documents.size > 0;
  }

  buildContext(query) {
    if (this.documents.size === 0) return '';

    // Simple keyword-based retrieval
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const scoredChunks = [];

    for (const [id, doc] of this.documents) {
      for (const chunk of doc.chunks) {
        const chunkLower = chunk.toLowerCase();
        let score = 0;
        for (const word of queryWords) {
          const regex = new RegExp(word, 'gi');
          const matches = chunkLower.match(regex);
          if (matches) score += matches.length;
        }
        // Boost score for shorter, more relevant chunks
        if (score > 0) {
          scoredChunks.push({
            text: chunk,
            score,
            source: doc.metadata.name || id
          });
        }
      }
    }

    // Sort by relevance and take top chunks
    scoredChunks.sort((a, b) => b.score - a.score);
    const topChunks = scoredChunks.slice(0, 5);

    if (topChunks.length === 0) {
      // Return all text if no keyword match (short documents)
      const allText = Array.from(this.documents.values())
        .map(d => d.text).join('\n\n');
      return allText.substring(0, 2000);
    }

    return topChunks.map(c => `[Source: ${c.source}]\n${c.text}`).join('\n\n');
  }

  getSystemPrompt(query) {
    const context = this.buildContext(query);
    if (!context) return null;

    return `You have access to the following document context extracted via OCR from uploaded images/documents. Use this context to answer the user's questions accurately. If the answer is not in the context, say so.

--- DOCUMENT CONTEXT ---
${context}
--- END CONTEXT ---`;
  }

  _chunkText(text, chunkSize = 500, overlap = 50) {
    if (text.length <= chunkSize) return [text];

    const chunks = [];
    let start = 0;
    while (start < text.length) {
      let end = start + chunkSize;
      // Try to break at sentence boundary
      if (end < text.length) {
        const lastPeriod = text.lastIndexOf('.', end);
        if (lastPeriod > start + chunkSize / 2) {
          end = lastPeriod + 1;
        }
      }
      chunks.push(text.substring(start, end).trim());
      start = end - overlap;
    }
    return chunks.filter(c => c.length > 20);
  }

  clear() {
    this.documents.clear();
  }
}
