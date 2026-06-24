// middleware/upload.js
// Cấu hình Multer để upload ảnh cho tin tức

import multer from 'multer';
import path from 'path';
import crypto from 'crypto';

// Thư mục lưu trữ: public/uploads/
const storage = multer.diskStorage({
    destination(_req, _file, cb) {
        cb(null, 'public/uploads/');
    },
    filename(_req, file, cb) {
        const unique = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `news-${unique}${ext}`);
    }
});

// Chỉ chấp nhận file ảnh, giới hạn 5 MB
function fileFilter(_req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Chỉ chấp nhận file ảnh (image/*)'), false);
    }
}

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
});

export default upload;
