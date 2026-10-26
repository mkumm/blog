---
title: 'chezmoi Lab'
description: 'A hands-on lab on chezmoi: manage dotfiles across two throwaway servers, learn which commands move changes in which direction, and resolve drift without losing work.'
pubDate: 'Oct 25 2026'
topic: 'chezmoi'
level: 'Beginner'
duration: 45
audience: 'Developers comfortable with git, the shell, and SSH who have never used chezmoi'
levelFrom: 'Keeps a few dotfiles, has never used chezmoi'
levelTo: 'Can add, edit, apply, re-add, and sync dotfiles across machines, and resolve drift without losing work'
---

A hands-on, ~45 minute lab on [chezmoi](https://www.chezmoi.io), a tool that keeps your dotfiles in a git repo and puts them in place on every machine you use. Assumes you are comfortable with git, the shell, and SSH, and have never used chezmoi. By the end you can run the daily loop on two machines and fix the situation that confuses everyone at first: a file that changed in two places.

Nothing in this lab touches your own laptop. You rent two small servers, `vps-a` and `vps-b`, and treat them as two machines you work on. A bare git repo on `vps-a` stands in for GitHub, and `vps-b` reaches it over SSH, just as it would reach GitHub. When you are done, you delete both servers. Every command here was run against chezmoi 2.73.3 and git 2.43 on Ubuntu 24.04.

| Part | Topic | Time |
| --- | --- | --- |
| 1 | The mental model | 4 min |
| 2 | Your first managed files | 6 min |
| 3 | Look before you apply | 5 min |
| 4 | Two ways to make a change | 8 min |
| 5 | Sync through git | 7 min |
| 6 | Scenarios | 15 min |

## Setup

Create two of the smallest **Ubuntu 24.04** servers at any provider (Hetzner, DigitalOcean, Vultr, and so on). Name them `vps-a` and `vps-b` so that your prompt always tells you which one you are on, and add your SSH public key when you create them. For an hour of use they cost a few cents.

> [!warning] Everything runs as root
> These servers are throwaway, so the lab works as `root` to keep setup short. Don't copy that habit to a server you care about.

On your laptop, save the two IP addresses and check that you can log in to both:

```sh
A=203.0.113.10                   # vps-a's IP
B=203.0.113.11                   # vps-b's IP
ssh root@$A true                 # answer yes to the host key prompt
ssh root@$B true
```

Install chezmoi and set a git identity on both servers. chezmoi needs the identity to commit for you later.

```sh
for host in $A $B; do
  ssh root@$host '
    sh -c "$(curl -fsLS get.chezmoi.io)" -- -b /usr/local/bin
    git config --global user.name  "Lab Student"
    git config --global user.email "student@example.com"
    git config --global init.defaultBranch main
    chezmoi --version && git --version'
done
```

Create the fake GitHub on `vps-a`, then let `vps-b` reach it over SSH by the name `vps-a`:

```sh
ssh root@$A 'git init --bare --quiet /srv/dotfiles.git'

ssh root@$B 'ssh-keygen -t ed25519 -N "" -q -f ~/.ssh/id_ed25519 && cat ~/.ssh/id_ed25519.pub' \
  | ssh root@$A 'cat >> ~/.ssh/authorized_keys'
ssh root@$B "echo '$A vps-a' >> /etc/hosts && ssh -o StrictHostKeyChecking=accept-new root@vps-a true && echo ok"
# ok
```

Now open two terminal windows, run `ssh root@$A` in one and `ssh root@$B` in the other, and leave them open. The prompts read `root@vps-a:~#` and `root@vps-b:~#`. Code blocks below start with a comment such as `# vps-a` when it matters which window you type into.

> [!note] Editors over SSH
> `chezmoi edit` opens `$EDITOR`, and falls back to `vi` when that isn't set. If you would rather use nano, run `export EDITOR=nano` in both windows.

## 1. The mental model

chezmoi works with three places:

- **The source directory**, `~/.local/share/chezmoi`. A git repo holding the master copy of every managed file. This is what you push and pull.
- **The destination**, your home directory. The real files your programs read.
- **The state**, chezmoi's private record of what it last wrote to each file. This is how it notices when something else changed a file.

Every command moves changes in one direction, and most confusion goes away once you know which:

| Direction | Commands |
| --- | --- |
| Source → home | `apply`, `update` (git pull, then apply) |
| Home → source | `add` (start managing a file), `re-add` (copy your edits back) |
| Neither, just looking | `status`, `diff`, `managed` |

**The source directory does not hold `.bashrc`, it holds `dot_bashrc`.** chezmoi encodes file attributes in the name: `dot_` becomes a leading `.`, `private_` means permissions 600, `executable_` means chmod +x. So you never edit the source by guessing a path; you ask chezmoi.

## 2. Your first managed files

Ubuntu already gave `root` a `~/.bashrc`. On `vps-a`, add a few lines to it and create a small app config, then start a chezmoi source directory and hand both files to it:

```sh
# vps-a
printf '\nexport EDITOR=vi\nalias ll="ls -la"\n' >> ~/.bashrc
mkdir -p ~/.config/app && printf 'theme = "dark"\n' > ~/.config/app/config.toml

chezmoi init                     # creates ~/.local/share/chezmoi as an empty git repo
chezmoi add ~/.bashrc ~/.config/app/config.toml
chezmoi managed
# .bashrc
# .config
# .config/app
# .config/app/config.toml
```

Look at what `add` created:

```sh
find ~/.local/share/chezmoi -not -path '*/.git*'
# /root/.local/share/chezmoi
# /root/.local/share/chezmoi/dot_config
# /root/.local/share/chezmoi/dot_config/app
# /root/.local/share/chezmoi/dot_config/app/config.toml
# /root/.local/share/chezmoi/dot_bashrc

chezmoi source-path ~/.bashrc    # where the master copy of a file lives
# /root/.local/share/chezmoi/dot_bashrc
```

`add` copies; it does not move or link. Your `~/.bashrc` is still a normal file, and right now both copies are identical.

## 3. Look before you apply

| Command | Shows |
| --- | --- |
| `chezmoi status` | One line per file that `apply` would change, with two status columns |
| `chezmoi diff` | The exact change `apply` would make to your home directory |
| `chezmoi apply -nv` | Same as diff, as a dry run (`-n`) with verbose output (`-v`) |

Change the source copy directly, then look:

```sh
# vps-a
echo 'alias gs="git status"' >> $(chezmoi source-path ~/.bashrc)

chezmoi status
#  M .bashrc

chezmoi diff
# ...
#  export EDITOR=vi
#  alias ll="ls -la"
# +alias gs="git status"

chezmoi apply -v                 # write it to ~/.bashrc
chezmoi status                   # prints nothing: home matches source
```

Read `status` like `git status --short`, but with different columns:

- **Second column**: what `apply` would do to the file (`A` add, `M` modify, `D` delete).
- **First column**: the file changed since chezmoi last wrote it. Something other than chezmoi touched it.

**`chezmoi diff` shows the future of your home directory, not your edit.** A `+` line is something `apply` would add, and a `-` line is something `apply` would take away. When you have edited a file in your home directory, the `-` lines are your edit.

> [!tip] Try it
> Add `alias gl="git log --oneline"` to `~/.bashrc` directly, not through chezmoi. Before running anything, predict what `chezmoi status` prints and whether `chezmoi diff` shows your new line with a `+` or a `-`. Then check, and leave the change in place for Part 4.
>
> > [!success]- Solution
> > ```sh
> > echo 'alias gl="git log --oneline"' >> ~/.bashrc
> > chezmoi status
> > # MM .bashrc
> > chezmoi diff
> > # -alias gl="git log --oneline"
> > ```
> > First column `M`: the file changed behind chezmoi's back. Second column `M`: `apply` would modify it. The `-` means running `apply` now would delete your new alias, because the source does not have it.

## 4. Two ways to make a change

You have two ways to make a change. Pick whichever matches how the change happened.

**Way 1: edit the source, then apply.** Use this when you are the one making the change.

```sh
chezmoi edit --apply ~/.bashrc
```

This opens the source copy in `$EDITOR` and applies it when you quit. Without `--apply`, the change waits in the source until your next `chezmoi apply`.

**Way 2: edit the real file, then copy it back.** Use this when a tool wrote the file for you: `git config --global`, `mise use -g`, an installer that appends to `~/.bashrc`, or you editing `~/.bashrc` out of habit.

```sh
chezmoi re-add                   # copy every modified managed file back into the source
chezmoi status                   # prints nothing
```

You have a Way 2 situation waiting from the Try it in Part 3. Run `chezmoi re-add` now, then check that the alias reached the source:

```sh
# vps-a
tail -1 $(chezmoi source-path ~/.bashrc)
# alias gl="git log --oneline"
```

Now practise Way 1. Run `chezmoi edit --apply ~/.bashrc`, add `alias ..="cd .."` at the end, save, and quit. Then `tail -1 ~/.bashrc` shows it.

> [!warning] Two mistakes people really make
> - **`re-add` overwrites the source with whatever is in your home directory.** If the source holds changes you have not applied yet (an `apply` you skipped, or a `git pull`), `re-add` silently throws them away. Run `chezmoi status` and `chezmoi diff` first. Scenario B shows this happening.
> - **GUI editors return immediately.** On your own laptop, if `$EDITOR` is `code` or `zed`, chezmoi gets the file back before you have typed anything and warns `returned in less than 1s`. Use `code --wait` or `zed --wait`.

## 5. Sync through git

The source directory is an ordinary git repo. `chezmoi git` runs git inside it from wherever you are. Put `--` before any flags meant for git, so chezmoi does not try to read them:

```sh
# vps-a
chezmoi git status -- --short
chezmoi git add .
chezmoi git commit -- -m "Add bashrc and app config"
chezmoi git remote add origin /srv/dotfiles.git
chezmoi git push -- -u origin main
```

The fake GitHub lives on this server, so `vps-a` can use a plain path as the remote. `vps-b` reaches the same repo over SSH. git treats the two kinds of URL the same way.

To skip the commit-and-push step from now on, have chezmoi do it whenever it changes the source:

```sh
# vps-a
mkdir -p ~/.config/chezmoi
printf '[git]\n    autoCommit = true\n    autoPush = true\n' > ~/.config/chezmoi/chezmoi.toml
```

**This config file belongs to the machine, not the repo.** It lives outside the source directory, so each machine needs its own copy.

Now switch to the `vps-b` window:

```sh
# vps-b
chezmoi init root@vps-a:/srv/dotfiles.git   # clone only, do not apply yet
chezmoi status
#  M .bashrc
#  A .config
#  A .config/app
#  A .config/app/config.toml
chezmoi diff ~/.bashrc
# ...
# +
# +export EDITOR=vi
# +alias ll="ls -la"
# +alias gs="git status"
# +alias gl="git log --oneline"
# +alias ..="cd .."
```

`.bashrc` is `M`, not `A`. `vps-b` already has its own `.bashrc` from Ubuntu, and `apply` would replace it with the copy from `vps-a`. Here the two files only differ by your lines, so go ahead:

```sh
# vps-b
chezmoi apply
tail -5 ~/.bashrc                # all five lines from vps-a
mkdir -p ~/.config/chezmoi
printf '[git]\n    autoCommit = true\n    autoPush = true\n' > ~/.config/chezmoi/chezmoi.toml
```

The daily loop between machines is one command each way:

| On the machine where you changed something | On the other machines |
| --- | --- |
| `chezmoi edit --apply FILE` or `chezmoi re-add` (autoPush pushes) | `chezmoi update` (pull, then apply) |

> [!warning] The first apply on a machine does not ask
> chezmoi asks before overwriting a file only if it wrote that file before and something else has changed it since. A file that already exists on a new machine, like the `.bashrc` you just replaced, gets replaced silently. That is why the commands above use `chezmoi init`, then `status` and `diff`, then `apply`. The shortcut `chezmoi init --apply URL` skips the look.

> [!tip] Try it
> On `vps-b`, check that `chezmoi git log -- --oneline` shows the same history as on `vps-a`.

## 6. Scenarios

Try each one before opening the solution. They follow on from each other, so do them in order.

### Scenario A: a tool rewrites your config

Your git identity lives in `~/.gitconfig`, and you want your git aliases on every machine.

1. On `vps-a`, start managing `~/.gitconfig`.
2. Add an alias the way you normally would: `git config --global alias.st status`.
3. Get that alias onto `vps-b`.

> [!success]- Solution
> ```sh
> # vps-a
> chezmoi add ~/.gitconfig                  # autoCommit: "Add .gitconfig", pushed
> git config --global alias.st status
> chezmoi status
> # MM .gitconfig
> chezmoi re-add                            # autoCommit: "Update .gitconfig", pushed
>
> # vps-b
> chezmoi update
> git config --global alias.st              # prints: status
> ```
> git wrote the file itself, so this is Way 2 (`re-add`). `mise use -g`, `gh auth login`, and editor settings screens all behave the same way.
>
> Notice that `vps-b` already had its own `~/.gitconfig` from Setup, and `update` replaced it without asking. That is the warning from Part 5. Here it was harmless because the identity matched. On a real machine, run `chezmoi git pull` and `chezmoi diff` before `chezmoi apply` the first time a new file arrives.

### Scenario B: you changed the same file on both machines

1. On `vps-b`, add `alias k=kubectl` straight to `~/.bashrc`, and forget to `re-add`.
2. On `vps-a`, use `chezmoi edit --apply ~/.bashrc` to add `alias g=git`.
3. On `vps-b`, run `chezmoi update`.

chezmoi stops with `.bashrc has changed since chezmoi last wrote it?` and the choices `diff/overwrite/all-overwrite/skip/quit`. Choose `quit`. Finish with both aliases on both machines.

> [!success]- Solution
> ```sh
> # vps-b, after quitting the prompt
> chezmoi status
> # MM .bashrc
> chezmoi diff
> # -alias k=kubectl          <- your local edit, which apply would remove
> # +alias g=git              <- vps-a's edit, which the pull brought in
>
> chezmoi edit ~/.bashrc      # add: alias k=kubectl   (autoPush pushes it)
> chezmoi diff                # now only adds lines, removes none
> chezmoi apply --force       # source wins, and the source now has both
>
> # vps-a
> chezmoi update
> tail -2 ~/.bashrc
> # alias g=git
> # alias k=kubectl
> ```
> The pull had already updated the source; only the apply stopped. So the source had `vps-a`'s change and the home file had yours. The fix is to make the source correct, then let it win with `--force`.
>
> Do not reach for `chezmoi re-add` here. It copies the home file over the source, which deletes `alias g=git`, and with autoPush that deletion reaches every machine. A cheap habit prevents the whole situation: `re-add` before you walk away from a machine.

### Scenario C: a third machine, and a file you no longer want synced

A new user on `vps-b` has its own empty home directory, so it works as a third machine without renting another server. Create it and give it the same access to the fake GitHub that `root` has:

```sh
# vps-b, as root
adduser --disabled-password --comment "" laptop-c
su - laptop-c -c 'ssh-keygen -t ed25519 -N "" -q -f ~/.ssh/id_ed25519 && cat ~/.ssh/id_ed25519.pub' \
  | ssh root@vps-a 'cat >> ~/.ssh/authorized_keys'
su - laptop-c                    # prompt: laptop-c@vps-b:~$

ssh -o StrictHostKeyChecking=accept-new root@vps-a true
git config --global user.name  "Lab Student"
git config --global user.email "student@example.com"
```

Then:

1. As `laptop-c`, set up chezmoi from `root@vps-a:/srv/dotfiles.git` without losing your existing `.bashrc` for good.
2. You no longer want `~/.config/app/config.toml` synced. Stop managing it everywhere, but keep the file on every machine.

> [!success]- Solution
> ```sh
> # laptop-c@vps-b
> chezmoi init root@vps-a:/srv/dotfiles.git
> chezmoi status
> #  M .bashrc
> #  A .config
> #  A .config/app
> #  A .config/app/config.toml
> #  M .gitconfig
> chezmoi diff ~/.bashrc                    # far more than your aliases: read it
> cp ~/.bashrc ~/.bashrc.before-chezmoi
> chezmoi apply
>
> mkdir -p ~/.config/chezmoi
> printf '[git]\n    autoCommit = true\n    autoPush = true\n' > ~/.config/chezmoi/chezmoi.toml
> chezmoi forget ~/.config/app/config.toml  # asks to confirm, then commits and pushes
> ls ~/.config/app                          # config.toml is still here
> exit                                      # back to root@vps-b
>
> # vps-a
> chezmoi update
> chezmoi managed                           # config.toml is gone from the list
> ls ~/.config/app                          # but the file is still here
> ```
> The diff is long because a new user's `.bashrc` comes from `/etc/skel`, and Ubuntu's version of that file is not the same as root's. `apply` replaces the whole file, not just the end of it. This is the Part 5 warning in a form you will meet on a real new machine, and why `status` and `diff` come before the first `apply`.
>
> `forget` only removes the file from the source; the real file stays put on every machine. Its destructive sibling, `chezmoi destroy`, deletes the file from the source and from your home directory.

When you are done, delete both servers in your provider's dashboard, then remove their host keys from your laptop with `ssh-keygen -R $A` and `ssh-keygen -R $B`. Nothing on your laptop was touched apart from `~/.ssh/known_hosts`.

## Cheat sheet

| Want to | Use |
| --- | --- |
| Start using chezmoi on a machine | `chezmoi init` (new) or `chezmoi init URL` (existing repo) |
| Start managing a file | `chezmoi add FILE` |
| Change a file yourself | `chezmoi edit --apply FILE` |
| Keep changes a tool made | `chezmoi re-add` |
| See what apply would do | `chezmoi status`, `chezmoi diff` |
| Write the source to home | `chezmoi apply` |
| Get changes from other machines | `chezmoi update` |
| Find a file's source copy | `chezmoi source-path FILE` |
| Run git in the source | `chezmoi git ...`, with `--` before flags |
| Open a shell in the source | `chezmoi cd` |
| Commit and push automatically | `[git] autoCommit = true, autoPush = true` in `~/.config/chezmoi/chezmoi.toml` |
| Overwrite home with the source | `chezmoi apply --force` |
| Stop managing a file, keep it | `chezmoi forget FILE` |
| List managed files | `chezmoi managed` |
| Check your setup | `chezmoi doctor` |

## Going further

- **Templates.** Rename a source file to end in `.tmpl` and chezmoi renders it with Go templates before writing it. Your two servers already have different hostnames, so `{{ if eq .chezmoi.hostname "vps-a" }}` is a quick first template. The same idea gives you one `.gitconfig` with a work email on the work laptop and a personal email at home. Run `chezmoi data` to see the variables available, and read the [templating guide](https://www.chezmoi.io/user-guide/templating/).
- **Scripts.** A source file named `run_once_install-tools.sh` runs once per machine on `apply`. Use it to install packages so that a new server or laptop is one `chezmoi init --apply` away.
- **Merging.** `chezmoi merge FILE` opens a three-way merge of the home file, the source, and the target in vimdiff. It is the alternative to Scenario B's edit-then-force when the two sides differ in more than a line or two. `chezmoi merge-all` does every conflicted file.
- **Secrets.** Do not commit SSH keys or tokens in plain text. chezmoi can encrypt files with age or gpg, or read secrets from 1Password, Bitwarden, and other password managers at apply time.
- **[The chezmoi user guide](https://www.chezmoi.io/user-guide/command-overview/)** is thorough. The [comparison table](https://www.chezmoi.io/comparison-table/) explains how it differs from a bare git repo or GNU Stow.
