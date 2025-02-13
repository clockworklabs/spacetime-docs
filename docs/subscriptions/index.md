# The SpacetimeDB Subscription API

The subscription API allows a client to replicate a subset of a database.
It does so by registering SQL queries, which we call subscriptions, through a database connection.
A client will only receive updates for rows that match the subscriptions it has registered.

This guide describes the two main interfaces that comprise the API - `SubscriptionBuilder` and `SubscriptionHandle`.
By using these interfaces, you can create efficient and responsive client applications that only receive the data they need.

## SubscriptionBuilder

:::server-rust
```rust
pub struct SubscriptionBuilder<M: SpacetimeModule> { /* private fields */ }

impl<M: SpacetimeModule> SubscriptionBuilder<M> {
    /// Register a callback that runs when the subscription has been applied.
    /// This callback receives a context containing the current state of the subscription.
    pub fn on_applied(mut self, callback: impl FnOnce(&M::SubscriptionEventContext) + Send + 'static);

    /// Register a callback to run when the subscription fails.
    ///
    /// Note that this callback may run either when attempting to apply the subscription,
    /// in which case [`Self::on_applied`] will never run,
    /// or later during the subscription's lifetime if the module's interface changes,
    /// in which case [`Self::on_applied`] may have already run.
    pub fn on_error(mut self, callback: impl FnOnce(&M::ErrorContext, crate::Error) + Send + 'static);

    /// Subscribe to a subset of database via a single SQL query.
    /// Returns a handle which you can use to monitor or cancel the subscription later.
    pub fn subscribe(self, query_sql: &str) -> M::SubscriptionHandle;

    /// Subscribe to all rows from all tables.
    ///
    /// This method is intended as a convenience
    /// for applications where client-side memory use and network bandwidth are not concerns.
    /// Applications where these resources are a constraint
    /// should register more precise queries via [`Self::subscribe`]
    /// in order to replicate only the subset of data which the client needs to function.
    ///
    /// This method should not be combined with [`Self::subscribe`] on the same `DbConnection`.
    /// A connection may either [`Self::subscribe`] to particular queries,
    /// or [`Self::subscribe_to_all_tables`], but not both.
    /// Attempting to call [`Self::subscribe`]
    /// on a `DbConnection` that has previously used [`Self::subscribe_to_all_tables`],
    /// or vice versa, may misbehave in any number of ways,
    /// including dropping subscriptions, corrupting the client cache, or panicking.
    pub fn subscribe_to_all_tables(self);
}
```
:::
:::server-csharp
```cs
public sealed class SubscriptionBuilder<SubscriptionEventContext, ErrorContext>
    where SubscriptionEventContext : ISubscriptionEventContext
    where ErrorContext : IErrorContext
{
    /// <summary>
    /// Register a callback that runs when the subscription has been applied.
    /// This callback receives a context containing the current state of the subscription.
    /// </summary>
    public SubscriptionBuilder<SubscriptionEventContext, ErrorContext> OnApplied(
        Action<SubscriptionEventContext> callback
    );

    /// <summary>
    /// Register a callback to run when the subscription fails.
    /// </summary>
    public SubscriptionBuilder<SubscriptionEventContext, ErrorContext> OnError(
        Action<ErrorContext, Exception> callback
    );

    /// <summary>
    /// Subscribe to a subset of database via a single SQL query.
    /// Returns a handle which you can use to monitor or cancel the subscription later.
    /// </summary>
    public SubscriptionHandle<SubscriptionEventContext, ErrorContext> Subscribe(
        string querySql
    );

    /// <summary>
    /// Subscribe to all rows from all tables.
    ///
    /// This method is intended as a convenience
    /// for applications where client-side memory use and network bandwidth are not concerns.
    /// Applications where these resources are a constraint
    /// should register more precise queries via [`Subscribe`]
    /// in order to replicate only the subset of data which the client needs to function.
    ///
    /// This method should not be combined with `Subscribe` on the same `DbConnection`.
    /// A connection may either `Subscribe` to particular queries,
    /// or `SubscribeToAllTables`, but not both.
    /// Attempting to call `Subscribe`
    /// on a `DbConnection` that has previously used `SubscribeToAllTables`,
    /// or vice versa, may misbehave in any number of ways,
    /// including dropping subscriptions or corrupting the client cache.
    /// </summary>
    public void SubscribeToAllTables();
}
```
:::

A `SubscriptionBuilder` provides an interface for registering subscription queries with a database.
It allows you to register callbacks that run when the subscription is successfully applied or when an error occurs.
Once applied, a client will start receiving row updates to its client cache.
A client can react to these updates by registering row callbacks for the appropriate table.

It is important to note that subscriptions must be disjoint from one another.
Two subscriptions that return the same row may result in a corrupted client cache.
That is, one that does not accurately and consistently reflect the state of the database.

### Example Usage

:::server-rust
```rust
// Establish a database connection
let conn: DbConnection = connect_to_db();

// Register a subscription with the database
let subscription_handle = conn
    .subscription_builder()
    .on_applied(|ctx| { /* handle applied state */ })
    .on_error(|error_ctx, error| { /* handle error */ })
    .subscribe("SELECT * FROM my_table WHERE active = 1");
```
:::
:::server-csharp
```cs
// Establish a database connection
var conn = ConnectToDB();

// Register a subscription with the database
var userSubscription = conn
    .SubscriptionBuilder()
    .OnApplied((ctx) => { /* handle applied state */ })
    .OnError((errorCtx, error) => { /* handle error */ })
    .Subscribe("SELECT * FROM user");
```
:::

## SubscriptionHandle

:::server-rust
```rust
pub trait SubscriptionHandle: InModule + Clone + Send + 'static
where
    Self::Module: SpacetimeModule<SubscriptionHandle = Self>,
{
    /// Returns `true` if the subscription has been ended.
    /// That is, if it has been unsubscribed or terminated due to an error.
    fn is_ended(&self) -> bool;

    /// Returns `true` if the subscription is currently active.
    fn is_active(&self) -> bool;

    /// Unsubscribe from the query controlled by this `SubscriptionHandle`,
    /// then run `on_end` when its rows are removed from the client cache.
    /// Returns an error if the subscription is already ended,
    /// or if unsubscribe has already been called.
    fn unsubscribe_then(self, on_end: OnEndedCallback<Self::Module>) -> crate::Result<()>;

    /// Unsubscribe from the query controlled by this `SubscriptionHandle`.
    /// Returns an error if the subscription is already ended,
    /// or if unsubscribe has already been called.
    fn unsubscribe(self) -> crate::Result<()>;
}
```
:::
:::server-csharp
```cs
    public class SubscriptionHandle<SubscriptionEventContext, ErrorContext> : ISubscriptionHandle
        where SubscriptionEventContext : ISubscriptionEventContext
        where ErrorContext : IErrorContext
    {
        /// <summary>
        /// Whether the subscription has ended.
        /// </summary>
        public bool IsEnded;

        /// <summary>
        /// Whether the subscription is active.
        /// </summary>
        public bool IsActive;

        /// <summary>
        /// Unsubscribe from the query controlled by this subscription handle.
        /// 
        /// Calling this more than once will result in an exception.
        /// </summary>
        public void Unsubscribe();

        /// <summary>
        /// Unsubscribe from the query controlled by this subscription handle,
        /// and call onEnded when its rows are removed from the client cache.
        /// </summary>
        public void UnsubscribeThen(Action<SubscriptionEventContext>? onEnded);
    }
```
:::

When you register a subscription, you receive a `SubscriptionHandle`.
A `SubscriptionHandle` manages the lifecycle of each subscription you register.
In particular, it provides methods to check the status of the subscription and to unsubscribe if necessary.
Because each subscription has its own independently managed lifetime,
clients can dynamically subscribe to different subsets of the database as their application requires.

### Example Usage

:::server-rust
Consider a game client that displays shop items based on a player's level.
You subscribe to the following `shop_items` when a player is at level 5.

```rust
let conn: DbConnection = connect_to_db();

let shop_items_subscription = conn
    .subscription_builder()
    .on_applied(|ctx| { /* handle applied state */ })
    .on_error(|error_ctx, error| { /* handle error */ })
    .subscribe("SELECT * FROM shop_items WHERE required_level <= 5");
```

Later, when the player reaches level 6 and new items become available,
you unsubscribe from the old query and subscribe again with a new one:

```rust
if shop_items_subscription.is_active() {
    shop_items_subscription
        .unsubscribe()
        .expect("Unsubscribing from shop_items failed");
}

let shop_items_subscription = conn
    .subscription_builder()
    .on_applied(|ctx| { /* handle applied state */ })
    .on_error(|error_ctx, error| { /* handle error */ })
    .subscribe("SELECT * FROM shop_items WHERE required_level <= 6");
```

All other subscriptions continue to remain in effect.
:::
:::server-csharp
Consider a game client that displays shop items based on a player's level.
You subscribe to the following `shop_items` when a player is at level 5.

```cs
var conn = ConnectToDB();

var shopItemsSubscription = conn
    .SubscriptionBuilder()
    .OnApplied((ctx) => { /* handle applied state */ })
    .OnError((errorCtx, error) => { /* handle error */ })
    .Subscribe("SELECT * FROM shop_items WHERE required_level <= 5");
```

Later, when the player reaches level 6 and new items become available,
you unsubscribe from the old query and subscribe again with a new one:

```cs
if (shopItemsSubscription.IsActive)
{
    shopItemsSubscription.Unsubscribe();
}

var shopItemsSubscription = conn
    .SubscriptionBuilder()
    .OnApplied((ctx) => { /* handle applied state */ })
    .OnError((errorCtx, error) => { /* handle error */ })
    .Subscribe("SELECT * FROM shop_items WHERE required_level <= 6");
```

All other subscriptions continue to remain in effect.
:::
