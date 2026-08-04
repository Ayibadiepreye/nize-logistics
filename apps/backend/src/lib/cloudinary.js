import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadToCloudinary(buffer, filename) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'nize-logistics',
        public_id: filename.replace(/\.[^/.]+$/, ''),
        resource_type: 'auto',
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    );

    if (Buffer.isBuffer(buffer)) {
      uploadStream.end(buffer);
    } else {
      // If it's a stream
      buffer.pipe(uploadStream);
    }
  });
}

export async function deleteFromCloudinary(publicId) {
  try {
    await cloudinary.uploader.destroy(`nize-logistics/${publicId}`);
  } catch (error) {
    console.error('Cloudinary delete error:', error);
  }
}
