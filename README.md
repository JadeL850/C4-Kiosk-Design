# Subject to View — kiosk site

Horizontally scrolling version of the "Kiosk Frame — Silver (v2)" Figma frame.
Headlines and title: Barlow Condensed Bold. Body: Hanken Grotesk. Both are bundled in fonts/, so it runs offline.

## Images (one-time, ~1 minute)
In Figma, inside "Kiosk Frame — Silver (v2)", the seven photo layers are named `img/cams`, `img/eye`,
`img/walking`, `img/thumb`, `img/measured`, `img/categorized`, `img/judged` and already have JPG export settings.
Select those seven layers → Export (right panel) → export into this folder. Figma creates `img/` for you.

## Run
Open this folder in VS Code and use the Live Server extension (right-click index.html → Open with Live Server),
or just double-click index.html.

## Controls
Scroll wheel / trackpad, click-and-drag, swipe on touch, arrow keys, Home/End.
Every press or swipe leaves a faint fingerprint on the glass that fades over ~9 s (set LIFE in script.js).
