# Life plans, personal projects, and accessible controls

## Player changes

- Six optional life directions track three concrete steps apiece, suggest a next action, and record a permanent milestone. Plans can be changed or set aside.
- Five personal projects develop family stories, creative work, community involvement, practical skills, and mentoring. Each uses weekly time, pauses without losing progress, and offers a halfway choice: finish the original scope, expand it, share it, or pause. Expanded projects require more time and offer more skill growth; shared projects strengthen living relationships.
- Keep in touch reaches up to five living family members and friends in one action, once each game week. It has a two-hour time cost and does not erase resentment.
- The Life screen shows a next step and shorter, expandable story and activity lists. More links directly to Life plans and a new how-to-play guide.
- Decision buttons state their actual choices. Buttons wrap enlarged text, primary/danger button colors meet 4.5:1 contrast across every supplied palette, progress bars expose spoken values, and notices announce their complete message.
- The time controls occupy their own layout space, with a direct link to a waiting decision. Optional company-capacity notices no longer disable every time button.
- Saving guards prevent overlapping game changes; a failed decision remains on its screen.

## Feedback informing the update

[BitLife App Store reviews](https://apps.apple.com/us/app/bitlife-life-simulator/id1374403536?see-all=reviews) raise requests for richer relationships, meaningful later-life activities, and working screen-reader access. These informed family and mentoring projects, nonfinancial goals, and explicit control labels.

[AltLife App Store reviews](https://apps.apple.com/us/app/altlife-life-simulator/id1567044511?see-all=reviews) discuss repetitive interaction, limited progression, text sizing, and stability. These informed group catch-ups, branching weekly projects, scalable buttons, and regression coverage. These reviews are qualitative examples, not a representative survey or feedback from Project Legacy players.

## Compatibility and checks

This is a JavaScript/content-only OTA change. App version, runtime policy, native code, dependencies, and SQLite schema are unchanged. The optional journey journal is created only when used; pre-update saves continue to load. Export/import retains project progress and waiting decisions. The authoritative weekly engine owns timing and outcomes; no remote service or random-number stream is added.

Automated coverage includes age/cash/experience prerequisites, upfront charges, pause/resume, branching interruption of long skips, duplicate reward prevention, deterministic weekly versus batch progress, health delays, heir transitions, save validation, milestone persistence, setting plans aside, and once-weekly catch-ups. Full verification, long simulation tests, schema/action checks, and production iOS/web exports are release gates.

Browser preview was blocked by the execution environment. Physical iOS, VoiceOver, and largest Dynamic Type visual testing were not available here; no claim of device certification is made. Production publication uses the repository’s existing successful-CI-to-EAS workflow and its app-version runtime compatibility policy.
