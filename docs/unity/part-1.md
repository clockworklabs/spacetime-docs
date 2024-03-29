# Part 1 - Basic Multiplayer

![UnityTutorial-HeroImage](/images/unity-tutorial/UnityTutorial-HeroImage.JPG)

Need help with the tutorial? [Join our Discord server](https://discord.gg/spacetimedb)!

The objective of this tutorial is to help you become acquainted with the basic features of SpacetimeDB. By the end of this tutorial you should have a basic understanding of what SpacetimeDB offers for developers making multiplayer games. It assumes that you have a basic understanding of the Unity Editor, using a command line terminal, and coding.

In this tutorial we'll be giving you some CLI commands to execute. If you are using Windows we recommend using Git Bash or powershell. If you're on mac we recommend you use the Terminal application. If you encouter issues with any of the commands in this guide, please reach out to us through our discord server and we would be happy to help assist you.

This tutorial has been tested against UnityEngine version 2022.3.4f1. This tutorial may work on newer versions as well.

## Prepare Project Structure

This project is separated into two sub-projects;

1. Server (module) code 
2. Client code

First, we'll create a project root directory (you can choose the name):

```bash
mkdir SpacetimeDBUnityTutorial
cd SpacetimeDBUnityTutorial
```

We'll start by populating the client directory.

## Setting up the Tutorial Unity Project

In this section, we will guide you through the process of setting up a Unity Project that will serve as the starting point for our tutorial. By the end of this section, you will have a basic Unity project and be ready to implement the server functionality.

### Step 1: Create a Blank Unity Project

Open Unity and create a new project by selecting "New" from the Unity Hub or going to **File -> New Project**.

![UnityHub-NewProject](/images/unity-tutorial/UnityHub-NewProject.JPG)

**⚠️ Important: Ensure `3D (URP)` is selected** to properly render the materials in the scene!

For Project Name use `client`. For Project Location make sure that you use your `SpacetimeDBUnityTutorial` directory. This is the directory that we created in a previous step.

![UnityHub-3DURP](/images/unity-tutorial/UnityHub-3DURP.JPG)

Click "Create" to generate the blank project.

### Step 2: Adding Required Packages

To work with SpacetimeDB and ensure compatibility, we need to add some essential packages to our Unity project. Follow these steps:

1. Open the Unity Package Manager by going to **Window -> Package Manager**.
2. In the Package Manager window, select the "Unity Registry" tab to view unity packages.
3. Search for and install the following package:
   - **Input System**: Enables the use of Unity's new Input system used by this project.

![PackageManager-InputSystem](/images/unity-tutorial/PackageManager-InputSystem.JPG)

4. You may need to restart the Unity Editor to switch to the new Input system.

![PackageManager-Restart](/images/unity-tutorial/PackageManager-Restart.JPG)

### Step 3: Importing the Tutorial Package

In this step, we will import the provided Unity tutorial package that contains the basic single-player game setup. Follow these instructions:

1. Download the tutorial package from the releases page on GitHub: [https://github.com/clockworklabs/com.clockworklabs.spacetimedbsdk/releases/latest](https://github.com/clockworklabs/com.clockworklabs.spacetimedbsdk/releases/latest)
2. In Unity, go to **Assets -> Import Package -> Custom Package**.

![Unity-ImportCustomPackageB](/images/unity-tutorial/Unity-ImportCustomPackageB.JPG)

3. Browse and select the downloaded tutorial package file.
4. Unity will prompt you with an import settings dialog. Ensure that all the files are selected and click "Import" to import the package into your project.
5. At this point in the project, you shouldn't have any errors.

![Unity-ImportCustomPackage2](/images/unity-tutorial/Unity-ImportCustomPackage2.JPG)

### Step 4: Running the Project

Now that we have everything set up, let's run the project and see it in action:

1. Open the scene named "Main" in the Scenes folder provided in the project hierarchy by double-clicking it.

![Unity-OpenSceneMain](/images/unity-tutorial/Unity-OpenSceneMain.JPG)

**NOTE:** When you open the scene you may get a message saying you need to import TMP Essentials. When it appears, click the "Import TMP Essentials" button.

🧹 Clear any false-positive TMPro errors that may show.

![Unity Import TMP Essentials](/images/unity-tutorial/Unity-ImportTMPEssentials.JPG)

2. Press the **Play** button located at the top of the Unity Editor.

![Unity-Play](/images/unity-tutorial/Unity-Play.JPG)

3. Enter any name and click "Continue"

4. You should see a character loaded in the scene, and you can use the keyboard or mouse controls to move the character around.

Congratulations! You have successfully set up the basic single-player game project. In the next section, we will start integrating SpacetimeDB functionality to enable multiplayer features.

## Writing our SpacetimeDB Server Module

At this point you should have the single player game working. In your CLI, your current working directory should be within your `SpacetimeDBUnityTutorial` directory that we created in a previous step.

### Create the Module

1. It is important that you already have the SpacetimeDB CLI tool [installed](/install).

2. Run SpacetimeDB locally using the installed CLI. In a **new** terminal or command window, run the following command:

```bash
spacetime start
```

💡 Standalone mode will run in the foreground.
💡 Below examples Rust language, [but you may also use C#](../modules/c-sharp/index.md). 

3. Run the following command to initialize the SpacetimeDB server project with Rust as the language:

```bash
spacetime init --lang=rust server
```

This command creates a new folder named "server" within your Unity project directory and sets up the SpacetimeDB server project with Rust as the programming language.

### Understanding Entity Component Systems

Entity Component System (ECS) is a game development architecture that separates game objects into components for better flexibility and performance. You can read more about the ECS design pattern [here](https://en.wikipedia.org/wiki/Entity_component_system).

We chose ECS for this example project because it promotes scalability, modularity, and efficient data management, making it ideal for building multiplayer games with SpacetimeDB.

### SpacetimeDB Tables

In this section we'll be making some edits to the file `server/src/lib.rs`. We recommend you open up this file in an IDE like VSCode or RustRover.

**Important: Open the `server/src/lib.rs` file and delete its contents. We will be writing it from scratch here.**

First we need to add some imports at the top of the file.

**Copy and paste into lib.rs:**

```rust
use spacetimedb::{spacetimedb, Identity, SpacetimeType, ReducerContext};
use log;
```

Then we are going to start by adding the global `Config` table. Right now it only contains the "message of the day" but it can be extended to store other configuration variables. This also uses a couple of macros, like `#[spacetimedb(table)]` which you can learn more about in our rust module reference. Simply put, this just tells SpacetimeDB to create a table which uses this struct as the schema for the table.

**Append to the bottom of lib.rs:**

```rust
// We're using this table as a singleton, so there should typically only be one element where the version is 0.
#[spacetimedb(table)]
#[derive(Clone)]
pub struct Config {
    #[primarykey]
    pub version: u32,
    pub message_of_the_day: String,
}
```

Next we're going to define a new `SpacetimeType` called `StdbVector3` which we're going to use to store positions. The difference between a `#[derive(SpacetimeType)]` and a `#[spacetimedb(table)]` is that tables actually store data, whereas the deriving `SpacetimeType` just allows you to create a new column of that type in a SpacetimeDB table. So therefore, `StdbVector3` is not itself a table.

**Append to the bottom of lib.rs:**

```rust
// This allows us to store 3D points in tables.
#[derive(SpacetimeType, Clone)]
pub struct StdbVector3 {
    pub x: f32,
    pub y: f32,
    pub z: f32,
}
```

Now we're going to create a table which actually uses the `StdbVector3` that we just defined. The `EntityComponent` is associated with all entities in the world, including players.

```rust
// This stores information related to all entities in our game. In this tutorial
// all entities must at least have an entity_id, a position, a direction and they
// must specify whether or not they are moving.
#[spacetimedb(table)]
#[derive(Clone)]
pub struct EntityComponent {
    #[primarykey]
    // The autoinc macro here just means every time we insert into this table
    // we will receive a new row where this value will be increased by one. This
    // allows us to easily get rows where `entity_id` is unique.
    #[autoinc]
    pub entity_id: u64,
    pub position: StdbVector3,
    pub direction: f32,
    pub moving: bool,
}
```

Next we will define the `PlayerComponent` table. The `PlayerComponent` table is used to store information related to players. Each player will have a row in this table, and will also have a row in the `EntityComponent` table with a matching `entity_id`. You'll see how this works later in the `create_player` reducer.

**Append to the bottom of lib.rs:**

```rust
// All players have this component and it associates an entity with the user's 
// Identity. It also stores their username and whether or not they're logged in.
#[derive(Clone)]
#[spacetimedb(table)]
pub struct PlayerComponent {
    // An entity_id that matches an entity_id in the `EntityComponent` table.
    #[primarykey]
    pub entity_id: u64,
    // The user's identity, which is unique to each player
    #[unique]
    pub owner_id: Identity,
    pub username: String,
    pub logged_in: bool,
}
```

Next we write our very first reducer, `create_player`. From the client we will call this reducer when we create a new player:

**Append to the bottom of lib.rs:**

```rust
// This reducer is called when the user logs in for the first time and
// enters a username
#[spacetimedb(reducer)]
pub fn create_player(ctx: ReducerContext, username: String) -> Result<(), String> {
    // Get the Identity of the client who called this reducer
    let owner_id = ctx.sender;

    // Make sure we don't already have a player with this identity
    if PlayerComponent::filter_by_owner_id(&owner_id).is_some() {
        log::info!("Player already exists");
        return Err("Player already exists".to_string());
    }

    // Create a new entity for this player and get a unique `entity_id`.
    let entity_id = EntityComponent::insert(EntityComponent 
    { 
        entity_id: 0, 
        position: StdbVector3 { x: 0.0, y: 0.0, z: 0.0 },
        direction: 0.0,
        moving: false,
    }).expect("Failed to create a unique PlayerComponent.").entity_id;

    // The PlayerComponent uses the same entity_id and stores the identity of
    // the owner, username, and whether or not they are logged in.
    PlayerComponent::insert(PlayerComponent {
        entity_id,
        owner_id,
        username: username.clone(),
        logged_in: true,
    }).expect("Failed to insert player component.");

    log::info!("Player created: {}({})", username, entity_id);

    Ok(())
}
```

---

**SpacetimeDB Reducers**

"Reducer" is a term coined by Clockwork Labs that refers to a function which when executed "reduces" into a list of inserts and deletes, which is then packed into a single database transaction. Reducers can be called remotely using the CLI or a client SDK or they can be scheduled to be called at some future time from another reducer call.

---

SpacetimeDB gives you the ability to define custom reducers that automatically trigger when certain events occur.

- `init` - Called the first time you publish your module and anytime you clear the database. We'll learn about publishing later.
- `connect` - Called when a user connects to the SpacetimeDB module. Their identity can be found in the `sender` value of the `ReducerContext`.
- `disconnect` - Called when a user disconnects from the SpacetimeDB module.

Next we are going to write a custom `init` reducer that inserts the default message of the day into our `Config` table. The `Config` table only ever contains a single row with version 0, which we retrieve using `Config::filter_by_version(0)`.

**Append to the bottom of lib.rs:**

```rust
// Called when the module is initially published
#[spacetimedb(init)]
pub fn init() {
    Config::insert(Config {
        version: 0,
        message_of_the_day: "Hello, World!".to_string(),
    }).expect("Failed to insert config.");
}
```

We use the `connect` and `disconnect` reducers to update the logged in state of the player. The `update_player_login_state` helper function looks up the `PlayerComponent` row using the user's identity and if it exists, it updates the `logged_in` variable and calls the auto-generated `update` function on `PlayerComponent` to update the row.

**Append to the bottom of lib.rs:**

```rust
// Called when the client connects, we update the logged_in state to true
#[spacetimedb(connect)]
pub fn client_connected(ctx: ReducerContext) {
    update_player_login_state(ctx, true);
}


// Called when the client disconnects, we update the logged_in state to false
#[spacetimedb(disconnect)]
pub fn client_disconnected(ctx: ReducerContext) {
    update_player_login_state(ctx, false);
}

// This helper function gets the PlayerComponent, sets the logged
// in variable and updates the PlayerComponent table row.
pub fn update_player_login_state(ctx: ReducerContext, logged_in: bool) {
    if let Some(player) = PlayerComponent::filter_by_owner_id(&ctx.sender) {
        // We clone the PlayerComponent so we can edit it and pass it back.
        let mut player = player.clone();
        player.logged_in = logged_in;
        PlayerComponent::update_by_entity_id(&player.entity_id.clone(), player);
    }
}
```

Our final reducer handles player movement. In `update_player_position` we look up the `PlayerComponent` using the user's Identity. If we don't find one, we return an error because the client should not be sending moves without calling `create_player` first.

Using the `entity_id` in the `PlayerComponent` we retrieved, we can lookup the `EntityComponent` that stores the entity's locations in the world. We update the values passed in from the client and call the auto-generated `update` function.

**Append to the bottom of lib.rs:**

```rust
// Updates the position of a player. This is also called when the player stops moving.
#[spacetimedb(reducer)]
pub fn update_player_position(
    ctx: ReducerContext,
    position: StdbVector3,
    direction: f32,
    moving: bool,
) -> Result<(), String> {
    // First, look up the player using the sender identity, then use that
    // entity_id to retrieve and update the EntityComponent
    if let Some(player) = PlayerComponent::filter_by_owner_id(&ctx.sender) {
        if let Some(mut entity) = EntityComponent::filter_by_entity_id(&player.entity_id) {
            entity.position = position;
            entity.direction = direction;
            entity.moving = moving;
            EntityComponent::update_by_entity_id(&player.entity_id, entity);
            return Ok(());
        }
    }

    // If we can not find the PlayerComponent or EntityComponent for 
    // this player then something went wrong.
    return Err("Player not found".to_string());
}
```

---

**Server Validation**

In a fully developed game, the server would typically perform server-side validation on player movements to ensure they comply with game boundaries, rules, and mechanics. This validation, which we omit for simplicity in this tutorial, is essential for maintaining game integrity, preventing cheating, and ensuring a fair gaming experience. Remember to incorporate appropriate server-side validation in your game's development to ensure a secure and fair gameplay environment.

---

### Publishing a Module to SpacetimeDB

Now that we've written the code for our server module, we need to publish it to SpacetimeDB. This will create the database and call the init reducer. In your terminal or command window, run the following commands.

```bash
cd server
spacetime publish -c unity-tutorial
```

If you get any errors from this command, double check that you correctly entered everything into `lib.rs`. You can also look at the Troubleshooting section at the end of this tutorial.

## Updating our Unity Project to use SpacetimeDB

Now we are ready to connect our bitcraft mini project to SpacetimeDB.

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
        // FilterByEntityId is normally nullable, but we'll assume not null for simplicity
        PlayerComponent playerComp = PlayerComponent.FilterByEntityId(EntityId).First();

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

Next, we will add a `FixedUpdate()` function to the `LocalPlayer` class so that we can send the local player's position to SpacetimeDB. We will do this by calling the auto-generated reducer function `Reducer.UpdatePlayerPosition(...)`. When we invoke this reducer from the client, a request is sent to SpacetimeDB and the reducer `update_player_position(...)` is executed on the server and a transaction is produced. All clients connected to SpacetimeDB will start receiving the results of these transactions.

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

### Finally, Add Chat Support

The project has a chat window but so far all it's used for is the message of the day. We are going to add the ability for players to send chat messages to each other.

First lets add a new `ChatMessage` table to the SpacetimeDB module. Add the following code to ``lib.rs``.

**Append to the bottom of server/src/lib.rs:**

```rust
#[spacetimedb(table)]
pub struct ChatMessage {
    // The primary key for this table will be auto-incremented
    #[primarykey]
    #[autoinc]
    pub message_id: u64,

    // The entity id of the player that sent the message
    pub sender_id: u64,
    // Message contents
    pub text: String,
}
```

Now we need to add a reducer to handle inserting new chat messages.

**Append to the bottom of server/src/lib.rs:**

```rust
// Adds a chat entry to the ChatMessage table
#[spacetimedb(reducer)]
pub fn send_chat_message(ctx: ReducerContext, text: String) -> Result<(), String> {
    if let Some(player) = PlayerComponent::filter_by_owner_id(&ctx.sender) {
        // Now that we have the player we can insert the chat message using the player entity id.
        ChatMessage::insert(ChatMessage {
            // this column auto-increments so we can set it to 0
            message_id: 0,
            sender_id: player.entity_id,
            text,
        })
        .unwrap();

        return Ok(());
    }

    Err("Player not found".into())
}
```

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

This concludes the first part of the tutorial. We've learned about the basics of SpacetimeDB and how to use it to create a multiplayer game. In the next part of the tutorial we will add resource nodes to the game and learn about scheduled reducers.

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
