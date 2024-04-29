# Unity Multiplayer Tutorial - Part 1

> [!IMPORTANT]
> TODO: This draft may link to WIP repos, docs or temporarily-hosted images - be sure to replace with final links/images after prerequisite PRs are approved (that are not yet approved upon writing this) -> then delete this memo.

## Quickstart Project Setup

This progressive tutorial will guide you to: 

1. Quickly setup up a multiplayer game project demo, using Unity and SpacetimeDB. 
1. Publish your demo SpacetimeDB C# server module to `testnet`.

💡 Need help? [Join our Discord server](https://discord.gg/spacetimedb)!

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

From Unity, you don't need CLI commands for common functionality: There's a Unity editor tool for that!

![Unity Publisher Editor Tool GIF](/images/unity-tutorial/part-1/unity-publisher-editor-tool-animated.gif)
<!--[Unity Publisher Editor Tool GIF-PREV](https://i.imgur.com/Hbup2W9.gif) -->

1. Open the _Publisher_ editor tool: `ALT+SHIFT+P` (or `Window/SpacetimeDB/Publisher` in the top menu)
1. Create an identity -> Select `testnet` for the server
1. Browse to your repo root `Server-Csharp` dir -> **Publish** -> **Generate** Unity files

💡For the next section, we'll use the selected `Server` and publish result `Host`

## 3. Connecting the Project

1. Open `Scenes/Main` in Unity -> select the `GameManager` GameObject in the inspector.
1. Matching the earlier Publish setup:
   1. For the GameManager `Db Name or Address`, input `testnet`
   1. For the GameManager `Host`, input `https://testnet.spacetimedb.com
1. Save your scene

## 4. Running the Project

With the same `Main` scene open, press play!

<!--[Gameplay Actions<>UI GIF-PREV](https://i.imgur.com/e9uLx3a.gif) -->

You should see your local player as a box in the scene: Notice some hints at the bottom-right for things to do.

## Conclusion

Congratulations! You have successfully set up your multiplayer game project. 

In the next section, we will break down how Server Modules work and analyze the demo code. In a later section, we'll also analyze the Unity client demo.