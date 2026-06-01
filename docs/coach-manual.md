# Coach User Manual

## What Is This App?

Sports Timing is a free app that turns regular smartphones into professional timing gates. Instead of buying expensive equipment, you connect 2–4 phones over your training facility's WiFi and get accurate, synchronized times for sprints, agility tests, and more.

No technical knowledge required after the first setup.

---

## What You Need

- A laptop or desktop computer connected to the same WiFi as the phones (this runs the server)
- 2–4 smartphones (any brand, iOS or Android)
- All devices on the same WiFi network
- Cones, tape, or markers to set up your test course

---

## First-Time Setup (Do Once)

Ask your IT person or a tech-savvy helper to:
1. Install Node.js on the coaching laptop
2. Run `npm install` then `npm start` in the app folder
3. Tell you the laptop's WiFi IP address (e.g. `192.168.1.42`)

After that, every session is: open the browser on each phone, type the IP address, and go.

---

## Running a Test — Step by Step

### 1. Start the Server
On the laptop, open Terminal and type:
```
npm start
```
Leave that window open during training.

### 2. Open the App on the Host Phone
On your phone, open Safari or Chrome and type: `http://192.168.1.42:3001`
(Use your actual IP address.)

Tap **"Host New Session"** → enter your name → pick a test → tap **"Create Session"**.

A **4-digit code** appears on screen. This is your session code.

### 3. Connect the Other Phones
On each athlete/assistant's phone:
- Open the same address in the browser
- Tap **"Join Session"**
- Enter the device name (e.g. "Finish Gate")
- Type the 4-digit code

### 4. Assign Roles
Each phone taps the button matching its position:
- **START** — the phone at the start line
- **FINISH** — the phone at the finish line
- **LEFT / RIGHT / FORWARD** — for the Y-agility test

### 5. Place the Phones on the Field
Put each phone exactly at its marked position. The **green line** on screen must line up with the tape or cone on the ground. Tap **"✓ Marker Aligned"** on each phone when done.

### 6. Sync the Clocks
The host phone taps **"Start Time Sync"**. All phones synchronise automatically in about 5 seconds. A green **SYNC GOOD** badge confirms success.

### 7. Run the Test
The host taps **"▶ Start Trial"**. A countdown (3–2–1–GO!) appears on all screens simultaneously.

**For the 30m Sprint:**
- Athlete presses the **▶ START** button on the Start phone as they leave the line
- Finish phone assistant presses **🏁 FINISH** when the athlete crosses

**For the Illinois Test:** Same as above — just START and FINISH.

**For the Y-Shape Test:**
- The CENTER phone randomly shows an arrow (← → ↑)
- The athlete runs in that direction
- The assistant at that arm presses the button when the athlete arrives

### 8. Read the Results
After both gates trigger, results appear on all screens:
- **Total time** in seconds
- **Speed** in m/s and km/h (sprint tests)
- **Rating** vs. age/gender norms (Excellent / Good / Average / Below Average / Poor)

Enter the athlete's age and gender on the result screen to get the norm rating.

### 9. Next Trial
Tap **"Next Trial →"** to run again with the same setup. Tap **"End Session"** when you are done.

---

## Exporting Data

On the Result screen:
- **Export CSV** — opens a spreadsheet file in Excel/Numbers
- **Export JSON** — raw data file for analysis

On the History screen (Home → History):
- See all past results
- Export all sessions at once

---

## Tips for Best Accuracy

**WiFi quality matters.** Keep all phones close to the WiFi router during testing. A weak signal causes clock drift and less accurate times.

**Button press timing.** Like manual stopwatches, button press results include ~100–200 ms of human reaction time. Be consistent: always press at the exact moment the athlete's foot crosses the line.

**Audio trigger.** Enable in Settings for hands-free triggering (clap or beep detection). Works best in quiet environments. Raise the sensitivity threshold if it fires accidentally.

**The green line.** Before every session, check that the green line on each phone's screen lines up with your physical marker. This ensures everyone is measuring from exactly the same spot.

**Sync quality.** Always aim for the green SYNC GOOD badge. If you see orange (FAIR) or red (POOR), tap Re-sync before starting trials.

**Void bad trials.** If the athlete false-started or stumbled, tap "Void this result" — it stays in the log but is excluded from bests and averages.

---

## Common Questions

**Q: Do I need internet?**
A: No. Everything works over your local WiFi. No data leaves your network.

**Q: Can I use only 2 phones?**
A: Yes. The 30m Sprint and Illinois test work with just 2 phones.

**Q: What if a phone disconnects mid-session?**
A: The app auto-reconnects. If a trial was running, abort it and re-run after reconnecting.

**Q: Can I save athlete profiles?**
A: Results are saved automatically with timestamp and test type. Athlete names can be added in the result details. Full athlete profile management is planned for a future update.

**Q: The time seems faster/slower than my stopwatch.**
A: That's normal — hand-timing with a stopwatch typically adds 100–200 ms of reaction time. Electronic timing (this app) is more accurate. Compare athletes' results within the app rather than against stopwatch numbers.
