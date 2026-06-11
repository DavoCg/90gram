# Egg metadata for Scrapyd. Scrapyd runs a project from a Python egg, so the Docker image builds one
# at image-build time (`python setup.py bdist_egg`) and pre-loads it into Scrapyd's eggs dir. The
# egg carries only this project's code; runtime deps (scrapy, sqlalchemy, psycopg, ...) come from
# the image's venv. The `scrapy` entry point tells Scrapyd which settings module to use. Deps and
# tooling live in pyproject.toml / uv.lock; this file exists solely to package the egg.
from setuptools import find_packages, setup

setup(
    name="getvinyls_scraper",
    version="1.0",
    packages=find_packages(exclude=["fixtures"]),
    entry_points={"scrapy": ["settings = getvinyls_scraper.settings"]},
)
