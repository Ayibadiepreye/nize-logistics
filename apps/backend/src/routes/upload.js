import express from 'express';
import multer from 'multer';
import { uploadToCloudinary } from '../lib/cloudinary.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB — comfortably covers a phone photo.
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

/**
 * Uploads previously accepted any file of any size straight into memory.
 * Now the type and size are enforced before a byte is buffered.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 5 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      const err = new Error('Only JPEG, PNG, WebP or HEIC images can be uploaded');
      err.status = 415;
      return cb(err);
    }
    cb(null, true);
  },
});

/** Translates multer's own errors into clean API responses. */
function handleUpload(middleware) {
  return (req, res, next) =>
    middleware(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'That image is larger than 8MB' });
      }
      if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ error: 'You can upload up to 5 images' });
      }
      return res.status(err.status || 400).json({ error: err.message || 'Upload failed' });
    });
}

router.post('/image', authenticate, handleUpload(upload.single('file')), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image provided' });
    }

    const url = await uploadToCloudinary(req.file.buffer, req.file.originalname);
    res.json({ url });
  } catch (error) {
    next(error);
  }
});

router.post('/images', authenticate, handleUpload(upload.array('files', 5)), async (req, res, next) => {
  try {
    if (!req.files?.length) {
      return res.status(400).json({ error: 'No images provided' });
    }

    const urls = await Promise.all(
      req.files.map((file) => uploadToCloudinary(file.buffer, file.originalname))
    );

    res.json({ urls });
  } catch (error) {
    next(error);
  }
});

export default router;
