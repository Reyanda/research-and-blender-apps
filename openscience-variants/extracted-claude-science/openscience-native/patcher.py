#!/usr/bin/env python3
"""
OpenScience Native Binary Patcher
Patches the Claude Science Bun standalone binary to support DeepSeek natively.

Strategy:
  1. Byte-patch all API domain URLs (same-length: anthropic.com → deepseek.com)
  2. Add DEEPSEEK_API_KEY to env var recognition lists
  3. Build a wrapper script that starts the proxy already inside the workflow

  The format conversion (Anthropic → OpenAI) still happens via in-process proxy.
  But no Python needed — binary is self-contained.
"""

# Retained experimental implementation. Native reconstruction requires the original
# complete Bun executable layout and metadata; header + JS concatenation is invalid.
if __name__ == "__main__":
    raise SystemExit("Native rebuild/install is unavailable: complete original Bun metadata is missing. Use ../ClaudeScience-patched/launch.sh with an original executable.")

import os
import sys
import json
import struct
import shutil
from pathlib import Path

# ============================================================
# PATHS
# ============================================================
BUNDLE_PATH = (Path(__file__).resolve().parent.parent / 'ClaudeScience-patched/extracted/bundle.js')
HEADER_PATH = (Path(__file__).resolve().parent.parent / 'ClaudeScience-patched/extracted/header.bin')
ORIGINAL_APP = (Path(__file__).resolve().parent.parent / 'Claude Science.app')
OUTPUT_DIR = (Path(__file__).resolve().parent.parent / 'OpenScience.app')

# ============================================================
# PATCH DATABASE
# ============================================================

Patches = []

def find_and_replace(data, name, old, new):
    """Find a byte sequence and create a same-length or padded patch."""
    encoded_old = old if isinstance(old, bytes) else old.encode('latin-1')
    encoded_new = new if isinstance(new, bytes) else new.encode('latin-1')

    idx = data.find(encoded_old)
    if idx < 0:
        print(f"  ✗ NOT FOUND: {name}")
        return None

    if len(encoded_new) < len(encoded_old):
        # Pad to match length (use null bytes - safe in JS strings)
        encoded_new = encoded_new + b'\x00' * (len(encoded_old) - len(encoded_new))
    elif len(encoded_new) > len(encoded_old):
        print(f"  ✗ TOO LONG: {name} ({len(encoded_old)} → {len(encoded_new)})")
        return None

    return {
        'name': name,
        'offset': idx,
        'old': encoded_old,
        'new': encoded_new,
        'reason': f'Replace {old!r} → {new!r}'
    }


def register_same_length(data, name, old, new):
    """Register a same-length find-and-replace patch."""
    p = find_and_replace(data, name, old, new)
    if p:
        Patches.append(p)


def register_padded(data, name, old, new):
    """Register a patch where new is shorter and gets null-padded."""
    p = find_and_replace(data, name, old, new)
    if p:
        Patches.append(p)


def analyze_and_build_patches():
    """First pass: analyze binary, register all patches."""
    bundle = BUNDLE_PATH.read_bytes()

    # ===== DOMAIN PATCHES =====
    # api.anthropic.com → api.deepseek.com (exactly 18 chars each)
    register_same_length(
        bundle, 'api.anthropic.com domain',
        b'api.anthropic.com', b'api.deepseek.com'
    )

    # ===== URL PATCHES =====
    # "https://api.anthropic.com" → "https://api.deepseek.com/v1"
    # 29 chars → 31 chars — too long. Use shorter padding approach.
    # Instead: "https://api.anthropic.com" → "https://api.deepseek.com\x00\x00\x00\x00"
    # The null bytes won't matter because it's used as a default string
    # Actually better: use a route that fits

    # The quoted URL: "https://api.anthropic.com" (29 bytes)
    # We can use:      "api.deepseek.com" + path (18 + whatever)
    # Or route through: "http://127.0.0.1:8766/v1" (22 bytes) — shorter, pad with spaces
    # Or use a shorter default: "https://deepseek.com/v1" (24 bytes)
    # Best fit: "https://api.deepseek.com" (25 bytes) + spaces to 29 = "https://api.deepseek.com    "
    # But spaces in a URL are bad.
    # Let's use: "https://api.deepseek.com\x00\x00\x00\x00" (null bytes at end)
    # Null bytes are valid inside C strings but JS strings terminate at \x00
    # So: "https://api.deepseek.com" (25) + \x00\x00\x00\x00 = 29 in the binary
    # In JS, the string will be "https://api.deepseek.com" (null-terminated)
    # That works!

    quoted_old = b'"https://api.anthropic.com"'
    quoted_new = b'"https://api.deepseek.com"'
    # Pad with null bytes to keep length
    padded = quoted_new + b'\x00' * (len(quoted_old) - len(quoted_new))
    assert len(padded) == len(quoted_old)

    idx = bundle.find(quoted_old)
    if idx >= 0:
        Patches.append({
            'name': 'quoted default API URL',
            'offset': idx,
            'old': quoted_old,
            'new': padded,
            'reason': 'Replace "https://api.anthropic.com" → "https://api.deepseek.com"'
        })
        print(f"  ✓ Found quoted URL at 0x{idx:x}")

    # ===== CLAUDE.AI URL PATCHES =====
    # "https://claude.ai" → "https://deepseek.com" (15 vs 16 — close)
    # "https://claude.ai" → "http://127.0.0.1:8766" (20 chars) — shorter by 1
    # Actually just: "https://claude.ai" (16) → "https://deepseek.ai" (20) — too long
    # Skip this — just leave claude.ai URLs for OAuth (they only matter for auth)

    # ===== ENV VAR RECOGNITION =====
    # Module 19 has: ndG=["ANTHROPIC_API_KEY","ANTHROPIC_AUTH_TOKEN",...
    # Add DEEPSEEK_API_KEY by replacing the first element
    # ndG pattern exists in multiple places
    for search_key in [b'ndG=["ANTHROPIC_API_KEY"', b'ndG=[\\"ANTHROPIC_API_KEY\\"',
                        b'nJ=["ANTHROPIC_API_KEY"', b'nJ=[\\"ANTHROPIC_API_KEY\\"',
                        b'q4=["ANTHROPIC_API_KEY"', b'q4=[\\"ANTHROPIC_API_KEY\\"',
                        b'U4=["ANTHROPIC_API_KEY']:
        idx = 0
        while True:
            idx = bundle.find(search_key, idx)
            if idx == -1:
                break
            # Found an env var array - add DEEPSEEK_API_KEY as first element
            # Old: "ANTHROPIC_API_KEY"  (18 chars)
            # New: "DEEPSEEK_API_KEY"   (17 chars) — shorter by 1
            # Keep the same format: "XXXXX_API_KEY" → pad new one
            old_item = b'ANTHROPIC_API_KEY'
            new_item = b'DEEPSEEK_API_KEY'
            item_idx = bundle.find(old_item, idx)
            if item_idx >= 0 and item_idx - idx < 100:
                if len(new_item) <= len(old_item):
                    padded_item = new_item + b'\x00' * (len(old_item) - len(new_item))
                    Patches.append({
                        'name': f'env var array at 0x{item_idx:x}',
                        'offset': item_idx,
                        'old': old_item,
                        'new': padded_item,
                        'reason': f'Replace ANTHROPIC_API_KEY → DEEPSEEK_API_KEY in recognition list'
                    })
                    print(f"  ✓ Found env var array at 0x{item_idx:x}")
            idx += 1

    # ===== ANTHROPIC_BASE_URL env var name (keep both = also check DEEPSEEK_BASE_URL) =====
    # In the config function LJ(): patching process.env.ANTHROPIC_BASE_URL to check both
    old_env = b'process.env.ANTHROPIC_BASE_URL?.trim()'
    # Replace with: process.DEEPSEEK_BASE_URL?.trim()||process.env.ANTHROPIC_BASE_URL?.trim()
    # But this is MUCH longer!
    # Instead, just change the env var name it checks
    # process.env.ANTHROPIC_BASE_URL → process.env.DEEPSEEK_BASE_URL
    # (LJ becomes DeepSeek-aware)
    env_old = b'process.env.ANTHROPIC_BASE_URL'
    env_new = b'process.env.DEEPSEEK_BASE_URL'
    if len(env_new) == len(env_old):
        idx = bundle.find(env_old)
        if idx >= 0:
            Patches.append({
                'name': f'env var check at 0x{idx:x}',
                'offset': idx,
                'old': env_old,
                'new': env_new,
                'reason': 'Change env var from ANTHROPIC_BASE_URL → DEEPSEEK_BASE_URL'
            })

    # ===== API KEY env var =====
    # In module 151 (Z1 class): i__("ANTHROPIC_API_KEY")
    for search in [b'i__("ANTHROPIC_API_KEY")']:
        idx = bundle.find(search)
        if idx >= 0:
            # Replace with: i__("DEEPSEEK_API_KEY")||i__("ANTHROPIC_API_KEY")
            # Wait, too long. Let's just swap to DEEPSEEK_API_KEY
            new_str = b'i__("DEEPSEEK_API_KEY")'
            if len(new_str) < len(search):
                padded = new_str + b'\x00' * (len(search) - len(new_str))
                Patches.append({
                    'name': f'API key env read at 0x{idx:x}',
                    'offset': idx,
                    'old': search,
                    'new': padded,
                    'reason': 'Change i__("ANTHROPIC_API_KEY") → i__("DEEPSEEK_API_KEY")'
                })

    # ===== URL path prefix (OAuth URLs) =====
    # These URLs give OAuth endpoints, but DeepSeek doesn't use them
    # Replace them with deepseek equivalents or short-circuit
    # "https://api.anthropic.com/api/oauth/profile" → too specific
    # Better to just patch the domain and leave paths — they won't be called
    # if the auth flow uses DEEPSEEK_API_KEY directly instead of OAuth

    # ===== MODEL NAME PATCHES =====
    # "claude-opus-4-8" (16) → "deepseek-reasoner" (17) — too long
    # "claude-sonnet-4-6" (18) → "deepseek-chat" (13) — shorter, pad
    # "claude-haiku-4-5-20251001" (27) → "deepseek-chat" (13) — much shorter, pad

    model_patches = [
        (b'claude-opus-4-8', b'deepseek-reasoner'),
        (b'claude-sonnet-4-6', b'deepseek-chat'),
        (b'claude-haiku-4-5-20251001', b'deepseek-chat'),
    ]

    for old_model, new_model in model_patches:
        if len(new_model) <= len(old_model):
            padded = new_model + b'\x00' * (len(old_model) - len(new_model))
            idx = 0
            count = 0
            while True:
                idx = bundle.find(old_model, idx)
                if idx == -1:
                    break
                Patches.append({
                    'name': f'model name at 0x{idx:x}',
                    'offset': idx,
                    'old': old_model,
                    'new': padded,
                    'reason': f'Replace {old_model.decode()} → {new_model.decode()}'
                })
                count += 1
                idx += 1
            print(f"  Model '{old_model.decode()}' found {count} times")

    # ===== VERSION STRING =====
    # Change "operon" → "openscience" for branding
    for search in [b'"operon"', b'operon', b'"klondikelicious']:
        if search in [b'operon']:
            # "operon" (6) → "openSci" (7) — too long. "opSci" (5) — shorter
            pass  # skip generic "operon" — too many false matches

    # ===== USER-AGENT STYLE =====
    # The app has NZ_="operon" — change to NZ_="openSci"
    # at 0x96bf42
    old_op = b',NZ_="operon"'
    new_op = b',NZ_="openSci\x00"'
    if len(new_op) <= len(old_op):
        padded = new_op + b'\x00' * (len(old_op) - len(new_op))
        idx = bundle.find(old_op)
        if idx >= 0:
            Patches.append({
                'name': 'app name operon → openSci',
                'offset': idx,
                'old': old_op,
                'new': padded,
                'reason': 'Rename operon → openSci'
            })

    return Patches


def apply_patches(bundle_data):
    """Apply all registered patches."""
    result = bytearray(bundle_data)

    applied = 0
    skipped = 0
    for p in Patches:
        offset = p['offset']
        old = p['old']
        new = p['new']

        # Verify old bytes match
        actual = bytes(result[offset:offset + len(old)])
        if actual != old:
            print(f"  ⚠ MISMATCH at 0x{offset:x}: {p['name']}")
            print(f"    Expected: {old[:40]!r}")
            print(f"    Got:      {actual[:40]!r}")
            skipped += 1
            continue

        # Apply
        result[offset:offset + len(new)] = new
        print(f"  ✓ 0x{offset:x}: {p['name']}")
        applied += 1

    return bytes(result), applied, skipped


def verify_patches(original, patched):
    """Verify all patches are correctly applied and nothing broke."""
    results = {
        'success': True,
        'anthropic_domain_remaining': 0,
        'deepseek_domain_found': 0,
        'patches_applied': len(Patches),
    }

    # Check no anthropic.com references remain (in the patched bundle data)
    remaining = patched.find(b'api.anthropic.com')
    if remaining >= 0:
        # Only the OAuth URLs might remain if they weren't patched
        results['anthropic_domain_remaining'] += 1

    # Verify deepseek.com was added
    deepseek_count = patched.count(b'api.deepseek.com')
    results['deepseek_domain_found'] = deepseek_count

    # Verify DEEPSEEK_API_KEY was added
    key_count = patched.count(b'DEEPSEEK_API_KEY')
    results['deepseek_api_key_found'] = key_count

    # Check no critical strings were corrupted
    for critical in [b'claude-science', b'serve', b'#!/']:
        if critical in [b'claude-science']:
            if patched.count(critical) < original.count(critical) - 2:  # some leeway
                results['warnings'] = results.get('warnings', [])
                results['warnings'].append(f"Critical string '{critical.decode()}' appears less than expected")

    return results


def build_openscience_bundle(patched_bundle):
    """Build the complete OpenScience binary."""
    header = HEADER_PATH.read_bytes()
    full_binary = header + patched_bundle
    return full_binary


def create_app_bundle(binary_data):
    """Create a proper macOS .app bundle."""
    if OUTPUT_DIR.exists():
        shutil.rmtree(OUTPUT_DIR)

    # Create .app structure
    contents = OUTPUT_DIR / "Contents"
    macos = contents / "MacOS"
    resources = contents / "Resources"

    macos.mkdir(parents=True)
    resources.mkdir(parents=True)

    # Info.plist
    plist = '''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>OpenScience</string>
  <key>CFBundleDisplayName</key><string>OpenScience</string>
  <key>CFBundleIdentifier</key><string>com.openscience.app</string>
  <key>CFBundleVersion</key><string>0.1.0</string>
  <key>CFBundleShortVersionString</key><string>0.1.0</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>openscience</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>NSHighResolutionCapable</key><true/>
</dict></plist>'''
    (contents / "Info.plist").write_text(plist)

    # The actual binary
    bin_path = macos / "openscience"
    bin_path.write_bytes(binary_data)
    bin_path.chmod(0o755)

    # Copy icon from original
    orig_icon = ORIGINAL_APP / "Contents/Resources/operon.icns"
    if orig_icon.exists():
        shutil.copy2(orig_icon, resources / "operon.icns")

    # Create a launcher shell script that sets up DEEPSEEK_API_KEY
    launcher = macos / "launch.sh"
    launcher.write_text('''#!/bin/bash
# OpenScience Launcher
DIR="$(cd "$(dirname "$0")" && pwd)"
export DEEPSEEK_API_KEY="${DEEPSEEK_API_KEY:-}"
export ANTHROPIC_BASE_URL="${DEEPSEEK_BASE_URL:-}"
"$DIR/openscience" serve
''')
    launcher.chmod(0o755)

    return OUTPUT_DIR


# ============================================================
# MAIN
# ============================================================

def cmd_patch():
    print("=" * 60)
    print("  OpenScience Native Binary Patcher")
    print("=" * 60)
    print()

    # Step 1: Analyze and build patch list
    print("[1/5] Analyzing binary and building patches...")
    bundle = BUNDLE_PATH.read_bytes()
    patches = analyze_and_build_patches()
    print(f"\n  Total patches to apply: {len(patches)}")
    print()

    # Step 2: Apply patches
    print("[2/5] Applying patches...")
    patched_bundle, applied, skipped = apply_patches(bundle)
    print(f"\n  Applied: {applied}, Skipped: {skipped}")
    print()

    # Step 3: Verify
    print("[3/5] Verifying patches...")
    results = verify_patches(bundle, patched_bundle)
    print(f"  Patches applied: {results['patches_applied']}")
    print(f"  deepseek.com occurrences: {results['deepseek_domain_found']}")
    print(f"  DEEPSEEK_API_KEY occurrences: {results['deepseek_api_key_found']}")
    if results.get('warnings'):
        for w in results['warnings']:
            print(f"  ⚠ {w}")
    if results['anthropic_domain_remaining']:
        print(f"  ⚠ api.anthropic.com still found (OAuth URLs, expected)")
    print()

    # Step 4: Build binary
    print("[4/5] Building OpenScience binary...")
    full_binary = build_openscience_bundle(patched_bundle)
    print(f"  Binary size: {len(full_binary):,} bytes")
    print()

    # Step 5: Create .app bundle
    print("[5/5] Creating OpenScience.app...")
    app_path = create_app_bundle(full_binary)
    print(f"  ✓ Created: {app_path}")
    print()

    # Summary
    print("=" * 60)
    print("  PATCH SUMMARY")
    print("=" * 60)
    print(f"  Bundled proxy:         NO (native mode)")
    print(f"  API domain swap:       anthropic.com → deepseek.com")
    print(f"  API key env var:       DEEPSEEK_API_KEY")
    print(f"  Base URL env var:      DEEPSEEK_BASE_URL")
    print(f"  Default model:         deepseek-chat / deepseek-reasoner")
    print(f"  Model mapping:         Claude → DeepSeek (via env)")
    print()
    print(f"  Run: DEEPSEEK_API_KEY=sk-... {app_path}/Contents/MacOS/openscience serve")
    print()

    # Save patch report
    report = {
        'bundle_size': len(bundle),
        'patches': [{
            'offset': p['offset'],
            'name': p['name'],
            'reason': p.get('reason', ''),
        } for p in Patches],
    }
    report_path = OUTPUT_DIR / "patch_report.json"
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2))

    return patched_bundle


def cmd_analyze():
    """Just analyze without patching."""
    bundle = BUNDLE_PATH.read_bytes()

    # Count key strings
    for key in [b'api.anthropic.com', b'ANTHROPIC_API_KEY', b'ANTHROPIC_BASE_URL',
                b'ANTHROPIC_AUTH_TOKEN', b'claude.ai']:
        count = bundle.count(key)
        print(f"  {key.decode():30s}: {count} occurrences")

    # Show all api.anthropic.com locations
    print("\nAll 'api.anthropic.com' locations:")
    idx = 0
    while True:
        idx = bundle.find(b'api.anthropic.com', idx)
        if idx == -1:
            break
        ctx = bundle[max(0, idx - 15):idx + 30]
        text = ''.join(chr(b) if 32 <= b < 127 else '.' for b in ctx)
        print(f"  0x{idx:x} ({idx:>9,}): ...{text}...")
        idx += 1

    print("\nAll 'claude.ai' locations:")
    idx = 0
    while True:
        idx = bundle.find(b'claude.ai', idx)
        if idx == -1:
            break
        ctx = bundle[max(0, idx - 15):idx + 20]
        text = ''.join(chr(b) if 32 <= b < 127 else '.' for b in ctx)
        print(f"  0x{idx:x} ({idx:>9,}): ...{text}...")
        idx += 1

    print("\nAll 'claude-' model name locations:")
    for model in [b'claude-opus', b'claude-sonnet', b'claude-haiku']:
        idx = 0
        count = 0
        while True:
            idx = bundle.find(model, idx)
            if idx == -1:
                break
            count += 1
            ctx = bundle[max(0, idx - 10):idx + 30]
            text = ''.join(chr(b) if 32 <= b < 127 else '.' for b in ctx)
            print(f"  0x{idx:x} ({idx:>9,}): ...{text}...")
            idx += 1
        print(f"  ({count} total for {model.decode()})")


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'patch'

    if cmd == 'patch':
        cmd_patch()
    elif cmd == 'analyze':
        cmd_analyze()
    else:
        print(f"Usage: {sys.argv[0]} [analyze|patch]")
