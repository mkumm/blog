---
title: 'Elixir Events Lab'
description: 'A hands-on lab on event sourcing in Elixir: build a vending machine that stores what happened instead of its current state, rebuild state by replaying events, and answer questions nobody planned for.'
pubDate: 'Oct 14 2026'
topic: 'Elixir Events'
level: 'Intermediate'
duration: 45
audience: 'Elixir developers who know pattern matching and have written a GenServer'
levelFrom: 'Stores current state in a table and updates it in place'
levelTo: 'Can model a system as events, rebuild state by replaying them, and answer new questions from old history'
---

A hands-on, ~45 minute lab on event sourcing in Elixir. You will build a vending machine that never stores its current state. Instead it stores everything that happened (coins in, snacks out, restocks, the owner emptying the cash box) and works out the present by replaying the past. By the end you can model a system as events, rebuild state from them in a supervised process, and answer questions about the history that nobody planned for when it was recorded.

It assumes you are comfortable with pattern matching, `Enum.reduce/3`, and the basics of a GenServer. The database, migrations, and supervision tree are already done in the starter repo, so all 45 minutes go on the event-sourcing part.

Everything here was run with Elixir 1.18.4 on Erlang/OTP 28, on macOS. Anything from Elixir 1.15 up should behave the same.

| Part | Topic | Time |
| --- | --- | --- |
| 1 | The mental model | 4 min |
| 2 | The events | 5 min |
| 3 | Replaying history | 8 min |
| 4 | Deciding what happens | 8 min |
| 5 | A machine that survives a crash | 7 min |
| 6 | Scenarios | 13 min |

## Setup

```sh
git clone https://github.com/mkumm/elixir-events-lab.git
cd elixir-events-lab
mix setup        # deps, SQLite database, and a week of seeded history
iex -S mix
```

`mix setup` ends with `Seeded 782 events for the "lobby" machine.` SQLite is bundled, so there is no database server to install. If you ever want a clean slate, `mix reset` drops the database and reseeds it.

The repo has two branches. `main` is the starter you work on. `solution` has the finished code if you get stuck.

What is already there:

| File | What it does |
| --- | --- |
| `lib/vend/events.ex` | The five event structs |
| `lib/vend/event_store.ex` | `append/2` and `read/1` over one SQLite table |
| `lib/vend/catalog.ex` | Six slots, `"A1"` to `"B3"`, with names and prices |
| `lib/vend/application.ex` | Supervision tree: Repo, a Registry, and a commented-out slot for your machine |
| `priv/repo/seeds.exs` | One week of history for a machine called `"lobby"` |
| `.iex.exs` | Aliases, so you can type `EventStore` instead of `Vend.EventStore` |

All money is in cents. `150` is $1.50.

## 1. The mental model

The usual way to build this would be a `machines` table with a `cash` column and a `stock` column, and every sale runs an `UPDATE`. That works, but it throws information away: once `cash` goes from 6,625 to 6,775 you no longer know why.

Event sourcing keeps the why and derives the what:

```
command          decide/2          events            evolve/2          state
{:select, "A3"} ──────────▶ [ItemSold, ChangeReturned] ──────────▶ %{cash, credit, stock}
                    ▲                    │
                    │                    ▼
                  state             event store (append only)
```

- **A command** is a request. It can be refused: "sell me A1" when A1 is empty.
- **An event** is a fact, in the past tense. It already happened, so it is never refused and never changed.
- **State** is whatever you get by folding the events in order. It is a cache. You can throw it away and rebuild it any time.

Two pure functions do all the work. `evolve(state, event)` applies one fact. `decide(state, command)` looks at the current state and returns the events a command would cause, or an error. Everything else (the GenServer, the database) is plumbing around those two.

## 2. The events

Open `lib/vend/events.ex`. There are five:

| Event | Fields | Meaning |
| --- | --- | --- |
| `CashInserted` | `amount` | A customer put money in. It becomes their credit |
| `ItemSold` | `slot`, `price` | An item dropped; its price came out of the credit |
| `ChangeReturned` | `amount` | The machine paid back leftover credit |
| `ItemRestocked` | `slot`, `quantity`, `unit_cost` | The owner loaded items, paying `unit_cost` each |
| `CashCollected` | `amount` | The owner emptied money from the cash box |

Every event also has an `at` timestamp. The event store saves it in its own column.

Look at some real ones:

```elixir
iex> events = EventStore.read("lobby")
iex> length(events)
782
iex> Enum.slice(events, 6, 5)
[
  %Vend.Events.CashInserted{amount: 200, at: ~U[2026-10-05 07:33:02.000000Z]},
  %Vend.Events.ItemSold{slot: "B1", price: 150, at: ~U[2026-10-05 07:33:02.000000Z]},
  %Vend.Events.ChangeReturned{amount: 50, at: ~U[2026-10-05 07:33:02.000000Z]},
  %Vend.Events.CashInserted{amount: 150, at: ~U[2026-10-05 08:45:43.000000Z]},
  %Vend.Events.ItemSold{slot: "A1", price: 150, at: ~U[2026-10-05 08:45:43.000000Z]}
]
```

The first customer of the week put in $2.00, bought a candy bar, and got 50 cents back. That one purchase is three events. The second customer paid exact change, so there is no `ChangeReturned`.

> [!note] Why the event store is so small
> Open `lib/vend/event_store.ex`. It is one table, `events`, with a stream id, a type name, a JSON `data` column, and a timestamp. `append/2` only inserts. There is no update and no delete anywhere in the app. That is the whole contract: history only grows.

> [!tip] Try it
> `ItemSold` records the price but not what the item cost the owner. Where does cost live instead, and why might that be a better place for it?
>
> > [!success]- Answer
> > Cost lives on `ItemRestocked`, because that is the moment the owner actually pays it. A sale doesn't know what was paid for the item; it only knows what the customer paid. Recording each fact where it happens means you don't have to guess at it later. Scenario C uses this.

## 3. Replaying history

Create `lib/vend/vending.ex`:

```elixir
defmodule Vend.Vending do
  alias Vend.Catalog
  alias Vend.Events.{CashInserted, ItemSold, ChangeReturned, ItemRestocked, CashCollected}

  # cash:   money physically in the machine
  # credit: the part of it that belongs to the customer at the front
  defstruct cash: 0, credit: 0, stock: %{}

  def new, do: %__MODULE__{stock: Map.new(Catalog.slots(), &{&1, 0})}

  def replay(events) do
    Enum.reduce(events, new(), fn event, state -> evolve(state, event) end)
  end

  def evolve(state, %CashInserted{amount: amount}) do
    %{state | cash: state.cash + amount, credit: state.credit + amount}
  end

  def evolve(state, %ItemSold{slot: slot, price: price}) do
    %{state | credit: state.credit - price, stock: Map.update!(state.stock, slot, &(&1 - 1))}
  end

  def evolve(state, %ChangeReturned{amount: amount}) do
    %{state | cash: state.cash - amount, credit: state.credit - amount}
  end

  def evolve(state, %ItemRestocked{slot: slot, quantity: quantity}) do
    %{state | stock: Map.update!(state.stock, slot, &(&1 + quantity))}
  end
end
```

`replay/1` is a single `Enum.reduce/3`. Each `evolve/2` clause matches one event type and returns a new state. There is no validation here, and there shouldn't be: these things already happened. If a sale took the stock negative, the bug is in whatever allowed the sale, not in the replay.

> [!tip] Try it
> Add the missing `evolve/2` clause for `CashCollected`.
>
> > [!success]- Solution
> > ```elixir
> > def evolve(state, %CashCollected{amount: amount}) do
> >   %{state | cash: state.cash - amount}
> > end
> > ```
> > Collecting money doesn't touch `credit`. The owner only takes money that isn't owed to a customer, and `decide/3` will enforce that in Part 4.

Reload and replay the week:

```elixir
iex> recompile()
iex> Vending.replay(events)
%Vend.Vending{
  cash: 6625,
  credit: 0,
  stock: %{"A1" => 0, "A2" => 2, "A3" => 4, "B1" => 4, "B2" => 5, "B3" => 1}
}
```

That is the current state of the lobby machine: $66.25 in the box, nobody mid-purchase, and no Cola left in A1.

> [!tip] Try it
> When did A1 first run out? `Enum.scan/3` is like `reduce` but returns every intermediate state, not just the last.
>
> > [!success]- Solution
> > ```elixir
> > events
> > |> Enum.scan(Vending.new(), &Vending.evolve(&2, &1))
> > |> Enum.zip(events)
> > |> Enum.find(fn {state, _event} -> state.stock["A1"] == 0 end)
> > ```
> > The event that emptied it is an `ItemSold` for A1 at `2026-10-06 17:44:50`. That was Tuesday evening, and the machine wasn't restocked until Wednesday morning. A table with a `stock` column could tell you A1 is at zero now. It couldn't tell you this.

## 4. Deciding what happens

Now the other direction: a command comes in, and you check it against the current state. Add this to `Vend.Vending`:

```elixir
def decide(state, command, now \\ DateTime.utc_now())

def decide(_state, {:insert, amount}, now) when is_integer(amount) and amount > 0 do
  {:ok, [%CashInserted{amount: amount, at: now}]}
end

def decide(state, {:select, slot}, now) do
  with {:ok, %{price: price}} <- Catalog.fetch(slot),
       :ok <- in_stock(state, slot),
       :ok <- enough_credit(state, price) do
    sold = %ItemSold{slot: slot, price: price, at: now}

    case state.credit - price do
      0 -> {:ok, [sold]}
      change -> {:ok, [sold, %ChangeReturned{amount: change, at: now}]}
    end
  else
    :error -> {:error, :unknown_slot}
    error -> error
  end
end

# Part 4 Try it: :return_change and {:collect, amount} go here

def decide(_state, _command, _now), do: {:error, :invalid_command}

defp in_stock(state, slot) do
  if state.stock[slot] > 0, do: :ok, else: {:error, :sold_out}
end

defp enough_credit(state, price) do
  if state.credit >= price, do: :ok, else: {:error, {:insert_more, price - state.credit}}
end
```

All the rules live in `decide/3`, and it never changes anything. It only answers the question "if we did this, what would happen?" Notice that a single `{:select, slot}` can produce two events, a sale and the change. The `now` argument defaults to the current time but can be passed in, which makes `decide/3` easy to test.

Because `decide/3` always returns a list, give `evolve/2` a clause that takes one too. Put it above the event clauses:

```elixir
def evolve(state, events) when is_list(events) do
  Enum.reduce(events, state, fn event, state -> evolve(state, event) end)
end
```

That is the same reduce as `replay/1`, but it starts from any state, not just `new()`. `replay(events)` is now simply `evolve(new(), events)`.

Try it against the real state:

```elixir
iex> recompile()
iex> state = Vending.replay(events)
iex> Vending.decide(state, {:select, "A1"})
{:error, :sold_out}
iex> Vending.decide(state, {:select, "A3"})
{:error, {:insert_more, 175}}
iex> {:ok, events} = Vending.decide(state, {:insert, 200})
iex> state = Vending.evolve(state, events)
iex> {:ok, events} = Vending.decide(state, {:select, "A3"})
{:ok,
 [
   %Vend.Events.ItemSold{slot: "A3", price: 175, at: ~U[...]},
   %Vend.Events.ChangeReturned{amount: 25, at: ~U[...]}
 ]}
iex> Vending.evolve(state, events)
%Vend.Vending{
  cash: 6800,
  credit: 0,
  stock: %{"A1" => 0, "A2" => 2, "A3" => 3, "B1" => 4, "B2" => 5, "B3" => 1}
}
```

Two events from one command, applied in one call. The machine kept $1.75 of the $2.00, and A3 is down by one.

Nothing has been saved yet. You've been passing state around by hand. Part 5 wraps this in a process.

> [!tip] Try it
> Add two more commands, above the catch-all clause:
> 1. `:return_change` gives back all of the customer's credit, or returns `{:error, :no_credit}` if there is none.
> 2. `{:collect, amount}` lets the owner take cash, but never money that belongs to a customer. Return `{:error, :not_enough_cash}` if they ask for too much.
>
> > [!success]- Solution
> > ```elixir
> > def decide(%{credit: 0}, :return_change, _now), do: {:error, :no_credit}
> >
> > def decide(state, :return_change, now) do
> >   {:ok, [%ChangeReturned{amount: state.credit, at: now}]}
> > end
> >
> > def decide(state, {:collect, amount}, now) when is_integer(amount) and amount > 0 do
> >   if amount <= state.cash - state.credit do
> >     {:ok, [%CashCollected{amount: amount, at: now}]}
> >   else
> >     {:error, :not_enough_cash}
> >   end
> > end
> > ```
> > `{:restock, slot, quantity, unit_cost}` works the same way and is on the `solution` branch.

## 5. A machine that survives a crash

Create `lib/vend/machine.ex`:

```elixir
defmodule Vend.Machine do
  use GenServer
  alias Vend.{EventStore, Vending}

  def start_link(id), do: GenServer.start_link(__MODULE__, id, name: via(id))

  def execute(id, command), do: GenServer.call(via(id), {:execute, command})
  def state(id), do: GenServer.call(via(id), :state)

  defp via(id), do: {:via, Registry, {Vend.Registry, id}}

  @impl true
  def init(id) do
    events = EventStore.read(id)
    {:ok, %{id: id, vending: Vending.replay(events)}}
  end

  @impl true
  def handle_call({:execute, command}, _from, %{id: id, vending: vending} = state) do
    case Vending.decide(vending, command) do
      {:ok, events} ->
        {:ok, _count} = EventStore.append(id, events)
        vending = Vending.evolve(vending, events)
        {:reply, {:ok, events}, %{state | vending: vending}}

      {:error, _reason} = error ->
        {:reply, error, state}
    end
  end

  def handle_call(:state, _from, state), do: {:reply, state.vending, state}
end
```

There are three things to notice:

- `init/1` doesn't load a row. It reads the stream and replays it, using the `replay/1` you wrote in Part 3.
- `handle_call/3` saves events **before** applying them. If the append fails, the `{:ok, _}` match crashes the process and nothing in memory has changed. The supervisor restarts it, and it rebuilds from what was actually saved.
- The GenServer has no business logic. It's decide, append, evolve.

In `lib/vend/application.ex`, uncomment the machine:

```elixir
children = [
  Vend.Repo,
  {Registry, keys: :unique, name: Vend.Registry},
  {Vend.Machine, "lobby"}
]
```

Restart IEx (`Ctrl-C` twice, then `iex -S mix`), and buy something:

```elixir
iex> Machine.execute("lobby", {:insert, 100})
iex> Machine.execute("lobby", {:select, "B3"})
{:error, {:insert_more, 125}}
iex> Machine.execute("lobby", {:insert, 200})
iex> Machine.execute("lobby", {:select, "B3"})
{:ok, [%Vend.Events.ItemSold{slot: "B3", ...}, %Vend.Events.ChangeReturned{amount: 75, ...}]}
iex> Machine.state("lobby")
%Vend.Vending{cash: 6850, credit: 0, stock: %{..., "B3" => 0}}
```

Now kill the process. Don't stop it politely, kill it:

```elixir
iex> [{pid, _}] = Registry.lookup(Vend.Registry, "lobby")
iex> Process.exit(pid, :kill)
iex> Registry.lookup(Vend.Registry, "lobby")
[{#PID<0.312.0>, nil}]          # a different pid
iex> Machine.state("lobby")
%Vend.Vending{cash: 6850, credit: 0, stock: %{..., "B3" => 0}}
```

The supervisor started a fresh process, `init/1` replayed every event including your purchase, and the state came back exactly as it was. Nothing was saved separately to make that work. The events are the only thing saved.

> [!note] One machine, one process
> Every command for `"lobby"` goes through one GenServer, one at a time. That is what makes `decide/3` safe: two customers can't both buy the last trail mix, because the second `decide` sees the state after the first one's events. Starting a second machine is `Vend.Machine.start_link("office")`, a separate stream with its own process.

## 6. Scenarios

Each scenario is a question about the lobby machine's week. Answer it with a function that takes the event list. Put them in a new `lib/vend/reports.ex`:

```elixir
defmodule Vend.Reports do
  alias Vend.{Catalog, Vending}
  alias Vend.Events.{ItemSold, ItemRestocked}

  # your functions here
end
```

After each one, in IEx, run `recompile()` and call it with `events = EventStore.read("lobby")`.

The sample outputs below come from a fresh `mix reset`, so they don't include what you bought in Part 5.

Try each one before opening the solution.

### Scenario A: best sellers

Write `sales(events)`, which returns `{name, units, revenue}` for each item, sorted by revenue with the highest first. Use `Catalog.name/1` to turn a slot into a name.

> [!success]- Solution
> ```elixir
> def sales(events) do
>   events
>   |> Enum.filter(&match?(%ItemSold{}, &1))
>   |> Enum.group_by(& &1.slot, & &1.price)
>   |> Enum.map(fn {slot, prices} -> {Catalog.name(slot), length(prices), Enum.sum(prices)} end)
>   |> Enum.sort_by(fn {_name, _units, revenue} -> revenue end, :desc)
> end
> ```
> ```elixir
> [
>   {"Trail mix", 44, 9900},
>   {"Chips", 51, 8925},
>   {"Cola", 51, 7650},
>   {"Candy bar", 41, 6150},
>   {"Water", 43, 5375},
>   {"Gum", 45, 4500}
> ]
> ```
> This is a *projection*: the same events, folded into a different shape for a different question. `Vending.replay/1` is a projection too, one that happens to describe the machine.

### Scenario B: the lunch rush

The owner wants to restock before the busiest hour. Write `by_hour(events)`, which counts sales per hour of the day. Which hour is busiest?

> [!success]- Solution
> ```elixir
> def by_hour(events) do
>   events
>   |> Enum.filter(&match?(%ItemSold{}, &1))
>   |> Enum.frequencies_by(& &1.at.hour)
>   |> Enum.sort()
> end
> ```
> Noon, with 49 sales (`Enum.max_by(Reports.by_hour(events), &elem(&1, 1))` returns `{12, 49}`). The hours are UTC. Every event has kept its timestamp all week, so this report only needed to be written. Nothing new had to be recorded.

### Scenario C: profit, a report nobody planned for

Nobody wrote down profit, and `ItemSold` doesn't have a cost. Write `profit(events)` anyway, giving `{name, total_profit}` per item. Cost each sale at the `unit_cost` of the most recent restock of that slot before it.

Hint: walk the events in order with one `Enum.reduce/3`, carrying two maps: the latest cost per slot, and profit so far per slot.

> [!success]- Solution
> ```elixir
> def profit(events) do
>   {_costs, profit} =
>     Enum.reduce(events, {%{}, %{}}, fn
>       %ItemRestocked{slot: slot, unit_cost: cost}, {costs, profit} ->
>         {Map.put(costs, slot, cost), profit}
>
>       %ItemSold{slot: slot, price: price}, {costs, profit} ->
>         {costs, Map.update(profit, slot, price - costs[slot], &(&1 + price - costs[slot]))}
>
>       _other, acc ->
>         acc
>     end)
>
>   profit
>   |> Enum.map(fn {slot, total} -> {Catalog.name(slot), total} end)
>   |> Enum.sort_by(fn {_name, total} -> total end, :desc)
> end
> ```
> ```elixir
> [
>   {"Chips", 5355},
>   {"Trail mix", 4620},
>   {"Water", 4085},
>   {"Candy bar", 3895},
>   {"Cola", 3470},
>   {"Gum", 3375}
> ]
> ```
> Cola sold exactly as many units as Chips, but it comes fifth in profit. Filter for `%ItemRestocked{slot: "A1"}` to see why: the supplier's price went from 60 to 95 cents on Thursday. That price change was recorded as part of an ordinary restock, before anyone asked about profit. With a `stock` column updated in place, it would have been lost.
>
> "Last restock price" is a simplification. Some older 60-cent cans were still in the slot when the 95-cent ones went in. Costing the oldest stock first (FIFO) is a better answer, and you could add it as another report over the same events without changing anything that has been recorded.

### Scenario D: time travel

The owner says the machine was short on Wednesday at noon. Write `as_of(events, moment)`, which returns the `Vending` state at that moment. What was in the machine at `~U[2026-10-07 12:00:00Z]`?

> [!success]- Solution
> ```elixir
> def as_of(events, %DateTime{} = moment) do
>   events
>   |> Enum.take_while(&(DateTime.compare(&1.at, moment) != :gt))
>   |> Vending.replay()
> end
> ```
> ```elixir
> %Vend.Vending{
>   cash: 1700,
>   credit: 0,
>   stock: %{"A1" => 10, "A2" => 8, "A3" => 10, "B1" => 9, "B2" => 11, "B3" => 8}
> }
> ```
> It was well stocked. A1 had been refilled that morning, and $17.00 had come in since the cash was collected on Tuesday evening. Replaying part of the stream gives you the state at any moment in the past, which is useful for debugging, audits, and arguments.

## Cheat sheet

| Want to | Use |
| --- | --- |
| Read a stream | `EventStore.read("lobby")` |
| Rebuild current state | `Vending.replay(events)` |
| Apply one event, or a list | `Vending.evolve(state, event_or_events)` |
| Check a command without saving | `Vending.decide(state, command)` |
| Run a command for real | `Machine.execute("lobby", command)` |
| See every intermediate state | `Enum.scan(events, Vending.new(), &Vending.evolve(&2, &1))` |
| State at a past moment | `Enum.take_while/2` on `at`, then `replay/1` |
| Find a machine's pid | `Registry.lookup(Vend.Registry, "lobby")` |
| Start over | `mix reset` |

| Command | Events |
| --- | --- |
| `{:insert, amount}` | `CashInserted` |
| `{:select, slot}` | `ItemSold`, plus `ChangeReturned` if credit is left over |
| `:return_change` | `ChangeReturned` |
| `{:restock, slot, qty, unit_cost}` | `ItemRestocked` |
| `{:collect, amount}` | `CashCollected` |

## Going further

- **Snapshots.** Replaying 782 events is instant. Replaying 5 million is not. Save the state every N events, and on startup load the newest snapshot and replay only what came after it. The events stay the source of truth, and a snapshot can always be thrown away.
- **Slot capacity.** Nothing stops `{:restock, "A1", 500, 95}` today. Give each slot a capacity in `Catalog` and have `decide/3` reject a restock that would overfill it. The rule lives only in `decide/3`, so no events or `evolve/2` clauses change, and old over-full restocks still replay exactly as they happened.
- **Optimistic concurrency.** One GenServer per stream keeps writes in order on one node. Across several nodes, add an `expected_version` to `append/2` and reject the write if the stream has grown since you read it.
- **Live projections.** Here the reports read the whole stream on demand. In a larger system, projections subscribe to new events (with `Phoenix.PubSub` or `Registry`) and keep their own read tables up to date.
- **Changing an event's shape.** Events are never edited, so when a struct gains a field, old rows don't have it. Handle this by "upcasting" in `EventStore.read/1`: fill in a default as each old event is loaded.
- **Many machines.** Swap the hard-coded `{Vend.Machine, "lobby"}` child for a `DynamicSupervisor`, and start one machine per stream in `EventStore.streams()`.
- **Libraries.** [Commanded](https://github.com/commanded/commanded) is the established Elixir framework for this pattern, with [EventStore](https://github.com/commanded/eventstore) (Postgres) underneath. Its aggregates use the same `execute`/`apply` split you built here as `decide`/`evolve`.
