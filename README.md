# koggala-reserve-website

## Storytelling tuning

- `script.js` -> `TUNING.story` and `TUNING.journey` control parallax depth and boat motion.
- Adjust `maxShift` to increase/decrease layer depth for each story block.
- Adjust `lerp` and boat `lerp` values to make motion snappier or smoother.
- Use `TUNING.motionScale` to reduce motion on mobile or for reduced-motion users.

## Add or remove steps

- `index.html` -> keep the number of cards and steps equal for each block.
- Story block: `.story-card` and `.story-step` with sequential `data-card` / `data-step` (0..n).
- Gallery block: `.gallery-frame` and `.gallery-step` with matching indices.
- Journey block: `.journey-card` and `.journey-step` with matching indices.
- To slow the boat on a step, add `data-slow="true"` to the matching step.
