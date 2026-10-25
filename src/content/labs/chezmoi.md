---
title: 'chezmoi Lab'
description: 'A hands-on lab on chezmoi: manage dotfiles across two simulated laptops, learn which commands move changes in which direction, and resolve drift without losing work.'
pubDate: 'Oct 25 2026'
topic: 'chezmoi'
level: 'Beginner'
duration: 45
audience: 'Developers comfortable with git and the shell who have never used chezmoi'
levelFrom: 'Keeps a few dotfiles, has never used chezmoi'
levelTo: 'Can add, edit, apply, re-add, and sync dotfiles across machines, and resolve drift without losing work'
---

A hands-on, ~45 minute lab on [chezmoi](https://www.chezmoi.io), a tool that keeps your dotfiles in a git repo and puts them in place on every machine you use. Assumes you are comfortable with git and the shell, and have never used chezmoi. By the end you can run the daily loop on two machines and fix the situation that confuses everyone at first: a file that changed in two places.

You will not touch your real dotfiles. The lab builds three fake laptops as folders under `~/Labs/chezmoi`, each with its own home directory, plus a local git repo that stands in for GitHub. Every command here was run against chezmoi 2.73.2 and git 2.50 on macOS with zsh. Linux works the same if zsh is installed.

| Part | Topic | Time |
| --- | --- | --- |
| 1 | The mental model | 4 min |
| 2 | Your first managed files | 6 min |
| 3 | Look before you apply | 5 min |
| 4 | Two ways to make a change | 8 min |
| 5 | Sync through git | 7 min |
| 6 | Scenarios | 15 min |

## Setup

Install chezmoi if you do not have it: `brew install chezmoi`, or see [the install page](https://www.chezmoi.io/install/). You need git 2.28 or newer.

```sh
chezmoi --version
git --version
mkdir -p ~/Labs/chezmoi && cd ~/Labs/chezmoi
```

Create the fake GitHub and a helper that opens a shell on a fake laptop:

```sh
cat > ~/Labs/chezmoi/machine.zsh <<'EOF'
export LAB=~/Labs/chezmoi
[[ -d $LAB/remote.git ]] || git init --bare --quiet --initial-branch=main $LAB/remote.git

# machine NAME: open a shell whose $HOME is $LAB/NAME. Type `exit` to leave.
machine() {
  local home=$LAB/$1
  local bin=${$(mise which chezmoi 2>/dev/null || command -v chezmoi):h}
  mkdir -p $home
  git config --file $home/.gitconfig user.name  "Lab Student"
  git config --file $home/.gitconfig user.email "student@example.com"
  git config --file $home/.gitconfig init.defaultBranch main
  (cd $home && env -u XDG_CONFIG_HOME -u XDG_DATA_HOME -u XDG_STATE_HOME -u XDG_CACHE_HOME \
    HOME=$home PATH="$bin:$PATH" PS1="[$1] %~ %# " zsh -f)
}
EOF
source ~/Labs/chezmoi/machine.zsh
machine laptop-a
```

Your prompt is now `[laptop-a] ~ %`, and `~` means `~/Labs/chezmoi/laptop-a`. chezmoi decides where everything lives from `$HOME`, so it cannot see your real files from here. To switch laptops, `exit` and run `machine laptop-b`. If you open a new terminal, run `source ~/Labs/chezmoi/machine.zsh` again first.

> [!note] Why the helper is fiddly
> The `env -u XDG_...` part stops chezmoi from following any XDG variables that point at your real config. The `bin=` line finds chezmoi's real path before `$HOME` changes, because version-manager shims (mise, asdf) look up their own config under `$HOME` and break inside a fake one.

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

**The source directory does not hold `.zshrc`, it holds `dot_zshrc`.** chezmoi encodes file attributes in the name: `dot_` becomes a leading `.`, `private_` means permissions 600, `executable_` means chmod +x. So you never edit the source by guessing a path; you ask chezmoi.

## 2. Your first managed files

Inside `laptop-a`, create two dotfiles, then start a chezmoi source directory and hand the files to it:

```sh
printf 'export EDITOR=vi\nalias ll="ls -la"\n' > ~/.zshrc
mkdir -p ~/.config/app && printf 'theme = "dark"\n' > ~/.config/app/config.toml

chezmoi init                     # creates ~/.local/share/chezmoi as an empty git repo
chezmoi add ~/.zshrc ~/.config/app/config.toml
chezmoi managed
# .config
# .config/app
# .config/app/config.toml
# .zshrc
```

Look at what `add` created:

```sh
find ~/.local/share/chezmoi -not -path '*/.git*'
# ~/.local/share/chezmoi
# ~/.local/share/chezmoi/dot_zshrc
# ~/.local/share/chezmoi/dot_config
# ~/.local/share/chezmoi/dot_config/app
# ~/.local/share/chezmoi/dot_config/app/config.toml

chezmoi source-path ~/.zshrc     # where the master copy of a file lives
# ~/.local/share/chezmoi/dot_zshrc
```

`add` copies; it does not move or link. Your `~/.zshrc` is still a normal file, and right now both copies are identical.

## 3. Look before you apply

| Command | Shows |
| --- | --- |
| `chezmoi status` | One line per file that `apply` would change, with two status columns |
| `chezmoi diff` | The exact change `apply` would make to your home directory |
| `chezmoi apply -nv` | Same as diff, as a dry run (`-n`) with verbose output (`-v`) |

Change the source copy directly, then look:

```sh
echo 'alias gs="git status"' >> $(chezmoi source-path ~/.zshrc)

chezmoi status
#  M .zshrc

chezmoi diff
# ...
#  export EDITOR=vi
#  alias ll="ls -la"
# +alias gs="git status"

chezmoi apply -v                 # write it to ~/.zshrc
chezmoi status                   # prints nothing: home matches source
```

Read `status` like `git status --short`, but with different columns:

- **Second column**: what `apply` would do to the file (`A` add, `M` modify, `D` delete).
- **First column**: the file changed since chezmoi last wrote it. Something other than chezmoi touched it.

**`chezmoi diff` shows the future of your home directory, not your edit.** A `+` line is something `apply` would add, and a `-` line is something `apply` would take away. When you have edited a file in your home directory, the `-` lines are your edit.

> [!tip] Try it
> Add `alias gl="git log --oneline"` to `~/.zshrc` directly, not through chezmoi. Before running anything, predict what `chezmoi status` prints and whether `chezmoi diff` shows your new line with a `+` or a `-`. Then check, and leave the change in place for Part 4.
>
> > [!success]- Solution
> > ```sh
> > echo 'alias gl="git log --oneline"' >> ~/.zshrc
> > chezmoi status
> > # MM .zshrc
> > chezmoi diff
> > # -alias gl="git log --oneline"
> > ```
> > First column `M`: the file changed behind chezmoi's back. Second column `M`: `apply` would modify it. The `-` means running `apply` now would delete your new alias, because the source does not have it.

## 4. Two ways to make a change

You have two ways to make a change. Pick whichever matches how the change happened.

**Way 1: edit the source, then apply.** Use this when you are the one making the change.

```sh
chezmoi edit --apply ~/.zshrc
```

This opens the source copy in `$EDITOR` and applies it when you quit. Without `--apply`, the change waits in the source until your next `chezmoi apply`.

**Way 2: edit the real file, then copy it back.** Use this when a tool wrote the file for you: `git config --global`, `mise use -g`, an app's settings screen, or you editing `~/.zshrc` out of habit.

```sh
chezmoi re-add                   # copy every modified managed file back into the source
chezmoi status                   # prints nothing
```

You have a Way 2 situation waiting from the Try it in Part 3. Run `chezmoi re-add` now, then check that the alias reached the source:

```sh
tail -1 $(chezmoi source-path ~/.zshrc)
# alias gl="git log --oneline"
```

Now practise Way 1. Run `chezmoi edit --apply ~/.zshrc`, add `alias ..="cd .."`, save, and quit. Then `tail -1 ~/.zshrc` shows it.

> [!warning] Two mistakes people really make
> - **`re-add` overwrites the source with whatever is in your home directory.** If the source holds changes you have not applied yet (an `apply` you skipped, or a `git pull`), `re-add` silently throws them away. Run `chezmoi status` and `chezmoi diff` first. Scenario B shows this happening.
> - **GUI editors return immediately.** If `$EDITOR` is `code` or `zed`, chezmoi gets the file back before you have typed anything and warns `returned in less than 1s`. Use `code --wait` or `zed --wait`.

## 5. Sync through git

The source directory is an ordinary git repo. `chezmoi git` runs git inside it from wherever you are. Put `--` before any flags meant for git, so chezmoi does not try to read them:

```sh
chezmoi git status -- --short
chezmoi git add .
chezmoi git commit -- -m "Add zshrc and app config"
chezmoi git remote add origin $LAB/remote.git
chezmoi git push -- -u origin main
```

To skip the commit-and-push step from now on, have chezmoi do it whenever it changes the source:

```sh
mkdir -p ~/.config/chezmoi
printf '[git]\n    autoCommit = true\n    autoPush = true\n' > ~/.config/chezmoi/chezmoi.toml
```

**This config file belongs to the machine, not the repo.** It lives outside the source directory, so each laptop needs its own copy.

Now bring up the second laptop:

```sh
exit
machine laptop-b
chezmoi init $LAB/remote.git     # clone only, do not apply yet
chezmoi status
#  A .config
#  A .config/app
#  A .config/app/config.toml
#  A .zshrc
chezmoi apply
cat ~/.zshrc                     # all four aliases from laptop-a
mkdir -p ~/.config/chezmoi
printf '[git]\n    autoCommit = true\n    autoPush = true\n' > ~/.config/chezmoi/chezmoi.toml
```

The daily loop between machines is one command each way:

| On the machine where you changed something | On the other machines |
| --- | --- |
| `chezmoi edit --apply FILE` or `chezmoi re-add` (autoPush pushes) | `chezmoi update` (pull, then apply) |

> [!warning] The first apply on a machine does not ask
> chezmoi asks before overwriting a file only if it wrote that file before and something else has changed it since. A file that already exists on a new machine gets replaced silently. That is why the commands above use `chezmoi init`, then `status`, then `apply`. The shortcut `chezmoi init --apply URL` skips the look.

> [!tip] Try it
> On `laptop-b`, check that `chezmoi git log -- --oneline` shows the same history as on `laptop-a`.

## 6. Scenarios

Try each one before opening the solution. They follow on from each other, so do them in order.

### Scenario A: a tool rewrites your config

Your git identity lives in `~/.gitconfig`, and you want your git aliases on every machine.

1. On `laptop-a`, start managing `~/.gitconfig`.
2. Add an alias the way you normally would: `git config --global alias.st status`.
3. Get that alias onto `laptop-b`.

> [!success]- Solution
> ```sh
> # laptop-a
> chezmoi add ~/.gitconfig                  # autoCommit: "Add .gitconfig", pushed
> git config --global alias.st status
> chezmoi status
> # MM .gitconfig
> chezmoi re-add                            # autoCommit: "Update .gitconfig", pushed
>
> # laptop-b
> chezmoi update
> git config --global alias.st              # prints: status
> ```
> git wrote the file itself, so this is Way 2 (`re-add`). `mise use -g`, `gh auth login`, and editor settings screens all behave the same way.
>
> Notice that `laptop-b` already had its own `~/.gitconfig`, created by the `machine` helper, and `update` replaced it without asking. That is the warning from Part 5. Here it was harmless because the identity matched. On a real machine, run `chezmoi git pull` and `chezmoi diff` before `chezmoi apply` the first time a new file arrives.

### Scenario B: you changed the same file on both machines

1. On `laptop-b`, add `alias k=kubectl` straight to `~/.zshrc`, and forget to `re-add`.
2. On `laptop-a`, use `chezmoi edit --apply ~/.zshrc` to add `alias g=git`.
3. On `laptop-b`, run `chezmoi update`.

chezmoi stops with `.zshrc has changed since chezmoi last wrote it?` and the choices `diff/overwrite/all-overwrite/skip/quit`. Choose `quit`. Finish with both aliases on both laptops.

> [!success]- Solution
> ```sh
> # laptop-b, after quitting the prompt
> chezmoi status
> # MM .zshrc
> chezmoi diff
> # -alias k=kubectl          <- your local edit, which apply would remove
> # +alias g=git              <- laptop-a's edit, which the pull brought in
>
> chezmoi edit ~/.zshrc       # add: alias k=kubectl   (autoPush pushes it)
> chezmoi diff                # now only adds lines, removes none
> chezmoi apply --force       # source wins, and the source now has both
>
> # laptop-a
> chezmoi update
> tail -2 ~/.zshrc
> # alias g=git
> # alias k=kubectl
> ```
> The pull had already updated the source; only the apply stopped. So the source had laptop-a's change and the home file had yours. The fix is to make the source correct, then let it win with `--force`.
>
> Do not reach for `chezmoi re-add` here. It copies the home file over the source, which deletes `alias g=git`, and with autoPush that deletion reaches every machine. A cheap habit prevents the whole situation: `re-add` before you walk away from a machine.

### Scenario C: a third laptop, and a file you no longer want synced

1. Run `machine laptop-c`, and give it an existing dotfile: `echo '# laptop-c original' > ~/.zshrc`.
2. Set up chezmoi from `$LAB/remote.git` without losing that file's contents for good.
3. You no longer want `~/.config/app/config.toml` synced. Stop managing it everywhere, but keep the file on every machine.

> [!success]- Solution
> ```sh
> # laptop-c
> chezmoi init $LAB/remote.git
> chezmoi status
> #  A .config
> #  A .config/app
> #  A .config/app/config.toml
> #  M .gitconfig
> #  M .zshrc
> chezmoi diff                              # read what will be replaced
> cp ~/.zshrc ~/.zshrc.before-chezmoi
> chezmoi apply
>
> mkdir -p ~/.config/chezmoi
> printf '[git]\n    autoCommit = true\n    autoPush = true\n' > ~/.config/chezmoi/chezmoi.toml
> chezmoi forget ~/.config/app/config.toml  # asks to confirm, then commits and pushes
> ls ~/.config/app                          # config.toml is still here
>
> # laptop-a
> chezmoi update
> chezmoi managed                           # config.toml is gone from the list
> ls ~/.config/app                          # but the file is still here
> ```
> `status` on a fresh machine shows exactly what `apply` will create (`A`) and replace (`M`), so read it before your first apply. `forget` only removes the file from the source; the real file stays put on every machine. Its destructive sibling, `chezmoi destroy`, deletes the file from the source and from your home directory.

When you are done: `exit`, then `rm -rf ~/Labs/chezmoi`. Nothing outside that folder was touched.

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

- **Templates.** Rename a source file to end in `.tmpl` and chezmoi renders it with Go templates before writing it. That gives you one `.gitconfig` with a work email on the work laptop and a personal email at home. Run `chezmoi data` to see the variables available, and read the [templating guide](https://www.chezmoi.io/user-guide/templating/).
- **Scripts.** A source file named `run_once_install-tools.sh` runs once per machine on `apply`. Use it to install packages so that a new laptop is one `chezmoi init --apply` away.
- **Merging.** `chezmoi merge FILE` opens a three-way merge of the home file, the source, and the target in vimdiff. It is the alternative to Scenario B's edit-then-force when the two sides differ in more than a line or two. `chezmoi merge-all` does every conflicted file.
- **Secrets.** Do not commit SSH keys or tokens in plain text. chezmoi can encrypt files with age or gpg, or read secrets from 1Password, Bitwarden, and other password managers at apply time.
- **[The chezmoi user guide](https://www.chezmoi.io/user-guide/command-overview/)** is thorough. The [comparison table](https://www.chezmoi.io/comparison-table/) explains how it differs from a bare git repo or GNU Stow.
