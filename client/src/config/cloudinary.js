import { v2 as cloudinary } from "cloudinary";
import ENV from "./env.js";

// Cloudinary setup
cloudinary.config({
  cloud_name: ENV.CLOUDINARY_CLOUD_NAME,
  api_key: ENV.CLOUDINARY_API_KEY,
  api_secret: ENV.CLOUDINARY_API_SECRET,
});

// Function to upload files to Cloudinary
export const uploadFileToCloudinary = async (file) => {
  try {
    if (!file || !(file instanceof File) || file.size === 0) {
      throw new Error("Invalid file object. Ensure a valid file is provided.");
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { resource_type: "image" }, // Explicitly set to image since form accepts images
        (error, result) => {
          if (error) {
            reject(
              new Error("Error uploading file to Cloudinary: " + error.message)
            );
          } else {
            resolve(result.secure_url); // Return the Cloudinary URL
          }
        }
      );

      uploadStream.end(buffer); // Start the upload process
    });
  } catch (error) {
    throw error;
  }
};

// Function to delete a file from Cloudinary
export const deleteFileFromCloudinary = async (publicId) => {
  try {
    const extractPublicId = (url) => url.split("/").slice(-1)[0].split(".")[0];
    const extractedPublicId = extractPublicId(publicId);

    const result = await cloudinary.uploader.destroy(extractedPublicId);
    console.log(`Cloudinary deletion result: ${JSON.stringify(result)}`);
    return result;
  } catch (error) {
    throw error;
  }
};
