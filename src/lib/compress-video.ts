// Shrinks a listing video in the browser before upload, using the device's own
// encoder (WebCodecs, via Mediabunny). Phone recordings are often 10–20 Mbps at
// 1080p/4K; a 720p H.264 MP4 at ~2.5 Mbps looks the same on a phone screen and
// streams far faster on slow mobile networks. The MP4 index (moov) is written at
// the front so playback can start before the whole file has downloaded.
//
// Best effort: returns null (upload the original) when the browser can't encode,
// the result would be missing a track, or it isn't meaningfully smaller.

const MAX_SHORT_SIDE = 720
const VIDEO_BITRATE = 2_500_000
const AUDIO_BITRATE = 128_000

export async function compressVideo(
  file: File,
  onProgress: (fraction: number) => void,
): Promise<File | null> {
  try {
    if (typeof VideoEncoder === 'undefined') return null
    const {
      ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output, canEncodeVideo,
    } = await import('mediabunny')

    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS })
    const track = await input.getPrimaryVideoTrack()
    if (!track) return null
    const audioTrack = await input.getPrimaryAudioTrack()
    const { displayWidth: w, displayHeight: h } = track
    const scale = Math.min(1, MAX_SHORT_SIDE / Math.min(w, h))
    // Encoders want even dimensions.
    const width = Math.round((w * scale) / 2) * 2
    const height = Math.round((h * scale) / 2) * 2
    if (!(await canEncodeVideo('avc', { width, height, bitrate: VIDEO_BITRATE }))) return null

    const output = new Output({
      format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
      target: new BufferTarget(),
    })
    const conversion = await Conversion.init({
      input,
      output,
      tracks: 'primary',
      video: { width, height, fit: 'contain', codec: 'avc', bitrate: VIDEO_BITRATE },
      audio: { codec: 'aac', bitrate: AUDIO_BITRATE },
      showWarnings: false,
    })
    // A dropped track (e.g. no AAC encoder for the audio) would mean a silent or
    // broken tour — keep the original instead.
    const dropped = conversion.discardedTracks.map(d => d.track)
    if (!conversion.isValid || dropped.includes(track) || (audioTrack && dropped.includes(audioTrack))) return null

    conversion.onProgress = p => onProgress(p)
    await conversion.execute()

    const buffer = output.target.buffer
    if (!buffer || buffer.byteLength > file.size * 0.8) return null
    const name = file.name.replace(/\.[^.]+$/, '') + '.mp4'
    return new File([buffer], name, { type: 'video/mp4' })
  } catch (err) {
    console.warn('[video] compression skipped:', err)
    return null
  }
}
