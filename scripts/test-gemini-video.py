import os
import sys

# Read GEMINI_API_KEY from .env.local
with open(".env.local", "r", encoding="utf-8") as f:
    for line in f:
        if line.strip().startswith("GEMINI_API_KEY="):
            os.environ["GEMINI_API_KEY"] = line.strip().split("=", 1)[1].strip()
            break

print("GEMINI_API_KEY loaded:", os.environ.get("GEMINI_API_KEY", "")[:10] + "...")

# Now import google-genai
from google import genai

client = genai.Client()
prompt = "Cinematic anime style, an intelligent blind gangster in dark sunglasses standing calmly in the rain under glowing neon city lights"
print("Generating video with Gemini Omni 1.1 Flash API...")

try:
    # Test interactions / video generation
    response = client.interactions.create(
        model="gemini-omni-1.1-flash",
        input=prompt,
        generation_config={
            "response_modalities": ["VIDEO"],
        }
    )
    print("Response received:", response)
except Exception as e:
    print("Interactions call error:", type(e), e)
