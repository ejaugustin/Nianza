// N4 (Village Translator) content bank -- "what changed since you raised
// yours" items, source-derived from AAP/Bright Futures guidance the same way
// daily tips are (v2.2 precedent: no per-item approval workflow required
// for this content type, since it only restates existing vetted guidance).
// `topic` is a stable slug used for direct lookup from a G.0 "Ask Patricia"
// link and for the grandparent-note-template compose flow (N4.3).
const GENERATIONAL_SHIFT_ITEMS = [
  {
    topic: "back-sleeping",
    bodyText:
      "Back sleeping for every nap and every night is the guidance now -- it's the single biggest change since the days of \"tummy sleeping so they don't choke.\" Research in the 1990s showed back sleeping dramatically lowers SIDS risk, and it's held up ever since.",
    sourceRef: "AAP Safe Sleep Guidelines"
  },
  {
    topic: "no-honey-before-one",
    bodyText:
      "No honey before age one -- not even a little on a pacifier or in cooking. It can carry spores that cause infant botulism, which a baby's gut isn't ready to handle yet. After the first birthday, honey is fine.",
    sourceRef: "AAP / CDC Infant Botulism Guidance"
  },
  {
    topic: "car-seat-direction",
    bodyText:
      "Rear-facing lasts much longer than it used to -- current guidance is to stay rear-facing until at least age two, and often longer depending on the seat's height and weight limits. It's not overcaution; it's just better crash data than we had before.",
    sourceRef: "AAP / NHTSA Car Seat Guidelines"
  },
  {
    topic: "cry-it-out-framing",
    bodyText:
      "There's no single \"right\" way to handle sleep training, and responding to a crying baby doesn't spoil them -- that idea has been well and truly retired. Whatever approach a family chooses, from responsive settling to a more structured method, current guidance says the baby's attachment isn't at risk either way.",
    sourceRef: "AAP Healthy Sleep Habits"
  },
  {
    topic: "rice-cereal-in-bottles",
    bodyText:
      "Putting rice cereal in a bottle to help a baby \"sleep through the night\" isn't recommended anymore -- it doesn't actually help sleep, and it's a choking and overfeeding risk. Solids start around six months, by spoon, when the baby is ready.",
    sourceRef: "AAP Infant Feeding Guidelines"
  },
  {
    topic: "secondhand-smoke",
    bodyText:
      "The guidance on secondhand smoke is stricter than it used to be -- no smoking in the home or car at all, not just \"not directly around the baby.\" Smoke residue on clothes, furniture, and hair (thirdhand smoke) matters too.",
    sourceRef: "AAP Secondhand and Thirdhand Smoke Guidance"
  },
  {
    topic: "baby-walkers",
    bodyText:
      "Baby walkers with wheels are actually discouraged now, mainly because of stair-fall injuries and because they don't help walking development the way people once thought. Stationary activity centers are the safer swap.",
    sourceRef: "AAP Injury Prevention Guidelines"
  },
  {
    topic: "crib-bumpers-and-loose-bedding",
    bodyText:
      "A bare crib is the standard now -- no bumpers, blankets, pillows, or stuffed animals until at least the first birthday. It looks stark compared to how nurseries used to be styled, but it's the safest sleep setup we know of.",
    sourceRef: "AAP Safe Sleep Guidelines"
  },
  {
    topic: "peanut-introduction",
    bodyText:
      "Early exposure to peanut products (in age-appropriate form) is now often recommended around six months, not delayed like it used to be -- research found delaying introduction didn't prevent allergies and may have made them more common.",
    sourceRef: "AAP / NIAID Early Peanut Introduction Guidelines"
  },
  {
    topic: "screen-time-under-two",
    bodyText:
      "The guidance on screens for babies under 18-24 months is more specific than \"just limit it\" -- avoid screen media other than video chatting, mainly because that age group doesn't learn language or concepts from a screen the way they do from a person.",
    sourceRef: "AAP Media Use Guidelines"
  },
  {
    topic: "fever-treatment-thresholds",
    bodyText:
      "The advice isn't to treat every fever anymore -- a fever itself is the body doing its job. What matters is how the baby is acting and, for babies under three months, any fever at all warranting a same-day call to the pediatrician regardless of the number.",
    sourceRef: "AAP Fever Guidance"
  },
  {
    topic: "co-sleeping-vs-room-sharing",
    bodyText:
      "Room-sharing without bed-sharing is the current guidance -- baby in their own crib or bassinet, in the parents' room, for at least the first six months. It's a middle ground between \"crib down the hall\" and \"in the bed,\" based on newer SIDS-risk research.",
    sourceRef: "AAP Safe Sleep Guidelines"
  },
  {
    topic: "pacifier-and-sids-risk",
    bodyText:
      "Pacifiers are actually recommended now at naptime and bedtime, once breastfeeding is established -- studies found they're associated with a lower SIDS risk, which is the opposite of the old worry that they'd cause problems.",
    sourceRef: "AAP Safe Sleep Guidelines"
  },
  {
    topic: "bottle-propping",
    bodyText:
      "Propping a bottle so a baby can feed unattended isn't considered safe anymore -- it's a choking risk and it also skips the face-to-face contact that feeding time is for. Every bottle feeding is meant to be held.",
    sourceRef: "AAP Infant Feeding Guidelines"
  },
  {
    topic: "outdoor-sun-exposure-under-six-months",
    bodyText:
      "Direct sun exposure for babies under six months is avoided now rather than managed with a light sunscreen -- shade and protective clothing are the first line, with sunscreen on small exposed areas only when shade isn't possible.",
    sourceRef: "AAP Sun Safety Guidance"
  }
];

module.exports = { GENERATIONAL_SHIFT_ITEMS };
