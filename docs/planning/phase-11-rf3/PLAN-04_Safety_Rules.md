# [PLAN-04] RF3 UX SAFETY RULES

## Protection Rules for Operational Familiarity
To ensure RF3 (Command UI) does not disturb the existing user mental model, the following safety rules must be enforced during implementation.

### 1. Minimal Visual Disturbance
- **No giant CTA buttons**: Avoid adding "View Details" buttons in table cells. Use the data itself (unit name, metric value) as the link.
- **Subtle Affordance**: Clickable elements should only change state on hover (e.g., slight background tint or underline).
- **Icon Economy**: Do not add icons to every link. Use the existing `ChevronRight` or `ExternalLink` only in Insight bullets.

### 2. Interaction Safety
- **No Popup Spam**: Navigation should happen via page transition, not modal popups (unless it's a quick preview).
- **Preserve Reading Flow**: Ensure that making text clickable doesn't break the legibility of the MoM Territory table.
- **Right-Click Friendly**: All command actions should be standard HTML `<a>` tags (via `Link` component) to allow "Open in New Tab".

### 3. Layout Integrity
- **Zero Layout Drift**: Adding navigation logic should not change the width or height of any component.
- **Maintain Whitespace**: Preserve the premium, airy feel of the RF2B dashboard.

### 4. Contextual Awareness
- **"Where am I?"**: Destination pages must clearly show that they are being filtered by a command from the dashboard.
- **Easy Exit**: Always provide a "Clear Filters" or "Back to Dashboard" link that is clearly visible.
