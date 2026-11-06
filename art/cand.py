import gen
ref = gen.b64('logo-source.png')
BG = "Background must be a completely flat, uniform pure blue color RGB(0,0,255) with no gradient, no shadow, no floor, no other objects, no text. Square image. Full body visible with small margin, centered."
CHAR = "the raccoon from the reference logo reimagined as a friendly food tour guide: same face (gray fur, black eye mask, white muzzle, warm brown eyes, small smile), wearing a burgundy neckerchief scarf, a cream chef-style jacket with burgundy buttons, and carrying a small gold-edged burgundy guidebook"
jobs = [
 {"out": "candidates/a-plush.png", "prompt": f"A premium 3D animated character render of {CHAR}. Soft velvety plush-toy fur, rounded friendly proportions, big head, soft studio lighting, standing and waving hello. {BG}"},
 {"out": "candidates/b-pixar.png", "prompt": f"A premium 3D animated feature-film style character render of {CHAR}. Expressive, charming, slightly chubby, standing and waving hello with a big smile. {BG}"},
 {"out": "candidates/c-illustrated.png", "prompt": f"A clean flat-shaded storybook illustration of {CHAR}, matching the logo's drawing style with soft outlines, standing and waving hello. {BG}"},
]
gen.run(jobs, [ref])
