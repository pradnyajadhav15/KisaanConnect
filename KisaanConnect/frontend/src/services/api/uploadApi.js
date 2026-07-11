const API_ROOT = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export const uploadCropImage = async (file) => {
  const token = localStorage.getItem('auth_token');
  const formData = new FormData();
  formData.append('file', file);

  let response;
  try {
    response = await fetch(API_ROOT + '/upload/image', {
      method: 'POST',
      headers: token ? { Authorization: 'Bearer ' + token } : {},
      body: formData,
    });
  } catch (err) {
    throw new Error('Cannot reach the server. Check your connection and try again.');
  }

  if (!response.ok) {
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      throw new Error(data.detail || 'Upload failed');
    } catch {
      throw new Error(text || 'Upload failed');
    }
  }

  return response.json();
};
