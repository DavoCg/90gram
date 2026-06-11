"""Genre canonicalization for the sanitizer pipeline.

Shops spell the same genre many ways: case, spacing, hyphen-vs-joined, accents, punctuation, and
outright typos. Left alone they fan out into separate ``genres`` rows ("Avant-garde", "Avantgarde",
"Avante-garde" become three), which fragments discovery. ``GenreSanitizerPipeline`` collapses a raw
genre to one canonical display name using the rules below, in one place, before the DB write.

Two layers do the work:

1. A comparison key (``_genre_key``) that lower-cases, strips accents, and drops every non-alnum
   character. So "Acid House", "acid house", and "acidhouse" share the key ``acidhouse``. Pure
   case/spacing/accent variants already collapse at write time because they slugify to the same
   ``genres.slug`` (the table's unique key), so they need no entry below.

2. An ``_ALIASES`` map (comparison key -> canonical display name) for the cases the slug cannot
   merge on its own: a separator that is present in one form and absent in another ("deephouse" vs
   "Deep House" slugify differently), and genuine spelling/format variants ("Avante-garde",
   "Spirtual", "Drum N Bass"). This is deliberately conservative: format and spelling only, no
   semantic guesses. Adding a new merge is a one-line entry keyed by the variant's ``_genre_key``.
"""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Iterable

_SLUG_RE = re.compile(r"[^a-z0-9]+")
_KEY_RE = re.compile(r"[^a-z0-9]+")


def slugify(name: str) -> str:
    """The ``genres.slug`` form: lower-case, non-alphanumeric runs to hyphens, trimmed.

    This is the canonical home for the slug rule; the write pipeline imports it so a genre's slug
    (its idempotency key) is computed identically on the crawl path and the cleanup path."""
    return _SLUG_RE.sub("-", name.lower()).strip("-")


def _genre_key(name: str) -> str:
    """Comparison key: lower-case, accents stripped, every non-alphanumeric character dropped.

    Strips separators entirely (unlike the slug, which keeps them as hyphens), so "Avant-garde" and
    "Avantgarde" share a key while still slugifying differently. This is what ``_ALIASES`` is keyed
    on."""
    decomposed = unicodedata.normalize("NFKD", name)
    stripped = "".join(c for c in decomposed if not unicodedata.combining(c))
    return _KEY_RE.sub("", stripped.lower())


# Comparison key -> canonical display name. Format and spelling variants only; no semantic merges.
# Each value is the spelling we keep; the keys are every variant's _genre_key that should fold into
# it. Variants that differ only by case/spacing/accents are omitted on purpose: they already merge
# via the shared slug.
_ALIASES: dict[str, str] = {
    # Avant-garde: the canonical example. "Avant-garde"/"Avantgarde" share a key; "Avante-garde"
    # carries an extra "e", so it needs its own entry.
    "avantgarde": "Avant-garde",
    "avantegarde": "Avant-garde",
    "avantgardejazz": "Avant-garde Jazz",
    "avantegardejazz": "Avant-garde Jazz",
    # Joined-vs-spaced: identical words, only the separator differs, so the slugs differ.
    "deephouse": "Deep House",
    "bossanova": "Bossa Nova",
    "jazzdance": "Jazz Dance",
    "bigroom": "Big Room",
    "neotrance": "Neo Trance",
    # Punctuation / "n" abbreviation for "and".
    "drumbass": "Drum & Bass",
    "drumnbass": "Drum & Bass",
    "rocknroll": "Rock & Roll",
    "rockroll": "Rock & Roll",
    "rb": "R&B",
    "rhythmblues": "R&B",
    # Plain misspellings.
    "doowoop": "Doo Wop",
    "doowop": "Doo Wop",
    "spirtual": "Spiritual",
    "spiritual": "Spiritual",
    "highlige": "Highlife",
    "raggaton": "Reggaeton",
    # Initialisms whose canonical display is upper-case.
    "idm": "IDM",
    "edm": "EDM",
}


def canonical_genre(raw: str) -> str | None:
    """Canonical display name for a raw genre string, or ``None`` if it is blank.

    Collapses internal whitespace, then resolves spelling/format variants through ``_ALIASES``.
    Anything not in the map is returned cleaned but otherwise untouched (the write path's slug still
    merges incidental case/spacing dupes)."""
    cleaned = " ".join(raw.split())
    if not cleaned:
        return None
    return _ALIASES.get(_genre_key(cleaned), cleaned)


# Shop tags that are not genres: medium/format, stock and condition words, and marketing/curation
# labels. Dropped from every listing so they never become a `genres` row. Matched by comparison key,
# so case and punctuation do not matter. Deliberately conservative: words that could plausibly be a
# real genre (e.g. "Classics") are left out, since the `validated` gate already hides anything
# unreviewed; only the unambiguous non-genres go here.
_NON_GENRE_NAMES: tuple[str, ...] = (
    # Marketing / curation labels.
    "Vinyl Only",
    "Limited",
    "Banger",
    "Warehouse Find",
    "Secret Weapon",
    "futuresale",
    "UR Classic",
    "UR Dancefloor Tools",
    "1St@Vinyl",
    "Exclusive",
    "Restock",
    "Bestseller",
    "Best Seller",
    "Staff Pick",
    "Staff Picks",
    "New Arrival",
    "New Arrivals",
    "Back In Stock",
    "Promo",
    "Hot",
    "Top Seller",
    "Deadstock",
    "misc",
    # Medium / format / version (not a genre).
    "Vinyl",
    "Records & LPs",
    "LP",
    "Album",
    "Compilation",
    "Live",
    "Cover",
    "Reissue",
    "Reissues",
    "Repress",
    "Represses",
    "CD",
    "Test Pressing",
    # Stock / condition / housekeeping (some also signal used stock, which we never ingest).
    "Sale",
    "Clearance",
    "Pre-Order",
    "Preorder",
    "Used",
    "Second-Hand",
    "Second Hand",
    "2nd-Hand",
    "New",
    "vatmarginscheme",
    "discogs",
    "process",
    "djchart",
    "omega",
    "shsale",
)
_NON_GENRE_KEYS: frozenset[str] = frozenset(_genre_key(n) for n in _NON_GENRE_NAMES)


def is_genre(name: str) -> bool:
    """False for shop tags that are not genres (medium, stock/condition, marketing labels)."""
    return _genre_key(name) not in _NON_GENRE_KEYS


def sanitize_genres(raw_genres: Iterable[str]) -> list[str]:
    """Canonicalize a listing's genres, drop blanks and non-genres, preserving order.

    De-duplicates on the resulting slug (the ``genres`` table's unique key), so a listing that
    reports both "Deep House" and "deephouse" yields a single "Deep House"."""
    seen: set[str] = set()
    result: list[str] = []
    for raw in raw_genres:
        name = canonical_genre(raw)
        if name is None or not is_genre(name):
            continue
        slug = slugify(name)
        if not slug or slug in seen:
            continue
        seen.add(slug)
        result.append(name)
    return result
