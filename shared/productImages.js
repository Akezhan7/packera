// A single ordering rule for catalog cards, task recommendations and the lightbox.
export function getProductImages(product, selectedSize = '') {
  if (!product) return [];
  const variant = selectedSize ? product.sizes?.find(size => size.size === selectedSize) : null;
  const images = [
    ...(variant ? [variant.image, ...(variant.images || [])] : []),
    product.image, ...(product.images || []),
  ];
  return [...new Set(images.filter(image => typeof image === 'string' && image.trim()))];
}
