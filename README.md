# Corner Set — Version B

Run from the project root:

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

- Version A: http://127.0.0.1:8765/prototype/v3/
- Version B: http://127.0.0.1:8765/version-b/

Both versions can run in separate tabs using one server. Version B uses its own local assets and browser storage keys.

In Audience Browse, use the Map and List segments above the navigation bar. Tap a performer marker to see the performer card and tap the map background to dismiss it. Audience badges use the same count as the corresponding cards.

The three street-art photographs in assets/street-art are 4× exports of the approved Figma photo layers. The performer cards and hero views use the same exports. The hero containers crop the wide exports with object-fit: cover. Performer avatars and location assets retain their original imagery.
