#!/bin/sh
# Points git at the versioned hooks folder (works on macOS and Linux).
git config core.hooksPath scripts/git-hooks && echo "git hooks installed: core.hooksPath=scripts/git-hooks"
