import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { FilePlus2, Shield, UserCircle, AlertCircle } from "lucide-react";
import {
  collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp,
  doc, getDoc, setDoc,
} from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLang, INCIDENT_TYPES } from "@/lib/i18n";
import { RequireAuth } from "@/components/RequireAuth";
import { MapPicker } from "@/components/MapPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildBlock, GENESIS_HASH } from "@/lib/blockchain";

export const Route = createFileRoute("/report/new")({
  head: () => ({ meta: [{ title: "Submit Report — Nexus" }] }),
  component: () => <RequireAuth><NewReport /></RequireAuth>,
});

const MAX_IMAGE_SIZE_MB = 0.8;

async function imageToBase64(file: File, maxWidth = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = reject;
    img.src = url;
  });
}

function NewReport() {
  const { user } = useAuth();
  const { t, lang, incidentLabel } = useLang();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [type, setType] = useState("");

  // Evidence photo
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidencePreview, setEvidencePreview] = useState<string | null>(null);

  // Profile photo
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  const [existingProfilePhoto, setExistingProfilePhoto] = useState<string | null>(null);

  // Load existing profile photo on mount
  useEffect(() => {
    if (!user) return;
    (async () => {
      // Check Google photo first
      if (user.photoURL) {
        setExistingProfilePhoto(user.photoURL);
        return;
      }
      // Check Firestore profile
      const snap = await getDoc(doc(db, "profiles", user.uid));
      if (snap.exists() && snap.data().profile_photo) {
        setExistingProfilePhoto(snap.data().profile_photo);
      }
    })();
  }, [user]);

  const schema = z.object({
    incident_type: z.string().min(1, t("chooseIncidentType")),
    incident_date: z.string().min(1, t("pickDate")),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  });

  function handleEvidenceChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setEvidenceFile(f);
    if (f) {
      if (f.size / 1024 / 1024 > 5) { toast.error(t("imageTooLarge")); setEvidenceFile(null); setEvidencePreview(null); e.target.value = ""; return; }
      setEvidencePreview(URL.createObjectURL(f));
    } else {
      setEvidencePreview(null);
    }
  }

  function handleProfileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setProfileFile(f);
    if (f) {
      if (f.size / 1024 / 1024 > 5) { toast.error(t("imageTooLarge")); setProfileFile(null); setProfilePreview(null); e.target.value = ""; return; }
      setProfilePreview(URL.createObjectURL(f));
    } else {
      setProfilePreview(null);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.currentTarget);

    const parsed = schema.safeParse({
      incident_type: type,
      incident_date: String(fd.get("incident_date") ?? ""),
      latitude: coords?.lat ?? NaN,
      longitude: coords?.lng ?? NaN,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);

    // Profile photo is required if no existing one
    const hasProfile = existingProfilePhoto || profileFile;
    if (!hasProfile) {
      toast.error(lang === "tl"
        ? "Kailangan ng iyong profile photo para maiwasan ang maling ulat."
        : "A profile photo is required to prevent false reporting.");
      return;
    }

    setBusy(true);
    try {
      // 1. Process profile photo (save to Firestore profile if new)
      let profilePhotoUrl = existingProfilePhoto;
      if (profileFile) {
        const b64 = await imageToBase64(profileFile, 400);
        profilePhotoUrl = b64;
        await setDoc(doc(db, "profiles", user.uid), { profile_photo: b64, updated_at: serverTimestamp() }, { merge: true });
      }

      // 2. Process evidence photo (optional)
      let evidenceUrl: string | null = null;
      if (evidenceFile) {
        evidenceUrl = await imageToBase64(evidenceFile);
        if (Math.round((evidenceUrl.length * 3) / 4 / 1024) > MAX_IMAGE_SIZE_MB * 1024) {
          toast.error(t("imageCompressError")); setBusy(false); return;
        }
      }

      // 3. Blockchain
      const lastSnap = await getDocs(query(collection(db, "blockchain_logs"), orderBy("block_index", "desc"), limit(1)));
      const previousHash = lastSnap.empty ? GENESIS_HASH : (lastSnap.docs[0].data().hash_value as string);

      // 4. Insert report (no description field)
      const reportRef = await addDoc(collection(db, "reports"), {
        user_id: user.uid,
        incident_type: parsed.data.incident_type,
        image_url: evidenceUrl,
        reporter_photo: profilePhotoUrl,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        incident_date: parsed.data.incident_date,
        status: "Pending",
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      // 5. Notify admins
      const adminRolesSnap = await getDocs(collection(db, "user_role"));
      await Promise.all(
        adminRolesSnap.docs
          .filter((d) => { const r = d.data().roles; return (Array.isArray(r) ? r : [r]).includes("admin"); })
          .map((d) => addDoc(collection(db, "notifications"), {
            user_id: d.id,
            message: `New report: "${parsed.data.incident_type}"`,
            read: false, created_at: serverTimestamp(),
          }))
      );

      // 6. Blockchain log
      const payload = {
        report_id: reportRef.id, user_id: user.uid,
        incident_type: parsed.data.incident_type,
        latitude: parsed.data.latitude, longitude: parsed.data.longitude,
        incident_date: parsed.data.incident_date, created_at: new Date().toISOString(),
      };
      const { dataHash, hashValue } = await buildBlock(payload, previousHash);
      const nextIndex = lastSnap.empty ? 0 : (lastSnap.docs[0].data().block_index as number) + 1;
      await addDoc(collection(db, "blockchain_logs"), {
        report_id: reportRef.id, block_index: nextIndex,
        previous_hash: previousHash, data_hash: dataHash, hash_value: hashValue,
        payload, created_at: serverTimestamp(),
      });

      toast.success(t("submitSuccess"));
      navigate({ to: "/reports" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("submissionFailed"));
    } finally {
      setBusy(false);
    }
  }

  const hasProfile = existingProfilePhoto || profilePreview;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 text-white">
        <div className="container mx-auto px-4 py-10 max-w-3xl">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
              <FilePlus2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">{t("submitReport")}</h1>
              <p className="text-blue-200/60 text-sm mt-0.5">{t("submitSubtitle")}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Step 1 — Incident type + date */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
            <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white text-xs flex items-center justify-center font-bold">1</span>
              {t("incidentDetails")}
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-700 font-medium">{t("incidentType")}</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="mt-1 border-slate-200 focus:border-blue-400 focus:ring-blue-400/20">
                    <SelectValue placeholder={t("chooseType")} />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {INCIDENT_TYPES.map((inc) => (
                      <SelectItem key={inc.value} value={inc.value}>
                        <span className="font-medium">{lang === "tl" ? inc.tl : inc.en}</span>
                        {lang === "tl" && <span className="ml-1.5 text-xs text-slate-400">({inc.en})</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {type && (
                  <p className="mt-1.5 text-xs text-slate-500">
                    {lang === "tl"
                      ? `EN: ${type}`
                      : `TL: ${INCIDENT_TYPES.find(i => i.value === type)?.tl}`}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="incident_date" className="text-slate-700 font-medium">{t("dateOfIncident")}</Label>
                <Input id="incident_date" name="incident_date" type="date" required
                  max={new Date().toISOString().slice(0, 10)}
                  className="mt-1 border-slate-200 focus:border-blue-400 focus:ring-blue-400/20" />
              </div>
            </div>
          </div>

          {/* Step 2 — Profile photo (anti-fraud) */}
          <div className={`rounded-2xl border shadow-sm p-6 ${hasProfile ? "border-emerald-200 bg-emerald-50/30" : "border-amber-200 bg-amber-50/30"}`}>
            <h2 className="font-bold text-slate-800 mb-1 flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white text-xs flex items-center justify-center font-bold">2</span>
              <UserCircle className="h-4 w-4 text-slate-600" />
              {lang === "tl" ? "Iyong profile photo" : "Your profile photo"}
              {!hasProfile && <span className="text-xs font-normal text-amber-600 ml-1">(required)</span>}
            </h2>
            <p className="text-xs text-slate-500 mb-4 ml-8 flex items-start gap-1">
              <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
              {lang === "tl"
                ? "Kailangan ng tunay na larawan para maiwasan ang maling ulat at pandaraya."
                : "A real photo is required to prevent false reporting and fraud."}
            </p>

            {/* Show existing profile photo */}
            {(existingProfilePhoto || profilePreview) ? (
              <div className="flex items-center gap-4">
                <img
                  src={profilePreview ?? existingProfilePhoto!}
                  alt="profile"
                  className="h-20 w-20 rounded-full object-cover border-2 border-emerald-400 shadow-md"
                />
                <div>
                  <p className="text-sm font-medium text-emerald-700">
                    {lang === "tl" ? "✓ Profile photo na-verify" : "✓ Profile photo verified"}
                  </p>
                  <label className="mt-1 text-xs text-blue-600 hover:underline cursor-pointer">
                    {lang === "tl" ? "Palitan" : "Change photo"}
                    <input type="file" accept="image/*" className="hidden" onChange={handleProfileChange} />
                  </label>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                  <UserCircle className="h-10 w-10 text-slate-400" />
                </div>
                <div className="flex-1">
                  <Input type="file" accept="image/*" onChange={handleProfileChange}
                    className="border-amber-300 focus:border-blue-400 file:bg-gradient-to-r file:from-blue-500 file:to-cyan-500 file:text-white file:border-0 file:rounded-lg file:px-3 file:py-1 file:text-xs file:font-semibold" />
                  <p className="text-xs text-slate-400 mt-1">
                    {lang === "tl" ? "Mag-upload ng iyong tunay na larawan" : "Upload a clear photo of yourself"}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Step 3 — Evidence photo */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
            <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white text-xs flex items-center justify-center font-bold">3</span>
              {t("evidencePhoto")} <span className="text-slate-400 font-normal text-sm">{t("optional")}</span>
            </h2>
            <Input id="image" type="file" accept="image/*" onChange={handleEvidenceChange}
              className="border-slate-200 file:bg-gradient-to-r file:from-blue-500 file:to-cyan-500 file:text-white file:border-0 file:rounded-lg file:px-3 file:py-1 file:text-xs file:font-semibold hover:file:from-blue-400 hover:file:to-cyan-400 file:transition-all" />
            {evidencePreview && (
              <img src={evidencePreview} alt="evidence preview" className="mt-3 h-36 rounded-xl border border-slate-200 object-cover shadow-sm" />
            )}
          </div>

          {/* Step 4 — Location */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
            <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white text-xs flex items-center justify-center font-bold">4</span>
              {t("location")}
            </h2>
            <p className="text-xs text-slate-500 mb-3">{t("clickMap")}</p>
            <MapPicker value={coords} onChange={setCoords} />
            {coords && (
              <p className="text-xs text-slate-400 mt-2 font-mono">
                📍 {t("selected")}: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </p>
            )}
          </div>

          {/* Submit */}
          <Button type="submit" disabled={busy} size="lg"
            className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white border-0 shadow-lg shadow-blue-500/30 hover:scale-[1.01] transition-all duration-200 text-base font-semibold">
            {busy ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                {t("sealing")}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Shield className="h-4 w-4" /> {t("submitSeal")}
              </span>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
