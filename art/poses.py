# Savvy's poses: standalone poses from the picked plush candidate, then frame
# variants (mouth closed, blinks) as edits of their base so they line up exactly.
import sys, concurrent.futures as cf
import gen
ref = gen.b64('candidates/savvy-ref.png')
BASE = ("Using the exact same 3D character from the reference image (Savvy, the tiny chibi plush raccoon cub food guide: oversized round head, huge sparkly brown eyes, rosy pink cheeks, "
        "tilted burgundy beret, burgundy neckerchief, cream chef jacket with burgundy buttons, big fluffy ringed tail, small burgundy guidebook, same premium 3D plush render style and soft lighting), "
        "render him {pose}. Full body visible with small margin, centered. "
        "Background must be a completely flat, uniform pure blue color RGB(0,0,255) with no gradient, no shadow, no floor, no other objects, no text. Square image.")
POSES = {
 "wave": "standing and happily waving hello with one paw, big open smile, guidebook in the other paw",
 "listen": "standing and listening very attentively, head tilted slightly, ears perked up, gentle curious closed-mouth smile, holding the guidebook at his chest",
 "talk": "standing and talking cheerfully, mouth open mid-word, one paw raised in a friendly explaining gesture, guidebook in the other paw",
 "think": "standing and thinking, one paw on his chin, eyes looking up, flipping the guidebook open with the other paw",
 "point": "excitedly pointing with one paw to the side as if saying 'look over there!', curious big smile, looking where he points",
 "wow": "amazed, eyes wide and sparkling, mouth in a round 'O', both paws on his cheeks, guidebook tucked under one arm",
 "cheer": "jumping for joy with both arms raised, huge excited smile",
 "taste": "happily tasting a small bite from a fork, eyes closed in delight, cheeks round, a contented 'mmm' smile",
 "laugh": "giggling with eyes squeezed shut in happy crescents, big open laughing mouth, both paws on his round belly, leaning back a little",
 "clap": "clapping his paws together happily in front of his chest, big proud smile",
 "dance": "doing a happy little dance, standing on one foot with the other leg lifted, both arms out, tail swishing up, joyful open smile",
 "look": "looking far into the distance through a small brass binocular held up to his eyes with both paws, curious smile, his single fluffy tail curled up behind him on one side (exactly one tail)",
}
def edit(src, out, change):
    img = gen.b64(src)
    prompt = ("Edit this image. Keep EVERYTHING exactly identical: the same character, pose, position, size, framing, camera, lighting, fur, colors and the flat blue background. "
              f"Change ONLY this: {change}. Do not move, resize or re-pose anything else.")
    return gen.gen(out, prompt, [img])
stage = sys.argv[1] if len(sys.argv) > 1 else "base"
only = set(sys.argv[2].split(",")) if len(sys.argv) > 2 else None
if stage == "base":
    jobs = [lambda k=k, v=v: gen.gen(f"poses/raw-{k}.png", BASE.format(pose=v), [ref]) for k, v in POSES.items() if not only or k in only]
else:
    jobs = [
      lambda: edit("poses/raw-wave.png", "poses/raw-wave2.png", "his waving paw is tilted the other way, a little further to the side, mid-wave, and his tail is swished to the other side"),
      lambda: edit("poses/raw-dance.png", "poses/raw-dance2.png", "he is standing on the other foot with the opposite leg lifted, arms tilted the other way, tail swished to the other side"),
      lambda: edit("poses/raw-talk.png", "poses/raw-talk2.png", "his mouth is closed in a gentle, happy smile (as if between two words)"),
      lambda: edit("poses/raw-listen.png", "poses/raw-listen-blink.png", "his eyes are closed, mid-blink, with relaxed happy eyelids"),
      lambda: edit("poses/raw-talk.png", "poses/raw-talk-blink.png", "his eyes are closed, mid-blink"),
    ]
with cf.ThreadPoolExecutor(8) as ex:
    for r in ex.map(lambda f: f(), jobs): print(r, flush=True)
