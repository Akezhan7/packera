const uploadedImage = /^\/products\/upload_[a-z0-9]+_\d+\.(?:jpe?g|png)$/i;

// Remote images and SVGs keep their existing URLs and rendering.
export function thumbnailUrl(image, width) {
  if (!uploadedImage.test(image || '')) return image;
  return `${image}?w=${width}`;
}

export function thumbnailSrcset(image) {
  if (!uploadedImage.test(image || '')) return undefined;
  return [320, 640, 960].map(width => `${thumbnailUrl(image, width)} ${width}w`).join(', ');
}
