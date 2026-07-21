import os
import base64
import requests
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends

from auth.auth_api import get_current_user_full

router = APIRouter()

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_VISION_MODEL = "qwen/qwen3.6-27b"

PROMPT = (
    "You are an agricultural expert AI. Analyze this crop image and provide:\n"
    "1. The crop type detected\n"
    "2. Whether the crop is healthy or unhealthy\n"
    "3. If unhealthy, list specific problems (disease/pest/nutrient/water issues)\n"
    "4. Recommended solutions for each problem\n"
    'Be concise and practical. Start with "Crop Type: [name]".'
)


@router.post("/crop-health")
async def analyze_crop(file: UploadFile = File(...), user=Depends(get_current_user_full)):
    if not GROQ_API_KEY:
        raise HTTPException(503, "AI service not configured (GROQ_API_KEY missing)")
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "Please upload an image file")

    raw = await file.read()
    if len(raw) > 5 * 1024 * 1024:
        raise HTTPException(400, "Image must be smaller than 5MB")

    b64 = base64.b64encode(raw).decode()
    data_url = f"data:{file.content_type};base64,{b64}"

    try:
        r = requests.post(
            GROQ_URL,
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": GROQ_VISION_MODEL,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": PROMPT},
                            {"type": "image_url", "image_url": {"url": data_url}},
                        ],
                    }
                ],
            },
            timeout=30,
        )
        r.raise_for_status()
        data = r.json()
    except requests.RequestException:
        raise HTTPException(502, "AI analysis failed. Please try again.")

    try:
        text = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError):
        text = ""

    if not text:
        raise HTTPException(502, "No response from AI")

    return {"text": text}
