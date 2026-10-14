#!/usr/bin/env python3
"""
OpenScience — Installer/Uninstaller
=====================================
Separate installation from Claude Science. Uses its own data directory.

Supports:
  - install:    Copy binary to ~/.openscience, create CLI alias, install .app
  - uninstall:  Remove all OpenScience files and aliases
  - status:     Check if installed, compare versions

CLI: adds `openscience` command to shell via alias in ~/.zshrc
Data: stores config/logs in ~/.openscience/
      (still uses .claude-science paths in binary for now — will be patched)
App:  OpenScience.app in ~/Applications/
"""

# Retained experimental implementation. Native reconstruction requires the original
# complete Bun executable layout and metadata; header + JS concatenation is invalid.
if __name__ == "__main__":
    raise SystemExit("Native rebuild/install is unavailable: complete original Bun metadata is missing. Use ../ClaudeScience-patched/launch.sh with an original executable.")

import os, sys, json, shutil, stat, subprocess, platform, hashlib
from pathlib import Path

# ============================================================
# CONFIGURATION
# ============================================================

HOME = Path.home()
INSTALL_DIR = HOME / ".openscience"
BIN_DIR = INSTALL_DIR / "bin"
DATA_DIR = INSTALL_DIR / "data"
CONFIG_DIR = INSTALL_DIR / "config"
LOGS_DIR = INSTALL_DIR / "logs"
APPS_DIR = HOME / "Applications"

# Where we build the binary from
BUILD_DIR = (Path(__file__).resolve().parent.parent / 'openscience-native')
BUILD_BINARY = BUILD_DIR / "OpenScience.app" / "Contents" / "MacOS" / "openscience"
BUILD_APP = BUILD_DIR / "OpenScience.app"

# ============================================================
# VERSION
# ============================================================

VERSION = "0.1.0-dev"
INSTALL_MANIFEST = INSTALL_DIR / ".install-manifest.json"


def binary_version():
    """Extract version from the binary build."""
    if BUILD_BINARY.exists():
        size = BUILD_BINARY.stat().st_size
        mtime = datetime.fromtimestamp(BUILD_BINARY.stat().st_mtime).isoformat()
        sha = hashlib.sha256(BUILD_BINARY.read_bytes()).hexdigest()[:12]
        return f"{VERSION}-{sha}"
    return VERSION


# ============================================================
# INSTALL
# ============================================================

def install(force=False):
    print("=" * 56)
    print("  OpenScience Installer")
    print("=" * 56)
    print()

    # Check build exists
    if not BUILD_BINARY.exists():
        print(f"  ERROR: Build binary not found at {BUILD_BINARY}")
        print("  Run: python3 final_build.py first")
        sys.exit(1)

    if not BUILD_APP.exists():
        print(f"  WARNING: OpenScience.app not found at {BUILD_APP}")
        print("  Will install binary only (no .app bundle)")

    # Check for existing installation
    if INSTALL_DIR.exists() and not force:
        print(f"  WARNING: OpenScience already installed at {INSTALL_DIR}")
        print("  Use --force to overwrite")
        return

    # Create directory structure
    print("[1/5] Creating directory structure...")
    for d in [INSTALL_DIR, BIN_DIR, DATA_DIR, CONFIG_DIR, LOGS_DIR]:
        d.mkdir(parents=True, exist_ok=True)
        print(f"  Created: {d}")

    # Copy binary from original unmodified Claude Science binary
    print(f"\n[2/5] Installing binary (from original)...")
    orig_bin = HOME / ".claude-science" / "bin" / "claude-science"
    if not orig_bin.exists():
        print(f"  ERROR: Original binary at {orig_bin} not found. Install Claude Science first.")
        sys.exit(1)

    # Copy original binary unchanged as _openscience
    bin_real = BIN_DIR / "_openscience"
    shutil.copy2(orig_bin, bin_real)
    bin_real.chmod(0o755)

    # Create wrapper script that sets DeepSeek env vars then exec's the real binary
    wrapper = BIN_DIR / "openscience"
    wrapper_lines = [
        '#!/bin/bash',
        '# OpenScience - routes through DeepSeek Anthropic proxy',
        'DIR="$(cd "$(dirname "$0")" && pwd)"',
        'OS_DIR="$(dirname "$DIR")"',
        'BINARY="$DIR/_openscience"',
        'CONFIG_FILE="$OS_DIR/config/config.toml"',
        '',
        '# Resolve API key',
        'API_KEY="${DEEPSEEK_API_KEY:-}"',
        'if [ -z "$API_KEY" ] && [ -f "$CONFIG_FILE" ]; then',
        '  while IFS="=" read -r key val; do',
        '    if [ "$key" = "api_key" ]; then',
        '      val="${val#"${val%%[![:space:]]*}"}"',
        '      val="${val%"${val##*[![:space:]]}"}"',
        '      val="${val%\\"}"',
        '      val="${val#\\"}"',
        '      API_KEY="$val"',
        '    fi',
        '  done < "$CONFIG_FILE"',
        'fi',
        '',
        'if [ -z "$API_KEY" ]; then',
        '  echo "No DeepSeek API key found."',
        '  echo "Set DEEPSEEK_API_KEY env var or add api_key = ... to $CONFIG_FILE"',
        '  exit 1',
        'fi',
        '',
        'export ANTHROPIC_BASE_URL="${DEEPSEEK_BASE_URL:-https://api.deepseek.com/anthropic}"',
        'export ANTHROPIC_API_KEY="$API_KEY"',
        'export ANTHROPIC_AUTH_TOKEN="$API_KEY"',
        'export DEEPSEEK_API_KEY="$API_KEY"',
        '',
        'exec "$BINARY" "$@"',
        '',
    ]
    wrapper.write_text('\n'.join(wrapper_lines))
    wrapper.chmod(0o755)

    # Also write the raw binary path for direct usage
    raw_link = BIN_DIR / "openscience-raw"
    if raw_link.exists():
        raw_link.unlink()
    raw_link.symlink_to(bin_real)

    print(f"  Binary: {BIN_DIR}/openscience (wrapper -> _openscience)")
    print(f"  Wrapper: {wrapper}")

    # Install .app bundle
    print(f"\n[3/5] Installing app bundle...")
    if BUILD_APP.exists():
        app_target = APPS_DIR / "OpenScience.app"
        if app_target.exists():
            shutil.rmtree(app_target)
        shutil.copytree(BUILD_APP, app_target)
        print(f"  Installed: {app_target}")
    else:
        print(f"  Skipped (no .app bundle)")

    # Create shell alias
    print(f"\n[4/5] Creating shell alias...")
    alias_line = f'\n# OpenScience alias\nalias openscience="{BIN_DIR}/openscience"\n'
    zshrc = HOME / ".zshrc"

    if zshrc.exists():
        existing = zshrc.read_text()
        if '# OpenScience alias' in existing:
            print("  Shell alias already configured")
        else:
            zshrc.write_text(existing + alias_line)
            print(f"  Added 'openscience' alias to {zshrc}")
    else:
        zshrc.write_text(alias_line)
        print(f"  Created {zshrc} with 'openscience' alias")

    # Create launcher script
    launcher = INSTALL_DIR / "start.sh"
    openscience_bin = BIN_DIR / "openscience"

    lines = []
    lines.append('#!/bin/bash')
    lines.append('# OpenScience Launcher')
    lines.append('DIR="$(cd "$(dirname "$0")" && pwd)"')
    lines.append('echo "============================================="')
    lines.append('echo "  OpenScience v' + VERSION + '"')
    lines.append('echo "============================================="')
    lines.append('')
    lines.append('CONFIG_DIR="' + str(CONFIG_DIR) + '"')
    lines.append('CONFIG_FILE="${CONFIG_DIR}/config.toml"')
    lines.append('if [ -z "${DEEPSEEK_API_KEY:-}" ] && [ -f "$CONFIG_FILE" ]; then')
    lines.append('  while IFS="=" read -r key val; do')
    lines.append('    if [ "$key" = "api_key" ]; then')
    lines.append('      val="${val#"${val%%[![:space:]]*}"}"')
    lines.append('      val="${val%"${val##*[![:space:]]}"}"')
    lines.append('      val="${val%\\"}"')
    lines.append('      val="${val#\\"}"')
    lines.append('      export DEEPSEEK_API_KEY="$val"')
    lines.append('    fi')
    lines.append('  done < "$CONFIG_FILE"')
    lines.append('fi')
    lines.append('')
    lines.append('if [ -z "${DEEPSEEK_API_KEY:-}" ]; then')
    lines.append('  echo "  No DeepSeek API key found."')
    lines.append('  read -p "  Enter API key (sk-...): " key')
    lines.append('  if [ -n "$key" ]; then')
    lines.append('    export DEEPSEEK_API_KEY="$key"')
    lines.append('    mkdir -p "$CONFIG_DIR"')
    lines.append('    echo "api_key = \\"$key\\"" >> "$CONFIG_FILE"')
    lines.append('    echo "  Saved key to $CONFIG_FILE"')
    lines.append('  fi')
    lines.append('fi')
    lines.append('')
    lines.append('BIN="' + str(openscience_bin) + '"')
    lines.append('"$BIN" serve &')
    lines.append('PID=$!')
    lines.append('sleep 3')
    lines.append('$("$BIN" url 2>/dev/null | head -1)')
    lines.append('trap "kill $PID 2>/dev/null; exit 0" INT TERM')
    lines.append('wait')
    lines.append('')

    launcher.write_text('\n'.join(lines))
    launcher.chmod(0o755)
    print(f"  Launcher: {launcher}")

    # Create config
    config = CONFIG_DIR / "config.toml"
    if not config.exists() or force:
        config.write_text(f'''# OpenScience Configuration
# API key (set this or use DEEPSEEK_API_KEY env var)
# api_key = "sk-..."

[paths]
data_dir = "{DATA_DIR}"
workspace_base = "{INSTALL_DIR}/workspace"

[llm]
provider = "deepseek"
model = "deepseek-chat"
''')
        print(f"  Config: {config}")
        print(f"  ! Edit {config} to add your DeepSeek API key under 'api_key'")

    # Symlink data to .claude-science for shared projects
    claude_science_dir = HOME / ".claude-science"
    if claude_science_dir.exists() and not DATA_DIR.exists():
        try:
            DATA_DIR.symlink_to(claude_science_dir, target_is_directory=True)
            print(f"  Symlink: {DATA_DIR} → {claude_science_dir}")
        except:
            DATA_DIR.mkdir(exist_ok=True)
            print(f"  Data: {DATA_DIR}")
    else:
        DATA_DIR.mkdir(exist_ok=True)
        print(f"  Data: {DATA_DIR}")

    # Write install manifest
    print(f"\n[5/5] Writing install manifest...")
    print(f"\n[5/5] Writing install manifest...")
    manifest = {
        "version": VERSION,
        "binary": str(bin_real),
        "binary_size": bin_real.stat().st_size,
        "app": str(app_target) if BUILD_APP.exists() else None,
        "install_dir": str(INSTALL_DIR),
        "data_dir": str(DATA_DIR),
        "installed_at": __import__('datetime').datetime.now().isoformat(),
    }
    INSTALL_MANIFEST.write_text(json.dumps(manifest, indent=2))
    print(f"  Manifest: {INSTALL_MANIFEST}")

    # Summary
    print(f"\n{'=' * 56}")
    print(f"  Installation Complete")
    print(f"{'=' * 56}")
    print(f"  Binary:       {BIN_DIR}/openscience")
    print(f"  App:          ~/Applications/OpenScience.app")
    print(f"  Data:         {DATA_DIR}")
    print(f"  Config:       {CONFIG_DIR}")
    print(f"  Logs:         {LOGS_DIR}")
    print(f"  CLI alias:    openscience")
    print()
    print(f"  To run: DEEPSEEK_API_KEY=sk-... openscience serve")
    print(f"  Or:     {launcher}")
    print(f"  Or:     open ~/Applications/OpenScience.app")
    print()
    print(f"  To uninstall: python3 {__file__} uninstall")


def uninstall():
    """Remove all OpenScience files and aliases."""
    print("=" * 56)
    print("  OpenScience Uninstaller")
    print("=" * 56)
    print()

    confirm = input("  Remove all OpenScience files? [y/N]: ").strip().lower()
    if confirm != 'y':
        print("  Cancelled.")
        return

    removed = []

    # Remove installed binary
    bin_target = BIN_DIR / "openscience"
    if bin_target.exists():
        bin_target.unlink()
        removed.append(str(bin_target))
        print(f"  Removed: {bin_target}")

    # Remove OpenScience directory
    if INSTALL_DIR.exists():
        shutil.rmtree(INSTALL_DIR)
        removed.append(str(INSTALL_DIR))
        print(f"  Removed: {INSTALL_DIR}")

    # Remove .app bundle
    app_target = APPS_DIR / "OpenScience.app"
    if app_target.exists():
        shutil.rmtree(app_target)
        removed.append(str(app_target))
        print(f"  Removed: {app_target}")

    # Remove shell alias
    zshrc = HOME / ".zshrc"
    if zshrc.exists():
        content = zshrc.read_text()
        lines = content.split('\n')
        new_lines = []
        skip = False
        for line in lines:
            if '# OpenScience alias' in line:
                skip = True
                continue
            if skip and 'alias openscience=' in line:
                skip = False
                continue
            if skip:
                skip = False
                continue
            new_lines.append(line)
        zshrc.write_text('\n'.join(new_lines))
        print(f"  Removed shell alias from {zshrc}")

    if removed:
        print(f"\n  Uninstalled {len(removed)} items.")
    else:
        print("  Nothing to uninstall.")


def status():
    """Check installation status."""
    print("=" * 56)
    print("  OpenScience Status")
    print("=" * 56)
    print()

    # Check if installed
    installed = INSTALL_DIR.exists() and (BIN_DIR / "openscience").exists()

    if not installed:
        print("  Status: NOT INSTALLED")
        print()
        print("  To install: python3 install.py install")
        return

    # Read manifest
    manifest = {}
    if INSTALL_MANIFEST.exists():
        manifest = json.loads(INSTALL_MANIFEST.read_text())

    # Check binary
    bin_path = BIN_DIR / "openscience"
    bin_exists = bin_path.exists()
    bin_size = bin_path.stat().st_size if bin_exists else 0

    # Check app
    app_path = APPS_DIR / "OpenScience.app"
    app_exists = app_path.exists()

    # Check alias
    zshrc = HOME / ".zshrc"
    alias_ok = zshrc.exists() and '# OpenScience alias' in zshrc.read_text()

    # Check build for comparison
    build_exists = BUILD_BINARY.exists()
    build_size = BUILD_BINARY.stat().st_size if build_exists else 0

    print(f"  Status: INSTALLED")
    print(f"  Version: {manifest.get('version', '?')}")
    print(f"  Installed: {manifest.get('installed_at', '?')}")
    print()
    print(f"  Binary:")
    print(f"    Installed: {bin_path}")
    print(f"    Size: {bin_size:,} bytes")
    print(f"    Working: {'YES' if bin_exists else 'NO'}")
    print(f"    Build comparable: {'YES' if build_exists and build_size == bin_size else 'NO (different build)'}")
    print()
    print(f"  App Bundle: {'YES' if app_exists else 'NO'}")
    print(f"  CLI Alias: {'YES' if alias_ok else 'NO'}")
    print(f"  Data Directory: {DATA_DIR}")
    print(f"    Config files: {len(list(CONFIG_DIR.glob('*')))}")
    print(f"    Log files: {len(list(LOGS_DIR.glob('*')))}")
    print()

    # Suggestions
    suggestions = []
    if not app_exists:
        suggestions.append("Install app bundle: python3 install.py install")
    if not alias_ok:
        suggestions.append("Re-create alias: python3 install.py install")
    if build_size != bin_size:
        suggestions.append("Rebuild binary: python3 final_build.py && python3 install.py install")

    if suggestions:
        print("  Suggested actions:")
        for s in suggestions:
            print(f"    {s}")


if __name__ == '__main__':
    # Add datetime import for manifest timestamps
    from datetime import datetime

    cmd = sys.argv[1] if len(sys.argv) > 1 else 'status'
    force = '--force' in sys.argv

    if cmd == 'install':
        install(force=force)
    elif cmd == 'set-api-key':
        if len(sys.argv) >= 3:
            key = sys.argv[2]
        elif not sys.stdin.isatty():
            key = sys.stdin.read().strip()
        else:
            print("  Usage: python3 install.py set-api-key <your-key>")
            sys.exit(1)
        if key:
            config_path = CONFIG_DIR / "config.toml"
            config_path.parent.mkdir(parents=True, exist_ok=True)
            cfg = config_path.read_text() if config_path.exists() else ""
            import re
            if re.search(r'^api_key\s*=', cfg, re.MULTILINE):
                cfg = re.sub(r'^api_key\s*=.*$', f'api_key = "{key}"', cfg, flags=re.MULTILINE)
            else:
                cfg = cfg + f'\napi_key = "{key}"\n'
            config_path.write_text(cfg)
            print(f"  API key saved to {config_path}")
    elif cmd == 'uninstall':
        uninstall()
    elif cmd == 'status':
        status()
    else:
        print(f"Usage: {sys.argv[0]} [install|uninstall|set-api-key <key>|status] [--force]")
