# Unity Multiplayer Tutorial - Part 2

## Analyzing the C# Server Module

This progressive tutorial is continued from [Part 1](part-11.md).

In this part of the tutorial, we will create a SpacetimeDB (SpacetimeDB) server module using C# for the Unity multiplayer game. The server module will handle the game logic and data management for the game.

💡 Need help? [Join our Discord server](https://discord.gg/spacetimedb)!

## The Entity Component Systems (ECS)

Before we continue to creating the server module, it's important to understand the basics of the ECS. This is a game development architecture that separates game objects into components for better flexibility and performance. You can read more about the ECS design pattern [here](https://en.wikipedia.org/wiki/Entity_component_system).

We chose ECS for this example project because it promotes scalability, modularity, and efficient data management, making it ideal for building multiplayer games with SpacetimeDB.

## C# Module Limitations & Nuances

Since SpacetimeDB runs on [WebAssembly (WASM)](https://webassembly.org/), you may run into unexpected issues until aware of the following:

1. No DateTime-like types in Types or Tables:
    - Use `string` for timestamps (exampled at [Utils.cs](https://github.com/clockworklabs/zeke-demo-project/tree/dylan/feat/mini-upgrade/Server-Csharp/src/Utils.cs)), or `long` for Unix Epoch time.

2. No Timers or async/await, such as those to create repeating loops:
    - For repeating invokers, instead **re**schedule it from within a fired [Scheduler](https://spacetimedb.com/docs/modules/c-sharp#reducers) function.

3. Using `Debug` advanced option in the `Publisher` Unity editor tool will add callstack symbols for easier debugging:
    - However, avoid using `Debug` mode when publishing outside a `localhost` server:
        - Due to WASM buffer size limitations, this may cause publish failure.

4. If you `throw` a new `Exception`, no error logs will appear. Instead, use either:
    1. Use `Log(message, LogLevel.Error);` before you throw.
    2. Use the demo's static [Utils.cs](https://github.com/clockworklabs/zeke-demo-project/tree/dylan/feat/mini-upgrade/Server-Csharp/src/Utils.cs) class to `Utils.Throw()` to wrap the error log before throwing.

5. `[AutoIncrement]` or `[PrimaryKeyAuto]` will never equal 0:
    - Inserting a new row with an Auto key equaling 0 will always return a unique, non-0 value.
    -
6. Enums cannot declare values out of the default order:
    - For example, `{ Foo = 0, Bar = 3 }` will fail to compile.

## Namespaces

Common `using` statements include:

```csharp
using SpacetimeDB; // Contains class|func|struct attributes like [Table], [Type], [Reducer]
using static SpacetimeDB.Runtime; // Contains Identity DbEventArgs, Log()
using SpacetimeDB.Module; // Contains prop attributes like [Column]
using Module.Utils; // Helper to workaround the `throw` and `DateTime` limitations noted above 
```

- You will mostly see `SpacetimeDB.Module` in [Tables.cs](https://github.com/clockworklabs/zeke-demo-project/tree/dylan/feat/mini-upgrade/Server-Csharp/src/Tables.cs) for schema definitions
- `SpacetimeDB` and `SpacetimeDB.Runtime` can be found in most all SpacetimeDB scripts
- `Module.Utils` parse DateTimeOffset into a timestamp string and wraps `throw` with error logs

## Partial Classes & Structs

- Throughout the demo, you will notice most classes or structs with a SpacetimeDB [Attribute] such as `[Table]` or `[Reducer]` will be defined with the `partial` keyword. 

- This allows the _Roslyn Compiler_ to [incrementally generate](https://github.com/dotnet/roslyn/blob/main/docs/features/incremental-generators.md) additions to the SpacetimeDB SDK, such as adding helper functions and utilities. This means SpacetimeDB takes care of all the low-level tooling for you, such as inserting, updating or querying the DB.
  - This further allows you to separate your models from logic within the same class.

* Notice that the module class, itself, is also a `static partial class`.

## Types & Tables

`[Table]` attributes are database columns, while `[Type]` attributes are define a schema.

### Types

`[Type]` attributes attach to properties containing `[Table]` attributes when you want to use a custom Type that's not [SpacetimeDB natively-supported](c-sharp#supported-types.). These are generally defined as a `partial struct` or `partial class`

Let's inspect a real example `Type`; open [Server-cs/Tables.cs](https://github.com/clockworklabs/zeke-demo-project/tree/dylan/feat/mini-upgrade/Server-Csharp/src/Tables.cs):

In Unity, you are likely familiar with the `Vector2` type. In SpacetimeDB, let's inspect the `StdbVector2` type to store 2D positions in the database:

```csharp
/// A spacetime type which can be used in tables & reducers to represent a 2D position (such as movement)
[Type]
public partial class StdbVector2
{
  public float X;
  public float Z;

  // This allows us to use StdbVector2::ZERO in reducers
  public static readonly StdbVector2 ZERO = new()
  {
      X = 0, 
      Z = 0,
  };
}
```

- Since `Types` are used in `Tables`, we can now use a custom SpacetimeDB `StdbVector3` `Type` in a `[Table]`.

We may optionally include `static readonly` property "helper" functions such as the above-exampled `ZERO`.

### Tables

`[Table] attributes use `[Type]`s - either custom (like `StdbVector2` above) or [SpacetimeDB natively-supported types](../modules/c-sharp#supported-types). These are generally defined as a `struct` or `class`

Let's inspect a real example `Table`, looking again at [Tables.cs](https://github.com/clockworklabs/zeke-demo-project/tree/dylan/feat/mini-upgrade/Server-Csharp/src/Tables.cs):

```csharp
/// Represents chat messages within the game, including the sender and message content
[Table]
public partial class ChatMessage
{
    /// Primary key, automatically incremented
    [Column(ColumnAttrs.PrimaryKeyAuto)]
    public ulong ChatEntityId;

    /// The entity id of the player (or NPC) that sent the message
    public ulong SourceEntityId;
    
    /// Message contents
    public string? ChatText;
    
    /// <returns>
    /// Stringified ISO 8601 format (Unix Epoch Time)
    /// <code>
    /// DateTime.ToUniversalTime().ToString("o");
    /// </code></returns>
    public static string GetTimestamp(DateTimeOffset dateTimeOffset) =>
        dateTimeOffset.ToUniversalTime().ToString("o");
}
```

- The `Id` vars are `ulong` types, commonly used for SpacetimeDB unique identifiers
- Notice how `Timestamp` is a `string` instead of DateTimeOffset (a limitation mentioned earlier).

```csharp
/// This component will be created for all world objects that can move smoothly throughout the world,  keeping track 
/// of position, the last time the component was updated & the direction the mobile object is currently moving.
[Table]
public partial class MobileEntityComponent
{
    /// Primary key for the mobile entity
    [Column(ColumnAttrs.PrimaryKey)]
    public ulong EntityId;

    /// The last known location of this entity
    public StdbVector2? Location;
    
    /// Movement direction, {0,0} if not moving at all.
    public StdbVector2? Direction;
    
    /// Timestamp when movement started. Timestamp::UNIX_EPOCH if not moving.
    public string? MoveStartTimestamp;
}
```

**Let's break this down:**

- `EntityId` is the unique identifier for the table, declared as a `ulong`
- Location and Direction are both `StdbVector2` types discussed above
- `MoveStartTimestamp` is a string of epoch time, as you cannot use `DateTime`-like types within Tables.
  - See the [Limitations](#limitations.) section below

## Reducers

Reducers are cloud functions that run on the server and can be called from the client, always returning `void`.

Looking at the most straight-forward example, open [Chat.cs](







```csharp

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

Using the `EntityId` in the `PlayerComponent` we retrieved, we can look up the `EntityComponent` that stores the entity's locations in the world. We update the values passed in from the client and call the auto-generated `Update` function.

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

If you get any errors from this command, double check that you correctly entered everything into `lib.cs`. You can also look at the [Client Troubleshooting](part-3.md#Troubleshooting) section.

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

If you get any errors from this command, double check that you correctly entered everything into `lib.cs`. You can also look at the [Client Troubleshooting](part-3.md#Troubleshooting) section.

From here, the tutorial continues with more-advanced topics. The [next tutorial](part-41.md) introduces Resources & Scheduling.
