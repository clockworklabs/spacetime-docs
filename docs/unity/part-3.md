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

______________________
# OLD >> TODO: MV || DELETE

```csharp
// Start is called before the first frame update
void Start()
{
    instance = this;

    SpacetimeDBClient.instance.onConnect += () =>
    {
        Debug.Log("Connected.");

        // Request all tables
        SpacetimeDBClient.instance.Subscribe(new List<string>()
        {
            "SELECT * FROM *",
        });
    };

    // Called when we have an error connecting to SpacetimeDB
    SpacetimeDBClient.instance.onConnectError += (error, message) =>
    {
        Debug.LogError($"Connection error: " + message);
    };

    // Called when we are disconnected from SpacetimeDB
    SpacetimeDBClient.instance.onDisconnect += (closeStatus, error) =>
    {
        Debug.Log("Disconnected.");
    };

    // Called when we receive the client identity from SpacetimeDB
    SpacetimeDBClient.instance.onIdentityReceived += (token, identity, address) => {
        AuthToken.SaveToken(token);
        local_identity = identity;
    };

    // Called after our local cache is populated from a Subscribe call
    SpacetimeDBClient.instance.onSubscriptionApplied += OnSubscriptionApplied;

    // Now that we’ve registered all our callbacks, lets connect to spacetimedb
    SpacetimeDBClient.instance.Connect(AuthToken.Token, hostName, moduleAddress);
}
```

In our `onConnect` callback we are calling `Subscribe` and subscribing to all data in the database. You can also subscribe to specific tables using SQL syntax like `SELECT * FROM MyTable`. Our SQL documentation enumerates the operations that are accepted in our SQL syntax.

Subscribing to tables tells SpacetimeDB what rows we want in our local client cache. We will also not get row update callbacks or event callbacks for any reducer that does not modify a row that matches at least one of our queries. This means that events can happen on the server and the client won't be notified unless they are subscribed to at least 1 row in the change.

---

**Local Client Cache**

The "local client cache" is a client-side view of the database defined by the supplied queries to the `Subscribe` function. It contains the requested data which allows efficient access without unnecessary server queries. Accessing data from the client cache is done using the auto-generated iter and filter_by functions for each table, and it ensures that update and event callbacks are limited to the subscribed rows.

---

Next we write the `OnSubscriptionApplied` callback. When this event occurs for the first time, it signifies that our local client cache is fully populated. At this point, we can verify if a player entity already exists for the corresponding user. If we do not have a player entity, we need to show the `UserNameChooser` dialog so the user can enter a username. We also put the message of the day into the chat window. Finally we unsubscribe from the callback since we only need to do this once.

**Append after the Start() function in TutorialGameManager.cs**

```csharp
void OnSubscriptionApplied()
{
    // If we don't have any data for our player, then we are creating a
    // new one. Let's show the username dialog, which will then call the
    // create player reducer
    var player = PlayerComponent.FilterByOwnerId(local_identity);
    if (player == null)
    {
       // Show username selection
       UIUsernameChooser.instance.Show();
    }

    // Show the Message of the Day in our Config table of the Client Cache
    UIChatController.instance.OnChatMessageReceived("Message of the Day: " + Config.FilterByVersion(0).MessageOfTheDay);

    // Now that we've done this work we can unregister this callback
    SpacetimeDBClient.instance.onSubscriptionApplied -= OnSubscriptionApplied;
}
```

### Adding the Multiplayer Functionality

Now we have to change what happens when you press the "Continue" button in the name dialog window. Instead of calling start game like we did in the single player version, we call the `create_player` reducer on the SpacetimeDB module using the auto-generated code. Open `UIUsernameChooser.cs`.

**Append to the top of UIUsernameChooser.cs**

```csharp
using SpacetimeDB.Types;
```

Then we're doing a modification to the `ButtonPressed()` function:

**Modify the ButtonPressed function in UIUsernameChooser.cs**

```csharp
public void ButtonPressed()
{         
    CameraController.RemoveDisabler(GetHashCode());
    _panel.SetActive(false);

    // Call the SpacetimeDB CreatePlayer reducer
    Reducer.CreatePlayer(_usernameField.text);
}
```

We need to create a `RemotePlayer` script that we attach to remote player objects. In the same folder as `LocalPlayer.cs`, create a new C# script called `RemotePlayer`. In the start function, we will register an OnUpdate callback for the `EntityComponent` and query the local cache to get the player’s initial position. **Make sure you include a `using SpacetimeDB.Types;`** at the top of the file.

First append this using to the top of `RemotePlayer.cs`

**Create file RemotePlayer.cs, then replace its contents:**

```csharp
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using SpacetimeDB.Types;
using TMPro;

public class RemotePlayer : MonoBehaviour
{
    public ulong EntityId;

    public TMP_Text UsernameElement;

    public string Username { set { UsernameElement.text = value; } }

    void Start()
    {
        // Initialize overhead name
        UsernameElement = GetComponentInChildren<TMP_Text>();
        var canvas = GetComponentInChildren<Canvas>();
        canvas.worldCamera = Camera.main;

        // Get the username from the PlayerComponent for this object and set it in the UI
        PlayerComponent? playerComp = PlayerComponent.FilterByEntityId(EntityId).FirstOrDefault();
        if (playerComp is null)
        {
            string inputUsername = UsernameElement.Text;
            Debug.Log($"PlayerComponent not found - Creating a new player ({inputUsername})");
            Reducer.CreatePlayer(inputUsername);
            
            // Try again, optimistically assuming success for simplicity
            PlayerComponent? playerComp = PlayerComponent.FilterByEntityId(EntityId).FirstOrDefault();
        }
        
        Username = playerComp.Username;

        // Get the last location for this player and set the initial position
        EntityComponent entity = EntityComponent.FilterByEntityId(EntityId);
        transform.position = new Vector3(entity.Position.X, entity.Position.Y, entity.Position.Z);

        // Register for a callback that is called when the client gets an
        // update for a row in the EntityComponent table
        EntityComponent.OnUpdate += EntityComponent_OnUpdate;
    }
}
```

We now write the `EntityComponent_OnUpdate` callback which sets the movement direction in the `MovementController` for this player. We also set the target position to the current location in the latest update.

**Append to bottom of RemotePlayer class in RemotePlayer.cs:**

```csharp
private void EntityComponent_OnUpdate(EntityComponent oldObj, EntityComponent obj, ReducerEvent callInfo)
{
    // If the update was made to this object
    if(obj.EntityId == EntityId)
    {
        var movementController = GetComponent<PlayerMovementController>();

        // Update target position, rotation, etc.
        movementController.RemoteTargetPosition = new Vector3(obj.Position.X, obj.Position.Y, obj.Position.Z);
        movementController.RemoteTargetRotation = obj.Direction;
        movementController.SetMoving(obj.Moving);
    }
}
```

Next we need to handle what happens when a `PlayerComponent` is added to our local cache. We will handle it differently based on if it’s our local player entity or a remote player. We are going to register for the `OnInsert` event for our `PlayerComponent` table. Add the following code to the `Start` function in `TutorialGameManager`.

**Append to bottom of Start() function in TutorialGameManager.cs:**

```csharp
PlayerComponent.OnInsert += PlayerComponent_OnInsert;
```

Create the `PlayerComponent_OnInsert` function which does something different depending on if it's the component for the local player or a remote player. If it's the local player, we set the local player object's initial position and call `StartGame`. If it's a remote player, we instantiate a `PlayerPrefab` with the `RemotePlayer` component. The start function of `RemotePlayer` handles initializing the player position.

**Append to bottom of TutorialGameManager class in TutorialGameManager.cs:**

```csharp
private void PlayerComponent_OnInsert(PlayerComponent obj, ReducerEvent callInfo)
{
    // If the identity of the PlayerComponent matches our user identity then this is the local player
    if(obj.OwnerId == local_identity)
    {
        // Now that we have our initial position we can start the game
        StartGame();
    }
    else
    {
        // Spawn the player object and attach the RemotePlayer component
        var remotePlayer = Instantiate(PlayerPrefab);
        
        // Lookup and apply the position for this new player
        var entity = EntityComponent.FilterByEntityId(obj.EntityId);
        var position = new Vector3(entity.Position.X, entity.Position.Y, entity.Position.Z);
        remotePlayer.transform.position = position;
        
        var movementController = remotePlayer.GetComponent<PlayerMovementController>();
        movementController.RemoteTargetPosition = position;
        movementController.RemoteTargetRotation = entity.Direction;
        
        remotePlayer.AddComponent<RemotePlayer>().EntityId = obj.EntityId;
    }
}
```

Next, we will add a `FixedUpdate()` function to the `LocalPlayer` class so that we can send the local player's position to SpacetimeDB. We will do this by calling the auto-generated reducer function `Reducer.UpdatePlayerPosition(...)`. When we invoke this reducer from the client, a request is sent to SpacetimeDB and the reducer `update_player_position(...)` (Rust) or `UpdatePlayerPosition(...)` (C#) is executed on the server and a transaction is produced. All clients connected to SpacetimeDB will start receiving the results of these transactions.

**Append to the top of LocalPlayer.cs**

```csharp
using SpacetimeDB.Types;
using SpacetimeDB;
```

**Append to the bottom of LocalPlayer class in LocalPlayer.cs**

```csharp
private float? lastUpdateTime;
private void FixedUpdate()
{
   float? deltaTime = Time.time - lastUpdateTime;
   bool hasUpdatedRecently = deltaTime.HasValue && deltaTime.Value < 1.0f / movementUpdateSpeed;
   bool isConnected = SpacetimeDBClient.instance.IsConnected();

   if (hasUpdatedRecently || !isConnected)
   {
      return;
   }

   lastUpdateTime = Time.time;
   var p = PlayerMovementController.Local.GetModelPosition();
   
   Reducer.UpdatePlayerPosition(new StdbVector3
      {
         X = p.x,
         Y = p.y,
         Z = p.z,
      },
      PlayerMovementController.Local.GetModelRotation(),
      PlayerMovementController.Local.IsMoving());
}
```

Finally, we need to update our connection settings in the inspector for our GameManager object in the scene. Click on the GameManager in the Hierarchy tab. The the inspector tab you should now see fields for `Module Address` and `Host Name`. Set the `Module Address` to the name you used when you ran `spacetime publish`. This is likely `unity-tutorial`. If you don't remember, you can go back to your terminal and run `spacetime publish` again from the `server` folder.

![GameManager-Inspector2](/images/unity-tutorial/GameManager-Inspector2.JPG)

### Play the Game!

Go to File -> Build Settings... Replace the SampleScene with the Main scene we have been working in.

![Unity-AddOpenScenes](/images/unity-tutorial/Unity-AddOpenScenes.JPG)

When you hit the `Build` button, it will kick off a build of the game which will use a different identity than the Unity Editor. Create your character in the build and in the Unity Editor by entering a name and clicking `Continue`. Now you can see each other in game running around the map.

### Implement Player Logout

So far we have not handled the `logged_in` variable of the `PlayerComponent`. This means that remote players will not despawn on your screen when they disconnect. To fix this we need to handle the `OnUpdate` event for the `PlayerComponent` table in addition to `OnInsert`. We are going to use a common function that handles any time the `PlayerComponent` changes.

**Append to the bottom of Start() function in TutorialGameManager.cs**
```csharp
PlayerComponent.OnUpdate += PlayerComponent_OnUpdate;
```

We are going to add a check to determine if the player is logged for remote players. If the player is not logged in, we search for the `RemotePlayer` object with the corresponding `EntityId` and destroy it.

Next we'll be updating some of the code in `PlayerComponent_OnInsert`. For simplicity, just replace the entire function.

**REPLACE PlayerComponent_OnInsert in TutorialGameManager.cs**
```csharp
private void PlayerComponent_OnUpdate(PlayerComponent oldValue, PlayerComponent newValue, ReducerEvent dbEvent)
{
    OnPlayerComponentChanged(newValue);
}

private void PlayerComponent_OnInsert(PlayerComponent obj, ReducerEvent dbEvent)
{
    OnPlayerComponentChanged(obj);
}

private void OnPlayerComponentChanged(PlayerComponent obj)
{
    // If the identity of the PlayerComponent matches our user identity then this is the local player
    if(obj.OwnerId == local_identity)
    {
        // Now that we have our initial position we can start the game
        StartGame();
    }
    else
    {
        // otherwise we need to look for the remote player object in the scene (if it exists) and destroy it
        var existingPlayer = FindObjectsOfType<RemotePlayer>().FirstOrDefault(item => item.EntityId == obj.EntityId);
        if (obj.LoggedIn)
        {
            // Only spawn remote players who aren't already spawned
            if (existingPlayer == null)
            {
                // Spawn the player object and attach the RemotePlayer component
                var remotePlayer = Instantiate(PlayerPrefab);
                
                // Lookup and apply the position for this new player
                var entity = EntityComponent.FilterByEntityId(obj.EntityId);
                var position = new Vector3(entity.Position.X, entity.Position.Y, entity.Position.Z);
                remotePlayer.transform.position = position;
                
                var movementController = remotePlayer.GetComponent<PlayerMovementController>();
                movementController.RemoteTargetPosition = position;
                movementController.RemoteTargetRotation = entity.Direction;
                
                remotePlayer.AddComponent<RemotePlayer>().EntityId = obj.EntityId;
            }
        }
        else
        {
            if (existingPlayer != null)
            {
                Destroy(existingPlayer.gameObject);
            }
        }
    }
}
```

Now you when you play the game you should see remote players disappear when they log out.

Before updating the client, let's generate the client files and update publish our module.

**Execute commands in the server/ directory**
```bash
spacetime generate --out-dir ../client/Assets/module_bindings --lang=csharp
spacetime publish -c unity-tutorial
```

On the client, let's add code to send the message when the chat button or enter is pressed. Update the `OnChatButtonPress` function in `UIChatController.cs`.

**Append to the top of UIChatController.cs:**
```csharp
using SpacetimeDB.Types;
```

**REPLACE the OnChatButtonPress function in UIChatController.cs:**

```csharp
public void OnChatButtonPress()
{
    Reducer.SendChatMessage(_chatInput.text);
    _chatInput.text = "";
}
```

Now we need to add a reducer to handle inserting new chat messages. First register for the ChatMessage reducer in the `Start()` function using the auto-generated function:

**Append to the bottom of the Start() function in TutorialGameManager.cs:**
```csharp
Reducer.OnSendChatMessageEvent += OnSendChatMessageEvent;
```

Now we write the `OnSendChatMessageEvent` function. We can find the `PlayerComponent` for the player who sent the message using the `Identity` of the sender. Then we get the `Username` and prepend it to the message before sending it to the chat window.

**Append after the Start() function in TutorialGameManager.cs**
```csharp
private void OnSendChatMessageEvent(ReducerEvent dbEvent, string message)
{
    var player = PlayerComponent.FilterByOwnerId(dbEvent.Identity);
    if (player != null)
    {
        UIChatController.instance.OnChatMessageReceived(player.Username + ": " + message);
    }
}
```

Now when you run the game you should be able to send chat messages to other players. Be sure to make a new Unity client build and run it in a separate window so you can test chat between two clients.

## Conclusion

This concludes the SpacetimeDB basic multiplayer tutorial, where we learned how to create a multiplayer game. In the next Unity tutorial, we will add resource nodes to the game and learn about _scheduled_ reducers:

**Next Unity Tutorial:** [Resources & Scheduling](/docs/unity/part-4.md)

---

### Troubleshooting

- If you get an error when running the generate command, make sure you have an empty subfolder in your Unity project Assets folder called `module_bindings`

- If you get this exception when running the project:

```
NullReferenceException: Object reference not set to an instance of an object
TutorialGameManager.Start () (at Assets/_Project/Game/TutorialGameManager.cs:26)
```

Check to see if your GameManager object in the Scene has the NetworkManager component attached.

- If you get an error in your Unity console when starting the game, double check your connection settings in the Inspector for the `GameManager` object in the scene.

```
Connection error: Unable to connect to the remote server
```
