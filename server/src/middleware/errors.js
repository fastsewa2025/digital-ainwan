import { ZodError } from 'zod';
import multer from 'multer';
import mongoose from 'mongoose';
import { HttpError } from '../lib/errors.js';
import { issuesOf } from '../lib/fields.js';

export const apiNotFound = (_req, res) => res.status(404).json({ error: 'NOT_FOUND', message: 'Not found' });

export function errorHandler(err, req, res, _next) {
  if (res.headersSent) return;

  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.code, message: err.message, issues: err.issues });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'VALIDATION', message: 'Please fix the highlighted fields', issues: issuesOf(err) });
  }
  if (err instanceof multer.MulterError) {
    const tooBig = err.code === 'LIMIT_FILE_SIZE';
    return res.status(tooBig ? 413 : 400).json({
      error: tooBig ? 'FILE_TOO_LARGE' : 'UPLOAD_ERROR',
      message: tooBig ? 'That file is too large' : 'Upload failed',
    });
  }
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'BAD_JSON', message: 'Invalid request body' });
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'TOO_LARGE', message: 'Request is too large' });
  if (err instanceof mongoose.Error.CastError || err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid data' });
  }
  if (err?.code === 11000) return res.status(409).json({ error: 'DUPLICATE', message: 'That value already exists' });

  req.log?.error({ err }, 'unhandled error');
  const { isProd } = req.app.locals.config;
  return res.status(500).json({ error: 'SERVER_ERROR', message: isProd ? 'Something went wrong on our side' : err.message });
}
