import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const rootDir = path.join(__dirname, '..', '..', '..');
export const imagesDir = path.join(rootDir, 'images');
export const thumbnailsDir = path.join(imagesDir, 'thumbnails');

if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
if (!fs.existsSync(thumbnailsDir)) fs.mkdirSync(thumbnailsDir, { recursive: true });

export const generateThumbnail = async (originalPath: string, thumbPath: string) => {
  const dir = path.dirname(thumbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  
  return sharp(originalPath)
    .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 70 })
    .toFile(thumbPath);
};

export const deleteFiles = (files: { imageUrl?: string; thumbnailUrl?: string }[]) => {
  files.forEach(file => {
    try {
      if (file.imageUrl && file.imageUrl.startsWith('/api/image-files/')) {
        const relativePath = decodeURIComponent(file.imageUrl.replace('/api/image-files/', '').split('?')[0]);
        const imgPath = path.join(imagesDir, relativePath);
        if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
      }
      if (file.thumbnailUrl && file.thumbnailUrl.startsWith('/api/image-files/')) {
        const relativePath = decodeURIComponent(file.thumbnailUrl.replace('/api/image-files/', '').split('?')[0]);
        const thumbPath = path.join(imagesDir, relativePath);
        if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
      }
    } catch (err) {
      console.error(`Failed to delete files:`, err);
    }
  });
};
