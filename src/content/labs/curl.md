---
title: 'curl Lab'
description: 'A hands-on tour of curl: the options you will use every week, then four scenarios for scripting, debugging, and timing HTTP requests.'
pubDate: 'Oct 02 2026'
topic: 'curl'
level: 'Intermediate'
duration: 45
audience: 'Developers comfortable in a terminal'
levelFrom: 'Uses curl for the occasional GET'
levelTo: 'Can script, debug, and time HTTP requests with curl'
---

A hands-on, ~45 minute tour of `curl`: the options you will use every week, then four scenarios to work through. Assumes you are comfortable in a terminal. By the end you can use curl to script, debug, and time HTTP requests.

Every command here was run against curl 8.7.1 on macOS with zsh. They work the same on Linux; the few places where the shell or platform matters are called out. Most examples hit [httpbin.org](https://httpbin.org), a public service that echoes back whatever you send it, which makes it easy to see exactly what curl did.

| Part | Topic | Time |
| --- | --- | --- |
| 1 | The mental model | 3 min |
| 2 | Seeing what happened | 6 min |
| 3 | Redirects, failures, timeouts | 5 min |
| 4 | Sending data | 7 min |
| 5 | Headers, auth, cookies | 5 min |
| 6 | Downloading files | 3 min |
| 7 | Debugging the connection | 4 min |
| 8 | Scenarios | 12 min |

## Setup

```sh
curl --version          # want 7.82 or newer, for --json
jq --version            # optional, used to pretty-print and filter JSON
mkdir -p ~/Labs/curl && cd ~/Labs/curl
H=https://httpbin.org   # shorthand used throughout
```

If `jq` is missing, install it with `brew install jq` (macOS) or `sudo apt install jq` (Debian, Ubuntu). You can skip it and still follow along; the JSON will just be less tidy.

> [!warning] Quote your URLs
> Quote any URL containing `?`, `&`, `[`, or `{`. In any shell an unquoted `&` backgrounds the command. In zsh (the macOS default) an unquoted `?` or `[` is also treated as a glob and fails with `no matches found`. When in doubt, single-quote the URL.

## 1. The mental model

curl makes one request per URL and writes the **response body to stdout**. Everything else (progress meter, errors, verbose output) goes to **stderr**. That split is why curl pipes so well.

```sh
curl $H/get
curl $H/get | jq .headers
```

Three things to keep in mind:

- **The method is inferred.** No data means GET. Adding data (`-d`, `--json`, `-F`) means POST. You rarely need `-X`.
- **The exit code describes the transfer, not the HTTP status.** A 404 or 500 is a successful transfer, so curl exits `0` unless you ask otherwise (Part 3).
- **Options can go anywhere** and short flags combine: `-sSL` is `-s -S -L`.

## 2. Seeing what happened

| Option | What it does |
| --- | --- |
| `-i` | Print response headers, then the body |
| `-I` | Send a HEAD request, print headers only |
| `-v` | Show the whole conversation: connect, TLS, request, response |
| `-s` | Silent: no progress meter, no errors |
| `-S` | With `-s`, show errors again. Use `-sS` together in scripts |
| `-o FILE` | Write the body to a file (`-o /dev/null` to discard it) |
| `-D FILE` | Write response headers to a file (`-D -` for stdout) |
| `-w FORMAT` | Print selected facts about the transfer after it finishes |

```sh
curl -i $H/status/204       # headers + (empty) body
curl -I $H/get              # HEAD request
curl -v $H/get              # > lines are sent, < lines are received, * is curl talking
```

In `-v` output, read the prefix: `>` is what curl sent, `<` is what came back, `*` is curl's own commentary (DNS, TLS, connection reuse). This is the first thing to reach for when a request does not behave.

`-w` (write-out) is the scripting workhorse. It prints variables after the transfer:

```sh
curl -sS -o /dev/null -w '%{http_code} %{time_total}s\n' $H/status/404
# 404 0.546832s

curl -sS -o /dev/null -w '%header{content-type}\n' $H/get
# application/json
```

`%{json}` dumps every variable as JSON. It is large (it includes the certificate chain), so filter it:

```sh
curl -sS -o /dev/null -w '%{json}' $H/get | jq '{http_code, remote_ip, time_total}'
```

> [!tip] Try it
> Get only the status code and the final content type of `https://github.com` without printing the page.
>
> > [!success]- Solution
> > ```sh
> > curl -sS -o /dev/null -w '%{http_code} %{content_type}\n' https://github.com
> > ```

## 3. Redirects, failures, timeouts

**Redirects are not followed by default.** You get the 3xx response itself.

```sh
curl -sS $H/redirect/2                 # prints the redirect page
curl -sSL $H/redirect/2                # -L follows to the end
curl -sSL -o /dev/null -w '%{num_redirects} hops -> %{url_effective}\n' $H/redirect/2
```

**HTTP errors do not fail by default.** Add `-f` to make 4xx/5xx produce a non-zero exit code:

```sh
curl -sS    $H/status/404; echo "exit $?"     # exit 0
curl -fsS   $H/status/404; echo "exit $?"     # non-zero, error on stderr
curl -sS --fail-with-body $H/status/418       # fails AND still prints the body
```

`--fail-with-body` is usually what you want for APIs, since the error body tells you why it failed.

> [!note] Exit code quirk
> The documented exit code for `-f` is `22`. Apple's bundled 8.7.1 often returns `56` instead when the connection is HTTP/2. Test for "non-zero" in scripts, not for `22` specifically.

**Timeouts and retries.** curl has no overall timeout by default and will wait forever.

```sh
curl -sS --max-time 2 $H/delay/5       # exit 28 after 2s
curl -sS --connect-timeout 3 $H/get    # limit only the connection phase
curl -fsS --retry 3 --retry-delay 1 $H/status/503
```

`--retry` only retries transient problems (timeouts, 408, 429, 500, 502, 503, 504). Add `--retry-all-errors` to retry anything that fails.

A sensible baseline for scripts: `curl -fsSL --max-time 10 --retry 2 URL`.

## 4. Sending data

| Option | Content-Type | Use for |
| --- | --- | --- |
| `-d 'a=1'` | `application/x-www-form-urlencoded` | HTML form posts |
| `--data-urlencode 'q=a b'` | same, value gets URL-encoded | Values with spaces or symbols |
| `--json '{...}'` | `application/json` (and `Accept`) | JSON APIs |
| `-F 'file=@path'` | `multipart/form-data` | File uploads with form fields |
| `-T file` | none (raw body, PUT) | Uploading a file as the body |
| `--data-binary @file` | form-urlencoded unless you set `-H` | Sending a file byte-for-byte |

```sh
# Form post. Multiple -d are joined with &
curl -sS -d 'name=ada' -d 'lang=elixir' $H/post

# Query string for a GET: -G moves the data into the URL
curl -sS -G --data-urlencode 'q=hello world & more' $H/get

# JSON. --json sets both Content-Type and Accept for you
curl -sS --json '{"name":"ada"}' $H/post

# Body from a file (@) or from stdin (@-)
echo '{"from":"file"}' > payload.json
curl -sS --json @payload.json $H/post
jq -n '{ts: now}' | curl -sS --json @- $H/post

# Multipart upload with an extra field
echo hello > note.txt
curl -sS -F 'file=@note.txt' -F 'title=My note' $H/post

# Other methods
curl -sS -X PUT -d 'a=1' $H/put
curl -sS -X DELETE $H/delete
curl -sS -T note.txt $H/put
```

Look at the `form`, `json`, `files`, and `headers` keys in httpbin's replies to see how each option changes what the server receives.

> [!warning] Two classic mistakes
> - `-d @file` strips newlines from the file. Use `--data-binary @file` when the bytes matter.
> - `-X POST` together with `-L` keeps the method POST across redirects, which is rarely what the server wants. Let `-d` imply POST and leave `-X` off.

## 5. Headers, auth, cookies

```sh
# Custom headers, repeat -H as needed. -A sets the User-Agent
curl -sS -H 'X-Request-Id: abc123' -H 'Accept: application/json' -A 'my-script/1.0' $H/headers

# Remove a header curl would send, or send one with an empty value
curl -sS -H 'Accept:' -H 'X-Empty;' $H/headers

# Basic auth. Omit the password to be prompted for it
curl -sS -u ada:s3cret $H/basic-auth/ada/s3cret

# Bearer token
curl -sS -H 'Authorization: Bearer abc.def.ghi' $H/bearer
```

Cookies: `-c` writes a cookie jar, `-b` sends cookies from a jar or a literal string.

```sh
curl -sS -L -c jar.txt $H/cookies/set/session/xyz789   # save what the server sets
cat jar.txt
curl -sS -b jar.txt $H/cookies                          # send them back
curl -sS -b 'theme=dark' $H/cookies                     # literal cookie
```

For a login flow, pass both with the same file (`-b jar.txt -c jar.txt`) so the jar is read and updated on every request.

> [!tip] Keep secrets out of shell history
> Put tokens in an environment variable (`-H "Authorization: Bearer $TOKEN"`), or put credentials in `~/.netrc` and use `-n`. Also remember that `-v` prints your `Authorization` header in full, so scrub it before pasting output anywhere.

## 6. Downloading files

```sh
curl -sSLO https://httpbin.org/robots.txt        # -O keeps the remote filename
curl -sSL -o bot-rules.txt $H/robots.txt         # -o picks the name
curl -sSL -O --output-dir /tmp $H/robots.txt     # choose the directory
curl -L -C - -O https://example.com/big.iso      # -C - resumes a partial download
curl -sS -r 0-9 $H/range/100                     # just the first 10 bytes
curl -sS --compressed $H/gzip                    # ask for and decode gzip
```

curl has its own URL globbing, and `-Z` runs the transfers in parallel:

```sh
curl -sS -Z -o /dev/null -w '%{url} %{http_code}\n' "$H/status/{200,201,202}"
curl -sS    -o /dev/null -w '%{url} %{http_code}\n' "$H/status/[200-202]"
```

Always use `-L` when downloading. Release URLs on GitHub and most CDNs redirect, and without it you save a tiny HTML redirect page instead of the file.

## 7. Debugging the connection

| Option | What it does |
| --- | --- |
| `--resolve host:port:ip` | Use this IP for the host, skipping DNS. TLS and the `Host` header still use the real name |
| `--connect-to h1:p1:h2:p2` | Connect to h2:p2 whenever the URL says h1:p1 |
| `-k` | Skip TLS certificate verification. Local and dev use only |
| `--cacert FILE` | Trust this CA bundle (the right fix for a private CA) |
| `-4` / `-6` | Force IPv4 or IPv6 |
| `--http1.1` / `--http2` | Force the HTTP version |
| `-x URL` | Send the request through a proxy |
| `--trace-ascii FILE` | Full dump of everything sent and received, including bodies |

`--resolve` is the one worth memorising. It lets you test a specific server behind a load balancer, or a new host before DNS has been switched, with correct TLS:

```sh
IP=$(dig +short httpbin.org | head -1)
curl -sS -o /dev/null -w '%{remote_ip} %{http_code}\n' --resolve httpbin.org:443:$IP $H/get
```

It beats editing `/etc/hosts`, and it beats `curl https://1.2.3.4 -H 'Host: ...'`, which fails certificate validation.

## 8. Scenarios

Try each one before opening the solution.

### Scenario A: explore an unfamiliar JSON API

Using the public GitHub API (no token needed, 60 requests per hour):

1. List the tag name and publish date of the 3 most recent releases of `curl/curl`. The endpoint is `https://api.github.com/repos/curl/curl/releases` and it accepts `per_page`.
2. In the same request, capture the response headers and find how many requests you have left, and the URL of the next page.
3. Fetch the next page and list its tag names.
4. Request a repo that does not exist, and make curl exit non-zero while still showing GitHub's error message.

> [!success]- Solution
> ```sh
> # 1 + 2: body to one file, headers to another
> curl -sS -D gh.headers -o gh.json 'https://api.github.com/repos/curl/curl/releases?per_page=3'
> jq -r '.[] | "\(.tag_name)  \(.published_at)"' gh.json
> grep -iE '^(link|x-ratelimit-remaining)' gh.headers
>
> # 3: paste the rel="next" URL from the link header
> curl -sS 'https://api.github.com/repositories/569041/releases?per_page=3&page=2' | jq -r '.[].tag_name'
>
> # 4
> curl -sS --fail-with-body https://api.github.com/repos/curl/nope | jq -r .message
> echo "exit ${pipestatus[1]}"      # zsh; in bash use ${PIPESTATUS[0]}
> ```
> Things to notice: pagination lives in the `link` header, not the body, which is why `-D` matters. And `$?` after a pipeline reports `jq`, not curl.

### Scenario B: a health check you can trust in a script

Write a shell function `check URL` that:

- prints the status code and total time on one line
- returns non-zero for HTTP errors, timeouts, and connection failures
- gives up after 5 seconds and retries transient failures twice
- prints nothing else on success

Test it against `$H/status/200`, `$H/status/404`, and `$H/delay/10`.

> [!success]- Solution
> ```sh
> check() {
>   curl -fsS --max-time 5 --retry 2 -o /dev/null \
>        -w '%{http_code} %{time_total}s\n' "$1"
> }
>
> check $H/status/200;  echo "exit $?"    # 200 0.54s, exit 0
> check $H/status/404;  echo "exit $?"    # 404 ..., error on stderr, non-zero
> check $H/delay/10;    echo "exit $?"    # 000 ..., three attempts so ~18s, exit 28
> ```
> Each flag earns its place: `-f` turns HTTP errors into exit codes, `-s` hides the progress meter, `-S` keeps the error message, `-o /dev/null` drops the body, and `-w` reports. Without `--max-time` a hung server hangs your script.

### Scenario C: where is the time going?

An endpoint feels slow. Work out whether the time is in DNS, connecting, TLS, or the server thinking. Use `$H/delay/2` as the slow endpoint.

1. Create a reusable write-out format file that prints `time_namelookup`, `time_connect`, `time_appconnect`, `time_starttransfer`, and `time_total`, one per line.
2. Run it against the slow endpoint and identify which phase holds the 2 seconds.
3. Run it twice in a single curl invocation against the same host and compare the second transfer.

> [!success]- Solution
> ```sh
> cat > timing.txt <<'EOF'
>      dns: %{time_namelookup}s\n
>  connect: %{time_connect}s\n
>      tls: %{time_appconnect}s\n
>     ttfb: %{time_starttransfer}s\n
>    total: %{time_total}s\n\n
> EOF
>
> curl -sS -o /dev/null -w @timing.txt $H/delay/2
> curl -sS -o /dev/null -w @timing.txt $H/delay/2 -o /dev/null $H/get
> ```
> The times are cumulative from the start, so subtract neighbours. `tls - connect` is the handshake, and `ttfb - tls` is the server working, which is where the 2 seconds shows up. In step 3 the second transfer reports about 0 for dns, connect, and tls because curl reuses the connection. That is the cost you save by keeping connections alive.

### Scenario D: curl is not only HTTP

curl speaks many protocols besides HTTP, including the dictionary protocol via `dict://` and raw TCP via `telnet://`. Two public services to try them on: `dict.org`, a dictionary server, and `tcpbin.com`, which runs an echo server on port 4242 that sends back every line it receives.

1. Look up the definition of "curl" on `dict.org`. The URL form is `dict://HOST/d:WORD`.
2. Send two lines from a pipe to the echo server and confirm they come back.
3. Open an interactive session with the echo server and type at it.

> [!success]- Solution
> ```sh
> curl -sS dict://dict.org/d:curl | head -12
> printf 'hello\nworld\n' | curl -sS --max-time 4 telnet://tcpbin.com:4242
> curl telnet://tcpbin.com:4242       # interactive, Ctrl-C to quit
> ```
> The dict output includes the protocol's own status lines (`220`, `250 ok`, `150 3 definitions retrieved`): curl prints the raw conversation because there is no body/header split outside HTTP.
>
> With piped input curl does not close the connection when stdin ends, so it waits for the server to hang up. `--max-time` ends it, so `curl: (28) Time-out` and exit 28 are expected here. For a client that closes when its input ends, use `nc tcpbin.com 4242`.

## Cheat sheet

| Want to | Use |
| --- | --- |
| See response headers | `-i` (with body), `-I` (HEAD), `-D -` |
| See everything | `-v`, or `--trace-ascii -` |
| Quiet but show errors | `-sS` |
| Follow redirects | `-L` |
| Fail on HTTP errors | `-f`, or `--fail-with-body` |
| Save to a file | `-o name`, `-O` |
| Status code only | `-o /dev/null -w '%{http_code}\n'` |
| POST a form | `-d 'k=v'` |
| POST JSON | `--json '{...}'` or `--json @file` |
| Upload a file | `-F 'file=@path'` (multipart), `-T path` (PUT) |
| Build a query string | `-G --data-urlencode 'k=v'` |
| Add a header | `-H 'Name: value'` |
| Basic auth | `-u user:pass` |
| Cookies | `-b jar -c jar` |
| Time limit | `--max-time N`, `--connect-timeout N` |
| Retry | `--retry N` |
| Pin a host to an IP | `--resolve host:port:ip` |
| Resume a download | `-C -` |
| Parallel transfers | `-Z` |

## Going further

- **Copy as cURL.** In browser dev tools, right-click any request in the Network tab and choose Copy as cURL. You get the exact request, cookies and all, to replay and trim down in the terminal.
- **`~/.curlrc`.** Default options, one per line in long form without the dashes (for example `connect-timeout = 10`). Use `-q` as the first argument to ignore it for a single run.
- **`-K file`.** Same format as `.curlrc`, but per project. Handy for keeping an API's base headers in one place.
- **`curl --help all`** and `man curl` are searchable and complete. `curl --help http` lists a single category.
- **[Everything curl](https://everything.curl.dev)** is the free book by curl's author, and the best reference past this point.
