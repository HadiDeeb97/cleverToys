import { supabase } from './supabase';

export async function uploadProductImage(
  file: File,
  productId: string
) {
  const filePath = `products/${productId}/${crypto.randomUUID()}.webp`;

  const { error: uploadError } = await supabase.storage
    .from('product-images')
    .upload(filePath, file, {
      contentType: 'image/webp',
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage
    .from('product-images')
    .getPublicUrl(filePath);

  return {
    path: filePath,
    url: data.publicUrl,
  };
}