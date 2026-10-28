#!/usr/bin/env python3
"""
DDGS (DuckDuckGo Search) JSON CLI Bridge for Socialix Research Agent
"""
import sys
import json

def search(query, max_results=5):
    try:
        from ddgs import DDGS
        results = list(DDGS().text(query, max_results=max_results))
        return results
    except Exception as e:
        return [{"error": str(e)}]

if __name__ == "__main__":
    query = sys.argv[1] if len(sys.argv) > 1 else "trending anime reels"
    max_res = int(sys.argv[2]) if len(sys.argv) > 2 else 5
    res = search(query, max_res)
    print(json.dumps(res))
