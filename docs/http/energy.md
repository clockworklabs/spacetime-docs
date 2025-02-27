# `/v1/energy` HTTP API

The HTTP endpoints in `/v1/energy` allow clients to query identities' energy balances. Spacetime databases expend energy from their owners' balances while executing reducers.

## At a glance

| Route                                               | Description                                               |
| --------------------------------------------------- | --------------------------------------------------------- |
| [`GET /v1/energy/:identity`](#get-v1energyidentity) | Get the remaining energy balance for the user `identity`. |

## `GET /v1/energy/:identity`

Get the energy balance of an identity.

Accessible through the CLI as [`spacetime energy balance`](/docs/cli-reference#spacetime-energy-balance).

#### Path parameters

| Name        | Value                   |
| ----------- | ----------------------- |
| `:identity` | The Spacetime identity. |

#### Returns

Returns JSON in the form:

```typescript
{
    "balance": string
}
```

| Field     | Value                                                                                                                                                          |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `balance` | The identity's energy balance, as a decimal integer. Note that energy balances may be negative, and will frequently be too large to store in a 64-bit integer. |
