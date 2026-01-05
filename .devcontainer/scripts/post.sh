#!/bin/bash
set -e

echo "Running post-creation setup script..."

# Configure Poetry to create virtual environments inside the project folder
# echo "Configuring Poetry to use local .venv..."
# poetry config installer.parallel false
# poetry config virtualenvs.in-project true --local

# Install all dependencies
cd /workspace/frontend && yarn install

# Install Playwright browsers (Chromium only for devcontainer/WSL2 compatibility)
echo "Installing Playwright browsers..."
cd /workspace/frontend && yarn playwright install chromium
cd /workspace
# echo "Installing dependencies..."
# uv lock
# uv sync --frozen --no-cache
# poetry lock
# poetry install --no-root --no-interaction

# Include host's .gitconfig.local for user name/email
# echo "Configuring Git to include host's .gitconfig.local..."
# git config --global --add include.path /home/vscode/.gitconfig.local

echo "Verifying Git configuration..."
echo "Current Git user.name: $(git config --global user.name || echo 'Not Set')"
echo "Current Git user.email: $(git config --global user.email || echo 'Not Set')"

# echo "Add MCP Servers..."
# claude mcp add context7 -- npx -y @upstash/context7-mcp
# claude mcp add serena -- uvx --from git+https://github.com/oraios/serena serena-mcp-server --context ide-assistant --project $(pwd)
# claude mcp add sequential-thinking -s user -- npx -y @modelcontextprotocol/server-sequential-thinking
# Added stdio MCP server sequential-thinking with command: npx -y @modelcontextprotocol/server-sequential-thinking to user config

# add deno
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

echo "Add SuperClaude Framework..."
uv tool install superclaude
uvx superclaude install
uvx superclaude mcp --servers context7 --servers sequential-thinking --servers playwright --servers serena

echo "Post-creation setup script finished."
