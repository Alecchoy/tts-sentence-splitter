# tts-sentence-splitter

Locale-aware sentence boundaries for **streaming TTS** — speak the first
sentence while the LLM is still generating.

Zero dependencies. Node 18+ / Deno / Bun / browser.

## The problem

Waiting for a full LLM response before starting text-to-speech adds seconds
of dead air. The fix is to synthesize **per sentence** as tokens stream — but
that means finding sentence boundaries correctly across scripts:

- `。！？` end sentences in Chinese and Japanese
- `।` (danda) ends Hindi and Marathi sentences
- `។` (khan) ends Khmer sentences
- `3.14` and `$3.50` end **nothing**
- a sentence that ends `…好。」` must keep its closing quote

Extracted from the streaming voice pipeline of [Yelo](https://yelofamily.com),
where it drives per-sentence Azure TTS in 15 languages in production.

## Usage

```js
import { createSentenceStream } from 'tts-sentence-splitter'

const stream = createSentenceStream('zh-HK')

for await (const chunk of llmTokens) {
  for (const sentence of stream.push(chunk)) {
    speakWithTts(sentence)          // fires while the model is still going
  }
}
for (const sentence of stream.finalize()) speakWithTts(sentence)
```

Also exported: `findSentenceEnd(text, locale, fromIndex)` for one-shot use,
`getTerminators(locale)`, and `stripMarkdown(text)` (strips `**bold**`,
`` `code` `` and `[links](url)` so the TTS doesn't read asterisks aloud).

## Tests

```
node --test
```

## License

MIT
