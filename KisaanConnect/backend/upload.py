import os
import cloudinary
import cloudinary.uploader
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from dotenv import load_dotenv
from pathlib import Path

from auth.auth_api import get_current_user_full

load_dotenv(Path(__file__).parent / '.env')

cloudinary.config(
    cloud_name=os.getenv('CLOUDINARY_CLOUD_NAME'),
    api_key=os.getenv('CLOUDINARY_API_KEY'),
    api_secret=os.getenv('CLOUDINARY_API_SECRET')
)

router = APIRouter()

ALLOWED_TYPES = {'image/jpeg', 'image/png', 'image/webp', 'image/jpg'}
MAX_SIZE_MB = 5

@router.post('/image')
async def upload_image(file: UploadFile = File(...), user=Depends(get_current_user_full)):
    if user['role'] != 'farmer':
        raise HTTPException(403, 'Only farmers can upload crop images')

    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, 'Only JPEG, PNG, or WebP images are allowed')

    contents = await file.read()
    if len(contents) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(400, 'Image must be under ' + str(MAX_SIZE_MB) + 'MB')

    try:
        result = cloudinary.uploader.upload(
            contents,
            folder='kisaanconnect/crops',
            resource_type='image'
        )
    except Exception as e:
        raise HTTPException(500, 'Upload failed: ' + str(e))

    return {'image_url': result['secure_url']}
