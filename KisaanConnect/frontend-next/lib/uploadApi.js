const API_ROOT = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const uploadCropImage = async (file) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(API_ROOT + '/upload/image', {
    method: 'POST',
    headers: token ? { Authorization: 'Bearer ' + token } : {},
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Upload failed');
  }

  return response.json();
};
