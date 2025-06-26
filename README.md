# Crystallize CLI

The ultimate CLI for managing your Crystallize project.

## Context

This new version is fully written in Bun and can be installed in a much more standard way. The CLI is built for the future of Crystallize, whether you're using it locally to enhance your Developer Experience or within your CI/CD pipelines to automate tasks.

> **Fun fact:** You don't even need Node or Bun to run it—it's pre-compiled with everything included.

### Replacing Legacy CLIs

Two older CLIs—`@crystallize/cli` and `@crystallize/cli-next`—are now deprecated. These were available on NPM and installable via `npx` (or similar), and while they still function, they are now primarily used for installing legacy templates.

## Installation

```bash
curl -LSs https://crystallizeapi.github.io/cli/install.bash | bash
```

> Concerned about what [this script](https://github.com/CrystallizeAPI/cli/blob/main/docs/install.bash) does? It's fully open-source, so you can review it yourself. It primarily detects your OS and platform to download the [latest version](https://github.com/CrystallizeAPI/cli/releases) of the CLI from GitHub.

## Features

The CLI enhances Developer Experience while also being CI/CD-friendly for automation.

- **Boilerplate Installation:** Automates tedious setup steps:
    1. Cloning the repository
    2. Creating the tenant
    3. Populating data in the tenant
    4. Setting up the `.env` file
    5. Installing dependencies

- **Tenant Management:** Currently supports `create` for empty tenants and generating `invitations` for existing ones. Future contributions are welcome!

- **Token Management:** Fetch and generate access tokens easily.

- **Image Uploads:** Quickly upload and register images, whether a single file or an entire folder.

- **Mass Operations:** Experimental but functional. You can `dump` your content model as JSON, `run` mass operations, and `execute` sets of mutations.

## Interactivity

Most commands are interactive. If credentials are missing, or input is required, the CLI will prompt you. To disable interactivity (e.g., in a CI environment), use `--no-interactive` where applicable.

## Credentials

The CLI stores credentials in `~/.crystallize/credentials.json` when saved interactively. It checks for credentials in the following order:

1. **Environment variables:** `CRYSTALLIZE_ACCESS_TOKEN_ID` and `CRYSTALLIZE_ACCESS_TOKEN_SECRET`
2. **Command options:** `--token_id` and `--token_secret`
3. **Stored file:** `~/.crystallize/credentials.json`

## Boilerplate Installation

An interactive command designed to simplify setting up boilerplates.

```bash
~/crystallize boilerplate install <folder> [tenant-identifier] [boilerplate-identifier]
```

- `folder` (required): The installation directory.
- `tenant-identifier` and `boilerplate-identifier` (optional): If omitted, a wizard will guide you.

## Tenant Management

### Creating a Tenant

Creates a new tenant and removes default shapes for a clean setup.

```bash
~/crystallize tenant create <tenant-identifier>
```

- Runs non-interactively with `--no-interactive` if [credentials](#credentials) are available.
- If the identifier is taken, the CLI will inform you and suggest an alternative.

### Inviting Users to a Tenant

Generates invitation links for new users.

```bash
~/crystallize tenant invite <tenant-identifier>
```

Options:

- `--role`: Default is `tenantAdmin`, but other roles are available.
- `--expiry`: Default is 6 hours; you can customize it.
- `--number`: Default is 1; you can generate multiple invites.

## Image Upload

Uploads and registers images in the Asset Organizer.

```bash
~/crystallize image upload <tenant-identifier> <file> [output-file]
```

- `file` can be a single file or a folder (uploading all contained images).
- `output-file` (optional) stores mappings for automation.

Example output:

```json
{
    "clean-name-png": "crystallize-key",
    "images-crystallize-png": "my-tenant/25/1/12/3435d2d0/images/crystallize.png"
}
```

Use `--force` to overwrite an existing `output-file`.

## Mass Operations

### Dumping the Content Model

Creates a Mass Operation file containing the content model (_Shapes_ and _Pieces_).

```bash
~/crystallize mass-operation dump-content-model <tenant-identifier> <file>
```

Use `--force` to overwrite an existing file.

### Running a Mass Operation

Executes a Mass Operation file by uploading it, registering the operation, and waiting for completion.

```bash
~/crystallize mass-operation run <tenant-identifier> <file>
```

- Use `--legacy-spec` to convert an old Spec File to a Mass Operation file.

### Executing Mutations

A client-side utility to automate mutations.

```bash
~/crystallize mass-operation execute-mutations <tenant-identifier> <file> [image-mapping-file]
```

- `file`: Contains the mutations (format below).
- `image-mapping-file` (optional): Injects image paths into variables.

#### Mutation Format

```json
{
    "create-products": {
        "target": "pim",
        "mutation": "mutation CreateProduct($input: CreateProductInput!) { product { create(language: \"en\", input: $input) { id } } }",
        "sets": []
    },
    "publish-items": {
        "mutation": "mutation PublishItems($ids: [ID!]!) { publishItems(language: \"en\", ids: $ids) { success { itemId } } }",
        "target": "core",
        "sets": [{ "ids": ["$create-products[0].product.create.id"] }]
    }
}
```

#### Dependency Management

Use references like `$create-products[0].product.create.id` to pass IDs from one operation to another.

#### Injected Variables

- `$root.TENANT_ID`
- `$root.TENANT_DEFAULT_VATTYPE_ID`
- `$root.TENANT_ROOT_ID`

#### Image Mapping File

```json
{
    "images": [
        { "key": "$images.crystallize-key" },
        { "key": "$images.my-tenant/25/1/12/3435d2d0/images/crystallize.png" }
    ]
}
```

## Contributing

The CLI resides in [CrystallizeAPI/tools](https://github.com/CrystallizeAPI/tools), a read-only split from the main repo.

For issues or contributions, submit them to the main repository: [CrystallizeAPI/tools](https://github.com/CrystallizeAPI/tools).

[crystallizeobject]: crystallize_marketing|folder|67ae7f698dcd1f699563c8d5
