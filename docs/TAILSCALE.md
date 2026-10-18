# Tailscale — reaching Warboard Box from another device

Read this as the exact procedure for this machine as it stands on 2026-10-18.

## State on this box right now

- Tailscale is **installed**: `C:\Program Files\Tailscale\tailscale.exe`.
- The service is **not running**: `tailscale status` answers
  *"failed to connect to localtailscaled process; is the Tailscale service running?"*
- So today there is no active tailnet connection on this machine. Starting the
  service is an administrator action (see step 1).

Tailscale is a private network, not a file sync tool. Warboard Box supports two
honest patterns; neither is required for normal local use.

---

## Pattern A — read the boards from another device (built in, recommended)

The app can expose a **read-only** view of its state on loopback. You then put
Tailscale in front of it with `tailscale serve`. Nothing is exposed to the public
internet, and the remote view cannot write, unlock, delete, or run anything.

### 1. Start Tailscale on the host (Warboard Box machine)

```powershell
# either open the Tailscale app from the Start menu, or from an elevated shell:
net start Tailscale

# sign in if it is not already authenticated:
& "C:\Program Files\Tailscale\tailscale.exe" up

# confirm:
& "C:\Program Files\Tailscale\tailscale.exe" status
& "C:\Program Files\Tailscale\tailscale.exe" ip -4
```

Note the hostname Tailscale gives this machine:

```powershell
& "C:\Program Files\Tailscale\tailscale.exe" status --json
# or simply read the name in the Tailscale app
```

### 2. Turn on the remote view inside Warboard Box

1. Open **Settings**.
2. Tick **TAILSCALE REMOTE VIEW** and press **APPLY**.
3. The status line should read `Listening on 127.0.0.1:8795`.
4. Confirm on the host: open <http://127.0.0.1:8795/> in a browser.

The server binds `127.0.0.1` only. It is not on your LAN by itself.

### 3. Put Tailscale in front of it

```powershell
# Serve the loopback port over your tailnet (Tailscale 1.40+):
& "C:\Program Files\Tailscale\tailscale.exe" serve --bg http://127.0.0.1:8795

# see what is being served:
& "C:\Program Files\Tailscale\tailscale.exe" serve status
```

Open the printed `https://<machine>.<tailnet>.ts.net/` URL from any device on
your tailnet. The page shows the box count, locked decks, shipped manifests, and
links to each deck's README.

### 4. Turn it off

```powershell
& "C:\Program Files\Tailscale\tailscale.exe" serve reset
```

Then untick the remote view in **Settings → APPLY**.

### Security rules for Pattern A

- Use **`serve`**, never `funnel`. `funnel` publishes to the public internet.
- The view is read-only by design. Do not add write endpoints to it.
- Tailnet ACLs still apply: only devices/users you allow can reach the hostname.
- The read-only page can show deck metadata and README/notes content. Treat the
  tailnet as trusted-but-private, same as you would a shared drive.

---

## Pattern B — sync the folders across devices (external, by choice)

Tailscale gives you the private network; it does not itself sync folders
(Taildrop sends files, it is not a two-way folder sync). If you want the same
`data\` folder on two machines, use a sync tool bound to the Tailscale addresses.

One supported shape:

1. Install a folder sync tool (e.g. Syncthing) on both devices.
2. Bind it to the Tailscale IPs (`tailscale ip -4`), not to `0.0.0.0`, so it is
   reachable only over the tailnet.
3. Share the Warboard Box data folder from one machine to the other.
4. On the second machine, point **Settings → DATA FOLDER** at the synced copy.

Rules:

- Do not run Warboard Box on both machines against the same live folder at the
  same time. The app is single-writer by design; two writers can race the box
  JSON. Sync one direction, or stop the app on the other machine.
- The app never phones home. It has no idea Tailscale exists; that is the point.
- This pattern is optional and not bundled. Nothing in the app requires it.

---

## Verifying the pieces

```powershell
# Tailscale up?
& "C:\Program Files\Tailscale\tailscale.exe" status

# remote view listening on the host?
Test-NetConnection 127.0.0.1 -Port 8795

# what Tailscale is serving:
& "C:\Program Files\Tailscale\tailscale.exe" serve status
```

If `tailscale serve` is unavailable, update Tailscale first — `serve` shipped in
1.40. Command names are stable but confirm with `tailscale serve --help` before
relying on a flag in a script.
