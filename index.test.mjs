import test from 'node:test'
import assert from 'node:assert/strict'
import { findSentenceEnd, createSentenceStream, getTerminators } from './index.js'

test('CJK full stops end sentences', () => {
  const t = '你好。今天天氣好。'
  const end = findSentenceEnd(t, 'zh-HK')
  assert.equal(t.slice(0, end), '你好。')
})

test('decimals do not split', () => {
  const t = 'Pi is 3.14 exactly. Next.'
  const end = findSentenceEnd(t, 'en-US')
  assert.equal(t.slice(0, end), 'Pi is 3.14 exactly.')
})

test('hindi danda terminates', () => {
  const t = 'नमस्ते। आप कैसे हैं।'
  const end = findSentenceEnd(t, 'hi-IN')
  assert.equal(t.slice(0, end), 'नमस्ते।')
})

test('closing quotes fold into the boundary', () => {
  const t = '佢話「好。」然後走咗。'
  const end = findSentenceEnd(t, 'zh-HK')
  assert.equal(t.slice(0, end), '佢話「好。」')
})

test('khmer khan terminates', () => {
  assert.ok(getTerminators('km-KH').includes('។'))
})

test('streaming: sentences emerge across chunk boundaries', () => {
  const s = createSentenceStream('en-US')
  const got = []
  got.push(...s.push('Hello the'))
  got.push(...s.push('re. Second sen'))
  got.push(...s.push('tence! Trailing'))
  got.push(...s.finalize())
  assert.deepEqual(got, ['Hello there.', 'Second sentence!', 'Trailing'])
})

test('streaming: markdown stripped for tts', () => {
  const s = createSentenceStream('en-US')
  const got = [...s.push('This is **bold** talk. '), ...s.finalize()]
  assert.deepEqual(got, ['This is bold talk.'])
})
