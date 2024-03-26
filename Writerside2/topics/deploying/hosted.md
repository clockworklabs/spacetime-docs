# Deploying - Hosted

This tutorial assumes that you have already [installed](install.) the SpacetimeDB CLI. Via CLI, we will then:

1. Ensure our hosted server named `testnet` exists as the default.
1. Create an `Identity`.
1. `Publish` your app.

💡 This tutorial assumes that you have already [installed](install.) the SpacetimeDB CLI and that you already have `testnet` server added (exists by default). If you accidentally removed `testnet`, add it back via CLI:

```bash
spacetime server add "https://testnet.spacetimedb.com" testnet
```

## SpacetimeDB Cloud (Hosted) Deployment

Currently, for hosted deployment, only the `testnet` server is available for SpacetimeDB cloud, which is subject to wipes.

📢 Stay tuned (such as [via Discord](https://discord.com/invite/SpacetimeDB)) for `mainnet` coming soon!

## Set the Server Default

To make CLI commands easier so that we don't need to keep specifying `testnet` as the target server, let's set it as default: 

```bash
spacetime server set-default testnet
```

## Creating an Identity

By default, there are no identities created. Let's create a new one via CLI:
```bash
spacetime identity new --name {Nickname} --email {Email}
```

💡If you already created an identity but forgot to attach an email, add it via CLI:
```bash
spacetime identity set-email {Email}
```

## Create and Publish a Module

Let's create a vanilla Rust module called `HelloSpacetimeBD` from our home dir, then publish it "as-is". For Windows users, use `PowerShell`:

```bash
cd ~
spacetime init --lang rust HelloSpacetimeDB
cd HelloSpacetimeDB
spacetime publish HelloSpacetimeDB
```

## Hosted Web Dashboard

By earlier associating an email with your CLI identity, you can now view your published modules on the web dashboard. For multiple identities, first list them and copy the hash you want to use:

```bash
spacetime identity list
```

1. Open the SpacetimeDB [login page](https://spacetimedb.com/login) using the same email above.
1. Choose your identity from the dropdown menu.
   - \[For multiple identities\] `CTRL+F` to highlight the correct identity you copied earlier.
1. Check your email for a validation link.

You should now be able to see your published modules on the web dashboard!

---

## Summary

- We ensured the hosted `testnet` server existed, then set it as the default.
- We added an `identity` to bind with our hosted `testnet` server, ensuring it contained both a Nickname and Email.
- We then logged in the web dashboard via an email `one-time password (OTP)` and were then able to view our published apps.
- With SpacetimeDB Cloud, you benefit from automatic scaling, robust security, and the convenience of not having to manage the hosting environment.
