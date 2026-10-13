/** Reads an image file, centre-crops it to a square and downsizes it to at most `max` px (JPEG data URL). */
export async function fileToAvatarDataUrl(file: File, max = 256): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error("We couldn't read that image. Try a JPG or PNG."))
      el.src = url
    })
    const side = Math.min(img.naturalWidth, img.naturalHeight)
    const size = Math.max(1, Math.min(max, side))
    const canvas = document.createElement("canvas")
    canvas.width = size
    canvas.height = size
    const g = canvas.getContext("2d")
    if (!g) throw new Error("Your browser couldn't process the image.")
    g.imageSmoothingEnabled = true
    g.imageSmoothingQuality = "high"
    g.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size)
    return canvas.toDataURL("image/jpeg", 0.86)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]
