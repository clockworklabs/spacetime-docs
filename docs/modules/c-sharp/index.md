# SpacetimeDB C# Module Library

<!-- TODO once all text copied in: replacements:
#[table] -> [Table]
#[auto_inc] -> [AutoInc]
#[primary_key] -> [PrimaryKey]
ctx.db -> ctx.Db
RangedIndex -> Index
:: -> (look at it and fix it)
Rust -> C#

and double check heading levels
-->

[SpacetimeDB](https://spacetimedb.com/) allows using the C# language to write server-side applications called **modules**. Modules run inside a relational database. They have direct access to database tables, and expose public functions called **reducers** that can be invoked over the network. Clients connect directly to the database to read data.

```text
    Client Application                          SpacetimeDB
┌───────────────────────┐                ┌───────────────────────┐
│                       │                │                       │
│  ┌─────────────────┐  │    SQL Query   │  ┌─────────────────┐  │
│  │ Subscribed Data │<─────────────────────│    Database     │  │
│  └─────────────────┘  │                │  └─────────────────┘  │
│           │           │                │           ^           │
│           │           │                │           │           │
│           v           │                │           v           │
│  +─────────────────┐  │ call_reducer() │  ┌─────────────────┐  │
│  │   Client Code   │─────────────────────>│   Module Code   │  │
│  └─────────────────┘  │                │  └─────────────────┘  │
│                       │                │                       │
└───────────────────────┘                └───────────────────────┘
```

C# modules are written with the the C# Module Library (this crate). They are built using the [dotnet CLI tool](https://learn.microsoft.com/en-us/dotnet/core/tools/) and deployed using the [`spacetime` CLI tool](https://spacetimedb.com/install). C# modules can import any [NuGet package](https://www.nuget.org/packages) that supports being compiled to WebAssembly.

(Note: C# can also be used to write **clients** of SpacetimeDB databases, but this requires using a completely different library, the SpacetimeDB C# Client SDK. See the documentation on [clients] for more information.)

This reference assumes you are familiar with the basics of C#. If you aren't, check out the [C# language documentation](https://learn.microsoft.com/en-us/dotnet/csharp/). For a guided introduction to C# Modules, see the [C# Module Quickstart](https://spacetimedb.com/docs/modules/c-sharp/quickstart).

## Overview

SpacetimeDB modules have two ways to interact with the outside world: tables and reducers.

- [Tables](#tables) store data and optionally make it readable by [clients]. 

- [Reducers](#reducers) are functions that modify data and can be invoked by [clients] over the network. They can read and write data in tables, and write to a private debug log.

These are the only ways for a SpacetimeDB module to interact with the outside world. Calling functions from `std::net` or `std::fs` inside a reducer will result in runtime errors.

Declaring tables and reducers is straightforward:

```csharp
static partial class Module
{
    [SpacetimeDB.Table(Name = "player")]
    public partial struct Player
    {
        public int Id;
        public string Name;
    }

    [SpacetimeDB.Reducer]
    public static void AddPerson(ReducerContext ctx, int Id, string Name) {
        ctx.Db.player.Insert(new Player { Id = Id, Name = Name });
    }
}
```


Note that reducers don't return data directly; they can only modify the database. Clients connect directly to the database and use SQL to query [public](#public-and-private-tables) tables. Clients can also open subscriptions to receive streaming updates as the results of a SQL query change.

Tables and reducers in C# modules can use any type that implements the [`SpacetimeType`] trait.

<!-- TODO: link to client subscriptions / client one-off queries respectively. -->

## Setup

To create a C# module, install the [`spacetime` CLI tool](https://spacetimedb.com/install) in your preferred shell. Navigate to your work directory and run the following command:

```bash
spacetime init --lang csharp my-project-directory
```

This creates a `dotnet` project in `my-project-directory` with the following `StdbModule.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <RuntimeIdentifier>wasi-wasm</RuntimeIdentifier>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="SpacetimeDB.Runtime" Version="1.0.0" />
  </ItemGroup>

</Project>
```

This is a standard `csproj`, with the exception of the line `<RuntimeIdentifier>wasi-wasm</RuntimeIdentifier>`.
This line is important: it allows the project to be compiled to a WebAssembly module. 

The project's `Lib.cs` will contain the following skeleton:

```csharp
public static partial class Module
{
    [SpacetimeDB.Table]
    public partial struct Person
    {
        [SpacetimeDB.AutoInc]
        [SpacetimeDB.PrimaryKey]
        public int Id;
        public string Name;
        public int Age;
    }

    [SpacetimeDB.Reducer]
    public static void Add(ReducerContext ctx, string name, int age)
    {
        var person = ctx.Db.Person.Insert(new Person { Name = name, Age = age });
        Log.Info($"Inserted {person.Name} under #{person.Id}");
    }

    [SpacetimeDB.Reducer]
    public static void SayHello(ReducerContext ctx)
    {
        foreach (var person in ctx.Db.Person.Iter())
        {
            Log.Info($"Hello, {person.Name}!");
        }
        Log.Info("Hello, World!");
    }
}
```

This skeleton declares a [table](#tables), some [reducers](#reducers). 

You can also add some [lifecycle reducers](#lifecycle-reducers) using the following code:

```csharp
[Reducer(ReducerKind.Init)]
public static void Init(ReducerContext ctx)
{
    // Run when the module is first loaded.
}

[Reducer(ReducerKind.ClientConnected)]
public static void ClientConnected(ReducerContext ctx)
{
    // Called when a client connects.
}

[Reducer(ReducerKind.ClientDisonnected)]
public static void ClientDisconnected(ReducerContext ctx)
{
    // Called when a client connects.
}
```


To compile the project, run the following command:

```bash
spacetime build
```

SpacetimeDB requires a WebAssembly-compatible `dotnet` toolchain. If the `spacetime` cli finds a compatible version of [`dotnet`](https://rustup.rs/) that it can run, it will automatically install the `wasi-experimental` workload and use it to build your application. This can also be done manually using the command:

```bash
dotnet workload install wasi-experimental
```

If you are managing your dotnet installation in some other way, you will need to install the `wasi-experimental` workload yourself.

To build your application and upload it to the public SpacetimeDB network, run:

```bash
spacetime login
```

And then:

```bash
spacetime publish [MY_DATABASE_NAME]
```

For example:

```bash
spacetime publish silly_demo_app
```

When you publish your module, a database named will be created with the requested tables, and the module will be installed inside it.

The output of `spacetime publish` will end with a line:
```text
Created new database with name: <name>, identity: <hex string>
```

This name is the human-readable name of the created database, and the hex string is its [`Identity`]. These distinguish the created database from the other databases running on the SpacetimeDB network.  They are used when administering the application, for example using the [`spacetime logs <DATABASE_NAME>`](#the-log-crate) command. You should probably write the database name down in a text file so that you can remember it.

After modifying your project, you can run:

`spacetime publish <DATABASE_NAME>`

to update the module attached to your database. Note that SpacetimeDB tries to [automatically migrate](#automatic-migrations) your database schema whenever you run `spacetime publish`.

You can also generate code for clients of your module using the `spacetime generate` command. See the [client SDK documentation] for more information.

## How it works

Under the hood, SpacetimeDB modules are WebAssembly modules that import a [specific WebAssembly ABI](https://spacetimedb.com/docs/webassembly-abi) and export a small number of special functions. This is automatically configured when you add the `spacetime` crate as a dependency of your application.

The SpacetimeDB host is an application that hosts SpacetimeDB databases. [Its source code is available](https://github.com/clockworklabs/SpacetimeDB) under [the Business Source License with an Additional Use Grant](https://github.com/clockworklabs/SpacetimeDB/blob/master/LICENSE.txt). You can run your own host, or you can upload your module to the public SpacetimeDB network. <!-- TODO: want a link to some dashboard for the public network. --> The network will create a database for you and install your module in it to serve client requests.

#### In More Detail: Publishing a Module

The `spacetime publish [DATABASE_IDENTITY]` command compiles a module and uploads it to a SpacetimeDB host. After this:
- The host finds the database with the requested `DATABASE_IDENTITY`.
  - (Or creates a fresh database and identity, if no identity was provided).
- The host loads the new module and inspects its requested database schema. If there are changes to the schema, the host tries perform an [automatic migration](#automatic-migrations). If the migration fails, publishing fails.
- The host terminates the old module attached to the database.
- The host installs the new module into the database. It begins running the module's [lifecycle reducers](#lifecycle-reducers) and [scheduled reducers](#scheduled-reducers), starting with the `Init` reducer.
- The host begins allowing clients to call the module's reducers.

From the perspective of clients, this process is seamless. Open connections are maintained and subscriptions continue functioning. [Automatic migrations](#automatic-migrations) forbid most table changes except for adding new tables, so client code does not need to be recompiled.
However:
- Clients may witness a brief interruption in the execution of scheduled reducers (for example, game loops.)
- New versions of a module may remove or change reducers that were previously present. Client code calling those reducers will receive runtime errors.


## Tables

Tables are declared using the [`[SpacetimeDB.Table]` attribute](#table-attribute).

This macro is applied to a C# `partial class` or `partial struct` with named fields. All of the fields of the table must be marked with [`[SpacetimeDB.Type]`](#type-attribute).

The resulting type is used to store rows of the table. It is normal class (or struct). Row values are not special -- operations on row types do not, by themselves, modify the table. Instead, a [`ReducerContext`](#reducercontext) is needed to get a handle to the table.

```csharp
public static partial class Module {

    /// <summary>
    /// A Person is a row of the table person.
    /// </summary>
    [SpacetimeDB.Table(Name = "person", Public)]
    public partial struct Person {
        [SpacetimeDB.PrimaryKey]
        [SpacetimeDB.AutoInc]
        ulong Id;
        [SpacetimeDB.Index.BTree]
        string Name;
    }

    // `Person` is a normal C# struct type.
    // Operations on a `Person` do not, by themselves, do anything.
    // The following function does not interact with the database at all.
    public static void DoNothing() {
        // Creating a `Person` DOES NOT modify the database.
        var person = new Person { Id = 0, Name = "Joe Average" };
        // Updating a `Person` DOES NOT modify the database.
        person.Name = "Joanna Average";
        // Deallocating a `Person` DOES NOT modify the database.
        person = null;
    }

    // To interact with the database, you need a `ReducerContext`.
    // The first argument of a reducer is always a `ReducerContext`.
    [SpacetimeDB.Reducer]
    public static void DoSomething(ReducerContext ctx) {
        // The following inserts a row into the table:
        var examplePerson = ctx.Db.person.Insert(new Person { id = 0, name = "Joe Average" });

        // `examplePerson` is a COPY of the row stored in the database.
        // If we update it:
        examplePerson.name = "Joanna Average".to_string();
        // Our copy is now updated, but the database's copy is UNCHANGED.
        // To push our change through, we can call `UniqueIndex.Update()`:
        examplePerson = ctx.Db.person.Id.Update(examplePerson);
        // Now the database and our copy are in sync again.
        
        // We can also delete the row in the database using `UniqueIndex.Delete()`.
        ctx.Db.person.Id.Delete(examplePerson.Id);
    }
}
```

(See [reducers](#reducers) for more information on declaring reducers.)

This library generates a custom API for each table, depending on the table's name and structure.

All tables support getting a handle implementing the [`ITableView`] interface from a [`ReducerContext`], using:

```text
ctx.db.{table_name}
```

For example,

```csharp
ctx.Db.person
```

[Unique and primary key columns](#unique-and-primary-key-columns) and [indexes](#indexes) generate additional accessors, such as `ctx.Db.person.Id` and `ctx.Db.person.Name`.

### Interface `ITableView`

```csharp
namespace SpacetimeDB.Internal;

public interface ITableView<View, Row>
    where Row : IStructuralReadWrite, new()
{
        /* ... */
}
```
<!-- Actually, `Row` is called `T` in the real declaration, but it would be much clearer
if it was called `Row`. -->

Implemented for every table handle generated by the [`Table`] attribute.
For a table named `{name}`, a handle can be extracted from a [`ReducerContext`] using `ctx.Db.{name}`. For example, `ctx.Db.person`.

Contains methods that are present for every table handle, regardless of what unique constraints
and indexes are present.

The type `Row` is the type of rows in the table.

| Name                                | Description                   |
| ----------------------------------- | ----------------------------- |
| [`Insert` method](#insert-method)   | Insert a row into the table   |
| [`Delete` method](#delete-method)   | Delete a row from the table   |
| [`Iter` method](#iter-method)       | Iterate all rows of the table |
| [`Count` property](#count-property) | Count all rows of the table   |

#### `ITableView.Insert` method

```csharp
Row Insert(Row row);
```

Inserts `row` into the table.

The return value is the inserted row, with any auto-incrementing columns replaced with computed values.
The `insert` method always returns the inserted row, even when the table contains no auto-incrementing columns.

(The returned row is a copy of the row in the database.
Modifying this copy does not directly modify the database.
See [`UniqueIndex.Update()`](#method-update) if you want to update the row.)

Throws an exception if inserting the row violates any constraints.

Inserting a duplicate row in a table without a unique constraint is a no-op,
as SpacetimeDB is a set-semantic database.
Inserting a duplicate row in a table with a unique constraint will cause a unique constraint violation.

#### `ITableView.Delete` method

```csharp
bool Delete(Row row);
```

Deletes a row equal to `row` from the table.

Returns `true` if the row was present and has been deleted,
or `false` if the row was not present and therefore the tables have not changed.

Unlike [`Insert`](#insert-method), there is no need to return the deleted row,
as it must necessarily have been exactly equal to the `row` argument.
No analogue to auto-increment placeholders exists for deletions.

Throws an exception if deleting the row would violate any constraints.

#### `ITableView.Iter` method

```csharp
IEnumerable<Row> Iter();
```

Iterate over all rows of the table.

For large tables, this can be a very slow operation! Prefer [filtering](#filter-method) a [`RangedIndex`] or [finding](find-method) a [`UniqueIndex`] if possible.

#### `ITableView.Count` method

```csharp
ulong Count { get; }
```

Returns the number of rows of this table.

This takes into account modifications by the current transaction,
even though those modifications have not yet been committed or broadcast to clients.

### Public and Private Tables

By default, tables are considered **private**. This means that they are only readable by the database owner and by reducers. Reducers run inside the database, so clients cannot see private tables at all.

Using the `[SpacetimeDB.Table(Name = "table_name", Public)]` flag makes a table public. **Public** tables are readable by all clients. They can still only be modified by reducers. 

(Note that, when run by the module owner, the `spacetime sql <SQL_QUERY>` command can also read private tables. This is for debugging convenience. Only the module owner can see these tables. This is determined by the `Identity` stored by the `spacetime login` command. Run `spacetime login show` to print your current logged-in `Identity`.)

To learn how to subscribe to a public table, see the [client SDK documentation](https://spacetimedb.com/docs/sdks).

### Unique and Primary Key Columns

Columns of a table (that is, fields of a [`[Table]`] struct) can be annotated with `[Unique]` or `[PrimaryKey]`. Multiple columns can be `[Unique]`, but only one can be `[PrimaryKey]`. For example:

```csharp
[SpacetimeDB.Table(Name = "citizen")]
public partial struct Citizen {
    [SpacetimeDB.PrimaryKey]
    ulong Id;

    [SpacetimeDB.Unique]
    string Ssn;

    [SpacetimeDB.Unique]
    string Email;

    string name;
}
```

Every row in the table `Person` must have unique entries in the `id`, `ssn`, and `email` columns. Attempting to insert multiple `Person`s with the same `id`, `ssn`, or `email` will throw an exception.

Any `[Unique]` or `[PrimaryKey]` column supports getting a [`UniqueIndex`] from a [`ReducerContext`] using:

```text
ctx.Db.{table}.{unique_column}
```

For example, 

```no_build
ctx.Db.citizen.Ssn
```

Notice that updating a row is only possible if a row has a unique column -- there is no `update` method in the base [`Table`] trait. SpacetimeDB has no notion of rows having an "identity" aside from their unique / primary keys.

The `#[primary_key]` annotation is similar to the `#[unique]` annotation, except that it leads to additional methods being made available in the [client]-side SDKs.

It is not currently possible to mark a group of fields as collectively unique.

Filtering on unique columns is only supported for a limited number of types.

### Class `UniqueIndex`

```csharp
namespace SpacetimeDB.Internal;

public abstract class UniqueIndex<Handle, Row, Column, RW> : IndexBase<Row>
    where Handle : ITableView<Handle, Row>
    where Row : IStructuralReadWrite, new()
    where Column : IEquatable<Column>
{
    /* ... */
}
```
<!-- Actually, `Column` is called `T` in the real declaration, but it would be much clearer
if it was called `Column`. -->

A unique index on a column. Available for `#[unique]` and `#[primary_key]` columns.
(A custom class derived from `UniqueIndex` is generated for every such column.)

`Row` is the type decorated with `[SpacetimeDB.Table]`, `Column` is the type of the column,
and `Handle` is the type of the generated table handle.

For a table *table* with a column *column*, use `ctx.Db.{table}.{column}`
to get a `UniqueColumn` from a [`ReducerContext`](crate::ReducerContext).

Example:

```csharp
using SpacetimeDB;

public static partial class Module {
    [Table(Name = "user")]
    public partial struct User {
        [PrimaryKey]
        uint Id;
        [Unique]
        string Username;
        ulong DogCount;
    }

    [Reducer]
    void Demo(ReducerContext ctx) {
        var idIndex = ctx.Db.user.Id;
        var exampleUser = idIndex.find(357).unwrap();
        exampleUser.dog_count += 5;
        idIndex.update(exampleUser);

        var usernameIndex = ctx.Db.user.Username;
        usernameIndex.delete("Evil Bob");
    }
}
```

| Name                                          | Description                                  |
| --------------------------------------------- | -------------------------------------------- |
| [`Find` method](#uniqueindex-find-method)     | Find a row by the value of a unique column   |
| [`Update` method](#uniqueindex-update-method) | Update a row with a unique column            |
| [`Delete` method](#uniqueindex-delete-method) | Delete a row by the value of a unique column |

<!-- Technically, these methods only exist in the generated code, not in the abstract
base class. This is a wart that is necessary because of a bad interaction between C# inheritance, nullable types, and structs/classes.-->

#### `UniqueIndex.Find` method

```csharp
Row? Find(Column key);
```

Finds and returns the row where the value in the unique column matches the supplied `key`,
or `null` if no such row is present in the database state.

#### `UniqueIndex.Update` method

```csharp
Row Update(Row row);
```

Deletes the row where the value in the unique column matches that in the corresponding field of `row`, then inserts `row`.

Returns the new row as actually inserted, with any auto-inc placeholders substituted for computed values.

Throws if no row was previously present with the matching value in the unique column,
or if either the delete or the insertion would violate a constraint.

#### `UniqueIndex.Delete` method

```csharp
bool Delete(Column key);
```

Deletes the row where the value in the unique column matches the supplied `key`, if any such row is present in the database state.

Returns `true` if a row with the specified `key` was previously present and has been deleted,
or `false` if no such row was present.

### Auto-inc columns

Columns can be marked `[SpacetimeDB.AutoInc]`. This can only be used on integer types (`int`, `ulong`, etc.)

When inserting into a table with an `[AutoInc]` column, if the annotated column is set to zero (`0`), the database will automatically overwrite that zero with an atomically increasing value.

[`ITableView.Insert`] returns rows with `#[auto_inc]` columns set to the values that were actually written into the database.

```csharp
public static partial class Module
{
    [SpacetimeDB.Table(Name = "example")]
    public partial struct Example
    {
        [SpacetimeDB.AutoInc]
        public int Field;
    }

    [SpacetimeDB.Reducer]
    public static void InsertAutoIncExample(ReducerContext ctx, int Id, string Name) {
        for (var i = 0; i < 10; i++) {
            // These will have distinct, unique values
            // at rest in the database, since they
            // are inserted with the sentinel value 0.
            var actual = ctx.Db.example.Insert(new Example { Field = 0 });
            Debug.Assert(actual.Field != 0);
    }
}
```

`[AutoInc]` is often combined with `[Unique]` or `[PrimaryKey]` to automatically assign unique integer identifiers to rows.

### Indexes

SpacetimeDB supports both single- and multi-column [B-Tree](https://en.wikipedia.org/wiki/B-tree) indexes.

Indexes are declared using the syntax:

```csharp
[SpacetimeDB.Index.BTree(Name = "IndexName", Columns = [nameof(Column1), nameof(Column2), nameof(Column3)])]
```

For example:

```csharp
[SpacetimeDB.Table(Name = "paper")]
[SpacetimeDB.Index.BTree(Name = "TitleAndDate", Columns = [nameof(Title), nameof(Date)])]
[SpacetimeDB.Index.BTree(Name = "UrlAndCountry", Columns = [nameof(Url), nameof(Country)])]
public partial struct AcademicPaper {
    string Title;
    string Url;
    string Date;
    string Venue;
    string Country;
} 
```

Multiple indexes can be declared.

Single-column indexes can also be declared using an annotation on a column:

```csharp
[SpacetimeDB.Table(Name = "academic_paper")]
public partial struct AcademicPaper {
    string Title;
    string Url;
    [SpacetimeDB.Index.BTree] // The index will be named "Date".
    string Date;
    [SpacetimeDB.Index.BTree] // The index will be named "Venue".
    string Venue;
    [SpacetimeDB.Index.BTree(Name = "ByCountry")] // The index will be named "ByCountry".
    string Country;
} 
```


Any index supports getting an [`Index`] using `ctx.Db.{table}.{index}`. For example, `ctx.Db.academic_paper.TitleAndDate` or `ctx.Db.academic_paper.Venue`.

### 

## Reducers

Reducers are declared using the [`#[reducer]` macro](macro@crate::reducer).

`#[reducer]` is always applied to top level C# functions. The first argument of a reducer must be a [`ReducerContext`]. The remaining arguments must be types marked with [`SpacetimeDB.Type`]. Reducers should return `void`.

```csharp
public static partial class Module {
    [SpacetimeDB.Reducer]
    public static void GivePlayerItem(
        ReducerContext context,
        ulong PlayerId,
        ulong ItemId
    )
    {
        // ...
    }
}
```

Every reducer runs inside a [database transaction](https://en.wikipedia.org/wiki/Database_transaction). <!-- TODO: specific transaction level guarantees. --> This means that reducers will not observe the effects of other reducers modifying the database while they run. Also, if a reducer fails, all of its changes to the database will automatically be rolled back. Reducers can fail by [panicking](::std::panic!) or by returning an `Err`.

#### The `ReducerContext` Type

Reducers have access to a special [`ReducerContext`] argument. This argument allows reading and writing the database attached to a module. It also provides some additional functionality, like generating random numbers and scheduling future operations.

[`ReducerContext`] provides access to the database tables via [the `.db` field](ReducerContext#structfield.db). The [`#[table]`](macro@crate::table) macro generates traits that add accessor methods to this field.

#### Lifecycle Reducers

A small group of reducers are called at set points in the module lifecycle. These are used to initialize
the database and respond to client connections. See [Lifecycle Reducers](macro@crate::reducer#lifecycle-reducers).

#### Scheduled Reducers

Reducers can be scheduled to run repeatedly. This can be used to implement timers, game loops, and
maintenance tasks. See [Scheduled Reducers](macro@crate::reducer#scheduled-reducers).

## Automatic migrations

When you `spacetime publish` a module that has already been published using `spacetime publish <DATABASE_NAME_OR_IDENTITY>`,
SpacetimeDB attempts to automatically migrate your existing database to the new schema. (The "schema" is just the collection
of tables and reducers you've declared in your code, together with the types they depend on.) This form of migration is very limited and only supports a few kinds of changes.
On the plus side, automatic migrations usually don't break clients. The situations that may break clients are documented below.

The following changes are always allowed and never breaking:

<!-- TODO: everything here should be smoke-tested. -->

- ✅ **Adding tables**. Non-updated clients will not be able to see the new tables.
- ✅ **Adding indexes**.
- ✅ **Adding or removing `#[auto_inc]` annotations.**
- ✅ **Changing tables from private to public**.
- ✅ **Adding reducers**.
- ✅ **Removing `#[unique]`  annotations.**

The following changes are allowed, but may break clients:

- ⚠️ **Changing or removing reducers**. Clients that attempt to call the old version of a changed reducer will receive runtime errors.
- ⚠️ **Changing tables from public to private**. Clients that are subscribed to a newly-private table will receive runtime errors.
- ⚠️ **Removing `#[primary_key]` annotations**. Non-updated clients will still use the old `#[primary_key]` as a unique key in their local cache, which can result in non-deterministic behavior when updates are received.
- ⚠️ **Removing indexes**. This is only breaking in some situtations.
  The specific problem is subscription queries <!-- TODO: clientside link --> involving semijoins, such as:
    ```sql
    SELECT Employee.*
    FROM Employee JOIN Dept
    ON Employee.DeptName = Dept.DeptName
    )
    ```
    For performance reasons, SpacetimeDB will only allow this kind of subscription query if there are indexes on `Employee.DeptName` and `Dept.DeptName`. Removing either of these indexes will invalidate this subscription query, resulting in client-side runtime errors.

The following changes are forbidden without a manual migration:

- ❌ **Removing tables**.
- ❌ **Changing the columns of a table**. This includes changing the order of columns of a table.
- ❌ **Changing whether a table is used for [scheduling](#scheduled-reducers).** <!-- TODO: update this if we ever actually implement it... -->
- ❌ **Adding `#[unique]` or `#[primary_key]` constraints.** This could result in existing tables being in an invalid state.

Currently, manual migration support is limited. The `spacetime publish --clear-database <DATABASE_IDENTITY>` command can be used to **COMPLETELY DELETE** and reinitialize your database, but naturally it should be used with EXTREME CAUTION.

## Other infrastructure

### Class `Log`

```csharp
namespace SpacetimeDB
{
    public static class Log
    {
        public static void Debug(string message);
        public static void Error(string message);
        public static void Exception(string message);
        public static void Exception(Exception exception);
        public static void Info(string message);
        public static void Trace(string message);
        public static void Warn(string message);
    }
}
```

Methods for writing to a private debug log. Log messages will include file and line numbers.

Log outputs of a running module can be inspected using the `spacetime logs` command:

```text
spacetime logs <DATABASE_IDENTITY>
```

These are only visible to the database owner, not to clients or other developers.

Note that `Log.Error` and `Log.Exception` only write to the log, they do not throw exceptions themselves.

Example:

```csharp
using SpacetimeDB;

public static partial class Module {
    [Table(Name = "user")]
    public partial struct User {
        [PrimaryKey]
        uint Id;
        [Unique]
        string Username;
        ulong DogCount;
    }

    [Reducer]
    void LogDogs(ReducerContext ctx) {
        Log.Info("Examining users.");

        var totalDogCount = 0;

        foreach (var user in ctx.Db.user.Iter()) {
            Log.Info($"    User: Id = {user.Id}, Username = {user.Username}, DogCount = {user.DogCount}");

            totalDogCount += user.DogCount;
        }

        if (totalDogCount < 300) {
            Log.Warn("Insufficient dogs.");
        }

        if (totalDogCount < 100) {
            Log.Error("Dog population is critically low!");
        }
    }
}
```

### Attribute `[SpacetimeDB.Type]`

This attribute makes types self-describing, allowing them to automatically register their structure
with SpacetimeDB. Any C# type annotated with `[SpacetimeDB.Type]` can be used as a table column or reducer argument.

Types marked `[SpacetimeDB.Table]` are automatically marked `[SpacetimeDB.Type]`.

`[SpacetimeDB.Type]` can be combined with [`SpacetimeDB.TaggedEnum`] to use tagged enums in tables or reducers.

```csharp
using SpacetimeDB;

public static partial class Module {

    [Type]
    public partial struct Coord {
        public int X;
        public int Y;
    }

    [Type]
    public partial struct TankData {
        public int Ammo;
        public int LeftTreadHealth;
        public int RightTreadHealth;
    }

    [Type]
    public partial struct TransportData {
        public int TroopCount;
    }

    // A type that could be either the data for a Tank or the data for a Transport.
    // See SpacetimeDB.TaggedEnum docs.
    [Type]
    public partial record VehicleData : TaggedEnum<(TankData Tank, TransportData Transport)> {}

    [Table(Name = "vehicle")]
    public partial struct Vehicle {
        [PrimaryKey]
        [AutoInc]
        public uint Id;
        public Coord Coord;
        public VehicleData Data;
    }

    [SpacetimeDB.Reducer]
    public static void InsertVehicle(ReducerContext ctx, Coord Coord, VehicleData Data) {
        ctx.Db.vehicle.Insert(new Vehicle { Id = 0, Coord = Coord, Data = Data });
    }
}
```

The fields of the struct/enum must also be marked with `[SpacetimeDB.Type]`. 

Some types from the standard library are also considered to be marked with `[SpacetimeDB.Type]`, including:
- `byte`
- `sbyte`
- `ushort`
- `short`
- `uint`
- `int`
- `ulong`
- `long`
- `SpacetimeDB.U128`
- `SpacetimeDB.I128`
- `SpacetimeDB.U256`
- `SpacetimeDB.I256`
- `List<T>` where `T` is a `[SpacetimeDB.Type]`

### Record `TaggedEnum`
```csharp
namespace SpacetimeDB;

public abstract record TaggedEnum<Variants> : IEquatable<TaggedEnum<Variants>> where Variants : struct, ITuple
```

A [tagged enum](https://en.wikipedia.org/wiki/Tagged_union) is a type that can hold a value from any one of several types. `TaggedEnum` uses code generation to accomplish this.

For example, to declare a type that can be either a `string` or an `int`, write:

```csharp
[SpacetimeDB.Type]
public partial record ProductId : SpacetimeDB.TaggedEnum<(string Text, uint Number)> { }
```

Here there are two **variants**: one is named `Text` and holds a `string`, the other is named `Number` and holds a `uint`.

To create a value of this type, use `new {Type}.{Variant}({data})`. For example:

```csharp
ProductId a = new ProductId.Text("apple");
ProductId b = new ProductId.Number(57);
ProductId c = new ProductId.Number(59);
```

To use a value of this type, you need to check which variant it stores.
This is done with [C# pattern matching syntax](https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/functional/pattern-matching). For example:

```csharp
public static void Print(ProductId id)
{
    if (id is ProductId.Text(var s))
    {
        Log.Info($"Textual product ID: '{s}'");
    }
    else if (id is ProductId.Number(var i))
    {
        Log.Info($"Numeric Product ID: {i}");
    }
}
```

A `TaggedEnum` can have up to 255 variants, and the variants can be any type marked with [`[SpacetimeDB.Type]`].

```csharp
[SpacetimeDB.Type]
public partial record ManyChoices : SpacetimeDB.TaggedEnum<(
    string String,
    int Int,
    List<int> IntList,
    Banana Banana,
    List<List<Banana>> BananaMatrix
)> { }

[SpacetimeDB.Type]
public partial struct Banana {
    public int Sweetness;
    public int Rot;
}
```

`TaggedEnums` are an excellent alternative to nullable fields when groups of fields are always set together. Consider a data type like:

```csharp
[SpacetimeDB.Type]
public partial struct ShapeData {
    public int? CircleRadius;
    public int? RectWidth;
    public int? RectHeight;
}
```

Often this is supposed to be a circle XOR a rectangle -- that is, not both at the same time. If this is the case, then we don't want to set `circleRadius` at the same time as `rectWidth` or `rectHeight`. Also, if `rectWidth` is set, we expect `rectHeight` to be set.
However, C# doesn't know about this, so code using this type will be littered with extra null checks.

If we instead write:

```csharp
[SpacetimeDB.Type]
public partial struct CircleData {
    public int Radius;
}

[SpacetimeDB.Type]
public partial struct RectData {
    public int Width;
    public int Height;
}

[SpacetimeDB.Type]
public partial record ShapeData : SpacetimeDB.TaggedEnum<(CircleData Circle, RectData Rect)> { }
```

<<<<<<< HEAD
[SpacetimeDB.Reducer(ReducerKind.Disconnect)]
public static void OnDisconnect(DbEventArgs ctx)
{
    Log($"{ctx.Sender} has disconnected.");
}```
````

[SEQUENCE]: /docs/appendix#sequence
=======
Then code using a `ShapeData` will only have to do one check -- do I have a circle or a rectangle?
And in each case, the data will be guaranteed to have exactly the fields needed.

[macro library]: https://github.com/clockworklabs/SpacetimeDB/tree/master/crates/bindings-macro
[module library]: https://github.com/clockworklabs/SpacetimeDB/tree/master/crates/lib
[demo]: /#demo
[client]: https://spacetimedb.com/docs/#client
[clients]: https://spacetimedb.com/docs/#client
[client SDK documentation]: https://spacetimedb.com/docs/#client
[host]: https://spacetimedb.com/docs/#host
>>>>>>> 25e1326 (Most of the way to C# Module SDK docs)
