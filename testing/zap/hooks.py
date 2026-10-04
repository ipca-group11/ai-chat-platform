# zap-baseline.py hook (--hook), the only Python file of the DAST setup: ZAP loads hooks in Python.
# Requests the signed-in pages itself before the spiders start, so they are in the site tree and in the
# report whether or not the spiders reach them (the AJAX/client spider on a CI runner did not).
# The paths come from ZAP_SEED_PATHS (comma separated, set by run.sh); the cookie is added by the replacer rule.
import os


def zap_started(zap, target):
    base = target[: target.index("/", 8)] if target.count("/") > 2 else target.rstrip("/")
    for path in filter(None, os.environ.get("ZAP_SEED_PATHS", "").split(",")):
        url = base + "/" + path.strip().lstrip("/")
        print("Seeding " + url)
        zap.core.access_url(url=url, followredirects="true")
