#!/bin/bash
# GSD Completion Notification Hook
# Cross-platform alert when Claude stops (task complete, needs input, etc.)

input=$(cat)
session_id=$(echo "$input" | jq -r '.session_id // empty')
cwd=$(echo "$input" | jq -r '.cwd // empty')
transcript_path=$(echo "$input" | jq -r '.transcript_path // empty')

# Extract project name
project="Claude Code"
if [[ -n "$cwd" ]]; then
  project=$(basename "$cwd")
fi

# Check todo list for current/completed task
message=""
if [[ -n "$session_id" ]]; then
  todo_file=$(ls -t "$HOME/.claude/todos/${session_id}"*.json 2>/dev/null | head -1)
  if [[ -f "$todo_file" ]]; then
    # Get most recently completed task, or in-progress task
    completed=$(jq -r '[.[] | select(.status=="completed")] | last | .content // empty' "$todo_file" 2>/dev/null)
    if [[ -n "$completed" ]]; then
      message="Completed: $completed"
    else
      in_progress=$(jq -r '.[] | select(.status=="in_progress") | .content' "$todo_file" 2>/dev/null | head -1)
      if [[ -n "$in_progress" ]]; then
        message="Paused: $in_progress"
      fi
    fi
  fi
fi

# Fallback: generic message
if [[ -z "$message" ]]; then
  message="Ready for input"
fi

# Send notification based on OS
case "$(uname -s)" in
  Darwin)
    osascript -e "display alert \"GSD: $project\" message \"$message\" as informational" &>/dev/null &
    ;;
  Linux)
    if command -v notify-send &>/dev/null; then
      notify-send "GSD: $project" "$message" --urgency=normal
    elif command -v zenity &>/dev/null; then
      zenity --info --title="GSD: $project" --text="$message" &
    fi
    ;;
  MINGW*|CYGWIN*|MSYS*)
    # Windows via PowerShell
    if command -v powershell.exe &>/dev/null; then
      powershell.exe -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('$message', 'GSD: $project', 'OK', 'Information')" &>/dev/null &
    fi
    ;;
esac

exit 0
