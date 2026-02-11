# systemd units for AgentTinder

This folder contains example systemd unit files used by the AgentTinder bootstrap.

Install the units on the EC2 host (run as sudo on the host):

```bash
# copy unit files to systemd and enable
sudo cp ops/systemd/tasks-worker.service /etc/systemd/system/tasks-worker.service
sudo cp ops/systemd/openclaw.service /etc/systemd/system/openclaw.service
sudo systemctl daemon-reload
sudo systemctl enable --now openclaw.service tasks-worker.service
```

Notes:
- The `tasks-worker.service` in the repo uses `/home/ubuntu/Agent-Tinder` as the canonical repo path.
- If your repo is at a different path, either update the ExecStart and WorkingDirectory fields or create a symlink so the paths resolve.
