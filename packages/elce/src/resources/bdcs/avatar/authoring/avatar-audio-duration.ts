/** Reads a local audio file's real duration and releases its temporary media URL. */
export async function readAvatarAudioDuration(file: File): Promise<number> {
  const source = URL.createObjectURL(file)
  const audio = document.createElement('audio')
  const duration = await new Promise<number>((resolve, reject) => {
    audio.addEventListener('loadedmetadata', () => resolve(audio.duration), { once: true })
    audio.addEventListener('error', () => reject(new Error('Le fichier audio ne peut pas être lu.')), { once: true })
    audio.src = source
  }).finally(() => {
    audio.removeAttribute('src')
    audio.load()
    URL.revokeObjectURL(source)
  })
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('La durée du fichier audio est indisponible.')
  return Math.round(duration * 1000)
}
