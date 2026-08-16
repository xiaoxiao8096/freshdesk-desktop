/**
 * 设计提醒：雾面硬件主义。以桌面空间关系组织内容，所有反馈要像精密设备一样安静、迅速、可信。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  Bell,
  Bluetooth,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  CloudSun,
  Command,
  Compass,
  Folder,
  FolderOpen,
  Gauge,
  Grid2X2,
  Headphones,
  Image,
  LayoutGrid,
  Maximize2,
  MessageSquareText,
  Mic2,
  Minimize2,
  Moon,
  MoreHorizontal,
  Music2,
  Pause,
  Play,
  Plus,
  Search,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  TerminalSquare,
  Trash2,
  Volume2,
  Wifi,
  X,
} from "lucide-react";

type AppName = "finder" | "music" | "notes" | "photos" | "settings" | "terminal";

type AppWindow = {
  id: AppName;
  minimized: boolean;
  zIndex: number;
};

const WALLPAPER = "/manus-storage/freshdesk-aurora-wallpaper_a64c0088.jpg";
const ALBUM_ORBIT = "/manus-storage/freshdesk-album-orbit_68ca7295.jpg";
const ALBUM_TIDE = "/manus-storage/freshdesk-album-tide_658b722a.jpg";
const BRAND_MARK = "/manus-storage/freshdesk-four-dot-mark_fa52f231.png";
const MUSIC = "/manus-storage/freshdesk-idle-sequence_94201983.mp3";

const appMeta: Record<AppName, { label: string; color: string; icon: typeof FolderOpen }> = {
  finder: { label: "文件", color: "#2d8cff", icon: FolderOpen },
  music: { label: "音乐", color: "#ff5a6d", icon: Music2 },
  notes: { label: "便笺", color: "#ffc045", icon: MessageSquareText },
  photos: { label: "照片", color: "#f07c8c", icon: Image },
  settings: { label: "设置", color: "#9aa5b8", icon: Settings2 },
  terminal: { label: "终端", color: "#2f3742", icon: TerminalSquare },
};

function formatDuration(value: number) {
  if (!Number.isFinite(value)) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function WindowChrome({
  title,
  onClose,
  onMinimize,
  onFocus,
  children,
  className = "",
}: {
  title: string;
  onClose: () => void;
  onMinimize: () => void;
  onFocus: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`app-window ${className}`} onMouseDown={onFocus} aria-label={`${title} 窗口`}>
      <header className="window-chrome">
        <div className="traffic-lights" aria-label="窗口控制">
          <button className="traffic-light close" aria-label={`关闭${title}`} onClick={(event) => { event.stopPropagation(); onClose(); }}><X size={9} /></button>
          <button className="traffic-light minimize" aria-label={`最小化${title}`} onClick={(event) => { event.stopPropagation(); onMinimize(); }}><Minimize2 size={8} /></button>
          <button className="traffic-light expand" aria-label={`放大${title}`} onClick={(event) => event.stopPropagation()}><Maximize2 size={8} /></button>
        </div>
        <span className="window-title">{title}</span>
        <span className="window-chrome-spacer" />
      </header>
      {children}
    </section>
  );
}

export default function Home() {
  const [setupComplete, setSetupComplete] = useState(false);
  const [showSetupChoice, setShowSetupChoice] = useState(false);
  const [windows, setWindows] = useState<AppWindow[]>([]);
  const [activePanel, setActivePanel] = useState<"control" | "spotlight" | "calendar" | "about" | null>(null);
  const [selectedDesktop, setSelectedDesktop] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [wifi, setWifi] = useState(true);
  const [bluetooth, setBluetooth] = useState(true);
  const [focus, setFocus] = useState(false);
  const [volume, setVolume] = useState(62);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(150);
  const [note, setNote] = useState("今天先从一段安静的音乐开始。\n\n桌面已经准备好了。打开任意一个应用，看看这个空间会带你去哪里。");
  const [systemAppearance, setSystemAppearance] = useState<"light" | "dark">("dark");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const tracks = useMemo(
    () => [
      { title: "Idle Sequence", artist: "Freshdesk Studio", cover: ALBUM_ORBIT, time: "2:30" },
      { title: "Silver Tide", artist: "Freshdesk Studio", cover: ALBUM_TIDE, time: "2:30" },
    ],
    [],
  );

  const current = tracks[currentTrack];

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100;
  }, [volume]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActivePanel(null);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setActivePanel("spotlight");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const bringToFront = (id: AppName) => {
    setWindows((currentWindows) => {
      const top = Math.max(25, ...currentWindows.map((item) => item.zIndex));
      return currentWindows.map((item) => (item.id === id ? { ...item, minimized: false, zIndex: top + 1 } : item));
    });
  };

  const openApp = (id: AppName) => {
    setActivePanel(null);
    setWindows((currentWindows) => {
      const top = Math.max(25, ...currentWindows.map((item) => item.zIndex));
      const existing = currentWindows.find((item) => item.id === id);
      if (existing) return currentWindows.map((item) => (item.id === id ? { ...item, minimized: false, zIndex: top + 1 } : item));
      return [...currentWindows, { id, minimized: false, zIndex: top + 1 }];
    });
  };

  const closeApp = (id: AppName) => setWindows((currentWindows) => currentWindows.filter((item) => item.id !== id));
  const minimizeApp = (id: AppName) => setWindows((currentWindows) => currentWindows.map((item) => item.id === id ? { ...item, minimized: true } : item));

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

  const currentTime = now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  const currentDate = now.toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "short" });

  const desktopItems = [
    { label: "我的文件", sublabel: "8 个项目", icon: Folder, app: "finder" as AppName },
    { label: "灵感相册", sublabel: "12 张照片", icon: Image, app: "photos" as AppName },
    { label: "开机笔记", sublabel: "刚刚创建", icon: MessageSquareText, app: "notes" as AppName },
  ];

  return (
    <main className={`desktop-stage ${systemAppearance === "dark" ? "desktop-dark" : "desktop-light"}`} onClick={() => { setSelectedDesktop(null); if (activePanel !== "about") setActivePanel(null); }}>
      <div className="wallpaper" style={{ backgroundImage: `url(${WALLPAPER})` }} />
      <div className="wallpaper-veil" />
      <audio
        ref={audioRef}
        src={MUSIC}
        preload="metadata"
        onTimeUpdate={(event) => setProgress(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 150)}
        onEnded={() => { setIsPlaying(false); setProgress(0); }}
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
          <button className="menu-word" onClick={() => openApp("settings")}>窗口</button>
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
            <WindowChrome title="我的文件" onClose={() => closeApp("finder")} onMinimize={() => minimizeApp("finder")} onFocus={() => bringToFront("finder")} className="finder-window">
              <div className="finder-body">
                <aside className="finder-sidebar">
                  <p>个人收藏</p>
                  <button className="sidebar-active"><FolderOpen size={15} /> 我的文件</button>
                  <button onClick={() => openApp("photos")}><Image size={15} /> 灵感相册</button>
                  <button><Archive size={15} /> 下载项</button>
                  <p>位置</p>
                  <button><CloudSun size={15} /> Freshdesk Drive</button>
                </aside>
                <div className="finder-content">
                  <div className="finder-toolbar"><div><ChevronLeft size={17} /><ChevronRight size={17} /></div><strong>我的文件</strong><LayoutGrid size={17} /></div>
                  <div className="folder-grid">
                    {["项目草稿", "收集箱", "回声", "素材库", "导出"].map((folder, index) => (
                      <button key={folder} className="folder-card" onClick={() => index === 2 ? openApp("notes") : undefined}>
                        <Folder size={44} fill={index === 1 ? "#8dbaff" : "#a4c8ff"} strokeWidth={1.2} />
                        <strong>{folder}</strong><span>{index === 2 ? "3 个文件" : `${index + 2} 个项目`}</span>
                      </button>
                    ))}
                  </div>
                  <div className="finder-footer"><span>5 个项目</span><span>Freshdesk Drive · 已连接</span></div>
                </div>
              </div>
            </WindowChrome>
          )}

          {windowItem.id === "music" && (
            <WindowChrome title="音乐" onClose={() => closeApp("music")} onMinimize={() => minimizeApp("music")} onFocus={() => bringToFront("music")} className="music-window">
              <div className="music-body">
                <aside className="music-sidebar"><div className="music-brand"><img src={BRAND_MARK} alt="" /> <span>Freshdesk Music</span></div><button className="library-active"><Headphones size={16} /> 现在收听</button><button><Compass size={16} /> 浏览</button><button><Grid2X2 size={16} /> 资料库</button><div className="playlist-add"><span>播放列表</span><Plus size={15} /></div><button className="playlist"><span className="playlist-dot coral" /> 已添加</button><button className="playlist"><span className="playlist-dot sky" /> 工作流</button></aside>
                <div className="music-content">
                  <div className="music-hero"><div><span className="eyebrow">为此刻准备</span><h2>空间感<br />收藏。</h2><p>一些适合打开新桌面时聆听的声音。</p></div><img src={ALBUM_TIDE} alt="抽象音乐封面" /></div>
                  <div className="album-heading"><h3>今天的选择</h3><button>查看全部 <ChevronRight size={14} /></button></div>
                  <div className="album-row">
                    {tracks.map((track, index) => <button className={`album-tile ${index === currentTrack ? "active" : ""}`} key={track.title} onClick={() => { setCurrentTrack(index); setProgress(0); openApp("music"); }}><img src={track.cover} alt="" /><strong>{track.title}</strong><span>{track.artist}</span></button>)}
                  </div>
                  <div className="track-list"><button onClick={playMusic}><span className="track-index">{isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}</span><img src={current.cover} alt="" /><div><strong>{current.title}</strong><span>{current.artist}</span></div><span>{current.time}</span><MoreHorizontal size={18} /></button></div>
                </div>
              </div>
              <div className="music-player"><img src={current.cover} alt="" /><div className="player-track"><strong>{current.title}</strong><span>{current.artist}</span><input aria-label="播放进度" type="range" min={0} max={duration || 150} value={progress} onChange={(event) => { const value = Number(event.target.value); setProgress(value); if (audioRef.current) audioRef.current.currentTime = value; }} /></div><span className="player-time">{formatDuration(progress)} / {formatDuration(duration)}</span><div className="player-controls"><button aria-label="上一首" onClick={() => skipTrack(-1)}><ChevronLeft size={18} /></button><button className="main-play" aria-label={isPlaying ? "暂停" : "播放"} onClick={playMusic}>{isPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}</button><button aria-label="下一首" onClick={() => skipTrack(1)}><ChevronRight size={18} /></button></div><Volume2 size={16} /><input className="volume-slider" aria-label="音量" type="range" min={0} max={100} value={volume} onChange={(event) => setVolume(Number(event.target.value))} /></div>
            </WindowChrome>
          )}

          {windowItem.id === "notes" && (
            <WindowChrome title="便笺" onClose={() => closeApp("notes")} onMinimize={() => minimizeApp("notes")} onFocus={() => bringToFront("notes")} className="notes-window">
              <div className="notes-body"><aside className="notes-sidebar"><button className="new-note"><Plus size={16} /> 新建便笺</button><p>今天</p><button className="note-list-item active"><span>新桌面的第一天</span><small>今天</small></button><button className="note-list-item"><span>要尝试的事</span><small>昨天</small></button><button className="note-list-item"><span>给未来的提醒</span><small>8 月 14 日</small></button></aside><article className="note-editor"><header><div><h2>新桌面的第一天</h2><span>{currentDate} · 已自动存储</span></div><button aria-label="更多选项"><MoreHorizontal size={19} /></button></header><textarea value={note} onChange={(event) => setNote(event.target.value)} aria-label="编辑便笺" /><footer><span>⌘S 自动储存</span><span>{note.length} 个字符</span></footer></article></div>
            </WindowChrome>
          )}

          {windowItem.id === "photos" && (
            <WindowChrome title="灵感相册" onClose={() => closeApp("photos")} onMinimize={() => minimizeApp("photos")} onFocus={() => bringToFront("photos")} className="photos-window">
              <div className="photos-body"><header><div><span className="eyebrow">灵感相册</span><h2>光线留下的痕迹。</h2></div><button><Search size={17} /> 搜索</button></header><div className="photo-mosaic"><img src={WALLPAPER} alt="晨雾壁纸" /><img src={ALBUM_ORBIT} alt="蓝色球体" /><img src={ALBUM_TIDE} alt="丝绸材质" /><div className="mosaic-caption"><Sparkles size={17} /><span>最近添加<br /><b>3 个片段</b></span></div></div><p>这是一个为新桌面准备的私密视觉收藏夹。双击桌面上的“灵感相册”可随时回来。</p></div>
            </WindowChrome>
          )}

          {windowItem.id === "settings" && (
            <WindowChrome title="设置" onClose={() => closeApp("settings")} onMinimize={() => minimizeApp("settings")} onFocus={() => bringToFront("settings")} className="settings-window">
              <div className="settings-body"><aside className="settings-sidebar"><div className="settings-profile"><img src={BRAND_MARK} alt="" /><div><strong>你的工作空间</strong><span>本机帐户</span></div></div><button className="settings-active"><Wifi size={16} /> Wi‑Fi</button><button><Bluetooth size={16} /> 蓝牙</button><button><Moon size={16} /> 专注模式</button><button><Gauge size={16} /> 桌面与外观</button></aside><section className="settings-content"><header><h2>桌面与外观</h2><p>按照此刻的光线调整你的工作空间。</p></header><div className="setting-block"><div><strong>外观</strong><span>让系统界面与壁纸保持平衡。</span></div><div className="appearance-choice"><button className={systemAppearance === "light" ? "chosen" : ""} onClick={() => setSystemAppearance("light")}><span className="light-preview" />浅色</button><button className={systemAppearance === "dark" ? "chosen" : ""} onClick={() => setSystemAppearance("dark")}><span className="dark-preview" />深色</button></div></div><div className="setting-block"><div><strong>新手引导</strong><span>重新查看欢迎界面和桌面提示。</span></div><button className="soft-action" onClick={() => { setSetupComplete(false); setShowSetupChoice(false); }}>再次打开</button></div><div className="setting-block"><div><strong>音量</strong><span>当前输出：内建扬声器</span></div><input aria-label="系统音量" type="range" min={0} max={100} value={volume} onChange={(event) => setVolume(Number(event.target.value))} /></div></section></div>
            </WindowChrome>
          )}

          {windowItem.id === "terminal" && (
            <WindowChrome title="终端" onClose={() => closeApp("terminal")} onMinimize={() => minimizeApp("terminal")} onFocus={() => bringToFront("terminal")} className="terminal-window">
              <div className="terminal-body"><p><span className="term-cyan">freshdesk@desktop</span>:<span className="term-blue">~</span>$ system.ready</p><p>Workspace initialized · 6 applications available</p><p>Music engine connected · listening is optional</p><p><span className="term-cyan">freshdesk@desktop</span>:<span className="term-blue">~</span>$ <span className="cursor">▍</span></p></div>
            </WindowChrome>
          )}
        </div>
      ))}

      <nav className="dock" aria-label="应用程序 Dock" onClick={(event) => event.stopPropagation()}>
        {(Object.keys(appMeta) as AppName[]).map((app) => {
          const meta = appMeta[app];
          const Icon = meta.icon;
          const isOpen = windows.some((item) => item.id === app);
          return <button key={app} className="dock-app" onClick={() => openApp(app)} aria-label={`打开${meta.label}`}><span className="dock-icon" style={{ backgroundColor: meta.color }}><Icon size={25} color="white" strokeWidth={1.65} /></span><span className="dock-tooltip">{meta.label}</span>{isOpen && <i />}</button>;
        })}
        <span className="dock-divider" />
        <button className="dock-app" onClick={() => setWindows([])} aria-label="清空窗口"><span className="dock-icon trash"><Trash2 size={24} color="white" strokeWidth={1.65} /></span><span className="dock-tooltip">清空窗口</span></button>
      </nav>

      {activePanel === "control" && <section className="control-center popover-panel" onClick={(event) => event.stopPropagation()}><div className="control-grid"><button className={`control-tile wide ${wifi ? "on" : ""}`} onClick={() => setWifi(!wifi)}><Wifi size={19} /><div><b>Wi‑Fi</b><span>{wifi ? "Studio Network" : "已关闭"}</span></div></button><button className={`control-tile ${bluetooth ? "on" : ""}`} onClick={() => setBluetooth(!bluetooth)}><Bluetooth size={18} /><b>蓝牙</b></button><button className={`control-tile ${focus ? "on" : ""}`} onClick={() => setFocus(!focus)}><Moon size={18} /><b>专注</b></button></div><div className="control-slider"><Volume2 size={18} /><input aria-label="控制中心音量" type="range" min={0} max={100} value={volume} onChange={(event) => setVolume(Number(event.target.value))} /><span>{volume}%</span></div><div className="now-small"><img src={current.cover} alt="" /><div><span>正在播放</span><b>{current.title}</b></div><button onClick={playMusic}>{isPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}</button></div></section>}

      {activePanel === "spotlight" && <section className="spotlight popover-panel" onClick={(event) => event.stopPropagation()}><div className="spotlight-input"><Search size={20} /><input autoFocus placeholder="搜索应用、文件和更多内容" aria-label="聚焦搜索" /></div><div className="spotlight-result"><span>建议</span><button onClick={() => openApp("notes")}><MessageSquareText size={17} /> 新桌面的第一天 <kbd>↵</kbd></button><button onClick={() => openApp("music")}><Music2 size={17} /> Idle Sequence <kbd>↵</kbd></button></div><footer><Command size={12} /> K 打开聚焦搜索</footer></section>}

      {activePanel === "calendar" && <section className="calendar-panel popover-panel" onClick={(event) => event.stopPropagation()}><span>{now.toLocaleDateString("zh-CN", { year: "numeric", month: "long" })}</span><h2>{now.getDate()}</h2><p>{currentDate}</p><div className="calendar-line" /><div className="calendar-event"><span>08:30</span><div><b>新的一天</b><small>留一点空间给自己。</small></div></div></section>}

      {activePanel === "about" && <section className="about-panel popover-panel" onClick={(event) => event.stopPropagation()}><img src={BRAND_MARK} alt="Freshdesk" /><div><strong>Freshdesk Desktop</strong><span>演示版 · 1.0</span></div><p>一个以新设备开机感为灵感的浏览器桌面体验。所有标识与内容均为原创。</p></section>}

      {!setupComplete && <section className="setup-overlay" aria-label="新电脑设置欢迎页"><div className="setup-glow" /><div className={`setup-card ${showSetupChoice ? "expanded" : ""}`}><div className="setup-ready-line"><span /><span /><span /><span /></div><img src={BRAND_MARK} alt="Freshdesk Desktop" className="setup-mark" /><p className="setup-kicker">Freshdesk Desktop <i>·</i> System Ready</p>{!showSetupChoice ? <><h2>你好。</h2><p className="setup-copy">一个留有余白的桌面，已经为你准备好了。</p><button className="setup-primary" onClick={() => setShowSetupChoice(true)}>继续 <ChevronRight size={17} /></button><span className="setup-footnote">演示模式 · 仅在浏览器中运行</span></> : <><h2>从这里开始。</h2><p className="setup-copy">我们已为你放好几个可以探索的地方。音乐、便笺和文件都会在桌面上等你。</p><button className="setup-primary" onClick={() => setSetupComplete(true)}>进入桌面 <ChevronRight size={17} /></button><button className="setup-secondary" onClick={() => setShowSetupChoice(false)}>返回</button></>}</div></section>}

      <div className="mobile-notice"><img src={BRAND_MARK} alt="" /><h2>请在更大的屏幕上打开</h2><p>这个桌面体验为横向电脑屏幕设计。调整窗口宽度后即可继续探索。</p></div>
    </main>
  );
}
