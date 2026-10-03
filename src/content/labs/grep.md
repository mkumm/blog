---
title: 'grep Lab'
description: 'A hands-on lab on grep and the pipes it lives in: find lines in files and in command output, and build pipelines that filter, count, and rank.'
pubDate: 'Oct 03 2026'
topic: 'grep'
level: 'Beginner'
duration: 45
audience: 'People comfortable in a terminal who find pipes confusing'
levelFrom: 'Has run grep a few times, unsure how pipes fit together'
levelTo: 'Can find lines in files and command output, and build grep pipelines that filter, count, and rank'
---

A hands-on, ~45 minute lab on `grep` and the pipes it lives in. It assumes you can move around a terminal and have run grep once or twice, but that a line like `a | b | c` still takes some squinting. By the end you can find lines in files and in other commands' output, and build a pipeline of three or four stages without guessing.

Every command here was run with the grep that ships with macOS (BSD grep 2.6.0) in zsh. The lab only uses options that also exist in GNU grep on Linux, but it was not run on Linux; the two places where output looks different are called out.

| Part | Topic | Time |
| --- | --- | --- |
| 1 | The mental model | 3 min |
| 2 | Finding lines in a file | 6 min |
| 3 | Pipes, one stage at a time | 8 min |
| 4 | Just enough pattern | 6 min |
| 5 | Many files at once | 4 min |
| 6 | Context and extracting | 5 min |
| 7 | Scenarios | 13 min |

## Setup

Paste this whole block into your terminal. It creates a `~/Labs/grep` folder with a log, a config file, a CSV, and a few notes. Nothing else on your machine is touched; delete the folder when you are done.

```sh
mkdir -p ~/Labs/grep/notes/archive && cd ~/Labs/grep

cat > app.log <<'EOF'
2026-03-14 09:00:01 INFO  server started on port 8080
2026-03-14 09:00:05 INFO  GET /index.html 200 12ms user=ada
2026-03-14 09:00:09 INFO  GET /login 200 8ms user=guest
2026-03-14 09:00:14 INFO  POST /login 302 41ms user=grace
2026-03-14 09:01:12 WARN  GET /search 200 1840ms user=ada slow response
2026-03-14 09:01:30 ERROR POST /upload 500 31ms user=grace
    cause: disk quota exceeded
    path: /var/data/uploads
2026-03-14 09:01:44 INFO  GET /index.html 200 9ms user=linus
2026-03-14 09:02:03 INFO  GET /reports 200 77ms user=ada
2026-03-14 09:02:20 WARN  GET /reports 200 2210ms user=linus slow response
2026-03-14 09:02:41 ERROR GET /reports 500 15ms user=ada
    cause: database connection refused
    path: db.internal:5432
2026-03-14 09:02:42 INFO  retrying database connection
2026-03-14 09:02:45 error database still unreachable
2026-03-14 09:03:00 INFO  GET /index.html 200 11ms user=guest
2026-03-14 09:03:10 INFO  GET /errors.html 404 3ms user=guest
2026-03-14 09:03:15 ERROR POST /upload 500 28ms user=grace
    cause: disk quota exceeded
    path: /var/data/uploads
2026-03-14 09:03:40 INFO  GET /logout 200 5ms user=grace
2026-03-14 09:04:02 INFO  POST /login 401 19ms user=mallory
2026-03-14 09:04:03 INFO  POST /login 401 17ms user=mallory
2026-03-14 09:04:05 INFO  POST /login 401 18ms user=mallory
2026-03-14 09:04:30 INFO  server shutting down
EOF

cat > settings.conf <<'EOF'
# Application settings
# Lines starting with # are comments

port = 8080
host = 0.0.0.0

# Database
db_host = db.internal
db_port = 5432
#db_user = admin
db_user = app

# Logging
log_level = info
# log_file = /var/log/app.log
timeout = 30
EOF

cat > people.csv <<'EOF'
name,city,team,start_year
Ada Lovelace,London,engineering,2019
Grace Hopper,New York,engineering,2021
Linus Paris,Helsinki,platform,2019
Marie Curie,Paris,research,2020
Alan Turing,London,research,2022
Paris Okafor,Lagos,design,2021
Katherine Johnson,Paris,engineering,2019
Tim Berners,London,platform,2023
EOF

cat > notes/monday.md <<'EOF'
# Monday
- TODO: email Grace about the upload quota #ops
- reviewed search slowness with Ada #performance
- todo: book a meeting room
- DONE: rotate API keys #security
EOF

cat > notes/tuesday.md <<'EOF'
# Tuesday
- TODO: add an index to the reports table #performance #database
- TODO: ask Linus about disk alerts #ops
- lunch with the platform team
EOF

cat > notes/ideas.txt <<'EOF'
Cache the reports page #performance
Try a todo app for the team?
Dark mode #design
EOF

cat > notes/archive/old.md <<'EOF'
# Old
- TODO: migrate off the old database #database
- DONE: set up backups #ops
EOF
```

Check it worked: `grep -c '' app.log` should print `26` (the number of lines in the log).

## 1. The mental model

grep is a **line filter**. Lines go in, and only the lines that match the pattern come out. It never changes a line and never changes the file.

```sh
grep ERROR app.log
# 2026-03-14 09:01:30 ERROR POST /upload 500 31ms user=grace
# 2026-03-14 09:02:41 ERROR GET /reports 500 15ms user=ada
# 2026-03-14 09:03:15 ERROR POST /upload 500 28ms user=grace
```

Three ideas make everything else predictable:

- **Lines in, matching lines out.** Every option either changes what counts as a match (`-i`, `-v`, `-w`) or changes what gets printed about the matches (`-c`, `-n`, `-l`, `-o`).
- **grep reads from the file you name, or from its input if you name none.** `grep ERROR app.log` reads the file. `something | grep ERROR` reads whatever `something` printed.
- **A pipe `|` hands the output of the command on its left to the command on its right as input.** Nothing more. A pipeline is a row of filters, read left to right, each one seeing only what the previous one let through.

## 2. Finding lines in a file

The shape is always `grep [options] 'pattern' file`.

| Option | What it does |
| --- | --- |
| `-i` | Ignore upper and lower case |
| `-v` | Invert: print the lines that do **not** match |
| `-c` | Print a count of matching lines instead of the lines |
| `-n` | Prefix each line with its line number |
| `-w` | Match whole words only |

```sh
grep -n ERROR app.log       # 6:..., 12:..., 19:...  line numbers in front
grep -c ERROR app.log       # 3
grep 'slow response' app.log   # a pattern with a space needs quotes
grep -v INFO app.log        # everything that is not an INFO line
```

**grep is case-sensitive by default, and it matches anywhere in the line, including inside longer words.** Compare:

```sh
grep -c ERROR app.log       # 3
grep -ci error app.log      # 5  also finds "error database still unreachable"
                            #    ...and "GET /errors.html", which is not an error at all
grep -ciw error app.log     # 4  -w drops /errors.html: "errors" is a different word
```

Options combine the way they do in most tools: `-ciw` is `-c -i -w`.

> [!warning] Always single-quote the pattern
> Characters such as `*`, `?`, `[`, `|` and `$` mean something to the shell before grep ever sees them. `grep [0-9]*ms app.log` fails in zsh with `no matches found: [0-9]*ms`, and in bash it works only by luck. Put the pattern in single quotes every time and the problem never comes up.

> [!tip] Try it
> How many lines in `app.log` are not INFO lines? Get the number without counting by eye.
>
> > [!success]- Solution
> > ```sh
> > grep -vc INFO app.log
> > # 12
> > ```
> > `-v` changes what matches, `-c` changes what is printed. They do not interfere with each other. The 12 includes the indented `cause:` and `path:` lines, because they do not contain `INFO` either.

## 3. Pipes, one stage at a time

Leave the file name off and grep filters whatever is piped into it. That is how you search the output of any command:

```sh
ls /usr/bin | grep zip          # only the names containing "zip"
env | grep -i '^home'           # your HOME variable (^ is explained in Part 4)
```

A pipeline is easiest to read, and to write, **one stage at a time**. Run the first stage, look at the output, then add the next:

```sh
grep user= app.log                                  # 16 lines: every request
grep user= app.log | grep -v ' 200 '                # 8 lines: requests that were not a 200
grep user= app.log | grep -v ' 200 ' | grep -v mallory    # 5 lines: ...and not mallory
```

Each `grep` only sees what the one before it printed. Chaining greps means "and": this line, and also this, and not that.

The usual partners at the end of a pipeline:

| Command | What it does to the lines it receives |
| --- | --- |
| `wc -l` | Counts them |
| `head -5` | Keeps the first 5 |
| `sort` | Sorts them |
| `uniq -c` | Collapses identical neighbouring lines and counts them (so `sort` first) |

```sh
grep ERROR app.log | grep upload | wc -l      # 2
```

> [!note]
> macOS pads the number from `wc -l` with spaces (`       2`); Linux prints a bare `2`. Same answer. When the last stage is a grep you can skip `wc` altogether: `grep ERROR app.log | grep -c upload`.

**Only the first command in a pipeline gets the file name.** If you give a later grep a file, it reads the file and silently ignores the pipe:

```sh
grep ERROR app.log | grep upload app.log | wc -l
# 4   wrong: the second grep searched all of app.log, not just the ERROR lines
```

> [!warning] When the terminal just sits there
> A grep with no file and nothing piped into it waits for you to type its input. The usual cause is forgetting the file name, or forgetting quotes: `grep -E ERROR|WARN app.log` is read by the shell as `grep -E ERROR` piped into a command called `WARN`, so you see `command not found: WARN` and then a silent, waiting grep. Press Ctrl-C and fix the command.

> [!note] Errors skip the pipe
> A pipe carries a command's normal output only. Error messages travel on a separate channel straight to your screen, so `ls /nope | grep foo` still shows `No such file or directory`. To send errors down the pipe too, add `2>&1` before it: `ls /nope 2>&1 | grep -i 'no such'`.

> [!tip] Try it
> Which requests by `ada` were logged as WARN or ERROR? Build it in two stages: first all of ada's requests, then narrow down. (You do not need anything from Part 4.)
>
> > [!success]- Solution
> > ```sh
> > grep user=ada app.log                 # stage 1: look at it first
> > grep user=ada app.log | grep -v INFO  # stage 2
> > # ...09:01:12 WARN  GET /search 200 1840ms user=ada slow response
> > # ...09:02:41 ERROR GET /reports 500 15ms user=ada
> > ```
> > Running stage 1 on its own is not wasted effort. It is how you find out that "not INFO" is a simpler way to say "WARN or ERROR" for these lines.

## 4. Just enough pattern

A grep pattern is a regular expression. You can get a long way with seven pieces:

| Pattern | Matches |
| --- | --- |
| `^` | Start of the line |
| `$` | End of the line |
| `.` | Any single character |
| `.*` | Any run of characters, including none |
| `[0-9]` `[a-z]` | One character from the set |
| `a\|b` with `-E` | Either `a` or `b` |
| `x+` with `-E` | One or more of `x` |

```sh
grep '^#' settings.conf           # comment lines: # at the very start
grep -c '^$' settings.conf        # 3   empty lines: start, then immediately end
grep '^ ' app.log                 # the indented detail lines
grep -c ',2019$' people.csv       # 3   lines ending in ,2019
grep -E 'ERROR|WARN' app.log      # either word; needs -E
grep -E '[0-9]{4}ms' app.log      # a four-digit time: the two slow responses
```

**Without `-E`, `|` and `+` are ordinary characters.** `grep 'ERROR|WARN' app.log` prints nothing, because no line contains the literal text `ERROR|WARN`. When a pattern uses `|`, `+`, `{}` or `()`, reach for `-E`.

The dot is the other trap: `grep 'p.rt' settings.conf` matches `port`, and would match `part` too. When you want the text taken literally, dots and all, use `-F` (fixed string): `grep -F '0.0.0.0' settings.conf`.

> [!tip] Try it
> Who in `people.csv` is based in Paris? Start with the obvious command and see what is wrong with the answer.
>
> > [!success]- Solution
> > ```sh
> > grep Paris people.csv       # 4 lines, two of them wrong
> > grep ',Paris,' people.csv   # 2 lines: Marie Curie and Katherine Johnson
> > ```
> > grep knows about lines, not columns. `Linus Paris` and `Paris Okafor` have the word in their name. `-w` does not help, because "Paris" is a whole word there too. Including the commas pins the match to the middle of the line. For real column work the next tool to learn is `awk`.

## 5. Many files at once

Name several files, or use `-r` to search a whole folder and everything under it. grep then puts the file name in front of each match.

| Option | What it does |
| --- | --- |
| `-r` | Search a folder recursively |
| `-l` | Print only the names of files that contain a match |
| `-L` | Print only the names of files that do not |
| `-h` | Hide the file name prefix |
| `--include='*.md'` | With `-r`, only look in files with matching names |

```sh
grep -rn TODO notes
# notes/archive/old.md:2:- TODO: migrate off the old database #database
# notes/monday.md:2:- TODO: email Grace about the upload quota #ops
# notes/tuesday.md:2:- TODO: add an index to the reports table #performance #database
# notes/tuesday.md:3:- TODO: ask Linus about disk alerts #ops

grep -rl TODO notes                       # just the three file names
grep -ri --include='*.md' todo notes      # any case, markdown files only
```

The order files are listed in can differ between machines. The set of lines is the same.

**The file name prefix becomes part of the line for the next stage of a pipeline.** That is useful when you want it (`grep -rl database . | grep -v notes`) and a nuisance when you want to process the text itself, which is what `-h` is for.

> [!tip] Try it
> Which file under `notes` has no `TODO` in it at all?
>
> > [!success]- Solution
> > ```sh
> > grep -rL TODO notes
> > # notes/ideas.txt
> > ```
> > `-L` is the per-file version of `-v`: files without a match, instead of lines without a match.

## 6. Context and extracting

Sometimes the matching line is not the whole story, and sometimes it is more than you want.

| Option | What it does |
| --- | --- |
| `-A 2` | Also print 2 lines **a**fter each match |
| `-B 2` | Also print 2 lines **b**efore |
| `-C 2` | Both |
| `-o` | Print only the part of the line that matched, one match per line |

```sh
grep -A2 'ERROR GET' app.log
# 2026-03-14 09:02:41 ERROR GET /reports 500 15ms user=ada
#     cause: database connection refused
#     path: db.internal:5432
```

When there are several matches, grep separates the groups with a line containing `--`.

`-o` turns grep from a line filter into an extractor, and it pairs with `sort | uniq -c` to answer "how many of each":

```sh
grep -o 'user=[a-z]*' app.log | sort | uniq -c | sort -rn
#    4 user=grace
#    4 user=ada
#    3 user=mallory
#    3 user=guest
#    2 user=linus
```

Read it left to right: pull out every `user=name`, put identical ones next to each other, collapse and count them, then sort by the count with the biggest first (`-r` reverse, `-n` numeric). Run it one stage at a time to watch each step.

> [!tip] Try it
> Print only the `cause:` line that follows each ERROR, and nothing else.
>
> > [!success]- Solution
> > ```sh
> > grep -A1 ERROR app.log | grep cause
> > #     cause: disk quota exceeded
> > #     cause: database connection refused
> > #     cause: disk quota exceeded
> > ```
> > The first grep widens the result to include a neighbouring line; the second narrows it again. `grep cause app.log` gives the same output with this log, but only because every cause here belongs to an ERROR. The two-stage version says what you mean.

## 7. Scenarios

Try each one before opening the solution. Build every pipeline one stage at a time.

### Scenario A: what went wrong this morning?

Someone asks for a quick summary of the trouble in `app.log`. In this log the HTTP status is the three-digit number with a space on each side.

1. How many requests ended with a 4xx or 5xx status?
2. Which users made those requests, ranked by how many each made?
3. For the 500s, what were the causes, and how many of each?
4. How slow were the slow responses? Print only the timings.

> [!success]- Solution
> ```sh
> # 1
> grep -cE ' [45][0-9][0-9] ' app.log
> # 7
>
> # 2
> grep -E ' [45][0-9][0-9] ' app.log | grep -o 'user=[a-z]*' | sort | uniq -c | sort -rn
> #    3 user=mallory
> #    2 user=grace
> #    1 user=guest
> #    1 user=ada
>
> # 3
> grep -A1 ' 500 ' app.log | grep cause | sort | uniq -c | sort -rn
> #    2     cause: disk quota exceeded
> #    1     cause: database connection refused
>
> # 4
> grep 'slow response' app.log | grep -oE '[0-9]+ms'
> # 1840ms
> # 2210ms
> ```
> Things to notice: the spaces in `' [45][0-9][0-9] '` are doing real work. Without them the pattern also matches the `543` inside `db.internal:5432` and the count comes out as 8. In step 4, running `-o` on the whole file would print every timing; filtering to the right lines first and extracting second is the pattern to remember. And three failed logins in three seconds from `mallory` is the kind of thing a ranked count makes obvious.

### Scenario B: what is this config really setting?

1. Print only the active settings in `settings.conf`: no comments, no blank lines.
2. From that result, show only the database settings.
3. A colleague says the database user is `admin`. Show, with line numbers, every line that mentions `db_user`, and say who is right.

> [!success]- Solution
> ```sh
> # 1
> grep -v '^#' settings.conf | grep -v '^$'
> # port = 8080
> # host = 0.0.0.0
> # db_host = db.internal
> # db_port = 5432
> # db_user = app
> # log_level = info
> # timeout = 30
>
> # 2
> grep -v '^#' settings.conf | grep -v '^$' | grep '^db_'
>
> # 3
> grep -n db_user settings.conf
> # 10:#db_user = admin
> # 11:db_user = app
> ```
> Things to notice: step 1 is two "not" filters in a row, and it is worth committing to memory because it works on almost any config file. It can be written as one grep, `grep -Ev '^(#|$)' settings.conf`, but the two-stage version is easier to get right. In step 3 the colleague searched for `admin`, found line 10, and did not notice the `#`. The user is `app`.

### Scenario C: tidy up the notes

1. List every open to-do under `notes`, in any capitalisation, with file name and line number. `ideas.txt` mentions "a todo app", which is not a to-do and should not appear.
2. Which tags (like `#ops`) are attached to the upper-case `TODO` lines, ranked by how often they appear?
3. Which to-do has no tag at all? Print just the text.

> [!success]- Solution
> ```sh
> # 1
> grep -rin 'todo:' notes
> # notes/archive/old.md:2:- TODO: migrate off the old database #database
> # notes/monday.md:2:- TODO: email Grace about the upload quota #ops
> # notes/monday.md:4:- todo: book a meeting room
> # notes/tuesday.md:2:- TODO: add an index to the reports table #performance #database
> # notes/tuesday.md:3:- TODO: ask Linus about disk alerts #ops
>
> # 2
> grep -rh TODO notes | grep -oE '#[a-z]+' | sort | uniq -c | sort -rn
> #    2 #ops
> #    2 #database
> #    1 #performance
>
> # 3
> grep -rih 'todo:' notes | grep -v '#'
> # - todo: book a meeting room
> ```
> Things to notice: in step 1 the colon is what separates a real to-do from the word in a sentence. Making the pattern a little more specific is usually better than adding another stage. In step 2, `+` rather than `*` matters: `'#[a-z]*'` also matches the bare `#` of the `# Monday` headings. And `-h` in steps 2 and 3 keeps file names out of the text being processed; without it, step 3 would still work here, but a file called `notes/#drafts.md` would break it.

## Cheat sheet

| Want to | Use |
| --- | --- |
| Find lines containing text | `grep 'text' file` |
| Search a command's output | `command \| grep 'text'` |
| Ignore case | `-i` |
| Lines that do not match | `-v` |
| Count matching lines | `-c` |
| Show line numbers | `-n` |
| Whole words only | `-w` |
| Either of two things | `-E 'a\|b'` |
| Take the pattern literally | `-F` |
| Start / end of line | `^` / `$` |
| Blank lines | `'^$'` |
| Search a folder | `-r pattern dir` |
| Only certain files | `-r --include='*.md'` |
| File names only | `-l` (with a match), `-L` (without) |
| Drop the file name prefix | `-h` |
| Lines around a match | `-A n`, `-B n`, `-C n` |
| Only the matching part | `-o` |
| This and that | `grep a file \| grep b` |
| This but not that | `grep a file \| grep -v b` |
| How many of each | `grep -o '...' file \| sort \| uniq -c \| sort -rn` |
| Strip comments and blanks | `grep -v '^#' file \| grep -v '^$'` |

## Going further

- **Exit codes.** grep exits `0` if it found something and `1` if it did not, and `-q` makes it print nothing. Together they give you `if grep -q ERROR app.log; then ...` in scripts.
- **More regular expressions.** Groups, `?`, `{n,m}` and character classes such as `[[:space:]]`. [regex101.com](https://regex101.com) lets you test a pattern against sample text and explains each piece.
- **`awk` and `cut`.** When the question is about columns rather than lines (the Paris problem in Part 4), these are the right tools. `cut -d, -f2 people.csv` prints the city column.
- **`ripgrep` (`rg`).** A faster, friendlier grep for searching code: recursive by default, skips files ignored by git, same pattern ideas.
- **`man grep`** is complete and searchable (press `/` and type). On macOS it documents BSD grep; the [GNU grep manual](https://www.gnu.org/software/grep/manual/grep.html) covers Linux, including the GNU-only `-P` for Perl-style patterns.
