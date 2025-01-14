# Crystallize CLI

---

This repository is what we call a "subtree split": a read-only copy of one directory of the main repository.

If you want to report or contribute, you should do it on the main repository: https://github.com/CrystallizeAPI/tools

---

## Help

```bash
npx @crystallize/cli-next@latest --help
```

## Features

### Install a new project based on a Boilerplate

```bash
npx @crystallize/cli-next@latest install ~/my-projects/my-ecommerce
```

This will create a new folder, download the boilerplate and `npm install` it.

```bash
npx @crystallize/cli-next@latest install ~/my-projects/my-ecommerce --bootstrap-tenant
```

This will do the same as the previous command but it will create a new Tenant with clean data from the Boilerplate.

### Dump a tenant

```bash
npx @crystallize/cli-next@latest dump ~/my-projects/mydumpfolder tenantIdentifier
```

This is dumping a Tenant.

### Install a new project based on a Boilerplate

```bash
npx @crystallize/cli-next@latest import ~/my-projects/mydumpfolder/spec.json aNewTenant
```

This is importing a Tenant based on a dump

### More Options

```bash
npx @crystallize/cli-next@latest --help
```
