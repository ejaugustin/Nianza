# Nianza — Marketing Site Redesign with Photography
### NZA-DESIGN-v1.0 · Claude Design Brief · July 26, 2026

For Claude Design. Rebuild the Home, Features, and Support pages as a beautiful, modern, image-rich site — while keeping the brand's existing palette, its Lora-italic-is-Patricia rule, and its emotional register (a refuge, never a glossy ideal).

| | |
|---|---|
| **Scope** | Three pages: Home (nianza-marketing-site.html), Features, Support. Privacy and Terms stay text-only (legal pages don't need imagery). |
| **What to keep** | The existing brand system: Nianza Blue `#34ABC4`, Deep Blue `#1D7A91`, warm cream `#F4F0E8`, paper `#FBF8F2`, terracotta `#C4714A` (sparingly), ink `#2C2C2C`. Fonts: DM Sans (structure) + Lora italic (ONLY for Patricia's literal voice). The refuge positioning and all existing copy — improve layout and add imagery, don't rewrite the message. |
| **What to add** | Real, warm, honest photography of parents and children, placed to carry emotional weight where prose can't. Full art direction + per-image specs below. |
| **Date** | July 26, 2026 |

---

## 1. Art Direction — Read This First

### 1.1 The single most important rule

> ⚠ This is a REFUGE for tired new parents, not an aspirational lifestyle brand. Every image must feel like REAL, ordinary, slightly-messy parenthood — NOT glossy stock. No white-linen families laughing on a white bed. No flawless nursery. No parent who looks rested and styled. The visual equivalent of "cherish every moment" is exactly what this brand is positioned against. Warmth and authenticity beat polish, every time.

### 1.2 What the images should feel like

- **Candid, not posed** — a moment caught, not a portrait arranged. Soft natural light (morning window light, warm lamp light at night), never harsh studio lighting.
- **Genuinely diverse** — across images, show a real range of skin tones, family structures (a dad alone with a baby, two moms, a grandparent helping), ages of parent, and home settings. No single "default family."
- **Ordinary homes** — a real kitchen with things on the counter, a living room with toys on the floor, an unmade bed during a night feed. Lived-in, not staged.
- **Tender but true** — tenderness is welcome (a parent's hand on a tiny back), but so is honest difficulty (a parent rubbing their eyes, a toddler mid-meltdown). The mix is the point: this app meets parents in both.
- **Color-harmonized** — favor images with warm, soft tones that sit well beside the cream/blue palette. Avoid heavily saturated or cold-blue-toned photos that fight the brand.

### 1.3 The Patricia rule — non-negotiable

> ⚠ NEVER depict Patricia as a person. No photo of a grandmother is Patricia. She is an AI companion, and the Support page literally answers "Is she a real person? Neither." Putting a face on her contradicts the product and robs each parent of imagining their own version. Patricia stays a PRESENCE: the "P" mark, her italic voice in note cards, the blue accent. If a warm older-woman image is ever used elsewhere, it must clearly read as "a grandmother" in general, never captioned or implied to BE Patricia. Safest: no grandmother images at all on Home/Features.

### 1.4 Sourcing & rights (tell Ej, don't decide silently)

- Every photo needs proper licensing AND model releases — especially critical for identifiable children. Use a reputable licensed source (paid stock with releases) or a commissioned shoot. Never scrape or use unlicensed images of real children.
- Where a real photo with clean rights isn't available for a slot, a warm original ILLUSTRATION in the postcard line-art style (washi tape, soft line figures, the brand palette) is an approved substitute — and pairs with the in-app keepsake art direction. Illustration also sidesteps the "one specific family" problem: a line-drawn parent-and-child can read as anyone's.
- Deliver images optimized: WebP with JPG fallback, responsive srcset, lazy-loaded below the fold, with meaningful alt text (accessibility + SEO).

---

## 2. HOME PAGE — Layout & Image Specs

Keep the existing section order and copy. Add imagery at these specific points. Section-by-section:

### Hero — the emotional first impression

Current hero is text + the live Patricia note card. Redesign as a two-column layout: copy and CTAs left, and on the right, the note card OVERLAPPING a hero photograph (card floating over the lower corner of the image, slight shadow — the digital-companion-meets-real-life motif).

> 📷 **HERO IMAGE:** A parent in soft morning light holding a young baby against their chest, looking down at them — not at the camera. The parent looks tired but tender, hair a little undone, in a real home (window light, maybe a kitchen or bedroom edge visible). Warm tones. Candid. This one image sets the entire emotional promise: you, exhausted, held. Landscape or 4:5 portrait crop. Keep the lower-right area visually calm so the floating note card sits over it legibly.

> ▶ The floating Patricia note card over the photo is the signature moment — real life underneath, the companion's voice on top. Preserve the card's live time-of-day behavior and the play button.

### "Why Nianza" / crianza strip

Currently a centered text strip about the word crianza. Keep it text-forward — but optionally add a single small, warm detail image to one side.

> 📷 **OPTIONAL SMALL IMAGE:** a close, tender detail — an adult hand with a baby's whole hand wrapped around one finger. Tight crop, soft focus background, warm tone. Universal, no faces, works for any family. Small (about a third of the strip width) or skip entirely to keep this section quiet.

### Comparison section (activity app / tracking app / Nianza)

Keep as-is — three cards, no photos. This section is a clean conceptual argument; imagery would clutter it. Restraint here makes the surrounding images breathe.

### Meet Patricia section

Currently a blue gradient tile with a large "P". KEEP IT ABSTRACT — do not add a photo of a person here (the Patricia rule). Optionally elevate the gradient tile with subtle warmth or a soft line-art motif, but she remains a presence, never a face.

### Hear-the-difference demo

Keep the dark demo shell as-is — no photo. The toggle is interactive proof; it stands on its own.

### Features grid (six cards)

Currently icon + text cards. Elevate two or three of the six cards with a small photo above the text (not all six — mixing photo and icon cards keeps rhythm and avoids a stock-photo wall). Suggested photo cards:

> 📷 **CARD "Daily note in her voice":** a parent on a couch in lamplight, phone in one hand, baby dozing on their chest — the quiet act of reading/listening to the note. Warm, low light, restful.

> 📷 **CARD "Milestones as celebration":** a genuinely joyful candid — a baby mid-first-wobbly-steps toward the camera, or a parent's delighted face catching a moment. Movement, imperfect, real joy (not a posed smile).

> 📷 **CARD "A record you'll want later":** a parent recording a voice memo on their phone while a toddler plays nearby, OR a close shot of a phone showing a memory/photo. Evokes keepsake without being literal.

Leave the other three cards (vaccines, growth, visit-prep) as clean icon cards — these are the more clinical/practical features and read better as calm iconography than photos.

### Trust / "we never tell you what a number means" (dark section)

Keep dark and text-driven — no photo. This is the serious, principled moment; imagery would soften a message that should land plainly. The italic Patricia line carries it.

### Moments section (four vignettes)

Currently four text cards (2am, waiting room, the day she rolled over, graduation). This is the STRONGEST candidate for photography — pair each vignette with a small image matching its moment:

> 📷 **"2:14 AM · First cold":** a dim night scene — a parent's silhouette against a nightlight, baby in arms. Dark, warm, intimate. The loneliest hour, made less lonely.

> 📷 **"4-month checkup, waiting room":** a parent and baby in a pediatric waiting room, parent glancing at their phone. Ordinary, slightly anxious, real.

> 📷 **"The day she rolled over":** a floor-level shot of a baby mid-roll on a play mat, parent's hands nearby. Candid delight.

> 📷 **"Somewhere around year five":** an older toddler/preschooler — same family feeling, visibly grown — walking away or playing independently. Bittersweet, the season ending. Could be shot from behind (no face needed), which also eases rights.

> ▶ If four licensed photos is too much for launch, illustrate these four in the postcard line-art style instead — arguably MORE on-brand here, since these are memory-vignettes and the app's own memory features use illustration.

### Final CTA

Keep the Patricia note card + store buttons. Optionally set the whole final section over a very soft, low-contrast background photo (a bright, out-of-focus home scene) with a cream overlay so text stays crisp. Subtle — atmosphere, not a focal image.

---

## 3. FEATURES PAGE — Layout & Image Specs

Currently a long single column of text sections. Redesign into an alternating layout: each major feature becomes a row with text on one side and an image on the other, alternating left/right down the page (the classic modern feature-page rhythm, done warmly). Keep every existing feature and all copy.

| Feature section | Image spec |
|---|---|
| **Patricia always one tap away** | A parent's hand holding a phone showing a warm chat interface (the Patricia note/chat), the child softly out of focus in the background. Connects the digital companion to the real room. |
| **A daily note, in her voice** | Parent listening — phone to ear or on speaker while doing something one-handed with a baby. The "less reading, more listening" idea made visual. |
| **Milestones as moments** | A candid milestone — first foods mess, first steps, a proud clumsy moment. Joyful and imperfect. |
| **Vaccines, plainly** | Skip the photo OR a very calm, neutral image — a parent and child at ease. Nothing clinical or scary (no needles, ever). This section is about REMOVING anxiety; the image must not add any. |
| **Growth as a place on a map** | Optional: a parent and child measuring height against a doorframe — the homely, non-clinical version of growth. Warm, low-stakes. |
| **Sick days, organized** | A tender caretaking moment — a parent's hand on a child's forehead, or holding a sleeping unwell child. Gentle, NOT distressing. Conveys care, not crisis. |
| **Ready before every doctor visit** | A parent looking calm and prepared, phone in hand, in a waiting room or at a kitchen table. The relief of being ready. |
| **A memory book that gives everything back** | A keepsake feeling — hands holding a printed photo, or a phone showing a memory. Nostalgic, warm. |
| **And then — graduation** | An older child, visibly grown, shot from behind or at a distance — walking into a bigger world. Bittersweet. No face needed. |

> ▶ Alternate image side (left/right) each row for rhythm. On mobile, image stacks above text every time. Not every row NEEDS a photo — if a strong, rights-clean image isn't available for one, an illustration or a clean icon-led treatment is fine; variety prevents the stock-wall effect.

Keep the closing "What Nianza will never do" callout exactly as written — no image. It's a punch of plain text and should stay one.

---

## 4. SUPPORT PAGE — Layout & Image Specs

Support should feel HUMAN and reassuring, not like a cold help desk. Keep all FAQ content. Lighten the layout and add warmth with ONE well-chosen image, not many — this is a utility page.

### Header area

> 📷 A single warm, reassuring banner-style image beneath the "Support" headline: a parent smiling gently while holding or playing with a child at home — relaxed, unhurried, the feeling of "you're in good hands." Wide crop, soft tones. This is the one emotional image; the rest of the page stays clean.

### FAQ cards

Keep the existing card layout — no per-card photos (would clutter a Q&A). The opening italic Patricia callout and the single header image carry all the warmth needed.

### Contact + medical-warning callouts

Keep both callouts as-is (the terracotta medical warning is important and must stay prominent and text-clear — no image near it that could soften its seriousness).

---

## 5. Modern Design Upgrades (beyond images)

- Generous whitespace and larger section spacing — let images and text breathe; a modern site is confident with space.
- Soft rounded corners on image containers (16–22px radius) matching the existing card system; subtle shadows for depth. Consider one signature image treatment — e.g. the hero photo in an arch/rounded-top frame echoing the postcard "Arch" template — to tie site and product together.
- Gentle scroll-reveal animations on images (fade + slight rise), respecting `prefers-reduced-motion` — the existing site already has this pattern; extend it to images.
- Maintain the Lora-italic-is-Patricia discipline strictly, even over/around images: any Patricia voice line stays italic serif; captions and UI stay DM Sans.
- Keep it fast: images are the main weight — compress hard, lazy-load, and never let the hero image delay first paint of the headline. Text first, image enhances.
- Accessibility floor: every image has descriptive alt text; decorative-only images use empty alt; color contrast on any text-over-image stays AA (use overlays/scrims).

---

## 6. Acceptance Gates (Ej)

- Every image reads as real, warm, ordinary parenthood — not glossy stock. The "white linen laughing family" test: if it looks like that, replace it.
- Zero images depict or imply Patricia as a specific person. She remains the "P" mark and the italic voice.
- Imagery is genuinely diverse across the set — no single default family type.
- No needles, no distressing medical imagery, nothing that adds anxiety on the vaccines or sick-day sections.
- Every image has clean licensing + model releases (especially any identifiable child), OR is an original illustration. Confirmed before launch.
- Pages stay fast and accessible: lazy-loaded, compressed, alt-texted, reduced-motion respected, AA contrast on text-over-image.

✓ **Definition of done:** a tired new parent lands on the page and feels, before reading a word, "these people understand what this actually feels like" — and nowhere does the site feel like it's selling them an ideal they're failing to live up to.
