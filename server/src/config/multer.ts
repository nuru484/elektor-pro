import multer from 'multer';

const multerUpload = multer({
  storage: multer.memoryStorage(), // Directly setting the memoryStorage
  limits: { fileSize: 10 * 1024 * 1024, fieldSize: 10 * 1024 * 1024 }, // Limit file size to 10MB
});

export default multerUpload;
