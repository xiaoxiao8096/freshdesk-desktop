/**
 * 设计提醒：雾面硬件主义。以桌面空间关系组织内容，所有反馈要像精密设备一样安静、迅速、可信。
 */
import { createElement, useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import { searchVirtualFiles } from "@/lib/finderSearch";
import { appendNavigationRoute, getNavigationStep, synchronizeGuestHistoryStep } from "@/lib/browserNavigation";
import { resolveBrowserVideo, type BrowserVideoSource } from "@/lib/browserVideo";
import { postTikTokPlayerCommand, type TikTokPlayerCommand } from "@/lib/tiktokPlayer";
import { HlsVideoPlayer } from "@/components/HlsVideoPlayer";
import { NativeVideoPlayer } from "@/components/NativeVideoPlayer";
import { bringWindowToFront, clampRestoredWindowBounds, closeAllWindows, closeWindowById, minimizeAllWindows, nextVisibleWindowAfterAction, orderWindowsByZIndex, sanitizeRestoredWindows, topVisibleWindow } from "@/lib/windowState";
import { recordRecentVideo } from "@/lib/recentVideos";
import { loadStoredSnapshot } from "@/lib/desktopSnapshot";
import { createDesktopBackup, desktopBackupFilename, parseDesktopBackup } from "@/lib/desktopBackup";
import { desktopBrowserOpenMode, desktopSearchUrl, shouldAutoOpenReader } from "@/lib/desktopBrowserMode";
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Bell,
  Bluetooth,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Cloud,
  CloudSun,
  Command,
  Compass,
  Download,
  Droplets,
  FilePlus2,
  FilePenLine,
  FileText,
  Folder,
  FolderOpen,
  Gauge,
  Globe2,
  Grid2X2,
  Headphones,
  History,
  Image,
  LayoutGrid,
  ListTodo,
  MapPin,
  Maximize2,
  MessageSquareText,
  Mic2,
  Minimize2,
  Moon,
  MoreHorizontal,
  Music2,
  Pause,
  Palette,
  Pencil,
  Play,
  Pin,
  Plus,
  RotateCw,
  Search,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Sun,
  TerminalSquare,
  Trash2,
  Volume2,
  Wifi,
  Wind,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

type AppName = "finder" | "music" | "notes" | "photos" | "settings" | "terminal" | "browser" | "weather" | "calendar" | "reminders" | "trash" | "editor";

type WindowBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type SnapTarget = "left" | "right" | "top-left" | "top-right" | "bottom-left" | "bottom-right";

type BrowserMode = "web" | "search" | "reader" | "media" | "video";

type BrowserRoute = {
  url: string;
  address?: string;
  title?: string;
  mode: Exclude<BrowserMode, "media">;
  videoSource?: BrowserVideoSource;
};

type BrowserTab = {
  id: string;
  title: string;
  address: string;
  url: string;
  history: BrowserRoute[];
  historyIndex: number;
  loading: boolean;
  reloadNonce: number;
  pinned: boolean;
  groupId?: string;
  mode?: BrowserMode;
  searchQuery?: string;
  searchResults?: BrowserSearchResult[];
  searchSummary?: string;
  searchError?: string;
  mediaItems?: BrowserMediaItem[];
  mediaIndex?: number;
  readerOriginUrl?: string;
  videoSource?: BrowserVideoSource;
};

type BrowserMediaItem = {
  src: string;
  alt: string;
};

type BrowserSearchResult = {
  title: string;
  url: string;
  snippet: string;
  source?: string;
};

type BrowserTabGroup = {
  id: string;
  title: string;
  color: string;
  collapsed: boolean;
};

type BrowserBookmark = {
  id: string;
  title: string;
  url: string;
};

type BrowserHistoryEntry = {
  id: string;
  title: string;
  address: string;
  visitedAt: string;
  mode: "web" | "search" | "reader" | "video";
};

type BrowserDownload = {
  id: string;
  title: string;
  url: string;
  createdAt: string;
  status: "准备就绪" | "下载中" | "已完成" | "已保存" | "已取消" | "下载失败";
  progress?: number;
  receivedBytes?: number;
  totalBytes?: number;
  native?: boolean;
  path?: string;
};

type RecentVideo = {
  id: string;
  title: string;
  url: string;
  provider: string;
  watchedAt: string;
};

type VideoPlaybackReport = {
  id: string;
  url: string;
  title: string;
  provider: string;
  reportedAt: string;
};

type NoteDocument = {
  id: string;
  title: string;
  body: string;
  updated: string;
};

type PhotoItem = {
  id: string;
  src: string;
  alt: string;
  title: string;
  subtitle: string;
};

type WallpaperItem = {
  id: string;
  title: string;
  src: string;
};

type VirtualFileSystem = {
  directories: string[];
  files: string[];
};

type VirtualTrashItem = {
  id: string;
  path: string;
  type: "file";
  deletedAt: string;
};

type LiveWeather = WeatherLocation & {
  latitude: number;
  longitude: number;
  timezone: string;
  apparent: number;
  source: "live";
};

type CalendarEntry = {
  id: string;
  title: string;
  time: string;
  color: string;
};

type ReminderItem = {
  id: string;
  title: string;
  done: boolean;
};

type WeatherLocation = {
  id: string;
  city: string;
  temp: number;
  condition: string;
  high: number;
  low: number;
  humidity: number;
  wind: string;
  forecast: { label: string; icon: "sun" | "cloud" | "partly"; temp: number }[];
};

type AppWindow = {
  id: AppName;
  minimized: boolean;
  zIndex: number;
  bounds: WindowBounds;
  maximized: boolean;
  restoreBounds?: WindowBounds;
};

type DesktopSnapshot = Partial<{
  setupComplete: boolean;
  windows: AppWindow[];
  activeWallpaperId: string;
  customWallpapers: WallpaperItem[];
  notes: NoteDocument[];
  activeNoteId: string;
  virtualFileSystem: VirtualFileSystem;
  fileContents: Record<string, string>;
  trashItems: VirtualTrashItem[];
  finderPath: string;
  systemAppearance: "light" | "dark";
  volume: number;
  currentTrack: number;
  browserTabs: BrowserTab[];
  activeBrowserTabId: string;
  browserTabGroups: BrowserTabGroup[];
  bookmarks: BrowserBookmark[];
  browserHistoryEntries: BrowserHistoryEntry[];
  browserDownloads: BrowserDownload[];
  recentVideos: RecentVideo[];
  videoPlaybackReports: VideoPlaybackReport[];
  editorPath: string | null;
  editorDraft: string;
  calendarEntries: CalendarEntry[];
  reminders: ReminderItem[];
  weatherUnit: "c" | "f";
}>;

type FinderContextMenu = { path: string; x: number; y: number };

const WALLPAPER = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663889058694/CSGmuRUTIunwHfCs.jpg";
const ALBUM_ORBIT = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663889058694/bBpyNynCyFdirmaS.jpg";
const ALBUM_TIDE = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663889058694/ZktgRbuptPkxDeyE.jpg";
const BRAND_MARK = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663889058694/jzobKtTVWfvcCDnT.png";
const MUSIC = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663889058694/isgCvGDbyPDBkAbk.mp3";
const MUSIC_MORNING = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663889058694/gyXFNqZPUTWhFjbH.mp3";
const MUSIC_NIGHT = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663889058694/PXVhiQTEYAYLaCFp.mp3";
const WALLPAPER_SOLAR = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663889058694/kNekPbkXRhycmlRX.jpg";
const WALLPAPER_ALPINE = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663889058694/HSiMpecJevoxAyVb.jpg";

const wallpapers: WallpaperItem[] = [
  { id: "aurora", title: "晨雾极光", src: WALLPAPER },
  { id: "solar", title: "日光漂移", src: WALLPAPER_SOLAR },
  { id: "alpine", title: "高山云层", src: WALLPAPER_ALPINE },
];

const photoItems: PhotoItem[] = [
  { id: "aurora", src: WALLPAPER, alt: "晨雾极光壁纸", title: "晨雾极光", subtitle: "桌面收藏 · 今天" },
  { id: "orbit", src: ALBUM_ORBIT, alt: "蓝色球体构图", title: "轨道切面", subtitle: "声音与形状" },
  { id: "tide", src: ALBUM_TIDE, alt: "丝绸色彩构图", title: "银色潮汐", subtitle: "材质研究" },
  { id: "solar", src: WALLPAPER_SOLAR, alt: "日光漂移壁纸", title: "日光漂移", subtitle: "新壁纸 · 原创" },
  { id: "alpine", src: WALLPAPER_ALPINE, alt: "高山云层壁纸", title: "高山云层", subtitle: "新壁纸 · 原创" },
];

const VIRTUAL_HOME = "/Users/freshdesk";
const DESKTOP_STATE_KEY = "freshdesk.desktop-state.v2";
const initialVirtualFileSystem: VirtualFileSystem = {
  directories: [VIRTUAL_HOME, `${VIRTUAL_HOME}/Desktop`, `${VIRTUAL_HOME}/Documents`, `${VIRTUAL_HOME}/Documents/Projects`, `${VIRTUAL_HOME}/Downloads`, `${VIRTUAL_HOME}/Music`, `${VIRTUAL_HOME}/Pictures`],
  files: [`${VIRTUAL_HOME}/README.md`, `${VIRTUAL_HOME}/Desktop/开机笔记.txt`, `${VIRTUAL_HOME}/Documents/工作流.md`, `${VIRTUAL_HOME}/Pictures/晨雾极光.jpg`],
};
const initialFileContents: Record<string, string> = {
  [`${VIRTUAL_HOME}/README.md`]: "# Freshdesk Drive\n\n这是桌面中的虚拟文件系统。双击文本文件即可在文本编辑器中打开。\n\n- 可编辑并保存\n- 可重命名\n- 可拖到回收站\n- 可从回收站恢复",
  [`${VIRTUAL_HOME}/Desktop/开机笔记.txt`]: "今天的桌面已经准备好。\n\n打开一个应用，或者写下一条新的想法。",
  [`${VIRTUAL_HOME}/Documents/工作流.md`]: "# 工作流\n\n1. 整理今天的任务\n2. 保存网页阅读内容\n3. 在傍晚前回顾便笺",
};

function loadDesktopSnapshot(): DesktopSnapshot | null {
  return loadStoredSnapshot<DesktopSnapshot>(typeof window === "undefined" ? null : window.localStorage, DESKTOP_STATE_KEY);
}

const weatherLocations: WeatherLocation[] = [
  { id: "shanghai", city: "上海", temp: 26, condition: "局部多云", high: 29, low: 23, humidity: 74, wind: "东南风 12 km/h", forecast: [{ label: "现在", icon: "partly", temp: 26 }, { label: "12 时", icon: "sun", temp: 28 }, { label: "15 时", icon: "partly", temp: 29 }, { label: "18 时", icon: "cloud", temp: 27 }] },
  { id: "beijing", city: "北京", temp: 22, condition: "晴朗", high: 25, low: 16, humidity: 42, wind: "西北风 9 km/h", forecast: [{ label: "现在", icon: "sun", temp: 22 }, { label: "12 时", icon: "sun", temp: 24 }, { label: "15 时", icon: "partly", temp: 25 }, { label: "18 时", icon: "cloud", temp: 21 }] },
  { id: "chengdu", city: "成都", temp: 24, condition: "阴有微雨", high: 25, low: 20, humidity: 83, wind: "北风 7 km/h", forecast: [{ label: "现在", icon: "cloud", temp: 24 }, { label: "12 时", icon: "cloud", temp: 25 }, { label: "15 时", icon: "partly", temp: 24 }, { label: "18 时", icon: "cloud", temp: 22 }] },
];

function virtualPath(input: string, cwd: string) {
  const raw = input.trim();
  if (!raw || raw === "~") return VIRTUAL_HOME;
  const expanded = raw.startsWith("~") ? `${VIRTUAL_HOME}${raw.slice(1)}` : raw.startsWith("/") ? raw : `${cwd}/${raw}`;
  const segments: string[] = [];
  expanded.split("/").forEach((segment) => {
    if (!segment || segment === ".") return;
    if (segment === "..") segments.pop();
    else segments.push(segment);
  });
  return `/${segments.join("/")}`;
}

function virtualParent(path: string) {
  const parts = path.split("/").filter(Boolean);
  parts.pop();
  return `/${parts.join("/")}` || "/";
}

function virtualName(path: string) {
  return path.split("/").filter(Boolean).at(-1) ?? path;
}

function displayVirtualPath(path: string) {
  return path === VIRTUAL_HOME ? "~" : path.replace(VIRTUAL_HOME, "~");
}

function virtualDirectoryEntries(fileSystem: VirtualFileSystem, cwd: string) {
  const folders = fileSystem.directories.filter((path) => path !== cwd && virtualParent(path) === cwd).map((path) => ({ name: virtualName(path), type: "directory" as const }));
  const files = fileSystem.files.filter((path) => virtualParent(path) === cwd).map((path) => ({ name: virtualName(path), type: "file" as const }));
  return [...folders.sort((a, b) => a.name.localeCompare(b.name)), ...files.sort((a, b) => a.name.localeCompare(b.name))];
}

const appMeta: Record<AppName, { label: string; color: string; icon: typeof FolderOpen }> = {
  finder: { label: "文件", color: "#2d8cff", icon: FolderOpen },
  music: { label: "音乐", color: "#ff5a6d", icon: Music2 },
  notes: { label: "便笺", color: "#ffc045", icon: MessageSquareText },
  photos: { label: "照片", color: "#f07c8c", icon: Image },
  settings: { label: "设置", color: "#9aa5b8", icon: Settings2 },
  browser: { label: "浏览器", color: "#6fa8ff", icon: Globe2 },
  terminal: { label: "终端", color: "#2f3742", icon: TerminalSquare },
  weather: { label: "天气", color: "#4c9eff", icon: CloudSun },
  calendar: { label: "日历", color: "#f35f67", icon: CalendarDays },
  reminders: { label: "提醒", color: "#ff9d4e", icon: ListTodo },
  trash: { label: "回收站", color: "#4b5361", icon: Trash2 },
  editor: { label: "文本编辑", color: "#7d8da6", icon: FilePenLine },
};

const defaultWindowBounds: Record<AppName, WindowBounds> = {
  finder: { x: 280, y: 72, width: 730, height: 535 },
  music: { x: 180, y: 47, width: 900, height: 625 },
  notes: { x: 390, y: 85, width: 658, height: 510 },
  photos: { x: 250, y: 57, width: 770, height: 548 },
  settings: { x: 330, y: 90, width: 680, height: 470 },
  browser: { x: 160, y: 54, width: 920, height: 590 },
  terminal: { x: 450, y: 105, width: 560, height: 350 },
  weather: { x: 360, y: 78, width: 620, height: 500 },
  calendar: { x: 330, y: 74, width: 680, height: 505 },
  reminders: { x: 420, y: 92, width: 570, height: 455 },
  trash: { x: 430, y: 112, width: 540, height: 420 },
  editor: { x: 380, y: 82, width: 680, height: 520 },
};

function formatDuration(value: number) {
  if (!Number.isFinite(value)) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function labelFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "") || "新标签页";
  } catch {
    return url || "新标签页";
  }
}

function normalizeBrowserHistory(history: unknown, fallbackUrl: string, fallbackMode: BrowserRoute["mode"] = "web") {
  const candidates = Array.isArray(history) ? history : [];
  const routes = candidates.flatMap((entry): BrowserRoute[] => {
    if (typeof entry === "string") return [{ url: entry, address: entry === "about:blank" ? "" : entry, title: labelFromUrl(entry), mode: entry === "about:blank" ? "search" : "web" }];
    if (!entry || typeof entry !== "object" || !("url" in entry) || typeof entry.url !== "string") return [];
    const candidate = entry as Partial<BrowserRoute>;
    const url = entry.url;
    const mode = candidate.mode === "search" || candidate.mode === "reader" || candidate.mode === "web" || candidate.mode === "video" ? candidate.mode : fallbackMode;
    return [{ url, address: candidate.address ?? url, title: candidate.title ?? labelFromUrl(url), mode }];
  });
  return routes.length ? routes : [{ url: fallbackUrl, address: fallbackUrl === "about:blank" ? "" : fallbackUrl, title: labelFromUrl(fallbackUrl), mode: fallbackUrl === "about:blank" ? "search" : fallbackMode }];
}

function clampRestoredWindow(windowItem: AppWindow): AppWindow {
  return { ...windowItem, bounds: clampRestoredWindowBounds(windowItem.bounds, window.innerWidth, window.innerHeight), restoreBounds: windowItem.restoreBounds ? { ...windowItem.restoreBounds } : undefined };
}

function detectSnapTarget(clientX: number, clientY: number, viewportWidth: number, viewportHeight: number): SnapTarget | null {
  const edge = 54;
  const corner = 112;
  if (clientX < edge) {
    if (clientY < corner) return "top-left";
    if (clientY > viewportHeight - corner) return "bottom-left";
    return "left";
  }
  if (clientX > viewportWidth - edge) {
    if (clientY < corner) return "top-right";
    if (clientY > viewportHeight - corner) return "bottom-right";
    return "right";
  }
  return null;
}

function getSnapBounds(target: SnapTarget): WindowBounds {
  const margin = 8;
  const gutter = 12;
  const top = 30;
  const usableWidth = window.innerWidth - margin * 2;
  const usableHeight = window.innerHeight - top - 12;
  const halfWidth = (usableWidth - gutter) / 2;
  const halfHeight = (usableHeight - gutter) / 2;
  if (target === "left") return { x: margin, y: top, width: halfWidth, height: usableHeight };
  if (target === "right") return { x: margin + halfWidth + gutter, y: top, width: halfWidth, height: usableHeight };
  if (target === "top-left") return { x: margin, y: top, width: halfWidth, height: halfHeight };
  if (target === "top-right") return { x: margin + halfWidth + gutter, y: top, width: halfWidth, height: halfHeight };
  if (target === "bottom-left") return { x: margin, y: top + halfHeight + gutter, width: halfWidth, height: halfHeight };
  return { x: margin + halfWidth + gutter, y: top + halfHeight + gutter, width: halfWidth, height: halfHeight };
}

function snapLabel(target: SnapTarget) {
  return ({ left: "左侧分屏", right: "右侧分屏", "top-left": "左上象限", "top-right": "右上象限", "bottom-left": "左下象限", "bottom-right": "右下象限" } as Record<SnapTarget, string>)[target];
}

function WindowChrome({
  title,
  appWindow,
  onClose,
  onMinimize,
  onFocus,
  onMaximize,
  onBoundsChange,
  onSnapPreviewChange,
  onSnap,
  children,
  className = "",
}: {
  title: string;
  appWindow: AppWindow;
  onClose: () => void;
  onMinimize: () => void;
  onFocus: () => void;
  onMaximize: () => void;
  onBoundsChange: (bounds: WindowBounds) => void;
  onSnapPreviewChange?: (target: SnapTarget | null) => void;
  onSnap?: (target: SnapTarget) => void;
  children: ReactNode;
  className?: string;
}) {
  const interactionRef = useRef<{ pointerId: number; mode: "drag" | "resize"; direction?: string; startX: number; startY: number; bounds: WindowBounds } | null>(null);
  const minWidth = 360;
  const minHeight = 240;

  const beginInteraction = (event: ReactPointerEvent<HTMLElement>, mode: "drag" | "resize", direction?: string) => {
    if (appWindow.maximized) return;
    event.preventDefault();
    event.stopPropagation();
    onFocus();
    interactionRef.current = { pointerId: event.pointerId, mode, direction, startX: event.clientX, startY: event.clientY, bounds: appWindow.bounds };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveInteraction = (event: ReactPointerEvent<HTMLElement>) => {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    const dx = event.clientX - interaction.startX;
    const dy = event.clientY - interaction.startY;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const base = interaction.bounds;
    let next: WindowBounds = { ...base };

    if (interaction.mode === "drag") {
      next.x = Math.min(Math.max(8, base.x + dx), viewportWidth - 150);
      next.y = Math.min(Math.max(30, base.y + dy), viewportHeight - 105);
      onSnapPreviewChange?.(detectSnapTarget(event.clientX, event.clientY, viewportWidth, viewportHeight));
    } else {
      const direction = interaction.direction ?? "";
      if (direction.includes("right")) next.width = Math.min(Math.max(minWidth, base.width + dx), viewportWidth - base.x - 8);
      if (direction.includes("bottom")) next.height = Math.min(Math.max(minHeight, base.height + dy), viewportHeight - base.y - 12);
      if (direction.includes("left")) {
        const width = Math.min(Math.max(minWidth, base.width - dx), base.x + base.width - 8);
        next.x = base.x + base.width - width;
        next.width = width;
      }
      if (direction.includes("top")) {
        const height = Math.min(Math.max(minHeight, base.height - dy), base.y + base.height - 30);
        next.y = base.y + base.height - height;
        next.height = height;
      }
    }
    onBoundsChange(next);
  };

  const endInteraction = (event: ReactPointerEvent<HTMLElement>) => {
    const interaction = interactionRef.current;
    if (interaction?.pointerId !== event.pointerId) return;
    if (interaction.mode === "drag") {
      const target = detectSnapTarget(event.clientX, event.clientY, window.innerWidth, window.innerHeight);
      onSnapPreviewChange?.(null);
      if (target && onSnap) onSnap(target);
      if (target && !onSnap) onBoundsChange(getSnapBounds(target));
    }
    interactionRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <section
      className={`app-window ${className} ${appWindow.maximized ? "is-maximized" : ""}`}
      data-app-window={appWindow.id}
      style={{ left: appWindow.bounds.x, top: appWindow.bounds.y, width: appWindow.bounds.width, height: appWindow.bounds.height }}
      onMouseDown={onFocus}
      tabIndex={-1}
      aria-label={`${title} 窗口`}
    >
      <header
        className="window-chrome"
        onPointerDown={(event) => beginInteraction(event, "drag")}
        onPointerMove={moveInteraction}
        onPointerUp={endInteraction}
        onPointerCancel={endInteraction}
        onDoubleClick={onMaximize}
      >
        <div className="traffic-lights" aria-label="窗口控制" onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); }} onPointerUp={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
          <button type="button" className="traffic-light close" aria-label={`关闭${title}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onClose(); }}><X size={9} /></button>
          <button type="button" className="traffic-light minimize" aria-label={`最小化${title}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onMinimize(); }}><Minimize2 size={8} /></button>
          <button type="button" className="traffic-light expand" aria-label={`${appWindow.maximized ? "还原" : "最大化"}${title}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onMaximize(); }}><Maximize2 size={8} /></button>
        </div>
        <span className="window-title">{title}</span>
        <span className="window-chrome-spacer"><span>⌘⌥ ←→ · 1–4 分屏</span></span>
      </header>
      {children}
      {!appWindow.maximized && ["top", "right", "bottom", "left", "top-left", "top-right", "bottom-left", "bottom-right"].map((direction) => (
        <span
          className={`resize-handle resize-${direction}`}
          key={direction}
          onPointerDown={(event) => beginInteraction(event, "resize", direction)}
          onPointerMove={moveInteraction}
          onPointerUp={endInteraction}
          onPointerCancel={endInteraction}
          aria-hidden="true"
        />
      ))}
    </section>
  );
}

export default function Home() {
  const [restoredDesktopState] = useState<DesktopSnapshot | null>(() => loadDesktopSnapshot());
  const [setupComplete, setSetupComplete] = useState(() => {
    if (typeof restoredDesktopState?.setupComplete === "boolean") return restoredDesktopState.setupComplete;
    try { return window.localStorage.getItem("freshdesk.setup-complete") === "true"; } catch { return false; }
  });
  const [showSetupChoice, setShowSetupChoice] = useState(false);
  const [windows, setWindows] = useState<AppWindow[]>(() => sanitizeRestoredWindows(restoredDesktopState?.windows).map(clampRestoredWindow));
  const [activeWindowId, setActiveWindowId] = useState<AppName | null>(() => topVisibleWindow(sanitizeRestoredWindows(restoredDesktopState?.windows).map(clampRestoredWindow))?.id ?? null);
  const [activePanel, setActivePanel] = useState<"control" | "spotlight" | "calendar" | "about" | "windows" | null>(null);
  const [selectedDesktop, setSelectedDesktop] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [wifi, setWifi] = useState(true);
  const [bluetooth, setBluetooth] = useState(true);
  const [focus, setFocus] = useState(false);
  const [volume, setVolume] = useState(() => restoredDesktopState?.volume ?? 62);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(() => restoredDesktopState?.currentTrack ?? 0);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(150);
  const [activeWallpaperId, setActiveWallpaperId] = useState(() => restoredDesktopState?.activeWallpaperId ?? "aurora");
  const [customWallpapers, setCustomWallpapers] = useState<WallpaperItem[]>(() => restoredDesktopState?.customWallpapers ?? []);
  const [notes, setNotes] = useState<NoteDocument[]>(() => restoredDesktopState?.notes ?? [
    { id: "welcome-note", title: "新桌面的第一天", body: "今天先从一段安静的音乐开始。\n\n桌面已经准备好了。打开任意一个应用，看看这个空间会带你去哪里。", updated: "今天" },
    { id: "try-list", title: "要尝试的事", body: "- 换一张桌面壁纸\n- 新建一张便笺\n- 把喜欢的网页放进工作组", updated: "昨天" },
    { id: "future", title: "给未来的提醒", body: "留一点空白，给那些还没发生的好事。", updated: "8 月 14 日" },
  ]);
  const [activeNoteId, setActiveNoteId] = useState(() => restoredDesktopState?.activeNoteId ?? "welcome-note");
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [photoViewMode, setPhotoViewMode] = useState<"highlights" | "library">("highlights");
  const [terminalLines, setTerminalLines] = useState<string[]>([
    "Freshdesk Terminal · simulated environment",
    "输入 help 查看可用命令。",
  ]);
  const [terminalInput, setTerminalInput] = useState("");
  const [terminalCwd, setTerminalCwd] = useState(VIRTUAL_HOME);
  const [virtualFileSystem, setVirtualFileSystem] = useState<VirtualFileSystem>(() => restoredDesktopState?.virtualFileSystem ?? initialVirtualFileSystem);
  const [fileContents, setFileContents] = useState<Record<string, string>>(() => ({ ...initialFileContents, ...(restoredDesktopState?.fileContents ?? {}) }));
  const [finderPath, setFinderPath] = useState(() => restoredDesktopState?.finderPath ?? VIRTUAL_HOME);
  const [trashItems, setTrashItems] = useState<VirtualTrashItem[]>(() => restoredDesktopState?.trashItems ?? []);
  const [draggedFilePath, setDraggedFilePath] = useState<string | null>(null);
  const [systemAppearance, setSystemAppearance] = useState<"light" | "dark">(() => restoredDesktopState?.systemAppearance ?? "dark");
  const [snapPreview, setSnapPreview] = useState<SnapTarget | null>(null);
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [browserTabs, setBrowserTabs] = useState<BrowserTab[]>(() => restoredDesktopState?.browserTabs?.length ? restoredDesktopState.browserTabs.map((tab) => {
    const history = normalizeBrowserHistory(tab.history, tab.url, tab.mode === "search" ? "search" : tab.mode === "reader" ? "reader" : "web");
    return { ...tab, history, historyIndex: Math.min(Math.max(tab.historyIndex ?? history.length - 1, 0), history.length - 1), loading: false };
  }) : [
    { id: "welcome", title: "新标签页", address: "", url: "about:blank", history: [{ url: "about:blank", address: "", title: "新标签页", mode: "search" }], historyIndex: 0, loading: false, reloadNonce: 0, pinned: true, mode: "search" },
  ]);
  const [activeBrowserTabId, setActiveBrowserTabId] = useState(() => restoredDesktopState?.activeBrowserTabId ?? "welcome");
  const [browserTabGroups, setBrowserTabGroups] = useState<BrowserTabGroup[]>(() => restoredDesktopState?.browserTabGroups ?? []);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [bookmarks, setBookmarks] = useState<BrowserBookmark[]>(() => restoredDesktopState?.bookmarks ?? [
    { id: "freshdesk", title: "Freshdesk Desktop", url: "https://example.com" },
    { id: "web-platform", title: "Web 平台文档", url: "https://developer.mozilla.org" },
  ]);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [downloadsOpen, setDownloadsOpen] = useState(false);
  const [mediaZoom, setMediaZoom] = useState(100);
  const [mediaImageError, setMediaImageError] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [frameStatus, setFrameStatus] = useState<"idle" | "loading" | "loaded" | "restricted" | "error">("idle");
  const [browserFallbackNotice, setBrowserFallbackNotice] = useState("");
  const [desktopUpdateStatus, setDesktopUpdateStatus] = useState(() => window.freshdeskDesktop?.isElectron ? "正在等待更新检查…" : "网页版会随发布即时更新");
  const [desktopBackupStatus, setDesktopBackupStatus] = useState("数据仅保存在当前设备；可随时导出或创建备份。");
  const [readerLinkFilter, setReaderLinkFilter] = useState("");
  const [browserHistoryEntries, setBrowserHistoryEntries] = useState<BrowserHistoryEntry[]>(() => restoredDesktopState?.browserHistoryEntries ?? []);
  const [browserDownloads, setBrowserDownloads] = useState<BrowserDownload[]>(() => restoredDesktopState?.browserDownloads ?? []);
  const [recentVideos, setRecentVideos] = useState<RecentVideo[]>(() => restoredDesktopState?.recentVideos ?? []);
  const [videoPlaybackReports, setVideoPlaybackReports] = useState<VideoPlaybackReport[]>(() => restoredDesktopState?.videoPlaybackReports ?? []);
  const [recentVideosOpen, setRecentVideosOpen] = useState(false);
  const [videoPlaybackRate, setVideoPlaybackRate] = useState(1);
  const [videoSubtitleUrl, setVideoSubtitleUrl] = useState("");
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const [videoControlNote, setVideoControlNote] = useState("");
  const [videoReportStatus, setVideoReportStatus] = useState<"idle" | "sending" | "reported">("idle");
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [previewFilePath, setPreviewFilePath] = useState<string | null>(null);
  const [editorPath, setEditorPath] = useState<string | null>(() => restoredDesktopState?.editorPath ?? null);
  const [editorDraft, setEditorDraft] = useState(() => restoredDesktopState?.editorDraft ?? "");
  const [finderSearch, setFinderSearch] = useState("");
  const [finderSearchScope, setFinderSearchScope] = useState<"current" | "downloads" | "pictures">("current");
  const [finderContextMenu, setFinderContextMenu] = useState<FinderContextMenu | null>(null);
  const [fileInfoPath, setFileInfoPath] = useState<string | null>(null);
  const [weatherLocationId, setWeatherLocationId] = useState("shanghai");
  const [weatherUnit, setWeatherUnit] = useState<"c" | "f">(() => restoredDesktopState?.weatherUnit ?? "c");
  const [weatherUpdatedAt, setWeatherUpdatedAt] = useState(() => new Date());
  const [liveWeather, setLiveWeather] = useState<LiveWeather | null>(null);
  const [weatherSearch, setWeatherSearch] = useState("");
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState("");
  const [calendarEntries, setCalendarEntries] = useState<CalendarEntry[]>(() => restoredDesktopState?.calendarEntries ?? [
    { id: "morning", title: "晨间梳理", time: "09:00", color: "#6fa8ff" },
    { id: "review", title: "界面回顾", time: "15:00", color: "#ee7b91" },
  ]);
  const [calendarDraft, setCalendarDraft] = useState("");
  const [reminders, setReminders] = useState<ReminderItem[]>(() => restoredDesktopState?.reminders ?? [
    { id: "wallpaper", title: "选一张今天喜欢的壁纸", done: true },
    { id: "note", title: "在便笺里记录一个想法", done: false },
    { id: "music", title: "试听一首新的环境音乐", done: false },
  ]);
  const [reminderDraft, setReminderDraft] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const terminalOutputRef = useRef<HTMLDivElement | null>(null);
  const nativeVideoRef = useRef<HTMLVideoElement | null>(null);
  const tiktokPlayerRef = useRef<HTMLIFrameElement | null>(null);
  const electronWebviewRef = useRef<HTMLElement | null>(null);
  const electronHistoryStepRef = useRef<{ tabId: string; index: number } | null>(null);
  const desktopSnapshotRef = useRef<DesktopSnapshot | null>(restoredDesktopState);
  const isElectronDesktop = typeof window !== "undefined" && window.freshdeskDesktop?.isElectron === true;

  const tracks = useMemo(
    () => [
      { title: "Idle Sequence", artist: "Freshdesk Studio", cover: ALBUM_ORBIT, time: "2:30", src: MUSIC },
      { title: "Morning Window", artist: "Freshdesk Studio", cover: WALLPAPER_ALPINE, time: "2:30", src: MUSIC_MORNING },
      { title: "Night Orbit", artist: "Freshdesk Studio", cover: ALBUM_TIDE, time: "2:30", src: MUSIC_NIGHT },
    ],
    [],
  );

  const current = tracks[currentTrack];
  const activeBrowserTab = browserTabs.find((tab) => tab.id === activeBrowserTabId) ?? browserTabs[0];
  const availableWallpapers = [...wallpapers, ...customWallpapers];
  const activeWallpaper = availableWallpapers.find((wallpaper) => wallpaper.id === activeWallpaperId) ?? wallpapers[0];
  const activeNote = notes.find((item) => item.id === activeNoteId) ?? notes[0];
  const selectedPhoto = photoItems.find((item) => item.id === selectedPhotoId) ?? null;
  const currentWeather = liveWeather ?? weatherLocations.find((location) => location.id === weatherLocationId) ?? weatherLocations[0];
  const completedReminders = reminders.filter((item) => item.done).length;
  const finderEntries = virtualDirectoryEntries(virtualFileSystem, finderPath);
  const finderSearchResults = useMemo(() => {
    const query = finderSearch.trim().toLocaleLowerCase();
    if (!query) return [];
    return searchVirtualFiles({ files: virtualFileSystem.files, home: VIRTUAL_HOME, currentPath: finderPath, scope: finderSearchScope, query }).map((path) => ({ name: virtualName(path), type: "file" as const, path }));
  }, [finderPath, finderSearch, finderSearchScope, virtualFileSystem.files]);
  const visibleFinderEntries = finderSearch.trim() ? finderSearchResults : finderEntries;
  const readerInput = useMemo(() => ({ url: /^https?:\/\//i.test(activeBrowserTab?.url ?? "") ? activeBrowserTab.url : "https://example.com" }), [activeBrowserTab?.url]);
  const readerQuery = trpc.browser.readPage.useQuery(readerInput, { enabled: activeBrowserTab?.mode === "reader", retry: false, refetchOnWindowFocus: false });
  const embedInspectionQuery = trpc.browser.inspectEmbed.useQuery(readerInput, { enabled: activeBrowserTab?.mode === "web", retry: false, staleTime: 60_000 });
  const browserUtils = trpc.useUtils();
  const videoReportMutation = trpc.videoReports.submit.useMutation({
    onSuccess: () => setVideoReportStatus("reported"),
    onError: () => setVideoReportStatus("reported"),
  });
  const visibleReaderLinks = useMemo(() => {
    const query = readerLinkFilter.trim().toLocaleLowerCase();
    const links = readerQuery.data?.links ?? [];
    if (!query) return links;
    return links.filter((link) => `${link.title} ${link.url}`.toLocaleLowerCase().includes(query));
  }, [readerLinkFilter, readerQuery.data?.links]);

  const temperature = (value: number) => weatherUnit === "c" ? `${value}°` : `${Math.round(value * 9 / 5 + 32)}°`;
  const weatherSymbol = (icon: "sun" | "cloud" | "partly", size = 18) => icon === "sun" ? <Sun size={size} /> : icon === "cloud" ? <Cloud size={size} /> : <CloudSun size={size} />;
  const weatherCodeInfo = (code: number) => {
    if ([0, 1].includes(code)) return { condition: "晴朗", icon: "sun" as const };
    if ([2, 3].includes(code)) return { condition: "局部多云", icon: "partly" as const };
    if ([45, 48].includes(code)) return { condition: "有雾", icon: "cloud" as const };
    if ([51, 53, 55, 56, 57, 61, 63, 65, 80, 81, 82].includes(code)) return { condition: "有雨", icon: "cloud" as const };
    if ([71, 73, 75, 77, 85, 86].includes(code)) return { condition: "有雪", icon: "cloud" as const };
    if ([95, 96, 99].includes(code)) return { condition: "雷雨", icon: "cloud" as const };
    return { condition: "多云", icon: "partly" as const };
  };

  const moveFileToTrash = (path: string) => {
    if (!virtualFileSystem.files.includes(path)) return;
    setVirtualFileSystem((fileSystem) => ({ ...fileSystem, files: fileSystem.files.filter((file) => file !== path) }));
    setTrashItems((items) => [{ id: `trash-${Date.now()}`, path, type: "file", deletedAt: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) }, ...items]);
    setDraggedFilePath(null);
  };

  const restoreTrashItem = (item: VirtualTrashItem) => {
    setVirtualFileSystem((fileSystem) => fileSystem.files.includes(item.path) ? fileSystem : { ...fileSystem, files: [...fileSystem.files, item.path] });
    setTrashItems((items) => items.filter((entry) => entry.id !== item.id));
  };

  const isImageFile = (path: string) => /\.(?:jpg|jpeg|png|webp|gif|svg)$/i.test(path);
  const previewableFile = (path: string) => isTextFile(path) || isImageFile(path);
  const previewFileText = (path: string) => {
    if (fileContents[path] !== undefined) return fileContents[path];
    const name = virtualName(path);
    if (name === "README.md") return "# Freshdesk Drive\n\n这是桌面中的虚拟文件系统。双击文本文件即可在窗口中预览。\n\n- 可重命名\n- 可拖到回收站\n- 可从回收站恢复";
    if (name === "开机笔记.txt") return "今天的桌面已经准备好。\n\n打开一个应用，或者写下一条新的想法。";
    if (name === "工作流.md") return "# 工作流\n\n1. 整理今天的任务\n2. 保存网页阅读内容\n3. 在傍晚前回顾便笺";
    if (path.startsWith(`${VIRTUAL_HOME}/Downloads/`)) return `# ${name.replace(/\.txt$/i, "")}\n\n这是从 Freshdesk 浏览器兼容阅读模式保存的网页摘录。\n\n你可以在浏览器的“下载项”中再次打开它，也可以把它拖到回收站。`;
    return `${name}\n\n这是由终端或文件管理器创建的虚拟文本文件。`;
  };
  const previewFileImage = (path: string) => fileContents[path]?.startsWith("http") ? fileContents[path] : ({
    [`${VIRTUAL_HOME}/Pictures/晨雾极光.jpg`]: WALLPAPER,
  }[path] ?? WALLPAPER);
  const setWallpaperFromSource = (src: string, title: string) => {
    const existing = availableWallpapers.find((wallpaper) => wallpaper.src === src);
    const id = existing?.id ?? `custom-wallpaper-${Date.now()}`;
    if (!existing) setCustomWallpapers((items) => [...items, { id, title, src }]);
    setActiveWallpaperId(id);
  };
  const setFileAsWallpaper = (path: string) => {
    if (isImageFile(path)) setWallpaperFromSource(previewFileImage(path), `Finder · ${virtualName(path)}`);
  };
  const changeFinderPath = (path: string) => {
    if (!virtualFileSystem.directories.includes(path)) return;
    setFinderPath(path);
    setPreviewFilePath(null);
    setRenamingPath(null);
    setFinderContextMenu(null);
  };
  const startRenameFile = (path: string) => { setRenamingPath(path); setRenameValue(virtualName(path)); };
  const commitRenameFile = () => {
    if (!renamingPath) return;
    const nextName = renameValue.trim();
    if (!nextName || nextName.includes("/")) { setRenamingPath(null); return; }
    const nextPath = `${virtualParent(renamingPath)}/${nextName}`;
    setVirtualFileSystem((fileSystem) => fileSystem.files.includes(nextPath) ? fileSystem : { ...fileSystem, files: fileSystem.files.map((path) => path === renamingPath ? nextPath : path) });
    setFileContents((contents) => {
      if (contents[renamingPath] === undefined) return contents;
      const nextContents = { ...contents, [nextPath]: contents[renamingPath] };
      delete nextContents[renamingPath];
      return nextContents;
    });
    setPreviewFilePath((path) => path === renamingPath ? nextPath : path);
    setEditorPath((path) => path === renamingPath ? nextPath : path);
    setRenamingPath(null);
  };
  const isTextFile = (path: string) => /\.(?:txt|md)$/i.test(path);
  const openTextEditor = (path: string) => {
    if (!isTextFile(path)) return;
    setEditorPath(path);
    setEditorDraft(previewFileText(path));
    setPreviewFilePath(null);
    setFinderContextMenu(null);
    openApp("editor");
  };
  const saveEditorDocument = () => {
    if (!editorPath) return;
    setFileContents((contents) => ({ ...contents, [editorPath]: editorDraft }));
  };
  const createTextDocument = () => {
    const suffix = virtualFileSystem.files.some((path) => path === `${VIRTUAL_HOME}/Documents/未命名文稿.txt`) ? `-${Date.now().toString().slice(-4)}` : "";
    const path = `${VIRTUAL_HOME}/Documents/未命名文稿${suffix}.txt`;
    setVirtualFileSystem((fileSystem) => ({ ...fileSystem, files: [...fileSystem.files, path] }));
    setFileContents((contents) => ({ ...contents, [path]: "从这里开始输入。" }));
    setEditorPath(path);
    setEditorDraft("从这里开始输入。");
    openApp("editor");
  };
  const openFinderContextMenu = (event: React.MouseEvent, path: string) => {
    event.preventDefault();
    event.stopPropagation();
    setFinderContextMenu({ path, x: event.clientX, y: event.clientY });
  };

  const fetchLiveWeather = async (rawCity = weatherSearch) => {
    const city = rawCity.trim();
    if (!city) { setWeatherError("请输入城市名称，例如：上海、北京或 Tokyo。"); return; }
    setWeatherLoading(true);
    setWeatherError("");
    try {
      const geocodeResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=zh&format=json`);
      if (!geocodeResponse.ok) throw new Error("地理编码请求失败");
      const geocode = await geocodeResponse.json() as { results?: { id: number; name: string; country?: string; latitude: number; longitude: number; timezone: string }[] };
      const location = geocode.results?.[0];
      if (!location) throw new Error("未找到该城市");
      const weatherResponse = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code&forecast_days=1&timezone=auto`);
      if (!weatherResponse.ok) throw new Error("天气请求失败");
      const weather = await weatherResponse.json() as { current: { temperature_2m: number; relative_humidity_2m: number; apparent_temperature: number; weather_code: number; wind_speed_10m: number; time: string }; hourly: { time: string[]; temperature_2m: number[]; weather_code: number[] } };
      const hourIndex = Math.max(0, weather.hourly.time.findIndex((time) => time >= weather.current.time));
      const future = [0, 1, 2, 3].map((offset) => {
        const index = Math.min(weather.hourly.time.length - 1, hourIndex + offset);
        const date = new Date(weather.hourly.time[index]);
        const info = weatherCodeInfo(weather.hourly.weather_code[index]);
        return { label: offset === 0 ? "现在" : `${String(date.getHours()).padStart(2, "0")} 时`, icon: info.icon, temp: Math.round(weather.hourly.temperature_2m[index]) };
      });
      const temperatures = future.map((entry) => entry.temp);
      const info = weatherCodeInfo(weather.current.weather_code);
      setLiveWeather({ id: `live-${location.id}`, city: `${location.name}${location.country ? ` · ${location.country}` : ""}`, temp: Math.round(weather.current.temperature_2m), condition: info.condition, high: Math.max(...temperatures), low: Math.min(...temperatures), humidity: Math.round(weather.current.relative_humidity_2m), wind: `${Math.round(weather.current.wind_speed_10m)} km/h`, forecast: future, latitude: location.latitude, longitude: location.longitude, timezone: location.timezone, apparent: Math.round(weather.current.apparent_temperature), source: "live" });
      setWeatherLocationId("");
      setWeatherUpdatedAt(new Date());
      setWeatherSearch(location.name);
    } catch (error) {
      setWeatherError(error instanceof Error && error.message === "未找到该城市" ? `没有找到“${city}”，请尝试加入国家或省份。` : "暂时无法获取实时天气，请检查网络后重试。");
    } finally {
      setWeatherLoading(false);
    }
  };

  const movePhoto = (direction: 1 | -1) => {
    if (!selectedPhotoId) return;
    const index = Math.max(0, photoItems.findIndex((photo) => photo.id === selectedPhotoId));
    setSelectedPhotoId(photoItems[(index + direction + photoItems.length) % photoItems.length].id);
  };

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const activeStillVisible = activeWindowId && windows.some((windowItem) => windowItem.id === activeWindowId && !windowItem.minimized);
    if (!activeStillVisible) setActiveWindowId(topVisibleWindow(windows)?.id ?? null);
  }, [activeWindowId, windows]);

  useEffect(() => {
    if (!activeWindowId) return;
    const frame = window.requestAnimationFrame(() => {
      const focused = document.activeElement;
      const preservesTextInput = focused instanceof HTMLElement && Boolean(focused.closest("input, textarea, select, [contenteditable='true'], webview, iframe"));
      if (!preservesTextInput) document.querySelector<HTMLElement>(`[data-app-window="${activeWindowId}"]`)?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeWindowId]);

  useEffect(() => {
    try { window.localStorage.setItem("freshdesk.setup-complete", String(setupComplete)); } catch { /* local storage may be disabled */ }
  }, [setupComplete]);

  useEffect(() => {
    const snapshot: DesktopSnapshot = { setupComplete, windows, activeWallpaperId, customWallpapers, notes, activeNoteId, virtualFileSystem, fileContents, trashItems, finderPath, systemAppearance, volume, currentTrack, browserTabs, activeBrowserTabId, browserTabGroups, bookmarks, browserHistoryEntries, browserDownloads, recentVideos, videoPlaybackReports, editorPath, editorDraft, calendarEntries, reminders, weatherUnit };
    desktopSnapshotRef.current = snapshot;
    const timer = window.setTimeout(() => {
      try { window.localStorage.setItem(DESKTOP_STATE_KEY, JSON.stringify(snapshot)); } catch { /* storage may be unavailable */ }
    }, 320);
    return () => window.clearTimeout(timer);
  }, [setupComplete, windows, activeWallpaperId, customWallpapers, notes, activeNoteId, virtualFileSystem, fileContents, trashItems, finderPath, systemAppearance, volume, currentTrack, browserTabs, activeBrowserTabId, browserTabGroups, bookmarks, browserHistoryEntries, browserDownloads, recentVideos, videoPlaybackReports, editorPath, editorDraft, calendarEntries, reminders, weatherUnit]);

  useEffect(() => {
    const flushSnapshot = () => {
      if (!desktopSnapshotRef.current) return;
      try { window.localStorage.setItem(DESKTOP_STATE_KEY, JSON.stringify(desktopSnapshotRef.current)); } catch { /* storage may be unavailable */ }
    };
    const flushOnHidden = () => { if (document.visibilityState === "hidden") flushSnapshot(); };
    window.addEventListener("pagehide", flushSnapshot);
    document.addEventListener("visibilitychange", flushOnHidden);
    return () => {
      window.removeEventListener("pagehide", flushSnapshot);
      document.removeEventListener("visibilitychange", flushOnHidden);
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100;
  }, [volume]);

  useEffect(() => {
    const player = audioRef.current;
    if (!player || !isPlaying) return;
    player.play().catch(() => setIsPlaying(false));
  }, [currentTrack, isPlaying]);

  useEffect(() => {
    if (terminalOutputRef.current) terminalOutputRef.current.scrollTop = terminalOutputRef.current.scrollHeight;
  }, [terminalLines]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const editing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable;
      if (selectedPhotoId && !editing && event.key === "ArrowLeft") { event.preventDefault(); movePhoto(-1); return; }
      if (selectedPhotoId && !editing && event.key === "ArrowRight") { event.preventDefault(); movePhoto(1); return; }
      if (event.key === "Escape") setActivePanel(null);
      if (!editing && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "w") {
        const topWindow = topVisibleWindow(windows);
        if (topWindow) { event.preventDefault(); setWindows((currentWindows) => closeWindowById(currentWindows, topWindow.id)); }
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setActivePanel("spotlight");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedPhotoId, windows]);

  useEffect(() => {
    if (activeBrowserTab?.mode !== "reader") return;
    if (readerQuery.isLoading || readerQuery.isFetching) return;
    updateActiveBrowserTab((tab) => ({ ...tab, title: readerQuery.data?.title || tab.title, loading: false }));
    if (readerQuery.data) recordBrowserHistory(readerQuery.data.title, readerQuery.data.url, "reader");
  }, [readerQuery.data, readerQuery.isFetching, readerQuery.isLoading, activeBrowserTab?.id, activeBrowserTab?.mode]);

  useEffect(() => {
    if (!activeBrowserTab || activeBrowserTab.mode !== "web" || activeBrowserTab.loading || activeBrowserTab.url === "about:blank") return;
    recordBrowserHistory(activeBrowserTab.title, activeBrowserTab.url, "web");
  }, [activeBrowserTab?.id, activeBrowserTab?.loading, activeBrowserTab?.mode, activeBrowserTab?.title, activeBrowserTab?.url]);

  useEffect(() => {
    if (!activeBrowserTab || activeBrowserTab.mode !== "video" || activeBrowserTab.loading) return;
    recordBrowserHistory(activeBrowserTab.title, activeBrowserTab.url, "video");
  }, [activeBrowserTab?.id, activeBrowserTab?.loading, activeBrowserTab?.mode, activeBrowserTab?.title, activeBrowserTab?.url]);

  useEffect(() => {
    if (!activeBrowserTab || activeBrowserTab.mode !== "video" || activeBrowserTab.url === "about:blank") return;
    const source = activeBrowserTab.videoSource;
    const item: RecentVideo = { id: `recent-video-${Date.now()}`, title: activeBrowserTab.title, url: activeBrowserTab.url, provider: source?.provider ?? "视频", watchedAt: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) };
    setRecentVideos((items) => recordRecentVideo(items, item));
    setVideoControlNote("");
    setVideoReportStatus("idle");
  }, [activeBrowserTab?.id, activeBrowserTab?.mode, activeBrowserTab?.title, activeBrowserTab?.url, activeBrowserTab?.videoSource?.provider]);

  useEffect(() => {
    const player = nativeVideoRef.current;
    if (player) player.playbackRate = videoPlaybackRate;
  }, [videoPlaybackRate]);

  useEffect(() => {
    const player = nativeVideoRef.current;
    if (!player) return;
    Array.from(player.textTracks).forEach((track) => { track.mode = captionsEnabled ? "showing" : "hidden"; });
  }, [captionsEnabled, videoSubtitleUrl]);

  useEffect(() => {
    if (!activeBrowserTab || activeBrowserTab.mode !== "web") { setFrameStatus("idle"); return; }
    setFrameStatus("loading");
    if (isElectronDesktop) return;
    const timeout = window.setTimeout(() => setFrameStatus((status) => status === "loading" ? "restricted" : status), 6_500);
    return () => window.clearTimeout(timeout);
  }, [activeBrowserTab?.id, activeBrowserTab?.mode, activeBrowserTab?.reloadNonce, activeBrowserTab?.url, isElectronDesktop]);

  useEffect(() => {
    if (!isElectronDesktop || !activeBrowserTab || activeBrowserTab.mode !== "web") return;
    const webview = electronWebviewRef.current as (HTMLElement & { getURL?: () => string; getTitle?: () => string; reloadIgnoringCache?: () => void }) | null;
    if (!webview) return;
    const tabId = activeBrowserTab.id;
    const syncGuestRoute = () => {
      const url = webview.getURL?.();
      if (!url || !/^https?:\/\//i.test(url)) return;
      const title = webview.getTitle?.() || labelFromUrl(url);
      setBrowserTabs((tabs) => tabs.map((tab) => {
        if (tab.id !== tabId || tab.mode !== "web") return tab;
        const pendingHistoryStep = electronHistoryStepRef.current;
        if (pendingHistoryStep?.tabId === tabId) {
          electronHistoryStepRef.current = null;
          return synchronizeGuestHistoryStep(tab, pendingHistoryStep, url, title) ?? { ...tab, title, address: url, loading: false };
        }
        if (tab.url === url) return { ...tab, title, address: url, loading: false };
        return appendBrowserRoute(tab, { url, address: url, title, mode: "web" }, false);
      }));
      setFrameStatus("loaded");
    };
    const syncGuestTitle = (event: Event) => {
      const title = (event as CustomEvent<{ title?: string }>).detail?.title;
      if (!title) return;
      setBrowserTabs((tabs) => tabs.map((tab) => tab.id === tabId && tab.mode === "web" ? { ...tab, title } : tab));
    };
    const startGuestLoad = () => {
      setBrowserTabs((tabs) => tabs.map((tab) => tab.id === tabId && tab.mode === "web" ? { ...tab, loading: true } : tab));
      setFrameStatus("loading");
    };
    const failGuestLoad = (event: Event) => {
      const failure = event as Event & { errorCode?: number; isMainFrame?: boolean };
      if (failure.isMainFrame === false || failure.errorCode === -3) return;
      setBrowserTabs((tabs) => tabs.map((tab) => tab.id === tabId && tab.mode === "web" ? { ...tab, loading: false } : tab));
      setBrowserFallbackNotice("该网页未能完成加载，但仍保留在当前 Chromium 标签中。你可以刷新、返回或继续输入其他网址；不会自动改成阅读模式。");
      setFrameStatus("error");
    };
    webview.addEventListener("did-start-loading", startGuestLoad);
    webview.addEventListener("did-finish-load", syncGuestRoute);
    webview.addEventListener("did-navigate", syncGuestRoute);
    webview.addEventListener("did-navigate-in-page", syncGuestRoute);
    webview.addEventListener("page-title-updated", syncGuestTitle);
    webview.addEventListener("did-fail-load", failGuestLoad);
    return () => {
      webview.removeEventListener("did-finish-load", syncGuestRoute);
      webview.removeEventListener("did-navigate", syncGuestRoute);
      webview.removeEventListener("did-navigate-in-page", syncGuestRoute);
      webview.removeEventListener("page-title-updated", syncGuestTitle);
      webview.removeEventListener("did-start-loading", startGuestLoad);
      webview.removeEventListener("did-fail-load", failGuestLoad);
    };
  }, [activeBrowserTab?.id, activeBrowserTab?.mode, activeBrowserTab?.reloadNonce, activeBrowserTab?.url, isElectronDesktop]);

  useEffect(() => {
    if (!shouldAutoOpenReader(isElectronDesktop, frameStatus === "restricted") || !activeBrowserTab || activeBrowserTab.mode !== "web") return;
    const tabId = activeBrowserTab.id;
    const timeout = window.setTimeout(() => {
      setBrowserTabs((tabs) => tabs.map((tab) => tab.id === tabId && tab.mode === "web" ? appendBrowserRoute(tab, { url: tab.url, address: tab.url, title: `阅读：${tab.title}`, mode: "reader" }) : tab));
      setBrowserFallbackNotice("该网页长时间未允许嵌入，已自动切换到当前标签的兼容阅读。公开链接仍可继续点击；不会跳转到外部浏览器。");
      setFrameStatus("idle");
    }, 160);
    return () => window.clearTimeout(timeout);
  }, [activeBrowserTab?.id, activeBrowserTab?.mode, frameStatus, isElectronDesktop]);

  useEffect(() => {
    if (isElectronDesktop || !activeBrowserTab || activeBrowserTab.mode !== "web" || !embedInspectionQuery.data || embedInspectionQuery.data.canEmbed) return;
    autoDegradeWebTab(`${embedInspectionQuery.data.reason} 已自动切换到当前标签的兼容阅读；不会跳转外部浏览器。`);
  }, [activeBrowserTab?.id, activeBrowserTab?.mode, embedInspectionQuery.data?.canEmbed, embedInspectionQuery.data?.reason, isElectronDesktop]);

  useEffect(() => {
    if (!isElectronDesktop || !window.freshdeskDesktop?.onUpdateStatus) return;
    return window.freshdeskDesktop.onUpdateStatus((status) => setDesktopUpdateStatus(status.message));
  }, [isElectronDesktop]);

  useEffect(() => {
    if (!isElectronDesktop || !window.freshdeskDesktop?.onDownloadStatus) return;
    return window.freshdeskDesktop.onDownloadStatus((status) => {
      const statusLabel = { downloading: "下载中", completed: "已完成", cancelled: "已取消", failed: "下载失败" }[status.state] as BrowserDownload["status"];
      setBrowserDownloads((items) => {
        const next: BrowserDownload = { id: status.id, title: status.title, url: status.url, createdAt: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }), status: statusLabel, progress: status.progress, receivedBytes: status.receivedBytes, totalBytes: status.totalBytes, native: true, path: status.path };
        const existing = items.find((item) => item.id === status.id);
        return existing ? items.map((item) => item.id === status.id ? { ...item, ...next, createdAt: item.createdAt } : item) : [next, ...items];
      });
    });
  }, [isElectronDesktop]);

  const bringToFront = (id: AppName) => {
    setActiveWindowId((currentId) => currentId === id ? currentId : id);
    setWindows((currentWindows) => bringWindowToFront(currentWindows, id));
  };

  const focusElectronWebview = () => {
    if (!isElectronDesktop || activeBrowserTab?.mode !== "web") return;
    window.requestAnimationFrame(() => (electronWebviewRef.current as (HTMLElement & { focus?: () => void }) | null)?.focus?.());
  };

  const updateWindowBounds = (id: AppName, bounds: WindowBounds) => {
    setWindows((currentWindows) => currentWindows.map((item) => item.id === id ? { ...item, bounds, maximized: false, restoreBounds: undefined } : item));
  };

  const snapWindow = (id: AppName, target: SnapTarget) => {
    const nextBounds = getSnapBounds(target);
    setWindows((currentWindows) => currentWindows.map((item) => item.id === id ? { ...item, maximized: false, restoreBounds: item.bounds, bounds: nextBounds } : item));
  };

  useEffect(() => {
    const onSplitShortcut = (event: KeyboardEvent) => {
      const source = event.target as HTMLElement;
      if (source instanceof HTMLInputElement || source instanceof HTMLTextAreaElement || source.isContentEditable) return;
      if (!(event.metaKey || event.ctrlKey) || !event.altKey) return;
      const activeWindow = [...windows].filter((item) => !item.minimized).sort((a, b) => b.zIndex - a.zIndex)[0];
      if (!activeWindow) return;
      const targetMap: Record<string, SnapTarget> = { ArrowLeft: "left", ArrowRight: "right", "1": "top-left", "2": "top-right", "3": "bottom-left", "4": "bottom-right" };
      const target = targetMap[event.key];
      if (!target) return;
      event.preventDefault();
      snapWindow(activeWindow.id, target);
    };
    window.addEventListener("keydown", onSplitShortcut);
    return () => window.removeEventListener("keydown", onSplitShortcut);
  }, [windows]);

  const toggleMaximize = (id: AppName) => {
    setWindows((currentWindows) => currentWindows.map((item) => {
      if (item.id !== id) return item;
      if (item.maximized && item.restoreBounds) return { ...item, maximized: false, bounds: item.restoreBounds, restoreBounds: undefined };
      return {
        ...item,
        maximized: true,
        restoreBounds: item.bounds,
        bounds: { x: 8, y: 30, width: Math.max(560, window.innerWidth - 16), height: Math.max(360, window.innerHeight - 42) },
      };
    }));
  };

  const openApp = (id: AppName) => {
    setActivePanel(null);
    setActiveWindowId(id);
    setWindows((currentWindows) => {
      const top = Math.max(25, ...currentWindows.map((item) => item.zIndex));
      const existing = currentWindows.find((item) => item.id === id);
      if (existing) return currentWindows.map((item) => (item.id === id ? { ...item, minimized: false, zIndex: top + 1 } : item));
      return [...currentWindows, { id, minimized: false, zIndex: top + 1, bounds: { ...defaultWindowBounds[id] }, maximized: false }];
    });
  };

  const closeApp = (id: AppName) => setWindows((currentWindows) => {
    const nextActive = nextVisibleWindowAfterAction(currentWindows, id, "close");
    if (activeWindowId === id) setActiveWindowId(nextActive?.id ?? null);
    return closeWindowById(currentWindows, id);
  });
  const minimizeApp = (id: AppName) => setWindows((currentWindows) => {
    const nextActive = nextVisibleWindowAfterAction(currentWindows, id, "minimize");
    if (activeWindowId === id) setActiveWindowId(nextActive?.id ?? null);
    return currentWindows.map((item) => item.id === id ? { ...item, minimized: true } : item);
  });
  const closeAllApps = () => { setWindows((currentWindows) => closeAllWindows<typeof currentWindows[number]>()); setActiveWindowId(null); setActivePanel(null); };
  const minimizeAllApps = () => setWindows((currentWindows) => minimizeAllWindows(currentWindows));

  const registerNativeVideo = (video: HTMLVideoElement) => {
    nativeVideoRef.current = video;
    video.playbackRate = videoPlaybackRate;
    Array.from(video.textTracks).forEach((track) => { track.mode = captionsEnabled ? "showing" : "hidden"; });
    updateActiveBrowserTab((tab) => ({ ...tab, loading: false }));
  };

  const togglePictureInPicture = async () => {
    const video = nativeVideoRef.current;
    if (!video || !document.pictureInPictureEnabled) { setVideoControlNote("画中画仅适用于当前标签中的公开原生视频或 HLS 流。嵌入平台由其自身播放器控制。 "); return; }
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await video.requestPictureInPicture();
      setVideoControlNote("");
    } catch {
      setVideoControlNote("此视频拒绝进入画中画，可能受浏览器权限、来源策略或平台限制。 ");
    }
  };

  const toggleCaptions = () => {
    const video = nativeVideoRef.current;
    if (!video || !video.textTracks.length) { setVideoControlNote("当前视频未提供可访问的字幕轨道。可粘贴公开 .vtt 字幕地址后再开启。 "); return; }
    setCaptionsEnabled((enabled) => !enabled);
  };

  const controlTikTokPlayer = (command: TikTokPlayerCommand) => {
    const playerWindow = tiktokPlayerRef.current?.contentWindow;
    if (!playerWindow) { setVideoControlNote("TikTok 播放器尚未就绪，请稍候再试。 "); return; }
    postTikTokPlayerCommand(playerWindow, command);
    const action = { play: "播放", pause: "暂停", mute: "静音" }[command];
    setVideoControlNote(`已向 TikTok 官方播放器发送“${action}”指令。`);
  };

  const reportCurrentVideo = () => {
    if (!activeBrowserTab || activeBrowserTab.mode !== "video") return;
    const report: VideoPlaybackReport = { id: `video-report-${Date.now()}`, url: activeBrowserTab.url, title: activeBrowserTab.title, provider: activeBrowserTab.videoSource?.provider ?? "未知来源", reportedAt: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) };
    setVideoPlaybackReports((items) => [report, ...items.filter((item) => item.url !== report.url)].slice(0, 30));
    setVideoReportStatus("sending");
    videoReportMutation.mutate({ url: report.url, title: report.title, provider: report.provider, reason: "playback_failed" });
  };

  const normalizeUrl = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return activeBrowserTab?.url ?? "about:blank";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (trimmed.includes(" ")) return trimmed;
    return `https://${trimmed}`;
  };

  const looksLikeSearch = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || /^https?:\/\//i.test(trimmed)) return false;
    return trimmed.includes(" ") || (!trimmed.includes(".") && !trimmed.includes("/") && !trimmed.includes(":"));
  };

  const updateActiveBrowserTab = (updater: (tab: BrowserTab) => BrowserTab) => {
    setBrowserTabs((tabs) => tabs.map((tab) => tab.id === activeBrowserTabId ? updater(tab) : tab));
  };

  const updateBrowserAddress = (address: string) => updateActiveBrowserTab((tab) => ({ ...tab, address }));

  const recordBrowserHistory = (title: string, address: string, mode: BrowserHistoryEntry["mode"]) => {
    if (!address || address === "about:blank") return;
    setBrowserHistoryEntries((entries) => {
      const next = { id: `history-${Date.now()}`, title, address, visitedAt: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }), mode };
      const withoutDuplicate = entries.filter((entry) => entry.address !== address || entry.mode !== mode);
      return [next, ...withoutDuplicate].slice(0, 36);
    });
  };

  const appendBrowserRoute = (tab: BrowserTab, route: BrowserRoute, loading = true) => {
    const { history, historyIndex } = appendNavigationRoute(tab.history, tab.historyIndex, route);
    return { ...tab, title: route.title || labelFromUrl(route.url), address: route.address ?? route.url, url: route.url, mode: route.mode, videoSource: route.videoSource, history, historyIndex, loading, searchError: "" };
  };

  const openInReader = (url: string, title?: string) => {
    const nextUrl = normalizeUrl(url);
    const videoSource = resolveBrowserVideo(nextUrl);
    updateActiveBrowserTab((tab) => {
      const route: BrowserRoute = { url: nextUrl, address: nextUrl, title: title || (videoSource?.title ?? `阅读：${labelFromUrl(nextUrl)}`), mode: videoSource ? "video" : "reader", videoSource: videoSource ?? undefined };
      return { ...appendBrowserRoute(tab, route, videoSource?.kind === "restricted" ? false : true), videoSource: videoSource ?? undefined };
    });
    setBookmarksOpen(false);
    setHistoryOpen(false);
    setDownloadsOpen(false);
    setReaderLinkFilter("");
    setVideoError(null);
  };

  const openWebInCurrentTab = (url: string, title?: string) => {
    const nextUrl = normalizeUrl(url);
    const videoSource = resolveBrowserVideo(nextUrl);
    const routeMode = desktopBrowserOpenMode(isElectronDesktop, Boolean(videoSource));
    updateActiveBrowserTab((tab) => {
      const route: BrowserRoute = { url: nextUrl, address: nextUrl, title: title || videoSource?.title || labelFromUrl(nextUrl), mode: routeMode, videoSource: routeMode === "video" ? videoSource ?? undefined : undefined };
      return { ...appendBrowserRoute(tab, route, routeMode === "video" && videoSource?.kind === "restricted" ? false : true), videoSource: routeMode === "video" ? videoSource ?? undefined : undefined };
    });
    setBrowserFallbackNotice("");
    setReaderLinkFilter("");
    setVideoError(null);
  };

  const resumeRecentVideo = (item: RecentVideo) => {
    const videoSource = resolveBrowserVideo(item.url);
    if (!videoSource) { openInReader(item.url, item.title); return; }
    updateActiveBrowserTab((tab) => appendBrowserRoute(tab, { url: item.url, address: item.url, title: item.title, mode: "video", videoSource }, videoSource.kind !== "restricted"));
    setRecentVideosOpen(false);
    setVideoError(null);
  };

  const autoDegradeWebTab = (reason: string) => {
    if (!activeBrowserTab || activeBrowserTab.mode !== "web") return;
    const tabId = activeBrowserTab.id;
    setBrowserTabs((tabs) => tabs.map((tab) => tab.id === tabId && tab.mode === "web" ? appendBrowserRoute(tab, { url: tab.url, address: tab.url, title: `阅读：${tab.title}`, mode: "reader" }) : tab));
    setBrowserFallbackNotice(reason);
    setFrameStatus("idle");
  };

  const startBrowserDownload = (url: string, title: string) => {
    if (!/^https?:\/\//i.test(url)) return;
    const id = `download-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const createdAt = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    const pending: BrowserDownload = { id, title, url, createdAt, status: "准备就绪", progress: 0, native: isElectronDesktop };
    setBrowserDownloads((items) => [pending, ...items]);
    if (isElectronDesktop && window.freshdeskDesktop?.startDownload) {
      void window.freshdeskDesktop.startDownload({ id, url, title }).catch(() => {
        setBrowserDownloads((items) => items.map((item) => item.id === id ? { ...item, status: "下载失败", progress: 0 } : item));
      });
      return;
    }
    const link = document.createElement("a");
    link.href = url;
    link.download = title;
    link.rel = "noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setBrowserDownloads((items) => items.map((item) => item.id === id ? { ...item, status: "已完成", progress: 100 } : item));
  };

  const cancelBrowserDownload = (id: string) => {
    if (!window.freshdeskDesktop?.cancelDownload) return;
    void window.freshdeskDesktop.cancelDownload(id).then((cancelled) => {
      if (cancelled) setBrowserDownloads((items) => items.map((item) => item.id === id ? { ...item, status: "已取消" } : item));
    });
  };

  const saveCurrentDownload = () => {
    if (!activeBrowserTab || activeBrowserTab.url === "about:blank") return;
    const safeTitle = (activeBrowserTab.title || "网页摘录").replace(/[\\/:*?"<>|]/g, "-").slice(0, 64);
    const filePath = `${VIRTUAL_HOME}/Downloads/${safeTitle}.txt`;
    setBrowserDownloads((items) => [{ id: `saved-${Date.now()}`, title: `${safeTitle}.txt`, url: activeBrowserTab.url, createdAt: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }), status: "已保存", progress: 100 }, ...items]);
    setVirtualFileSystem((fileSystem) => fileSystem.files.includes(filePath) ? fileSystem : { ...fileSystem, files: [...fileSystem.files, filePath] });
    setFileContents((contents) => ({ ...contents, [filePath]: `# ${safeTitle}\n\n${readerQuery.data?.summary || "这是从 Freshdesk 浏览器兼容阅读模式保存的网页摘录。"}\n\n来源：${activeBrowserTab.url}` }));
  };

  const downloadCurrentImage = () => {
    if (!activeBrowserTab || activeBrowserTab.mode !== "media") return;
    const item = activeBrowserTab.mediaItems?.[activeBrowserTab.mediaIndex ?? 0];
    const source = item?.src ?? activeBrowserTab.url;
    if (!/^https?:\/\//i.test(source)) return;
    let extension = "jpg";
    try {
      const matched = new URL(source).pathname.match(/\.([a-z0-9]{2,5})$/i);
      if (matched && /^(jpg|jpeg|png|webp|gif|svg)$/i.test(matched[1])) extension = matched[1].toLowerCase();
    } catch { /* use default extension */ }
    const base = (item?.alt || activeBrowserTab.title || "网页图片").replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "-").slice(0, 42) || "网页图片";
    const title = `${base}-${Date.now()}.${extension}`;
    const filePath = `${VIRTUAL_HOME}/Downloads/${title}`;
    setVirtualFileSystem((fileSystem) => fileSystem.files.includes(filePath) ? fileSystem : { ...fileSystem, files: [...fileSystem.files, filePath] });
    setFileContents((contents) => ({ ...contents, [filePath]: source }));
    if (!isElectronDesktop) setBrowserDownloads((items) => [{ id: `image-saved-${Date.now()}`, title, url: source, createdAt: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }), status: "已保存", progress: 100 }, ...items]);
    startBrowserDownload(source, title);
  };

  const fetchBrowserSearch = async (query: string) => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return;
    updateActiveBrowserTab((tab) => ({ ...tab, title: `搜索：${normalizedQuery}`, address: normalizedQuery, mode: "search", searchQuery: normalizedQuery, searchError: "", loading: true }));
    try {
      const result = await browserUtils.browser.search.fetch({ query: normalizedQuery });
      const searchResults = result.results.map((item) => ({ title: item.title, url: item.url, snippet: item.snippet, source: "兼容搜索" }));
      updateActiveBrowserTab((tab) => ({ ...tab, loading: false, mode: "search", searchResults, searchSummary: searchResults.length ? "搜索结果可在当前标签的兼容阅读模式中继续打开。" : "未找到公开结果。可尝试更具体的关键词或输入完整网址。", searchError: "" }));
      recordBrowserHistory(`搜索：${normalizedQuery}`, `search:${normalizedQuery}`, "search");
    } catch (error) {
      updateActiveBrowserTab((tab) => ({ ...tab, loading: false, mode: "search", searchResults: [], searchError: error instanceof Error ? "搜索暂时不可用，请稍后重试。" : "搜索暂时不可用，请稍后重试。" }));
    }
  };

  const navigateBrowser = (value: string) => {
    if (looksLikeSearch(value)) {
      if (isElectronDesktop) {
        const query = value.trim();
        openWebInCurrentTab(desktopSearchUrl(query), `搜索：${query}`);
        return;
      }
      void fetchBrowserSearch(value);
      return;
    }
    openWebInCurrentTab(value);
  };

  const openReaderMode = () => {
    if (!activeBrowserTab || activeBrowserTab.mode !== "web" || !/^https?:\/\//i.test(activeBrowserTab.url)) return;
    updateActiveBrowserTab((tab) => {
      const route: BrowserRoute = { url: tab.url, address: tab.url, title: `阅读：${labelFromUrl(tab.url)}`, mode: "reader" };
      const previous = tab.history[tab.historyIndex - 1];
      if (previous?.url === route.url && previous.mode === "reader") {
        return { ...tab, title: previous.title ?? route.title ?? labelFromUrl(route.url), address: previous.address ?? route.url, url: route.url, mode: "reader", history: tab.history.slice(0, tab.historyIndex), historyIndex: tab.historyIndex - 1, loading: true };
      }
      const history = tab.history.map((entry, index) => index === tab.historyIndex ? route : entry);
      return { ...tab, title: route.title ?? labelFromUrl(route.url), address: route.address ?? route.url, mode: "reader", history, loading: true };
    });
  };

  const openDirectMode = () => {
    if (!activeBrowserTab || activeBrowserTab.mode !== "reader" || !/^https?:\/\//i.test(activeBrowserTab.url)) return;
    setBrowserFallbackNotice("");
    updateActiveBrowserTab((tab) => appendBrowserRoute(tab, { url: tab.url, address: tab.url, title: labelFromUrl(tab.url), mode: "web" }));
  };

  const openReaderImage = (index: number) => {
    const images = readerQuery.data?.images ?? [];
    const item = images[index];
    if (!item) return;
    updateActiveBrowserTab((tab) => ({ ...tab, mode: "media", title: item.alt || "网页图片", address: item.src, url: item.src, loading: false, mediaItems: images, mediaIndex: index, readerOriginUrl: tab.url }));
    setMediaZoom(100);
    setMediaImageError(null);
  };

  const stepReaderImage = (direction: -1 | 1) => {
    updateActiveBrowserTab((tab) => {
      const items = tab.mediaItems ?? [];
      if (!items.length) return tab;
      const currentIndex = tab.mediaIndex ?? 0;
      const nextIndex = (currentIndex + direction + items.length) % items.length;
      const next = items[nextIndex];
      return { ...tab, mediaIndex: nextIndex, title: next.alt || "网页图片", address: next.src, url: next.src };
    });
    setMediaImageError(null);
  };

  const returnToReader = () => {
    updateActiveBrowserTab((tab) => ({ ...tab, mode: "reader", title: `阅读：${labelFromUrl(tab.readerOriginUrl ?? tab.url)}`, address: tab.readerOriginUrl ?? tab.address, url: tab.readerOriginUrl ?? tab.url, loading: false }));
    setMediaZoom(100);
  };

  const openBrowserSearchResult = (result: BrowserSearchResult) => openWebInCurrentTab(result.url, result.title);

  const openReaderVideo = (src: string, title: string) => {
    const source = resolveBrowserVideo(src);
    if (source) {
      updateActiveBrowserTab((tab) => appendBrowserRoute(tab, { url: src, address: src, title: title || source.title, mode: "video", videoSource: source }, true));
      setVideoError(null);
      return;
    }
    openWebInCurrentTab(src, title);
  };

  const stepBrowserHistory = (direction: -1 | 1) => {
    if (isElectronDesktop && activeBrowserTab?.mode === "web") {
      const next = getNavigationStep(activeBrowserTab.history, activeBrowserTab.historyIndex, direction);
      const webview = electronWebviewRef.current as (HTMLElement & { canGoBack?: () => boolean; canGoForward?: () => boolean; goBack?: () => void; goForward?: () => void }) | null;
      const canUseGuestHistory = next?.route.mode === "web" && (direction === -1 ? webview?.canGoBack?.() : webview?.canGoForward?.());
      if (next && canUseGuestHistory) {
        electronHistoryStepRef.current = { tabId: activeBrowserTab.id, index: next.index };
        updateActiveBrowserTab((tab) => ({ ...tab, loading: true }));
        if (direction === -1) webview?.goBack?.(); else webview?.goForward?.();
        return;
      }
    }
    updateActiveBrowserTab((tab) => {
      const next = getNavigationStep(tab.history, tab.historyIndex, direction);
      if (!next) return tab;
      const { route, index } = next;
      return { ...tab, title: route.title || labelFromUrl(route.url), address: route.address ?? route.url, url: route.url, historyIndex: index, loading: route.videoSource?.kind === "restricted" ? false : true, mode: route.mode, videoSource: route.videoSource, searchError: "" };
    });
  };

  const refreshBrowser = () => {
    if (activeBrowserTab?.mode === "media") return;
    if (activeBrowserTab?.mode === "video") { updateActiveBrowserTab((tab) => ({ ...tab, loading: true, reloadNonce: tab.reloadNonce + 1 })); return; }
    if (activeBrowserTab?.mode === "search") { void fetchBrowserSearch(activeBrowserTab.searchQuery ?? activeBrowserTab.address); return; }
    if (activeBrowserTab?.mode === "reader") {
      updateActiveBrowserTab((tab) => ({ ...tab, loading: true }));
      void readerQuery.refetch();
      return;
    }
    if (isElectronDesktop) {
      const webview = electronWebviewRef.current as (HTMLElement & { reloadIgnoringCache?: () => void }) | null;
      if (webview?.reloadIgnoringCache) {
        updateActiveBrowserTab((tab) => ({ ...tab, loading: true }));
        webview.reloadIgnoringCache();
        return;
      }
    }
    updateActiveBrowserTab((tab) => ({ ...tab, loading: true, reloadNonce: tab.reloadNonce + 1 }));
  };

  const addBrowserTab = (url = "about:blank") => {
    const id = `tab-${Date.now()}`;
    const nextTab: BrowserTab = { id, title: "新标签页", address: "", url, history: [{ url, address: "", title: "新标签页", mode: "search" }], historyIndex: 0, loading: false, reloadNonce: 0, pinned: false, mode: "search" };
    setBrowserTabs((tabs) => [...tabs, nextTab]);
    setActiveBrowserTabId(id);
    setBookmarksOpen(false);
  };

  const closeBrowserTab = (id: string) => {
    const currentIndex = browserTabs.findIndex((tab) => tab.id === id);
    if (browserTabs.length === 1) {
      const replacement: BrowserTab = { id: `tab-${Date.now()}`, title: "新标签页", address: "", url: "about:blank", history: [{ url: "about:blank", address: "", title: "新标签页", mode: "search" }], historyIndex: 0, loading: false, reloadNonce: 0, pinned: false, mode: "search" };
      setBrowserTabs([replacement]);
      setActiveBrowserTabId(replacement.id);
      return;
    }
    const nextTabs = browserTabs.filter((tab) => tab.id !== id);
    setBrowserTabs(nextTabs);
    if (id === activeBrowserTabId) setActiveBrowserTabId(nextTabs[Math.max(0, currentIndex - 1)].id);
  };

  const groupPalette = ["#6fa8ff", "#ee7b91", "#f4bb57", "#72c5a5", "#9a8ae9"];

  const createTabGroup = () => {
    if (!activeBrowserTab) return;
    const group: BrowserTabGroup = { id: `group-${Date.now()}`, title: `工作组 ${browserTabGroups.length + 1}`, color: groupPalette[browserTabGroups.length % groupPalette.length], collapsed: false };
    setBrowserTabGroups((groups) => [...groups, group]);
    setBrowserTabs((tabs) => tabs.map((tab) => tab.id === activeBrowserTab.id ? { ...tab, groupId: group.id, pinned: false } : tab));
    setGroupsOpen(false);
  };

  const assignBrowserTabToGroup = (tabId: string, groupId: string | undefined) => {
    setBrowserTabs((tabs) => tabs.map((tab) => tab.id === tabId ? { ...tab, groupId, pinned: groupId ? false : tab.pinned } : tab));
  };

  const assignTabToGroup = (groupId: string | undefined) => {
    if (!activeBrowserTab) return;
    assignBrowserTabToGroup(activeBrowserTab.id, groupId);
    setGroupsOpen(false);
  };

  const toggleGroupCollapsed = (id: string) => setBrowserTabGroups((groups) => groups.map((group) => group.id === id ? { ...group, collapsed: !group.collapsed } : group));
  const renameGroup = (id: string, title: string) => setBrowserTabGroups((groups) => groups.map((group) => group.id === id ? { ...group, title } : group));
  const removeTabGroup = (id: string) => {
    setBrowserTabGroups((groups) => groups.filter((group) => group.id !== id));
    setBrowserTabs((tabs) => tabs.map((tab) => tab.groupId === id ? { ...tab, groupId: undefined } : tab));
  };

  const sortTabsByPinned = (tabs: BrowserTab[]) => [...tabs.filter((tab) => tab.pinned), ...tabs.filter((tab) => !tab.pinned)];

  const togglePinBrowserTab = (id: string) => {
    setBrowserTabs((tabs) => sortTabsByPinned(tabs.map((tab) => tab.id === id ? { ...tab, pinned: !tab.pinned } : tab)));
  };

  const reorderBrowserTabs = (targetId: string) => {
    if (!draggedTabId || draggedTabId === targetId) return;
    setBrowserTabs((tabs) => {
      const dragged = tabs.find((tab) => tab.id === draggedTabId);
      const target = tabs.find((tab) => tab.id === targetId);
      if (!dragged || !target || dragged.pinned !== target.pinned || dragged.groupId !== target.groupId) return tabs;
      const lane = tabs.filter((tab) => tab.pinned === dragged.pinned && tab.groupId === dragged.groupId);
      const fromIndex = lane.findIndex((tab) => tab.id === draggedTabId);
      const toIndex = lane.findIndex((tab) => tab.id === targetId);
      const reordered = [...lane];
      reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, dragged);
      return sortTabsByPinned([...tabs.filter((tab) => tab.pinned !== dragged.pinned || tab.groupId !== dragged.groupId), ...reordered]);
    });
    setDraggedTabId(null);
  };

  const groupedTabs = (groupId: string | undefined) => browserTabs.filter((tab) => !tab.pinned && tab.groupId === groupId);
  const pinnedTabs = browserTabs.filter((tab) => tab.pinned);
  const ungroupedTabs = groupedTabs(undefined);

  const renderBrowserTab = (tab: BrowserTab, groupColor?: string) => <div className={`browser-tab ${tab.id === activeBrowserTabId ? "active" : ""} ${tab.pinned ? "pinned" : ""} ${tab.groupId ? "grouped" : ""} ${draggedTabId === tab.id ? "dragging" : ""}`} style={groupColor ? { borderTopColor: groupColor } : undefined} key={tab.id} draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; setDraggedTabId(tab.id); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.stopPropagation(); reorderBrowserTabs(tab.id); }} onDragEnd={() => setDraggedTabId(null)}><button className="browser-tab-select" onClick={() => { setActiveBrowserTabId(tab.id); setBookmarksOpen(false); }}>{tab.pinned ? <Pin size={11} /> : <Globe2 size={12} />}<span>{tab.title}</span>{tab.loading && <i />}</button><button className={`browser-tab-pin ${tab.pinned ? "active" : ""}`} aria-label={`${tab.pinned ? "取消固定" : "固定"} ${tab.title}`} onClick={() => togglePinBrowserTab(tab.id)}><Pin size={11} /></button><button className="browser-tab-close" aria-label={`关闭 ${tab.title}`} onClick={() => closeBrowserTab(tab.id)}><X size={11} /></button></div>;

  const toggleCurrentBookmark = () => {
    if (!activeBrowserTab) return;
    const existing = bookmarks.find((bookmark) => bookmark.url === activeBrowserTab.url);
    if (existing) setBookmarks((items) => items.filter((item) => item.id !== existing.id));
    else setBookmarks((items) => [...items, { id: `bookmark-${Date.now()}`, title: activeBrowserTab.title, url: activeBrowserTab.url }]);
  };

  const openBookmark = (bookmark: BrowserBookmark) => {
    if (!activeBrowserTab) return;
    updateActiveBrowserTab((tab) => {
      return appendBrowserRoute(tab, { url: bookmark.url, address: bookmark.url, title: bookmark.title, mode: "web" });
    });
    setBookmarksOpen(false);
  };

  const playMusic = async () => {
    const player = audioRef.current;
    if (!player) return;
    try {
      if (player.paused) {
        await player.play();
        setIsPlaying(true);
      } else {
        player.pause();
        setIsPlaying(false);
      }
    } catch {
      setIsPlaying(false);
    }
  };

  const skipTrack = (direction: 1 | -1) => {
    const nextIndex = (currentTrack + direction + tracks.length) % tracks.length;
    setCurrentTrack(nextIndex);
    setProgress(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      if (isPlaying) window.setTimeout(() => audioRef.current?.play().catch(() => setIsPlaying(false)), 30);
    }
  };

  const createNote = () => {
    const id = `note-${Date.now()}`;
    const created: NoteDocument = { id, title: "未命名便笺", body: "从这里开始记录。", updated: "刚刚" };
    setNotes((items) => [created, ...items]);
    setActiveNoteId(id);
  };

  const updateActiveNote = (changes: Partial<Pick<NoteDocument, "title" | "body">>) => {
    setNotes((items) => items.map((item) => item.id === activeNote.id ? { ...item, ...changes, updated: "刚刚" } : item));
  };

  const addCalendarEntry = (event: FormEvent) => {
    event.preventDefault();
    const title = calendarDraft.trim();
    if (!title) return;
    setCalendarEntries((entries) => [...entries, { id: `event-${Date.now()}`, title, time: "18:00", color: ["#6fa8ff", "#ee7b91", "#72c5a5"][entries.length % 3] }]);
    setCalendarDraft("");
  };

  const addReminder = (event: FormEvent) => {
    event.preventDefault();
    const title = reminderDraft.trim();
    if (!title) return;
    setReminders((items) => [{ id: `reminder-${Date.now()}`, title, done: false }, ...items]);
    setReminderDraft("");
  };

  const runTerminalCommand = (event: FormEvent) => {
    event.preventDefault();
    const raw = terminalInput.trim();
    if (!raw) return;
    const [command, ...args] = raw.split(/\s+/);
    const argument = args.join(" ");
    const prompt = `freshdesk@desktop:${displayVirtualPath(terminalCwd)}$ ${raw}`;
    if (command === "clear") {
      setTerminalLines([]);
      setTerminalInput("");
      return;
    }
    let output: string[];
    if (command === "help") output = ["可用命令：help, ls, cd, pwd, echo, mkdir, touch, clear, whoami, date", "这是一个安全的浏览器内虚拟文件系统。"];
    else if (command === "ls") {
      const entries = virtualDirectoryEntries(virtualFileSystem, terminalCwd);
      output = [entries.length ? entries.map((entry) => entry.type === "directory" ? `${entry.name}/` : entry.name).join("    ") : "（空目录）"];
    }
    else if (command === "pwd") output = [terminalCwd];
    else if (command === "whoami") output = ["freshdesk"];
    else if (command === "date") output = [new Date().toLocaleString("zh-CN")];
    else if (command === "echo") output = [argument];
    else if (command === "cd") {
      const target = virtualPath(argument || "~", terminalCwd);
      if (virtualFileSystem.directories.includes(target)) { setTerminalCwd(target); output = []; }
      else output = [`cd: no such directory: ${argument || "~"}`];
    } else if (command === "mkdir") {
      if (!argument) output = ["mkdir: missing operand"];
      else {
        const target = virtualPath(argument, terminalCwd);
        if (virtualFileSystem.directories.includes(target) || virtualFileSystem.files.includes(target)) output = [`mkdir: ${argument}: File exists`];
        else if (!virtualFileSystem.directories.includes(virtualParent(target))) output = [`mkdir: cannot create directory '${argument}': No such file or directory`];
        else { setVirtualFileSystem((fileSystem) => ({ ...fileSystem, directories: [...fileSystem.directories, target] })); output = [`已创建目录 ${displayVirtualPath(target)}`]; }
      }
    } else if (command === "touch") {
      if (!argument) output = ["touch: missing file operand"];
      else {
        const target = virtualPath(argument, terminalCwd);
        if (!virtualFileSystem.directories.includes(virtualParent(target))) output = [`touch: cannot touch '${argument}': No such file or directory`];
        else { if (!virtualFileSystem.files.includes(target)) { setVirtualFileSystem((fileSystem) => ({ ...fileSystem, files: [...fileSystem.files, target] })); setFileContents((contents) => ({ ...contents, [target]: "" })); } output = [`已创建文件 ${displayVirtualPath(target)}`]; }
      }
    } else output = [`${command}: command not found`, "输入 help 查看可用命令。"];
    setTerminalLines((lines) => [...lines, prompt, ...output]);
    setTerminalInput("");
  };

  const desktopBackupPayload = () => createDesktopBackup(desktopSnapshotRef.current ?? {});

  const downloadBackupInBrowser = (backup: ReturnType<typeof desktopBackupPayload>) => {
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = desktopBackupFilename();
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const exportDesktopState = async () => {
    const backup = desktopBackupPayload();
    try {
      if (isElectronDesktop && window.freshdeskDesktop?.exportDesktopState) {
        const result = await window.freshdeskDesktop.exportDesktopState(backup);
        setDesktopBackupStatus(result.saved ? `已导出：${result.path ?? "已选择的位置"}` : "已取消导出。");
        return;
      }
      downloadBackupInBrowser(backup);
      setDesktopBackupStatus("已导出 JSON 文件，请保存在安全的位置。");
    } catch {
      setDesktopBackupStatus("导出未完成，请检查文件夹权限后重试。");
    }
  };

  const createDesktopBackupFile = async () => {
    const backup = desktopBackupPayload();
    try {
      if (isElectronDesktop && window.freshdeskDesktop?.backupDesktopState) {
        const result = await window.freshdeskDesktop.backupDesktopState(backup);
        setDesktopBackupStatus(result.saved ? `已创建备份：${result.path ?? "文档\\Freshdesk Desktop Backups"}` : "备份未完成。");
        return;
      }
      downloadBackupInBrowser(backup);
      setDesktopBackupStatus("网页版已下载一份备份 JSON 文件。");
    } catch {
      setDesktopBackupStatus("备份未完成，请检查文件夹权限后重试。");
    }
  };

  const restoreDesktopBackup = async () => {
    if (!isElectronDesktop || !window.freshdeskDesktop?.openDesktopBackup) {
      setDesktopBackupStatus("网页版可导出备份；恢复操作请在 Windows 桌面版中完成。");
      return;
    }
    try {
      const result = await window.freshdeskDesktop.openDesktopBackup();
      if (!result.selected || !result.raw) { setDesktopBackupStatus("未选择备份文件。"); return; }
      const backup = parseDesktopBackup<DesktopSnapshot>(result.raw);
      if (!backup) { setDesktopBackupStatus("该文件不是可用的 Freshdesk Desktop 备份。未修改当前数据。"); return; }
      window.localStorage.setItem(DESKTOP_STATE_KEY, JSON.stringify(backup.snapshot));
      setDesktopBackupStatus("备份已验证并写入本机。重启应用后将恢复该状态。");
    } catch {
      setDesktopBackupStatus("恢复未完成，当前桌面数据未被修改。");
    }
  };

  const currentTime = now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  const currentDate = now.toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "short" });

  const desktopItems = [
    { label: "我的文件", sublabel: "8 个项目", icon: Folder, app: "finder" as AppName },
    { label: "灵感相册", sublabel: "12 张照片", icon: Image, app: "photos" as AppName },
    { label: "开机笔记", sublabel: "刚刚创建", icon: MessageSquareText, app: "notes" as AppName },
    { label: "天气", sublabel: `${currentWeather.city} ${temperature(currentWeather.temp)}`, icon: CloudSun, app: "weather" as AppName },
    { label: "日历", sublabel: `${calendarEntries.length} 个事件`, icon: CalendarDays, app: "calendar" as AppName },
    { label: "提醒事项", sublabel: `${reminders.length - completedReminders} 个待办`, icon: ListTodo, app: "reminders" as AppName },
  ];
  const managedWindows = orderWindowsByZIndex(windows);

  return (
    <main className={`desktop-stage ${systemAppearance === "dark" ? "desktop-dark" : "desktop-light"} ${snapPreview ? `snap-preview-${snapPreview}` : ""}`} onClick={() => { setSelectedDesktop(null); if (activePanel !== "about") setActivePanel(null); }}>
      <div className="wallpaper" style={{ backgroundImage: `url(${activeWallpaper.src})` }} />
      <div className="wallpaper-veil" />
      {snapPreview && <div className={`desktop-snap-preview desktop-snap-${snapPreview}`}><span>{snapLabel(snapPreview)}</span></div>}
      <audio
        ref={audioRef}
        src={current.src}
        preload="metadata"
        onTimeUpdate={(event) => setProgress(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 150)}
        onEnded={() => skipTrack(1)}
      />

      <header className="system-menubar" onClick={(event) => event.stopPropagation()}>
        <div className="menu-left">
          <button className="brand-button" aria-label="关于 Freshdesk Desktop" onClick={() => setActivePanel(activePanel === "about" ? null : "about")}>
            <img src={BRAND_MARK} alt="Freshdesk 标识" />
          </button>
          <button className="menu-word active" onClick={() => setActivePanel(activePanel === "about" ? null : "about")}>Freshdesk</button>
          <button className="menu-word" onClick={() => openApp("finder")}>文件</button>
          <button className="menu-word" onClick={() => openApp("notes")}>编辑</button>
          <button className="menu-word" onClick={() => openApp("photos")}>视图</button>
          <button className="menu-word" onClick={() => setActivePanel(activePanel === "windows" ? null : "windows")}>窗口</button>
          <button className="menu-word" onClick={() => setActivePanel("about")}>帮助</button>
        </div>
        <div className="menu-right">
          <button className="status-icon" aria-label="打开控制中心" onClick={() => setActivePanel(activePanel === "control" ? null : "control")}><SlidersHorizontal size={16} /></button>
          <button className="status-icon" aria-label="打开聚焦搜索" onClick={() => setActivePanel(activePanel === "spotlight" ? null : "spotlight")}><Search size={16} /></button>
          <button className="time-button" onClick={() => setActivePanel(activePanel === "calendar" ? null : "calendar")}>{currentDate}&nbsp;&nbsp;{currentTime}</button>
        </div>
      </header>

      <section className="desktop-main" aria-label="桌面">
        <div className="desktop-greeting">
          <div className="greeting-orbit"><span /><span /><span /><span /></div>
          <p>Freshdesk Desktop</p>
          <h1>把今天放到桌面上。</h1>
          <button onClick={() => openApp("notes")}>打开第一张便笺 <ChevronRight size={15} /></button>
        </div>

        <div className="desktop-icons" aria-label="桌面项目">
          {desktopItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={`desktop-item ${selectedDesktop === item.label ? "selected" : ""}`}
                key={item.label}
                onClick={(event) => { event.stopPropagation(); setSelectedDesktop(item.label); }}
                onDoubleClick={() => openApp(item.app)}
              >
                <span className="desktop-icon"><Icon size={38} strokeWidth={1.55} /></span>
                <span className="desktop-item-label">{item.label}</span>
                <span className="desktop-item-sub">{item.sublabel}</span>
              </button>
            );
          })}
        </div>
        <aside className="desktop-widgets" aria-label="桌面小组件">
          <button className="desktop-widget weather-widget" onClick={() => openApp("weather")}><div className="widget-top"><span>天气</span><MapPin size={12} /></div><div className="widget-weather-main">{weatherSymbol("partly", 27)}<strong>{temperature(currentWeather.temp)}</strong><span>{currentWeather.city}</span></div><p>{currentWeather.condition} · 最高 {temperature(currentWeather.high)}</p></button>
          <button className="desktop-widget reminders-widget" onClick={() => openApp("reminders")}><div className="widget-top"><span>提醒事项</span><ListTodo size={12} /></div><strong>{reminders.find((item) => !item.done)?.title ?? "今天全部完成"}</strong><p>{completedReminders} / {reminders.length} 已完成 · 点击查看</p></button>
        </aside>
      </section>

      <section className="now-playing-chip" onClick={(event) => { event.stopPropagation(); openApp("music"); }} aria-label="当前播放">
        <img src={current.cover} alt="当前专辑封面" />
        <div>
          <strong>{current.title}</strong>
          <span>{isPlaying ? "正在播放" : "准备播放"}</span>
        </div>
        <button aria-label={isPlaying ? "暂停" : "播放"} onClick={(event) => { event.stopPropagation(); playMusic(); }}>
          {isPlaying ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
        </button>
      </section>

      {windows.map((windowItem) => !windowItem.minimized && (
        <div className="window-layer" key={windowItem.id} style={{ zIndex: windowItem.zIndex }}>
          {windowItem.id === "finder" && (
            <WindowChrome title="我的文件" appWindow={windowItem} onClose={() => closeApp("finder")} onMinimize={() => minimizeApp("finder")} onFocus={() => bringToFront("finder")} onMaximize={() => toggleMaximize("finder")} onBoundsChange={(bounds) => updateWindowBounds("finder", bounds)} onSnapPreviewChange={setSnapPreview} onSnap={(side) => snapWindow("finder", side)} className="finder-window">
              <div className="finder-body">
                <aside className="finder-sidebar">
                  <p>个人收藏</p>
                  <button className={finderPath === VIRTUAL_HOME ? "sidebar-active" : ""} onClick={() => changeFinderPath(VIRTUAL_HOME)}><FolderOpen size={15} /> 我的文件</button>
                  <button onClick={() => openApp("photos")}><Image size={15} /> 灵感相册</button>
                  <button className={finderPath === `${VIRTUAL_HOME}/Downloads` ? "sidebar-active" : ""} onClick={() => changeFinderPath(`${VIRTUAL_HOME}/Downloads`)}><Archive size={15} /> 下载项</button>
                  <p>位置</p>
                  <button className={finderPath === `${VIRTUAL_HOME}/Pictures` ? "sidebar-active" : ""} onClick={() => changeFinderPath(`${VIRTUAL_HOME}/Pictures`)}><Image size={15} /> 图片</button>
                  <button onClick={() => changeFinderPath(VIRTUAL_HOME)}><CloudSun size={15} /> Freshdesk Drive</button>
                </aside>
                <div className="finder-content">
                  <div className="finder-toolbar"><nav aria-label="文件夹导航"><button aria-label="返回上级目录" disabled={finderPath === VIRTUAL_HOME} onClick={() => changeFinderPath(virtualParent(finderPath))}><ChevronLeft size={17} /></button><button aria-label="前进目录" disabled><ChevronRight size={17} /></button></nav><strong>{finderPath === VIRTUAL_HOME ? "我的文件" : virtualName(finderPath)}</strong><label className="finder-search"><Search size={13} /><input value={finderSearch} onChange={(event) => setFinderSearch(event.target.value)} placeholder="查找文件" aria-label="Finder 文件搜索" /><select value={finderSearchScope} onChange={(event) => setFinderSearchScope(event.target.value as "current" | "downloads" | "pictures")} aria-label="文件搜索范围"><option value="current">当前目录</option><option value="downloads">下载项</option><option value="pictures">图片</option></select></label><span className="finder-toolbar-note">{finderSearch.trim() ? `${finderSearchResults.length} 个结果` : `${displayVirtualPath(finderPath)} · 双击打开`}</span><LayoutGrid size={17} /></div>
                  <div className="folder-grid finder-grid">
                    {visibleFinderEntries.map((entry) => {
                      const path = finderSearch.trim() ? (entry as unknown as { path: string }).path : `${finderPath}/${entry.name}`;
                      if (entry.type === "directory") return <button key={path} className="folder-card" onDoubleClick={() => changeFinderPath(path)}><Folder size={44} fill="#a4c8ff" strokeWidth={1.2} /><strong>{entry.name}</strong><span>双击打开</span></button>;
                      return <div key={path} className="finder-file-wrap"><button className="folder-card finder-file-card" draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; setDraggedFilePath(path); }} onDragEnd={() => setDraggedFilePath(null)} onContextMenu={(event) => openFinderContextMenu(event, path)} onDoubleClick={() => isTextFile(path) ? openTextEditor(path) : previewableFile(path) && setPreviewFilePath(path)}><FilePlus2 size={38} strokeWidth={1.35} />{renamingPath === path ? <input autoFocus aria-label="重命名文件" value={renameValue} onClick={(event) => event.stopPropagation()} onChange={(event) => setRenameValue(event.target.value)} onBlur={commitRenameFile} onKeyDown={(event) => { if (event.key === "Enter") commitRenameFile(); if (event.key === "Escape") setRenamingPath(null); }} /> : <strong>{entry.name}</strong>}<span>{isTextFile(path) ? "双击编辑 · 右键操作" : previewableFile(path) ? "双击预览 · 右键操作" : "可拖到回收站"}</span></button><button className="finder-rename" aria-label={`重命名 ${entry.name}`} onClick={() => startRenameFile(path)}><Pencil size={13} /></button></div>;
                    })}
                  </div>
                  <div className="finder-footer"><span>{finderSearch.trim() ? `${finderSearchResults.length} 个匹配结果` : `${finderEntries.length} 个项目`}</span><span>文本双击编辑 · 右键可管理 · 拖放删除</span></div>
                  {previewFilePath && <div className="finder-preview" role="dialog" aria-label="文件预览"><header><div><FileText size={16} /><span>{virtualName(previewFilePath)}</span></div><div>{isTextFile(previewFilePath) && <button className="finder-preview-edit" onClick={() => openTextEditor(previewFilePath)}><FilePenLine size={13} /> 编辑</button>}{isImageFile(previewFilePath) && <button className="finder-preview-edit" onClick={() => setFileAsWallpaper(previewFilePath)}><Palette size={13} /> 设为壁纸</button>}<button aria-label="关闭文件预览" onClick={() => setPreviewFilePath(null)}><X size={15} /></button></div></header>{isImageFile(previewFilePath) ? <img src={previewFileImage(previewFilePath)} alt={virtualName(previewFilePath)} /> : <pre>{previewFileText(previewFilePath)}</pre>}</div>}
                  {fileInfoPath && <div className="finder-file-info" role="dialog" aria-label="文件属性"><header><strong>文件属性</strong><button aria-label="关闭文件属性" onClick={() => setFileInfoPath(null)}><X size={14} /></button></header><dl><div><dt>名称</dt><dd>{virtualName(fileInfoPath)}</dd></div><div><dt>位置</dt><dd>{displayVirtualPath(virtualParent(fileInfoPath))}</dd></div><div><dt>类型</dt><dd>{isTextFile(fileInfoPath) ? "文本文件" : isImageFile(fileInfoPath) ? "图片" : "文件"}</dd></div><div><dt>大小</dt><dd>{fileContents[fileInfoPath] ? `${fileContents[fileInfoPath].length} 个字符` : "—"}</dd></div></dl></div>}
                  {finderContextMenu && <aside className="finder-context-menu" role="menu" style={{ left: finderContextMenu.x, top: finderContextMenu.y }}><button role="menuitem" disabled={!isTextFile(finderContextMenu.path)} onClick={() => openTextEditor(finderContextMenu.path)}><FilePenLine size={14} />编辑</button><button role="menuitem" disabled={!isImageFile(finderContextMenu.path)} onClick={() => { setFileAsWallpaper(finderContextMenu.path); setFinderContextMenu(null); }}><Palette size={14} />设为壁纸</button><button role="menuitem" onClick={() => { startRenameFile(finderContextMenu.path); setFinderContextMenu(null); }}><Pencil size={14} />重命名</button><button role="menuitem" onClick={() => { setFileInfoPath(finderContextMenu.path); setFinderContextMenu(null); }}><CircleHelp size={14} />查看属性</button><button role="menuitem" className="danger" onClick={() => { moveFileToTrash(finderContextMenu.path); setFinderContextMenu(null); }}><Trash2 size={14} />移到回收站</button></aside>}
                </div>
              </div>
            </WindowChrome>
          )}

          {windowItem.id === "trash" && (
            <WindowChrome title="回收站" appWindow={windowItem} onClose={() => closeApp("trash")} onMinimize={() => minimizeApp("trash")} onFocus={() => bringToFront("trash")} onMaximize={() => toggleMaximize("trash")} onBoundsChange={(bounds) => updateWindowBounds("trash", bounds)} onSnapPreviewChange={setSnapPreview} onSnap={(side) => snapWindow("trash", side)} className="trash-window">
              <div className="trash-body"><header><div><span className="eyebrow">文件恢复中心</span><h2>回收站</h2><p>{trashItems.length ? "文件会暂留在这里，直到你主动清空。" : "目前没有已删除文件。"}</p></div><button className="trash-empty" disabled={!trashItems.length} onClick={() => setTrashItems([])}><Trash2 size={14} /> 清空回收站</button></header>{trashItems.length ? <div className="trash-list">{trashItems.map((item) => <article key={item.id}><div className="trash-file-icon"><FilePlus2 size={21} /></div><div><strong>{virtualName(item.path)}</strong><span>{displayVirtualPath(virtualParent(item.path))} · {item.deletedAt} 删除</span></div><button onClick={() => restoreTrashItem(item)}><RotateCw size={14} /> 恢复</button></article>)}</div> : <div className="trash-empty-state"><Trash2 size={34} /><strong>回收站是空的</strong><span>在“我的文件”中把文件拖到 Dock 的回收站即可删除。</span></div>}</div>
            </WindowChrome>
          )}

          {windowItem.id === "music" && (
            <WindowChrome title="音乐" appWindow={windowItem} onClose={() => closeApp("music")} onMinimize={() => minimizeApp("music")} onFocus={() => bringToFront("music")} onMaximize={() => toggleMaximize("music")} onBoundsChange={(bounds) => updateWindowBounds("music", bounds)} onSnapPreviewChange={setSnapPreview} onSnap={(side) => snapWindow("music", side)} className="music-window">
              <div className="music-body">
                <aside className="music-sidebar"><div className="music-brand"><img src={BRAND_MARK} alt="" /> <span>Freshdesk Music</span></div><button className="library-active"><Headphones size={16} /> 现在收听</button><button><Compass size={16} /> 浏览</button><button><Grid2X2 size={16} /> 资料库</button><div className="playlist-add"><span>播放列表</span><Plus size={15} /></div><button className="playlist"><span className="playlist-dot coral" /> 已添加</button><button className="playlist"><span className="playlist-dot sky" /> 工作流</button></aside>
                <div className="music-content">
                  <div className="music-hero"><div><span className="eyebrow">为此刻准备</span><h2>空间感<br />收藏。</h2><p>一些适合打开新桌面时聆听的声音。</p></div><img src={ALBUM_TIDE} alt="抽象音乐封面" /></div>
                  <div className="album-heading"><h3>今天的选择</h3><button>查看全部 <ChevronRight size={14} /></button></div>
                  <div className="album-row">
                    {tracks.map((track, index) => <button className={`album-tile ${index === currentTrack ? "active" : ""}`} key={track.title} onClick={() => { setCurrentTrack(index); setProgress(0); openApp("music"); }}><img src={track.cover} alt="" /><strong>{track.title}</strong><span>{track.artist}</span></button>)}
                  </div>
                  <div className="track-list">{tracks.map((track, index) => <button key={track.title} onClick={() => { setCurrentTrack(index); setProgress(0); if (!isPlaying) playMusic(); }}><span className="track-index">{index === currentTrack && isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}</span><img src={track.cover} alt="" /><div><strong>{track.title}</strong><span>{track.artist}</span></div><span>{track.time}</span><MoreHorizontal size={18} /></button>)}</div>
                </div>
              </div>
              <div className="music-player"><img src={current.cover} alt="" /><div className="player-track"><strong>{current.title}</strong><span>{current.artist}</span><input aria-label="播放进度" type="range" min={0} max={duration || 150} value={progress} onChange={(event) => { const value = Number(event.target.value); setProgress(value); if (audioRef.current) audioRef.current.currentTime = value; }} /></div><span className="player-time">{formatDuration(progress)} / {formatDuration(duration)}</span><div className="player-controls"><button aria-label="上一首" onClick={() => skipTrack(-1)}><ChevronLeft size={18} /></button><button className="main-play" aria-label={isPlaying ? "暂停" : "播放"} onClick={playMusic}>{isPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}</button><button aria-label="下一首" onClick={() => skipTrack(1)}><ChevronRight size={18} /></button></div><Volume2 size={16} /><input className="volume-slider" aria-label="音量" type="range" min={0} max={100} value={volume} onChange={(event) => setVolume(Number(event.target.value))} /></div>
            </WindowChrome>
          )}

          {windowItem.id === "notes" && (
            <WindowChrome title="便笺" appWindow={windowItem} onClose={() => closeApp("notes")} onMinimize={() => minimizeApp("notes")} onFocus={() => bringToFront("notes")} onMaximize={() => toggleMaximize("notes")} onBoundsChange={(bounds) => updateWindowBounds("notes", bounds)} onSnapPreviewChange={setSnapPreview} onSnap={(side) => snapWindow("notes", side)} className="notes-window">
              <div className="notes-body"><aside className="notes-sidebar"><button className="new-note" onClick={createNote}><Plus size={16} /> 新建便笺</button><p>便笺</p>{notes.map((item) => <button className={`note-list-item ${item.id === activeNote.id ? "active" : ""}`} key={item.id} onClick={() => setActiveNoteId(item.id)}><span>{item.title || "未命名便笺"}</span><small>{item.updated}</small></button>)}</aside><article className="note-editor"><header><div><input className="note-title-input" value={activeNote.title} onChange={(event) => updateActiveNote({ title: event.target.value })} aria-label="便笺标题" /><span>{currentDate} · 已自动存储</span></div><button aria-label="新建便笺" onClick={createNote}><FilePlus2 size={18} /></button></header><textarea value={activeNote.body} onChange={(event) => updateActiveNote({ body: event.target.value })} aria-label="编辑便笺" /><footer><span>⌘S 自动储存</span><span>{activeNote.body.length} 个字符</span></footer></article></div>
            </WindowChrome>
          )}

          {windowItem.id === "editor" && (
            <WindowChrome title={editorPath ? virtualName(editorPath) : "文本编辑"} appWindow={windowItem} onClose={() => closeApp("editor")} onMinimize={() => minimizeApp("editor")} onFocus={() => bringToFront("editor")} onMaximize={() => toggleMaximize("editor")} onBoundsChange={(bounds) => updateWindowBounds("editor", bounds)} onSnapPreviewChange={setSnapPreview} onSnap={(side) => snapWindow("editor", side)} className="text-editor-window">
              <div className="text-editor-body"><aside className="text-editor-sidebar"><button className="text-editor-new" onClick={createTextDocument}><Plus size={15} /> 新建文稿</button><p>当前文稿</p>{editorPath ? <div className="text-editor-current"><FileText size={16} /><span>{virtualName(editorPath)}</span><small>{displayVirtualPath(virtualParent(editorPath))}</small></div> : <div className="text-editor-empty-side"><FilePenLine size={20} /><span>从 Finder 打开文本文件，或新建一份文稿。</span></div>}</aside><section className="text-editor-main">{editorPath ? <><header><div><span className="eyebrow">Freshdesk 文本编辑</span><strong>{virtualName(editorPath)}</strong><small>{displayVirtualPath(editorPath)}</small></div><button onClick={saveEditorDocument}><FileText size={14} /> 保存</button></header><textarea value={editorDraft} onChange={(event) => setEditorDraft(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") { event.preventDefault(); saveEditorDocument(); } }} aria-label="编辑文本文件" /><footer><span>⌘S 保存至本机桌面状态</span><span>{editorDraft.length} 个字符</span></footer></> : <div className="text-editor-empty"><FilePenLine size={34} /><strong>准备写点什么？</strong><span>在 Finder 中双击 .txt 或 .md 文件即可编辑，也可以直接新建文稿。</span><button onClick={createTextDocument}><Plus size={14} /> 新建文稿</button></div>}</section></div>
            </WindowChrome>
          )}

          {windowItem.id === "photos" && (
            <WindowChrome title="灵感相册" appWindow={windowItem} onClose={() => closeApp("photos")} onMinimize={() => minimizeApp("photos")} onFocus={() => bringToFront("photos")} onMaximize={() => toggleMaximize("photos")} onBoundsChange={(bounds) => updateWindowBounds("photos", bounds)} onSnapPreviewChange={setSnapPreview} onSnap={(side) => snapWindow("photos", side)} className="photos-window">
              <div className="photos-body">{selectedPhoto ? <div className="photo-viewer"><div className="photo-viewer-top"><button className="photo-back" onClick={() => setSelectedPhotoId(null)}><ChevronLeft size={16} /> 图库</button><span>{Math.max(1, photoItems.findIndex((photo) => photo.id === selectedPhoto.id) + 1)} / {photoItems.length}</span><div><button aria-label="上一张图片" onClick={() => movePhoto(-1)}><ChevronLeft size={16} /></button><button aria-label="下一张图片" onClick={() => movePhoto(1)}><ChevronRight size={16} /></button></div></div><div className="photo-stage"><button className="photo-stage-control left" aria-label="上一张图片" onClick={() => movePhoto(-1)}><ChevronLeft size={22} /></button><img src={selectedPhoto.src} alt={selectedPhoto.alt} /><button className="photo-stage-control right" aria-label="下一张图片" onClick={() => movePhoto(1)}><ChevronRight size={22} /></button></div><div className="photo-viewer-meta"><div><span className="eyebrow">已打开 · 可用左右箭头切换</span><h2>{selectedPhoto.title}</h2><p>{selectedPhoto.subtitle} · 可在“桌面与外观”中设为壁纸。</p></div><button className="photo-set-wallpaper" onClick={() => setWallpaperFromSource(selectedPhoto.src, selectedPhoto.title)}>设为壁纸</button></div></div> : <><header><div><span className="eyebrow">灵感相册</span><h2>{photoViewMode === "library" ? "我的图库。" : "光线留下的痕迹。"}</h2></div><div className="photos-view-actions"><button className={photoViewMode === "highlights" ? "active" : ""} onClick={() => setPhotoViewMode("highlights")}><Sparkles size={15} /> 精选</button><button className={photoViewMode === "library" ? "active" : ""} onClick={() => setPhotoViewMode("library")}><LayoutGrid size={15} /> 图库</button></div></header>{photoViewMode === "library" ? <div className="photo-library-grid">{photoItems.map((photo) => <button key={photo.id} className="photo-library-item" onClick={() => setSelectedPhotoId(photo.id)}><img src={photo.src} alt={photo.alt} /><span><b>{photo.title}</b><small>{photo.subtitle}</small></span></button>)}</div> : <><div className="photo-mosaic">{photoItems.slice(0, 4).map((photo) => <button key={photo.id} className="photo-tile" onClick={() => setSelectedPhotoId(photo.id)}><img src={photo.src} alt={photo.alt} /><span>{photo.title}</span></button>)}<button className="mosaic-caption" onClick={() => { setPhotoViewMode("library"); setSelectedPhotoId("alpine"); }}><Sparkles size={17} /><span>最近添加<br /><b>2 张壁纸</b></span></button></div><p>点开任意照片可查看大图；打开后可点击控制按钮或使用键盘左右箭头切换。</p></>}</>}</div>
            </WindowChrome>
          )}

          {windowItem.id === "settings" && (
            <WindowChrome title="设置" appWindow={windowItem} onClose={() => closeApp("settings")} onMinimize={() => minimizeApp("settings")} onFocus={() => bringToFront("settings")} onMaximize={() => toggleMaximize("settings")} onBoundsChange={(bounds) => updateWindowBounds("settings", bounds)} onSnapPreviewChange={setSnapPreview} onSnap={(side) => snapWindow("settings", side)} className="settings-window">
              <div className="settings-body"><aside className="settings-sidebar"><div className="settings-profile"><img src={BRAND_MARK} alt="" /><div><strong>你的工作空间</strong><span>本机帐户</span></div></div><button className="settings-active"><Wifi size={16} /> Wi‑Fi</button><button><Bluetooth size={16} /> 蓝牙</button><button><Moon size={16} /> 专注模式</button><button><Gauge size={16} /> 桌面与外观</button></aside><section className="settings-content"><header><h2>桌面与外观</h2><p>按照此刻的光线调整你的工作空间。</p></header><div className="setting-block"><div><strong>外观</strong><span>让系统界面与壁纸保持平衡。</span></div><div className="appearance-choice"><button className={systemAppearance === "light" ? "chosen" : ""} onClick={() => setSystemAppearance("light")}><span className="light-preview" />浅色</button><button className={systemAppearance === "dark" ? "chosen" : ""} onClick={() => setSystemAppearance("dark")}><span className="dark-preview" />深色</button></div></div><div className="setting-block wallpaper-block"><div><strong><Palette size={13} /> 桌面壁纸</strong><span>选择一张原创背景，立即应用到桌面。</span></div><div className="wallpaper-options">{wallpapers.map((wallpaper) => <button key={wallpaper.id} className={activeWallpaperId === wallpaper.id ? "selected" : ""} onClick={() => setActiveWallpaperId(wallpaper.id)}><img src={wallpaper.src} alt="" /><span>{wallpaper.title}</span></button>)}</div></div><div className="setting-block"><div><strong>应用更新</strong><span>{desktopUpdateStatus}</span></div><button className="soft-action" disabled={!isElectronDesktop} onClick={() => void window.freshdeskDesktop?.checkForUpdates()}>检查更新</button></div><div className="setting-block setting-data-block"><div><strong>桌面数据</strong><span>{desktopBackupStatus}</span></div><div className="settings-data-actions"><button className="soft-action" onClick={() => void exportDesktopState()}><Download size={13} /> 导出</button><button className="soft-action" onClick={() => void createDesktopBackupFile()}><Archive size={13} /> 备份</button><button className="soft-action" disabled={!isElectronDesktop} onClick={() => void restoreDesktopBackup()}><RotateCw size={13} /> 恢复</button></div></div><div className="setting-block"><div><strong>新手引导</strong><span>重新查看欢迎界面和桌面提示。</span></div><button className="soft-action" onClick={() => { setSetupComplete(false); setShowSetupChoice(false); }}>再次打开</button></div><div className="setting-block"><div><strong>音量</strong><span>当前输出：内建扬声器</span></div><input aria-label="系统音量" type="range" min={0} max={100} value={volume} onChange={(event) => setVolume(Number(event.target.value))} /></div></section></div>
            </WindowChrome>
          )}

          {windowItem.id === "browser" && (
            <WindowChrome title="浏览器" appWindow={windowItem} onClose={() => closeApp("browser")} onMinimize={() => minimizeApp("browser")} onFocus={() => bringToFront("browser")} onMaximize={() => toggleMaximize("browser")} onBoundsChange={(bounds) => updateWindowBounds("browser", bounds)} onSnapPreviewChange={setSnapPreview} onSnap={(side) => snapWindow("browser", side)} className="browser-window">
              <div className="browser-body">
                <div className="browser-tabstrip" aria-label="浏览器标签页">
                  <div className="browser-tabs">
                    {pinnedTabs.map((tab) => renderBrowserTab(tab))}
                    {browserTabGroups.map((group) => <div className={`browser-tab-group ${group.collapsed ? "collapsed" : ""}`} style={{ "--group-color": group.color } as React.CSSProperties} key={group.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); if (draggedTabId) assignBrowserTabToGroup(draggedTabId, group.id); setDraggedTabId(null); }}><button className="browser-group-label" onClick={() => toggleGroupCollapsed(group.id)}><i /><span>{group.title}</span><small>{groupedTabs(group.id).length}</small></button>{!group.collapsed && groupedTabs(group.id).map((tab) => renderBrowserTab(tab, group.color))}</div>)}
                    {ungroupedTabs.map((tab) => renderBrowserTab(tab))}
                  </div>
                  <button className="browser-tab-add" aria-label="新建标签页" onClick={() => addBrowserTab()}><Plus size={15} /></button>
                  <button className={`browser-groups-toggle ${groupsOpen ? "active" : ""}`} aria-label="管理标签页分组" onClick={() => { setGroupsOpen(!groupsOpen); setBookmarksOpen(false); }}><LayoutGrid size={14} /><span>分组</span></button>
                  <button className={`browser-bookmarks-toggle ${bookmarksOpen ? "active" : ""}`} aria-label="打开书签收藏夹" onClick={() => { setBookmarksOpen(!bookmarksOpen); setGroupsOpen(false); }}><Bookmark size={14} /><span>收藏</span></button>
                  <button className={`browser-bookmarks-toggle ${historyOpen ? "active" : ""}`} aria-label="打开浏览历史" onClick={() => { setHistoryOpen(!historyOpen); setBookmarksOpen(false); setGroupsOpen(false); setDownloadsOpen(false); }}><History size={14} /><span>历史</span></button>
                  <button className={`browser-bookmarks-toggle ${recentVideosOpen ? "active" : ""}`} aria-label="打开最近播放" onClick={() => { setRecentVideosOpen(!recentVideosOpen); setBookmarksOpen(false); setGroupsOpen(false); setDownloadsOpen(false); setHistoryOpen(false); }}><Play size={14} /><span>最近</span></button>
                  <button className={`browser-bookmarks-toggle ${downloadsOpen ? "active" : ""}`} aria-label="打开下载项" onClick={() => { setDownloadsOpen(!downloadsOpen); setBookmarksOpen(false); setGroupsOpen(false); setHistoryOpen(false); }}><Download size={14} /><span>下载</span></button>
                </div>
                <form className="browser-toolbar" onSubmit={(event) => { event.preventDefault(); navigateBrowser(activeBrowserTab.address); }}>
                  <div className="browser-nav-controls">
                    <button type="button" aria-label="后退" disabled={activeBrowserTab.mode !== "media" && activeBrowserTab.historyIndex === 0} onClick={() => activeBrowserTab.mode === "media" ? returnToReader() : stepBrowserHistory(-1)}><ArrowLeft size={16} /></button>
                    <button type="button" aria-label="前进" disabled={activeBrowserTab.historyIndex >= activeBrowserTab.history.length - 1} onClick={() => stepBrowserHistory(1)}><ArrowRight size={16} /></button>
                    <button type="button" aria-label="刷新" onClick={refreshBrowser}><RotateCw size={15} className={activeBrowserTab.loading ? "spinning" : ""} /></button>
                  </div>
                  <div className={`browser-address ${activeBrowserTab.loading ? "loading" : ""}`}><Globe2 size={14} /><input value={activeBrowserTab.address} onChange={(event) => updateBrowserAddress(event.target.value)} aria-label="输入网址" placeholder="输入网址或搜索内容" /><button type="submit">前往</button></div>
                  <button type="button" className={`bookmark-current ${bookmarks.some((bookmark) => bookmark.url === activeBrowserTab.url) ? "saved" : ""}`} aria-label="收藏当前页面" onClick={toggleCurrentBookmark}>{bookmarks.some((bookmark) => bookmark.url === activeBrowserTab.url) ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}</button>
                  <span className="browser-status">{activeBrowserTab.loading ? "正在连接" : "浏览器"}</span>
                </form>
                <div className="browser-frame-wrap" onPointerDownCapture={focusElectronWebview}>
                  {activeBrowserTab.mode === "web" && isElectronDesktop ? createElement("webview", { key: `${activeBrowserTab.id}-${activeBrowserTab.reloadNonce}`, ref: (node: HTMLElement | null) => { electronWebviewRef.current = node; }, className: "browser-webview", src: activeBrowserTab.url, partition: "persist:freshdesk-browser", webpreferences: "contextIsolation=yes, sandbox=yes", allowpopups: "true", tabIndex: 0, onFocus: () => bringToFront("browser"), onDomReady: focusElectronWebview }) : null}
                  {activeBrowserTab.mode === "media" ? (
                    <section className="browser-media-page">
                      <header><div><span className="eyebrow">当前标签 · 图片查看</span><h2>{activeBrowserTab.title}</h2><p>{activeBrowserTab.mediaItems?.length ? `${(activeBrowserTab.mediaIndex ?? 0) + 1} / ${activeBrowserTab.mediaItems.length} · 图片留在当前标签中查看` : "公开图片资源"}</p></div><div className="media-actions"><button onClick={returnToReader}><ArrowLeft size={14} /> 返回文章</button><button onClick={downloadCurrentImage}><Download size={14} /> 下载到 Finder</button><button onClick={() => setMediaZoom((value) => Math.max(60, value - 20))} aria-label="缩小图片"><ZoomOut size={15} /></button><span>{mediaZoom}%</span><button onClick={() => setMediaZoom((value) => Math.min(220, value + 20))} aria-label="放大图片"><ZoomIn size={15} /></button></div></header><div className="browser-media-stage"><button aria-label="上一张图片" disabled={(activeBrowserTab.mediaItems?.length ?? 0) < 2} onClick={() => stepReaderImage(-1)}><ChevronLeft size={22} /></button><figure>{mediaImageError ? <div className="browser-media-error"><CircleHelp size={24} /><strong>图片暂时无法加载</strong><span>{mediaImageError}</span><button onClick={() => setMediaImageError(null)}>重试</button></div> : <img src={activeBrowserTab.url} alt={activeBrowserTab.title} style={{ transform: `scale(${mediaZoom / 100})` }} onError={() => setMediaImageError("该图片来源拒绝了嵌入或暂时不可用。可返回文章继续阅读其他内容。")} />}<figcaption>{activeBrowserTab.title}</figcaption></figure><button aria-label="下一张图片" disabled={(activeBrowserTab.mediaItems?.length ?? 0) < 2} onClick={() => stepReaderImage(1)}><ChevronRight size={22} /></button></div><div className="browser-media-strip">{activeBrowserTab.mediaItems?.map((item, index) => <button key={item.src} className={index === activeBrowserTab.mediaIndex ? "active" : ""} onClick={() => { updateActiveBrowserTab((tab) => ({ ...tab, mediaIndex: index, title: item.alt || "网页图片", address: item.src, url: item.src })); setMediaImageError(null); }}><img src={item.src} alt={item.alt} /></button>)}</div></section>
                  ) : activeBrowserTab.mode === "video" ? (
                    <section className="browser-video-page">
                      <header><div><span className="eyebrow">当前标签 · 视频播放</span><h2>{activeBrowserTab.title}</h2><p>{activeBrowserTab.videoSource?.provider ?? "视频"} · {activeBrowserTab.videoSource?.kind === "restricted" ? "此服务的播放策略需要网页模式。" : "正在尝试在浏览器内播放。"}</p></div><div className="media-actions"><button onClick={() => stepBrowserHistory(-1)} disabled={activeBrowserTab.historyIndex === 0}><ArrowLeft size={14} /> 返回上一页</button><button onClick={() => openInReader(activeBrowserTab.url, `阅读：${activeBrowserTab.title}`)}><FileText size={14} /> 兼容阅读</button><button onClick={() => updateActiveBrowserTab((tab) => ({ ...tab, mode: "web", title: labelFromUrl(tab.url), loading: true }))}><Globe2 size={14} /> 网页模式</button></div></header>
                      <div className="video-control-bar"><label><Gauge size={14} />速度<select aria-label="视频播放速度" value={videoPlaybackRate} disabled={activeBrowserTab.videoSource?.kind !== "direct" && activeBrowserTab.videoSource?.kind !== "hls"} onChange={(event) => setVideoPlaybackRate(Number(event.target.value))}><option value={0.75}>0.75×</option><option value={1}>1×</option><option value={1.25}>1.25×</option><option value={1.5}>1.5×</option><option value={2}>2×</option></select></label><button aria-label="切换画中画" disabled={activeBrowserTab.videoSource?.kind !== "direct" && activeBrowserTab.videoSource?.kind !== "hls"} onClick={() => void togglePictureInPicture()}><Maximize2 size={14} />画中画</button><button aria-label="切换字幕" disabled={activeBrowserTab.videoSource?.kind !== "direct" && activeBrowserTab.videoSource?.kind !== "hls"} onClick={toggleCaptions}><MessageSquareText size={14} />{captionsEnabled ? "字幕开" : "字幕关"}</button><label className="video-subtitle-input"><span>VTT</span><input aria-label="公开 VTT 字幕地址" value={videoSubtitleUrl} disabled={activeBrowserTab.videoSource?.kind !== "direct" && activeBrowserTab.videoSource?.kind !== "hls"} onChange={(event) => setVideoSubtitleUrl(event.target.value.trim())} placeholder="可选字幕地址" /></label>{activeBrowserTab.videoSource?.provider === "TikTok" ? <><button aria-label="TikTok 播放" onClick={() => controlTikTokPlayer("play")}><Play size={14} />播放</button><button aria-label="TikTok 暂停" onClick={() => controlTikTokPlayer("pause")}><Pause size={14} />暂停</button><button aria-label="TikTok 静音" onClick={() => controlTikTokPlayer("mute")}><Volume2 size={14} />静音</button></> : null}{videoControlNote ? <small>{videoControlNote}</small> : activeBrowserTab.videoSource?.kind === "embed" ? <small>播放速度、字幕与画中画由该平台的嵌入播放器提供。</small> : null}</div>
                      <div className="browser-video-stage">{videoError ? <div className="browser-video-error"><CircleHelp size={26} /><strong>该视频暂时无法在内置播放器中打开</strong><span>{videoError}</span><button onClick={() => openInReader(activeBrowserTab.url, `阅读：${activeBrowserTab.title}`)}>进入兼容阅读</button><button onClick={() => updateActiveBrowserTab((tab) => ({ ...tab, mode: "web", loading: true }))}>尝试网页模式</button><button className="video-report-action" disabled={videoReportStatus === "sending"} onClick={reportCurrentVideo}>{videoReportStatus === "reported" ? "已记录此链接" : videoReportStatus === "sending" ? "正在报告…" : "报告无法播放链接"}</button></div> : activeBrowserTab.videoSource?.kind === "restricted" ? <div className="browser-video-error"><CircleHelp size={26} /><strong>{activeBrowserTab.videoSource.provider} 需要网页模式</strong><span>{activeBrowserTab.videoSource.restriction}</span><small>本应用与当前标签已启用 JavaScript；但不能代替该站点的登录 Cookie、DRM 解密、地区授权或反爬校验。网页应用也不能在当前浏览器标签内嵌入独立 Chromium/Safari 内核。</small><button onClick={() => updateActiveBrowserTab((tab) => ({ ...tab, mode: "web", loading: true }))}>在当前标签打开官网</button><button onClick={() => openInReader(activeBrowserTab.url, `阅读：${activeBrowserTab.title}`)}>查看公开页面信息</button><button className="video-report-action" disabled={videoReportStatus === "sending"} onClick={reportCurrentVideo}>{videoReportStatus === "reported" ? "已记录此链接" : videoReportStatus === "sending" ? "正在报告…" : "报告无法播放链接"}</button></div> : activeBrowserTab.videoSource?.kind === "direct" ? <NativeVideoPlayer key={`${activeBrowserTab.url}-${activeBrowserTab.reloadNonce}`} src={activeBrowserTab.videoSource.src} playbackRate={videoPlaybackRate} subtitleUrl={videoSubtitleUrl} onReady={registerNativeVideo} onError={() => { setVideoError("该视频资源拒绝播放、需要登录、跨域授权或暂时不可用。你仍可尝试网页模式或兼容阅读。"); updateActiveBrowserTab((tab) => ({ ...tab, loading: false })); }} /> : activeBrowserTab.videoSource?.kind === "hls" ? <HlsVideoPlayer key={`${activeBrowserTab.url}-${activeBrowserTab.reloadNonce}`} src={activeBrowserTab.videoSource.src} playbackRate={videoPlaybackRate} subtitleUrl={videoSubtitleUrl} onReady={registerNativeVideo} onError={(message) => { setVideoError(message); updateActiveBrowserTab((tab) => ({ ...tab, loading: false })); }} /> : <iframe key={`${activeBrowserTab.url}-${activeBrowserTab.reloadNonce}`} title="Freshdesk 视频播放器" src={activeBrowserTab.videoSource?.src} allow="autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write; accelerometer; gyroscope; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" ref={activeBrowserTab.videoSource?.provider === "TikTok" ? tiktokPlayerRef : undefined} onLoad={() => updateActiveBrowserTab((tab) => ({ ...tab, loading: false }))} onError={() => { setVideoError("视频网站拒绝嵌入、需要登录或暂时不可用。可切换网页模式，或者在兼容阅读中查看页面信息。"); updateActiveBrowserTab((tab) => ({ ...tab, loading: false })); }} />}</div>
                      <footer><Play size={14} /><span>当前标签支持公开 MP4/WebM/M4V/MOV、HLS、YouTube、Bilibili、TikTok、优酷、Vimeo、Dailymotion、Twitch、Loom、Streamable、Wistia、Facebook、Rumble、TED 与 Internet Archive 的官方或公开嵌入；页面 JavaScript 已启用，但会员、DRM、登录、地区及反嵌入限制仍由原网站控制。</span></footer>
                    </section>
                  ) : activeBrowserTab.mode === "reader" ? (
                    <section className="browser-reader-page">
                      <header>
                        <div><span className="eyebrow">当前标签 · 多媒体阅读</span><h2>{readerQuery.data?.title || activeBrowserTab.title}</h2><p>{labelFromUrl(activeBrowserTab.url)} · 正文、公开图片和可识别视频都保留在此标签。</p></div>
                        <div className="reader-actions"><button onClick={saveCurrentDownload}><Download size={14} /> 保存到下载项</button><button onClick={openDirectMode}>原网页</button></div>
                      </header>
                      <p className="reader-safety-note"><CircleHelp size={12} /> {browserFallbackNotice || "优先提供可点击的公开内容；若网站要求登录、人机验证或拒绝嵌入，内容会继续留在此标签的阅读模式中，无法绕过该站点的安全策略。"}</p>
                      {readerQuery.isLoading || readerQuery.isFetching ? <div className="browser-reader-loading"><RotateCw className="spinning" size={18} /> 正在读取网页内容…</div> : readerQuery.error ? <div className="browser-reader-error"><CircleHelp size={18} /><strong>此网页暂时无法读取</strong><span>{readerQuery.error.message}</span><button onClick={openDirectMode}>改为原网页尝试</button></div> : <div className="browser-reader-content"><p className="reader-summary">{readerQuery.data?.summary}</p><article className="reader-body"><h3>网页正文</h3><p>{readerQuery.data?.body}</p></article>{readerQuery.data?.videos.length ? <div className="reader-videos"><div><h3>页面视频</h3><span>{readerQuery.data.videos.length} 个公开视频 · 点击在当前标签播放</span></div><div>{readerQuery.data.videos.map((video) => <button key={video.src} onClick={() => openReaderVideo(video.src, video.title)}><Play size={16} /><span><b>{video.title}</b><small>{video.kind === "direct" ? "公开直链视频" : "官方嵌入视频"}</small></span><ChevronRight size={15} /></button>)}</div></div> : null}{readerQuery.data?.images.length ? <div className="reader-media"><div><h3>页面图片</h3><span>{readerQuery.data.images.length} 张公开图片 · 点击在当前标签查看</span></div><div className="reader-media-grid">{readerQuery.data.images.map((image, index) => <button key={image.src} onClick={() => openReaderImage(index)}><img src={image.src} alt={image.alt} /><span>{image.alt}</span></button>)}</div></div> : null}<div className="reader-links"><div className="reader-links-head"><div><h3>站内可点击导航</h3><small>已提取 {readerQuery.data?.links.length ?? 0} 个公开链接；点击后优先加载原网页，受限时自动返回当前标签的多媒体阅读。</small></div><input value={readerLinkFilter} onChange={(event) => setReaderLinkFilter(event.target.value)} placeholder="在本页查找标题或网址" aria-label="筛选站内链接" /></div>{visibleReaderLinks.length ? visibleReaderLinks.map((link) => <button key={`${link.url}-${link.title}`} onClick={() => openWebInCurrentTab(link.url, link.title)}><Globe2 size={14} /><span><b>{link.title}</b><small>{labelFromUrl(link.url)}</small></span><ChevronRight size={15} /></button>) : <p>{readerQuery.data?.links.length ? "没有匹配的站内链接。" : "没有检测到可继续访问的公开链接。"}</p>}</div></div>}
                    </section>
                  ) : activeBrowserTab.mode === "search" ? (
                    <section className="browser-search-page"><header><span className="eyebrow">Freshdesk Search</span><h2>{activeBrowserTab.searchQuery ? `“${activeBrowserTab.searchQuery}”` : "在这里搜索互联网"}</h2><p>{activeBrowserTab.searchError || activeBrowserTab.searchSummary || "输入关键词，搜索结果会保留在当前浏览器窗口中。"}</p></header>{activeBrowserTab.loading ? <div className="browser-search-loading"><RotateCw className="spinning" size={18} /> 正在检索公开结果…</div> : activeBrowserTab.searchResults?.length ? <div className="browser-search-results">{activeBrowserTab.searchResults.map((result) => <button key={`${result.url}-${result.title}`} onClick={() => openBrowserSearchResult(result)}><span className="browser-result-top"><Globe2 size={14} /> {result.source ?? labelFromUrl(result.url)}</span><strong>{result.title}</strong><p>{result.snippet}</p><small>{labelFromUrl(result.url)} · 在当前标签打开</small></button>)}</div> : <div className="browser-search-empty"><Compass size={28} /><strong>{activeBrowserTab.searchQuery ? "没有找到公开结果" : "等待一个搜索词"}</strong><span>{activeBrowserTab.searchQuery ? "换一个更具体的关键词，或直接输入完整网址继续浏览。" : "可输入“163邮箱登录入口”“OpenAI”或完整网址；结果会在当前标签中继续阅读。"}</span>{!activeBrowserTab.searchQuery && <div className="browser-home-bookmarks"><small><Bookmark size={12} /> 快捷书签</small>{bookmarks.length ? <div>{bookmarks.slice(0, 6).map((bookmark) => <button key={bookmark.id} onClick={() => openBookmark(bookmark)}><Globe2 size={14} /><span><b>{bookmark.title}</b><em>{labelFromUrl(bookmark.url)}</em></span></button>)}</div> : <button className="bookmark-home-empty" onClick={() => setBookmarksOpen(true)}>在工具栏点星标收藏常用网页</button>}</div>}</div>}</section>
                  ) : <><iframe key={`${activeBrowserTab.id}-${activeBrowserTab.reloadNonce}`} title="Freshdesk 浏览器内容" src={activeBrowserTab.url} sandbox="allow-forms allow-scripts allow-same-origin" referrerPolicy="strict-origin-when-cross-origin" onLoad={() => { setFrameStatus("loaded"); updateActiveBrowserTab((tab) => ({ ...tab, loading: false })); }} onError={() => autoDegradeWebTab("该网页拒绝在窗口中嵌入，已自动切换到当前标签的多媒体阅读。公开内容与链接仍可继续浏览。")} /><div className={`browser-frame-note ${frameStatus}`}><CircleHelp size={13} /><span>{frameStatus === "loading" ? "正在连接原网页；文字、图片与视频会优先保留在当前标签。若网站阻止嵌入，才会自动切换到多媒体阅读。" : frameStatus === "restricted" ? "该页面长时间未能嵌入，正在切换到当前标签的多媒体阅读。" : frameStatus === "error" ? "网页仍保留在当前标签。你可以刷新、返回或继续输入其他网址；不会自动切换阅读模式。" : embedInspectionQuery.data?.requiresUserConsent ? "该站点要求在自身网页中完成安全确认并设置 Cookie。请在下方网页自行确认；Freshdesk 不会替你同意或绕过这项检查。" : "原网页已加载；页面自己的文字、图片与视频保留在当前标签。若某个站内卡片受跨域限制无法接管，可打开多媒体阅读继续浏览。"}</span><button onClick={() => openInReader(activeBrowserTab.url, `阅读：${activeBrowserTab.title}`)}>多媒体阅读</button></div></>}
                  {bookmarksOpen && <aside className="bookmark-drawer"><header><div><Bookmark size={15} /><span>收藏夹</span></div><button aria-label="关闭收藏夹" onClick={() => setBookmarksOpen(false)}><X size={14} /></button></header>{bookmarks.length ? <div className="bookmark-list">{bookmarks.map((bookmark) => <button key={bookmark.id} onClick={() => openBookmark(bookmark)}><Globe2 size={14} /><span><b>{bookmark.title}</b><small>{labelFromUrl(bookmark.url)}</small></span></button>)}</div> : <div className="bookmark-empty"><Bookmark size={18} /><span>还没有收藏的页面</span></div>}</aside>}
                  {historyOpen && <aside className="bookmark-drawer browser-history-drawer"><header><div><History size={15} /><span>浏览历史</span></div><button aria-label="关闭浏览历史" onClick={() => setHistoryOpen(false)}><X size={14} /></button></header>{browserHistoryEntries.length ? <div className="bookmark-list">{browserHistoryEntries.map((entry) => <button key={entry.id} onClick={() => entry.mode === "search" ? void fetchBrowserSearch(entry.address.replace(/^search:/, "")) : entry.mode === "reader" ? openInReader(entry.address, entry.title) : navigateBrowser(entry.address)}><History size={14} /><span><b>{entry.title}</b><small>{entry.visitedAt} · {labelFromUrl(entry.address.replace(/^search:/, ""))}</small></span></button>)}</div> : <div className="bookmark-empty"><History size={18} /><span>还没有浏览记录</span></div>}<footer><button onClick={() => setBrowserHistoryEntries([])}>清除历史记录</button></footer></aside>}
                  {recentVideosOpen && <aside className="bookmark-drawer browser-history-drawer"><header><div><Play size={15} /><span>最近播放</span></div><button aria-label="关闭最近播放" onClick={() => setRecentVideosOpen(false)}><X size={14} /></button></header>{recentVideos.length ? <div className="bookmark-list">{recentVideos.map((item) => <button key={item.id} onClick={() => resumeRecentVideo(item)}><Play size={14} /><span><b>{item.title}</b><small>{item.provider} · {item.watchedAt}</small></span></button>)}</div> : <div className="bookmark-empty"><Play size={18} /><span>播放过的视频会出现在这里</span></div>}<footer><button onClick={() => setRecentVideos([])}>清空最近播放</button></footer></aside>}
                  {downloadsOpen && <aside className="bookmark-drawer browser-history-drawer browser-download-drawer"><header><div><Download size={15} /><span>下载项</span></div><button aria-label="关闭下载项" onClick={() => setDownloadsOpen(false)}><X size={14} /></button></header>{browserDownloads.length ? <div className="browser-download-list">{browserDownloads.map((item) => { const progress = item.progress ?? (item.status === "已保存" || item.status === "已完成" ? 100 : 0); const isDownloading = item.status === "下载中" || item.status === "准备就绪"; return <article key={item.id}><button className="browser-download-open" disabled={isDownloading || (item.native && item.status !== "已完成")} onClick={() => { if (!item.native) { setPreviewFilePath(`${VIRTUAL_HOME}/Downloads/${item.title}`); openApp("finder"); } }}><FileText size={14} /><span><b>{item.title}</b><small>{item.createdAt} · {item.status}{item.native && item.path ? " · 系统下载目录" : ""}</small></span></button><div className="browser-download-progress" aria-label={`${item.title} 下载进度`}><i style={{ width: `${progress}%` }} /><small>{isDownloading ? `${progress}%` : item.status}</small></div>{isDownloading && item.native ? <button className="browser-download-cancel" aria-label={`取消下载 ${item.title}`} onClick={() => cancelBrowserDownload(item.id)}><X size={13} /> 取消</button> : null}</article>; })}</div> : <div className="bookmark-empty"><Download size={18} /><span>在兼容阅读或图片查看中保存内容，即可在这里查看进度。</span></div>}<footer><button onClick={() => setBrowserDownloads((items) => items.filter((item) => item.status === "下载中" || item.status === "准备就绪"))}>清除已完成记录</button></footer></aside>}
                  {groupsOpen && <aside className="group-drawer"><header><div><LayoutGrid size={15} /><span>标签页分组</span></div><button aria-label="关闭标签分组" onClick={() => setGroupsOpen(false)}><X size={14} /></button></header><div className="group-drawer-actions"><button onClick={createTabGroup}><Plus size={14} /> 用当前标签新建分组</button><button onClick={() => assignTabToGroup(undefined)} disabled={!activeBrowserTab.groupId}><X size={14} /> 移出当前分组</button></div><div className="group-drawer-list">{browserTabGroups.length ? browserTabGroups.map((group) => <section key={group.id}><div className="group-drawer-row"><i style={{ background: group.color }} /><input value={group.title} aria-label="分组名称" onChange={(event) => renameGroup(group.id, event.target.value)} onBlur={(event) => { if (!event.target.value.trim()) renameGroup(group.id, "未命名分组"); }} /><button aria-label={`将当前标签移入 ${group.title}`} onClick={() => assignTabToGroup(group.id)}><ChevronRight size={13} /></button><button aria-label={`删除 ${group.title}`} onClick={() => removeTabGroup(group.id)}><Trash2 size={12} /></button></div><small>{groupedTabs(group.id).length} 个标签页 · 拖放标签也可加入</small></section>) : <div className="group-empty"><LayoutGrid size={18} /><span>先从当前标签创建一个工作组</span></div>}</div></aside>}
                </div>
              </div>
            </WindowChrome>
          )}

          {windowItem.id === "weather" && (
            <WindowChrome title="天气" appWindow={windowItem} onClose={() => closeApp("weather")} onMinimize={() => minimizeApp("weather")} onFocus={() => bringToFront("weather")} onMaximize={() => toggleMaximize("weather")} onBoundsChange={(bounds) => updateWindowBounds("weather", bounds)} onSnapPreviewChange={setSnapPreview} onSnap={(side) => snapWindow("weather", side)} className="weather-window">
              <div className="weather-body"><aside className="weather-sidebar"><form className="weather-search" onSubmit={(event) => { event.preventDefault(); void fetchLiveWeather(); }}><Search size={14} /><input value={weatherSearch} onChange={(event) => setWeatherSearch(event.target.value)} placeholder="输入城市" aria-label="查询城市天气" /><button type="submit" aria-label="查询实时天气" disabled={weatherLoading}>{weatherLoading ? <RotateCw className="spinning" size={13} /> : <ArrowRight size={14} />}</button></form><div className="weather-sidebar-head"><CloudSun size={17} /><span>常用地点</span></div>{weatherLocations.map((location) => <button className={!liveWeather && location.id === weatherLocationId ? "active" : ""} key={location.id} onClick={() => { setLiveWeather(null); setWeatherLocationId(location.id); setWeatherError(""); }}><MapPin size={14} /><span><b>{location.city}</b><small>{temperature(location.temp)} · {location.condition}</small></span></button>)}</aside><section className="weather-content"><header><div><span className="eyebrow"><MapPin size={11} /> {currentWeather.city} · {liveWeather ? "实时数据" : "演示地点"}</span><h2>{temperature(currentWeather.temp)}</h2><p>{currentWeather.condition} · 最高 {temperature(currentWeather.high)} / 最低 {temperature(currentWeather.low)}</p></div><div className="weather-header-actions"><button className={weatherUnit === "c" ? "active" : ""} onClick={() => setWeatherUnit("c")}>℃</button><button className={weatherUnit === "f" ? "active" : ""} onClick={() => setWeatherUnit("f")}>℉</button><button aria-label="刷新天气" onClick={() => void fetchLiveWeather(liveWeather ? liveWeather.city.split(" · ")[0] : currentWeather.city)}><RotateCw className={weatherLoading ? "spinning" : ""} size={15} /></button></div></header>{weatherError && <div className="weather-error"><CircleHelp size={14} /><span>{weatherError}</span></div>}<div className="weather-hero"><CloudSun size={68} /><div><strong>{liveWeather ? "实时天气已更新" : "舒适的工作时段"}</strong><span>体感 {temperature(liveWeather?.apparent ?? currentWeather.temp - 1)} · 更新于 {weatherUpdatedAt.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })}</span></div></div><div className="weather-forecast">{currentWeather.forecast.map((item) => <div key={item.label}><span>{item.label}</span>{weatherSymbol(item.icon, 20)}<b>{temperature(item.temp)}</b></div>)}</div><div className="weather-details"><div><Droplets size={17} /><span><small>湿度</small><b>{currentWeather.humidity}%</b></span></div><div><Wind size={17} /><span><small>风速</small><b>{currentWeather.wind}</b></span></div><div><Sun size={17} /><span><small>{liveWeather ? "时区" : "日落"}</small><b>{liveWeather ? liveWeather.timezone.replace("Asia/", "") : "18:42"}</b></span></div></div></section></div>
            </WindowChrome>
          )}

          {windowItem.id === "calendar" && (
            <WindowChrome title="日历" appWindow={windowItem} onClose={() => closeApp("calendar")} onMinimize={() => minimizeApp("calendar")} onFocus={() => bringToFront("calendar")} onMaximize={() => toggleMaximize("calendar")} onBoundsChange={(bounds) => updateWindowBounds("calendar", bounds)} onSnapPreviewChange={setSnapPreview} onSnap={(side) => snapWindow("calendar", side)} className="calendar-app-window">
              <div className="calendar-app-body"><aside className="calendar-app-sidebar"><div className="calendar-mini-date"><span>{now.toLocaleDateString("zh-CN", { month: "long" })}</span><strong>{now.getDate()}</strong><small>{now.toLocaleDateString("zh-CN", { weekday: "long" })}</small></div><button className="calendar-sidebar-active"><span className="calendar-color-dot" /> 我的日历</button><button onClick={() => openApp("reminders")}><ListTodo size={15} /> 已提醒事项</button></aside><section className="calendar-app-content"><header><div><span className="eyebrow">今日安排</span><h2>{currentDate}</h2></div><form onSubmit={addCalendarEntry}><input value={calendarDraft} onChange={(event) => setCalendarDraft(event.target.value)} placeholder="添加一个事件" aria-label="添加日历事件" /><button type="submit"><Plus size={15} /> 添加</button></form></header><div className="calendar-timeline">{["09:00", "10:00", "12:00", "15:00", "18:00"].map((time) => <div className="calendar-time-row" key={time}><time>{time}</time><div>{calendarEntries.filter((entry) => entry.time === time).map((entry) => <article key={entry.id} style={{ "--event-color": entry.color } as React.CSSProperties}><i /><span>{entry.title}</span><button aria-label={`删除 ${entry.title}`} onClick={() => setCalendarEntries((entries) => entries.filter((item) => item.id !== entry.id))}><X size={12} /></button></article>)}</div></div>)}</div></section></div>
            </WindowChrome>
          )}

          {windowItem.id === "reminders" && (
            <WindowChrome title="提醒事项" appWindow={windowItem} onClose={() => closeApp("reminders")} onMinimize={() => minimizeApp("reminders")} onFocus={() => bringToFront("reminders")} onMaximize={() => toggleMaximize("reminders")} onBoundsChange={(bounds) => updateWindowBounds("reminders", bounds)} onSnapPreviewChange={setSnapPreview} onSnap={(side) => snapWindow("reminders", side)} className="reminders-window">
              <div className="reminders-body"><header><div><span className="eyebrow">今天</span><h2>提醒事项</h2><p>{completedReminders} / {reminders.length} 已完成</p></div><button onClick={() => openApp("calendar")}><CalendarDays size={15} /> 日历</button></header><form className="reminder-add" onSubmit={addReminder}><Plus size={16} /><input value={reminderDraft} onChange={(event) => setReminderDraft(event.target.value)} placeholder="新提醒事项" aria-label="新提醒事项" /><button type="submit">添加</button></form><div className="reminder-list">{reminders.map((item) => <article className={item.done ? "done" : ""} key={item.id}><button className="reminder-check" aria-label={item.done ? `取消完成 ${item.title}` : `完成 ${item.title}`} onClick={() => setReminders((items) => items.map((reminder) => reminder.id === item.id ? { ...reminder, done: !reminder.done } : reminder))}>{item.done && <X size={11} />}</button><span>{item.title}</span><button className="reminder-delete" aria-label={`删除 ${item.title}`} onClick={() => setReminders((items) => items.filter((reminder) => reminder.id !== item.id))}><Trash2 size={14} /></button></article>)}</div></div>
            </WindowChrome>
          )}

          {windowItem.id === "terminal" && (
            <WindowChrome title="终端" appWindow={windowItem} onClose={() => closeApp("terminal")} onMinimize={() => minimizeApp("terminal")} onFocus={() => bringToFront("terminal")} onMaximize={() => toggleMaximize("terminal")} onBoundsChange={(bounds) => updateWindowBounds("terminal", bounds)} onSnapPreviewChange={setSnapPreview} onSnap={(side) => snapWindow("terminal", side)} className="terminal-window">
              <div className="terminal-body"><div className="terminal-scroll" ref={terminalOutputRef}>{terminalLines.map((line, index) => <p key={`${line}-${index}`} className={line.startsWith("freshdesk@desktop") ? "terminal-command" : ""}>{line.startsWith("freshdesk@desktop") ? <><span className="term-cyan">freshdesk@desktop</span>:<span className="term-blue">{line.split(":").slice(1).join(":").split("$")[0]}</span>${line.split("$ ").at(-1)}</> : line}</p>)}</div><form className="terminal-input-row" onSubmit={runTerminalCommand}><span><b className="term-cyan">freshdesk@desktop</b>:<b className="term-blue">{displayVirtualPath(terminalCwd)}</b>$</span><input autoFocus value={terminalInput} onChange={(event) => setTerminalInput(event.target.value)} aria-label="输入模拟终端命令" placeholder="试试 mkdir 工作区、touch 想法.md" /><button type="submit">运行</button></form></div>
            </WindowChrome>
          )}
        </div>
      ))}

      <nav className="dock" aria-label="应用程序 Dock" onClick={(event) => event.stopPropagation()}>
        {(Object.keys(appMeta) as AppName[]).filter((app) => app !== "trash").map((app) => {
          const meta = appMeta[app];
          const Icon = meta.icon;
          const isOpen = windows.some((item) => item.id === app);
          return <button key={app} className="dock-app" onClick={() => openApp(app)} aria-label={`打开${meta.label}`}><span className="dock-icon" style={{ backgroundColor: meta.color }}><Icon size={25} color="white" strokeWidth={1.65} /></span><span className="dock-tooltip">{meta.label}</span>{isOpen && <i />}</button>;
        })}
        <span className="dock-divider" />
        <button className={`dock-app dock-trash-target ${draggedFilePath ? "ready" : ""}`} onClick={() => openApp("trash")} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (draggedFilePath) moveFileToTrash(draggedFilePath); }} aria-label="打开回收站或投放文件"><span className="dock-icon trash"><Trash2 size={24} color="white" strokeWidth={1.65} /></span><span className="dock-tooltip">回收站</span>{trashItems.length > 0 && <i />}</button>
      </nav>

      {activePanel === "control" && <section className="control-center popover-panel" onClick={(event) => event.stopPropagation()}><div className="control-grid"><button className={`control-tile wide ${wifi ? "on" : ""}`} onClick={() => setWifi(!wifi)}><Wifi size={19} /><div><b>Wi‑Fi</b><span>{wifi ? "Studio Network" : "已关闭"}</span></div></button><button className={`control-tile ${bluetooth ? "on" : ""}`} onClick={() => setBluetooth(!bluetooth)}><Bluetooth size={18} /><b>蓝牙</b></button><button className={`control-tile ${focus ? "on" : ""}`} onClick={() => setFocus(!focus)}><Moon size={18} /><b>专注</b></button></div><div className="control-quick-links"><button onClick={() => openApp("weather")}><CloudSun size={16} /><span>{currentWeather.city} {temperature(currentWeather.temp)}</span></button><button onClick={() => openApp("reminders")}><ListTodo size={16} /><span>{reminders.length - completedReminders} 项待办</span></button></div><div className="control-slider"><Volume2 size={18} /><input aria-label="控制中心音量" type="range" min={0} max={100} value={volume} onChange={(event) => setVolume(Number(event.target.value))} /><span>{volume}%</span></div><div className="now-small"><img src={current.cover} alt="" /><div><span>正在播放</span><b>{current.title}</b></div><button onClick={playMusic}>{isPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}</button></div></section>}

      {activePanel === "spotlight" && <section className="spotlight popover-panel" onClick={(event) => event.stopPropagation()}><div className="spotlight-input"><Search size={20} /><input autoFocus placeholder="搜索应用、文件和更多内容" aria-label="聚焦搜索" /></div><div className="spotlight-result"><span>建议</span><button onClick={() => openApp("notes")}><MessageSquareText size={17} /> 新桌面的第一天 <kbd>↵</kbd></button><button onClick={() => openApp("weather")}><CloudSun size={17} /> {currentWeather.city}天气 <kbd>↵</kbd></button><button onClick={() => openApp("reminders")}><ListTodo size={17} /> 提醒事项 <kbd>↵</kbd></button></div><footer><Command size={12} /> K 打开聚焦搜索</footer></section>}

      {activePanel === "calendar" && <section className="calendar-panel popover-panel" onClick={(event) => event.stopPropagation()}><span>{now.toLocaleDateString("zh-CN", { year: "numeric", month: "long" })}</span><h2>{now.getDate()}</h2><p>{currentDate}</p><div className="calendar-line" /><div className="calendar-event"><span>08:30</span><div><b>新的一天</b><small>留一点空间给自己。</small></div></div></section>}

      {activePanel === "windows" && <section className="window-manager-panel popover-panel" onClick={(event) => event.stopPropagation()}><header><div><Grid2X2 size={15} /><span>窗口管理</span><small>{managedWindows.length} 个已打开</small></div><button aria-label="关闭窗口管理" onClick={() => setActivePanel(null)}><X size={14} /></button></header>{managedWindows.length ? <div className="window-manager-list">{managedWindows.map((item) => { const meta = appMeta[item.id]; const Icon = meta.icon; return <article key={item.id} className={item.minimized ? "minimized" : ""}><button className="window-manager-focus" onClick={() => { bringToFront(item.id); setActivePanel(null); }}><span className="window-manager-icon" style={{ background: meta.color }}><Icon size={14} /></span><span><b>{meta.label}</b><small>{item.minimized ? "已最小化" : "正在桌面上"}{item === managedWindows[0] && !item.minimized ? " · 最前" : ""}</small></span></button><div><button aria-label={`最小化${meta.label}`} onClick={() => minimizeApp(item.id)} disabled={item.minimized}><Minimize2 size={13} /></button><button className="window-manager-close" aria-label={`关闭${meta.label}`} onClick={() => closeApp(item.id)}><X size={14} /></button></div></article>; })}</div> : <div className="window-manager-empty"><Grid2X2 size={21} /><span>没有打开的窗口</span></div>}<footer><button onClick={minimizeAllApps} disabled={!managedWindows.some((item) => !item.minimized)}>最小化全部</button><button className="window-manager-close-all" onClick={closeAllApps} disabled={!managedWindows.length}><X size={13} /> 关闭全部</button></footer></section>}

      {activePanel === "about" && <section className="about-panel popover-panel" onClick={(event) => event.stopPropagation()}><img src={BRAND_MARK} alt="Freshdesk" /><div><strong>Freshdesk Desktop</strong><span>演示版 · 1.0</span></div><p>一个以新设备开机感为灵感的浏览器桌面体验。所有标识与内容均为原创。</p></section>}

      {!setupComplete && <section className="setup-overlay" aria-label="新电脑设置欢迎页"><div className="setup-glow" /><div className={`setup-card ${showSetupChoice ? "expanded" : ""}`}><div className="setup-ready-line"><span /><span /><span /><span /></div><img src={BRAND_MARK} alt="Freshdesk Desktop" className="setup-mark" /><p className="setup-kicker">Freshdesk Desktop <i>·</i> System Ready</p>{!showSetupChoice ? <><h2>你好。</h2><p className="setup-copy">一个留有余白的桌面，已经为你准备好了。</p><button className="setup-primary" onClick={() => setShowSetupChoice(true)}>继续 <ChevronRight size={17} /></button><span className="setup-footnote">演示模式 · 仅在浏览器中运行</span></> : <><h2>从这里开始。</h2><p className="setup-copy">我们已为你放好几个可以探索的地方。音乐、便笺和文件都会在桌面上等你。</p><button className="setup-primary" onClick={() => setSetupComplete(true)}>进入桌面 <ChevronRight size={17} /></button><button className="setup-secondary" onClick={() => setShowSetupChoice(false)}>返回</button></>}</div></section>}

      <div className="mobile-notice"><img src={BRAND_MARK} alt="" /><h2>请在更大的屏幕上打开</h2><p>这个桌面体验为横向电脑屏幕设计。调整窗口宽度后即可继续探索。</p></div>
    </main>
  );
}
