# Runtime Packages

This directory hosts offline runtime bundles for the Application Server feature. During development we
ship lightweight placeholder archives so the manifest resolves locally. Replace the placeholder `.tar`
files with the real offline bundles produced by the packaging pipeline when they are ready.

## Structure

```
public/runtime-packages/
├── index.json                # Runtime manifest consumed by the UI/runtime repository
├── nginx/
│   ├── nginx-runtime.tar     # Placeholder artifact (replace with real bundle)
│   └── README.md             # Runtime-specific notes
└── nodejs/
    ├── nodejs-runtime.tar    # Placeholder artifact (replace with real bundle)
    └── README.md             # Runtime-specific notes
```

Each runtime folder may include additional assets (checksums, metadata) as needed by the offline
installer. Update `index.json` to reference the correct artifact paths and metadata when bundling the
real packages.
