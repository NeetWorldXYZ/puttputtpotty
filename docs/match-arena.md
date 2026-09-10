# Match arena redesign

Based on production commit `33048da490a1dfa788d7f98ce55f3bf4e779dfe9`.

## Scope

Match lobby presentation only, with a read-only ranked record query. Existing matchmaking, invite generation, course generation, replay verification, scoring, navigation dock, and other screens remain intact. The ranked arena persists while searching. Friend invites support 3, 9, or 18 holes; custom settings reuse those unranked invites or the existing generated solo-course flow.

Ranked results are completed matches with a null invite code involving the authenticated player, protected by existing player-only RLS. Wins, losses, draws, and win rate come from exact counts. Errors are shown with retry; no fabricated history or tier. Per user request, no skill tier or rank badge is displayed.

## Artwork

Generated with the built-in image-generation tool using the supplied match mockup as reference. WebP exports total approximately 153 KiB. Titles, button labels, avatars, opponent state, and record values are live HTML/SVG, not baked into the scenery. The existing avatar renderer and dock artwork are reused.

- `public/art/match-arena.webp`: stadium bathroom environment
- `public/art/match-friends.webp`: two golfers with caps and putters
- `public/art/match-custom.webp`: course notebook, pencil, settings gear

## Generation prompts

### Arena

Create a production game background asset ONLY, landscape aspect ratio 3:2, 1536x1024. Use the attached Putt Putt Potty match-screen mockup as the exact art style reference. Render ONLY the bathroom mini-golf stadium environment behind the main ranked matchup: polished dimensional cartoon illustration, thick dark navy outlines, midnight blue tiled bathroom walls receding in perspective, two banks of bright stadium spotlights at upper left and upper right, cyan glow from left and hot coral red glow from right, a lush short green putting surface on the bottom fifth. Left side wooden sign reads exactly GOOD PUTTS BETTER DUMPS. stacked, right side sign reads exactly PLAY SIT REPEAT. stacked, with small outline crowns at bottom of signs. Narrow benches underneath signs and green shrubs in bottom corners. Background has slight energetic cyan/red light rays in center. All props/signs at far sides. Keep central 65% open and uncluttered for live player portraits, and top central 35% empty darker blue tiled wall for HTML title. NO avatars, NO people, NO silhouettes, NO portrait frames, NO crown in center, NO VS, NO title, NO navigation, NO buttons, NO stats, NO UI card borders. Full bleed rectangular background. Faithfully match reference art quality and palette; this is a polished mobile game for adults, playful dimensional cel shading, not photorealism.

### Friend

Create one polished wide landscape 3:2 game card illustration for the PLAY A FRIEND tile in the attached Putt Putt Potty reference. EXACTLY match the two smiling simple round-faced human golfers in the lower left tile of reference: cream round faces with black oval eyes and curved smile, heavy dark navy outlines, dimensional cel shading. Left golfer wears a blue baseball cap and green hoodie. Right golfer wears a red baseball cap and warm orange hoodie. They are bumping their fists together in center and holding small blue and gold golf putters crossed just above their touching hands. Three small gold celebration lines above the putters. Waist-up composition with both characters grouped together, centered, entire hats visible, plain dark teal/cobalt blue radial sunburst background, strong clean lighting, game-ready premium cartoon graphics, expressive but understated young adult casual golf. Keep the characters within central 80%, filling most of the canvas, and lower bodies stop at bottom edge. NO text anywhere, no title, no UI, no button, no border, no ticket, no frame, no toilet heads. Illustration only, matching attached mockup.

### Custom

Create one polished wide landscape 3:2 game card illustration matching the CUSTOM MATCH tile in the lower right of attached Putt Putt Potty reference. Centered cluster of an oversized cream spiral golf scorecard notebook tilted left with thick navy outline and six black binding loops along top, elegant simple teal score lines on paper with no words or numbers, a large yellow pencil with pink eraser leaning diagonally bottom-left to top-right in front of notebook, and a glossy sky-blue settings gear at lower right. Small grass blades bottom of objects. Color palette cream, gold, mint, cyan; thick midnight-navy outlines, clean premium dimensional cel-shading and small bright highlights, same illustration style as reference. Emerald green and deep teal subtle radial sunburst full-bleed background. Keep all objects grouped in central 78% with breathing room and no cropping, fill most of the image. NO text, no buttons, no interface, no frame, no people, no navigation. This is an actual in-game illustrated asset, NOT a complete mockup.

