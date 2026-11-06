# Link-preview image (1200x630): just the Savvy logo, Savvy in his gold-ringed
# espresso medallion, centered on white. No text (William, 2026-11-06). The
# same image is used for the home page, every city page and shared lists.
from PIL import Image, ImageDraw
W, H = 1200, 630
GOLD, ESPRESSO = (201, 160, 99), (26, 18, 16)
im = Image.new("RGB", (W, H), "white")
d = ImageDraw.Draw(im)
cx, cy, r = W // 2, 330, 255
d.ellipse((cx - r, cy - r + 20, cx + r, cy + r + 20), fill=ESPRESSO, outline=GOLD, width=12)
sv = Image.open("../public/savvy/wave.webp").convert("RGBA").resize((560, 560), Image.LANCZOS)
im.paste(sv, (cx - 280, cy - 300), sv)
im.save("../app/opengraph-image.png", optimize=True)
im.save("../app/twitter-image.png", optimize=True)
im.save("../public/og/savorlm.jpg", quality=88, optimize=True)
print("og ok")
