# OpenCode Installation Fix on Antigravity DevContainer

## Problem

After installing OpenCode:

```bash
curl -fsSL https://opencode.ai/install | bash
```

Running:

```bash
opencode
```

Shows:

```text
EACCES: permission denied, mkdir '/home/node/.local/share/opencode'
```

---

## Root Cause

Check permissions:

```bash
ls -ld /home/node/.local
ls -ld /home/node/.local/share
```

Output:

```text
drwxr-xr-x root root ...
```

Current user:

```bash
whoami
```

Output:

```text
node
```

Meaning:

- user = node
- folder owner = root
- OpenCode cannot write → permission denied

---

# Step 1 — Verify OpenCode Installed

Check binary:

```bash
ls -la ~/.opencode/bin
```

Expected:

```text
opencode
```

---

# Step 2 — Fix PATH (Temporary)

Check PATH:

```bash
echo $PATH
```

If missing:

```text
/home/node/.opencode/bin
```

Add temporary:

```bash
export PATH="$HOME/.opencode/bin:$PATH"
```

Verify:

```bash
which opencode
```

Expected:

```text
/home/node/.opencode/bin/opencode
```

---

# Step 3 — Confirm Runtime Error

Run:

```bash
opencode
```

Error:

```text
EACCES: permission denied, mkdir '/home/node/.local/share/opencode'
```

---

# Step 4 — Test Workaround

Run using custom HOME:

```bash
mkdir -p /workspace/home
HOME=/workspace/home opencode
```

If successful:

- OpenCode works
- problem confirmed = permission issue

---

# Step 5 — Permanent Fix Wrapper

Rename original binary:

```bash
mv ~/.opencode/bin/opencode ~/.opencode/bin/opencode-real
```

Create wrapper:

```bash
nano ~/.opencode/bin/opencode
```

Paste:

```bash
#!/bin/zsh
HOME=/workspace/home /home/node/.opencode/bin/opencode-real "$@"
```

Save file.

Make executable:

```bash
chmod +x ~/.opencode/bin/opencode
```

---

# Step 6 — Test Final

Run normally:

```bash
opencode
```

Expected:

- OpenCode starts normally
- no permission error

---

# Optional PATH Permanent

Edit:

```bash
nano ~/.zshrc
```

Add:

```bash
export PATH="$HOME/.opencode/bin:$PATH"
```

Reload:

```bash
source ~/.zshrc
```

---

# If Reinstall Needed

Remove old install:

```bash
rm -rf ~/.opencode
```

Install again:

```bash
curl -fsSL https://opencode.ai/install | bash
```

If error:

```text
Failed to fetch version information
```

Check GitHub API:

```bash
curl -I https://api.github.com
```

If:

```text
403
x-ratelimit-remaining: 0
```

Then GitHub API rate limit is exhausted.

Wait ~1 hour and retry.

---

# Final Diagnosis

Issue is NOT OpenCode.

Issue is container permission bug.

Problem:

```text
/home/node/.local        → root root
/home/node/.local/share → root root
```

Should be:

```text
node node
```

Ideal Docker fix:

```dockerfile
RUN chown -R node:node /home/node/.local
```

---

# Final Status

```text
OpenCode installed       ✅
PATH configured          ✅
Runtime working          ✅
Container permission bug ❌
Workaround active        ✅
```
