import multer from 'multer';

const multerUpload = multer({
  limits: { fieldSize: 10 * 1024 * 1024, fileSize: 10 * 1024 * 1024 }, // Limit file size to 10MB
  storage: multer.memoryStorage(), // Directly setting the memoryStorage
});

export default multerUpload;
