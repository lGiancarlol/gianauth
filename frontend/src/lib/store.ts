import { create } from "zustand";
import api from "./api";

// ── Types ────────────────────────────────────────────────────────────────────

export interface Product {
  id: number;
  name: string;
  slug: string;
  active: boolean;
  createdAt: string;
}

export interface License {
  id: number;
  key: string;
  status: string;
  productId: number;
  resellerId: number | null;
  expiresAt: string | null;
  claimedAt: string | null;
}

export interface Request {
  id: number;
  type: string;
  status: string;
  licenseId: number | null;
  resellerId: number;
  createdAt: string;
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  userId: number;
}

// ── Seen event IDs (idempotency) ─────────────────────────────────────────────

const seenEvents = new Set<string>();
export function isNewEvent(eventId: string): boolean {
  if (!eventId || seenEvents.has(eventId)) return false;
  seenEvents.add(eventId);
  // Prevent unbounded growth
  if (seenEvents.size > 500) {
    const first = seenEvents.values().next().value;
    if (first) seenEvents.delete(first);
  }
  return true;
}

// ── Products Store ────────────────────────────────────────────────────────────

interface ProductsState {
  products: Product[];
  setProducts: (p: Product[]) => void;
  upsertProduct: (p: Product) => void;
  setActive: (id: number, active: boolean) => void;
}

export const useProductsStore = create<ProductsState>((set) => ({
  products: [],
  setProducts: (products) => set({ products }),
  upsertProduct: (p) =>
    set((s) => {
      const exists = s.products.find((x) => x.id === p.id);
      return {
        products: exists
          ? s.products.map((x) => (x.id === p.id ? { ...x, ...p } : x))
          : [p, ...s.products],
      };
    }),
  setActive: (id, active) =>
    set((s) => ({ products: s.products.map((p) => (p.id === id ? { ...p, active } : p)) })),
}));

// ── Licenses Store ────────────────────────────────────────────────────────────

interface LicensesState {
  licenses: License[];
  setLicenses: (l: License[]) => void;
  upsertLicense: (l: License) => void;
  removeLicense: (id: number) => void;
  setLicenseStatus: (id: number, status: string) => void;
}

export const useLicensesStore = create<LicensesState>((set) => ({
  licenses: [],
  setLicenses: (licenses) => set({ licenses }),
  upsertLicense: (l) =>
    set((s) => {
      const exists = s.licenses.find((x) => x.id === l.id);
      return {
        licenses: exists
          ? s.licenses.map((x) => (x.id === l.id ? { ...x, ...l } : x))
          : [l, ...s.licenses],
      };
    }),
  removeLicense: (id) => set((s) => ({ licenses: s.licenses.filter((l) => l.id !== id) })),
  setLicenseStatus: (id, status) =>
    set((s) => ({ licenses: s.licenses.map((l) => (l.id === id ? { ...l, status } : l)) })),
}));

// ── Requests Store ────────────────────────────────────────────────────────────

interface RequestsState {
  requests: Request[];
  setRequests: (r: Request[]) => void;
  upsertRequest: (r: Request) => void;
  setRequestStatus: (id: number, status: string) => void;
}

export const useRequestsStore = create<RequestsState>((set) => ({
  requests: [],
  setRequests: (requests) => set({ requests }),
  upsertRequest: (r) =>
    set((s) => {
      const exists = s.requests.find((x) => x.id === r.id);
      return {
        requests: exists
          ? s.requests.map((x) => (x.id === r.id ? { ...x, ...r } : x))
          : [r, ...s.requests],
      };
    }),
  setRequestStatus: (id, status) =>
    set((s) => ({ requests: s.requests.map((r) => (r.id === id ? { ...r, status } : r)) })),
}));

// ── Notifications Store ───────────────────────────────────────────────────────

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  setNotifications: (n: Notification[], unread: number) => void;
  addNotification: (n: Notification) => void;
  markRead: (id: number) => void;
  markAllRead: () => void;
}

export const useNotificationsStore = create<NotificationsState>((set) => ({
  notifications: [],
  unreadCount: 0,
  setNotifications: (notifications, unreadCount) => set({ notifications, unreadCount }),
  addNotification: (n) =>
    set((s) => ({
      notifications: [n, ...s.notifications].slice(0, 50),
      unreadCount: s.unreadCount + 1,
    })),
  markRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      unreadCount: Math.max(0, s.unreadCount - 1),
    })),
  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    })),
}));

// ── Owner Profile Store ──────────────────────────────────────────────────────

export interface SocialLink {
  id:    string; // stable UUID — used as React key, never index
  type:  "discord" | "whatsapp" | "github" | "telegram" | "website" | "custom";
  label: string;
  url:   string;
}

export interface OwnerProfile {
  displayName: string | null;
  panelName:   string | null;
  avatarUrl:   string | null;
  accentColor: string | null;
  socialLinks: SocialLink[];
}

interface OwnerProfileState {
  profile: OwnerProfile | null;
  setProfile: (p: OwnerProfile) => void;
  patchProfile: (p: Partial<OwnerProfile>) => void;
}

export const useOwnerProfileStore = create<OwnerProfileState>((set) => ({
  profile: null,
  setProfile:   (profile) => set({ profile }),
  patchProfile: (p) => set((s) => ({ profile: s.profile ? { ...s.profile, ...p } : (p as OwnerProfile) })),
}));

// ── Sync ──────────────────────────────────────────────────────────────────────

export async function syncState() {
  try {
    const { data } = await api.get("/sync/state");
    useProductsStore.getState().setProducts(data.products ?? []);
    useLicensesStore.getState().setLicenses(data.licenses ?? []);
    useRequestsStore.getState().setRequests(data.requests ?? []);
    useNotificationsStore.getState().setNotifications(
      data.notifications ?? [],
      (data.notifications ?? []).filter((n: Notification) => !n.isRead).length
    );
  } catch {}
}
