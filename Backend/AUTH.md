# Backend account signing

The optional MySQL backend no longer signs login tokens with a public default secret. Configure `JWT_SECRET` in `Backend/.env` with a long random value of at least 32 bytes for persistent login sessions. Do not commit that file or print an existing secret in diagnostics.

If `JWT_SECRET` is absent, the backend uses a fresh random secret for this process. It can still run locally, but sessions expire when the backend restarts. Explicitly configured secrets shorter than 32 bytes are rejected at startup.

The static GitHub Pages site and Windows wrapper do not require this backend to browse or play movies. The separate Hub service uses its own session mechanism.
