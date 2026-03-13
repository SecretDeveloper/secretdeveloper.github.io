+++
date = "2026-03-07T16:30:00+00:00"
title = "Fixing Cross-Terminal Preview Rendering in a Rust TUI"
description = "A small but revealing bug in lsv: image preview behaved differently under WezTerm because a text-based preview pipeline was accidentally swallowing terminal graphics control sequences."
draft = false
categories = ["software", "tools", "rust"]
tags = ["terminal", "cli", "developer-tools", "wezterm", "ansi", "debugging", "ai-assisted-development"]
series = ["Working with AI"]
+++

One of the stranger bugs I have hit recently came from a nice reminder that terminal programs are only simple right up until they are not.

`lsv` has a preview pane. For text files it is straightforward enough: run a command like `bat`, capture the output, render the ANSI colour, and fit it into the pane. For images I had been using `viu`, which works well in a lot of setups.

Then I got a bug report for WezTerm not displaying images in the preview panel.

Relevant bits:

- Repo: [SecretDeveloper/lsv](https://github.com/SecretDeveloper/lsv)
- Terminal: [WezTerm](https://wezterm.org/)
- Image preview tool: [atanunq/viu](https://github.com/atanunq/viu)
- The issue was fixed in the `wezterm preview fix` work in the `lsv` repo

## The actual problem

`lsv` is a text-rendered previewer. It captures command output, keeps ANSI colour, and draws text into a pane. That works fine for tools that emit ordinary text and SGR colour sequences.

The trouble is that image tools are not always just printing text. Some of them try to negotiate with the terminal using richer control sequences. In this case, `viu` under WezTerm was using the kitty graphics protocol. `lsv` does not support that protocol, so instead of a nice image it ended up seeing protocol chatter.

I added a documented workaround for the user side. In the README I now suggest forcing `viu` into block mode under WezTerm:

```lua
VIU_NO_KITTY=1 viu --blocks --static --width %d --height %d ...
```

That lowers fidelity of the image, but it gives you something useful instead of nothing.

## Initial fix

The interesting bit was in the ANSI parsing.

I was already handling normal ANSI escape sequences, but that was not enough here. Kitty-style graphics probes can use APC, PM, and DCS control strings terminated with `ESC \`. If you do not explicitly recognise and skip them, they can end up treated as if they were ordinary text fragments.

So the fix in `src/ui/ansi.rs` was not “support graphics”. It was much smaller and more practical than that. I taught the parser to notice those control-string families and skip forward until the terminating `ST` sequence. Once I did that, the preview pane stopped trying to render protocol noise as content.

## Why I liked using AI to help fix this bug

Terminal programs are full of that sort of edge. You think you are dealing with text, then it turns out you are really dealing with a layered conversation between an application, a terminal emulator, and a set of loosely shared assumptions built up over decades.

This is one of those cases where AI can help narrow the search, but it cannot substitute for understanding what the terminal stack is actually doing.
