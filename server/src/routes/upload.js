import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
import { HttpError, badRequest } from '../lib/errors.js';
import { audit } from '../lib/audit.js';

const MB = 1024 * 1024;
const single = (maxMb) =>
  multer({ storage: multer.memoryStorage(), limits: { fileSize: maxMb * MB, files: 1, fields: 0 } }).single('file');

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
// webm / mp4: what phones produce when a story is recorded in the browser.
const AUDIO_EXT = { mp3: 'mp3', m4a: 'm4a', mp4: 'm4a', ogg: 'ogg', oga: 'ogg', opus: 'ogg', wav: 'wav', aac: 'aac', webm: 'webm' };

const randomName = () => crypto.randomBytes(12).toString('hex');
const unsupported = (what) => new HttpError(415, 'BAD_FILE', what);

/**
 * Files are never trusted: the type is decided from the file's own bytes (not its name or
 * the browser's claim), the name on disk is random, and photos are re-encoded, which also
 * removes hidden data such as GPS location in the photo's EXIF.
 */
export function uploadRouter({ uploadDir, kinds = ['image', 'audio', 'pdf'] }) {
  const router = Router();
  const put = async (folder, name, buffer) => {
    const dir = path.join(uploadDir, folder);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, name), buffer, { mode: 0o644 });
  };

  if (kinds.includes('image')) router.post('/image', single(15), async (req, res) => {
    if (!req.file) throw badRequest('No file received');
    const type = await fileTypeFromBuffer(req.file.buffer);
    if (!type || !IMAGE_MIME.has(type.mime)) throw unsupported('Please upload a JPG, PNG or WebP photo');

    let main;
    let thumb;
    let og;
    try {
      const img = sharp(req.file.buffer, { limitInputPixels: 80_000_000, failOn: 'error' }).rotate();
      main = await img
        .clone()
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 78 })
        .toBuffer({ resolveWithObject: true });
      thumb = await img
        .clone()
        .resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 72 })
        .toBuffer();
      // 1200x630 JPEG for WhatsApp / Facebook link previews (not every app shows WebP previews).
      og = await img.clone().resize(1200, 630, { fit: 'cover', position: 'attention' }).jpeg({ quality: 78, mozjpeg: true }).toBuffer();
    } catch {
      throw unsupported('That photo could not be read. Try another file.');
    }

    const id = randomName();
    await put('images', `${id}.webp`, main.data);
    await put('images', `${id}_t.webp`, thumb);
    await put('images', `${id}_og.jpg`, og);
    const body = { url: `/uploads/images/${id}.webp`, thumb: `/uploads/images/${id}_t.webp`, width: main.info.width, height: main.info.height };
    await audit(req, 'upload', { summary: `image ${body.url}` });
    res.status(201).json(body);
  });

  if (kinds.includes('audio')) router.post('/audio', single(30), async (req, res) => {
    if (!req.file) throw badRequest('No file received');
    const type = await fileTypeFromBuffer(req.file.buffer);
    const ext = type && AUDIO_EXT[type.ext];
    if (!ext) throw unsupported('Please upload an MP3, M4A, OGG, AAC or WAV recording');

    const name = `${randomName()}.${ext}`;
    await put('audio', name, req.file.buffer);
    const body = { url: `/uploads/audio/${name}`, size: req.file.size };
    await audit(req, 'upload', { summary: `audio ${body.url}` });
    res.status(201).json(body);
  });

  if (kinds.includes('pdf')) router.post('/pdf', single(12), async (req, res) => {
    if (!req.file) throw badRequest('No file received');
    const type = await fileTypeFromBuffer(req.file.buffer);
    if (type?.mime !== 'application/pdf') throw unsupported('Please upload a PDF file');

    const name = `${randomName()}.pdf`;
    await put('docs', name, req.file.buffer);
    const body = { url: `/uploads/docs/${name}`, size: req.file.size };
    await audit(req, 'upload', { summary: `pdf ${body.url}` });
    res.status(201).json(body);
  });

  return router;
}
