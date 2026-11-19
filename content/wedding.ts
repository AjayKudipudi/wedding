// Everything a guest reads lives in this one file.
// Lines marked SAMPLE are stand-ins — replace them with the real details.

export const wedding = {
  groom: "Ajay",
  bride: "Teju",

  // Shown in Telugu at the very top, the way a printed card opens.
  invocation: "శ్రీరస్తు  శుభమస్తు  అవిఘ్నమస్తు",

  // The wedding day. The time below is a stand-in (midnight) until the muhurtham is fixed:
  // replace 00:00 with the real time, e.g. "2026-12-10T09:42:00+05:30".
  muhurtham: "2026-12-10T00:00:00+05:30",
  muhurthamTime: "", // e.g. "9:42 am" — shown once you fill it in
  dateLine: "Thursday, the 10th of December 2026",
  city: "Veeravasaram, Andhra Pradesh",

  // How the two families are named on the invitation. Add parents' names here if you wish.
  hosts: {
    groomSide: "The Kudipudi family",
    brideSide: "The Bokka family",
  },

  invitation: [
    "With the blessings of our elders and the grace of the Almighty, our families invite you to the wedding of",
    "Come as you are, stay as long as you can, and bless them as they take their seven steps.",
  ],

  // One entry per ceremony, in the order they happen.
  // "time" and "where" are left empty until they are decided; fill them in and they appear.
  events: [
    {
      te: "సంగీత్",
      name: "Sangeet",
      when: "Tuesday 8 December",
      time: "",
      where: "",
      note: "An evening of music and dancing from both families.",
    },
    {
      te: "పసుపు",
      name: "Haldi",
      when: "Wednesday 9 December",
      time: "",
      where: "",
      note: "Turmeric, marigolds and a lot of laughing. Wear yellow you don't mind staining.",
    },
    {
      te: "వివాహం",
      name: "The wedding",
      when: "Thursday 10 December",
      time: "",
      where: "Tulasi Convention, Veeravasaram",
      note: "The muhurtham, and your blessings.",
    },
  ],

  venue: {
    name: "Tulasi Convention",
    address: "Veeravasaram, West Godavari district, Andhra Pradesh",
    // A Google Maps search for the hall. Swap in the hall's exact "Share" link once you have it.
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Tulasi+Convention+Veeravasaram",
  },

  // SAMPLE — WhatsApp number that receives RSVPs: country code + number, digits only.
  rsvpWhatsApp: "910000000000",
};

export type Wedding = typeof wedding;
