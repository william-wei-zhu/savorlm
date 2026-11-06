import gen
ref = gen.b64('candidates/a-plush.png')
BG = "Background must be a completely flat, uniform pure blue color RGB(0,0,255) with no gradient, no shadow, no floor, no other objects, no text. Square image. Full body visible with small margin, centered."
CHAR = ("a much CUTER, baby version of the raccoon in the reference: a tiny chibi plush raccoon cub with an oversized round head (head about as big as the body), huge round sparkly brown eyes with big white highlights, "
        "soft rosy pink cheeks, a tiny black button nose, little smile, small rounded ears with pink insides, chubby short arms and legs, a big fluffy ringed striped tail curling beside him, "
        "soft velvety plush-toy fur, wearing a tiny burgundy neckerchief and a small cream chef jacket with burgundy buttons, holding a tiny burgundy guidebook")
jobs = [
 {"out": "candidates/cute-a.png", "prompt": f"A premium 3D animated character render of {CHAR}. Waving hello happily. Soft studio lighting, adorable, toy-like. {BG}"},
 {"out": "candidates/cute-b.png", "prompt": f"A premium 3D animated character render of {CHAR}, also wearing a tiny tilted burgundy beret. Waving hello happily with a big open smile. Soft studio lighting, adorable, toy-like. {BG}"},
 {"out": "candidates/cute-c.png", "prompt": f"A premium 3D animated feature-film style character render of {CHAR}. Waving hello with an excited sparkle in his eyes. Soft rim lighting, irresistibly adorable. {BG}"},
]
gen.run(jobs, [ref])
