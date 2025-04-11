# Row Level Security (RLS)

Row Level Security (RLS) allows module authors to restrict which rows of a public table each client can access.
These access rules are expressed in SQL and evaluated automatically for queries and subscriptions.

## Enabling RLS

RLS is currently **experimental** and must be explicitly enabled in your module.

### Rust

To enable RLS in Rust, activate the `unstable` feature in your project's `Cargo.toml`:

```toml
spacetimedb = { version = "...", features = ["unstable"] }
```

### C#

To enable RLS in C#, include the following preprocessor directive at the top of your module files:

```csharp
#pragma warning disable STDB_UNSTABLE
```

## How It Works

RLS rules are expressed in SQL and declared as constants of type `Filter` in Rust or public static readonly fields of type `Filter` in C#.

They are similar to subscriptions in that logically they act as filters on a particular table.
Just like subscriptions, arbitrary column projections are **not** allowed.
Similarly, joins **are** allowed, but each rule must return rows from one and only one table.

RLS rules can reference other tables with RLS rules, and they will be applied recursively.
For example, if an RLS rule on the `players` table joins to the `users` table,
and the `users` table has its own RLS rule, both rules will be enforced.
This ensures that data is never leaked through indirect access patterns.

RLS rules cannot be self-referential however, as this would result in infinite recursion.
The notable exception is self-joins, since the rule being declared is not applied to the self-join.

You can use the special `:sender` parameter in your rules for user specific access control.
This parameter is automatically bound to the requesting client's [Identity].

Note that module owners have full access to all public and private tables regardless of RLS.

Multiple rules may be declared for the same table and will be evaluated as a logical `OR`.
This means clients will be able to see to any row that matches at least one of the rules.

Finally, RLS rules are validated when you publish your module.
If any rule is invalid or malformed, your module will fail to publish.


[Identity]: /docs/index.md#identity

### Examples

:::server-rust
```rust
use spacetimedb::{client_visibility_filter, Filter};

/// A client only has access to their user's row in the `users` table.
#[client_visibility_filter]
const USERS_FILTER: Filter = Filter::Sql(
    "SELECT * FROM users WHERE identity = :sender"
);

/// An admin has full access to the `users` table.
#[client_visibility_filter]
const USERS_FILTER_FOR_ADMINS: Filter = Filter::Sql(
    "SELECT u.* FROM users u JOIN admins a WHERE a.identity = :sender"
);

/// A client only has access to their player's row in the `players` table.
/// Filtering by user identity is not necessary.
/// The above RLS rule on `users` will be applied automatically.
/// Hence this rule gives admins full access to the `players` table as well.
#[client_visibility_filter]
const PLAYERS_FILTER: Filter = Filter::Sql(
    "SELECT p.* FROM users u JOIN players p ON u.id = p.id"
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
    /// A client only has access to their user's row in the `users` table.
    /// </summary>
    [SpacetimeDB.ClientVisibilityFilter]
    public static readonly Filter USERS_FILTER = new Filter.Sql(
        "SELECT * FROM users WHERE identity = :sender"
    );

    /// <summary>
    /// An admin has full access to the `users` table.
    /// </summary>
    [SpacetimeDB.ClientVisibilityFilter]
    public static readonly Filter USERS_FILTER_FOR_ADMINS = new Filter.Sql(
        "SELECT u.* FROM users u JOIN admins a WHERE a.identity = :sender"
    );

    /// <summary>
    /// A client only has access to their player's row in the `players` table.
    /// Filtering by user identity is not necessary.
    /// The above RLS rule on `users` will be applied automatically.
    /// Hence this rule gives admins full access to the `players` table as well.
    /// </summary>
    [SpacetimeDB.ClientVisibilityFilter]
    public static readonly Filter PLAYERS_FILTER = new Filter.Sql(
        "SELECT p.* FROM users u JOIN players p ON u.id = p.id"
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
2. Follow the [SQL best practices] for optimizing your rules.


[SQL best practices]: /docs/sql/index.md#best-practices-for-performance-and-scalability
