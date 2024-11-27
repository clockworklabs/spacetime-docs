# SQL Support

SpacetimeDB supports two subsets of SQL:
One for ad hoc queries against the database,
which can be made through the [cli] or the [http] endpoint.
Another for subscriptions made through the [websocket] api or [sdk].

## Subscriptions

```ebnf
SELECT projection FROM relation [ WHERE predicate ]
```

The subscription language is strictly a query language.
Its sole purpose is to replicate a subset or view of the database,
and to **automatically** update that view in realtime as the database changes.

There is no context for manually updating this view.
Hence data manipulation commands like `INSERT` and `DELETE` are not supported.

> NOTE: Because subscriptions are evaluated in realtime,
> performance is critical, and as a result,
> additional restrictions are applied over ad hoc queries.
> These restrictions are highlighted below.

### SELECT

```ebnf
SELECT ( '*' | table '.' '*' )
```

The `SELECT` clause determines the table that is being subscribed to.
A subscription query may only return rows from a single table,
and it must return the entire row.
Individual column projections are not allowed.

A wildcard projection `*` is allowed when the table is unambiguous,
but when a query contains multiple table references,
a qualified wildcard projection `.*` is necessary.

### FROM

```ebnf
FROM table [ [AS] alias ] [ [INNER] JOIN table [ [AS] alias ] ON predicate ]
```

While you can only subscribe to rows from a single table,
you may reference two tables in the `FROM` clause using a `JOIN`.
A `JOIN` selects all combinations of rows from its input tables,
and `ON` determines which combinations are considered.

> IMPORTANT: If a `JOIN` is used,
> an index **must** be defined on the join column of both tables,
> so that it can be evaluated efficiently.

### WHERE

```ebnf
predicate
    = expr
    | predicate AND predicate
    ;

expr
    = literal
    | column
    | expr op expr
    ;

op
    = '='
    | '<'
    | '>'
    | '<' '='
    | '>' '='
    ;

literal
    = INTEGER
    | STRING
    | HEX
    | TRUE
    | FALSE
    ;
```

While the `SELECT` clause determines the table,
the `WHERE` clause determines the rows in the subscription.

Note the subscription language does not yet support `!=` comparisons.
It does support conjunctions in the form of `AND` expressions,
and while disjunctions in the form of `OR` expressions are not yet supported,
they can still be expressed by subscribing to multiple queries.

```sql
-- Which items in my inventory have been purchased and are more than $X?
SELECT item
FROM Inventory item
JOIN Orders order
ON item.item_id = order.item_id
WHERE item.price > {X}

-- Which items in my inventory have been purchased and are less than $Y?
SELECT item
FROM Inventory item
JOIN Orders order
ON item.item_id = order.item_id
WHERE item.price < {Y}
```

> NOTE: Arithmetic expressions will be supported in the future.

## Query and DML

### Statements

- [SELECT](#select)
- [INSERT](#insert)
- [DELETE](#delete)
- [UPDATE](#update)
- [SET](#set)
- [SHOW](#show)

### SELECT

```ebnf
SELECT [ DISTINCT ] projection FROM relation [ [ WHERE predicate ] [ ORDER BY order ] [ LIMIT limit ] ]
```

#### SELECT Clause

```ebnf
projection
    = '*'
    | table '.' '*'
    | projExpr { ',' projExpr }
    | aggrExpr { ',' aggrExpr }
    ;

projExpr
    = column [ [ AS ] alias ]
    ;

aggrExpr
    = COUNT '(' STAR ')' [AS] alias
    | COUNT '(' DISTINCT column ')' [AS] alias
    | SUM   '(' column ')' [AS] alias
    ;
```

The `SELECT` clause determines the columns that are returned.
In particular it supports both column and wildcard projections.
It also supports `sum` and `count` aggregation.

If `DISTINCT` is specified, only unique rows are returned.
However each projected column must be of a type that allows comparison.

Examples:
```sql
-- Select the items in my inventory
SELECT * FROM Inventory;

-- Select the names of the items in my inventory
SELECT item_name FROM Inventory

-- How many items are in my inventory?
SELECT COUNT(*) as num_items FROM Inventory
```

#### FROM Clause

```ebnf
FROM table [ [AS] alias ] { [INNER] JOIN table [ [AS] alias ] ON predicate }
```

> NOTE: The query language supports joins among an arbitrary number of tables.
> It does not impose any index restrictions like the subscription language.

Examples:
```sql
-- Which orders include currently stocked items?
SELECT order.*
FROM Orders order
JOIN Inventory inv
ON order.item_id = inv.item_id
```

#### WHERE Clause

```ebnf
predicate
    = expr
    | predicate AND predicate
    | predicate OR  predicate
    ;

expr
    = literal
    | column
    | expr op expr
    ;

op
    = '='
    | '<'
    | '>'
    | '<' '='
    | '>' '='
    | '!' '='
    | '<' '>'
    ;

literal
    = INTEGER
    | FLOAT
    | STRING
    | HEX
    | TRUE
    | FALSE
    ;
```

The query language supports both conjunctions and disjunctions.
It also supports `!=` comparisons.

> NOTE: Arithmetic expressions will be supported in the future.

Examples:
```sql
SELECT * FROM Inventory WHERE item_id = 1;
```

#### ORDER BY Clause

```ebnf
ORDER BY column [ ASC | DESC ] { ',' column [ ASC | DESC ] }
```

`ORDER BY` sorts the result set by one or more of the projected columns.
Ascending is the default behavior if not qualified.
Each column involved must be of a type that allows comparison.

> NOTE: Comparison is not supported for `sum`, `product`, or `array` types.

Examples:
```sql
-- Sort the items in the inventory by order of increasing price
SELECT * FROM Inventory ORDER BY price;

-- Sort the items in the inventory by order of decreasing price
SELECT * FROM Inventory ORDER BY price DESC
```

#### LIMIT Clause

```ebnf
LIMIT INTEGER
```

`LIMIT` restricts the number of rows returned.

> Note: Negative integer arguments are invalid.

Examples:
```sql
-- What are the 5 highest priced items in my inventory?
SELECT * FROM Inventory ORDER BY price LIMIT 5;
```

### INSERT

```ebnf
INSERT INTO table [ '(' column { ',' column } ')' ] VALUES '(' literal { ',' literal } ')'
```

Examples:
```sql
-- Inserting one row
INSERT INTO Inventory (item_id, item_name) VALUES (1, 'health1');

-- Inserting two rows
INSERT INTO Inventory (item_id, item_name) VALUES (1, 'health1'), (2, 'health2');
```

### DELETE

```ebnf
DELETE FROM table [ WHERE predicate ]
```

Deletes all rows from a table.
If `WHERE` is specified, only the matching rows are deleted.

Examples:
```sql
-- Delete all rows
DELETE FROM Inventory;

-- Delete all rows with a specific item_id
DELETE FROM Inventory WHERE item_id = 1;
```

### UPDATE

```ebnf
UPDATE table SET [ '(' assignment { ',' assignment } ')' ] [ WHERE predicate ]
```

Updates column values of existing rows in a table.
The columns are identified by the `assignment` defined as `column '=' expr`.
The column values are updated for all rows that match the `WHERE` condition.
The rows are updated after the `WHERE` condition is evaluated for all rows.

Examples:
```sql
-- Update the item_name for all rows with a specific item_id
UPDATE Inventory SET item_name = 'new name' WHERE item_id = 1;
```

### SET

> WARNING: This statement is not part of the stable API.
> Its compatibility with future versions of SpacetimeDB is not guaranteed.

```ebnf
SET var ( TO | '=' ) literal
```

Updates the value of a system variable.

### SHOW

> WARNING: This statement is not part of the stable API.
> Its compatibility with future versions of SpacetimeDB is not guaranteed.

```ebnf
SHOW var
```

Returns the value of a system variable.

## System Variables

> WARNING: System variables are not part of the stable API.
> Their compatibility with future versions of SpacetimeDB is not guaranteed.

- `row_limit`

    This system variable defines a cardinality threshold.
    Queries are rejected if their estimated cardinality exceeds it.

    Ex.
    ```sql
    -- Reject queries that read more than 10K rows
    SET row_limit = 10000
    ```

## Data types

SpacetimeDB data types are defined by [SATS],
the Spacetime Algebraic Type System,
and tuples are stored or encoded using [BSATN],
the Binary Spacetime Algebraic Type Notation format.

Spacetime SQL however does not support all of [SATS].
In particular it has limited support for [products] and [sums].
The language itself does not provide a way to construct them,
nor does it provide scalar operations on top of them,
the one exception being equality comparison.
However the language does allow for reading them from tables,
as well as returning them from queries.

## Literals

```ebnf
literal = INTEGER | FLOAT | STRING | HEX | TRUE | FALSE ;
```

For each of the following [SATS] data types,
we describe how to express their literal values in Spacetime SQL.

### Bool

In Spacetime SQL, the [boolean] Algebraic Type,
representing the two truth values of boolean logic,
is expressed using the canonical atoms `true` or `false`.

### Integer

The construction of [integer] values in Spacetime SQL.
The concrete [SATS] type is inferred from the context.

```ebnf
INTEGER
    = [ '+' | '-' ] NUM
    | [ '+' | '-' ] NUM 'E' [ '+' | '-' ] NUM
    ;

NUM
    = DIGIT { DIGIT }
    ;

DIGIT
    = 0..9
    ;
```

### Float

The construction of [IEEE 754] [float] values in Spacetime SQL.
The concrete [SATS] type is inferred from the context.

```ebnf
FLOAT
    = [ '+' | '-' ] [ NUM ] '.' NUM
    | [ '+' | '-' ] [ NUM ] '.' NUM 'E' [ '+' | '-' ] NUM
    ;
```

### String

The construction of variable length string values in Spacetime SQL,
where `CHAR` is a `utf-8` encoded unicode character.

```ebnf
STRING
    = "'" { "''" | CHAR } "'"
    ;
```

### Hex

Hexidecimal literals represent either [Identity] or [Address] types.
The type is ultimately inferred from the context.

```ebnf
HEX
    = 'X' "'" { HEXIT } "'"
    | '0' 'x' { HEXIT }
    ;

HEXIT
    = DIGIT | a..f | A..F
    ;
```

## Identifiers

```ebnf
identifier
    = LATIN { LATIN | DIGIT | '_' }
    | '"' { '""' | CHAR } '"'
    ;

LATIN
    = a..z | A..Z
    ;
```

Identifiers are tokens that identify database objects like tables or columns.
Spacetime SQL supports both quoted and unquoted identifiers.
Quoted identifiers are case sensitive,
whereas unquoted identifiers are case insensitive.
Column references may also be qualified with a table name.

```ebnf
table
    = identifier
    ;

alias
    = identifier
    ;

var
    = identifier
    ;

column
    = identifier
    | identifier '.' identifier
    ;
```


[sdk]:       /docs/sdks/rust/index.md#subscribe-to-queries
[cli]:       /docs/http/database#databasesqlname_or_address-post
[http]:      /docs/http/database#databasesqlname_or_address-post
[websocket]: /docs/ws#subscribe

[sats]:     /docs/satn.md
[bsatn]:    /docs/bsatn.md
[boolean]:  /docs/satn.md#builtintype
[integer]:  /docs/satn.md#builtintype
[floats]:   /docs/satn.md#builtintype
[sums]:     /docs/satn.md#sumtype
[products]: /docs/satn.md#producttype
[Identity]: /docs/index.md#identities
[Address]:  /docs/index.md#addresses

[IEEE 754]: https://en.wikipedia.org/wiki/IEEE_754
