"""Pre-populate the blog database with a handful of starter posts.

Run directly to (re)seed the database::

    python seed.py

It is also invoked automatically by ``app.init_db`` when the posts table is
empty, so a freshly deployed instance always has content to show.
"""

from datetime import date

from app import Post, app, db

SAMPLE_POSTS = [
    {
        "title": "Reading the Heartbeat: Skeletonized Dials and Mechanical Movements",
        "date": date(2026, 6, 20),
        "category": "Watches",
        "content": (
            "There is something quietly hypnotic about a skeletonized dial. Instead "
            "of hiding the movement behind a slab of lacquer, the watchmaker cuts "
            "away every non-essential bridge and plate until the mechanism itself "
            "becomes the decoration.\n\n"
            "At the core sits the mainspring, slowly unwinding its stored energy "
            "through the gear train. The escapement \u2014 lever, escape wheel, and "
            "balance \u2014 doles that energy out in precise, equal beats, usually "
            "28,800 vibrations per hour. Watching the balance wheel breathe back and "
            "forth is watching time being measured in real time.\n\n"
            "Skeletonizing is as much engineering as art: remove too much metal and "
            "the bridges flex, throwing off the gear depthing and killing accuracy. "
            "The best open-worked calibers are a study in how little material a "
            "structure actually needs \u2014 a lesson that applies just as well to "
            "software as it does to horology."
        ),
    },
    {
        "title": "Building a Trail Weapon: A Custom Mountain Bike, Part by Part",
        "date": date(2026, 6, 16),
        "category": "Cycling",
        "content": (
            "A custom build always starts with the frame, and for this trail bike I "
            "went with a 140mm-travel aluminum frame with modern geometry: a slack "
            "64.5\u00b0 head angle, a steep 77\u00b0 seat tube, and a reach that "
            "finally fits my long legs.\n\n"
            "The drivetrain is a 1x12 setup \u2014 a single 32-tooth chainring up "
            "front and a 10\u201352 cassette out back. Ditching the front derailleur "
            "simplifies shifting and clears space for a piggyback air shock. Braking "
            "comes from four-piston hydraulic calipers biting 203mm rotors, because "
            "stopping power matters more than grams on steep descents.\n\n"
            "Wheels are the soul of the ride: 29-inch carbon rims laced to hubs with "
            "a fast-engaging 6-degree freehub, wrapped in a tacky 2.4-inch front tire "
            "and a faster-rolling rear. Tuned tubeless to 22 PSI front and 25 rear, "
            "the whole bike comes in just under 14 kilograms and absolutely rips."
        ),
    },
    {
        "title": "Pair Programming with Machines: Getting Real Value from AI Coding Agents",
        "date": date(2026, 6, 12),
        "category": "Software",
        "content": (
            "AI coding agents have gone from autocomplete to genuine collaborators, "
            "but getting good results still takes deliberate technique.\n\n"
            "The biggest lever is context. An agent that can see your file tree, run "
            "your tests, and read error output will outperform one that only sees a "
            "single snippet. Treat the agent like a sharp new teammate: give it the "
            "task, the constraints, and the definition of done, then let it iterate "
            "against the test suite.\n\n"
            "Keep changes reviewable. Ask for small, focused diffs and read every "
            "line before committing \u2014 the agent is responsible for the draft, but "
            "you are responsible for the merge. Lean on it for the work that drains "
            "you: scaffolding, refactors, test coverage, and tracking down that "
            "off-by-one bug. Used well, it does not replace engineering judgment; it "
            "amplifies it."
        ),
    },
    {
        "title": "First Breaths on the Dizi: An Introduction to the Bamboo Flute",
        "date": date(2026, 6, 8),
        "category": "Music",
        "content": (
            "The dizi is a transverse Chinese bamboo flute, and the first thing that "
            "surprises newcomers is the extra hole. Between the blowing hole and the "
            "finger holes sits the mokong, covered with a thin membrane of reed "
            "called dimo.\n\n"
            "That membrane is the secret to the dizi's voice. When you play, the "
            "dimo vibrates and adds a bright, buzzing resonance that makes the flute "
            "sing and carry. Gluing it on with just the right amount of tension is a "
            "ritual every player learns to love and curse in equal measure.\n\n"
            "Start with a D-key dizi, which is forgiving for beginners. Focus first "
            "on a steady embouchure and clean long tones before chasing fast "
            "ornaments. Within a few weeks you will move from breathy hisses to clear "
            "notes \u2014 and the moment the dimo finally buzzes in tune, you will "
            "understand why this simple tube of bamboo has been played for thousands "
            "of years."
        ),
    },
]


def seed_posts():
    """Insert the sample posts (clearing any existing rows first)."""
    db.session.query(Post).delete()
    for data in SAMPLE_POSTS:
        db.session.add(Post(**data))
    db.session.commit()


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        seed_posts()
        print(f"Seeded {len(SAMPLE_POSTS)} posts.")
