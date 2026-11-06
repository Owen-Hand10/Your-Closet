export async function removeImageBackground(image, onProgress = () => {}) {
  const { removeBackground } = await import('@imgly/background-removal');
  const result = await removeBackground(image, {
    device: 'cpu',
    model: 'isnet_quint8',
    output: {
      format: 'image/png',
      quality: 1,
      type: 'foreground',
    },
    progress: (key, current, total) => onProgress({ key, current, total }),
  });

  if (result.type !== 'image/png') {
    throw new Error('Background removal returned an unsupported image format.');
  }

  return result;
}