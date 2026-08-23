#!/usr/bin/env bash
# SmartRail OS — Dev Server Launcher
#
# Usage:
#   ./dev.sh                        # Normal mode (real wall-clock time)
#   ./dev.sh --dev-time 09:00       # Pin sim clock to 09:00 (trains active)
#   ./dev.sh --dev-time 18:30       # Pin sim clock to 18:30 (evening peak)
#
# The --dev-time flag bypasses the 06:20–22:09 service window so you can
# develop at any hour of the night without trains being NOT_IN_SERVICE.
# This is equivalent to setting DEV_SIM_TIME=HH:MM in your .env file.

set -e

DEV_TIME=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --dev-time)
            DEV_TIME="$2"
            shift 2
            ;;
        --dev-time=*)
            DEV_TIME="${1#*=}"
            shift
            ;;
        *)
            echo "Unknown argument: $1"
            echo "Usage: $0 [--dev-time HH:MM]"
            exit 1
            ;;
    esac
done

if [[ -n "$DEV_TIME" ]]; then
    echo "🕐 Dev mode: simulation clock pinned to $DEV_TIME"
    export DEV_SIM_TIME="$DEV_TIME"
else
    echo "🕐 Normal mode: using real wall-clock time"
fi

exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
