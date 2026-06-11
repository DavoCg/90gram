"""Unit tests for genre canonicalization (genres.canonical_genre / sanitize_genres)."""

from __future__ import annotations

import pytest

from getvinyls_scraper.genres import canonical_genre, is_genre, sanitize_genres, slugify


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        # The canonical example: spelling and separator variants fold onto one name.
        ("Avant-garde", "Avant-garde"),
        ("Avantgarde", "Avant-garde"),
        ("Avante-garde", "Avant-garde"),
        # Joined vs spaced (slugs differ, so the pipeline cannot merge them on its own).
        ("deephouse", "Deep House"),
        ("Deep House", "Deep House"),
        ("Bossanova", "Bossa Nova"),
        # Punctuation / "n" abbreviation.
        ("Drum&Bass", "Drum & Bass"),
        ("Drum N Bass", "Drum & Bass"),
        ("Rock'n'roll", "Rock & Roll"),
        ("R & B", "R&B"),
        # Plain misspellings and initialisms.
        ("Spirtual", "Spiritual"),
        ("Doo Woop", "Doo Wop"),
        ("Highlige", "Highlife"),
        ("Idm", "IDM"),
        # Unknown genres pass through cleaned but unchanged.
        ("Techno", "Techno"),
        ("  Acid   House ", "Acid House"),
    ],
)
def test_canonical_genre(raw: str, expected: str) -> None:
    assert canonical_genre(raw) == expected


def test_canonical_genre_blank_is_dropped() -> None:
    assert canonical_genre("   ") is None
    assert canonical_genre("") is None


def test_variants_share_one_slug() -> None:
    names = {canonical_genre(v) for v in ("Avant-garde", "Avantgarde", "Avante-garde")}
    assert names == {"Avant-garde"}
    assert len({slugify(n or "") for n in names}) == 1


def test_sanitize_genres_dedupes_and_preserves_order() -> None:
    raw = ["Deep House", "deephouse", "Techno", "", "  ", "Avantgarde", "Avante-garde"]
    assert sanitize_genres(raw) == ["Deep House", "Techno", "Avant-garde"]


@pytest.mark.parametrize(
    "junk",
    ["Vinyl Only", "vinyl only", "Limited", "Banger", "Reissue", "Used", "CD", "1St@Vinyl"],
)
def test_non_genres_are_dropped(junk: str) -> None:
    assert is_genre(junk) is False
    assert sanitize_genres([junk]) == []


@pytest.mark.parametrize("real", ["Techno", "Deep House", "New Wave", "Acid", "Disco"])
def test_real_genres_are_kept(real: str) -> None:
    assert is_genre(real) is True


def test_sanitize_genres_filters_junk_but_keeps_real() -> None:
    raw = ["House", "Vinyl Only", "Disco", "Limited", "Used"]
    assert sanitize_genres(raw) == ["House", "Disco"]
