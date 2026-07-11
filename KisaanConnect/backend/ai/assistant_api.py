import os
import requests
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from auth.auth_api import get_current_user_full

router = APIRouter()

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
# Fast text model (no vision needed here).
GROQ_TEXT_MODEL = "llama-3.3-70b-versatile"


# --------------------------------------------------
# SCHEMAS
# --------------------------------------------------
class AskRequest(BaseModel):
    question: str = Field(..., min_length=2, max_length=1000)

class DescribeRequest(BaseModel):
    crop_name: str = Field(..., min_length=1, max_length=100)
    details: str = Field("", max_length=500)


# --------------------------------------------------
# Shared helper to call Groq
# --------------------------------------------------
def _call_groq(system_prompt: str, user_content: str, max_tokens: int = 600) -> str:
    if not GROQ_API_KEY:
        raise HTTPException(503, "AI service not configured (GROQ_API_KEY missing)")
    try:
        r = requests.post(
            GROQ_URL,
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": GROQ_TEXT_MODEL,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content},
                ],
                "max_tokens": max_tokens,
                "temperature": 0.7,
            },
            timeout=30,
        )
        r.raise_for_status()
        data = r.json()
    except requests.RequestException:
        raise HTTPException(502, "AI request failed. Please try again.")

    try:
        return data["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError):
        raise HTTPException(502, "No response from AI")


# --------------------------------------------------
# 1) FARMING Q&A CHATBOT
# --------------------------------------------------
@router.post("/ask")
async def ask_assistant(body: AskRequest, user=Depends(get_current_user_full)):
    system = (
        "You are a friendly farming assistant for small Indian farmers. "
        "Give practical, simple, actionable advice about crops, pests, diseases, "
        "soil, water, weather, and selling produce. Keep answers short and clear "
        "(a few sentences or short bullet points). Avoid jargon. "
        "IMPORTANT: Reply in the SAME language the user asked in "
        "(English, Hindi, Marathi, etc.). If unsure, use simple English. "
        "If a question is not about farming, gently say you can only help with farming."
    )
    answer = _call_groq(system, body.question)
    return {"answer": answer}


# --------------------------------------------------
# 2) CROP DESCRIPTION WRITER
# --------------------------------------------------
@router.post("/describe")
async def describe_crop(body: DescribeRequest, user=Depends(get_current_user_full)):
    if user["role"] != "farmer":
        raise HTTPException(403, "Only farmers can generate crop descriptions")

    system = (
        "You write short, appealing product descriptions for crops sold on a "
        "farmer-to-consumer marketplace. Write 2-3 sentences, warm and honest, "
        "highlighting freshness and quality. No emojis. No price. "
        "Plain text only, ready to paste into a listing."
    )
    user_content = f"Crop: {body.crop_name}\nFarmer's notes: {body.details or '(none)'}"
    description = _call_groq(system, user_content, max_tokens=200)
    return {"description": description}