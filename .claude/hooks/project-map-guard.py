#!/usr/bin/env python3
"""PreToolUse guard for the project-map agent.

Allows writes only to <project>/.project-map/, the project's .gitignore,
and the agent's own memory folder. Allows only read-only shell commands.
Exit code 2 blocks the tool call and shows the reason to the agent.
"""
import json, os, re, sys

data = json.load(sys.stdin)
tool = data.get("tool_name", "")
inp = data.get("tool_input", {}) or {}
proj = os.path.realpath(os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or os.getcwd())
memory = os.path.realpath(os.path.expanduser("~/.claude/agent-memory/project-map"))

def block(msg):
    print("project-map guard: " + msg, file=sys.stderr)
    sys.exit(2)

def inside(path, root):
    return path == root or path.startswith(root + os.sep)

if tool in ("Write", "Edit", "MultiEdit", "NotebookEdit"):
    raw = inp.get("file_path") or inp.get("notebook_path") or ""
    path = os.path.realpath(os.path.join(proj, os.path.expanduser(raw)))
    if inside(path, os.path.join(proj, ".project-map")) or path == os.path.join(proj, ".gitignore") or inside(path, memory):
        sys.exit(0)
    block(f"writes are allowed only in {proj}/.project-map/, {proj}/.gitignore and your memory folder. Blocked: {raw}")

if tool == "Bash":
    cmd = inp.get("command", "")
    if re.search(r"(^|[^0-9&])>{1,2}(?!&)|\btee\b|\bsed\s+-i\b", cmd):
        block("shell output redirection and in-place edits are not allowed. Use the Write tool inside .project-map/.")
    read_only = {"ls", "cat", "head", "tail", "wc", "find", "grep", "rg", "pwd", "date", "stat", "file", "tree", "sort", "uniq", "cut", "awk", "jq", "echo"}
    git_read = {"log", "diff", "show", "branch", "status", "rev-parse", "describe", "tag", "shortlog", "ls-files", "blame", "remote"}
    for seg in re.split(r"\|\||&&|;|\|", cmd):
        words = seg.strip().split()
        if not words:
            continue
        head = words[0]
        if head == "git" and len(words) > 1 and words[1] in git_read:
            continue
        if head == "gh" and len(words) > 2 and words[1] in ("issue", "pr") and words[2] in ("list", "view"):
            continue
        if head == "find" and any(w in ("-delete", "-exec", "-execdir") for w in words):
            block("find with -delete or -exec is not allowed.")
        if head in read_only:
            continue
        block(f"only read-only commands are allowed. Blocked: {seg.strip()}")
    sys.exit(0)

sys.exit(0)
