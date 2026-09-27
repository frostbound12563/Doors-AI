# Threshold Hotel — Phase 1

An original, unofficial, first-person browser fan project. Its meshes, interface,
procedural layout, and synthesized sounds are made in code. It contains no copied
Roblox models, images, or audio.

## Run

Install no packages. From this folder, run:

    python3 -m http.server 8000

Open http://localhost:8000 in a desktop browser with an internet connection.
The Three.js ES module loads from jsDelivr. Opening index.html as a file is not
the supported launch method.

Click Start run, then click the view if the mouse is not captured. Esc pauses.
WASD moves; mouse looks; Shift sprints; C crouches; E interacts or exits a
wardrobe. Arrow keys provide a keyboard look alternative. Settings offer a
volume slider and a low-rendering mode.

## Architecture and scope

- `index.html`: HUD, start/pause/restart interface, settings.
- `style.css`: responsive UI and visual cue overlay.
- `game.js`: Three.js scene; seeded room assembler; deterministic pickup/key
  placement; proximity interaction; player movement; and entity registry/state
  machines.
- Rooms are 20 units long, share aligned entrance/exit openings, and generate
  when the preceding door opens. Each room has two reachable wardrobes.
- A locked door has its key in that same room. There is no purchase button in
  Phase 1, so gold is a run score, not a claimed working shop currency.
- Re-enter a seed and restart to reproduce room types, darkness, locks,
  pickup placement, and scheduled encounter rolls. Timing and player choices
  still affect what happens during an encounter.

## Source and mechanic reference

The requested primary site, https://doorsgame.wiki/, appeared in search,
but its home page and requested individual pages could not be fetched during
development. Its Floors, List of Entities, Hiding, Items, Gold, Hotel, Rush,
Ambush, Hide, and Screech page text could not be independently verified there.
The accessible pages below were used instead. This is a small adaptation:
its timing, probabilities, corridor hitboxes, room templates, and economy
are game-design values, not asserted official values.

| Mechanic | Accessible page informing it | What was adapted |
|---|---|---|
| Hotel wardrobes | https://doors-game.fandom.com/wiki/Hiding | Wardrobes are usable cover. |
| Gold | https://doors-game.fandom.com/wiki/Gold | Visible gold and container loot; no Phase 1 shop. |
| Rush | https://doors-game.fandom.com/wiki/Rush | Light warning, fast passing lethal threat, cover. |
| Ambush | https://doors-game.fandom.com/wiki/Ambush | Returning passes, hiding and exit timing. |
| Hide | https://doors-game.fandom.com/wiki/Hide | Prolonged hiding leads to warning, ejection, damage and temporary lockout. |
| Screech | https://doors-game.fandom.com/wiki/Screech | Dark-room “psst”; look at it to repel it, otherwise take damage. |
| Entity roles | https://doors-game.fandom.com/wiki/List_of_Entities | Kept different entity roles separate. |

The other requested individual entity and floor pages were not researched
sufficiently to implement their rules. No Floor 3, event, modifier, or
unreleased-floor mechanics are represented as official content.

## Implemented in Phase 1

Connected numbered rooms; four room-decoration templates; lamps and darkness;
two wardrobes per room; deterministic locks with locally available keys;
visible gold, searchable drawers and run gold total; mouse and keyboard look;
WASD, sprint, crouch, door collision, prompts, pause/settings, health,
death/restart, seed replay, original synthesized cues and subtitle warnings.
Rush makes one corridor pass; Ambush makes three with pauses; Hide penalizes
continuous wardrobe camping; Screech tests the camera's actual direction.
No Rush or Ambush encounter is scheduled before a room with wardrobes exists.

This is a bounded vertical slice, not the complete Hotel or a full DOORS
simulation. Furniture is placed off the clear central route. The corridor
attack check approximates line of sight rather than using arbitrary-room
raycast visibility. There are no copied official assets.

## Phase 1 test checklist

1. Start a run; open Door 001 and walk through to the connected next room.
2. Collect a visible gold pickup; search a drawer in a study/lounge room.
3. Press E at a wardrobe; verify movement stops and E exits.
4. Open rooms until a flicker warns of Rush; hide to survive, or stay in
   its corridor path to test death.
5. On a green Ambush warning, observe repeated passes and time wardrobe exits.
6. Remain in a wardrobe until Hide warns, ejects, damages, and blocks re-entry.
7. In a dark room, turn toward the visible Screech after “Psst!”
8. Restart with the same seed; compare the numbered rooms, keys and pickups.
9. Test a locked door: the key must be collectible before it will open.

## Subsequent phases — not implemented

Phase 2: Research and implement the other Hotel entity-specific rules,
puzzles, chase, shop, items, and polish; deliver complete updated files.
Phase 3: Research and add the Mines, Backdoor, Rooms, and Outdoors individually,
with their own progression and encounters; deliver complete updated files
for each addition.
Phase 4 (optional): Event modes, modifiers, admin-only or variant entities,
and other separately labeled experiments.
