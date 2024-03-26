# Deploying - Self-Hosted

This tutorial assumes that you have already [installed](install.) the SpacetimeDB CLI. Via CLI, we will then:

1. Ensure our localhost server named `local` exists as the default.
1. Start our localhost server in a separate terminal window.
1. Create an `Identity` with at least a Nickname.
1. `Publish` your app.

💡 This tutorial assumes that you have already [installed](install.) the SpacetimeDB CLI and that you already have `local` server added (exists by default). If you accidentally removed `local`, add it back via CLI with the `--no-fingerprint` flag (since our server is not yet running):

```bash
spacetime server add "http://127.0.0.1:3000" local --no-fingerprint
```

## Set the Server Default

To make CLI commands easier so that we don't need to keep specifying `local` as the target server, let's set it as default:

```bash
spacetime server set-default local
```

## Start the Local Server

In a **separate** terminal window, start the local listen server in the foreground:
```bash
spacetime start
```

## Creating an Identity

By default, there are no identities created. Let's create a new one via CLI:
```bash
spacetime identity new --name {Nickname}
```

💡We could optionally add `--email {Email}` to the above command, but is currently unnecessary for local deployment since there's no web dashboard. If you already created an identity but forgot to attach a Nickname, add it via CLI to easier identify your modules:
```bash
spacetime identity set-name {Nickname}
```

## Create and Publish a Module

Let's create a vanilla Rust module called `HelloSpacetimeBD` from our home dir, then publish it "as-is". For Windows users, use `PowerShell`:

```bash
cd ~
spacetime init --lang rust HelloSpacetimeDB
cd HelloSpacetimeDB
spacetime publish HelloSpacetimeDB
```

---

## Summary

- We ensured the self-hosted `local` server existed, then set it as the default. 
- We then opened a separate terminal to run the self-hosted `local` server in the foreground.
- We added an `identity` to bind with our self-hosted `local` server set to default, ensuring it contained a Nickname.
