#!/bin/sh
# Proves that the secret scan blocks a leaked key: commits a fake but realistic
# AWS-style key in a throw-away worktree, runs the same gitleaks command as the
# CI job over that commit and exits with gitleaks' exit code. Nothing is kept.
set -u
root=$(git rev-parse --show-toplevel)
tmp=$(mktemp -d)
branch="tmp/secret-proof-$$"
git -C "$root" worktree add -q -b "$branch" "$tmp/wt" HEAD || exit 2
key="AKIA$(LC_ALL=C tr -dc 'A-Z2-7' </dev/urandom | head -c 16)"
printf 'aws_access_key_id = %s\n' "$key" > "$tmp/wt/leak.env"
git -C "$tmp/wt" add leak.env
git -C "$tmp/wt" -c user.name=proof -c user.email=proof@example.invalid commit -q -m "test: fake key"
echo "committed a fake key in throw-away branch $branch"
(cd "$tmp/wt" && gitleaks git --redact --no-banner --config "$root/.gitleaks.toml" --log-opts="HEAD~1..HEAD")
code=$?
git -C "$root" worktree remove --force "$tmp/wt"
git -C "$root" branch -D -q "$branch"
rm -rf "$tmp"
echo "gitleaks exit code: $code (non-zero fails the CI job)"
exit "$code"
