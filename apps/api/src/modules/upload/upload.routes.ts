import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../middleware/auth.js';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';

const uploadDir = path.resolve('uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = crypto.randomBytes(8).toString('hex');
    cb(null, `${unique}${ext}`);
  }
});

export const upload = multer({ 
  storage, 
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

export const uploadRouter = Router();

uploadRouter.post('/', authenticate, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  // Return the path that the frontend can use or resolve
  const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});
