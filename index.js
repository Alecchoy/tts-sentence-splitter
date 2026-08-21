// tts-sentence-splitter — locale-aware sentence boundaries for streaming TTS.
//
// The problem: you're streaming tokens out of an LLM and want to start
// speaking *before* generation finishes. To do that you need to know where
// sentences end — across scripts. "。" ends a Chinese sentence, "।" ends a
// Hindi one, "។" ends Khmer, and "3.14" ends nothing at all.
//
// Extracted from the streaming voice pipeline of Yelo (yelofamily.com),
// where it feeds per-sentence TTS in 15 languages while the model is still
// generating.

const LATIN_TERMINATORS = ['.', '!', '?']

// Per-locale terminator sets. Latin terminators are always included because
// models routinely slip into Latin punctuation mid-utterance, and bilingual
// text inherently mixes scripts.
const TERMINATORS_BY_LOCALE = {
  'en-US':  LATIN_TERMINATORS,
  'vi-VN':  LATIN_TERMINATORS,
  'fil-PH': LATIN_TERMINATORS,
  'es-US':  LATIN_TERMINATORS,
  'ko-KR':  LATIN_TERMINATORS,
  'he-IL':  LATIN_TERMINATORS,
  'zh-HK':  ['。', '！', '？', ...LATIN_TERMINATORS],
  'zh-CN':  ['。', '！', '？', ...LATIN_TERMINATORS],
  'zh-TW':  ['。', '！', '？', ...LATIN_TERMINATORS],
  'ja-JP':  ['。', '！', '？', ...LATIN_TERMINATORS],
  'hi-IN':  ['।', '॥', ...LATIN_TERMINATORS],
  'mr-IN':  ['।', '॥', ...LATIN_TERMINATORS],
  'km-KH':  ['។', ...LATIN_TERMINATORS],
  'ar-SA':  ['؟', '.', '!'],
}

// Closing quotes / brackets that may follow a terminator and should fold
// into the same boundary, so a sentence never ends mid-quotation.
const CLOSING_PUNCT = new Set([
  '"', "'", '」', '』', '"', "'", ')', '）', ']', '】', '》',
])

export function getTerminators(locale) {
  return TERMINATORS_BY_LOCALE[locale] ?? LATIN_TERMINATORS
}

/**
 * Find the next sentence-end in `text` from `fromIndex`. Returns the index
 * AFTER the terminator (and any trailing closing quotes), so
 * `text.slice(0, returnedIndex)` is the complete sentence. -1 if none.
 *
 * Handles: decimal numbers ("3.14" doesn't split), currency ("$3.50"),
 * closing quotes/brackets folded into the boundary.
 */
export function findSentenceEnd(text, locale, fromIndex = 0) {
  const termSet = new Set(getTerminators(locale))
  for (let i = fromIndex; i < text.length; i++) {
    const ch = text[i]
    if (!termSet.has(ch)) continue
    // Numeric-run guard: only Latin '.' is ambiguous (3.14, $3.50).
    if (ch === '.' && i > 0 && i + 1 < text.length) {
      const prev = text[i - 1]
      const next = text[i + 1]
      if (prev >= '0' && prev <= '9' && next >= '0' && next <= '9') continue
    }
    let end = i + 1
    while (end < text.length && CLOSING_PUNCT.has(text[end])) end++
    return end
  }
  return -1
}

/**
 * Strip the markdown constructs that would garble TTS output
 * (**bold**, *italic*, `code`, [links](url)). Conservative by design.
 */
export function stripMarkdown(text) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s.,!?)]|$)/g, '$1$2')
    .replace(/(^|[\s(])_([^_\s][^_]*?)_(?=[\s.,!?)]|$)/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
}

/**
 * Streaming splitter. Feed it LLM chunks as they arrive; it returns complete
 * sentences as soon as their boundaries appear, so each one can go to TTS
 * while the model keeps generating.
 *
 *   const stream = createSentenceStream('zh-HK')
 *   for await (const chunk of llm) {
 *     for (const sentence of stream.push(chunk)) tts(sentence)
 *   }
 *   for (const sentence of stream.finalize()) tts(sentence)  // trailing partial
 */
export function createSentenceStream(locale, { markdown = true } = {}) {
  let buffer = ''
  let cursor = 0
  let finalized = false

  const clean = (s) => {
    const out = markdown ? stripMarkdown(s.trim()) : s.trim()
    return out
  }

  function drain(force) {
    const out = []
    for (;;) {
      const slice = buffer.slice(cursor)
      const idx = findSentenceEnd(slice, locale)
      if (idx < 0) break
      const sentence = clean(slice.slice(0, idx))
      if (sentence) out.push(sentence)
      cursor += idx
    }
    if (force && cursor < buffer.length) {
      const rest = clean(buffer.slice(cursor))
      if (rest) out.push(rest)
      cursor = buffer.length
    }
    return out
  }

  return {
    push(chunk) {
      if (finalized) throw new Error('push() after finalize()')
      if (chunk == null || chunk === '') return []
      buffer += String(chunk)
      return drain(false)
    },
    finalize() {
      finalized = true
      return drain(true)
    },
  }
}
