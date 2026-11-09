#!/bin/sh
# Install Lyric Home + the Paper snippet into a vault. Usage: ./install.sh ~/claude/second-brain
set -e
V="${1:?vault path}"
D="$V/.obsidian/plugins/lyric-home"
mkdir -p "$D" "$V/.obsidian/snippets"
cp main.js manifest.json styles.css "$D/"
cp theme/paper.css "$V/.obsidian/snippets/paper.css"
echo "Installed to $D and $V/.obsidian/snippets/paper.css"
