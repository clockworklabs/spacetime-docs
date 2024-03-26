# Unity Multiplayer Tutorial - Part 2

# Analyzing the C# Server Module

This progressive tutorial is continued from [Part 1](/docs/unity/part-1.md).

In this part of the tutorial, we will: 

1. Learn core concepts of the C# server module.
2. Review limitations and common practices.
3. Breakdown high-level concepts like Types, Tables, and Reducers. 
4. Breakdown the initialization reducer and chat support from the demo for real-use examples.

The server module will handle the game logic and data management for the game.

💡 Need help? [Join our Discord server](https://discord.gg/spacetimedb)!

## The Entity Component Systems (ECS)

Before we continue to creating the server module, it's important to understand the basics of the ECS. 
This is a game development architecture that separates game objects into components for better flexibility and performance. 
You can read more about the ECS design pattern [here](https://en.wikipedia.org/wiki/Entity_component_system).

We chose ECS for this example project because it promotes scalability, modularity, and efficient data management, 
making it ideal for building multiplayer games with SpacetimeDB.

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

`[Type]` attributes attach to properties containing `[Table]` attributes when you want to use a custom Type that's not [SpacetimeDB natively-supported](../modules/c-sharp#supported-types). These are generally defined as a `partial struct` or `partial class`

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

`[Table]` attributes use `[Type]`s - either custom (like `StdbVector2` above) or [SpacetimeDB natively-supported types](../modules/c-sharp#supported-types). 
These are generally defined as a `struct` or `class`.

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
}
```

- The `Id` vars are `ulong` types, commonly used for SpacetimeDB unique identifiers
- Notice how `Timestamp` is a `string` instead of DateTimeOffset (a limitation mentioned earlier).
  - 💡 We'll demonstrate how to set a timestamp correctly in the next section. 

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
    
    /// Timestamp when movement started.
    /// This is a ISO 8601 format string; see Utils.GetTimestamp()
    public string? MoveStartTimestamp;
}
```

- `EntityId` is the unique identifier for the table, declared as a `ulong`
- Location and Direction are both `StdbVector2` types discussed above
- `MoveStartTimestamp` is a stringified timestamp, as you cannot use `DateTime`-like types within Tables
  - One of the [limitations](#limitations) mentioned earlier


## Reducers

Reducers are static cloud functions with a `[Reducer]` attribute that run on the server. 
These called from the client, always returning `void`. They are defined with the `[Reducer]` attribute and take 
a `DbEventArgs` object as the first argument, followed by any number of arguments that you want to pass to the reducer.

While there are some premade Reducers, such as for init and [dis]connection, you may also create your own.

> [!NOTE]
> In a fully developed game, the server would typically perform server-side validation on client-requested actions to ensure
they comply with game boundaries, rules, and mechanics.

### Overview

Looking at the most straight-forward example, open [Chat.cs](https://github.com/clockworklabs/zeke-demo-project/tree/dylan/feat/mini-upgrade/Server-Csharp/src/Chat.cs):

```c#
/// Add a chat entry to the ChatMessage table
[Reducer]
public static void SendChatMessage(DbEventArgs dbEvent, string text)
{
    // Get the player component based on the sender identity
    PlayerComponent player = PlayerComponent.FindByOwnerId(dbEvent.Sender) ?? 
        Throw<PlayerComponent>($"{nameof(SendChatMessage)} Error: Player not found");

    // Now that we have the player we can insert the chat message
    // using the player entity id.
    new ChatMessage
    {
        ChatEntityId = 0, // This column auto-increments, so we can set it to 0
        SourceEntityId = player.EntityId,
        ChatText = text,
        Timestamp = Utils.Timestamp(dbEvent.Time), // ISO 8601 format)
    }.Insert();
}
```

- Every reducer starts with `[Reducer] public static void Foo(DbEventArgs dbEvent, ...)`.
- Every reducer contains a `DbEventArgs` as the 1st arg.
  - Contains the sender's `Identity`, `DateTimeOffset` sent, and a semi-anonymous `Address` to compare sender vs others.
- The `PlayerComponent` was found by passing the sender's `Identity` to `PlayerComponent.FindByOwnerId()`.
- `Throw<T>()` is the helper function (workaround for one of the [limitations](#limitations) mentioned earlier) that logs an error before throwing.
- This timestamp utilized `Utils.Timestamp()`; an easier-to-remember alias than `dbEvent.Time.ToUniversalTime().ToString("o");`.
- Since `ChatEntityId` is tagged with the `[Column(ColumnAttrs.PrimaryKeyAuto)]` attribute, setting it to 0 will auto-increment.

### DB Initialization

Let's find the entry point that gets called every time we **publish** or **clear** the database: 
Open [Lib.cs](https://github.com/clockworklabs/zeke-demo-project/tree/dylan/feat/mini-upgrade/Server-Csharp/src/Lib.cs):

> [!TIP]
> Not to be confused with the `Connect` ReducerKind for **player** initialization!

```csharp
/// Initial configuration for the game world.
/// Called when the module is initially published.
[Reducer(ReducerKind.Init)]
public static void Init()
{
    try
    {
        Config config = initConfig(); // Create our global config table.
        
        spawnRocks(config, spawnCount: 10);
        List<UnlockInfo> unlocks = initUnlocks();
        ShopComponent shopComponent = getInitShopComponent(unlocks);
        initItemCatalog();
        SpawnShop(shopComponent, requiredUnlock: null);
        initResourceSpawners();
    }
    catch (Exception e)
    {
        Throw<Exception>($"{nameof(Init)} Error: {e.Message}");
    }
}
```

While this is very high-level, **this is what's happening:**

1. We init the Config table, treating it as a singleton (there's only 1 Config at row `0`).
2. We spawn rocks into the world.
3. We create an unlockable and init our shop with these in-mind.
4. We init the item catalog, containing static metadata for the items, such as names<>ids.
5. We init our resource spawners, using the [Scheduler](https://spacetimedb.com/docs/modules/c-sharp#reducers) to spawn our common and uncommon resources.
    - For the common ones, we initially schedule them to fire almost-immediately.
    - When the scheduler function fires, we **re**schedule them to infinitely call upon itself in intervals.

### Other Premade Reducers

- `[Reducer(ReducerKind.Connect)]` - Their `Identity` can be found in the `Sender` value of the `DbEventArgs`.
- `[Reducer(ReducerKind.Disconnect)]`
- `[Reducer(ReducerKind.Update)]` - Not to be confused with Unity-style Update loops, this calls when a `[Table]` row is updated.


## Wrapping Up

💡View the [entire lib.cs file](https://gist.github.com/dylanh724/68067b4e843ea6e99fbd297fe1a87c49)

Now that we added chat support, let's publish the latest module version to SpacetimeDB, assuming we're still in the `server` dir:

```bash
spacetime publish -c unity-tutorial
```

## Conclusion

You have now learned the core concepts of the C# server module, reviewed limitations and common practices 
and broke down high-level concepts like Types, Tables, and Reducers with real examples from the demo.

In the next section, we will break down the client-side code and analyze the Unity demo code.