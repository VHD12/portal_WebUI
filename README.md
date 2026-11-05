# Portal — Web UI interaction

**Live:** https://vhd12.github.io/portal_WebUI/

A scroll-driven hero for Portale. A glass portal stands fixed in a desert scene, and scrolling moves the camera around it and then through it.

## What happens on scroll

1. **Orbit.** The camera circles the portal until it faces you straight on. The background sits further back, so it slides more slowly and reveals the mesa on the left. White light creeps in from the portal's edges, about 20% of the way in by the time it faces front.
2. **Rest.** The portal holds front-on with its edges glowing.
3. **Enter.** White floods the portal from the edges to the centre, light spills out around it, and the camera moves forward until the door fills the screen. The heading and buttons rise behind the portal as you go in, and you land in the next section.

Everything is plain HTML, CSS 3D transforms and a little JavaScript. There are no libraries and no build step.

## Run locally

Serve the folder with any static server, for example:

```bash
python3 -m http.server 5178
```

Then open http://localhost:5178.

## Tuning

All the motion values are in the `CONFIG` block at the top of `script.js`:

| Setting | What it controls |
|---|---|
| `orbit` | Camera angle around the portal, start → end |
| `depth`, `bgTurn`, `bgPan` | How far back the background sits, how much it turns, and how far it travels |
| `phases` | Where the orbit and the entry start and end in the scroll |
| `glow` | How far the edge glow reaches, and when the white flood, forward move and outer glow happen |
| `copy` | When the text rises and how far it travels |
| `inside` | Zoom and horizon of the view inside the portal |

The sunlight colour is `--sun` in `style.css`. The total scroll length is the `.track` height.

## Credits

Background photo: Monument Valley by [Gantavya Bhatt](https://unsplash.com/photos/a-dirt-road-in-the-middle-of-a-desert-Kdv_L0dPn54) on Unsplash.
