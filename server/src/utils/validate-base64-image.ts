// src/utils/validate-base64-image.ts
export const isValidBase64Image = (str: string): boolean => {
  const base64Regex =
    /^data:image\/(jpeg|jpg|png|gif|webp|bmp);base64,[A-Za-z0-9+/=]+$/;
  return base64Regex.test(str);
};
