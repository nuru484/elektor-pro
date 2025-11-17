import multer from "multer";

export const upload = multer({
  storage: multer.memoryStorage(), // Directly setting the memoryStorage
  limits: { fileSize: 10 * 1024 * 1024 }, // Limit file size to 10MB
});
