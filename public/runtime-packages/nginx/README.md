# nginx Runtime Placeholder

This file marks the location where the offline nginx runtime bundle will live. Replace
`nginx-runtime.tar` with the generated archive that contains pre-installed nginx binaries
and dependencies for the WebVM environment.

Suggested contents for the final bundle:

- Debian packages required for nginx
- Pre-baked configuration templates (e.g., `/etc/nginx/sites-enabled/default`)
- Post-install scripts to enable and start the nginx service inside WebVM
