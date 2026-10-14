#!/usr/bin/env python3
"""OpenScience — DeepSeek-native research assistant."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))
from core.server import run

if __name__ == "__main__":
    run()
