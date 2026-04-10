---
name: slay-browser
description: "Control the task browser panel via the slay CLI"
trigger: auto
---

Browser commands control the browser panel embedded in each task's detail view. All commands require `$SLAYZONE_TASK_ID` to be set (automatic in task terminals).

Every command accepts `--panel <state>` (visible | hidden). `navigate` defaults to `visible` (auto-opens the panel), all other commands default to `hidden` (operate without showing the panel).

## Commands

- `slay tasks browser navigate <url> [--panel <state>]`
  Navigate to a URL. This is the only command that auto-shows the browser panel. Use this to open pages for verification, testing, or reference.

- `slay tasks browser url [--panel <state>]`
  Print the current URL. Useful for checking where the browser is after navigation or redirects.

- `slay tasks browser screenshot [-o <path>] [--panel <state>]`
  Capture a screenshot. Returns the file path of the saved image. Use `-o` to copy the screenshot to a specific path; without it, prints the temp file path.

- `slay tasks browser content [--json] [--panel <state>]`
  Get the page's text content (truncated to 10k characters) and a list of interactive elements (links, buttons, inputs) as JSON. Useful for understanding page structure before clicking or typing.

- `slay tasks browser click <selector> [--panel <state>]`
  Click an element by CSS selector. Returns the tag name and text of the clicked element.

- `slay tasks browser type <selector> <text> [--panel <state>]`
  Type text into an input element by CSS selector.

- `slay tasks browser eval <code> [--panel <state>]`
  Execute JavaScript in the browser context and print the result. Strings are printed as-is, other values are pretty-printed as JSON.

## Workflow tips

A typical browser verification flow:
1. `navigate` to the URL
2. `content` to inspect the page and find selectors
3. `click` or `type` to interact
4. `screenshot` to capture the result
