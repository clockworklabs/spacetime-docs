# SpacetimeDB C# Modules

You can use the [C# SpacetimeDB library](https://github.com/clockworklabs/SpacetimeDBLibCSharp) to write modules in C# which interact with the SpacetimeDB database.

It uses [Roslyn incremental generators](https://github.com/dotnet/roslyn/blob/main/docs/features/incremental-generators.md) to add extra static methods to types, tables and reducers marked with special attributes and registers them with the database runtime.

## Example

Let's start with a heavily commented version of the default example from the landing page:

```csharp
// These imports bring into the scope common APIs you'll need to expose items from your module and to interact with the database runtime.
using SpacetimeDB;

// Roslyn generators are statically generating extra code as-if they were part of the source tree, so,
// in order to inject new methods, types they operate on as well as their parents have to be marked as `partial`.
//
// We start with the top-level `Module` class for the module itself.
public static partial class Module
{
    // `[SpacetimeDB.Table]` registers a struct or a class as a SpacetimeDB table.
    //
    // It generates methods to insert, filter, update, and delete rows of the given type in the table.
    [SpacetimeDB.Table(Public = true)]
    public partial struct Person
    {
        // SpacetimeDB allows you to specify column attributes / constraints such as
        // "this field should be unique" or "this field should get automatically assigned auto-incremented value".
        [SpacetimeDB.Unique]
        [SpacetimeDB.AutoInc]
        public int Id;
        public string Name;
        public int Age;
    }

    // `[SpacetimeDB.Reducer]` marks a static method as a SpacetimeDB reducer.
    //
    // Reducers are functions that can be invoked from the database runtime.
    // They can't return values, but can throw errors that will be caught and reported back to the runtime.
    [SpacetimeDB.Reducer]
    public static void Add(ReducerContext ctx, string name, int age)
    {
        // We can skip (or explicitly set to zero) auto-incremented fields when creating new rows.
        var person = new Person { Name = name, Age = age };

        // `Insert()` method is auto-generated and will insert the given row into the table.
        ctx.Db.Person.Insert(person);
        // After insertion, the auto-incremented fields will be populated with their actual values.
        //
        // `Log` class is provided by the runtime and will print messages to the database log.
        // It should be used instead of `Console.WriteLine()` or similar functions.
        Log.Info($"Inserted {person.Name} under #{person.Id}");
    }

    [SpacetimeDB.Reducer]
    public static void SayHello(ReducerContext ctx)
    {
        // Each table type gets a static Iter() method that can be used to iterate over the entire table.
        foreach (var person in ctx.Db.Person.Iter())
        {
            Log.Info($"Hello, {person.Name}!");
        }
        Log.Info("Hello, World!");
    }
}
```

## API reference

Now we'll get into details on all the APIs SpacetimeDB provides for writing modules in C#.

### Logging

First of all, logging as we're likely going to use it a lot for debugging and reporting errors.

`SpacetimeDB` provides a `Log` class that will print messages to the database log, along with the source location and a log level it was provided.

Supported log levels are provided by different methods on the `Log` class:

```csharp
public static void Trace(string message);
public static void Debug(string message);
public static void Info(string message);
public static void Warn(string message);
public static void Error(string message);
public static void Exception(string message);
```

You should use `Log.Info` by default.

### Supported types

#### Built-in types

The following types are supported out of the box and can be stored in the database tables directly or as part of more complex types:

- `bool`
- `byte`, `sbyte`
- `short`, `ushort`
- `int`, `uint`
- `long`, `ulong`
- `float`, `double`
- `string`
- [`Int128`](https://learn.microsoft.com/en-us/dotnet/api/system.int128), [`UInt128`](https://learn.microsoft.com/en-us/dotnet/api/system.uint128)
- `T[]` - arrays of supported values.
- [`List<T>`](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1)
- [`Dictionary<TKey, TValue>`](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.dictionary-2)

And a couple of special custom types:

- `SpacetimeDB.Unit` - semantically equivalent to an empty struct, sometimes useful in generic contexts where C# doesn't permit `void`.
- `Identity` (`SpacetimeDB.Identity`) - a unique identifier for each user; internally a byte blob but can be printed, hashed and compared for equality.
- `Address` (`SpacetimeDB.Address`) - an identifier which disamgibuates connections by the same `Identity`; internally a byte blob but can be printed, hashed and compared for equality.

#### Custom types

`[SpacetimeDB.Type]` attribute can be used on any `struct`, `class` or an `enum` to mark it as a SpacetimeDB type. It will implement serialization and deserialization for values of this type so that they can be stored in the database.

Any `struct` or `class` marked with this attribute, as well as their respective parents, must be `partial`, as the code generator will add methods to them.

```csharp
[SpacetimeDB.Type]
public partial struct Point
{
    public int x;
    public int y;
}
```

`enum`s marked with this attribute must not use custom discriminants, as the runtime expects them to be always consecutive starting from zero. Unlike structs and classes, they don't use `partial` as C# doesn't allow to add methods to `enum`s.

```csharp
[SpacetimeDB.Type]
public enum Color
{
    Red,
    Green,
    Blue,
}
```

#### Tagged enums

SpacetimeDB has support for tagged enums which can be found in languages like Rust, but not C#.

We provide a tagged enum support for C# modules via a special `record SpacetimeDB.TaggedEnum<(...types and names of the variants as a tuple...)>`.

When you inherit from the `SpacetimeDB.TaggedEnum` marker, it will generate variants as subclasses of the annotated type, so you can use regular C# pattern matching operators like `is` or `switch` to determine which variant a given tagged enum holds at any time.

For unit variants (those without any data payload) you can use a built-in `SpacetimeDB.Unit` as the variant type.

Example:

```csharp
// Define a tagged enum named `MyEnum` with three variants,
// `MyEnum.String`, `MyEnum.Int` and `MyEnum.None`.
[SpacetimeDB.Type]
public partial record MyEnum : SpacetimeDB.TaggedEnum<(
    string String,
    int Int,
    SpacetimeDB.Unit None
)>;

// Print an instance of `MyEnum`, using `switch`/`case` to determine the active variant.
void PrintEnum(MyEnum e)
{
    switch (e)
    {
        case MyEnum.String(var s):
            Console.WriteLine(s);
            break;

        case MyEnum.Int(var i):
            Console.WriteLine(i);
            break;

        case MyEnum.None:
            Console.WriteLine("(none)");
            break;
    }
}

// Test whether an instance of `MyEnum` holds some value (either a string or an int one).
bool IsSome(MyEnum e) => e is not MyEnum.None;

// Construct an instance of `MyEnum` with the `String` variant active.
var myEnum = new MyEnum.String("Hello, world!");
Log.Info($"IsSome: {IsSome(myEnum)}");
PrintEnum(myEnum);
```

### Tables

`[SpacetimeDB.Table]` attribute can be used on any `struct` or `class` to mark it as a SpacetimeDB table. It will register a table in the database with the given name and fields as well as will generate C# methods to insert, filter, update, and delete rows of the given type.
By default, tables are **private**. This means that they are only readable by the table owner, and by server module code.
Adding `[SpacetimeDB.Table(Public = true))]` annotation makes a table public. **Public** tables are readable by all users, but can still only be modified by your server module code.

_Coming soon: We plan to add much more robust access controls than just public or private. Stay tuned!_

It implies `[SpacetimeDB.Type]`, so you must not specify both attributes on the same type.

```csharp
[SpacetimeDB.Table(Public = true)]
public partial struct Person
{
    [SpacetimeDB.PrimaryKey]
    [SpacetimeDB.AutoInc]
    public int Id;
    public string Name;
    public int Age;
}
```

The example above will generate the following extra methods:

```csharp
public partial class ReducerCtx.Db.Person
{
    // Inserts current instance as a new row into the table.
    public void Insert(Person row);

    // Deletes current instance from the table
    public void Delete(Person row);

    // Gets the number of rows in the table
    public ulong Count { get { ... } };

    // Returns an iterator over all rows in the table, e.g.:
    // `for (var person in Person.Iter()) { ... }`
    public IEnumerable<Person> Iter();

    // Generated for each unique column:
    public static partial class Id {
        // Find a `Person` based on `id == $key`
        public Person? Find(int key);

        // Delete a row by `key` on the row
        public bool Delete(int key);

        // Update based on the `id` of the row
        public bool Update(Person row);
    }
}
```

#### Column attributes

Attribute `[SpacetimeDB.Column]` can be used on any field of a `SpacetimeDB.Table`-marked `struct` or `class` to customize column attributes as seen above.

The supported column attributes are:

- `SpacetimeDB.AutoInc` - this column should be auto-incremented.
- `SpacetimeDB.Unique` - this column should be unique.
- `SpacetimeDB.PrimaryKey` - this column should be a primary key, it implies `SpacetimeDB.Unique` but also allows clients to subscribe to updates via `OnUpdate` which will use this field to match the old and the new version of the row with each other.
- 
### Reducers

Attribute `[SpacetimeDB.Reducer]` can be used on any `public static void` method to register it as a SpacetimeDB reducer. The method must accept only supported types as arguments. If it throws an exception, those will be caught and reported back to the database runtime.

```csharp
[SpacetimeDB.Reducer]
public static void Add(ReducerContext ctx, string name, int age)
{
    var person = new Person { Name = name, Age = age };
    ctx.Db.Person.Insert(person);
    Log.Info($"Inserted {person.Name} under #{person.Id}");
}
```

If a reducer has an argument with a type `ReducerContext` (`SpacetimeDB.ReducerContext`), it will be provided with event details such as the sender identity (`SpacetimeDB.Identity`), sender address (`SpacetimeDB.Address?`) and the time (`DateTimeOffset`) of the invocation:

```csharp
[SpacetimeDB.Reducer]
public static void PrintInfo(ReducerContext ctx)
{
    Log.Info($"Sender identity: {ctx.CallerIdentity}");
    Log.Info($"Sender address: {ctx.CallerAddress}");
    Log.Info($"Time: {ctx.Timestamp}");
}
```

### Scheduler Tables

Tables can be used to schedule a reducer calls either at a specific timestamp or at regular intervals.

```csharp
public static partial class Timers
{

    // The `Scheduled` attribute links this table to a reducer.
    [SpacetimeDB.Table(Scheduled = nameof(SendScheduledMessage))]
    public partial struct SendMessageTimer
    {
        public string Text;
    }


    // Define the reducer that will be invoked by the scheduler table.
    // The first parameter is always `ReducerContext`, and the second parameter is an instance of the linked table struct.
    [SpacetimeDB.Reducer]
    public static void SendScheduledMessage(ReducerContext ctx, SendMessageTimer arg)
    {
        // ...
    }


    // Scheduling reducers inside `init` reducer.
    [SpacetimeDB.Reducer(ReducerKind.Init)]
    public static void Init(ReducerContext ctx)
    {

        // Schedule a one-time reducer call by inserting a row.
        var timer = new SendMessageTimer
        {
            Text = "bot sending a message",
            ScheduledAt = ctx.Time.AddSeconds(10),
            ScheduledId = 1,
        };
        ctx.Db.SendMessageTimer.Insert(timer);


        // Schedule a recurring reducer.
        var timer = new SendMessageTimer
        {
            Text = "bot sending a message",
            ScheduledAt = new TimeStamp(10),
            ScheduledId = 2,
        };
        ctx.Db.SendMessageTimer.Insert(timer);
    }
}
```

Annotating a struct with `Scheduled` automatically adds fields to support scheduling, It can be expanded as:

```csharp
public static partial class Timers
{
    [SpacetimeDB.Table]
    public partial struct SendMessageTimer
    {
        public string Text;         // fields of original struct

        [SpacetimeDB.PrimaryKey]
        public ulong ScheduledId;   // unique identifier to be used internally

        public SpacetimeDB.ScheduleAt ScheduleAt;   // Scheduling details (Time or Inteval)
    }
}

// `ScheduledAt` definition
public abstract partial record ScheduleAt: SpacetimeDB.TaggedEnum<(DateTimeOffset Time, TimeSpan Interval)>
```

#### Special reducers

These are four special kinds of reducers that can be used to respond to module lifecycle events. They're stored in the `SpacetimeDB.Module.ReducerKind` class and can be used as an argument to the `[SpacetimeDB.Reducer]` attribute:

- `ReducerKind.Init` - this reducer will be invoked when the module is first published.
- `ReducerKind.ClientConnected` - this reducer will be invoked when a client connects to the database.
- `ReducerKind.ClientDisconnected` - this reducer will be invoked when a client disconnects from the database.

Example:

````csharp
[SpacetimeDB.Reducer(ReducerKind.Init)]
public static void Init(ReducerContext ctx)
{
    Log.Info("...and we're live!");
}

[SpacetimeDB.Reducer(ReducerKind.ClientConnected)]
public static void Connect(ReducerContext ctx)
{
    Log.Info($"{ctx.CallerIdentity} has connected from {ctx.CallerAddress}!");
}

[SpacetimeDB.Reducer(ReducerKind.ClientDisconnected)]
public static void Disconnect(ReducerContext ctx)
{
    Log.Info($"{ctx.CallerIdentity} has disconnected.");
}```
````
