# Gemini image helper (adapted from HiBenny art/gen.py). Reads the key from ../.env.local.
import base64, json, os, sys, urllib.request, concurrent.futures as cf
key = open(os.path.join(os.path.dirname(__file__), '..', '.env.local')).read().split('GEMINI_API_KEY=')[1].split()[0]
MODEL = os.environ.get('IMG_MODEL', 'gemini-3.1-flash-image')
def b64(path): return base64.b64encode(open(path, 'rb').read()).decode()
def gen(name, prompt, refs):
    parts = [{"inlineData": {"mimeType": "image/png", "data": r}} for r in refs]
    parts.append({"text": prompt})
    body = {"contents": [{"parts": parts}], "generationConfig": {"responseModalities": ["IMAGE"], "imageConfig": {"aspectRatio": "1:1"}}}
    req = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent",
        data=json.dumps(body).encode(), headers={"Content-Type": "application/json", "x-goog-api-key": key})
    try:
        d = json.load(urllib.request.urlopen(req, timeout=180))
        for p in d["candidates"][0]["content"]["parts"]:
            if "inlineData" in p:
                open(name, "wb").write(base64.b64decode(p["inlineData"]["data"])); return name + " ok"
        return name + " no image " + json.dumps(d)[:300]
    except Exception as e:
        return name + " ERR " + str(e)[:300]
def run(jobs, refs):
    with cf.ThreadPoolExecutor(6) as ex:
        for r in ex.map(lambda j: gen(j["out"], j["prompt"], refs), jobs): print(r, flush=True)
