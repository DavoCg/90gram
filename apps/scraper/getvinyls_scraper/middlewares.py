"""Spider/downloader middlewares.

Politeness (robots.txt, AutoThrottle, retry/backoff, User-Agent) is handled entirely by
Scrapy's built-in middlewares via settings.py, so there is no custom middleware here yet.
Add project-specific middlewares in this module if a source ever needs them.
"""

from __future__ import annotations
