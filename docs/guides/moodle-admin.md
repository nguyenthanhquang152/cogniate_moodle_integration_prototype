# Moodle admin guide: connect a Moodle site to Cogniate

This guide connects one Moodle site to one Cogniate library. Two people do it: a **Cogniate user** (in the Cogniate portal) and a **Moodle admin** (in Moodle). One person can do both parts.

Tags:

- `[AC-T7-14]`: QA followed this step on a live Moodle 5.2.4 site, and every label matched.
- `[AC-T7-01]`: the full end-to-end QA run used this step, and the run passed.
- `[AC-T6-…]`: QA tested this portal behaviour in task T6, and it passed.
- `[Not verified by QA]`: only the builder checked it.

There are two methods. Use **Automatic** if you can. Use **Manual** only if the automatic method fails.

## Part 1 (Cogniate user): Get the registration URL

1. Sign in to the Cogniate portal [AC-T4-01].
2. In the sidebar, click "Integrations" [AC-T7-01].
3. On the Moodle card, click "Connect". If the library has a connection already, click "Connect another site" [AC-T7-01, AC-T6-01].
4. In "Connection name", type a name, for example "Company Moodle" [AC-T7-01].
5. In "Moodle site URL", type the site origin, for example `https://moodle.example.org`. Do not add a course path [AC-T7-01].

NOTE: A Moodle site in a subfolder (for example `https://school.edu/moodle`) cannot connect today (decision Q18). MoodleCloud sites are not affected.

6. Under "Connection method", select "Automatic (recommended)" [AC-T7-01].
7. Click "Continue" [AC-T7-01].
8. Click "Copy" next to the registration URL [AC-T4-07].
9. Send the URL to the Moodle admin.

NOTE: The URL works one time. It expires after 24 hours. A used or expired URL is refused [AC-T4-09]. Then click "Make a new URL" [Not verified by QA].

The portal page also shows the six Moodle steps of Part 2, with the menu path for each step [AC-T7-14].

## Part 2 (Moodle admin): Add and activate the tool

1. Sign in to Moodle as a site administrator.
2. Go to "Site administration" → "Plugins" → "Activity modules" → "External tool" → "Manage tools" [AC-T7-14].
3. Paste the registration URL into the "Tool URL" field [AC-T7-14].
4. Click "Add LTI Advantage" [AC-T7-14, AC-T3-01].
5. If Moodle asks you to update an old tool, click "Register as a new external tool". Cogniate refuses an update [AC-T6-04, AC-T4-30].
6. In the Cogniate panel inside Moodle, check the Moodle site, the Moodle version and the Cogniate library [AC-T4-08].
7. Click "Connect" [AC-T4-08, AC-T7-14].
8. Wait until the panel closes. This can take up to 15 seconds. Do not close the window [AC-T4-08, AC-T7-14].
9. Find the tool card "Cogniate (<library name>)". It shows "Pending" [AC-T7-14].
10. Click "Activate". The card shows "Active" [AC-T7-14, AC-T7-02].
11. On the same card, click "Edit" [AC-T7-14].
12. Set "Tool configuration usage" to "Show in activity chooser and as a preconfigured tool" [AC-T7-14, AC-T7-02].
13. Set "Default launch container" to "New window" [AC-T7-14, AC-T7-02].
14. Click "Save changes" [AC-T7-14].

Result:

- Moodle shows the tool "Cogniate (<library name>)" as "Active", with "New window" [AC-T7-02].
- The portal shows "Registered — activate in Moodle" within 10 seconds, with no reload [AC-T6-04]. After the first launch from Moodle, it shows "Connected" [AC-T7-02].
- Learners are anonymous: Moodle does not send their names or emails to Cogniate [AC-T4-08, AC-T2-04] (decision Q3).

NOTE: While Moodle answers, the panel says "Connecting to Moodle. This can take up to 15 seconds. Do not close this window." The button is disabled [Not verified by QA].

NOTE: If Moodle is slow, the panel can say: "Moodle may have saved a Pending tool. In Manage tools, delete the Pending tool 'Cogniate (<library>)', then connect again." Do this. The same registration URL still works until it expires [Not verified by QA].

NOTE: Do steps 11 to 14. Moodle sets new tools to open inside the Moodle page. Then courses open inside Moodle with an "Open in a new window" button [AC-T4-31], and teachers do not see the tool in the activity chooser.

## Manual method (fallback)

Use it only if the automatic method fails. The full end-to-end QA run used this method for a second library [AC-T7-01].

### In the portal

1. Do Part 1, steps 1 to 5.
2. Under "Connection method", select "Manual".
3. Click "Continue".

The portal shows a table "Tool configuration" with 16 Moodle settings and their values. Each row has a copy button [AC-T6-05, AC-T4-10].

### In Moodle

1. Open "Manage tools" (Part 2, step 2).
2. Click "configure a tool manually" [AC-T7-01].
3. Copy each value from the portal table into the Moodle field with the same label [AC-T7-01].
4. Click "Save changes" [AC-T7-01].
5. On the new tool card, click "View configuration details" [AC-T7-01].
6. Keep this dialog open. It shows the six values for the portal [AC-T7-01].

NOTE: For "Accept grades from the tool", select "As specified in Deep Linking definition or Delegate to teacher". The portal shows this exact text [AC-T7-01, [T7 qa.md §6](../reviews/T7/qa.md#6-suite-changes-after-the-reviews-round-1-addendum)].

### Back in the portal

1. Paste each of the six values into the portal field with the same name [AC-T7-01].
2. Click "Connect Moodle" [AC-T7-01].

Result: the portal shows "Registered" [AC-T6-05, AC-T4-10]. The manual method has no "Activate" step.

## Connection status in the portal

| Status | Meaning | Tag |
| --- | --- | --- |
| "Waiting for Moodle" | The registration URL is ready. Moodle did not use it yet. | AC-T6-01, AC-T6-04 |
| "Link expired" | The registration URL expired. Make a new URL. | Not verified by QA |
| "Registered — activate in Moodle" | Moodle has the tool. Activate and edit it (Part 2, steps 10 to 14). | AC-T6-04, AC-T7-02 |
| "Connected" | A first launch from Moodle worked. | AC-T7-02 |
| "Disconnected" | Somebody disconnected the site. Launches stop. The tool stays in Moodle. | Not verified by QA |

## Connect again

Cogniate refuses every tool update from Moodle [AC-T3-25, AC-T4-30]. To connect a site again:

1. In Moodle, delete the old Cogniate tool in "Manage tools".
2. In the portal, click "Disconnect" for the old connection [Not verified by QA].
3. Do Part 1 and Part 2 again.

A connection can fail. Then Moodle can show a pending Cogniate tool that you did not activate. Delete it in "Manage tools" and connect again [Not verified by QA].

## Not verified by QA

- MoodleCloud. QA used a local Moodle 5.2.4 site (decision Q5).
- The badges "Link expired" and "Disconnected", and the "Disconnect" button.
