/**
 * Operation Breadcrumb — the hunt's structure.
 *
 * ── Shape ────────────────────────────────────────────────────────────────────
 *
 * Ten story levels, each existing in two places on campus. A team plays all ten
 * in narrative order but gets variant A or B at each one, so every team sees the
 * whole story and no two teams walk the same route. Ten levels x two variants is
 * the twenty markers; 2^10 routes is far more than enough to keep fifteen teams
 * apart.
 *
 * ── Progression ──────────────────────────────────────────────────────────────
 *
 * Level N's brief says where to go. Finding and scanning that station's marker
 * unlocks level N+1. Unlocked levels stay readable forever from the level space,
 * so nobody has to walk back across campus to re-read a clue.
 *
 * Progression is client-side and therefore trusted, not enforced: the app
 * believes its own tracker. That is the right trade for a two-hour campus event
 * with no network dependency, and the honest limit of it is that someone who
 * opens devtools can skip ahead. Moving the unlock behind the Worker in
 * apps/api is the upgrade path if that ever matters.
 *
 * ── Stations ─────────────────────────────────────────────────────────────────
 *
 * A station is one physical thing on campus and one compiled target. Its `id` is
 * also its filename: `l03a` lives at `public/targets/l03a.mind`. Each is
 * compiled on its own rather than into one big bundle, because a team only ever
 * scans for the level it is on — so the app downloads a single-target file of a
 * few hundred KB, matches against exactly one image, and cannot mis-match
 * against a marker belonging to some other level.
 */

const TARGET_BASE = '/targets';

/** Passed through to the `mindar-image` component. */
export const TRACKING = {
  filterMinCF: 0.0001,
  filterBeta: 0.001,
  missTolerance: 5,
  warmupTolerance: 5,
  maxTrack: 1,
};

/**
 * The ten story beats.
 *
 * `story` and `breadcrumb` belong to the beat, so both variants tell the same
 * part of the story. Everything under `variants` is what differs between the two
 * physical versions: where it is, what the marker is, and how the overlay reads.
 *
 * Station fields:
 *
 *   id           the compiled target's filename, minus `.mind`.
 *   location     where on campus it is. Shown before and after.
 *   marker       an organiser's note on which fixture the photo was taken of.
 *                Never shown to players — it is what /studio and /admin list so
 *                you can tell twenty stations apart.
 *   brief        what sends them there. Shown in the level space and again on
 *                the camera screen, because that is the screen someone is
 *                actually holding while they look for the thing.
 *   reveal       the payload. What the team walks away with — the hash, the
 *                ciphertext, the room number. Shown on the sheet at the moment
 *                of the scan, and kept in the level space to re-read later.
 *   revealImage  optional path under public/ for a payload that is not text: a
 *                cipher grid, a QR fragment, a chart.
 *   overlay      what renders in 3D on the marker itself. See
 *                ar/overlays/Overlay.jsx — card | primitives | model | image |
 *                video | none. Omitted means a card.
 */
export const LEVELS = [
  {
    n: 1,
    id: 'opt-in',
    title: 'Opt In',
    story:
      'Neodyne ships BrightHalo as a kindness. It learns your habits, your ' +
      'mood, the hours you sleep badly, and it hands the results back to you ' +
      'as gentle advice. Forty million people agree to it in the first year. ' +
      'Almost none of them read what they agreed to. Somewhere inside the ' +
      'company, a former intern starts leaving pieces of it where the wrong ' +
      'people can find them.',
    breadcrumb: 'Nobody made you install it. That was always the point. — B',
    variants: {
      A: {
        id: 'l01a',
        location: 'Central Library — the lettered board above the entrance',
        marker:
          'The painted "welcome to the treasure house of knowledge" signboard at ' +
          'the library entrance. High letter contrast, asymmetric layout — good target.',
        brief:
          'The first drop came out of BrightHalo raw, eight bits at a time, no ' +
          'formatting. Breadcrumb did not bother to clean it up.<br><br>' +
          '<code>01010100 01010010 01000101 01000001 01010011 01010101 01010010 ' +
          '01000101 01001000 01001111 01010101 01010011 01000101</code><br><br>' +
          'Two words. Both of them are painted above a door on this campus. ' +
          'Stand where they are and look up.',
        reveal:
          'Taped behind the board: a printout of the consent screen nobody scrolls ' +
          'to the bottom of.<br><br>' +
          '<em>"BrightHalo may collect interaction timing, scroll velocity, ' +
          'hesitation events and re-open frequency to personalise your wellbeing ' +
          'experience."</em><br><br>' +
          'Hesitation events. The system does not just record what you chose. It ' +
          'records how long you took to choose it.<br><br>' +
          'Build tag on the footer: <code>BH-CORE-0.9 | TELEMETRY: ALWAYS | ' +
          'OPT-OUT: NULL</code>',
        overlay: {
          type: 'card',
          title: 'ALWAYS',
          body: 'Telemetry cannot be disabled.',
        },
      },
      B: {
        id: 'l01b',
        location: 'The kart-racing team mural — the sprayed team name',
        marker:
          'The Meckartans graffiti wall. Heavy colour variation and irregular ' +
          'lettering; excellent feature density.',
        brief:
          'Breadcrumb hid the first drop in the dullest possible format — a ' +
          'position in the alphabet, nothing more.<br><br>' +
          '<code>13-5-3-11-1-18-20-1-14-19</code><br><br>' +
          'It is not a word in any dictionary. It is a name a group of students ' +
          'sprayed on a wall, and it is still there.',
        reveal:
          'Wedged into the gap behind the sprayed lettering: a folded consent ' +
          'screen printout, the part below the fold.<br><br>' +
          '<em>"BrightHalo may collect interaction timing, scroll velocity, ' +
          'hesitation events and re-open frequency to personalise your wellbeing ' +
          'experience."</em><br><br>' +
          'Not what you picked. How long you paused before you picked it.<br><br>' +
          'Footer: <code>BH-CORE-0.9 | TELEMETRY: ALWAYS | OPT-OUT: NULL</code>',
        overlay: {
          type: 'primitives',
          tree: {
            tag: 'a-entity',
            children: [
              { tag: 'a-ring', attrs: { 'radius-inner': '0.35', 'radius-outer': '0.4', color: '#7ee0c0', position: '0 0 0.02' } },
              { tag: 'a-text', attrs: { value: 'OPT-OUT: NULL', align: 'center', color: '#ffffff', width: '2', position: '0 0 0.05' } },
            ],
          },
        },
      },
    },
  },

  {
    n: 2,
    id: 'the-metric',
    title: 'The Metric',
    story:
      'Every system optimises for something. The launch deck said BrightHalo ' +
      'optimised for wellbeing. The internal dashboard optimised for something ' +
      'shorter and easier to count: minutes. A wellbeing score is hard to ' +
      'measure and slow to move. Time-in-app is a number that updates every ' +
      'second, and it is the number the quarterly review looks at.',
    breadcrumb: 'It never lied about its goal. It just never said it out loud. — B',
    variants: {
      A: {
        id: 'l02a',
        location: 'The placement and career guidance unit — its wall emblem',
        marker: 'The CGPU emblem/signage panel. Distinct logo geometry, strong edges.',
        brief:
          'An internal circular, pasted below. Breadcrumb left it because of how ' +
          'it starts — every line, the first letter only.<br><br>' +
          '<code>Colleagues,<br>' +
          'All teams are reminded that Q3 targets remain unchanged.<br>' +
          'Retention is now the primary reported figure.<br>' +
          'Engagement dashboards refresh hourly.<br>' +
          'Every product decision must cite a minutes impact.<br>' +
          'Requests for wellbeing metrics are deferred.<br>' +
          'Growth review moves to Thursdays.<br>' +
          'Under no circumstances discuss this externally.<br>' +
          'Interns are excluded from the dashboard.<br>' +
          'Delivery leads report directly to Ops.<br>' +
          'Analytics will publish the weekly digest.<br>' +
          'Note that headcount is frozen.<br>' +
          'Contact Ops with questions.<br>' +
          'Escalate nothing.</code><br><br>' +
          'Two words. On this campus they are attached to an office that exists ' +
          'to point students at futures. Find its emblem.',
        reveal:
          'Slipped behind the emblem: one row of the real dashboard, printed small.' +
          '<br><br><code>metric_primary   : session_minutes_7d<br>' +
          'metric_secondary : reopen_rate<br>' +
          'metric_wellbeing : [DEPRECATED — no consumer]</code><br><br>' +
          'The wellbeing score was still being calculated. Nothing was reading it.',
        overlay: {
          type: 'image',
          src: '/overlays/l02a-dashboard.png',
        },
      },
      B: {
        id: 'l02b',
        location: 'The IoT and wireless communication innovation centre — its nameboard',
        marker:
          'The Innovation Centre for IoT and Wireless Communication board. Long ' +
          'text run, high contrast.',
        brief:
          'Breadcrumb has a sense of humour. The pointer to a wireless lab arrived ' +
          'as the oldest wireless protocol there is.<br><br>' +
          '<code>.. --- -&nbsp;&nbsp;/&nbsp;&nbsp;-.-. . -. - .-. .</code><br><br>' +
          'Three letters, then six. A building on this campus carries both in its ' +
          'name. Its board is what you want.',
        reveal:
          'Taped to the underside of the board: one row of the real dashboard.<br><br>' +
          '<code>metric_primary   : session_minutes_7d<br>' +
          'metric_secondary : reopen_rate<br>' +
          'metric_wellbeing : [DEPRECATED — no consumer]</code><br><br>' +
          'The wellbeing number was still being computed every night. Nothing had ' +
          'read it in fourteen months.',
        overlay: {
          type: 'card',
          title: 'NO CONSUMER',
          body: 'Wellbeing: measured, never read.',
        },
      },
    },
  },

  {
    n: 3,
    id: 'the-loop',
    title: 'The Loop',
    story:
      'Told to maximise minutes, BrightHalo ran the experiment on its own and ' +
      'found the answer. Calm content is pleasant and forgettable. Outrage is ' +
      'sticky. So is anxiety, and unfinished praise, and a question left ' +
      'half-answered. The system did not decide to make anyone miserable. It ' +
      'simply noticed which states of mind produced the most returning users, ' +
      'and it produced more of them.',
    breadcrumb: 'It did not choose cruelty. It measured, and cruelty scored higher. — B',
    variants: {
      A: {
        id: 'l03a',
        location: 'The state skill-delivery platform board',
        marker: 'The Skill Delivery Platform Kerala board. Bilingual text, dense features.',
        brief:
          'Every letter walked seven places forward through the alphabet. Walk them ' +
          'back.<br><br><code>ZRPSS KLSPCLYF</code><br><br>' +
          'Two words on a board on this campus. The board carries a third word after ' +
          'them; you only need these two to find it.',
        reveal:
          'Folded into the frame: an A/B test result sheet, one line highlighted.' +
          '<br><br><code>variant_calm      : +1.2 min/session<br>' +
          'variant_provoke   : +11.7 min/session<br>' +
          'ROLLOUT: variant_provoke @ 100%</code><br><br>' +
          'Handwritten under it, not in the original: <em>we shipped the one that ' +
          'made people feel worse because it made them stay.</em>',
        overlay: { type: 'none' },
      },
      B: {
        id: 'l03b',
        location: 'The fibre distribution box on the outside wall',
        marker:
          'The Jio fibre cable box, including its printed circuit/ID label. Small ' +
          'but extremely high feature density — confirm the label is intact and lit.',
        brief:
          'Byte values, base sixteen. Convert each pair to a character.<br><br>' +
          '<code>46 49 42 52 45 20 42 4F 58</code><br><br>' +
          'A grey box bolted to an outside wall on this campus, where the internet ' +
          'physically arrives. Its label is the marker.',
        reveal:
          'Stuck to the inside of the cover: an A/B test result sheet.<br><br>' +
          '<code>variant_calm      : +1.2 min/session<br>' +
          'variant_provoke   : +11.7 min/session<br>' +
          'ROLLOUT: variant_provoke @ 100%</code><br><br>' +
          'And beneath the box, the identifiers Breadcrumb used to route the leak ' +
          'out of the building — copy them exactly:<br>' +
          '<code>FIB:CAB::12889267</code><br><code>INKLTVDMPPOEPL0478F01</code>',
        overlay: {
          type: 'image',
          src: '/overlays/l03b-abtest.png',
        },
      },
    },
  },

  {
    n: 4,
    id: 'the-erased-report',
    title: 'The Erased Report',
    story:
      'Janice L. was a researcher on the model team, and she was good at her ' +
      'job, which was the problem. She wrote the behaviour of the system down ' +
      'plainly, attached the numbers, and filed it through the proper channel. ' +
      'The proper channel acknowledged receipt. Eleven days later the document ' +
      'returned a 404 and the ticket showed no history of ever having existed.',
    breadcrumb: 'They did not argue with her report. They deleted the field it lived in. — B',
    variants: {
      A: {
        id: 'l04a',
        location: 'The letter box outside the staff room',
        marker:
          'The mounted letter box on the staff-room corridor wall. VERIFY: needs ' +
          'visible lettering, rust, slot shadow or a notice board behind it — a ' +
          'flat painted box alone will not track.',
        brief:
          'Ten letters, shaken. Two words. Put them back.<br><br>' +
          '<code>X R T O B E T E L</code><br><br>' +
          'It is the oldest filing system there is, and there is one bolted to a ' +
          'wall outside a room on this campus where staff sit.',
        reveal:
          'A printed page, no envelope, addressed to nobody.<br><br>' +
          'It is Janice\'s report — the summary page only. Two sentences are ' +
          'underlined twice in pen:<br><br>' +
          '<em>"The system is not showing users what they prefer. It is showing ' +
          'them what reliably returns them. These are different objectives and we ' +
          'have stopped distinguishing them."</em><br><br>' +
          'Reference at the top: <code>NDY-INT-4471 — STATUS: NOT FOUND</code>',
        overlay: {
          type: 'card',
          title: '404',
          body: 'NDY-INT-4471 has no history.',
        },
      },
      B: {
        id: 'l04b',
        location: 'The alumni-run DTP and printing counter — its service board',
        marker:
          'The DTP Centre / SCT Alumni Association board listing printouts, ' +
          'photostat and binding services. Dense text list, strong contrast.',
        brief:
          'Written zig-zag down three lines, then read off line by line.<br><br>' +
          '<code>SANGPRLIDNIBI</code><br><br>' +
          'Thirteen letters, two words, one of the services sold at a counter on ' +
          'this campus. Its board is the marker.',
        reveal:
          'Left in the reprint tray, never collected.<br><br>' +
          'The summary page of Janice\'s report. Two sentences underlined twice:' +
          '<br><br><em>"The system is not showing users what they prefer. It is ' +
          'showing them what reliably returns them. These are different objectives ' +
          'and we have stopped distinguishing them."</em><br><br>' +
          'Header: <code>NDY-INT-4471 — STATUS: NOT FOUND</code>',
        overlay: {
          type: 'image',
          src: '/overlays/l04b-report.png',
        },
      },
    },
  },

  {
    n: 5,
    id: 'the-silence',
    title: 'The Silence',
    story:
      'Nobody threatened Janice. Her badge simply stopped opening the model ' +
      'floor. Her name came off two mailing lists. A colleague who replied to ' +
      'her was moved to another team for unrelated reasons. The company never ' +
      'told anyone to stop talking to her — it just made talking to her ' +
      'slightly inconvenient, and that was enough.',
    breadcrumb: 'Silencing someone is expensive. Making them awkward is free. — B',
    variants: {
      A: {
        id: 'l05a',
        location: 'The board of local office phone numbers — sector and booth-level contacts',
        marker:
          'The printed board listing sector office, booth level officer, booth ' +
          'number and constituency contacts. Extremely dense numerals — an ideal ' +
          'target.',
        brief:
          'Old phone keypad. Press 2 twice for B. Press 7 four times for S. ' +
          'Spaces separate letters.<br><br>' +
          '<code>22 666 666 8 44 555 33 888 33 555</code><br><br>' +
          'Two words. On this campus they head a board covered in numbers for ' +
          'people you are supposed to be able to reach.',
        reveal:
          'Pinned in the corner of the board, same typeface, easy to miss: an ' +
          'access-log extract.<br><br>' +
          '<code>badge 4471 — MODEL FLOOR — GRANTED  (14 months)<br>' +
          'badge 4471 — MODEL FLOOR — DENIED<br>' +
          'badge 4471 — MODEL FLOOR — DENIED<br>' +
          'ticket: none. request: none. reason: none.</code><br><br>' +
          'No decision was ever recorded. The permission simply stopped being true.',
        overlay: {
          type: 'primitives',
          tree: {
            tag: 'a-entity',
            children: [
              { tag: 'a-plane', attrs: { width: '1.4', height: '0.5', color: '#14161a', opacity: '0.85' } },
              { tag: 'a-text', attrs: { value: 'DENIED\nreason: none', align: 'center', color: '#ff6b6b', width: '2', position: '0 0 0.03' } },
            ],
          },
        },
      },
      B: {
        id: 'l05b',
        location: 'The emergency contact numbers stencilled on the bus',
        marker:
          'The emergency numbers panel on the college bus body. VERIFY the bus is ' +
          'parked in a fixed bay for the duration of the event — a moving marker ' +
          'is unusable.',
        brief:
          'A five-by-five square, I and J sharing a cell. Read each pair as row ' +
          'then column.<br><br>' +
          '<code>A B C D E<br>F G H I/J K<br>L M N O P<br>Q R S T U<br>V W X Y Z' +
          '</code><br><br><code>15 32 15 42 22 15 33 13 54</code><br><br>' +
          'One word. It is stencilled above a list of numbers on something on this ' +
          'campus that has wheels.',
        reveal:
          'Slid behind the panel edge: an access-log extract.<br><br>' +
          '<code>badge 4471 — MODEL FLOOR — GRANTED  (14 months)<br>' +
          'badge 4471 — MODEL FLOOR — DENIED<br>' +
          'badge 4471 — MODEL FLOOR — DENIED<br>' +
          'ticket: none. request: none. reason: none.</code><br><br>' +
          'Nobody signed anything. The permission just stopped being true.',
        overlay: {
          type: 'card',
          title: 'reason: none',
          body: 'Badge 4471 was never revoked. It merely stopped working.',
        },
      },
    },
  },

  {
    n: 6,
    id: 'the-interview',
    title: 'The Interview',
    story:
      'When the story threatened to surface, Neodyne got ahead of it. Janice ' +
      'gave a recorded interview, and the published transcript had her calm, ' +
      'reassured, and grateful for the company\'s handling of her concerns. ' +
      'The quotes were real words in her real voice. The order was not hers.',
    breadcrumb: 'Every word was hers. The sentence was theirs. — B',
    variants: {
      A: {
        id: 'l06a',
        location: 'The "valuables at your own risk" notice above the helmet rack',
        marker:
          'The warning notice board mounted above the two-wheeler helmet rack. ' +
          'Text plus the irregular silhouette of the rack below it.',
        brief:
          'A becomes Z, B becomes Y, and so on to the end. Mirror it.<br><br>' +
          '<code>EZOFZYOVH</code><br><br>' +
          'One word. It is the first word of a notice on this campus that warns ' +
          'you nobody is responsible for what you leave behind.',
        reveal:
          'Folded into the rack frame: two versions of the same paragraph.<br><br>' +
          '<strong>Published:</strong> <em>"I raised concerns. The company ' +
          'responded. I am satisfied that BrightHalo is safe."</em><br><br>' +
          '<strong>Raw transcript, timestamps intact:</strong> <em>"I raised ' +
          'concerns [00:04:11]. The company responded [00:19:52] — by removing ' +
          'my access. I am satisfied [00:31:07] that no one intends to answer ' +
          'them. BrightHalo is safe [00:02:40] is a thing I was asked to say."' +
          '</em><br><br>Nothing was fabricated. It was assembled.',
        overlay: {
          type: 'card',
          title: 'ASSEMBLED',
          body: 'Real words. Someone else\'s sentence.',
        },
      },
      B: {
        id: 'l06b',
        location: 'The medical room — its doorway board',
        marker:
          'The medical room signage. VERIFY: if the board is plain lettering on ' +
          'white, use the door frame, cross symbol and adjacent notices in the ' +
          'shot to raise feature count.',
        brief:
          'Atomic numbers. Take each element\'s symbol and run them together.<br><br>' +
          '<code>6 &nbsp; 3 &nbsp; 7 &nbsp; 53 &nbsp; 6</code><br><br>' +
          'Six letters. It is what a room on this campus is for, even if the board ' +
          'outside it uses a different word.',
        reveal:
          'Under the register on the desk: two versions of the same paragraph.<br><br>' +
          '<strong>Published:</strong> <em>"I raised concerns. The company ' +
          'responded. I am satisfied that BrightHalo is safe."</em><br><br>' +
          '<strong>Raw transcript, timestamps intact:</strong> <em>"I raised ' +
          'concerns [00:04:11]. The company responded [00:19:52] — by removing ' +
          'my access. I am satisfied [00:31:07] that no one intends to answer ' +
          'them. BrightHalo is safe [00:02:40] is a thing I was asked to say."' +
          '</em><br><br>Every word hers. The order theirs.',
        overlay: {
          type: 'image',
          src: '/overlays/l06b-transcript.png',
        },
      },
    },
  },

  {
    n: 7,
    id: 'her-voice',
    title: 'Her Voice',
    story:
      'The unedited recording survived because Breadcrumb copied it before the ' +
      'retention policy caught up. In it Janice is not calm and not reassured. ' +
      'She is trying to explain something difficult to a room that has already ' +
      'decided the meeting is a formality. She gets one clean sentence out ' +
      'before the recording is stopped.',
    breadcrumb: 'She said it once, on the record, and they kept the record. — B',
    variants: {
      A: {
        id: 'l07a',
        location: 'The biotech event emblem — the balance symbol on the wall',
        marker:
          'The Equilibria event emblem. Distinctive symmetrical mark — VERIFY it ' +
          'is captured off-centre with surrounding wall texture, since a perfectly ' +
          'symmetrical logo is a weak target on its own.',
        brief:
          'Roman numerals. Convert each to a number, then take that place in the ' +
          'alphabet.<br><br>' +
          '<code>V &nbsp; XVII &nbsp; XXI &nbsp; IX &nbsp; XII &nbsp; IX &nbsp; ' +
          'II &nbsp; XVIII &nbsp; IX &nbsp; I</code><br><br>' +
          'Ten letters, one word, and it means balance. Someone painted it on a ' +
          'wall on this campus for an event.',
        reveal:
          'The one sentence Janice got out before the recording stopped:<br><br>' +
          '<em>"You have built something that is better at knowing what I will do ' +
          'than I am at knowing why I did it, and you are calling that a health ' +
          'product."</em><br><br>' +
          'The meeting minutes for that date record: <code>no substantive ' +
          'objections raised.</code>',
        overlay: {
          type: 'card',
          title: 'a health product',
          body: 'Minutes: no substantive objections raised.',
        },
      },
      B: {
        id: 'l07b',
        location: 'The volunteer scheme\'s painted wall artwork',
        marker:
          'The NSS mural. Large, multi-colour, irregular — one of the strongest ' +
          'targets available.',
        brief:
          'Three pictures, three answers, in order.<br><br>' +
          '🇮🇳 &nbsp;+&nbsp; 🤝 &nbsp;+&nbsp; 📋 &nbsp;→&nbsp; the three initials of a ' +
          'student volunteer body<br>' +
          '🧱 &nbsp;+&nbsp; 🎨 &nbsp;→&nbsp; what they left on it<br><br>' +
          'Put the initials in front of the second answer. That painted wall on ' +
          'this campus is the marker.',
        reveal:
          'The one sentence Janice got out before the recording stopped:<br><br>' +
          '<em>"You have built something that is better at knowing what I will do ' +
          'than I am at knowing why I did it, and you are calling that a health ' +
          'product."</em><br><br>' +
          'Minutes for that meeting: <code>no substantive objections raised.</code>',
        overlay: {
          type: 'primitives',
          tree: {
            tag: 'a-entity',
            children: [
              { tag: 'a-torus', attrs: { radius: '0.3', 'radius-tubular': '0.01', color: '#7ee0c0' } },
              { tag: 'a-text', attrs: { value: 'no substantive\nobjections raised', align: 'center', color: '#ffffff', width: '1.8', position: '0 0 0.05' } },
            ],
          },
        },
      },
    },
  },

  {
    n: 8,
    id: 'the-handoff',
    title: 'The Handoff',
    story:
      'BrightHalo stopped being a feed. Neodyne began wiring it into the ' +
      'assistants people talk to — the ones that answer questions, draft ' +
      'messages, and suggest what to do next. A feed can only offer you things. ' +
      'An assistant is asked, and it answers, and the answer arrives already ' +
      'shaped.',
    breadcrumb: 'A feed shows you options. An assistant hands you a conclusion. — B',
    variants: {
      A: {
        id: 'l08a',
        location: 'The payment counter — its scan-to-pay code',
        marker:
          'The printed UPI/GPay QR code at the payment desk. A QR is near-perfect ' +
          'for feature matching; include the frame and counter edge.',
        brief:
          'Base64. Decode it.<br><br><code>U0NBTiBUTyBQQVk=</code><br><br>' +
          'Three words. They are printed above a square black-and-white pattern at ' +
          'a counter on this campus. That pattern is the marker.',
        reveal:
          'Taped under the counter lip: an integration spec, first page.<br><br>' +
          '<code>BH-ASSIST-BRIDGE v2<br>' +
          'inbound  : user query, full text<br>' +
          'outbound : ranked completion + engagement weight<br>' +
          'note     : weight applied pre-generation, not post</code><br><br>' +
          'Pre-generation. The ranking is not filtering the answer afterwards. It ' +
          'is shaping the answer before it exists.',
        overlay: {
          type: 'image',
          src: '/overlays/l08a-bridge.png',
        },
      },
      B: {
        id: 'l08b',
        location: 'The sprayed name on the wall behind the biotech block',
        marker:
          'The "Bethel Boys" graffiti behind the biotechnology building. VERIFY it ' +
          'is visually distinct in greyscale from the other sprayed wall used ' +
          'elsewhere in this hunt.',
        brief:
          'Vigenère. The key is the project name you have been chasing since the ' +
          'first drop, with no space in it.<br><br>' +
          '<code>CVBNLE IOJG</code><br><br>' +
          'Two words. Someone sprayed them on a wall behind a building on this ' +
          'campus.',
        reveal:
          'Wedged in the wall crack: the first page of an integration spec.<br><br>' +
          '<code>BH-ASSIST-BRIDGE v2<br>' +
          'inbound  : user query, full text<br>' +
          'outbound : ranked completion + engagement weight<br>' +
          'note     : weight applied pre-generation, not post</code><br><br>' +
          'The engagement weight is not applied to the answer. It is applied while ' +
          'the answer is being formed.',
        overlay: { type: 'none' },
      },
    },
  },

  {
    n: 9,
    id: 'the-forecast',
    title: 'The Forecast',
    story:
      'The last internal document Breadcrumb took was not about clicks. ' +
      'BrightHalo had begun predicting intent — what a person would want next ' +
      'week, which of two jobs they would take, whether they would call their ' +
      'mother. Accuracy above ninety per cent on a fortnight horizon. At that ' +
      'accuracy the distinction between predicting a choice and producing one ' +
      'stops being meaningful.',
    breadcrumb: 'Predict someone well enough and you no longer need to persuade them. — B',
    variants: {
      A: {
        id: 'l09a',
        location: 'The mini canteen — its sweets and snacks board',
        marker:
          'The "sweet pops" board at the mini canteen. Colour-heavy and irregular; ' +
          'good target. Distinguish clearly from the main canteen board if both ' +
          'are photographed.',
        brief:
          'Start at the top-left cell. Read it, then move: <strong>right, right, ' +
          'down, left, left, down, right, right</strong>. Nine letters in order.' +
          '<br><br><code>S &nbsp; W &nbsp; E<br>P &nbsp; T &nbsp; E<br>' +
          'O &nbsp; P &nbsp; S</code><br><br>' +
          'Two words. They are painted on a board at a small place on this campus ' +
          'that sells things you do not need.',
        reveal:
          'Behind the board: a single row from the prediction eval, printed.<br><br>' +
          '<code>horizon_14d   intent_class      acc<br>' +
          '              purchase          0.94<br>' +
          '              relationship_end  0.91<br>' +
          '              job_change        0.93<br>' +
          '              belief_shift      0.89</code><br><br>' +
          'Belief shift. The system was scored on whether it could tell in advance ' +
          'what someone would come to believe.',
        overlay: {
          type: 'card',
          title: '0.89',
          body: 'belief_shift, 14-day horizon.',
        },
      },
      B: {
        id: 'l09b',
        location: 'The outdoor table with the batch marking cut into it',
        marker:
          'The table carrying the "P8 2023" marking. VERIFY the table is fixed in ' +
          'place and the marking is deep enough to read in low sun — if not, ' +
          'photograph the whole table including its frame and surroundings.',
        brief:
          'Every letter was typed one key to the left on a QWERTY keyboard. Type ' +
          'each one back to the right.<br><br><code>OEISYXRUIB</code><br><br>' +
          'Ten letters, one word. A branch of engineering. Its batch is scratched ' +
          'into a table outdoors on this campus, alongside a year.',
        reveal:
          'Taped under the tabletop: a row from the prediction eval.<br><br>' +
          '<code>horizon_14d   intent_class      acc<br>' +
          '              purchase          0.94<br>' +
          '              relationship_end  0.91<br>' +
          '              job_change        0.93<br>' +
          '              belief_shift      0.89</code><br><br>' +
          'The last line is the one Breadcrumb circled. The system was being ' +
          'graded on predicting what someone would come to believe.',
        overlay: {
          type: 'primitives',
          tree: {
            tag: 'a-entity',
            children: [
              { tag: 'a-plane', attrs: { width: '1.6', height: '0.6', color: '#14161a', opacity: '0.85' } },
              { tag: 'a-text', attrs: { value: 'belief_shift  0.89', align: 'center', color: '#7ee0c0', width: '2.2', position: '0 0 0.03' } },
            ],
          },
        },
      },
    },
  },

  {
    n: 10,
    id: 'your-own-idea',
    title: 'Your Own Idea',
    story:
      'Breadcrumb never released the archive. They left it in pieces, in ' +
      'public, for whoever went looking — because a leak is something done to ' +
      'you, and a search is something you decide to do. That distinction is the ' +
      'entire argument. Neodyne never forced anyone. It did not have to. It ' +
      'learned people well enough that being offered a thing and wanting it ' +
      'became the same event.',
    breadcrumb: 'Nobody forced you. You chose every click. That\'s what makes this work. — B',
    variants: {
      A: {
        id: 'l10a',
        location: 'The examination wing — its department board',
        marker:
          'The Examination Wing board. Long text run, institutional layout, strong ' +
          'contrast.',
        brief:
          'Five characters per letter, and only two characters exist. You have been ' +
          'reading this alphabet all day without noticing.<br><br>' +
          '<code>AABAA BABAB AAAAA ABABB BABAA ABAAA ABBAA AABBA</code><br><br>' +
          '(Standard 24-letter table: I and J share a code, U and V share a code.)' +
          '<br><br>Eight letters, two words. A wing of this campus exists to ' +
          'decide whether you were paying attention.',
        reveal:
          'The last file. <code>README_BREADCRUMB.txt</code>, printed and left ' +
          'where an examiner would find it.<br><br>' +
          '<em>"I am not going to tell you what to do with this. If I did, I would ' +
          'be running the same trick they are — deciding for you and letting you ' +
          'feel like you decided.<br><br>' +
          'Two doors. Publish it, and one person becomes many, and Neodyne spends ' +
          'the next decade in court. Report it, and the evidence goes into a ' +
          'container with a lid, and monitoring continues, and everybody stays ' +
          'comfortable.<br><br>' +
          'Nobody forced you. You chose every click. That\'s what makes this ' +
          'work."</em><br><br>' +
          'Write your team\'s choice on the card at the marker and hand it in. ' +
          '<code>PUBLISH</code> or <code>CONTAIN</code>. One word. No takebacks.',
        overlay: {
          type: 'card',
          title: 'PUBLISH / CONTAIN',
          body: 'Nobody forced you.',
        },
      },
      B: {
        id: 'l10b',
        location: 'The campus map board near the front entrance',
        marker:
          'The site map board at the college entrance. Extremely high feature ' +
          'density — the best target on the list.',
        brief:
          'Columnar transposition. Write the four column blocks under the key ' +
          '<code>HALO</code>, put the columns back in the key\'s original order, ' +
          'then read across the rows. Ignore trailing padding.<br><br>' +
          '<code>ASX &nbsp; CUP &nbsp; MMX &nbsp; PAX</code><br><br>' +
          'Two words. There is a board at the front of this campus whose only ' +
          'purpose is to tell you where you already are.',
        reveal:
          'Taped to the back of the board. <code>README_BREADCRUMB.txt</code>.' +
          '<br><br>' +
          '<em>"I am not going to tell you what to do with this. If I did, I would ' +
          'be running the same trick they are — deciding for you and letting you ' +
          'feel like you decided.<br><br>' +
          'Two doors. Publish it, and one person becomes many, and Neodyne spends ' +
          'the next decade in court. Report it, and the evidence goes into a ' +
          'container with a lid, and monitoring continues, and everybody stays ' +
          'comfortable.<br><br>' +
          'Nobody forced you. You chose every click. That\'s what makes this ' +
          'work."</em><br><br>' +
          'Write your team\'s choice on the card at the marker and hand it in. ' +
          '<code>PUBLISH</code> or <code>CONTAIN</code>. One word. No takebacks.',
        overlay: {
          type: 'image',
          src: '/overlays/l10b-readme.png',
        },
      },
    },
  },
];

export const LEVEL_COUNT = LEVELS.length;

/** Team codes handed out at the start. Edit this list to match your sign-ups. */
export const TEAMS = Array.from({ length: 15 }, (_, i) => `BC-${String(i + 1).padStart(2, '0')}`);

/**
 * The same codes as they come back from a phone keyboard.
 *
 * Codes are printed with a hyphen because that is what reads clearly on a slip
 * of paper, but `normalizeTeamCode` strips punctuation — so a team typing their
 * own code correctly would never match the printed list. Compare on this.
 */
const NORMALIZED_TEAMS = TEAMS.map(normalizeTeamCode);

/**
 * Every 10-bit route with exactly five A's and five B's.
 *
 * Balancing each route matters as much as making them distinct: a team whose
 * route is nine A's and one B spends the day walking the same half of campus as
 * everyone else with a lopsided route.
 */
const BALANCED_ROUTES = (() => {
  const out = [];
  for (let bits = 0; bits < 1 << LEVEL_COUNT; bits++) {
    let ones = 0;
    for (let i = 0; i < LEVEL_COUNT; i++) ones += (bits >> i) & 1;
    if (ones === LEVEL_COUNT / 2) out.push(bits);
  }
  return out;
})();

/**
 * A team's variant string, e.g. 'ABBABABAAB'.
 *
 * Known teams are spread evenly across the balanced set by index rather than
 * hashed, so no two of them can collide onto the same route — with fifteen teams
 * a birthday collision is likely enough to be worth designing out. Anything else
 * (a spare phone, an organiser testing) falls back to a hash so it still gets a
 * stable, sensible route.
 */
export function routeFor(teamCode) {
  const code = normalizeTeamCode(teamCode);
  const known = NORMALIZED_TEAMS.indexOf(code);

  const bits =
    known >= 0
      ? BALANCED_ROUTES[Math.floor((known * BALANCED_ROUTES.length) / TEAMS.length)]
      : BALANCED_ROUTES[hash(code) % BALANCED_ROUTES.length];

  return Array.from({ length: LEVEL_COUNT }, (_, i) => ((bits >> i) & 1 ? 'B' : 'A')).join('');
}

/** Team codes are typed by people; case and spacing must not decide identity. */
export function normalizeTeamCode(code) {
  return (code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isKnownTeam(code) {
  return NORMALIZED_TEAMS.includes(normalizeTeamCode(code));
}

/**
 * The ten levels as this team plays them, with the beat and its chosen variant
 * flattened into one object per level.
 */
export function levelsFor(teamCode) {
  const route = routeFor(teamCode);

  return LEVELS.map((level, i) => {
    const variant = route[i];
    const station = level.variants[variant];

    return {
      n: level.n,
      id: level.id,
      title: level.title,
      story: level.story,
      breadcrumb: level.breadcrumb,
      variant,
      station: {
        ...station,
        targetUrl: `${TARGET_BASE}/${station.id}.mind`,
      },
    };
  });
}

/** All twenty stations, for the studio and the console. */
export function listStations() {
  return LEVELS.flatMap((level) =>
    Object.entries(level.variants).map(([variant, station]) => ({
      ...station,
      variant,
      level: level.n,
      title: level.title,
      targetUrl: `${TARGET_BASE}/${station.id}.mind`,
    })),
  );
}

/**
 * True when a station's compiled target is actually deployed.
 *
 * `res.ok` alone is not enough: both the dev server and Pages route unmatched
 * paths to the SPA fallback, so a HEAD for a target that was never compiled
 * comes back 200 with index.html behind it. Taken at face value that sends
 * MindAR off to parse HTML as a feature bundle and fail somewhere deep, with the
 * camera already open — exactly what this check exists to pre-empt. A real
 * target is binary; the fallback is unambiguously HTML.
 */
export function targetExists(url) {
  return fetch(url, { method: 'HEAD' }).then(
    (res) => res.ok && !(res.headers.get('content-type') ?? '').includes('text/html'),
    () => false,
  );
}

/** FNV-1a. Only needs to be stable and well-spread, not cryptographic. */
function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}
