/**
 * Accumulates streamed tokens and emits complete sentences.
 * Splits on sentence-ending punctuation (.!?) followed by whitespace or end of string.
 */
export class SentenceSplitter {
  private buffer = "";
  private onSentence: (sentence: string) => void;

  constructor(onSentence: (sentence: string) => void) {
    this.onSentence = onSentence;
  }

  add(token: string) {
    this.buffer += token;
    this.flush(false);
  }

  /** Flush any remaining text as a final sentence */
  finish() {
    this.flush(true);
  }

  private flush(force: boolean) {
    // Match sentences ending with .!? followed by a space (or end if forced)
    const pattern = /[^.!?]*[.!?]+(?:\s|$)/g;
    let match: RegExpExecArray | null;
    let lastIndex = 0;

    while ((match = pattern.exec(this.buffer)) !== null) {
      const sentence = match[0].trim();
      if (sentence.length > 0) {
        this.onSentence(sentence);
      }
      lastIndex = pattern.lastIndex;
    }

    if (lastIndex > 0) {
      this.buffer = this.buffer.slice(lastIndex);
    }

    if (force && this.buffer.trim().length > 0) {
      this.onSentence(this.buffer.trim());
      this.buffer = "";
    }
  }
}
