# Unity Multiplayer Tutorial - Part 3

> [!IMPORTANT]
> TODO: This draft may link to WIP repos, docs or temporarily-hosted images - be sure to replace with final links/images after prerequisite PRs are approved (that are not yet approved upon writing this) -> then delete this memo.

## Prerequisites

This progressive tutorial is continued from [Part 2](/docs/unity/part-2.md):
1. You have already [setup your project](/docs/unity/index.md).
1. You have already [published your server module](/docs/unity/part-2.md).

## Analyzing the Unity Client Demo

In this part of the tutorial, we will:

1. Setup your `GameManager` connection properties.
1. Inspect high-level client initialization.
1. Press Play -> Guided breakdown of game features:
    1. Chat
    1. Resource Gathering
    1. Inventory
    1. Store
    1. Unlockables

Start by opening `Scenes/Main` in the Unity project from the repo `/Client` dir.

## GameManager Connection Setup

![GameManager Inspector (+host name variations)](https://i.imgur.com/sHxYyS7.png)

Select the `GameManager` in the scene hierarchy:

1. Set **Db Name Or Address** to: `unity-demo`.
2. Set the **Host Name** to: `testnet`.
3. Save your scene.

## High-Level Client Initialization

Open the **GameManager.cs** script we were just inspecting and jump to `Start()`:

```csharp
/// Register callbacks -> Connect to SpacetimeDB
private void Start()
{
    Application.runInBackground = true;
    
    initSubscribeToEvents();
    connectToSpacetimeDb();
}
```

1. Once connected, we subscribe to all tables, then unregister the callback:

```csharp
/// When we connect to SpacetimeDB we send our subscription queries
/// to tell SpacetimeDB which tables we want to get updates for.
/// After called, we'll unsub from onConnect
private void initOnceOnConnect()
{
    SpacetimeDBClient.instance.onConnect += () =>
    {
        Debug.Log("Connected.");

        SpacetimeDBClient.instance.Subscribe(new List<string>
        {
            "SELECT * FROM *",
        });
        
        SpacetimeDBClient.instance.onConnect -= connectToSpacetimeDb;
    };
}
```

> [!TIP]
> In a production environment, you'd instead subscribe to limited, local scopes and resubscribe with different parameters as you move through different zones.

2. We then subscribe to database callbacks such as connection, disconnection, errors, inventory, player, etc.
   - This includes an **identity received** callback. 
   - This is important since your identity what we will 1st check for _nearly all_ callbacks to determine if it's the local player:

```csharp
private void onIdentityReceived(string token, Identity identity, Address address)
{
    // Cache the "last connected" dbNameOrAddress to later associate with the cached AuthToken
    // This is so that if we change servers, we know to clear the token to prevent mismatch
    PlayerPrefs.SetString(DB_NAME_ADDRESS_KEY, dbNameOrAddress);
    AuthToken.SaveToken(token);
        
    // Cache the player identity for later to compare against component ownerIds
    // to see if it's the local player
    _localIdentity = identity;
}
```

3. Finally, we connect via a token, host and database name:
```csharp
/// On success =>
/// 1. initOnceOnConnect() -> Subscribe to tables
/// 2. onIdentityReceived() -> Cache identity, token
/// On fail => onConnectError()
private void connectToSpacetimeDb()
{
    string token = getConnectAuthToken();
    string normalizedHostName = getNormalizedHostName();
    
    SpacetimeDBClient.instance.Connect(
        token, 
        normalizedHostName,
        dbNameOrAddress);
}
```

## Play the Demo Game
![Gameplay Actions<>UI GIF](https://i.imgur.com/e9uLx3a.gif)

Notice at the bottom-right, you have some tips:

1. **Enter** = Chat
2. **Tab** = Inventory
3. Collect resources
4. Spend at the shop

✅ From here, you can either explore the game's features on your own or continue reading for a guided breakdown below. Try triggering in-game features, then noting the log callstacks for entry point and flow hints.

___

## Features Breakdown

### Feature: Chat

![Chat<>Reducer Tool](https://i.imgur.com/Gm6YN1S.png)

Note the message of the day, directing you to emulate a third-party with the _Reducers_ editor tool:

> Try the 'Reducers' tool **SHIFT+ALT+D**

💡 Alternately accessed from the top menu: `Window/SpacetimeDB/Reducers`

1. CreatePlayer

![Create Player via Reducer Tool](https://i.imgur.com/yl5WBXt.png)

2. Repeat with `SendChatMessage` to see it appear in chat from your created "third-party" player.
   
💡 Dive into `UIChatController.cs` to best further discover how client-side chat messages work.

### Feature: Resource Gathering

![Resource Gathering](https://i.imgur.com/McdvbHZ.png)

Thanks to our scheduler set by the server via the `Init()`, resources will spawn every 5~10 seconds (with the specified max cap): 

1. Extract (harvest) `Iron` by left-clicking a nearby blue node.
1. Once you unlock `Strawberries` in the shop later, you can see and extract those, too.
   - 💡`Strawberries` are likely already spawned on the server, but the unlockable requirement prevents you from seeing it (client-authoritative) or extracting it (server-authoritative).

Extracting a resource will trigger the following flows:

![initSubscribeToEvents-Resource-Extraction-Events](https://i.imgur.com/xqJQ3Xu.png)

1. **[Client]** Call `Reducer.Extract()` from `PlayerInputReceiver.cs` via `OnActionButton()`.


2. **[Server]** `Extract()` from `Resource.cs` will: 
   1. Validate player, identity, config, inventory resource, and animator (which handles extraction speed).
   1. If valid, validate unlockables (eg: for `Strawberries`), consider items like `Pickaxe` for increased extraction speed and finally extract:
   1. InventoryComponent will be updated to add the resource and lower the `ResourceNodeComponent` hp by 1.
      1. If 0 hp, it will be destroyed.
   1. The resource will be inserted into to the player's `InventoryComponent`


3. **[Client]** Remember when [GameManager at Start()](#high-level-client-initialization) declared `initSubscribeToEvents()`?
    - **Inventory:**
        1. `onInventoryComponentUpdate()` -> `PlayerInventoryController.Local.InventoryUpdate(newValue)` chain will be called.
        1. `InventoryUpdate()` will clear `PlayerInventoryController.Local._pockets` and resync with the server's `newValue`.
    - **Resource:** `onResourceNodeComponentDelete` will `GameResources.RemoveAll()` those matching `oldValue.EntityId`.
    - **Animation:** `OnAnimationComponentUpdate` will show animations from a RemotePlayer extracting a resource.

💡 Dive into `GameResource.cs` to best further discover how client-side extractions work. 

### Feature: Inventory

![Player Inventory](https://i.imgur.com/sBkgW48.png)

- On server [Player.cs::CreatePlayer()](./part-2.md#db-initialization), this chained to `createPlayerInventory()`, creating the default inventory `Pockets` and an empty set of `UnlockIds`.
   - When the `Pocket` was created, we started the new Player with 5x `Iron`. 
   - Since the `Strawberry` unlock in the store only requires 5x `Iron`, we may _unlock_ it right away to see and extract `Strawberries`. 

See the [Store](#feature-store) section below for example items being consumed and replaced for a store purchase.

💡 Dive into `UIInventoryWindow.cs` to best further discover how client-side inventory works.

### Feature: Unlockables

![Unlockables](https://i.imgur.com/ShDOq4t.png)

See the [Store](#feature-store) section below for an example unlock store purchase.

💡 Dive into `UIUnlocks.cs` to best further discover how client-side unlocks work.

### Feature: Store

![Store Purchase (+Logs)](https://i.imgur.com/tZmR0uE.gif)

Open **ShopRow.cs** to find the `Purchase()` function:

```csharp
/// Success will trigger: OnInventoryComponentUpdate
public void Purchase() 
{
    Debug.Log($"Purchasing shopId:{_shopId}, shopSaleIdx:{_shopSaleIdx}");
    Reducer.Purchase(
        LocalPlayer.instance.EntityId, 
        _shopId, 
        (uint)_shopSaleIdx);
        
    tooltip.Clear();
}
```

Purchasing from the store will trigger the following flows:

1. **[Server]** `Purchase()` from `Shop.cs` will:
   1. Validate player, shop, sale, inventory, and required unlocks.
   1. If valid, process the sale:
      1. **Delete** required items from the player's `InventoryComponent`.
      1. **Update** `InventoryComponent` for qualifying `.GiveItems` and/or `.GivePlayerUnlocks`
      1. If any `InventoryComponent.GiveGlobalUnlocks`, **Update** `Config` by adding to its `GlobalUnlockIds`.


2. **[Client]** Remember when [GameManager at Start()](#high-level-client-initialization) declared `initSubscribeToEvents()`?
   - **Inventory:**
      1. `onInventoryComponentUpdate()` -> `PlayerInventoryController.Local.InventoryUpdate(newValue)` chain will be called.
      1. `InventoryUpdate()` will clear `PlayerInventoryController.Local._pockets` and resync with the server's `newValue`.
    - **Config:** `onConfigComponentUpdate()` -> `PlayerInventoryController.Local.ConfigUpdate(newValue)` chain will be called.

## Troubleshooting

TODO?

## Conclusion

TODO?