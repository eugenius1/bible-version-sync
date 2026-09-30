#!/usr/bin/env bash
# Copy the youversion-platform-api skill from youversion/platform-skills into
# .claude/skills, or with --check, fail if the copy differs from upstream.
#
# Content is compared, not commits, so upstream changes to its other skills
# don't count as staleness. Upstream's scripts/ (a test harness hardcoded to
# its author's machine) and agents/ (Codex metadata) are left out.
set -euo pipefail

repo=https://github.com/youversion/platform-skills.git
skill=youversion-platform-api
dest="$(git rev-parse --show-toplevel)/.claude/skills/$skill"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
git clone --quiet --depth 1 "$repo" "$tmp/upstream"
commit=$(git -C "$tmp/upstream" rev-parse HEAD)

cp -R "$tmp/upstream/skills/$skill" "$tmp/expected"
rm -rf "$tmp/expected/scripts" "$tmp/expected/agents"
cp "$tmp/upstream/LICENSE" "$tmp/expected/LICENSE"
echo "$commit" > "$tmp/expected/.upstream"

if [[ "${1:-}" == "--check" ]]; then
  if ! diff -r --exclude=.upstream "$tmp/expected" "$dest"; then
    echo "::error::.claude/skills/$skill differs from youversion/platform-skills@${commit:0:7}." \
      "Run tools/youversion-skill.sh, read the diff, and commit it."
    exit 1
  fi
  echo "$skill matches youversion/platform-skills@${commit:0:7}"
else
  rm -rf "$dest"
  cp -R "$tmp/expected" "$dest"
  echo "Copied $skill from youversion/platform-skills@${commit:0:7}"
fi
