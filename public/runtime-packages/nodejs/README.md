# Node.js Runtime Placeholder

Replace `nodejs-runtime.tar` with the offline bundle that contains the Node.js runtime,
including npm and any supporting scripts required to configure the environment inside WebVM.

Suggested contents for the final bundle:

- Node.js Debian packages (v18 or v20 LTS)
- npm cache with common tooling
- Post-install script to verify `node` and `npm` availability
