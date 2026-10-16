#!/usr/bin/env python3
"""Build the minimal ARM PATCH body that guarantees the durable media volume.

Payload uploads to its `staticDir` (`public/storage` = /app/public/storage in
the container). If the Container App declares the Azure Files volume but the
*container* has no matching `volumeMounts` entry, uploads land on the
container's ephemeral disk and are wiped by every new revision -- which is
exactly what happened on 2026-10-16 (an uploaded event image 500'd after the
next deploy).

Reads a Container App resource (`az containerapp show -o json`) on stdin.

  exit 0  -> PATCH body written to stdout
  exit 10 -> already correct, nothing to do (stdout empty)

Only `properties.template` is emitted. `configuration` is deliberately left
out, so `configuration.secrets` can never be written back with the redacted
values that `az` returns.
"""

import json
import sys

MOUNT_PATH = "/app/public/storage"
VOLUME_NAME = "media"
STORAGE_NAME = "mediastore"
MOUNT_OPTIONS = "uid=1001,gid=1001,dir_mode=0755,file_mode=0644"


def main() -> int:
    app = json.load(sys.stdin)
    template = app["properties"]["template"]
    container = template["containers"][0]

    mounts = list(container.get("volumeMounts") or [])
    volumes = list(template.get("volumes") or [])

    mounted = any(
        m.get("volumeName") == VOLUME_NAME and m.get("mountPath") == MOUNT_PATH
        for m in mounts
    )
    declared = any(v.get("name") == VOLUME_NAME for v in volumes)
    if mounted and declared:
        return 10

    # Replace any stale entry for this volume rather than duplicating it.
    mounts = [m for m in mounts if m.get("volumeName") != VOLUME_NAME]
    mounts.append({"volumeName": VOLUME_NAME, "mountPath": MOUNT_PATH})
    volumes = [v for v in volumes if v.get("name") != VOLUME_NAME]
    volumes.append(
        {
            "name": VOLUME_NAME,
            "storageType": "AzureFile",
            "storageName": STORAGE_NAME,
            "mountOptions": MOUNT_OPTIONS,
        }
    )

    container["volumeMounts"] = mounts
    template["volumes"] = volumes

    json.dump(
        {
            "properties": {
                "template": {
                    "containers": template["containers"],
                    "volumes": template["volumes"],
                }
            }
        },
        sys.stdout,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
