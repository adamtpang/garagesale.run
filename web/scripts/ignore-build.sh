#!/bin/bash
# Vercel's Ignored Build Step, run from web/. Exit 0 skips the build, exit 1 builds.
# Builds cost money, so production builds only when web/ changed. See "Build cost controls" in the
# workspace's tools/analytics/README.md.
# - Previews never build. To see a branch live, run `vercel deploy` from web/.
# - A redeploy of the commit that is already live always builds: it is on purpose, usually a changed
#   environment variable such as a rotated key.
# - A new commit builds only when something under web/ changed since the last production deploy.
if [ "$VERCEL_ENV" != "production" ]; then exit 0; fi
PREV="${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}"
git cat-file -e "$PREV^{commit}" 2>/dev/null || exit 1
if [ "$(git rev-parse "$PREV")" = "$(git rev-parse HEAD)" ]; then exit 1; fi
git diff --quiet "$PREV" HEAD -- .
