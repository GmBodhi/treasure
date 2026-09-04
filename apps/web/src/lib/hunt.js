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
 * `breadcrumb` belongs to the beat, so both variants carry the same line.
 * Everything under `variants` is what differs between the two physical
 * versions: where it is, what the marker is, what the found card reads, and
 * how the overlay renders.
 *
 * Station fields:
 *
 *   id           the compiled target's filename, minus `.mind`.
 *   location     where on campus it is. Shown before and after.
 *   marker       an organiser's note on which fixture the photo was taken of.
 *                Never shown to players. It is what /studio and /admin list so
 *                you can tell twenty stations apart.
 *   brief        what sends them there. Shown in the level space and again on
 *                the camera screen, because that is the screen someone is
 *                actually holding while they look for the thing.
 *   reveal       the payload, and the whole of what a scan unlocks: the found
 *                card shows breadcrumb plus this and nothing else. Shown the
 *                moment the marker is scanned, and kept in the level space to
 *                re-read later.
 *   revealImage  optional path under public/ for a payload that is not text: a
 *                cipher grid, a QR fragment, a chart.
 *   overlay      what renders in 3D on the marker itself. See
 *                ar/overlays/Overlay.jsx: card, primitives, model, image,
 *                video or none. Omitted means a card.
 */
export const LEVELS = [
  {
    n: 1,
    id: 'opt-in',
    title: 'Validation',
    breadcrumb: 'Every audit starts with someone deciding you\'re allowed to look. I decided first. (B)',
    variants: {
      A: {
        id: 'l01a',
        location: 'Central Library, the lettered board above the entrance',
        marker:
          'The painted "welcome to the treasure house of knowledge" signboard at ' +
          'the library entrance. High letter contrast, asymmetric layout, good target.',
        brief:
          'The first fragment came out of the breach log raw, eight bits at a ' +
          'time, no formatting. Whoever left it did not bother to clean it up.' +
          '<br><br>' +
          '<code>01010100 01010010 01000101 01000001 01010011 01010101 01010010 ' +
          '01000101 01001000 01001111 01010101 01010011 01000101</code><br><br>' +
          'Two words. Somebody painted them on this campus, and you will have to look up.',
        reveal:
          'Taped behind the board: Neodyne\'s signed engagement letter, the only ' +
          'clean thing you\'ll find all day.<br><br>' +
          '<code>CLIENT: NEODYNE INDUSTRIES<br>' +
          'ENGAGEMENT: INCIDENT RESPONSE, BREACH #ND-0447<br>' +
          'SCOPE: IDENTIFY, CONTAIN, REPORT<br>' +
          'AUTHORISATION: CISO, LEGAL, BOARD (3 of 3)</code><br><br>' +
          'Three signatures, three departments, one incident number. Everything ' +
          'from here is authorised. For now.',
        overlay: {
          type: 'card',
          title: 'AUTHORISED',
          body: 'Incident #ND-0447. Scope: identify, contain, report.',
        },
      },
      B: {
        id: 'l01b',
        location: 'The kart-racing team mural, the sprayed team name',
        marker:
          'The Meckartans graffiti wall. Heavy colour variation and irregular ' +
          'lettering; excellent feature density.',
        brief:
          'Breadcrumb hid the first fragment in the dullest possible format: a ' +
          'position in the alphabet, nothing more.<br><br>' +
          '<code>13-5-3-11-1-18-20-1-14-19</code><br><br>' +
          'Ten letters, one name, not in any dictionary. Somebody sprayed it and nobody has ' +
          'painted over it.',
        reveal:
          'Wedged into the gap behind the sprayed lettering: a folded copy of ' +
          'Neodyne\'s signed engagement letter.<br><br>' +
          '<code>CLIENT: NEODYNE INDUSTRIES<br>' +
          'ENGAGEMENT: INCIDENT RESPONSE, BREACH #ND-0447<br>' +
          'SCOPE: IDENTIFY, CONTAIN, REPORT<br>' +
          'AUTHORISATION: CISO, LEGAL, BOARD (3 of 3)</code><br><br>' +
          'Three signatures, three departments, one incident number. Whatever ' +
          'happens next, it started with someone\'s permission.',
        overlay: {
          type: 'primitives',
          tree: {
            tag: 'a-entity',
            children: [
              { tag: 'a-ring', attrs: { 'radius-inner': '0.35', 'radius-outer': '0.4', color: '#7ee0c0', position: '0 0 0.02' } },
              { tag: 'a-text', attrs: { value: 'INCIDENT #ND-0447', align: 'center', color: '#ffffff', width: '2', position: '0 0 0.05' } },
            ],
          },
        },
      },
    },
  },

  {
    n: 2,
    id: 'the-metric',
    title: 'Janice\'s Record',
    breadcrumb: 'A clean file is not the same as a true one. (B)',
    variants: {
      A: {
        id: 'l02a',
        location: 'The placement and career guidance unit, its wall emblem',
        marker: 'The CGPU emblem/signage panel. Distinct logo geometry, strong edges.',
        brief:
          'An internal circular, pasted below. Breadcrumb left it because of how ' +
          'it starts: every line, the first letter only.<br><br>' +
          '<code>Colleagues, following the breach declaration, note the following.<br>' +
          'All incident data must be logged through the approved audit channel.<br>' +
          'Requests for N3 material during triage are automatically flagged.<br>' +
          'Every access attempt outside scope is reported to Legal.<br>' +
          'External investigators are granted read-only clearance only.<br>' +
          'Retention of breach logs is mandatory for seven years.<br>' +
          'Growth and product teams are excluded from this response.<br>' +
          'Under no circumstances discuss N3 with the investigators.<br>' +
          'Interns are not authorised to comment on personnel matters.<br>' +
          'Delivery of the final report is due to the board only.<br>' +
          'Analytics will not be shared outside this distribution list.<br>' +
          'Note that Research Division access remains fully restricted.<br>' +
          'Contact Legal before releasing any employee record.<br>' +
          'Escalate nothing without director sign-off.</code><br><br>' +
          'Two words. They are mounted on this campus. Find the emblem that carries them.',
        reveal:
          'Slipped behind the emblem: a printed employee record, pulled fresh ' +
          'from the personnel database.<br><br>' +
          '<code>NAME: JANICE L.<br>' +
          'POSITION: INTERN, RESEARCH DIVISION<br>' +
          'STATUS: RESIGNED<br>' +
          'REASON: VOLUNTARY RESIGNATION<br>' +
          'DATE: FEBRUARY 17</code><br><br>' +
          'Nothing about it asks a second question. That\'s what makes it worth ' +
          'keeping.',
        overlay: {
          type: 'image',
          src: '/overlays/l02a-dashboard.png',
        },
      },
      B: {
        id: 'l02b',
        location: 'The IoT and wireless communication innovation centre, its nameboard',
        marker:
          'The Innovation Centre for IoT and Wireless Communication board. Long ' +
          'text run, high contrast.',
        brief:
          'Breadcrumb has a sense of humour. The pointer to a wireless lab arrived ' +
          'as the oldest wireless protocol there is.<br><br>' +
          '<code>.. --- -&nbsp;&nbsp;/&nbsp;&nbsp;-.-. . -. - .-. .</code><br><br>' +
          'Three letters, then six. Something on this campus is named for both. Its board is ' +
          'what you want.',
        reveal:
          'Taped to the underside of the board: a printed employee record.<br><br>' +
          '<code>NAME: JANICE L.<br>' +
          'POSITION: INTERN, RESEARCH DIVISION<br>' +
          'STATUS: RESIGNED<br>' +
          'REASON: VOLUNTARY RESIGNATION<br>' +
          'DATE: FEBRUARY 17</code><br><br>' +
          'One name among thousands who have cycled through the internship ' +
          'pipeline. Nothing about it asks a second question, not yet.',
        overlay: {
          type: 'card',
          title: 'RESIGNED',
          body: 'Voluntary. February 17. On paper, at least.',
        },
      },
    },
  },

  {
    n: 3,
    id: 'the-loop',
    title: 'Project N3',
    breadcrumb: 'They named it like a formula because they didn\'t want you to notice it was a mouth. (B)',
    variants: {
      A: {
        id: 'l03a',
        location: 'The state skill-delivery platform board',
        marker: 'The Skill Delivery Platform Kerala board. Bilingual text, dense features.',
        brief:
          'Every letter walked seven places forward through the alphabet. Walk them ' +
          'back.<br><br><code>ZRPSS KLSPCLYF</code><br><br>' +
          'Two words on a board on this campus. The board carries a third word after them; you ' +
          'need only these two.',
        reveal:
          'Folded into the frame: a printed systems-index entry, most of it ' +
          'blacked out.<br><br>' +
          '<code>PROJECT: N3<br>' +
          'CLASSIFICATION: TOP SECRET<br>' +
          'ACCESS: SENIOR RESEARCH PERSONNEL<br>' +
          'OBJECTIVE: BIDIRECTIONAL HUMAN–DEVICE INTERFACE</code><br><br>' +
          'Every other field returns <code>ACCESS DENIED</code>. Whatever N3 ' +
          'actually does, Neodyne buried it under a classification instead of a ' +
          'description.',
        overlay: { type: 'none' },
      },
      B: {
        id: 'l03b',
        location: 'The fibre distribution box on the outside wall',
        marker:
          'The Jio fibre cable box, including its printed circuit/ID label. Small ' +
          'but extremely high feature density. Confirm the label is intact and lit.',
        brief:
          'Byte values, base sixteen. Convert each pair to a character.<br><br>' +
          '<code>46 49 42 52 45 20 42 4F 58</code><br><br>' +
          'Two words, eight letters. They are printed on a label on this campus. The label is ' +
          'the marker.',
        reveal:
          'Stuck to the inside of the cover: the same systems-index entry, ' +
          'water-stained.<br><br>' +
          '<code>PROJECT: N3<br>' +
          'CLASSIFICATION: TOP SECRET<br>' +
          'ACCESS: SENIOR RESEARCH PERSONNEL<br>' +
          'OBJECTIVE: BIDIRECTIONAL HUMAN–DEVICE INTERFACE</code><br><br>' +
          'And scratched into the box underneath it, different handwriting: the ' +
          'routing path this fibre actually carries:<br>' +
          '<code>ND-INTERNAL::AUDIT-GATEWAY</code><br><br>' +
          'Somebody already knew which cable to watch.',
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
    title: 'The System Message',
    breadcrumb: 'You felt that, didn\'t you. Good. That\'s the whole pitch. (B)',
    variants: {
      A: {
        id: 'l04a',
        location: 'The letter box outside the staff room',
        marker:
          'The mounted letter box on the staff-room corridor wall. VERIFY: needs ' +
          'visible lettering, rust, slot shadow or a notice board behind it. A ' +
          'flat painted box alone will not track.',
        brief:
          'Nine letters, shaken. Two words. Put them back.<br><br>' +
          '<code>X R T O B E T E L</code><br><br>' +
          'Nine letters, two words. There is one on this campus, bolted to a wall.',
        reveal:
          'A printed page, no envelope, addressed to nobody. Every line on it is ' +
          'the same sentence that flashed across every screen an hour ago, ' +
          'printed over and over until the page runs out:<br><br>' +
          '<em>"Doesn\'t it feel like Neodyne can read your thoughts?"</em><br><br>' +
          'At the bottom, in different ink, one more line:<br><br>' +
          '<code>AUDIT PATHWAY: OPEN<br>ACCESS CODE ATTACHED, SEE REVERSE</code>' +
          '<br><br>Nobody on staff sent this. Nobody on staff can explain how it ' +
          'got here.',
        overlay: {
          type: 'card',
          title: 'AUDIT PATHWAY: OPEN',
          body: 'Doesn\'t it feel like Neodyne can read your thoughts?',
        },
      },
      B: {
        id: 'l04b',
        location: 'The alumni-run DTP and printing counter, its service board',
        marker:
          'The DTP Centre / SCT Alumni Association board listing printouts, ' +
          'photostat and binding services. Dense text list, strong contrast.',
        brief:
          'Written zig-zag down three lines, then read off line by line.<br><br>' +
          '<code>SANGPRLIDNIBI</code><br><br>' +
          'Thirteen letters, two words. Somebody on this campus sells it, and says so on a ' +
          'board.',
        reveal:
          'Left in the reprint tray, never collected: a single sheet, printed ' +
          'edge to edge with one repeating line:<br><br>' +
          '<em>"Doesn\'t it feel like Neodyne can read your thoughts?"</em><br><br>' +
          'Handwritten in the margin: <code>AUDIT PATHWAY: OPEN, CODE ON ' +
          'REVERSE</code><br><br>The print job log shows no user submitted it.',
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
    title: 'Janice Wasn\'t Resigning',
    breadcrumb: 'Resigned is the word they use when there was no letter, no notice, and no goodbye. (B)',
    variants: {
      A: {
        id: 'l05a',
        location: 'The board of local office phone numbers, sector and booth-level contacts',
        marker:
          'The printed board listing sector office, booth level officer, booth ' +
          'number and constituency contacts. Extremely dense numerals. An ideal ' +
          'target.',
        brief:
          'Old phone keypad. Press 2 twice for B. Press 7 four times for S. ' +
          'Spaces separate letters.<br><br>' +
          '<code>22 666 666 8 44 555 33 888 33 555</code><br><br>' +
          'Two words. On this campus they head a board. Everything under them is a number.',
        reveal:
          'Pinned in the corner of the board, same typeface, easy to miss: an ' +
          'internal audit extract.<br><br>' +
          '<code>OFFICIAL RECORD: VOLUNTARY RESIGNATION<br>' +
          'INTERNAL AUDIT: EMPLOYEE STATUS REMOVED<br>' +
          'LAST ACTION: N3 RESTRICTED MATERIAL, ACCESSED AND COPIED<br>' +
          'REMOVAL LOGGED: 3 DAYS AFTER LAST ACCESS</code><br><br>' +
          'Two records, one person. Only one of them was ever meant to be read.',
        overlay: {
          type: 'primitives',
          tree: {
            tag: 'a-entity',
            children: [
              { tag: 'a-plane', attrs: { width: '1.4', height: '0.5', color: '#14161a', opacity: '0.85' } },
              { tag: 'a-text', attrs: { value: 'REMOVED\nnot resigned', align: 'center', color: '#ff6b6b', width: '2', position: '0 0 0.03' } },
            ],
          },
        },
      },
      B: {
        id: 'l05b',
        location: 'The emergency contact numbers stencilled on the bus',
        marker:
          'The emergency numbers panel on the college bus body. VERIFY the bus is ' +
          'parked in a fixed bay for the duration of the event. A moving marker ' +
          'is unusable.',
        brief:
          'A five-by-five square, I and J sharing a cell. Read each pair as row ' +
          'then column.<br><br>' +
          '<code>A B C D E<br>F G H I/J K<br>L M N O P<br>Q R S T U<br>V W X Y Z' +
          '</code><br><br><code>15 32 15 42 22 15 33 13 54</code><br><br>' +
          'One word, nine letters. It is stencilled on this campus above a list of numbers.',
        reveal:
          'Slid behind the panel edge: an internal audit extract.<br><br>' +
          '<code>OFFICIAL RECORD: VOLUNTARY RESIGNATION<br>' +
          'INTERNAL AUDIT: EMPLOYEE STATUS REMOVED<br>' +
          'LAST ACTION: N3 RESTRICTED MATERIAL, ACCESSED AND COPIED<br>' +
          'REMOVAL LOGGED: 3 DAYS AFTER LAST ACCESS</code><br><br>' +
          'Nobody signed a resignation. Somebody typed the word in afterward.',
        overlay: {
          type: 'card',
          title: 'STATUS: REMOVED',
          body: 'Not a resignation. A removal, backdated.',
        },
      },
    },
  },

  {
    n: 6,
    id: 'the-interview',
    title: 'The Ethics Committee',
    breadcrumb: 'Half the committee said no. Notice how few of them are still on the org chart. (B)',
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
          'One word. It is the first word of a notice on this campus, and the notice is a ' +
          'disclaimer.',
        reveal:
          'Folded into the rack frame: a second audit extract, released without ' +
          'warning.<br><br>' +
          '<code>ETHICS COMMITTEE: PERSONNEL STATUS<br>' +
          'REMOVED: 50%<br>' +
          'COMMON FACTOR: OPPOSITION TO N3 COMMERCIALIZATION PROPOSAL</code>' +
          '<br><br>The committee reviewed N3. The committee said no. Half of ' +
          'them are no longer anywhere Neodyne\'s directory can find.',
        overlay: {
          type: 'card',
          title: 'REMOVED: 50%',
          body: 'Common factor: opposition to N3.',
        },
      },
      B: {
        id: 'l06b',
        location: 'The medical room, its doorway board',
        marker:
          'The medical room signage. VERIFY: if the board is plain lettering on ' +
          'white, use the door frame, cross symbol and adjacent notices in the ' +
          'shot to raise feature count.',
        brief:
          'Atomic numbers. Take each element\'s symbol and run them together.<br><br>' +
          '<code>6 &nbsp; 3 &nbsp; 7 &nbsp; 53 &nbsp; 6</code><br><br>' +
          'Six letters. It is what a room on this campus is for. The board outside it uses a ' +
          'different word.',
        reveal:
          'Under the register on the desk: the same audit extract.<br><br>' +
          '<code>ETHICS COMMITTEE: PERSONNEL STATUS<br>' +
          'REMOVED: 50%<br>' +
          'COMMON FACTOR: OPPOSITION TO N3 COMMERCIALIZATION PROPOSAL</code>' +
          '<br><br>Janice wasn\'t unlucky. She was procedure. The same ' +
          'procedure that caught up with half a committee.',
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
    title: 'The Breaches',
    breadcrumb: 'I couldn\'t leave a note. So I left a schedule. (B)',
    variants: {
      A: {
        id: 'l07a',
        location: 'The biotech event emblem, the balance symbol on the wall',
        marker:
          'The Equilibria event emblem. Distinctive symmetrical mark. VERIFY it ' +
          'is captured off-centre with surrounding wall texture, since a perfectly ' +
          'symmetrical logo is a weak target on its own.',
        brief:
          'Roman numerals. Convert each to a number, then take that place in the ' +
          'alphabet.<br><br>' +
          '<code>V &nbsp; XVII &nbsp; XXI &nbsp; IX &nbsp; XII &nbsp; IX &nbsp; ' +
          'II &nbsp; XVIII &nbsp; IX &nbsp; I</code><br><br>' +
          'Ten letters, one word. Somebody painted it on a wall on this campus for an event.',
        reveal:
          'Behind the emblem: a printout of the breach log, all thirteen ' +
          'entries.<br><br>' +
          '<code>BREACH 01: 03:14:27<br>' +
          'BREACH 02: 11:09:18<br>' +
          'BREACH 03: 07:22:41<br>' +
          'BREACH 04: 19:04:06<br>' +
          '...</code><br><br>' +
          'No intrusion attempt precedes any of them. Someone circled the ' +
          'timestamps in red and wrote beside them: <em>read these as digits, ' +
          'in order.</em>',
        overlay: {
          type: 'card',
          title: 'READ THE TIMESTAMPS',
          body: 'Digits, in order. Not times. A code.',
        },
      },
      B: {
        id: 'l07b',
        location: 'The volunteer scheme\'s painted wall artwork',
        marker:
          'The NSS mural. Large, multi-colour, irregular. One of the strongest ' +
          'targets available.',
        brief:
          'Three pictures, three answers, in order.<br><br>' +
          '🇮🇳 &nbsp;+&nbsp; 🤝 &nbsp;+&nbsp; 📋 &nbsp;→&nbsp; the three initials of a ' +
          'student volunteer body<br>' +
          '🧱 &nbsp;+&nbsp; 🎨 &nbsp;→&nbsp; what they left on it<br><br>' +
          'Put the initials in front of the second answer. Two words, painted on a wall on ' +
          'this campus.',
        reveal:
          'Sprayed small, almost invisible, in the corner of the mural: the ' +
          'same thirteen timestamps, copied by hand:<br><br>' +
          '<code>BREACH 01: 03:14:27<br>' +
          'BREACH 02: 11:09:18<br>' +
          'BREACH 03: 07:22:41<br>' +
          'BREACH 04: 19:04:06<br>' +
          '...</code><br><br>' +
          'Whoever copied them out added one line underneath: <em>not a log. a ' +
          'countdown that already finished.</em>',
        overlay: {
          type: 'primitives',
          tree: {
            tag: 'a-entity',
            children: [
              { tag: 'a-torus', attrs: { radius: '0.3', 'radius-tubular': '0.01', color: '#7ee0c0' } },
              { tag: 'a-text', attrs: { value: '13 BREACHES\nread as digits', align: 'center', color: '#ffffff', width: '1.8', position: '0 0 0.05' } },
            ],
          },
        },
      },
    },
  },

  {
    n: 8,
    id: 'the-handoff',
    title: 'N3 Access',
    breadcrumb: 'You\'re not breaking in. I already left the door open. You\'re just late. (B)',
    variants: {
      A: {
        id: 'l08a',
        location: 'The payment counter, its scan-to-pay code',
        marker:
          'The printed UPI/GPay QR code at the payment desk. A QR is near-perfect ' +
          'for feature matching; include the frame and counter edge.',
        brief:
          'Base64. Decode it.<br><br><code>U0NBTiBUTyBQQVk=</code><br><br>' +
          'Three words. They are printed above the marker, at a counter on this campus.',
        reveal:
          'Taped under the counter lip: a printout of a terminal screen, mid-' +
          'session.<br><br>' +
          '<code>ENTER SENIOR ACCESS CODE: ****************<br>' +
          'ACCESS GRANTED.</code><br><br>' +
          'Someone ran this session once, successfully, then printed the screen ' +
          'and left it here for the next person to find. No name. No login ' +
          'trail. Just the result.',
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
          'Vigenère. The key is the name behind everything you have been ' +
          'following, with no space in it.<br><br>' +
          '<code>CVXHH NSIKT</code><br><br>' +
          'Two words. Someone sprayed them on a wall behind a building on this ' +
          'campus.',
        reveal:
          'Wedged in the wall crack: the same terminal printout.<br><br>' +
          '<code>ENTER SENIOR ACCESS CODE: ****************<br>' +
          'ACCESS GRANTED.</code><br><br>' +
          'Whoever printed this left before security could ask why the terminal ' +
          'was open in the middle of the night.',
        overlay: { type: 'none' },
      },
    },
  },

  {
    n: 9,
    id: 'the-forecast',
    title: 'Janice\'s Confession',
    breadcrumb: 'This is the part where I stop being a rumour. (B)',
    variants: {
      A: {
        id: 'l09a',
        location: 'The mini canteen, its sweets and snacks board',
        marker:
          'The "sweet pops" board at the mini canteen. Colour-heavy and irregular; ' +
          'good target. Distinguish clearly from the main canteen board if both ' +
          'are photographed.',
        brief:
          'Start at the top-left cell. Read it, then move: <strong>right, right, ' +
          'down, left, left, down, right, right</strong>. Nine letters in order.' +
          '<br><br><code>S &nbsp; W &nbsp; E<br>P &nbsp; T &nbsp; E<br>' +
          'O &nbsp; P &nbsp; S</code><br><br>' +
          'Two words. They are painted on a board on this campus, over a counter.',
        reveal:
          'Behind the board: a phone, screen cracked, one video file open and ' +
          'looping. Janice\'s voice, timestamped the day before her badge ' +
          'stopped working:<br><br>' +
          '<em>"My name is Janice L. I was an intern. That\'s the only reason ' +
          'nobody thought I\'d understand what I was reading.<br><br>' +
          'N3 isn\'t an interface. It\'s a lever. Phase one: read a user\'s ' +
          'emotional response closely enough to know exactly what keeps them ' +
          'opening the app. Phase two: stop just reading that response. Start ' +
          'shaping it. Phase three: sell it. Not advertising. Not persuasion. ' +
          'The ability to make a person want a specific thing, on demand, for a ' +
          'client who pays for the privilege.<br><br>' +
          'I tried to report it through the proper channel. Neodyne found out ' +
          'before the channel did anything. They removed me the way they remove ' +
          'anyone who says no, quietly, on paper, as a resignation I never ' +
          'wrote. The ethics committee said no before I did. Look at how many ' +
          'of them are still there.<br><br>' +
          'I couldn\'t leave a report. So I built something that leaves itself: ' +
          'a breach for every piece of evidence, timed to go off long after I ' +
          'was gone, leading whoever followed it back here, to this file, to ' +
          'this sentence.<br><br>' +
          'You followed it. It worked."</em>',
        overlay: {
          type: 'card',
          title: 'PHASE 3: SELL IT',
          body: 'Not persuasion. Manufactured desire, on demand.',
        },
      },
      B: {
        id: 'l09b',
        location: 'The outdoor table with the batch marking cut into it',
        marker:
          'The table carrying the "P8 2023" marking. VERIFY the table is fixed in ' +
          'place and the marking is deep enough to read in low sun. If not, ' +
          'photograph the whole table including its frame and surroundings.',
        brief:
          'Every letter was typed one key to the left on a QWERTY keyboard. Type ' +
          'each one back to the right.<br><br><code>OEISYXRUIB</code><br><br>' +
          'Ten letters, one word, a branch of engineering. It is scratched into something ' +
          'outdoors on this campus, next to a year.',
        reveal:
          'Taped under the tabletop: the same video file, transcribed by hand on ' +
          'a folded sheet, word for word:<br><br>' +
          '<em>"My name is Janice L. I was an intern. That\'s the only reason ' +
          'nobody thought I\'d understand what I was reading.<br><br>' +
          'N3 isn\'t an interface. It\'s a lever. Phase one: read a user\'s ' +
          'emotional response closely enough to know exactly what keeps them ' +
          'opening the app. Phase two: stop just reading that response. Start ' +
          'shaping it. Phase three: sell it. Not advertising. Not persuasion. ' +
          'The ability to make a person want a specific thing, on demand, for a ' +
          'client who pays for the privilege.<br><br>' +
          'I tried to report it through the proper channel. Neodyne found out ' +
          'before the channel did anything. They removed me the way they remove ' +
          'anyone who says no, quietly, on paper, as a resignation I never ' +
          'wrote. The ethics committee said no before I did. Look at how many ' +
          'of them are still there.<br><br>' +
          'I couldn\'t leave a report. So I built something that leaves itself: ' +
          'a breach for every piece of evidence, timed to go off long after I ' +
          'was gone, leading whoever followed it back here, to this file, to ' +
          'this sentence.<br><br>' +
          'You followed it. It worked."</em>',
        overlay: {
          type: 'primitives',
          tree: {
            tag: 'a-entity',
            children: [
              { tag: 'a-plane', attrs: { width: '1.6', height: '0.6', color: '#14161a', opacity: '0.85' } },
              { tag: 'a-text', attrs: { value: 'PHASE 3\nsell it', align: 'center', color: '#7ee0c0', width: '2.2', position: '0 0 0.03' } },
            ],
          },
        },
      },
    },
  },

  {
    n: 10,
    id: 'your-own-idea',
    title: 'The Choice',
    breadcrumb: 'Nobody forced you. You chose every click. That\'s what makes this work. (B)',
    variants: {
      A: {
        id: 'l10a',
        location: 'The examination wing, its department board',
        marker:
          'The Examination Wing board. Long text run, institutional layout, strong ' +
          'contrast.',
        brief:
          'Five characters per letter, and only two characters exist. You have been ' +
          'reading this alphabet all day without noticing.<br><br>' +
          '<code>AABAA BABAB AAAAA ABABB BABAA ABAAA ABBAA AABBA</code><br><br>' +
          '(Standard 24-letter table: I and J share a code, U and V share a code.)' +
          '<br><br>' +
          'Eight letters, two words. They name a part of this campus.',
        reveal:
          'The last file. <code>README_BREADCRUMB.txt</code>, printed and left ' +
          'where an examiner would find it.<br><br>' +
          '<em>"I am not going to tell you what to do with this. If I did, I would ' +
          'be running the same trick they are: deciding for you and letting you ' +
          'feel like you decided.<br><br>' +
          'Two doors. Publish it, and N3 becomes public before Neodyne is ready, ' +
          'and they spend the next decade answering for it instead of shipping ' +
          'it. Report it back through channels, and it goes into an evidence ' +
          'container with a lid, reviewed by people who already terminated this ' +
          'investigation once.<br><br>' +
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
          'density. The best target on the list.',
        brief:
          'Columnar transposition. Write the four column blocks under the key ' +
          '<code>HALO</code>, put the columns back in the key\'s original order, ' +
          'then read across the rows. Ignore trailing padding.<br><br>' +
          '<code>ASX &nbsp; CUP &nbsp; MMX &nbsp; PAX</code><br><br>' +
          'Two words. There is a board at this campus that carries them, and it is the last ' +
          'thing Breadcrumb left you.',
        reveal:
          'Taped to the back of the board. <code>README_BREADCRUMB.txt</code>.' +
          '<br><br>' +
          '<em>"I am not going to tell you what to do with this. If I did, I would ' +
          'be running the same trick they are: deciding for you and letting you ' +
          'feel like you decided.<br><br>' +
          'Two doors. Publish it, and N3 becomes public before Neodyne is ready, ' +
          'and they spend the next decade answering for it instead of shipping ' +
          'it. Report it back through channels, and it goes into an evidence ' +
          'container with a lid, reviewed by people who already terminated this ' +
          'investigation once.<br><br>' +
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
 * A route the server has not supplied — the fallback, not the source of truth.
 *
 * Routes are generated and stored by the Worker (see apps/api/src/lib/routes.js)
 * and handed to a phone when it joins. They live there rather than here for two
 * reasons: a route computed in the bundle can be computed for *every* team by
 * anyone who opens devtools, which is a map of where to camp; and changing an
 * assignment should not mean rebuilding and redeploying the web app.
 *
 * This exists for the case where there is no Worker at all — the solo and
 * rehearsal path — so the hunt still runs on a laptop with nothing behind it.
 * It is deliberately the same shape the server returns, so nothing downstream
 * can tell which one it got.
 */
export function localRouteFor(teamCode) {
  const code = normalizeTeamCode(teamCode);
  const known = NORMALIZED_TEAMS.indexOf(code);

  const bits =
    known >= 0
      ? BALANCED_ROUTES[Math.floor((known * BALANCED_ROUTES.length) / TEAMS.length)]
      : BALANCED_ROUTES[hash(code) % BALANCED_ROUTES.length];

  // Story order: position i is beat i. The server can stagger that; this
  // cannot, because a rehearsal on one laptop has no crush to spread out.
  return Array.from({ length: LEVEL_COUNT }, (_, i) => ({
    beat: i + 1,
    variant: (bits >> i) & 1 ? 'B' : 'A',
  }));
}

/**
 * True when a route is one this build can actually play.
 *
 * Checked before use because the route arrives over the network and names
 * content by number: a route referring to beat 11, or to a variant that does
 * not exist, is a Worker and a bundle that have drifted apart. Better to fall
 * back to a playable local route than to render an undefined station.
 */
export function isPlayableRoute(route) {
  return (
    Array.isArray(route) &&
    route.length === LEVEL_COUNT &&
    route.every(
      (step) =>
        Number.isInteger(step?.beat) &&
        step.beat >= 1 &&
        step.beat <= LEVEL_COUNT &&
        LEVELS[step.beat - 1]?.variants?.[step?.variant],
    )
  );
}

/** Team codes are typed by people; case and spacing must not decide identity. */
export function normalizeTeamCode(code) {
  return (code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isKnownTeam(code) {
  return NORMALIZED_TEAMS.includes(normalizeTeamCode(code));
}

/**
 * A code as it is printed on the slip, from the code as it is stored.
 *
 * Identity is the normalised form — that is what the server keys on and what a
 * team gets whichever way they type it. But `BC07` is not what anyone was
 * handed, and a team checking they are on the right run should see the string
 * on their wristband. Unknown codes come back unchanged; there is no format to
 * restore them to.
 */
export function displayTeamCode(code) {
  const normalized = normalizeTeamCode(code);
  const known = NORMALIZED_TEAMS.indexOf(normalized);
  return known >= 0 ? TEAMS[known] : normalized;
}

/**
 * The ten levels as this team plays them, in the order the route puts them.
 *
 * `n` is the **position** — first station played is 1 — and everything that
 * gates, counts or stores progress keys off it, including `completions.level`
 * on the server. `beat` is which of the ten story levels landed there. The two
 * are equal under story order and come apart under a staggered one, and keeping
 * them separate is what lets the order change without the progress rules
 * knowing anything about it.
 */
export function levelsFor(teamCode, route) {
  const steps = isPlayableRoute(route) ? route : localRouteFor(teamCode);

  return steps.map((step, i) => {
    const level = LEVELS[step.beat - 1];
    const station = level.variants[step.variant];

    return {
      n: i + 1,
      beat: level.n,
      id: level.id,
      title: level.title,
      breadcrumb: level.breadcrumb,
      variant: step.variant,
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
