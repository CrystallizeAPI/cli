#!/usr/bin/env bash

CRYSTALLIZE_HOME="$HOME/.crystallize"
mkdir -p $CRYSTALLIZE_HOME
cd $CRYSTALLIZE_HOME

OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

if [ "$ARCH" = "x86_64" ]; then
  ARCH="x64"
elif [ "$ARCH" = "arm64" ] || [ "$ARCH" = "aarch64" ]; then
  ARCH="arm64"
else
  echo "❌ Unsupported architecture: $ARCH"
  exit 1
fi

case "$OS" in
  windows|mingw*|msys*|cygwin*) FILE="bun-windows-${ARCH}.exe" ;;
  *) FILE="bun-${OS}-${ARCH}" ;;
esac

LATEST_RELEASE=$(curl -s "https://api.github.com/repos/crystallizeapi/cli/releases/latest" | grep tag_name | cut -d'"' -f 4)
URL="https://github.com/CrystallizeAPI/cli/releases/download/${LATEST_RELEASE}/crystallize-${FILE}"

echo "🌍 Detected platform: ${OS}-${ARCH}"
echo "📥 Downloading file: ${URL}"

if curl -fLO "${URL}"; then
  echo "✅ Successfully downloaded ${FILE}"
else
  echo "❌ Failed to download ${FILE}. Please check the URL or platform."
  exit 1
fi

ln -sf $CRYSTALLIZE_HOME/crystallize-${FILE} $HOME/crystallize
chmod +x $HOME/crystallize

echo "You can now use Crystallize CLI by running: ~/crystallize"
echo ""
echo "- You may want to put ~/crystallize in you PATH"
echo "- You may want to creat an alias (in your .zshrc or .bashrc) alias crystallize='~/crystallize'"

~/crystallize
exec "$SHELL" -l
