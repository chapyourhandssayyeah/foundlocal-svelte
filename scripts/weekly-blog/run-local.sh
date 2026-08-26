#!/bin/bash
# Weekly AEO blog draft — LOCAL runner.
#
# Why local: the drafter uses the Claude Code subscription (`claude -p`), which
# only exists on this Mac. The GitHub Actions schedule was removed because
# Actions can only authenticate with a metered API key, and that key expired on
# 6 Jul 2026 and failed silently for eight straight weeks.
#
# Complies with ~/.claude/rules/scheduled-jobs.md: three outcomes, a denominator,
# one heartbeat line per run, non-zero exit on failure, loud on dead preconditions.

set -uo pipefail

JOB_ID="geolocally-weekly-blog"
RUN_ID="$(date -u +%Y%m%dT%H%M%S)"
REPO="$HOME/Projects/geolocally-svelte"
HEARTBEAT="$HOME/.openclaw/logs/heartbeats.jsonl"
BRANCH_PREFIX="weekly-blog"

outcome="fail"; exit_code=1; denominator=0; numerator=0
auth_ok="false"; delivered="null"; error=""

emit() {
  python3 - "$JOB_ID" "$RUN_ID" "$outcome" "$exit_code" "$denominator" "$numerator" \
             "$auth_ok" "$delivered" "$error" "$HEARTBEAT" <<'PY'
import json, sys, datetime, pathlib
job, run, outcome, code, den, num, auth, delivered, err, path = sys.argv[1:11]
rec = {
  "run_id": run, "outcome": outcome, "exit_code": int(code),
  "denominator": int(den), "numerator": int(num),
  "auth_ok": auth == "true",
  "delivered": None if delivered == "null" else delivered,
  "scope_fingerprint": "dodonai/geolocally-svelte weekly AEO blog draft via claude -p",
  "error": err or None,
  "ts": datetime.datetime.now(datetime.timezone.utc).isoformat(),
  "job_id": job,
}
p = pathlib.Path(path); p.parent.mkdir(parents=True, exist_ok=True)
with p.open("a") as f: f.write(json.dumps(rec) + "\n")
print(json.dumps(rec))
PY
}

fail() { error="$1"; outcome="fail"; exit_code="${2:-1}"; emit; exit "$exit_code"; }

# --- preconditions: a dead one ALWAYS pages, never a quiet pass ---
command -v claude >/dev/null 2>&1 || fail "claude CLI not on PATH"
command -v gh     >/dev/null 2>&1 || fail "gh CLI not on PATH"
cd "$REPO" || fail "repo not found at $REPO"

echo "SUBSCRIPTION_PROBE" | claude -p >/dev/null 2>&1 || fail "claude CLI cannot authenticate (subscription expired or logged out)"
auth_ok="true"

gh auth status >/dev/null 2>&1 || fail "gh not authenticated"

git fetch origin main --quiet || fail "git fetch failed"
git checkout -q main && git reset -q --hard origin/main || fail "could not reset to origin/main"

# denominator: posts already published. Zero here means the content file is broken.
denominator=$(grep -c '^    slug: "' src/lib/content/blog-posts.js 2>/dev/null || echo 0)
[ "$denominator" -gt 0 ] || fail "zero posts found in blog-posts.js — parse failed, not a quiet day"

# --- draft ---
OUT="$(mktemp)"
GITHUB_OUTPUT="$OUT" node scripts/weekly-blog/run.mjs 2>&1 | tail -40
rc=${PIPESTATUS[0]}
[ "$rc" -eq 0 ] || fail "drafter exited $rc" "$rc"

# The generated post is untrusted input to the build. Never push one that does
# not compile — a broken blog-posts.js takes the whole site deploy down.
node --check src/lib/content/blog-posts.js \
  || fail "generated blog-posts.js is not valid JS — refusing to push"
npm run build >/dev/null 2>&1 \
  || fail "site build failed with the generated post — refusing to push"

SLUG=$(grep '^slug=' "$OUT" | cut -d= -f2-)
TITLE=$(grep '^title=' "$OUT" | cut -d= -f2-)
QA=$(grep '^qa_status=' "$OUT" | cut -d= -f2-)

if [ -z "$SLUG" ]; then
  # Every topic already published is a legitimate 'empty', not a failure.
  outcome="empty"; exit_code=0; emit; exit 0
fi

# A missing cover doesn't fail the build (SvelteKit doesn't check referenced
# static assets), so it stays invisible until someone opens the post. Belt and
# suspenders on top of run.mjs's own renderCover() step.
[ -f "static/blog-covers/$SLUG.png" ] \
  || fail "no cover image was generated for $SLUG — refusing to push a broken image"
numerator=1

# --- open the PR ---
BRANCH="$BRANCH_PREFIX/$SLUG"

# Already delivered? An open PR for this slug means the post exists and is waiting
# on a human to read it. That is 'empty' (nothing new to do), never 'fail'.
EXISTING=$(gh pr list --repo dodonai/geolocally-svelte --state open \
             --json number,headRefName \
             --jq "[.[] | select(.headRefName | startswith(\"$BRANCH\"))] | .[0].number // empty" 2>/dev/null)
if [ -n "$EXISTING" ]; then
  delivered="PR #$EXISTING already open"
  outcome="empty"; exit_code=0
  git checkout -q main; emit; exit 0
fi

# A previous run may have been interrupted after creating this branch. Reuse the
# name locally (-B, not -b) so a stale branch cannot wedge the job forever, and
# date-suffix the remote name so the push never collides with an old branch.
git checkout -q -B "$BRANCH" || fail "could not create $BRANCH"
BRANCH="$BRANCH-$(date -u +%Y%m%d)"
git branch -M "$BRANCH" || fail "could not name $BRANCH"
git add "src/routes/blog/$SLUG" src/lib/content/blog-posts.js || fail "git add failed"
git -c user.name="geolocally-bot" -c user.email="hello@geolocally.com" \
    commit -q -m "Weekly AEO blog draft: $TITLE" || fail "commit failed"
git push -q origin "$BRANCH" || fail "push failed — delivery failure is job failure"

PR_URL=$(gh pr create --repo dodonai/geolocally-svelte --base main --head "$BRANCH" \
  --title "Weekly AEO blog draft: $TITLE" \
  --body "Auto-drafted weekly AEO post. Self-QA: \`$QA\`. Drafted on the Claude Code subscription, no metered API spend. Review the copy before merging." 2>&1) \
  || fail "gh pr create failed: $PR_URL"

delivered="$PR_URL"
outcome="ok"; exit_code=0
git checkout -q main
emit
