"""List every version of every language YouVersion has, with its numbering label.

configuration.json gives the full language list (2,462 languages, 3,864
versions in Sept 2026) and each language's version count; versions.json then
gives every version of a language, with `vrs`, one request per language. Both
are cached in out/, requests are sequential and paced, and the run stops on
the first request that still fails after scan.get's retries, so a rate limit
ends it rather than hammering on. Rerunning resumes from the cache.

Writes data/candidates.json (every version, by language tag) and
data/defaults.json (the version bible.com opens for each language, which the
app ranks first among that language's versions), and prints the label
coverage by languages and by versions.

    python3 languages.py
"""
import json, os, sys, time

from scan import OUT, get

HERE = os.path.dirname(__file__)
CANDIDATES = os.path.join(HERE, "data", "candidates.json")
COUNTS = os.path.join(HERE, "data", "counts.json")
DEFAULTS = os.path.join(HERE, "data", "defaults.json")
PAUSE = 0.25  # seconds between uncached requests
FIELDS = ("id", "abbreviation", "local_abbreviation", "local_title", "vrs")


def cached(name, path):
    file = os.path.join(OUT, name)
    if not os.path.exists(file):
        data = get(path)
        if data is None: raise RuntimeError(f"not found: {path}")
        json.dump(data, open(file + ".tmp", "w"), ensure_ascii=False)
        os.replace(file + ".tmp", file)
        time.sleep(PAUSE)
    return json.load(open(file))


def main():
    config = cached("configuration.json", "configuration.json")
    languages = sorted(config["default_versions"], key=lambda l: l["language_tag"])
    candidates = {}
    for i, lang in enumerate(languages):
        tag = lang["language_tag"]
        try:
            listing = cached(f"versions-{tag}.json", f"versions.json?language_tag={tag}&type=all")
        except Exception as e:
            print(f"stopped at {tag} ({i}/{len(languages)}): {e}", file=sys.stderr)
            sys.exit(1)
        if listing["totals"]["versions"] != lang["total_versions"]:
            print(f"{tag}: lists {listing['totals']['versions']} versions, configuration says {lang['total_versions']}")
        candidates[tag] = sorted(({k: v[k] for k in FIELDS} for v in listing["versions"] if v.get("text")),
                                 key=lambda v: v["id"])
        if i % 100 == 0: print(f"{i}/{len(languages)} {tag}", flush=True)

    # One version per line: the file is diffable without being 3,864 x 7 lines.
    body = ",\n".join(f"{json.dumps(tag)}: [\n" + ",\n".join(json.dumps(v, ensure_ascii=False) for v in vs) + "\n]"
                      for tag, vs in candidates.items())
    open(CANDIDATES, "w").write("{\n" + body + "\n}\n")

    # The only popularity signal YouVersion publishes: the version each
    # language opens on.
    defaults = {l["language_tag"]: l["id"] for l in languages}
    for tag, id in defaults.items():
        if id not in {v["id"] for v in candidates[tag]}: raise RuntimeError(f"{tag}: default {id} isn't listed")
    open(DEFAULTS, "w").write("{\n" + ",\n".join(f"{json.dumps(t)}: {i}" for t, i in defaults.items()) + "\n}\n")

    counts = json.load(open(COUNTS))
    report(config, candidates, counts)


def report(config, candidates, counts):
    """A version is known when YouVersion labels it or the survey scanned it."""
    versions = [v for vs in candidates.values() for v in vs]
    known = lambda v: bool(v["vrs"]) or str(v["id"]) in counts
    full = [t for t, vs in candidates.items() if all(map(known, vs))]
    labelled = sum(1 for v in versions if v["vrs"])
    print(f"{config['totals']['languages']} languages, {config['totals']['versions']} versions per configuration.json")
    print(f"{len(candidates)} languages listed, {len(versions)} text versions")
    print(f"versions labelled: {labelled} ({labelled / len(versions):.1%}); "
          f"known (labelled or scanned): {sum(map(known, versions))} ({sum(map(known, versions)) / len(versions):.1%})")
    print(f"languages with every version known: {len(full)} ({len(full) / len(candidates):.1%})")


if __name__ == "__main__":
    main()
