# Project map

- Before you work on your own for a long stretch (more than about 30 minutes, or several tasks in a row without me), start the `project-map` agent in the background to draw the current map.
- After each milestone is done, run `project-map` again.
- The first time `project-map` runs in a project where it has no saved style, run it in the foreground. If it replies "STYLE NEEDED", ask me, then run it again with my answer.
- When I ask "where are we?" or something like it, answer from `.project-map/state.json` and `.project-map/index.html`. If the map is older than the latest commit, run `project-map` first.
- Follow the map's suggested next step unless I say otherwise.
- When something needs my decision, give it to `project-map` to add to the map, with a default. If I have not answered by the next map update, use the default, say so, and keep going.
