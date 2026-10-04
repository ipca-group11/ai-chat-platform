#!/bin/sh
# Demonstrates the pre-commit hook in a throw-away worktree: a staged fake key is
# blocked, a clean file is committed. Nothing is kept.
root=$(git rev-parse --show-toplevel)
tmp=$(mktemp -d); branch="tmp/hook-demo-$$"
git -C "$root" worktree add -q -b "$branch" "$tmp/wt" HEAD || exit 2
cd "$tmp/wt"
c() { git -c core.hooksPath="$root/scripts/git-hooks" -c user.name=demo -c user.email=demo@example.invalid commit -m "$1"; }
printf 'aws_access_key_id = AKIA%s\n' "$(LC_ALL=C tr -dc 'A-Z2-7' </dev/urandom | head -c 16)" > leak.env
git add leak.env
echo "== 1. commit with a staged fake key"; c "test: fake key"; echo "commit exit code: $?"
git reset -q leak.env; rm leak.env
echo "== 2. clean commit"; echo "hello" > clean.txt; git add clean.txt; c "test: clean file" | tail -1; echo "commit exit code: $?"
echo "== 3. gitleaks missing"; PATH=/usr/bin:/bin sh "$root/scripts/git-hooks/pre-commit"; echo "hook exit code: $?"
cd "$root"; git worktree remove --force "$tmp/wt"; git branch -D -q "$branch"; rm -rf "$tmp"
