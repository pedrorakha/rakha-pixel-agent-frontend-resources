# Sprite Sheet Format

This directory holds sprite sheets for pixel art characters and office furniture.

## Expected Sprite Sheet Format

### Character Sprites
- **File format:** PNG with transparency
- **Frame size:** 16x16 pixels per frame
- **Layout:** Grid-based sprite sheet
- **Rows (states):**
  - Row 0: Idle (2 frames)
  - Row 1: Walking Down (4 frames)
  - Row 2: Walking Up (4 frames)
  - Row 3: Walking Left (4 frames)
  - Row 4: Walking Right (4 frames)
  - Row 5: Typing (4 frames)
  - Row 6: Focused / Headphones (2 frames)
  - Row 7: Drinking Coffee (4 frames)
  - Row 8: Sleeping (2 frames)

### Furniture Sprites
- **File format:** PNG with transparency
- **Desk:** 32x16 pixels
- **Bed:** 16x32 pixels
- **Coffee Machine:** 16x16 pixels
- **Chair:** 16x16 pixels

### Tileset
- **File format:** PNG
- **Tile size:** 16x16 pixels
- **Layout:** Grid of tiles
  - Tile 0: Empty
  - Tile 1: Wall
  - Tile 2: Floor (variant A)
  - Tile 3: Floor (variant B)

## Naming Convention
- `character-{name}.png` — Individual character sprite sheets
- `tileset.png` — Office tileset
- `furniture.png` — Furniture sprite sheet

## Current State
The application currently uses colored rectangle placeholders for all graphics.
Replace the placeholder rendering in `src/engine/renderer.ts` with actual
sprite sheet rendering using the `SpriteSheet` class from `src/engine/sprite-sheet.ts`.
