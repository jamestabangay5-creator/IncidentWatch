import { useEffect, useState, useCallback } from "react";
import {
  collection,
  query,
  where,
  limit,
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
  getDocs,
} from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Notification {
  id: string;
  message: string;
  read: boolean;
  created_at: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // ── realtime subscription (replaces both load + supabase channel) ─────────
  useEffect(() => {
    if (!user) return;

    // Query by user_id only — no composite index needed.
    // Limit + client-side sort to get the 30 most recent.
    const q = query(
      collection(db, "notifications"),
      where("user_id", "==", user.uid),
      limit(50), // fetch a bit more so client-side sort gives accurate top 30
    );

    const unsub = onSnapshot(q, (snap) => {
      const sorted = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            message: data.message as string,
            read: data.read as boolean,
            created_at: data.created_at?.toDate?.()?.toISOString() ?? new Date().toISOString(),
          };
        })
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 30);
      setNotifications(sorted);
    });

    return unsub;
  }, [user]);

  const markRead = useCallback(
    async (id: string) => {
      // Optimistic
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      await updateDoc(doc(db, "notifications", id), { read: true });
    },
    [],
  );

  const markAllRead = useCallback(async () => {
    if (!user) return;
    // Optimistic
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    // Batch update all unread
    const q = query(
      collection(db, "notifications"),
      where("user_id", "==", user.uid),
      where("read", "==", false),
    );
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
    await batch.commit();
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, markRead, markAllRead };
}
