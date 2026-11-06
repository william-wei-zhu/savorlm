# Blue chroma key + export (same method as HiBenny art/key2.py). Frame variants
# reuse their base pose's crop box so swaps don't jitter.
import numpy as np
from PIL import Image
OUT = "../public/savvy"
def alpha_img(src):
    im = np.asarray(Image.open(src).convert("RGB").resize((1024,1024))).astype(np.float32)
    r, g, b = im[...,0], im[...,1], im[...,2]
    blu = b - np.maximum(r, g)
    a = 1.0 - np.clip((blu - 40) / 110, 0, 1)
    b2 = np.where(b > np.maximum(r, g), np.maximum(r, g), b)
    return Image.fromarray(np.dstack([r, g, b2, a * 255]).clip(0, 255).astype(np.uint8))
def box_of(img):
    return img.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox()
def save(img, box, dst, size=640):
    img = img.crop(box); w, h = img.size; s = max(w, h)
    c = Image.new("RGBA", (s, s), (0,0,0,0)); c.paste(img, ((s-w)//2, s-h))
    c.resize((size, size), Image.LANCZOS).save(dst, quality=86, method=6)
boxes = {}
for k in ["wave","listen","talk","think","point","wow","cheer","taste","laugh","clap","dance","look"]:
    im = alpha_img(f"poses/raw-{k}.png"); boxes[k] = box_of(im); save(im, boxes[k], f"{OUT}/{k}.webp")
for v, base in [("talk2","talk"),("listen-blink","listen"),("talk-blink","talk"),("wave2","wave"),("dance2","dance")]:
    save(alpha_img(f"poses/raw-{v}.png"), boxes[base], f"{OUT}/{v}.webp")
# Square avatar (head + shoulders of the wave pose) for the header, favicon and OG.
im = alpha_img("poses/raw-wave.png"); x0,y0,x1,y1 = boxes["wave"]
save(im, (x0, y0, x1, y0 + (x1-x0)), f"{OUT}/avatar.webp", 320)
print("exported")
