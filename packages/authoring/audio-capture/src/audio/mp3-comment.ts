const utf8Encoder = new TextEncoder()

/** Creates an MP3 copy with the supplied text in its ID3v2.4 comment frame. */
export function createMp3WithComment(audio: Blob, comment: string): Blob {
  const commentBytes = utf8Encoder.encode(comment)
  const frameContent = new Uint8Array(5 + commentBytes.length)
  frameContent.set([0x03, 0x66, 0x72, 0x61, 0x00])
  frameContent.set(commentBytes, 5)

  const frame = new Uint8Array(10 + frameContent.length)
  frame.set(utf8Encoder.encode('COMM'))
  frame.set(encodeSyncSafeInteger(frameContent.length), 4)
  frame.set(frameContent, 10)

  const tagHeader = new Uint8Array(10)
  tagHeader.set(utf8Encoder.encode('ID3'))
  tagHeader[3] = 4
  tagHeader.set(encodeSyncSafeInteger(frame.length), 6)

  return new Blob([tagHeader, frame, audio], { type: 'audio/mpeg' })
}

/** Encodes a non-negative ID3 size as a four-byte synchsafe integer. */
function encodeSyncSafeInteger(value: number): Uint8Array {
  return Uint8Array.of((value >> 21) & 0x7f, (value >> 14) & 0x7f, (value >> 7) & 0x7f, value & 0x7f)
}
