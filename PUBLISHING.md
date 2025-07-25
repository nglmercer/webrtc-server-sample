# How to Publish to npm

This document describes how to publish a new version of `webrtc-socket-api` to npm.

## Prerequisites

1.  **npm Account**: You need to have an npm account. If you don't have one, you can create one [here](https://www.npmjs.com/signup).
2.  **Logged in to npm**: You need to be logged in to your npm account on your machine. You can do this by running `npm login`.

## Publishing Steps

1.  **Update `package.json`**:
    -   Increment the `version` number in `package.json` according to [Semantic Versioning](https://semver.org/).
        -   **Patch release** (e.g., `1.0.1`): Bug fixes.
        -   **Minor release** (e.g., `1.1.0`): New features that are backward-compatible.
        -   **Major release** (e.g., `2.0.0`): Changes that break backward-compatibility.

2.  **Update `CHANGELOG.md`**:
    -   Add a new entry in `CHANGELOG.md` for the new version.
    -   Describe the changes in the new version.

3.  **Build the project**:
    -   Run the following command to compile the TypeScript code to JavaScript:
        ```bash
        npm run build
        ```
    -   This will create a `dist` directory with the compiled code.

4.  **Publish to npm**:
    -   Run the following command to publish the package to npm:
        ```bash
        npm publish
        ```
    -   If you have two-factor authentication enabled, you will be prompted to enter a one-time password.
