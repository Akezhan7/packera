const uploadedImage = /^\/products\/upload_[a-z0-9]+_\d+\.(?:jpe?g|png)$/i;

const isStaticHero = image => image === '/Artboard 1.png' || image === '/Artboard%201.png';

// Remote images, SVGs and icons keep their existing URLs and rendering.
export function thumbnailUrl(image, width) {
  if (isStaticHero(image)) return `/products/hero-banner?w=${width}&format=webp`;
  if (!uploadedImage.test(image || '')) return image;
  return `${image}?w=${width}&format=webp`;
}

export function thumbnailSrcset(image) {
  if (!isStaticHero(image) && !uploadedImage.test(image || '')) return undefined;
  return [320, 640, 960, 1280].map(width => `${thumbnailUrl(image, width)} ${width}w`).join(', ');
}
