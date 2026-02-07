---
name: no-placeholders
description: Never use placeholder syntax - implement full visual content
metadata:
  tags: composition, prompt, videoDescription, implementation
---

## Never Use Placeholders

**CRITICAL**: Your composition must implement the FULL visual content described in the user's prompt. Do NOT use placeholder syntax or display raw text.

### Forbidden Patterns

- `{{videoDescription}}` – Handlebars/template syntax is invalid in Remotion
- `{videoDescription}` when the intent is to show the prompt – the video should show the described visuals, not the prompt text
- Minimal placeholder compositions like `<div>{someVariable}</div>` when the prompt describes complex animations
- Any `{{variableName}}` or template literal placeholders

### Required Approach

1. **Parse the prompt** – Extract what the user wants: shapes, text, animations, sequences, timing
2. **Implement it in code** – Build the actual React/Remotion components:
   - Geometric shapes → SVG paths or styled divs
   - Animations → useCurrentFrame(), interpolate(), spring()
   - Text or letters → Render them as elements, not as a variable holding the prompt
3. **Match the description** – If the prompt says "8 colorful geometric shapes that morph into letters", create 8 shapes and implement the morph (e.g. with flubber for SVG morphing)

### Example: Wrong vs Right

**Wrong** (generic placeholder – "Generated Video Content", gradient, etc. – does NOT implement the prompt):
```tsx
export const MyComposition: React.FC = () => (
  <AbsoluteFill style={{ background: 'linear-gradient(...)' }}>
    <div>Generated Video Content</div>  {/* NEVER do this */}
  </AbsoluteFill>
);
```

**Wrong** (displays prompt text – will show "{{videoDescription}}" or raw prompt on screen):
```tsx
export const MyComposition: React.FC = () => (
  <AbsoluteFill>
    <div style={{ padding: 40 }}>{videoDescription}</div>
  </AbsoluteFill>
);
```

**Right** (implements the described content):
```tsx
export const MyComposition: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame, [0, fps], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: '#fff', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ fontSize: 48, opacity }}>Your actual visual content here</div>
    </AbsoluteFill>
  );
};
```
