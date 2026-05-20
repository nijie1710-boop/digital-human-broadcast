import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Bot,
  Braces,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Clapperboard,
  Download,
  FileText,
  FolderOpen,
  Gauge,
  Grid3X3,
  HelpCircle,
  ImagePlus,
  LayoutDashboard,
  LayoutTemplate,
  ListChecks,
  Mic2,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Upload,
  UserRound,
  Users,
  Video,
  WandSparkles,
  XCircle,
} from 'lucide-react';

const navItems = [
  { id: 'workbench', label: '工作台', icon: LayoutDashboard },
  { id: 'create', label: '创建视频', icon: Clapperboard },
  { id: 'avatars', label: '数字人形象', icon: UserRound },
  { id: 'voices', label: '声音库', icon: Mic2 },
  { id: 'templates', label: '模板中心', icon: LayoutTemplate },
  { id: 'tasks', label: '任务中心', icon: ListChecks },
  { id: 'works', label: '作品管理', icon: FolderOpen },
  { id: 'api', label: 'API', icon: Braces },
  { id: 'settings', label: '设置', icon: Settings },
];

const avatars = [
  {
    id: 'ruyi',
    name: '如夏',
    gender: '女性',
    age: '青年',
    scene: '电商',
    badge: '运营中',
    image:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=720&q=80',
    outfit: '浅蓝主持装',
  },
  {
    id: 'jingjing',
    name: '静怡',
    gender: '女性',
    age: '青年',
    scene: '知识',
    image:
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=720&q=80',
    outfit: '白色针织上衣',
  },
  {
    id: 'siyi',
    name: '思玥',
    gender: '女性',
    age: '青年',
    scene: '金融',
    image:
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=720&q=80',
    outfit: '粉色商务套装',
  },
  {
    id: 'chunfeng',
    name: '春辰',
    gender: '男性',
    age: '青年',
    scene: '科技',
    image:
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=720&q=80',
    outfit: '深色商务西装',
  },
  {
    id: 'ziyan',
    name: '子墨',
    gender: '男性',
    age: '青年',
    scene: '教育',
    image:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=720&q=80',
    outfit: '蓝色休闲衬衫',
  },
  {
    id: 'rain',
    name: '雨桐',
    gender: '女性',
    age: '少女',
    scene: '娱乐',
    image:
      'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=720&q=80',
    outfit: '淡粉主持装',
  },
  {
    id: 'haoyu',
    name: '浩宇',
    gender: '男性',
    age: '青年',
    scene: '企业',
    image:
      'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=720&q=80',
    outfit: '黑色衬衫',
  },
];

const voices = [
  { id: 'v1', name: '如夏 · 活力女声', lang: '普通话', tone: '活力亲切', duration: '00:15', owner: 'system' },
  { id: 'v2', name: '静怡 · 温柔女声', lang: '普通话', tone: '温暖知性', duration: '00:15', owner: 'system' },
  { id: 'v3', name: '思玥 · 金融主播', lang: '普通话', tone: '稳重清晰', duration: '00:15', owner: 'clone' },
  { id: 'v4', name: '春辰 · 科技男声', lang: '普通话', tone: '沉稳专业', duration: '00:15', owner: 'system' },
  { id: 'v5', name: '海宇 · 磁性男声', lang: '普通话', tone: '磁性大气', duration: '00:15', owner: 'clone' },
];

const templates = [
  {
    id: 'tpl1',
    name: '新品上市种草',
    category: '产品营销',
    color: 'from-blue-500 to-cyan-400',
    script: '这款新品把高性能与轻便体验结合在一起，适合通勤、学习和日常创作。今天下单还可享受限时优惠。',
  },
  {
    id: 'tpl2',
    name: '课程宣传片',
    category: '教育培训',
    color: 'from-emerald-500 to-teal-400',
    script: '如果你想系统提升专业能力，这门课程会从基础概念讲到真实案例，帮助你快速建立完整知识框架。',
  },
  {
    id: 'tpl3',
    name: '活动邀约',
    category: '活动促销',
    color: 'from-orange-500 to-amber-400',
    script: '本周五晚八点，直播间准备了专属福利和新品体验名额，欢迎预约参加，一起解锁更多实用内容。',
  },
];

const initialTasks = [
  {
    id: 'T2026052001',
    title: '618 耳机促销口播视频',
    avatar: '如夏',
    duration: '00:15',
    resolution: '1080P',
    status: 'running',
    progress: 48,
    createdAt: '2026-05-20 14:30',
  },
  {
    id: 'T2026052002',
    title: '新品发布会预告',
    avatar: '春辰',
    duration: '00:30',
    resolution: '1080P',
    status: 'composing',
    progress: 72,
    createdAt: '2026-05-20 14:20',
  },
  {
    id: 'T2026052003',
    title: '夏季护肤品推荐',
    avatar: '静怡',
    duration: '00:20',
    resolution: '1080P',
    status: 'queued',
    progress: 22,
    createdAt: '2026-05-20 14:10',
  },
  {
    id: 'T2026051905',
    title: '企业介绍视频',
    avatar: '浩宇',
    duration: '01:00',
    resolution: '1080P',
    status: 'done',
    progress: 100,
    createdAt: '2026-05-20 13:50',
  },
  {
    id: 'T2026051904',
    title: '课程宣传片',
    avatar: '子墨',
    duration: '00:45',
    resolution: '720P',
    status: 'done',
    progress: 100,
    createdAt: '2026-05-20 13:30',
  },
  {
    id: 'T2026051903',
    title: '活动通知',
    avatar: '雨桐',
    duration: '00:15',
    resolution: '1080P',
    status: 'failed',
    progress: 0,
    createdAt: '2026-05-20 13:10',
  },
];

const initialWorks = [
  {
    id: 'W001',
    title: '618 耳机促销口播视频',
    avatar: '如夏',
    image: avatars[0].image,
    duration: '00:15',
    spec: '1080P · 9:16',
    createdAt: '2026-05-20 14:30',
  },
  {
    id: 'W002',
    title: '新品发布会预告',
    avatar: '春辰',
    image: avatars[3].image,
    duration: '00:30',
    spec: '1080P · 9:16',
    createdAt: '2026-05-20 14:20',
  },
  {
    id: 'W003',
    title: '夏季护肤品推荐',
    avatar: '静怡',
    image: avatars[1].image,
    duration: '00:20',
    spec: '1080P · 9:16',
    createdAt: '2026-05-20 14:10',
  },
  {
    id: 'W004',
    title: '企业介绍视频',
    avatar: '浩宇',
    image: avatars[6].image,
    duration: '01:00',
    spec: '1080P · 16:9',
    createdAt: '2026-05-20 12:50',
  },
  {
    id: 'W005',
    title: '课程宣传片',
    avatar: '子墨',
    image: avatars[4].image,
    duration: '00:45',
    spec: '720P · 9:16',
    createdAt: '2026-05-20 13:30',
  },
  {
    id: 'W006',
    title: '活动通知',
    avatar: '雨桐',
    image: avatars[5].image,
    duration: '00:15',
    spec: '1080P · 9:16',
    createdAt: '2026-05-20 13:10',
  },
];

const defaultScript =
  '大家好，欢迎来到我们的品牌直播间！今天为大家带来一款高性价比的智能耳机，它拥有超长续航、高清音质和舒适佩戴体验，无论通勤、运动还是办公，都能带给你沉浸式的使用感受。现在下单，享受限时优惠，数量有限，先到先得！';

const statusMap = {
  queued: { label: '排队中', color: 'text-slate-500', bar: 'bg-slate-400' },
  running: { label: '视频生成中', color: 'text-blue-600', bar: 'bg-blue-600' },
  composing: { label: '合成渲染中', color: 'text-indigo-600', bar: 'bg-indigo-600' },
  done: { label: '已完成', color: 'text-emerald-600', bar: 'bg-emerald-500' },
  failed: { label: '失败', color: 'text-rose-600', bar: 'bg-rose-500' },
};

function App() {
  const [activeView, setActiveView] = useState('workbench');
  const [script, setScript] = useState(defaultScript);
  const [selectedAvatar, setSelectedAvatar] = useState(avatars[0]);
  const [selectedVoice, setSelectedVoice] = useState(voices[0]);
  const [tasks, setTasks] = useState(initialTasks);
  const [works, setWorks] = useState(initialWorks);
  const [tone, setTone] = useState('热情亲切');
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(88);
  const [aspect, setAspect] = useState('9:16');
  const [toast, setToast] = useState('已加载参考 Mockup 风格的数字人口播工作台');

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTasks((current) => {
        const completedNow = [];
        const next = current.map((task) => {
          if (!['queued', 'running', 'composing'].includes(task.status)) return task;
          const step = task.status === 'queued' ? 7 : task.status === 'running' ? 11 : 8;
          const progress = Math.min(task.progress + step, 100);
          if (progress >= 100) {
            completedNow.push(task);
            return { ...task, status: 'done', progress: 100 };
          }
          const status = progress > 62 ? 'composing' : progress > 26 ? 'running' : 'queued';
          return { ...task, progress, status };
        });

        if (completedNow.length) {
          setWorks((items) => {
            const newWorks = completedNow
              .filter((task) => !items.some((work) => work.taskId === task.id))
              .map((task) => ({
                id: `W${task.id}`,
                taskId: task.id,
                title: task.title,
                avatar: task.avatar,
                image: selectedAvatar.image,
                duration: task.duration,
                spec: `${task.resolution} · 9:16`,
                createdAt: task.createdAt,
              }));
            return newWorks.length ? [...newWorks, ...items] : items;
          });
        }

        return next;
      });
    }, 1400);

    return () => window.clearInterval(timer);
  }, [selectedAvatar.image]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const runningCount = tasks.filter((task) => ['queued', 'running', 'composing'].includes(task.status)).length;
  const completedCount = tasks.filter((task) => task.status === 'done').length;
  const failedCount = tasks.filter((task) => task.status === 'failed').length;

  function handleRewrite() {
    const polished = `大家好，欢迎来到直播间。今天给大家重点介绍这款智能耳机：它兼顾高清音质、稳定降噪和长续航表现，通勤、运动、办公都能轻松覆盖。现在下单可享限时福利，库存有限，想提升日常听音体验的朋友可以直接入手。`;
    setScript(polished);
    setTone('清晰有感染力');
    setToast('AI 已完成文案改写，并同步推荐了播报语气');
  }

  function handleGenerate() {
    const id = `T${Date.now().toString().slice(-10)}`;
    const title = script.slice(0, 16).replace(/[，。！？\s]/g, '') || '新建口播视频';
    const task = {
      id,
      title: `${title}口播视频`,
      avatar: selectedAvatar.name,
      duration: script.length > 160 ? '00:45' : '00:30',
      resolution: aspect === '9:16' ? '1080P' : '1080P',
      status: 'queued',
      progress: 5,
      createdAt: new Date().toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
    };
    setTasks((items) => [task, ...items]);
    setActiveView('tasks');
    setToast('生成任务已提交，任务中心会持续刷新进度');
  }

  function handleQuickTemplate(template) {
    setScript(template.script);
    setActiveView('create');
    setToast(`已套用「${template.name}」模板，可直接预览并生成`);
  }

  const currentPage = useMemo(() => {
    if (activeView === 'workbench' || activeView === 'create') {
      return (
        <CreateVideoPage
          isWorkbench={activeView === 'workbench'}
          script={script}
          setScript={setScript}
          selectedAvatar={selectedAvatar}
          setSelectedAvatar={setSelectedAvatar}
          selectedVoice={selectedVoice}
          setSelectedVoice={setSelectedVoice}
          tone={tone}
          setTone={setTone}
          speed={speed}
          setSpeed={setSpeed}
          volume={volume}
          setVolume={setVolume}
          aspect={aspect}
          setAspect={setAspect}
          handleRewrite={handleRewrite}
          handleGenerate={handleGenerate}
          runningCount={runningCount}
          completedCount={completedCount}
          failedCount={failedCount}
          works={works}
          tasks={tasks}
        />
      );
    }

    if (activeView === 'avatars' || activeView === 'voices') {
      return (
        <LibraryPage
          initialTab={activeView === 'avatars' ? 'avatars' : 'voices'}
          selectedAvatar={selectedAvatar}
          setSelectedAvatar={setSelectedAvatar}
          selectedVoice={selectedVoice}
          setSelectedVoice={setSelectedVoice}
          setToast={setToast}
        />
      );
    }

    if (activeView === 'tasks') {
      return <TaskCenterPage tasks={tasks} setTasks={setTasks} />;
    }

    if (activeView === 'works' || activeView === 'templates') {
      return (
        <WorksTemplatesPage
          initialTab={activeView === 'works' ? 'works' : 'templates'}
          works={works}
          setWorks={setWorks}
          handleQuickTemplate={handleQuickTemplate}
        />
      );
    }

    if (activeView === 'api') {
      return <ApiPage />;
    }

    return <SettingsPage />;
  }, [
    activeView,
    aspect,
    completedCount,
    failedCount,
    runningCount,
    script,
    selectedAvatar,
    selectedVoice,
    speed,
    tasks,
    tone,
    volume,
    works,
  ]);

  return (
    <div className="min-h-screen bg-[#f3f6fb] text-ink">
      <div className="flex min-h-screen">
        <Sidebar activeView={activeView} setActiveView={setActiveView} />
        <main className="min-w-0 flex-1 px-4 py-4 sm:px-6 lg:px-8">
          <Topbar />
          {currentPage}
        </main>
      </div>
      {toast ? (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full border border-blue-100 bg-white px-5 py-3 text-sm font-medium text-slate-700 shadow-panel">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function Sidebar({ activeView, setActiveView }) {
  return (
    <aside className="sticky top-0 block h-screen w-[76px] shrink-0 border-r border-slate-200/80 bg-white/95 px-3 py-5 shadow-[8px_0_30px_rgba(30,50,100,0.04)] lg:w-60 lg:px-4">
      <button
        className="mb-7 flex w-full items-center justify-center gap-3 text-left lg:justify-start"
        type="button"
        onClick={() => setActiveView('workbench')}
      >
        <div className="relative grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-soft">
          <Users className="h-6 w-6" />
          <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border-2 border-white bg-cyan-400">
            <Play className="h-3 w-3 fill-white text-white" />
          </span>
        </div>
        <div className="hidden lg:block">
          <div className="text-base font-black tracking-tight">数字人口播</div>
          <div className="text-xs text-slate-400">视频自动化平台</div>
        </div>
      </button>

      <nav className="space-y-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveView(item.id)}
              className={`group flex w-full items-center justify-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition lg:justify-start ${
                isActive
                  ? 'bg-blue-50 text-blue-700 shadow-[inset_0_0_0_1px_rgba(37,99,235,0.08)]'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
              title={item.label}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-700'}`} />
              <span className="hidden lg:inline">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="absolute bottom-5 left-4 right-4 hidden rounded-2xl border border-blue-100 bg-gradient-to-b from-blue-50 to-white p-4 lg:block">
        <div className="mb-2 text-sm font-bold text-blue-700">企业版</div>
        <div className="space-y-1 text-xs text-slate-500">
          <div className="flex justify-between">
            <span>有效期至</span>
            <span>2026-12-31</span>
          </div>
          <div className="flex justify-between">
            <span>剩余积分</span>
            <span className="font-bold text-slate-800">12,450</span>
          </div>
        </div>
        <button className="mt-3 w-full rounded-lg border border-blue-200 bg-white py-2 text-xs font-bold text-blue-700 shadow-sm" type="button">
          去充值
        </button>
      </div>
    </aside>
  );
}

function Topbar() {
  return (
    <header className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-white bg-white/80 px-4 py-3 shadow-soft backdrop-blur">
      <div className="min-w-0">
        <div className="text-xs font-semibold text-slate-400">AI Digital Human Studio</div>
        <h1 className="truncate text-lg font-black text-slate-950">数字人口播 Web 工作台</h1>
      </div>
      <div className="flex items-center gap-2">
        <button className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 md:flex" type="button">
          <HelpCircle className="h-4 w-4" />
          帮助中心
        </button>
        <button className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 md:flex" type="button">
          <FileText className="h-4 w-4" />
          新手教程
        </button>
        <button className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500" type="button">
          <Bell className="h-4 w-4" />
        </button>
        <button className="flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white" type="button">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-orange-300 to-blue-300 text-xs text-slate-900">
            N
          </span>
          <span className="hidden sm:inline">运营小助手</span>
          <ChevronDown className="hidden h-4 w-4 sm:block" />
        </button>
      </div>
    </header>
  );
}

function CreateVideoPage({
  isWorkbench,
  script,
  setScript,
  selectedAvatar,
  setSelectedAvatar,
  selectedVoice,
  setSelectedVoice,
  tone,
  setTone,
  speed,
  setSpeed,
  volume,
  setVolume,
  aspect,
  setAspect,
  handleRewrite,
  handleGenerate,
  runningCount,
  completedCount,
  failedCount,
  works,
  tasks,
}) {
  const scriptCount = script.length;

  return (
    <div className="space-y-4">
      {isWorkbench ? (
        <section className="grid gap-3 md:grid-cols-4">
          <MetricCard icon={Clapperboard} label="今日生成" value="23" hint="较昨日 +15%" tone="blue" />
          <MetricCard icon={Clock3} label="进行中" value={runningCount} hint="自动轮询进度" tone="cyan" />
          <MetricCard icon={CheckCircle2} label="已完成" value={completedCount} hint="可下载分享" tone="green" />
          <MetricCard icon={XCircle} label="失败任务" value={failedCount} hint="支持重试" tone="rose" />
        </section>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-panel">
        <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h2 className="text-xl font-black text-slate-950">视频生成</h2>
            <p className="mt-1 text-sm text-slate-500">输入中文文案，选择数字人和声音，快速生成 1080x1920 竖屏口播视频。</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600" type="button">
              导入文档
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-soft shadow-blue-200"
              type="button"
              onClick={handleRewrite}
            >
              <WandSparkles className="h-4 w-4" />
              AI 改写文案
            </button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(320px,1.08fr)_360px_340px]">
          <ScriptPanel script={script} setScript={setScript} scriptCount={scriptCount} handleRewrite={handleRewrite} />
          <PreviewPanel selectedAvatar={selectedAvatar} selectedVoice={selectedVoice} script={script} aspect={aspect} setAspect={setAspect} />
          <SettingsPanel
            selectedAvatar={selectedAvatar}
            setSelectedAvatar={setSelectedAvatar}
            selectedVoice={selectedVoice}
            setSelectedVoice={setSelectedVoice}
            tone={tone}
            setTone={setTone}
            speed={speed}
            setSpeed={setSpeed}
            volume={volume}
            setVolume={setVolume}
            aspect={aspect}
            handleGenerate={handleGenerate}
          />
        </div>
      </section>

      {isWorkbench ? (
        <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <RecentTasks tasks={tasks.slice(0, 4)} />
          <QuickWorks works={works.slice(0, 3)} />
        </section>
      ) : null}
    </div>
  );
}

function ScriptPanel({ script, setScript, scriptCount, handleRewrite }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-black text-slate-900">脚本输入</h3>
        <div className="flex gap-2">
          <button className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-500" type="button">
            粘贴文案
          </button>
          <button className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700" type="button" onClick={handleRewrite}>
            AI 优化
          </button>
        </div>
      </div>
      <textarea
        className="h-[330px] w-full resize-none rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
        value={script}
        maxLength={2000}
        onChange={(event) => setScript(event.target.value)}
      />
      <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
        <span>字数统计：{scriptCount}/2000</span>
        <button className="font-bold text-blue-600" type="button" onClick={() => setScript('')}>
          清空
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <SelectLike label="语言" value="普通话" />
        <SelectLike label="风格" value="热情亲切" />
        <SelectLike label="语速" value="1.0x" />
      </div>

      <label className="mt-4 flex cursor-pointer items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <span className="text-sm font-bold text-slate-700">自动优化停顿</span>
        <input className="h-5 w-10 accent-blue-600" type="checkbox" defaultChecked />
      </label>
    </div>
  );
}

function PreviewPanel({ selectedAvatar, selectedVoice, script, aspect, setAspect }) {
  const subtitle = script.slice(0, 24) || '输入文案后生成字幕预览';
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-black text-slate-900">视频预览</h3>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">竖屏优先</span>
      </div>
      <div className="mx-auto w-full max-w-[285px]">
        <div className="relative aspect-[9/16] overflow-hidden rounded-[28px] border-[8px] border-slate-950 bg-slate-900 shadow-2xl">
          <img className="h-full w-full object-cover opacity-95" src={selectedAvatar.image} alt={`${selectedAvatar.name} 预览`} />
          <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/55" />
          <div className="absolute left-3 top-3 rounded-full bg-black/35 px-2.5 py-1 text-xs font-bold text-white backdrop-blur">1080×1920</div>
          <div className="absolute bottom-20 left-4 right-4 text-center">
            <p className="rounded-lg bg-black/40 px-2 py-1 text-lg font-black leading-tight text-white shadow-lg">
              {subtitle}
            </p>
            <p className="mt-1 inline-block rounded bg-yellow-300 px-1.5 py-0.5 text-base font-black text-slate-950">限时优惠 立即抢购</p>
          </div>
          <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3 text-white">
            <button className="grid h-8 w-8 place-items-center rounded-full bg-white/18 backdrop-blur" type="button">
              <Play className="h-4 w-4 fill-white" />
            </button>
            <div className="h-1 flex-1 rounded-full bg-white/25">
              <div className="h-full w-2/5 rounded-full bg-white" />
            </div>
            <span className="text-xs font-semibold">00:05 / 00:15</span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-center gap-2">
        {['9:16', '3:4', '1:1', '16:9'].map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setAspect(item)}
            className={`rounded-lg px-3 py-1.5 text-xs font-black ${
              aspect === item ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
        当前声音：<span className="font-bold text-slate-800">{selectedVoice.name}</span>
      </div>
    </div>
  );
}

function SettingsPanel({
  selectedAvatar,
  setSelectedAvatar,
  selectedVoice,
  setSelectedVoice,
  tone,
  setTone,
  speed,
  setSpeed,
  volume,
  setVolume,
  aspect,
  handleGenerate,
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-black text-slate-900">数字人设置</h3>
          <button className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700" type="button">
            更换形象
          </button>
        </div>
        <div className="flex items-center gap-3">
          <img className="h-14 w-14 rounded-2xl object-cover" src={selectedAvatar.image} alt={selectedAvatar.name} />
          <div className="min-w-0">
            <div className="font-black text-slate-900">{selectedAvatar.name}</div>
            <div className="text-xs text-slate-500">
              {selectedAvatar.gender} | {selectedAvatar.age} | {selectedAvatar.scene}
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {avatars.slice(0, 3).map((avatar) => (
            <button
              key={avatar.id}
              type="button"
              onClick={() => setSelectedAvatar(avatar)}
              className={`overflow-hidden rounded-xl border ${
                selectedAvatar.id === avatar.id ? 'border-blue-500 ring-4 ring-blue-100' : 'border-slate-200'
              }`}
            >
              <img className="h-16 w-full object-cover" src={avatar.image} alt={avatar.name} />
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-black text-slate-900">声音设置</h3>
          <button className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600" type="button">
            克隆声音
          </button>
        </div>
        <select
          className="mb-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 outline-none"
          value={selectedVoice.id}
          onChange={(event) => setSelectedVoice(voices.find((voice) => voice.id === event.target.value) || voices[0])}
        >
          {voices.map((voice) => (
            <option key={voice.id} value={voice.id}>
              {voice.name}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-3 rounded-xl bg-blue-50 p-3">
          <button className="grid h-8 w-8 place-items-center rounded-full bg-blue-600 text-white" type="button">
            <Play className="h-4 w-4 fill-white" />
          </button>
          <Waveform seed={selectedVoice.name.length} />
        </div>
        <RangeControl label="音量" value={volume} min={0} max={100} suffix="%" onChange={setVolume} />
        <RangeControl label="语速" value={speed} min={0.6} max={1.5} step={0.1} suffix="x" onChange={setSpeed} />
        <SelectInput label="语气" value={tone} onChange={setTone} options={['热情亲切', '清晰有感染力', '稳重专业', '温柔知性']} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 font-black text-slate-900">视频设置</h3>
        <div className="grid gap-3">
          <SelectLike label="背景" value="简约布景" />
          <SelectLike label="画质" value={aspect === '9:16' ? '1080P 竖屏' : '1080P'} />
          <SelectLike label="帧率" value="25fps" />
        </div>
        <button
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700"
          type="button"
          onClick={handleGenerate}
        >
          <Video className="h-4 w-4" />
          生成视频
        </button>
        <p className="mt-2 text-center text-xs text-slate-400">预计消耗 10 积分</p>
      </div>
    </div>
  );
}

function LibraryPage({ initialTab, selectedAvatar, setSelectedAvatar, selectedVoice, setSelectedVoice, setToast }) {
  const [tab, setTab] = useState(initialTab);
  const [query, setQuery] = useState('');
  const filteredAvatars = avatars.filter((avatar) => avatar.name.includes(query) || avatar.scene.includes(query) || !query);
  const filteredVoices = voices.filter((voice) => voice.name.includes(query) || voice.tone.includes(query) || !query);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-panel">
      <div className="mb-4 flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
        <div>
          <h2 className="text-xl font-black text-slate-950">数字人形象与声音库</h2>
          <p className="mt-1 text-sm text-slate-500">管理数字人、选择声音模型，并支持上传或克隆专属声音。</p>
        </div>
        <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-soft" type="button">
          <Plus className="h-4 w-4" />
          创建数字人
        </button>
      </div>

      <div className="mb-4 flex border-b border-slate-200">
        <TabButton active={tab === 'avatars'} onClick={() => setTab('avatars')}>
          数字人形象
        </TabButton>
        <TabButton active={tab === 'voices'} onClick={() => setTab('voices')}>
          声音库
        </TabButton>
        <TabButton active={tab === 'mine'} onClick={() => setTab('mine')}>
          我的形象
        </TabButton>
      </div>

      <div className="mb-4 flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
        <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap">
          <FilterButton label="性别" value="全部" />
          <FilterButton label="年龄" value="全部" />
          <FilterButton label="场景" value="全部" />
          <FilterButton label="风格" value="全部" />
        </div>
        <div className="relative min-w-0 xl:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索数字人或声音"
          />
        </div>
      </div>

      {tab === 'voices' ? (
        <VoiceLibrary voices={filteredVoices} selectedVoice={selectedVoice} setSelectedVoice={setSelectedVoice} setToast={setToast} />
      ) : (
        <AvatarLibrary avatars={filteredAvatars} selectedAvatar={selectedAvatar} setSelectedAvatar={setSelectedAvatar} setToast={setToast} />
      )}
    </section>
  );
}

function AvatarLibrary({ avatars: avatarItems, selectedAvatar, setSelectedAvatar, setToast }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {avatarItems.map((avatar) => {
        const isActive = selectedAvatar.id === avatar.id;
        return (
          <button
            key={avatar.id}
            type="button"
            onClick={() => {
              setSelectedAvatar(avatar);
              setToast(`已选择数字人「${avatar.name}」`);
            }}
            className={`group overflow-hidden rounded-2xl border bg-white text-left transition hover:-translate-y-0.5 hover:shadow-soft ${
              isActive ? 'border-blue-500 ring-4 ring-blue-100' : 'border-slate-200'
            }`}
          >
            <div className="relative h-52 bg-slate-100">
              <img className="h-full w-full object-cover transition group-hover:scale-[1.03]" src={avatar.image} alt={avatar.name} />
              {avatar.badge ? (
                <span className="absolute right-3 top-3 rounded-full bg-blue-600 px-2 py-1 text-xs font-black text-white">{avatar.badge}</span>
              ) : null}
            </div>
            <div className="p-3">
              <div className="font-black text-slate-950">{avatar.name}</div>
              <div className="mt-1 text-xs text-slate-500">
                {avatar.gender} | {avatar.age} | {avatar.scene}
              </div>
              <div className="mt-2 rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-500">{avatar.outfit}</div>
            </div>
          </button>
        );
      })}
      <button
        type="button"
        className="grid min-h-[304px] place-items-center rounded-2xl border border-dashed border-blue-200 bg-blue-50/40 text-center text-blue-600"
      >
        <div>
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white shadow-soft">
            <Plus className="h-6 w-6" />
          </div>
          <div className="mt-3 text-sm font-black">创建数字人</div>
        </div>
      </button>
    </div>
  );
}

function VoiceLibrary({ voices: voiceItems, selectedVoice, setSelectedVoice, setToast }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">声音名称</th>
              <th className="px-4 py-3">语言/口音</th>
              <th className="px-4 py-3">风格</th>
              <th className="px-4 py-3">试听</th>
              <th className="px-4 py-3">时长</th>
              <th className="px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {voiceItems.map((voice) => (
              <tr key={voice.id} className={selectedVoice.id === voice.id ? 'bg-blue-50/60' : 'bg-white'}>
                <td className="px-4 py-3 font-black text-slate-800">{voice.name}</td>
                <td className="px-4 py-3 text-slate-500">{voice.lang}</td>
                <td className="px-4 py-3 text-slate-500">{voice.tone}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button className="grid h-7 w-7 place-items-center rounded-full bg-blue-600 text-white" type="button">
                      <Play className="h-3.5 w-3.5 fill-white" />
                    </button>
                    <Waveform seed={voice.name.length} compact />
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-500">{voice.duration}</td>
                <td className="px-4 py-3">
                  <button
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-black text-white"
                    type="button"
                    onClick={() => {
                      setSelectedVoice(voice);
                      setToast(`已选择声音「${voice.name}」`);
                    }}
                  >
                    使用
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="font-black text-slate-950">上传我的声音</h3>
        <p className="mt-1 text-sm text-slate-500">支持 mp3/wav 格式，建议 30 秒以上清晰人声。</p>
        <button className="mt-4 flex h-36 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-blue-200 bg-white text-blue-600" type="button">
          <Upload className="h-7 w-7" />
          <span className="text-sm font-black">上传文件</span>
        </button>
        <div className="mt-4 space-y-3 rounded-2xl bg-white p-3 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            自动降噪与音量标准化
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-600" />
            可创建专属 TTS 声音
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskCenterPage({ tasks, setTasks }) {
  const taskStats = [
    { label: '今日任务', value: 23, icon: FileText, tone: 'blue', hint: '较昨日 +15%' },
    { label: '进行中', value: tasks.filter((task) => ['queued', 'running', 'composing'].includes(task.status)).length, icon: Clock3, tone: 'cyan', hint: '较昨日 +20%' },
    { label: '已完成', value: tasks.filter((task) => task.status === 'done').length, icon: CheckCircle2, tone: 'green', hint: '较昨日 +32%' },
    { label: '失败任务', value: tasks.filter((task) => task.status === 'failed').length, icon: XCircle, tone: 'rose', hint: '较昨日 -50%' },
    { label: '累计生成', value: '1,245', icon: Gauge, tone: 'violet', hint: '较昨日 +18%' },
  ];

  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-panel">
        <div className="mb-4">
          <h2 className="text-xl font-black text-slate-950">任务中心</h2>
          <p className="mt-1 text-sm text-slate-500">查看视频生成进度、管理任务状态，并支持重试、取消和下载。</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {taskStats.map((item) => (
            <MetricCard key={item.label} {...item} />
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-panel">
        <h3 className="mb-4 font-black text-slate-950">任务流程</h3>
        <div className="grid gap-3 md:grid-cols-5">
          {[
            ['脚本解析', 23, Bot],
            ['内容审核', 18, ShieldCheck],
            ['视频生成', 8, Clapperboard],
            ['合成渲染', 5, Video],
            ['完成', 152, CheckCircle2],
          ].map(([label, value, Icon], index) => (
            <div key={label} className={`relative rounded-2xl border p-4 ${index === 2 ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'}`}>
              <div className="flex items-center justify-between">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-blue-600">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-xl font-black text-slate-950">{value}</span>
              </div>
              <div className="mt-3 text-sm font-black text-slate-700">{label}</div>
              {index < 4 ? <div className="absolute -right-2 top-1/2 hidden h-px w-4 bg-slate-200 md:block" /> : null}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-panel">
        <div className="mb-4 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div className="flex gap-2">
            {['全部任务', '进行中', '已完成', '失败'].map((item, index) => (
              <button key={item} className={`rounded-xl px-3 py-2 text-sm font-black ${index === 0 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`} type="button">
                {item}
              </button>
            ))}
          </div>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-black text-slate-600"
            type="button"
            onClick={() => setTasks((items) => items.map((task) => (task.status === 'failed' ? { ...task, status: 'queued', progress: 8 } : task)))}
          >
            <RefreshCw className="h-4 w-4" />
            重试失败任务
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">任务名称</th>
                <th className="px-4 py-3">数字人</th>
                <th className="px-4 py-3">时长</th>
                <th className="px-4 py-3">分辨率</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">进度</th>
                <th className="px-4 py-3">创建时间</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tasks.map((task) => {
                const status = statusMap[task.status];
                return (
                  <tr key={task.id} className="bg-white">
                    <td className="px-4 py-3 font-black text-slate-800">{task.title}</td>
                    <td className="px-4 py-3 text-slate-500">{task.avatar}</td>
                    <td className="px-4 py-3 text-slate-500">{task.duration}</td>
                    <td className="px-4 py-3 text-slate-500">{task.resolution}</td>
                    <td className={`px-4 py-3 font-black ${status.color}`}>{status.label}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 rounded-full bg-slate-100">
                          <div className={`h-full rounded-full ${status.bar}`} style={{ width: `${task.progress}%` }} />
                        </div>
                        <span className="w-9 text-xs text-slate-400">{task.progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{task.createdAt}</td>
                    <td className="px-4 py-3">
                      <button className="font-black text-blue-600" type="button">
                        {task.status === 'done' ? '下载' : task.status === 'failed' ? '重试' : '取消'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function WorksTemplatesPage({ initialTab, works, setWorks, handleQuickTemplate }) {
  const [tab, setTab] = useState(initialTab);
  const [query, setQuery] = useState('');
  const shownWorks = works.filter((work) => work.title.includes(query) || work.avatar.includes(query) || !query);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-panel">
      <div className="mb-4 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div>
          <h2 className="text-xl font-black text-slate-950">作品管理 / 模板中心</h2>
          <p className="mt-1 text-sm text-slate-500">集中管理成品视频、模板素材，并从模板一键发起竖屏口播生成。</p>
        </div>
        <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-soft" type="button">
          <Plus className="h-4 w-4" />
          新建视频
        </button>
      </div>

      <div className="mb-4 flex border-b border-slate-200">
        <TabButton active={tab === 'works'} onClick={() => setTab('works')}>
          我的作品
        </TabButton>
        <TabButton active={tab === 'templates'} onClick={() => setTab('templates')}>
          模板中心
        </TabButton>
        <TabButton active={tab === 'recycle'} onClick={() => setTab('recycle')}>
          回收站
        </TabButton>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
        <div>
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <FilterButton label="全部状态" value="全部" />
              <FilterButton label="全部数字人" value="全部" />
              <FilterButton label="全部时间" value="最近 30 天" />
            </div>
            <div className="flex gap-2">
              <div className="relative min-w-0">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100 lg:w-64"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索作品名称"
                />
              </div>
              <button className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white" type="button">
                <Grid3X3 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {tab === 'templates' ? (
            <TemplateGrid handleQuickTemplate={handleQuickTemplate} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {shownWorks.map((work) => (
                <WorkCard key={work.id} work={work} setWorks={setWorks} />
              ))}
              <button className="grid min-h-[300px] place-items-center rounded-2xl border border-dashed border-blue-200 bg-blue-50/40 text-center text-blue-600" type="button">
                <div>
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white shadow-soft">
                    <Upload className="h-6 w-6" />
                  </div>
                  <div className="mt-3 text-sm font-black">导入本地视频</div>
                </div>
              </button>
            </div>
          )}
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="font-black text-slate-950">模板中心</h3>
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none" placeholder="搜索模板名称" />
          </div>
          <div className="mt-4 space-y-2 text-sm font-semibold text-slate-600">
            {['全部模板', '热门推荐', '产品营销', '知识科普', '企业宣传', '电商带货', '活动促销', '教育培训'].map((item, index) => (
              <button key={item} className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left ${index === 1 ? 'bg-white text-blue-700 shadow-sm' : 'hover:bg-white'}`} type="button">
                <span>{item}</span>
                {index === 1 ? <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-600">热</span> : null}
              </button>
            ))}
          </div>
          <div className="mt-5">
            <h4 className="mb-3 text-sm font-black text-slate-950">热门模板</h4>
            {templates.slice(0, 2).map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => handleQuickTemplate(template)}
                className="mb-3 w-full overflow-hidden rounded-2xl bg-white text-left shadow-sm"
              >
                <div className={`h-20 bg-gradient-to-br ${template.color}`} />
                <div className="p-3">
                  <div className="font-black text-slate-900">{template.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{template.category} · 竖屏 00:35</div>
                  <div className="mt-2 text-xs font-black text-blue-600">使用模板</div>
                </div>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}

function TemplateGrid({ handleQuickTemplate }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {templates.map((template) => (
        <button
          key={template.id}
          type="button"
          onClick={() => handleQuickTemplate(template)}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-left transition hover:-translate-y-0.5 hover:shadow-soft"
        >
          <div className={`relative h-44 bg-gradient-to-br ${template.color}`}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.34),transparent_34%)]" />
            <div className="absolute bottom-4 left-4 right-4 text-white">
              <div className="text-sm font-semibold opacity-90">{template.category}</div>
              <div className="mt-1 text-xl font-black">{template.name}</div>
            </div>
          </div>
          <div className="p-4">
            <div className="text-sm text-slate-500">含镜头结构、字幕样式、口播节奏和默认竖屏画布。</div>
            <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm font-black text-blue-700">
              <Sparkles className="h-4 w-4" />
              快速生成
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function WorkCard({ work, setWorks }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="relative aspect-[9/12] bg-slate-100">
        <img className="h-full w-full object-cover" src={work.image} alt={work.title} />
        <span className="absolute bottom-3 right-3 rounded-full bg-black/55 px-2 py-1 text-xs font-bold text-white">{work.duration}</span>
        <input className="absolute left-3 top-3 h-4 w-4 rounded border-white accent-blue-600" type="checkbox" aria-label={`选择 ${work.title}`} />
      </div>
      <div className="p-3">
        <div className="truncate font-black text-slate-950">{work.title}</div>
        <div className="mt-1 text-xs text-slate-500">
          {work.avatar} | {work.spec}
        </div>
        <div className="mt-1 text-xs text-slate-400">{work.createdAt}</div>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-1.5">
            <IconButton icon={Play} label="预览" />
            <IconButton icon={Download} label="下载" />
            <IconButton icon={Share2} label="分享" />
          </div>
          <button
            className="rounded-lg px-2 py-1 text-xs font-black text-slate-400 hover:bg-rose-50 hover:text-rose-600"
            type="button"
            onClick={() => setWorks((items) => items.filter((item) => item.id !== work.id))}
          >
            删除
          </button>
        </div>
      </div>
    </article>
  );
}

function ApiPage() {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-panel">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <h2 className="text-xl font-black text-slate-950">API</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">通过 API Key 接入文案提交、数字人合成、任务状态查询和成品回调，适合把口播视频生成接入现有 CMS、CRM 或营销工具。</p>
        </div>
        <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white" type="button">
          <Plus className="h-4 w-4" />
          创建 Key
        </button>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {[
          ['RESTful API', '提交生成任务、查询任务进度、获取结果地址。'],
          ['Webhook 回调', '合成完成、失败、取消等状态自动推送。'],
          ['安全配额', '支持 IP 白名单、调用限额与积分消耗记录。'],
        ].map(([title, text]) => (
          <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="font-black text-slate-950">{title}</div>
            <div className="mt-2 text-sm leading-6 text-slate-500">{text}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SettingsPage() {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-panel">
      <h2 className="text-xl font-black text-slate-950">设置</h2>
      <p className="mt-1 text-sm text-slate-500">配置团队权限、默认输出规格、字幕样式和任务通知。</p>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {[
          ['默认输出比例', '9:16 竖屏视频'],
          ['字幕样式', '白字黑描边，高亮关键词'],
          ['任务通知', '站内通知 + Webhook'],
          ['团队权限', '管理员、运营、审核员'],
        ].map(([label, value]) => (
          <div key={label} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="font-black text-slate-800">{label}</div>
            <div className="text-sm text-slate-500">{value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RecentTasks({ tasks }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-panel">
      <h3 className="mb-3 font-black text-slate-950">最近任务</h3>
      <div className="space-y-3">
        {tasks.map((task) => {
          const status = statusMap[task.status];
          return (
            <div key={task.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-white text-blue-600">
                <Video className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-black text-slate-800">{task.title}</div>
                <div className="mt-1 h-1.5 rounded-full bg-white">
                  <div className={`h-full rounded-full ${status.bar}`} style={{ width: `${task.progress}%` }} />
                </div>
              </div>
              <div className={`text-xs font-black ${status.color}`}>{status.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuickWorks({ works }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-panel">
      <h3 className="mb-3 font-black text-slate-950">作品快捷入口</h3>
      <div className="space-y-3">
        {works.map((work) => (
          <div key={work.id} className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-2">
            <img className="h-16 w-12 rounded-xl object-cover" src={work.image} alt={work.title} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-black text-slate-800">{work.title}</div>
              <div className="mt-1 text-xs text-slate-500">{work.spec}</div>
              <button className="mt-2 text-xs font-black text-blue-600" type="button">
                继续编辑
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, hint, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600',
    cyan: 'bg-cyan-50 text-cyan-600',
    green: 'bg-emerald-50 text-emerald-600',
    rose: 'bg-rose-50 text-rose-600',
    violet: 'bg-violet-50 text-violet-600',
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className={`grid h-10 w-10 place-items-center rounded-xl ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="text-xs font-bold text-emerald-600">{hint}</span>
      </div>
      <div className="mt-3 text-sm font-semibold text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-black text-slate-950">{value}</div>
    </div>
  );
}

function SelectLike({ label, value }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-bold text-slate-500">{label}</label>
      <button className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-700" type="button">
        <span className="truncate">{value}</span>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>
    </div>
  );
}

function SelectInput({ label, value, options, onChange }) {
  return (
    <label className="mt-3 block">
      <span className="mb-1 block text-xs font-bold text-slate-500">{label}</span>
      <select className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function RangeControl({ label, value, min, max, step = 1, suffix, onChange }) {
  return (
    <label className="mt-3 block">
      <div className="mb-1 flex justify-between text-xs font-bold text-slate-500">
        <span>{label}</span>
        <span>
          {value}
          {suffix}
        </span>
      </div>
      <input
        className="w-full accent-blue-600"
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function FilterButton({ label, value }) {
  return (
    <button className="inline-flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600" type="button">
      <span>{label}</span>
      <span className="text-slate-400">{value}</span>
      <ChevronDown className="h-4 w-4 text-slate-400" />
    </button>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      className={`-mb-px border-b-2 px-4 py-3 text-sm font-black transition ${
        active ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-900'
      }`}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function IconButton({ icon: Icon, label }) {
  return (
    <button className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600" type="button" aria-label={label} title={label}>
      <Icon className="h-4 w-4" />
    </button>
  );
}

function Waveform({ seed = 3, compact = false }) {
  const bars = Array.from({ length: compact ? 22 : 28 }, (_, index) => 8 + ((index * 7 + seed * 5) % (compact ? 18 : 28)));
  return (
    <div className={`flex flex-1 items-center gap-1 ${compact ? 'h-7 max-w-36' : 'h-9'}`}>
      {bars.map((height, index) => (
        <span key={`${height}-${index}`} className="w-1 rounded-full bg-blue-500/80" style={{ height }} />
      ))}
    </div>
  );
}

export default App;
