import { useEffect, useState, useCallback, useRef } from "react";
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
import { playNotificationChime, playAlertBeep, playReadPop } from "@/lib/sounds";

export interface Notification {
  id: string;
  message: string;
  read: boolean;
  created_at: string;
}

export function useNotifications() {
  const { user, isAdmin } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Track IDs we've already seen so we only play sound for genuinely new ones
  const seenIds = useRef<Set<string>>(new Set());
  // Skip sound on the very first load (page refresh shouldn't beep)
  const initialLoad = useRef(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "notifications"),
      where("user_id", "==", user.uid),
      limit(50),
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

      if (initialLoad.current) {
        // Populate seenIds on first load — no sound
        sorted.forEach((n) => seenIds.current.add(n.id));
        initialLoad.current = false;
      } else {
        // Find genuinely new unread notifications
        const newUnread = sorted.filter(
          (n) => !n.read && !seenIds.current.has(n.id),
        );

        if (newUnread.length > 0) {
          newUnread.forEach((n) => seenIds.current.add(n.id));

          // Admins get the urgent alert beep for new reports
          // Regular users get the soft chime for status updates
          const isNewReport = newUnread.some((n) =>
            n.message.toLowerCase().startsWith("new report"),
          );

          if (isAdmin && isNewReport) {
            playAlertBeep();
          } else {
            playNotificationChime();
          }
        }
      }

      setNotifications(sorted);
    });

    return unsub;
  }, [user, isAdmin]);

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    playReadPop();
    await updateDoc(doc(db, "notifications", id), { read: true });
  }, []);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    playReadPop();
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
