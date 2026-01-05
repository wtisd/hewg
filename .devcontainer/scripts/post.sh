#!/bin/bash
set -e

echo "Running post-creation setup script..."

# Install Deno
echo "Installing Deno..."
curl -fsSL https://deno.land/install.sh | sh

# Add Deno to PATH for current session
export DENO_INSTALL="$HOME/.deno"
export PATH="$DENO_INSTALL/bin:$PATH"

# Add Deno to PATH for future shells
if ! grep -q 'DENO_INSTALL' ~/.bashrc 2>/dev/null; then
  echo 'export DENO_INSTALL="$HOME/.deno"' >> ~/.bashrc
  echo 'export PATH="$DENO_INSTALL/bin:$PATH"' >> ~/.bashrc
fi

# Verify Deno installation
echo "Verifying Deno installation..."
deno --version

# Cache dependencies if deno.json exists
if [ -f "/workspace/deno.json" ] || [ -f "/workspace/deno.jsonc" ]; then
  echo "Caching Deno dependencies..."
  cd /workspace && deno cache --reload src/main.ts 2>/dev/null || true
fi

# Verify Git configuration
echo "Verifying Git configuration..."
echo "Current Git user.name: $(git config --global user.name || echo 'Not Set')"
echo "Current Git user.email: $(git config --global user.email || echo 'Not Set')"

# Add SuperClaude Framework
echo "Add SuperClaude Framework..."
uv tool install superclaude
uvx superclaude install
uvx superclaude mcp --servers context7 --servers sequential-thinking --servers playwright --servers serena

echo "Post-creation setup script finished."
