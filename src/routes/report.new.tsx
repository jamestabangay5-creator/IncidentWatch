import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { FilePlus2, Shield } from "lucide-react";
import {
  collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLang, INCIDENT_TYPES } from "@/lib/i18n";
import { RequireAuth } from "@/components/RequireAuth";
import { MapPicker } from "@/components/MapPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildBlock, GENESIS_HASH } from "@/lib/blockchain";

export const Route = createFileRoute("/report/new")({
  head: () => ({ meta: [{ title: "Submit Report — Nexus" }] }),
  component: () => <RequireAuth><NewReport /></RequireAuth>,
});

const MAX_IMAGE_SIZE_MB = 0.8;

async function imageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX_W = 800;
      const scale = img.width > MAX_W ? MAX_W / img.width : 1;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.75));
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
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // Validation schema uses translated messages
  const schema = z.object({
    incident_type: z.string().min(1, t("chooseIncidentType")),
    description: z.string().trim().min(10, t("descMin")).max(2000),
    incident_date: z.string().min(1, t("pickDate")),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f) {
      if (f.size / 1024 / 1024 > 5) {
        toast.error(t("imageTooLarge"));
        setFile(null); setPreview(null); e.target.value = ""; return;
      }
      setPreview(URL.createObjectURL(f));
    } else {
      setPreview(null);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      incident_type: type,
      description: String(fd.get("description") ?? ""),
      incident_date: String(fd.get("incident_date") ?? ""),
      latitude: coords?.lat ?? NaN,
      longitude: coords?.lng ?? NaN,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);

    setBusy(true);
    try {
      let imageUrl: string | null = null;
      if (file) {
        imageUrl = await imageToBase64(file);
        if (Math.round((imageUrl.length * 3) / 4 / 1024) > MAX_IMAGE_SIZE_MB * 1024) {
          toast.error(t("imageCompressError"));
          setBusy(false); return;
        }
      }

      const lastSnap = await getDocs(query(collection(db, "blockchain_logs"), orderBy("block_index", "desc"), limit(1)));
      const previousHash = lastSnap.empty ? GENESIS_HASH : (lastSnap.docs[0].data().hash_value as string);

      // Always store the English value in Firestore for consistency
      const reportRef = await addDoc(collection(db, "reports"), {
        user_id: user.uid,
        incident_type: parsed.data.incident_type,   // English key
        description: parsed.data.description,
        image_url: imageUrl,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        incident_date: parsed.data.incident_date,
        status: "Pending",
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      const adminRolesSnap = await getDocs(collection(db, "user_role"));
      await Promise.all(
        adminRolesSnap.docs
          .filter((d) => { const r = d.data().roles; return (Array.isArray(r) ? r : [r]).includes("admin"); })
          .map((d) => addDoc(collection(db, "notifications"), {
            user_id: d.id,
            message: `New report: "${parsed.data.incident_type}" — ${parsed.data.description.slice(0, 60)}${parsed.data.description.length > 60 ? "…" : ""}`,
            read: false, created_at: serverTimestamp(),
          }))
      );

      const payload = {
        report_id: reportRef.id, user_id: user.uid,
        incident_type: parsed.data.incident_type, description: parsed.data.description,
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
                        {lang === "tl" && (
                          <span className="ml-1.5 text-xs text-slate-400">({inc.en})</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Show both labels when a type is selected */}
                {type && (
                  <p className="mt-1.5 text-xs text-slate-500">
                    {lang === "tl"
                      ? `EN: ${incidentLabel(type)} · TL: ${INCIDENT_TYPES.find(i => i.value === type)?.tl}`
                      : `TL: ${INCIDENT_TYPES.find(i => i.value === type)?.tl}`}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="incident_date" className="text-slate-700 font-medium">{t("dateOfIncident")}</Label>
                <Input
                  id="incident_date" name="incident_date" type="date" required
                  max={new Date().toISOString().slice(0, 10)}
                  className="mt-1 border-slate-200 focus:border-blue-400 focus:ring-blue-400/20"
                />
              </div>
            </div>
          </div>

          {/* Step 2 — Description */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
            <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white text-xs flex items-center justify-center font-bold">2</span>
              {t("description")}
            </h2>
            <Textarea
              id="description" name="description" rows={5} required maxLength={2000}
              placeholder={t("describeWhat")}
              className="border-slate-200 focus:border-blue-400 focus:ring-blue-400/20 resize-none"
            />
          </div>

          {/* Step 3 — Evidence photo */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
            <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white text-xs flex items-center justify-center font-bold">3</span>
              {t("evidencePhoto")} <span className="text-slate-400 font-normal text-sm">{t("optional")}</span>
            </h2>
            <Input
              id="image" type="file" accept="image/*" onChange={handleFileChange}
              className="border-slate-200 file:bg-gradient-to-r file:from-blue-500 file:to-cyan-500 file:text-white file:border-0 file:rounded-lg file:px-3 file:py-1 file:text-xs file:font-semibold hover:file:from-blue-400 hover:file:to-cyan-400 file:transition-all"
            />
            {preview && (
              <img src={preview} alt="preview" className="mt-3 h-36 rounded-xl border border-slate-200 object-cover shadow-sm" />
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
          <Button
            type="submit" disabled={busy} size="lg"
            className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white border-0 shadow-lg shadow-blue-500/30 hover:shadow-blue-400/40 hover:scale-[1.01] transition-all duration-200 text-base font-semibold"
          >
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
