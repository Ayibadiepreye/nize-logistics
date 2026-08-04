import express from 'express';
import multer from 'multer';
import { uploadToCloudinary } from '../lib/cloudinary.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Upload single image
router.post('/image', authenticate, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const url = await uploadToCloudinary(req.file.buffer, req.file.originalname);

    res.json({ url });
  } catch (error) {
    next(error);
  }
});

// Upload multiple images
router.post('/images', authenticate, upload.array('files', 5), async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const urls = await Promise.all(
      req.files.map(file => uploadToCloudinary(file.buffer, file.originalname))
    );

    res.json({ urls });
  } catch (error) {
    next(error);
  }
});

export default router;
