# Link-preview images (1200x630): the root one (Savvy + wordmark) and one per
# city (Savvy + the city's food badge + "SavorLM" and the city name).
import json, re
from PIL import Image, ImageDraw, ImageFont
W, H = 1200, 630
FONT = "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"
INK, GOLD, ESPRESSO = (26, 22, 20), (201, 160, 99), (26, 18, 16)
src = open("../lib/cities.ts").read()
cities = re.findall(r'\n  \w+: \{ name: "([^"]+)", slug: "([^"]+)"', src)

def base():
    im = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(im)
    cx, cy = 300, 335
    d.ellipse((cx - 215, cy - 195, cx + 215, cy + 235), fill=ESPRESSO, outline=GOLD, width=10)
    sv = Image.open("../public/savvy/wave.webp").convert("RGBA").resize((470, 470), Image.LANCZOS)
    im.paste(sv, (cx - 235, cy - 255), sv)
    return im, d

im, d = base()
d.text((570, 255), "SavorLM", font=ImageFont.truetype(FONT, 124), fill=INK)
im.save("../app/opengraph-image.png"); im.save("../app/twitter-image.png")

for name, slug in cities:
    im, d = base()
    badge = Image.open(f"../public/cities/{slug}.webp").convert("RGBA").resize((190, 190), Image.LANCZOS)
    im.paste(badge, (575, 95), badge)
    d.text((575, 310), "SavorLM", font=ImageFont.truetype(FONT, 104), fill=INK)
    size = 64 if len(name) < 16 else 50
    d.text((580, 440), name, font=ImageFont.truetype(FONT, size), fill=(122, 85, 32))
    im.save(f"../public/og/{slug}.jpg", quality=86, optimize=True)
print("og", len(cities))
