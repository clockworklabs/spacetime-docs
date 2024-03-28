> [!IMPORTANT]
> TODO: Delete this file, when done

_____

### Create the Module

1. It is important that you already have the SpacetimeDB CLI tool [installed](/install).

2. Run SpacetimeDB locally using the installed CLI. In a **new** terminal or command window, run the following command:

```bash
spacetime start
```

💡 Standalone mode will run in the foreground.
💡 Below examples Rust language, [but you may also use C#](../modules/c-sharp/index.md).

## Create a Server Module

Run the following command to initialize the SpacetimeDB server module project with Rust as the language:

```bash
spacetime init --lang=rust server
```

This command creates a new folder named "server" within your Unity project directory and sets up the SpacetimeDB server project with Rust as the programming language.

### SpacetimeDB Tables

In this section we'll be making some edits to the file `server/src/lib.cs`. We recommend you open up this file in an IDE like VSCode or RustRover.

**Important: Open the `server/src/lib.cs` file and delete its contents. We will be writing it from scratch here.**

First we need to add some imports at the top of the file.

**Copy and paste into lib.cs:**

```csharp
// using SpacetimeDB; // Uncomment to omit `SpacetimeDB` attribute prefixes
using SpacetimeDB.Module;
using static SpacetimeDB.Runtime;
```

Then we are going to start by adding the global `Config` table. Right now it only contains the "message of the day" but it can be extended to store other configuration variables. This also uses a couple of macros, like `#[spacetimedb(table)]` which you can learn more about in our [C# module reference](/docs/modules/c-sharp). Simply put, this just tells SpacetimeDB to create a table which uses this struct as the schema for the table.

**Append to the bottom of lib.cs:**

```csharp
/// We're using this table as a singleton,
/// so there should typically only be one element where the version is 0.
[SpacetimeDB.Table]
public partial class Config
{
   [SpacetimeDB.Column(ColumnAttrs.PrimaryKey)]
   public Identity Version;
   public string? MessageOfTheDay;
}
```

Next, we're going to define a new `SpacetimeType` called `StdbVector3` which we're going to use to store positions. The difference between a `[SpacetimeDB.Type]` and a `[SpacetimeDB.Table]` is that tables actually store data, whereas the deriving `SpacetimeType` just allows you to create a new column of that type in a SpacetimeDB table. Therefore, `StdbVector3` is not, itself, a table.

**Append to the bottom of lib.cs:**

```csharp
/// This allows us to store 3D points in tables.
[SpacetimeDB.Type]
public partial class StdbVector3
{
   public float X;
   public float Y;
   public float Z;
}
```

Now we're going to create a table which actually uses the `StdbVector3` that we just defined. The `EntityComponent` is associated with all entities in the world, including players.

```csharp
/// This stores information related to all entities in our game. In this tutorial
/// all entities must at least have an entity_id, a position, a direction and they
/// must specify whether or not they are moving.
[SpacetimeDB.Table]
public partial class EntityComponent
{
   [SpacetimeDB.Column(ColumnAttrs.PrimaryKeyAuto)]
   public ulong EntityId;
   public StdbVector3 Position;
   public float Direction;
   public bool Moving;
}
```

Next, we will define the `PlayerComponent` table. The `PlayerComponent` table is used to store information related to players. Each player will have a row in this table, and will also have a row in the `EntityComponent` table with a matching `EntityId`. You'll see how this works later in the `CreatePlayer` reducer.

**Append to the bottom of lib.cs:**

```csharp
/// All players have this component and it associates an entity with the user's
/// Identity. It also stores their username and whether or not they're logged in.
[SpacetimeDB.Table]
public partial class PlayerComponent
{
   // An EntityId that matches an EntityId in the `EntityComponent` table.
   [SpacetimeDB.Column(ColumnAttrs.PrimaryKey)]
   public ulong EntityId;
   
   // The user's identity, which is unique to each player
   [SpacetimeDB.Column(ColumnAttrs.Unique)]
   public Identity Identity;
   public string? Username;
   public bool LoggedIn;
}
```

Next, we write our very first reducer, `CreatePlayer`. From the client we will call this reducer when we create a new player:

**Append to the bottom of lib.cs:**

```csharp
/// This reducer is called when the user logs in for the first time and
/// enters a username.
[SpacetimeDB.Reducer]
public static void CreatePlayer(DbEventArgs dbEvent, string username)
{
   // Get the Identity of the client who called this reducer
   Identity sender = dbEvent.Sender;

   // Make sure we don't already have a player with this identity
   PlayerComponent? user = PlayerComponent.FindByIdentity(sender);
   if (user is null)
   {
       throw new ArgumentException("Player already exists");
   }

   // Create a new entity for this player
   try
   {
       new EntityComponent
       {
           // EntityId = 0, // 0 is the same as leaving null to get a new, unique Id
           Position = new StdbVector3 { X = 0, Y = 0, Z = 0 },
           Direction = 0,
           Moving = false,
       }.Insert();
   }
   catch
   {
       Log("Error: Failed to create a unique PlayerComponent", LogLevel.Error);
       Throw;
   }
  
   // The PlayerComponent uses the same entity_id and stores the identity of
   // the owner, username, and whether or not they are logged in.
   try
   {
       new PlayerComponent
       {
           // EntityId = 0, // 0 is the same as leaving null to get a new, unique Id
           Identity = dbEvent.Sender,
           Username = username,
           LoggedIn = true,
       }.Insert();
   }
   catch
   {
       Log("Error: Failed to insert PlayerComponent", LogLevel.Error);
       throw;
   }
   Log($"Player created: {username}");
}
```

---

**SpacetimeDB Reducers**

"Reducer" is a term coined by Clockwork Labs that refers to a function which when executed "reduces" into a list of inserts and deletes, which is then packed into a single database transaction. Reducers can be called remotely using the CLI, client SDK or can be scheduled to be called at some future time from another reducer call.

---

SpacetimeDB gives you the ability to define custom reducers that automatically trigger when certain events occur.

- `Init` - Called the first time you publish your module and anytime you clear the database. We'll learn about publishing later.
- `Connect` - Called when a user connects to the SpacetimeDB module. Their identity can be found in the `Sender` value of the `ReducerContext`.
- `Disconnect` - Called when a user disconnects from the SpacetimeDB module.

Next, we are going to write a custom `Init` reducer that inserts the default message of the day into our `Config` table. The `Config` table only ever contains a single row with version 0, which we retrieve using `Config.FilterByVersion(0)`.

**Append to the bottom of lib.cs:**

```csharp
/// Called when the module is initially published
[SpacetimeDB.Reducer(ReducerKind.Init)]
public static void OnInit()
{
   try
   {
       new Config
       {
           Version = 0,
           MessageOfTheDay = "Hello, World!",
       }.Insert();
   }
   catch
   {
       Log("Error: Failed to insert Config", LogLevel.Error);
       throw;
   }
}
```

We use the `Connect` and `Disconnect` reducers to update the logged in state of the player. The `UpdatePlayerLoginState` helper function we are about to define looks up the `PlayerComponent` row using the user's identity and if it exists, it updates the `LoggedIn` variable and calls the auto-generated `Update` function on `PlayerComponent` to update the row.

**Append to the bottom of lib.cs:**

```csharp
/// Called when the client connects, we update the LoggedIn state to true
[SpacetimeDB.Reducer(ReducerKind.Init)]
public static void ClientConnected(DbEventArgs dbEvent) =>
   UpdatePlayerLoginState(dbEvent, loggedIn:true);
```
```csharp
/// Called when the client disconnects, we update the logged_in state to false
[SpacetimeDB.Reducer(ReducerKind.Disconnect)]
public static void ClientDisonnected(DbEventArgs dbEvent) =>
   UpdatePlayerLoginState(dbEvent, loggedIn:false);
```
```csharp
/// This helper function gets the PlayerComponent, sets the LoggedIn
/// variable and updates the PlayerComponent table row.
private static void UpdatePlayerLoginState(DbEventArgs dbEvent, bool loggedIn)
{
   PlayerComponent? player = PlayerComponent.FindByIdentity(dbEvent.Sender);
   if (player is null)
   {
       throw new ArgumentException("Player not found");
   }

   player.LoggedIn = loggedIn;
   PlayerComponent.UpdateByIdentity(dbEvent.Sender, player);
}
```

Our final reducer handles player movement. In `UpdatePlayerPosition` we look up the `PlayerComponent` using the user's Identity. If we don't find one, we return an error because the client should not be sending moves without calling `CreatePlayer` first.

Using the `EntityId` in the `PlayerComponent` we retrieved, we can lookup the `EntityComponent` that stores the entity's locations in the world. We update the values passed in from the client and call the auto-generated `Update` function.

**Append to the bottom of lib.cs:**

```csharp
/// Updates the position of a player. This is also called when the player stops moving.
[SpacetimeDB.Reducer]
private static void UpdatePlayerPosition(
   DbEventArgs dbEvent,
   StdbVector3 position,
   float direction,
   bool moving)
{
   // First, look up the player using the sender identity
   PlayerComponent? player = PlayerComponent.FindByIdentity(dbEvent.Sender);
   if (player is null)
   {
       throw new ArgumentException("Player not found");
   }
   // Use the Player's EntityId to retrieve and update the EntityComponent
   ulong playerEntityId = player.EntityId;
   EntityComponent? entity = EntityComponent.FindByEntityId(playerEntityId);
   if (entity is null)
   {
       throw new ArgumentException($"Player Entity '{playerEntityId}' not found");
   }
   
   entity.Position = position;
   entity.Direction = direction;
   entity.Moving = moving;
   EntityComponent.UpdateByEntityId(playerEntityId, entity);
}
```

---

**Server Validation**

In a fully developed game, the server would typically perform server-side validation on player movements to ensure they comply with game boundaries, rules, and mechanics. This validation, which we omit for simplicity in this tutorial, is essential for maintaining game integrity, preventing cheating, and ensuring a fair gaming experience. Remember to incorporate appropriate server-side validation in your game's development to ensure a secure and fair gameplay environment.

---

### Publishing a Module to SpacetimeDB

Now that we've written the code for our server module and reached a clean checkpoint, we need to publish it to SpacetimeDB. This will create the database and call the init reducer. In your terminal or command window, run the following commands.

```bash
cd server
spacetime publish -c unity-tutorial
```

If you get any errors from this command, double check that you correctly entered everything into `lib.cs`. You can also look at the [Client Troubleshooting](/docs/unity/part-3.md#Troubleshooting) section.

### Finally, Add Chat Support

The client project has a chat window, but so far, all it's used for is the message of the day. We are going to add the ability for players to send chat messages to each other.

First lets add a new `ChatMessage` table to the SpacetimeDB module. Add the following code to ``lib.cs``.

**Append to the bottom of server/src/lib.cs:**

```csharp
[SpacetimeDB.Table]
public partial class ChatMessage
{
   // The primary key for this table will be auto-incremented
   [SpacetimeDB.Column(ColumnAttrs.PrimaryKeyAuto)]
  
   // The entity id of the player that sent the message
   public ulong SenderId;
  
   // Message contents
   public string? Text;
}
```

Now we need to add a reducer to handle inserting new chat messages.

**Append to the bottom of server/src/lib.cs:**

```csharp
/// Adds a chat entry to the ChatMessage table
[SpacetimeDB.Reducer]
public static void SendChatMessage(DbEventArgs dbEvent, string text)
{
   // Get the player's entity id
   PlayerComponent? player = PlayerComponent.FindByIdentity(dbEvent.Sender);
   if (player is null)
   {
       throw new ArgumentException("Player not found");
   }


   // Insert the chat message
   new ChatMessage
   {
       SenderId = player.EntityId,
       Text = text,
   }.Insert();
}
```

## Wrapping Up

💡View the [entire lib.cs file](https://gist.github.com/dylanh724/68067b4e843ea6e99fbd297fe1a87c49)

Now that we added chat support, let's publish the latest module version to SpacetimeDB, assuming we're still in the `server` dir:

```bash
spacetime publish -c unity-tutorial
```

If you get any errors from this command, double check that you correctly entered everything into `lib.cs`. You can also look at the [Client Troubleshooting](/docs/unity/part-3.md#Troubleshooting) section.

From here, the tutorial continues with more-advanced topics. The [next tutorial](/docs/unity/part-4.md) introduces Resources & Scheduling.


___________________________

# Unity Tutorial - Basic Multiplayer - Part 3 - Client

Need help with the tutorial? [Join our Discord server](https://discord.gg/spacetimedb)!

This progressive tutorial is continued from one of the Part 2 tutorials:

[//]: # (- [Rust Server Module]&#40;/docs/unity/part-2a-rust.md&#41;)
- [C# Server Module](/docs/unity/part-2)

## Updating our Unity Project Client to use SpacetimeDB

Now we are ready to connect our _BitCraft Mini_ project to SpacetimeDB.

### Import the SDK and Generate Module Files

1. Add the SpacetimeDB Unity Package using the Package Manager. Open the Package Manager window by clicking on Window -> Package Manager. Click on the + button in the top left corner of the window and select "Add package from git URL". Enter the following URL and click Add.

```bash
https://github.com/clockworklabs/com.clockworklabs.spacetimedbsdk.git
```

![Unity-PackageManager](/images/unity-tutorial/Unity-PackageManager.JPG)

3. The next step is to generate the module specific client files using the SpacetimeDB CLI. The files created by this command provide an interface for retrieving values from the local client cache of the database and for registering for callbacks to events. In your terminal or command window, run the following commands.

```bash
mkdir -p ../client/Assets/module_bindings
spacetime generate --out-dir ../client/Assets/module_bindings --lang=csharp
```

### Connect to Your SpacetimeDB Module

The Unity SpacetimeDB SDK relies on there being a `NetworkManager` somewhere in the scene. Click on the GameManager object in the scene, and in the inspector, add the `NetworkManager` component.

![Unity-AddNetworkManager](/images/unity-tutorial/Unity-AddNetworkManager.JPG)

Next we are going to connect to our SpacetimeDB module. Open `TutorialGameManager.cs` in your editor of choice and add the following code at the top of the file:

**Append to the top of TutorialGameManager.cs**

```csharp
using SpacetimeDB;
using SpacetimeDB.Types;
using System.Linq;
```

At the top of the class definition add the following members:

**Append to the top of TutorialGameManager class inside of TutorialGameManager.cs**

```csharp
// These are connection variables that are exposed on the GameManager
// inspector.
[SerializeField] private string moduleAddress = "unity-tutorial";
[SerializeField] private string hostName = "localhost:3000";

// This is the identity for this player that is automatically generated
// the first time you log in. We set this variable when the
// onIdentityReceived callback is triggered by the SDK after connecting
private Identity local_identity;
```

The first three fields will appear in your Inspector so you can update your connection details without editing the code. The `moduleAddress` should be set to the domain you used in the publish command. You should not need to change `hostName` if you are using SpacetimeDB locally.

Now add the following code to the `Start()` function. For clarity, replace your entire `Start()` function with the function below.

**REPLACE the Start() function in TutorialGameManager.cs**

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
