Pull-request description files live here.

The delivery guard accepts `--body-file` only for a direct child of this
directory. Validating an arbitrary path was tried and abandoned: traversal, a
junction on an intermediate directory, a UNC path, a symlink and a hardlink
each defeated a different name-based check. Requiring one known parent closes
that class without resolving links, so it behaves the same on Windows
PowerShell and PowerShell Core.

File contents are ignored by git; this README and the directory are not.
