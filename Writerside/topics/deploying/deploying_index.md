# Deploying Overview

SpacetimeDB supports both hosted and self-hosted publishing in multiple ways. Below, we will:

1. Generally introduce Identities.
1. Generally introduce Servers.
1Choose to proceed with either a [Hosted](hosted1.md) or [Self-Hosted](self-hosted1.md) deployment.

💡 This tutorial assumes that you have already [installed](install.) the SpacetimeDB CLI.

## About Identities

An `Identity` is a hash attached to a `Nickname` and `Email`, allowing you to manage your app (such as `Publishing` your app).

Each `Identity` is bound to one, single `Server`: Unlike GitHub, for example, you would require one identity per server.

By default, there are no identities created. While the next tutorial will go more in-depth, you may create a new one via CLI:
```bash
spacetime identity new --name {Nickname} --email {Email}
```

See the verbose [overview identity explanation](https://spacetimedb.com/docs#identities), [API reference](identity1.md) or CLI help (below) for further managing `Identities`:
```bash
spacetime identity --help
```

## About Servers

You `publish` your app to a target `Server` database: While we recommend to **host** your SpacetimeDB app with us for simplicity and scalability, you may also **self-host** (such as locally).

By default, there are already two default servers added ([testnet](hosted1.md) and [local](self-hosted1.md)). While the next tutorial will go more in-depth, you may list your servers via CLI:
```bash
spacetime server list
```

See the [API reference](database1.md) or CLI help (below) for further managing `Servers`:
```bash
spacetime server --help
```

---

## Deploying via CLI

Choose a server for your hosting tutorial path to set a server as default, create an identity, and deploy (`publish`) your app:

1. [testnet](hosted1.md) (hosted)
2. [local](self-hosted1.md) (self-hosted)
