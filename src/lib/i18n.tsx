import { createContext, useContext, useState, type ReactNode } from "react";

export type Lang = "en" | "tl";

// ── Incident types — value stored in DB is always the English key ────────────
export interface IncidentType {
  value: string;   // stored in Firestore (always English)
  en: string;      // English label
  tl: string;      // Tagalog label
}

export const INCIDENT_TYPES: IncidentType[] = [
  { value: "Rape",                    en: "Rape",                       tl: "Paggahasa / Pwersahang pagtatalik" },
  { value: "Homicide / Murder",       en: "Homicide / Murder",          tl: "Pagpatay / Sadyang pagkitil ng buhay" },
  { value: "Theft / Robbery",         en: "Theft / Robbery",            tl: "Nakawan / Holdup" },
  { value: "Physical injury / Assault", en: "Physical injury / Assault", tl: "Suntukan / Pananakit" },
  { value: "Road accident",           en: "Road accident",              tl: "Aksidente sa kalsada" },
  { value: "Vandalism",               en: "Vandalism",                  tl: "Paninira ng gamit" },
  { value: "Stalking",                en: "Stalking",                   tl: "Pag-uusig / Sumusunod nang hindi gusto" },
  { value: "Missing person",          en: "Missing person",             tl: "Nawawalang tao" },
  { value: "Fire incident",           en: "Fire incident",              tl: "Sunog" },
  { value: "Medical emergency",       en: "Medical emergency",          tl: "Medical emergency" },
  { value: "Noise complaint",         en: "Noise complaint",            tl: "Reklamo sa ingay" },
  { value: "Animal bite",             en: "Animal bite",                tl: "Nakagat ng aso / hayop" },
  { value: "Illegal drugs",           en: "Illegal drugs",              tl: "Ilegal na droga" },
  { value: "Child abuse",             en: "Child abuse",                tl: "Pang-aabuso sa bata" },
  { value: "Burglary",                en: "Burglary",                   tl: "Pasok sa bahay / tanggapan nang walang pahintulot" },
  { value: "Scam / Fraud",            en: "Scam / Fraud",               tl: "Budol / Estafa / Panloloko" },
  { value: "Cyber harassment",        en: "Cyber harassment",           tl: "Panliligalig online" },
  { value: "Domestic disturbance",    en: "Domestic disturbance",       tl: "Gulo sa bahay / Away pamilya" },
  { value: "Public disturbance",      en: "Public disturbance",         tl: "Gulo sa kalsada / Away sa publiko" },
  { value: "Sexual harassment",       en: "Sexual harassment",          tl: "Bastos / Manyak / Hindi gustong hipo" },
  { value: "Drunk and disorderly",    en: "Drunk and disorderly",       tl: "Lasing na nagwawala" },
  { value: "Not sure / Other",        en: "Not sure / Other",           tl: "Hindi sigurado / Iba" },
];

// ── UI string translations ────────────────────────────────────────────────────
export const UI: Record<Lang, Record<string, string>> = {
  en: {
    // Page titles
    submitReport:        "Submit Incident Report",
    submitSubtitle:      "Your report will be sealed with SHA-256 blockchain hashing.",
    // Section headings
    incidentDetails:     "Incident details",
    description:         "Description",
    evidencePhoto:       "Evidence photo",
    optional:            "(optional)",
    location:            "Location",
    // Labels
    incidentType:        "Incident type",
    chooseType:          "Choose type…",
    dateOfIncident:      "Date of incident",
    describeWhat:        "Describe what happened in detail…",
    maxSize:             "(optional, max 5 MB)",
    clickMap:            "Click on the map to pin the location",
    selected:            "Selected",
    // Buttons
    submitSeal:          "Submit & seal report",
    sealing:             "Sealing on blockchain…",
    // Language toggle
    language:            "Language",
    // Validation
    chooseIncidentType:  "Choose an incident type",
    descMin:             "Description must be at least 10 characters",
    pickDate:            "Pick a date",
    imageTooLarge:       "Image must be under 5 MB",
    imageCompressError:  "Image is too large after compression. Please use a smaller image.",
    submissionFailed:    "Submission failed",
    submitSuccess:       "Report submitted and sealed in blockchain",
  },
  tl: {
    submitReport:        "Mag-ulat ng Insidente",
    submitSubtitle:      "Ang iyong ulat ay ise-seal gamit ang SHA-256 blockchain hashing.",
    incidentDetails:     "Detalye ng insidente",
    description:         "Paglalarawan",
    evidencePhoto:       "Larawan bilang ebidensya",
    optional:            "(opsyonal)",
    location:            "Lokasyon",
    incidentType:        "Uri ng insidente",
    chooseType:          "Pumili ng uri…",
    dateOfIncident:      "Petsa ng insidente",
    describeWhat:        "Ilarawan ang nangyari nang detalyado…",
    maxSize:             "(opsyonal, max 5 MB)",
    clickMap:            "I-click ang mapa para itakda ang lokasyon",
    selected:            "Napili",
    submitSeal:          "Isumite at i-seal ang ulat",
    sealing:             "Ine-seal sa blockchain…",
    language:            "Wika",
    chooseIncidentType:  "Pumili ng uri ng insidente",
    descMin:             "Ang paglalarawan ay dapat na hindi bababa sa 10 karakter",
    pickDate:            "Pumili ng petsa",
    imageTooLarge:       "Ang larawan ay dapat na wala pang 5 MB",
    imageCompressError:  "Masyadong malaki ang larawan pagkatapos i-compress. Gumamit ng mas maliit na larawan.",
    submissionFailed:    "Nabigo ang pagsusumite",
    submitSuccess:       "Naisumite at na-seal ang ulat sa blockchain",
  },
};

// ── Context ───────────────────────────────────────────────────────────────────
interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
  incidentLabel: (value: string) => string;
}

const Ctx = createContext<LangCtx | undefined>(undefined);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try { return (localStorage.getItem("nexus-lang") as Lang) ?? "en"; } catch { return "en"; }
  });

  function setLang(l: Lang) {
    setLangState(l);
    try { localStorage.setItem("nexus-lang", l); } catch {}
  }

  function t(key: string): string {
    return UI[lang][key] ?? UI.en[key] ?? key;
  }

  function incidentLabel(value: string): string {
    const found = INCIDENT_TYPES.find((i) => i.value === value);
    if (!found) return value;
    return lang === "tl" ? found.tl : found.en;
  }

  return (
    <Ctx.Provider value={{ lang, setLang, t, incidentLabel }}>
      {children}
    </Ctx.Provider>
  );
}

export function useLang(): LangCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLang must be used within LangProvider");
  return ctx;
}
