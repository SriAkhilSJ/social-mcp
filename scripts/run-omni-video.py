import os
import sys

# 1. Load GEMINI_API_KEY from .env.local
env_file = os.path.join(os.getcwd(), ".env.local")
if os.path.exists(env_file):
    with open(env_file, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip().startswith("GEMINI_API_KEY="):
                os.environ["GEMINI_API_KEY"] = line.strip().split("=", 1)[1].strip()
                break

print("Loaded GEMINI_API_KEY:", os.environ.get("GEMINI_API_KEY", "")[:12] + "...")

# 2. Path to generate_video.py
script_path = r"C:\Users\Administrator\.gemini\config\plugins\gemini-api\skills\gemini-omni-flash-api\scripts\video\generate_video.py"

# 3. Prompt for AI Anime Video (Real Motion, Not Static Zoom!)
prompt = (
    "In a single unbroken continuous shot with no scene cuts: "
    "Cinematic anime scene, an intelligent blind gangster in dark charcoal suit wearing black sunglasses "
    "standing calmly in the rain at night. He slowly lifts his hand to adjust his sunglasses, rain drops falling "
    "and splashing on his shoulders, reflections of red and cyan neon city signs glowing in his lenses. "
    "Fluid character animation, cinematic anime aesthetic, 24fps."
)

output_path = os.path.join(os.getcwd(), ".data", "media", "blind_gangster_omni.mp4")
os.makedirs(os.path.dirname(output_path), exist_ok=True)

# 4. Prepare sys.argv and call generate_video
sys.argv = [
    script_path,
    prompt,
    "--duration", "5",
    "--aspect-ratio", "9:16",
    "--resolution", "720p",
    "--output", output_path,
    "--timeout", "600"
]

print("Executing Gemini Omni 1.1 Flash Video Generator...")
print(f"Output target: {output_path}")

# Import and execute the script's main logic
import importlib.util
spec = importlib.util.spec_from_file_location("generate_video", script_path)
module = importlib.util.module_from_spec(spec)
sys.modules["generate_video"] = module
spec.loader.exec_module(module)

if hasattr(module, "main"):
    module.main()
else:
    print("Module loaded without main()")
