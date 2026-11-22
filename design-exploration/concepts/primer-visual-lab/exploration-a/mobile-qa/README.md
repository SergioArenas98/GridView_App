# Exploration A home-dark-v1 — mobile rendering QA

Source: `../home-dark-v1.html`, unmodified. Chrome 157 headless via the DevTools
Protocol, `mobile: true`, 390×844 CSS px, DPR 2. Frames step through the whole
scroll (120px overlap), so together they show the complete Home.

| File | Scroll |
|---|---|
| `lab-a-home-dark-v1-390x844-01.png` | 0 |
| `lab-a-home-dark-v1-390x844-02.png` | 695 (end) |

| Check | Result |
|---|---|
| Document width | 390 (no horizontal scroll) |
| Elements outside viewport | 1 — the decorative glow, clipped by its section's `overflow-hidden`; not visible overflow |
| Document height | 1539 |
| Header | sticky, 56px |
| Bottom nav | fixed floating bar, 56px, 16px above bottom edge |
| Clearance above nav at end of scroll | 40px (last content bottom 732, nav top 772) |
| Fonts loaded | Space Grotesk, JetBrains Mono, Inter, Material Symbols Outlined |
| Text under 12px | 32 elements at 9–11px, incl. "Last successful check", both "Status unknown" (9px), section labels, leader labels, "Final", "Winner" and all four nav labels (9px uppercase) |

No information is hidden behind the navigation. Readability fails on the
small monospaced uppercase labels, which carry real data and states.
