# TypeScript Client SDK Quickstart

In this guide, you'll learn how to use TypeScript to create a SpacetimeDB client application. While we currently support TypeScript as a client language, we do not yet support writing SpacetimeDB server modules in TypeScript.

**Before you get started on this guide**, you should complete one of the quickstart guides for creating a SpacetimeDB server module listed below.

- [Rust](/docs/modules/rust/quickstart)
- [C#](/docs/modules/csharp/quickstart)

By the end of this introduciton, you will have created a basic single page web app for the module created in the above module quickstart guides.

## Project structure

Enter the directory `quickstart-chat` you created in the [Rust Module Quickstart](/docs/modules/rust/quickstart) or [C# Module Quickstart](/docs/modules/c-sharp/quickstart) guides:

```bash
cd quickstart-chat
```

Within it, create a `client` react app:

```bash
pnpm create vite@latest client -- --template react-ts
cd client
pnpm install
```

We also need to install the `spacetime-client-sdk` package:

```bash
pnpm install @clockworklabs/spacetimedb-sdk@1.0.0-rc1.0
```

> If you are using another package manager like `yarn` or `npm` the same steps should work with the appropriate commands for those tools.

If you like, you can now run `pnpm run dev` to see the vite template app running at `http://localhost:5173`.

## Basic layout

The app we're going to create is a basic chat application. We are going to start by creating a layout for our app. The webpage page will contain four sections:

1. A profile section, where we can set our name.
2. A message section, where we can see all the messages.
3. A system section, where we can see system messages.
4. A new message section, where we can send a new message.

Replace the entire contents of `client/src/App.tsx` with the following:

```tsx
import React, { useEffect, useState } from "react";
import "./App.css";

export type PrettyMessage = {
  senderName: string;
  text: string;
};

function App() {
  const [newName, setNewName] = useState("");
  const [settingName, setSettingName] = useState(false);
  const [name, setName] = useState("");
  const [systemMessage, setSystemMessage] = useState("");
  const [newMessage, setNewMessage] = useState("");

  const prettyMessages: PrettyMessage[] = [];

  const onSubmitNewName = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSettingName(false);
    // Fill in app logic here
  };

  const onSubmitMessage = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setNewMessage("");
    // Fill in app logic here
  };

  return (
    <div className="app">
      <div className="profile">
        <h1>Profile</h1>
        {!settingName ? (
          <>
            <p>{name}</p>
            <button
              onClick={() => {
                setSettingName(true);
                setNewName(name);
              }}
            >
              Edit Name
            </button>
          </>
        ) : (
          <form onSubmit={onSubmitNewName}>
            <input
              type="text"
              style={{ marginBottom: "1rem" }}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button type="submit">Submit</button>
          </form>
        )}
      </div>
      <div className="message">
        <h1>Messages</h1>
        {prettyMessages.length < 1 && <p>No messages</p>}
        <div>
          {prettyMessages.map((message, key) => (
            <div key={key}>
              <p>
                <b>{message.senderName}</b>
              </p>
              <p>{message.text}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="system" style={{ whiteSpace: "pre-wrap" }}>
        <h1>System</h1>
        <div>
          <p>{systemMessage}</p>
        </div>
      </div>
      <div className="new-message">
        <form
          onSubmit={onSubmitMessage}
          style={{
            display: "flex",
            flexDirection: "column",
            width: "50%",
            margin: "0 auto",
          }}
        >
          <h3>New Message</h3>
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
          ></textarea>
          <button type="submit">Send</button>
        </form>
      </div>
    </div>
  );
}

export default App;
```

We have configured the `onSubmitNewName` and `onSubmitMessage` callbacks to be called when the user clicks the submit button in the profile and new message sections, respectively. For now, they do nothing when called, but later we'll add some logic to call SpacetimeDB reducers when these callbacks are called.

Now when you run `pnpm run dev` and open `http://localhost:5173`, you should see a basic chat app that does not yet send or receive messages.

## Generate your module types

The `spacetime` CLI's `generate` command will generate client-side interfaces for the tables, reducers and types defined in your server module.

In your `quickstart-chat` directory, run:

```bash
mkdir -p client/src/module_bindings
spacetime generate --lang typescript --out-dir client/src/module_bindings --project-path server
```

> This command assumes you've already created a server module in `quickstart-chat/server`.

Take a look inside `client/src/module_bindings`. The CLI should have generated several files:

```
module_bindings
├── identity_connected_reducer.ts
├── identity_disconnected_reducer.ts
├── index.ts
├── init_reducer.ts
├── message_table.ts
├── message_type.ts
├── send_message_reducer.ts
├── set_name_reducer.ts
├── user_table.ts
└── user_type.ts
```

With `spacetime generate` we have generated TypeScript types derived from the types you specified in your module, which we can conveniently use in our client. The main entry to the SpacetimeDB API is via the `DBConnection` which was generated into the `module_bindings` folder. Let's import it and a few other types into our `client/src/App.tsx`.

```tsx
import { DBConnection } from './module_bindings';
import { Identity } from '@clockworklabs/spacetimedb-sdk';
```

## Create your SpacetimeDB client

Now that we've imported the `DBConnection` type we can use it to connect our app to our module.

Add the following `App` function, just below `const [newMessage, setNewMessage] = useState("");`:

```tsx
  const [connected, setConnected] = useState<boolean>(false);
  const [identity, setIdentity] = useState<Identity | null>(null);

  const [conn] = useState(DBConnection.builder()
      .withUri('ws://localhost:3000')
      .withModuleName('quickstart-chat')
      .onConnect((conn, identity, token) => {
        setIdentity(identity);
        setConnected(true);

        console.log("Connected to SpacetimeDB with identity:", identity.toHexString());

        // Subscribe to the `message` table.
        conn.subscriptionBuilder().onApplied(() => {
          console.log("SDK client cache initialized.");
        }).subscribe(['SELECT * FROM message']);
      })
      .onConnectError((_conn, err) => {
        console.error("Error connecting to SpacetimeDB:", err);
      })
      .onDisconnect(() => {
        console.log("Disconnected from SpacetimeDB");
        setConnected(false);
      })
      .build()
  );
```

Here we are configuring our SpacetimeDB connection by specifying the server URI, module name, and an `onConnect` callback. When `onConnect` is called after connecting, we store the connection state, our `Identity`, and our SpacetimeDB credentials in our React state. If there is an error connecting, we print that error to the console as well.

If you chose a different name for your module, replace `quickstart-chat` with that name, or republish your module as `quickstart-chat`.

In this case, we are not connecting to SpacetimeDB with pre-existing credentials so SpacetimeDB is assigning us a new `Identity` and token on connection. In order to connect to SpacetimeDB as the same user after refreshing, let's store the credentials in `localStorage` and pass them in when connecting. Modify your code with the following:

```tsx
  const [connected, setConnected] = useState<boolean>(false);
  const [identity, setIdentity] = useState<Identity | null>(null);

  const [conn] = useState(DBConnection.builder()
      .withUri('ws://localhost:3000')
      .withModuleName('quickstart-chat')
      .withToken(localStorage.getItem('auth_token') || undefined)
      .onConnect((conn, identity, token) => {
        setIdentity(identity);
        setConnected(true);
        localStorage.setItem('auth_token', token);

        console.log("Connected to SpacetimeDB with identity:", identity.toHexString());

        // Subscribe to the `message` table.
        conn.subscriptionBuilder().onApplied(() => {
          console.log("SDK client cache initialized.");
        }).subscribe(['SELECT * FROM message']);
      })
      .onConnectError((_conn, err) => {
        console.error("Error connecting to SpacetimeDB:", err);
      })
      .onDisconnect(() => {
        console.log("Disconnected from SpacetimeDB");
        setConnected(false);
      })
      .build()
  );
```

In the `onConnect` function we are also subscribing to the `message` table. When we subscribe, SpacetimeDB will run our subscription queries and store the result in a local "SDK client cache". This cache will be updated in real-time as the data in the table changes on the server. The `onApplied` callback is called after SpacetimeDB has synchronized our subscribed data with the client cache.

### Accessing the Data

Once SpacetimeDB is connected, we can easily access the data inside of the client cache using our connection. The `conn.db` field allows you to access all of the tables of your database. Those tables will contain all data which you have subscribed to in your subscription configuration.

Let's create custom React hooks for the `message` and `user` tables. Add the following code above your `App` component:

```tsx
function useMessages(conn: DBConnection): Message[] {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    const onInsert = (_ctx: EventContext, message: Message) => {
      setMessages((prev) => [...prev, message]);
    };
    conn.db.message.onInsert(onInsert);

    const onDelete = (_ctx: EventContext, message: Message) => {
      setMessages((prev) => prev.filter((m) => m.text !== message.text && m.sent !== message.sent && m.sender !== message.sender));
    };
    conn.db.message.onDelete(onDelete);

    return () => {
      conn.db.message.removeOnInsert(onInsert);
      conn.db.message.removeOnDelete(onDelete);
    };
  }, [conn]);

  return messages;
}

function useUsers(conn: DBConnection): Map<string, User> {
  const [users, setUsers] = useState<Map<string, User>>(new Map());

  useEffect(() => {
    const onInsert = (_ctx: EventContext, user: User) => {
      setUsers((prev) => new Map(prev.set(user.identity.toHexString(), user)));
    };
    conn.db.user.onInsert(onInsert);

    const onUpdate = (_ctx: EventContext, oldUser: User, newUser: User) => {
      setUsers((prev) => {
        prev.delete(oldUser.identity.toHexString());
        return new Map(prev.set(newUser.identity.toHexString(), newUser));
      });
    };
    conn.db.user.onUpdate(onUpdate);

    const onDelete = (_ctx: EventContext, user: User) => {
      setUsers((prev) => {
        prev.delete(user.identity.toHexString());
        return new Map(prev);
      });
    };
    conn.db.user.onDelete(onDelete);

    return () => {
      conn.db.user.removeOnInsert(onInsert);
      conn.db.user.removeOnUpdate(onUpdate);
      conn.db.user.removeOnDelete(onDelete);
    };
  }, [conn]);

  return users;
}
```

These custom React hooks update the React state anytime a row in our tables change, causing React to rerender.

> In principle, it should be possible to automatically generate these hooks based on your module's schema, or use [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore). For simplicity, rather than creating them mechanically, we're just going to do it manually.

Let's now prettify our messages in our render function by sorting them by their `sent` timestamp, and joining the username of the sender to the message by looking up the user by their `Identity` in the `user` table. Replace `const prettyMessages: PrettyMessage[] = []` with the below.

```tsx
  const messages = useMessages(conn);
  const users = useUsers(conn);

  const prettyMessages: PrettyMessage[] = messages 
    .sort((a, b) => a.sent > b.sent ? 1 : -1)
    .map((message) => ({
      senderName: users.get(message.sender)?.name || message.sender.toHexString().substring(0, 8),
      text: message.text,
    }));
```

That's all we have to do to hook up our SpacetimeDB state to our React state. SpacetimeDB will make sure that any change on the server gets pushed down to our application and rerendered on screen in real-time.

### Calling Reducers

Let's hook up our callbacks so we can send some messages and see them displayed in the app after being synchronized by SpacetimeDB. We need to update the `onSubmitNewName` and `onSubmitMessage` callbacks to send the appropriate reducer to the module.

Modify the `onSubmitNewName` callback by adding a call to the `setName` reducer:

```tsx
  const onSubmitNewName = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSettingName(false);
    conn.reducers.setName(newName);
  };
```

Next modify the `onSubmitMessage` callback by adding a call to the `sendMessage` reducer:

```tsx
  const onMessageSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setNewMessage("");
    conn.reducers.sendMessage(newMessage);
  };
```

SpacetimeDB generated these functions for us based on the type information provided by our module. Calling these functions will invoke our reducers in our module.

Let's try out our app to see the result of these changes.

```sh
cd client
pnpm run dev
```

> Don't forget! You may need to publish your server module if you haven't yet.

Send some messages and update your username and watch it change in real-time. Note that when you update your username it also updates immediately for all prior messages. This is because the messages store the user's `Identity` directly, instead of their username, so we can retroactively apply their username to all prior messages.

Try opening a few incognito windows to see what it's like with multiple users!

### Notify about new users

We can also register `onInsert` and `onDelete` callbacks for the purpose of handling events, not just state. For example, we might want to show a notification any time a new user connects to the module.

Note that these callbacks can fire in two contexts:

- After a reducer runs, when the client's cache is updated about changes to subscribed rows.
- After calling `subscribe`, when the client's cache is initialized with all existing matching rows.

Our `user` table includes all users not just online users, so we want to take care to only show a notification when new users join. Let's add a `useEffect` which subscribes a callback when a `user` is inserted into the table and a callback when a `user` is updated.

```tsx
  useEffect(() => {
    if (!conn) return;
    conn.db.user.onInsert((_ctx, user) => {
      if (user.online) {
        setSystemMessage(prev => prev.join(`${user.name} has connected.`, \n));
      }
    });
    conn.db.user.onUpdate((_ctx, oldUser, newUser) => {
      if (oldUser.online === false && newUser.online === true) {
        setSystemMessage(`${newUser.name} has connected.`);
      } else if (oldUser.online === true && newUser.online === false) {
        setSystemMessage(`${oldUser.name} has disconnected.`);
      }
    });
  }, [conn]);
```

Here we post a message saying a new user has connected if the user is being added to the `user` table and they're online, or if an existing user's online status is being set to "online".

Note that `onInsert` and `onDelete` callbacks takes two arguments: an `EventContext` and the row. The `EventContext` can be used just like the `DBConnection` and has all the same access functions, in addition to containing information about the event that triggered this callback. For now, we can ignore this argument though, since we have all the info we need in the user rows.

## Conclusion

Congratulations! You've built a simple chat app with SpacetimeDB. You can find the full source code for this app [here](https://github.com/clockworklabs/spacetimedb-typescript-sdk/tree/main/examples/quickstart)

At this point you've learned how to create a basic TypeScript client for your SpacetimeDB `quickstart-chat` module. You've learned how to connect to SpacetimeDB and call reducers to update data. You've learned how to subscribe to table data, and hook it up so that it updates reactively in a React application.

## What's next?

We covered a lot here, but we haven't covered everything. Take a look at our [reference documentation](/docs/sdks/typescript) to find out how you can use SpacetimeDB in more advanced ways, including managing reducer errors and subscribing to reducer events.