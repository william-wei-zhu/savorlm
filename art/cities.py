# One food-themed badge per city for the landing page chooser (BikeSim-style
# city tiles). Same plush 3D look as Savvy, on flat blue for the chroma key,
# so no subject may be blue.
import sys, concurrent.futures as cf
import gen
ref = gen.b64('candidates/savvy-ref.png')
BASE = ("A single cute round badge icon in the same soft 3D plush-toy render style and soft lighting as the reference image (match its materials, not its character). "
        "The badge is a round warm cream felt disc with a stitched rim (the disc is never blue), and on it sits {subject}. Chunky, simple, readable at small size, centered, filling most of the frame, no text, no letters, no people, no raccoon, nothing blue. "
        "Background must be a completely flat, uniform pure blue color RGB(0,0,255) with no gradient, no shadow, no floor. Square image.")
CITIES = {
 "new-york": "a folded slice of New York pizza with a tiny green Statue of Liberty torch",
 "boston": "a lobster roll in a toasted bun with a bright red lobster claw",
 "philadelphia": "a cheesesteak sandwich with a small bronze Liberty Bell",
 "washington-dc": "a half-smoke sausage in a bun with pink cherry blossoms",
 "atlanta": "a ripe peach next to a golden fried chicken drumstick",
 "nashville": "spicy red Nashville hot chicken on white bread with pickles and a small acoustic guitar",
 "new-orleans": "three powdered-sugar beignets with a small brass trumpet",
 "miami": "a pressed Cuban sandwich with a pink flamingo and a palm leaf",
 "austin": "sliced smoked brisket on butcher paper with a small cowboy boot",
 "houston": "a bright red boiled crawfish with corn and a lemon wedge",
 "dallas": "a sizzling steak with a tan cowboy hat",
 "chicago": "a deep-dish pizza slice with a long cheese pull",
 "minneapolis": "a Juicy Lucy cheeseburger with molten cheese oozing from the middle",
 "denver": "a bowl of green chile stew in front of a small snowy mountain peak",
 "phoenix": "a Sonoran hot dog wrapped in bacon next to a green saguaro cactus",
 "las-vegas": "a sparkling cocktail glass with gold neon star sparkles and a red dice",
 "san-francisco": "a round sourdough bread bowl with a small red-orange Golden Gate Bridge tower",
 "los-angeles": "two street tacos with a small palm tree",
 "san-diego": "a crispy fish taco with lime and a small orange surfboard",
 "seattle": "a cup of coffee with latte art next to a pink salmon fillet",
 "portland": "a pink frosted doughnut with sprinkles and a small pine tree",
}
only = set(sys.argv[1].split(",")) if len(sys.argv) > 1 else None
jobs = [(k, BASE.format(subject=v)) for k, v in CITIES.items() if not only or k in only]
with cf.ThreadPoolExecutor(7) as ex:
    for r in ex.map(lambda j: gen.gen(f"cities/raw-{j[0]}.png", j[1], [ref]), jobs): print(r, flush=True)
