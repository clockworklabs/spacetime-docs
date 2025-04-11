# Row Level Security (RLS)

Row Level Security (RLS) allows module authors to restrict which rows of a public table each client can access.
These access rules are expressed in SQL and evaluated automatically for queries and subscriptions.

## Enabling RLS

RLS is currently **experimental** and must be explicitly enabled in your module.

:::server-rust
To enable RLS, activate the `unstable` feature in your project's `Cargo.toml`:

```toml
spacetimedb = { version = "...", features = ["unstable"] }
```
:::
:::server-csharp
To enable RLS, include the following preprocessor directive at the top of your module files:

```cs
#pragma warning disable STDB_UNSTABLE
```
:::

## How It Works

:::server-rust
RLS rules are expressed in SQL and declared as constants of type `Filter`.

```rust
use spacetimedb::{client_visibility_filter, Filter};

/// A client can only see their user
#[client_visibility_filter]
const USERS_FILTER: Filter = Filter::Sql(
    "SELECT * FROM users WHERE identity = :sender"
);
```
:::
:::server-csharp
RLS rules are expressed in SQL and declared as public static readonly fields of type `Filter`.

```cs
using SpacetimeDB;

#pragma warning disable STDB_UNSTABLE

public partial class Module
{
    /// <summary>
    /// A client can only see their user.
    /// </summary>
    [SpacetimeDB.ClientVisibilityFilter]
    public static readonly Filter USERS_FILTER = new Filter.Sql(
        "SELECT * FROM users WHERE identity = :sender"
    );
}
```
:::

A module will fail to publish if any of its RLS rules are invalid or malformed.

### `:sender`

You can use the special `:sender` parameter in your rules for user specific access control.
This parameter is automatically bound to the requesting client's [Identity].

Note that module owners have unrestricted access to all tables regardless of RLS.


[Identity]: /docs/index.md#identity

### Semantic Constraints

RLS rules are similar to subscriptions in that logically they act as filters on a particular table.
Also like subscriptions, arbitrary column projections are **not** allowed.
Joins **are** allowed, but each rule must return rows from one and only one table.

### Multiple Rules Per Table

Multiple rules may be declared for the same table and will be evaluated as a logical `OR`.
This means clients will be able to see to any row that matches at least one of the rules.

#### Example

:::server-rust
```rust
use spacetimedb::{client_visibility_filter, Filter};

/// A client can only see their user
#[client_visibility_filter]
const USERS_FILTER: Filter = Filter::Sql(
    "SELECT * FROM users WHERE identity = :sender"
);

/// An admin can see all users
#[client_visibility_filter]
const USERS_FILTER_FOR_ADMINS: Filter = Filter::Sql(
    "SELECT u.* FROM users u JOIN admins a WHERE a.identity = :sender"
);
```
:::
:::server-csharp
```cs
using SpacetimeDB;

#pragma warning disable STDB_UNSTABLE

public partial class Module
{
    /// <summary>
    /// A client can only see their user.
    /// </summary>
    [SpacetimeDB.ClientVisibilityFilter]
    public static readonly Filter USERS_FILTER = new Filter.Sql(
        "SELECT * FROM users WHERE identity = :sender"
    );

    /// <summary>
    /// An admin can see all users.
    /// </summary>
    [SpacetimeDB.ClientVisibilityFilter]
    public static readonly Filter USERS_FILTER_FOR_ADMINS = new Filter.Sql(
        "SELECT u.* FROM users u JOIN admins a WHERE a.identity = :sender"
    );
}
```
:::

### Recursive Application

RLS rules can reference other tables with RLS rules, and they will be applied recursively.
This ensures that data is never leaked through indirect access patterns.

#### Example

:::server-rust
```rust
use spacetimedb::{client_visibility_filter, Filter};

/// A client can only see their user
#[client_visibility_filter]
const USERS_FILTER: Filter = Filter::Sql(
    "SELECT * FROM users WHERE identity = :sender"
);

/// An admin can see all users
#[client_visibility_filter]
const USERS_FILTER_FOR_ADMINS: Filter = Filter::Sql(
    "SELECT u.* FROM users u JOIN admins a WHERE a.identity = :sender"
);

/// Explicitly filtering by user identity in this rule is not necessary,
/// since the above RLS rules on `users` will be applied automatically.
/// Hence a client can only see their player, but an admin can see all players.
#[client_visibility_filter]
const PLAYERS_FILTER: Filter = Filter::Sql(
    "SELECT p.* FROM users u JOIN players p ON u.id = p.id"
);
```
:::
:::server-csharp
```cs
using SpacetimeDB;

public partial class Module
{
    /// <summary>
    /// A client can only see their user.
    /// </summary>
    [SpacetimeDB.ClientVisibilityFilter]
    public static readonly Filter USERS_FILTER = new Filter.Sql(
        "SELECT * FROM users WHERE identity = :sender"
    );

    /// <summary>
    /// An admin can see all users.
    /// </summary>
    [SpacetimeDB.ClientVisibilityFilter]
    public static readonly Filter USERS_FILTER_FOR_ADMINS = new Filter.Sql(
        "SELECT u.* FROM users u JOIN admins a WHERE a.identity = :sender"
    );

    /// <summary>
    /// Explicitly filtering by user identity in this rule is not necessary,
    /// since the above RLS rules on `users` will be applied automatically.
    /// Hence a client can only see their player, but an admin can see all players.
    /// </summary>
    [SpacetimeDB.ClientVisibilityFilter]
    public static readonly Filter PLAYERS_FILTER = new Filter.Sql(
        "SELECT p.* FROM users u JOIN players p ON u.id = p.id"
    );
}
```
:::

And while self-joins are allowed, in general RLS rules cannot be self-referential,
as this would result in infinite recursion.

#### Example: Self-Join

:::server-rust
```rust
use spacetimedb::{client_visibility_filter, Filter};

/// A client can only see players on their same level
#[client_visibility_filter]
const PLAYERS_FILTER: Filter = Filter::Sql("
    SELECT q.*
    FROM users u
    JOIN players p ON u.id = p.id
    JOIN players q on p.level = q.level
    WHERE u.identity = :sender
");
```
:::
:::server-csharp
```cs
using SpacetimeDB;

public partial class Module
{
    /// <summary>
    /// A client can only see players on their same level.
    /// </summary>
    [SpacetimeDB.ClientVisibilityFilter]
    public static readonly Filter PLAYERS_FILTER = new Filter.Sql(@"
        SELECT q.*
        FROM users u
        JOIN players p ON u.id = p.id
        JOIN players q on p.level = q.level
        WHERE u.identity = :sender
    ");
}
```
:::

#### Example: Recursive Rules

This module will fail to publish because each rule depends on the other one.

:::server-rust
```rust
use spacetimedb::{client_visibility_filter, Filter};

/// A user must have a corresponding player
#[client_visibility_filter]
const USERS_FILTER: Filter = Filter::Sql(
    "SELECT u.* FROM users u JOIN players p ON u.id = p.id WHERE u.identity = :sender"
);

/// A player must have a corresponding user
#[client_visibility_filter]
const PLAYERS_FILTER: Filter = Filter::Sql(
    "SELECT p.* FROM users u JOIN players p ON u.id = p.id WHERE u.identity = :sender"
);
```
:::
:::server-csharp
```cs
using SpacetimeDB;

public partial class Module
{
    /// <summary>
    /// A user must have a corresponding player.
    /// </summary>
    [SpacetimeDB.ClientVisibilityFilter]
    public static readonly Filter USERS_FILTER = new Filter.Sql(
        "SELECT u.* FROM users u JOIN players p ON u.id = p.id WHERE u.identity = :sender"
    );

    /// <summary>
    /// A player must have a corresponding user.
    /// </summary>
    [SpacetimeDB.ClientVisibilityFilter]
    public static readonly Filter USERS_FILTER = new Filter.Sql(
        "SELECT p.* FROM users u JOIN players p ON u.id = p.id WHERE u.identity = :sender"
    );
}
```
:::

## Usage in Subscriptions

RLS rules automatically apply to subscriptions so that if a client subscribes to a table with RLS filters,
the subscription will only return rows that the client is allowed to see.

While the contraints and limitations outlined in the [reference docs] do not apply to RLS rules,
they do apply to the subscriptions that use them.
For example, it is valid for an RLS rule to have more joins than are supported by subscriptions.
However a client will not be able to subscribe to the table for which that rule is defined.


[reference docs]: /docs/sql/index.md#subscriptions

## Best Practices

1. Use `:sender` for client specific filtering.
2. Follow the [SQL best practices] for optimizing your RLS rules.


[SQL best practices]: /docs/sql/index.md#best-practices-for-performance-and-scalability
