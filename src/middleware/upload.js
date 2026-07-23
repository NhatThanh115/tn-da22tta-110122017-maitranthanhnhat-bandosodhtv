// middleware/upload.js
// Cấu hình Multer để upload ảnh (dùng chung cho News và Landmarks)

import multer from 'multer';
import path from 'path';
import crypto from 'crypto';

/**
 * Tạo multer uploader với prefix tên file tùy chỉnh.
 * @param {string} prefix  - Tiền tố tên file, ví dụ: 'news' | 'landmark'
 * @returns multer instance
 */
export function createUploader(prefix = 'upload') {
    const storage = multer.diskStorage({
        destination(_req, _file, cb) {
            cb(null, 'public/uploads/');
        },
        filename(_req, file, cb) {
            const unique = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
            const ext = path.extname(file.originalname).toLowerCase();
            cb(null, `${prefix}-${unique}${ext}`);
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

    return multer({
        storage,
        fileFilter,
        limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
    });
}

// Export mặc định cho News (giữ tương thích ngược)
export default createUploader('news');
