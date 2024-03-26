# Unity Multiplayer Tutorial

## Part 1 of 3: Setup

This tutorial will guide you through setting up a multiplayer game project using Unity and SpacetimeDB. We will start by cloning the project, connecting it to SpacetimeDB and running the project.

💡 Need help? [Join our Discord server](https://discord.gg/spacetimedb)!

> [!IMPORTANT]
> TODO: This draft may link to WIP repos or docs - be sure to replace with final links after prerequisite PRs are approved (that are not yet approved upon writing this)

## 1. Clone the Project

Let's name it `SpacetimeDBUnityTutorial` for reference:
```bash
git clone https://github.com/clockworklabs/zeke-demo-project/tree/dylan/feat/mini-upgrade SpacetimeDBUnityTutorial
```

This project repo is separated into two sub-projects:

1. [Server](https://github.com/clockworklabs/zeke-demo-project/tree/dylan/feat/mini-upgrade/Server-Csharp) (SpacetimeDB Module)
1. [Client](https://github.com/clockworklabs/zeke-demo-project/tree/dylan/feat/mini-upgrade/Client) (Unity project)

> [!TIP]
> You may optionally _update_ the [SpacetimeDB SDK](https://github.com/clockworklabs/com.clockworklabs.spacetimedbsdk) via the Package Manager in Unity

## 2. Publishing the Project

From Unity, you don't need CLI commands for common functionality:

1. Open the _Publisher_ editor tool: `ALT+SHIFT+P` (or `Window/SpacetimeDB/Publisher` in the top menu)
1. Create an identity -> Select `testnet` for the server
1. Browse to your repo root `Server-Csharp` dir -> **Publish** -> **Generate** Unity files

💡For the next section, we'll use the selected `Server` and publish result `Host`

![Unity Publisher Tool](https://github.com/clockworklabs/zeke-demo-project/raw/dylan/feat/mini-upgrade/.doc/prev-publisher.jpg)

## 3. Connecting the Project

1. Open `Scenes/Main` in Unity -> select the `GameManager` GameObject in the inspector.
1. Matching the earlier Publish setup:
   1. For the GameManager `Db Name or Address`, input `testnet`
   1. For the GameManager `Host`, input `https://testnet.spacetimedb.com
1. Save your scene

## 4. Running the Project

With the same `Main` scene open, press play!

![Gameplay Screenshot](https://github.com/clockworklabs/zeke-demo-project/raw/dylan/feat/mini-upgrade/.doc/prev-action.jpg)

![UI Screenshot](https://github.com/clockworklabs/zeke-demo-project/raw/dylan/feat/mini-upgrade/.doc/prev-ui.jpg)

You should see your local player as a box in the scene: Notice some hints at the bottom-right for things to do.

Congratulations! You have successfully set up your multiplayer game project. In the next section, we will break down how Server Modules work and analyze the demo code.
