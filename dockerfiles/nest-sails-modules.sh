#!/bin/sh
# Recreate nested module paths that Sails 0.10 hardcodes (prod npm@1/2 layout).
# npm@3+ flattens the tree; without these links, lift/Grunt fail the same way.
#
# Sails expects:
#   express/node_modules/{cookie,connect}
#   socket.io/node_modules/redis
#   sails/node_modules/grunt-cli/bin/grunt
# Gruntfile also falls back to:
#   sails/node_modules/include-all
set -e

ROOT="${1:-.}"
NM="$ROOT/node_modules"

link_nested() {
  parent="$1"
  child="$2"
  parent_dir="$NM/$parent"
  dest="$parent_dir/node_modules/$child"

  if [ ! -d "$parent_dir" ]; then
    return 0
  fi
  mkdir -p "$parent_dir/node_modules"
  if [ -e "$dest" ]; then
    return 0
  fi
  if [ -d "$NM/$child" ]; then
    ln -s "../../$child" "$dest"
    echo "nest-modules: $parent/node_modules/$child -> ../../$child"
    return 0
  fi
  if [ -d "$NM/sails/node_modules/$parent/node_modules/$child" ]; then
    ln -s "../../../sails/node_modules/$parent/node_modules/$child" "$dest"
    echo "nest-modules: $parent/node_modules/$child from sails tree"
    return 0
  fi
  echo "nest-modules: WARNING missing $parent/node_modules/$child" >&2
}

link_nested express cookie
link_nested express connect
link_nested socket.io redis
link_nested sails grunt-cli
link_nested sails include-all
