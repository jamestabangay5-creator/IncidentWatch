import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import { useAuth } from "@/hooks/useAuth";
import { RequireAuth } from "@/components/RequireAuth";
import { MapPicker } from "@/components/MapPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildBlock, GENESIS_HASH } from "@/lib/blockchain";

export const Route = createFileRoute("/report/new")({
  head: () => ({ meta: [{ title: "Submit Report — SafeTrace" }] }),
  component: () => (
    <RequireAuth>
      <NewReport />
    </RequireAuth>
  ),
});

const INCIDENT_TYPES = [
  "Theft",
  "Vandalism",
  "Assault",
  "Traffic accident",
  "Fire",
  "Suspicious activity",
  "Public disturbance",
  "Environmental hazard",
  "Other",
];

const MAX_IMAGE_SIZE_MB = 0.8; // keep Firestore doc under 1MB limit

const schema = z.object({
  incident_type: z.string().min(1, "Choose an incident type"),
  description: z.string().trim().min(10, "Description must be at least 10 characters").max(2000),
  incident_date: z.string().min(1, "Pick a date"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

/** Resize + convert image file to a base64 data URL (JPEG, max 800px wide). */
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
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.75));
    };
    img.onerror = reject;
    img.src = url;
  });
}

function NewReport() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [type, setType] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f) {
      const sizeMB = f.size / 1024 / 1024;
      if (sizeMB > 5) {
        toast.error("Image must be under 5 MB");
        setFile(null);
        setPreview(null);
        e.target.value = "";
        return;
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
    if (!parsed.success) {
      return toast.error(parsed.error.issues[0].message);
    }

    setBusy(true);
    try {
      // 1. Convert image to base64 (avoids Firebase Storage CORS entirely)
      let imageUrl: string | null = null;
      if (file) {
        imageUrl = await imageToBase64(file);
        const sizeKB = Math.round((imageUrl.length * 3) / 4 / 1024);
        if (sizeKB > MAX_IMAGE_SIZE_MB * 1024) {
          toast.error("Image is too large after compression. Please use a smaller image.");
          setBusy(false);
          return;
        }
      }

      // 2. Fetch last blockchain hash for chain integrity
      const lastSnap = await getDocs(
        query(collection(db, "blockchain_logs"), orderBy("block_index", "desc"), limit(1)),
      );
      const previousHash = lastSnap.empty
        ? GENESIS_HASH
        : (lastSnap.docs[0].data().hash_value as string);

      // 3. Insert report
      const reportRef = await addDoc(collection(db, "reports"), {
        user_id: user.uid,
        incident_type: parsed.data.incident_type,
        description: parsed.data.description,
        image_url: imageUrl,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        incident_date: parsed.data.incident_date,
        status: "Pending",
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      // 3b. Notify all admins about the new report
      const adminRolesSnap = await getDocs(collection(db, "user_role"));
      const adminNotifs = adminRolesSnap.docs
        .filter((d) => {
          const raw = d.data().roles;
          const roles: string[] = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];
          return roles.includes("admin");
        })
        .map((d) =>
          addDoc(collection(db, "notifications"), {
            user_id: d.id,
            message: `New report submitted: "${parsed.data.incident_type}" — ${parsed.data.description.slice(0, 60)}${parsed.data.description.length > 60 ? "…" : ""}`,
            read: false,
            created_at: serverTimestamp(),
          }),
        );
      await Promise.all(adminNotifs);

      // 4. Build + store blockchain block
      const payload = {
        report_id: reportRef.id,
        user_id: user.uid,
        incident_type: parsed.data.incident_type,
        description: parsed.data.description,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        incident_date: parsed.data.incident_date,
        created_at: new Date().toISOString(),
      };
      const { dataHash, hashValue } = await buildBlock(payload, previousHash);

      const nextIndex = lastSnap.empty
        ? 0
        : (lastSnap.docs[0].data().block_index as number) + 1;

      await addDoc(collection(db, "blockchain_logs"), {
        report_id: reportRef.id,
        block_index: nextIndex,
        previous_hash: previousHash,
        data_hash: dataHash,
        hash_value: hashValue,
        payload,
        created_at: serverTimestamp(),
      });

      toast.success("Report submitted and sealed in blockchain");
      navigate({ to: "/reports" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight">Submit incident report</h1>
      <p className="text-muted-foreground mt-1">
        Your report will be hashed (SHA-256) and chained to the previous record for tamper-evidence.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5 bg-card border border-border rounded-xl p-6">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Incident type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue placeholder="Choose..." /></SelectTrigger>
              <SelectContent>
                {INCIDENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="incident_date">Date of incident</Label>
            <Input
              id="incident_date"
              name="incident_date"
              type="date"
              required
              max={new Date().toISOString().slice(0, 10)}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            rows={5}
            required
            maxLength={2000}
            placeholder="Describe what happened…"
          />
        </div>

        <div>
          <Label htmlFor="image">Attach image (optional, max 5 MB)</Label>
          <Input
            id="image"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
          />
          {preview && (
            <img
              src={preview}
              alt="preview"
              className="mt-2 h-32 rounded-lg border border-border object-cover"
            />
          )}
        </div>

        <div>
          <Label>Location (click on the map)</Label>
          {/* MapPicker uses a plain div, not a form, to avoid nested form issue */}
          <MapPicker value={coords} onChange={setCoords} />
          {coords && (
            <p className="text-xs text-muted-foreground mt-1">
              Selected: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </p>
          )}
        </div>

        <Button type="submit" disabled={busy} size="lg" className="w-full">
          {busy ? "Sealing on blockchain…" : "Submit report"}
        </Button>
      </form>
    </div>
  );
}
