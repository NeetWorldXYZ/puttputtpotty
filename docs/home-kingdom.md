# City home screen

The approved city-overlook reference replaces the folded-map clubhouse home. A dominant Open Throne Map button leads into the real location map. The smaller Daily Course and Quick Match cards retain their existing destinations. The kingdom chip opens the current player's profile.

The gear groups sound, account, help, challenges and custom practice. Shared navigation icons, destination order and the central Map spotlight remain. The existing menu music hook continues across navigation. Short landscape viewports allow content scrolling; phone portrait layout reserves space for the bottom dock and device safe areas.

Daily results are keyed to the current course seed, use actual standings or the locally saved score, and open the Daily rankings tab. The existing noon/midnight Eastern reset schedule is unchanged. The Quick Match record uses the same ranked-only frontend reader as the Match lobby. No database, server, matchmaking or gameplay rules changed.

## Artwork

`public/art/home-kingdom-city.webp` was prepared using the built-in image-generation tool from the user's approved home mockup. The logo and environmental signs are part of the scene; all interactive controls and personal statistics are rendered separately. SVG icons and the podium are in `src/game/HomeArtwork.tsx`.

Final image prompt:

> Use case: precise-object-edit. Asset type: production mobile game home hero artwork. Edit the supplied approved Putt Putt Potty mockup into a clean single hero illustration. Output portrait 1024x1152. Preserve the EXACT illustration style, composition, city, blue sky, river, buildings, bridges, glowing crowned toilet map pins, foreground crowned boy in blue hoodie holding putter on the lower left, and wooden sign on lower right. KEEP the large PUTT PUTT POTTY logo and the exact tagline TAKE OVER REAL BATHROOMS NEAR YOU. in the same upper composition. KEEP the five signboards BARS / RESTAURANTS / REST AREAS / HOTELS / AND MORE... Remove the gear button, the top right kingdom account button, every phone status indicator, and ALL of the UI from OPEN THRONE MAP downwards (yellow button, daily card, quick match card, bottom navbar). Frame only the illustration originally ABOVE the yellow OPEN THRONE MAP button, keeping a little grass under the character and bottom sign. Replace the removed top controls with continuous sky. Use almost the exact existing top scene; do not redesign, add a border, invent new text, alter character design, or turn it into another phone mockup. The result is artwork with logo/tagline/sign but ZERO buttons, numbers, menus, app chrome, or interactive labels. Keep entire crown, face, putter, and every signboard visible. Reserve same clear sky strip at the top for separately coded settings and kingdom controls.

Validation: TypeScript and Vite production build pass; git diff whitespace check passes. The automated browser blocks local preview URLs, so device visual review is through the Vercel preview.
