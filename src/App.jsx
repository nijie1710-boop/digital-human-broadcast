import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Bell,
  Braces,
  Calculator,
  CheckCircle2,
  ChevronDown,
  Clapperboard,
  Clock3,
  Copy,
  Download,
  Edit3,
  Eye,
  FileText,
  FolderOpen,
  Gauge,
  Grid3X3,
  HelpCircle,
  LayoutDashboard,
  LayoutTemplate,
  ListChecks,
  Loader2,
  Mic2,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  Trash2,
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

const defaultScript =
  '大家好，欢迎来到我们的品牌直播间！今天为大家带来一款高性价比的智能耳机，它拥有超长续航、高清音质和舒适佩戴体验，无论通勤、运动还是办公，都能带给你沉浸式的使用感受。现在下单，享受限时优惠，数量有限，先到先得！';

const subtitleOptions = ['关键词高亮', '清爽白字', '重点描边', '商务蓝', '新闻下三分之一'];
const backgroundOptions = ['保留原图背景', '简约直播间', '书房背景', '企业展厅', '课堂背景', '新闻演播厅', '纯色背景', '自定义背景'];
const introOutroOptions = ['无片头片尾', '品牌片头 + 福利片尾', '标题片头 + 总结片尾', 'Logo 片头 + 联系方式片尾', '课程标题片头 + 报名片尾'];
const templateCategories = ['全部', '电商口播', '知识讲解', '企业宣传', '课程讲解', '新闻播报'];

const statusMap = {
  pending: { label: '排队中', color: 'text-slate-500', bar: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600' },
  running: { label: '生成中', color: 'text-blue-600', bar: 'bg-blue-600', badge: 'bg-blue-50 text-blue-700' },
  success: { label: '已完成', color: 'text-emerald-600', bar: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700' },
  failed: { label: '失败', color: 'text-rose-600', bar: 'bg-rose-500', badge: 'bg-rose-50 text-rose-700' },
  cancelled: { label: '已取消', color: 'text-amber-600', bar: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700' },
};

const voiceStatusMap = {
  ready: { label: '可用', className: 'bg-emerald-50 text-emerald-700' },
  pending: { label: '克隆中', className: 'bg-amber-50 text-amber-700' },
  failed: { label: '克隆失败', className: 'bg-rose-50 text-rose-700' },
  deleted: { label: '已删除', className: 'bg-slate-100 text-slate-500' },
};

async function apiFetch(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data?.error || `请求失败：${response.status}`);
  }
  return data;
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function cnDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('zh-CN');
}

function hasActiveJobs(jobs) {
  return jobs.some((job) => ['pending', 'running'].includes(job.status));
}

function countBillingCharacters(value) {
  return Array.from(String(value || '').trim()).reduce((total, char) => {
    return total + (/[\u3400-\u9fff\uf900-\ufaff]/i.test(char) ? 2 : 1);
  }, 0);
}

function estimateVideoSeconds(value) {
  const textLength = Array.from(String(value || '').trim()).length;
  if (!textLength) return 0;
  return Math.max(5, Math.ceil(textLength / 4));
}

function formatMoney(value) {
  if (!Number.isFinite(value) || value <= 0) return '¥0.00';
  if (value < 0.01) return `¥${value.toFixed(4)}`;
  return `¥${value.toFixed(2)}`;
}

function formatBytes(value) {
  if (!Number.isFinite(value)) return '';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function fileMatchesAccept(file, accept) {
  if (!file) return false;
  const fileName = file.name.toLowerCase();
  const fileType = String(file.type || '').toLowerCase();
  return accept.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean).some((rule) => {
    if (rule.startsWith('.')) return fileName.endsWith(rule);
    if (rule.endsWith('/*')) return fileType.startsWith(rule.slice(0, -1));
    return fileType === rule;
  });
}

function buildCostEstimate(script, systemConfig) {
  const config = systemConfig.cost || {};
  const enabled = Boolean(config.enabled);
  const seconds = estimateVideoSeconds(script);
  const billingCharacters = countBillingCharacters(script);
  const videoUnitPrice = Number(config.videoUnitPricePerSecond || 0);
  const ttsUnitPrice = Number(config.ttsUnitPricePer10kCharacters || 0);
  const detectUnitPrice = Number(config.detectUnitPricePerImage || 0);
  const videoCost = enabled ? seconds * videoUnitPrice : 0;
  const ttsCost = enabled ? (billingCharacters / 10000) * ttsUnitPrice : 0;
  const detectCost = enabled && seconds > 0 ? detectUnitPrice : 0;

  return {
    enabled,
    provider: systemConfig.provider || 'mock',
    seconds,
    billingCharacters,
    videoCost,
    ttsCost,
    detectCost,
    total: videoCost + ttsCost + detectCost,
    videoModel: config.videoModel || 'wan2.2-s2v',
    videoResolution: config.videoResolution || '480P',
    note: config.note || '仅为生成前预估，实际费用以模型服务商账单为准。',
  };
}

function isVideoRetalkMode(systemConfig) {
  return systemConfig.provider === 'aliyun' && systemConfig.aliyun?.videoMode === 'videoretalk';
}

function isHeyGenMode(systemConfig) {
  return systemConfig.provider === 'heygen';
}

function isHeyGenImageAvatar(systemConfig, avatar) {
  return isHeyGenMode(systemConfig) && Boolean(avatar) && !avatar.providerAvatarId;
}

function providerDisplayName(systemConfig) {
  if (isHeyGenMode(systemConfig)) return 'HeyGen 高质量数字人';
  if (isVideoRetalkMode(systemConfig)) return '阿里 VideoRetalk 口型替换';
  if (systemConfig.provider === 'aliyun') return '阿里百炼 s2v 单图驱动';
  if (systemConfig.provider === 'did') return 'D-ID 数字人口播';
  return 'Mock 本地模拟';
}

function providerIdDisplayName(provider) {
  if (provider === 'heygen') return 'HeyGen';
  if (provider === 'aliyun') return '阿里';
  if (provider === 'did') return 'D-ID';
  return '外部服务';
}

function resolveVoiceProvider({ voice, systemConfig, providerVoiceId, clone }) {
  const existingProvider = voice?.provider && voice.provider !== 'mock' ? voice.provider : '';
  const activeProvider = systemConfig.provider || 'mock';
  if (providerVoiceId.trim()) {
    if (existingProvider) return existingProvider;
    if (activeProvider === 'aliyun' || activeProvider === 'heygen' || activeProvider === 'did') return activeProvider;
    return 'heygen';
  }
  return voice?.provider || (clone ? activeProvider : 'mock');
}

function getScriptLimit(systemConfig) {
  return Number(systemConfig.scriptLimit || (systemConfig.provider === 'aliyun' ? 120 : 3000));
}

function getScriptLimitMessage(systemConfig) {
  if (systemConfig.scriptLimitMessage) return systemConfig.scriptLimitMessage;
  if (isVideoRetalkMode(systemConfig)) return 'VideoRetalk 首版建议每段文案不超过 120 字，长文案后续使用分段生成';
  return systemConfig.provider === 'aliyun'
    ? '阿里真实数字人模式下，首版建议每段文案不超过 120 字。长文案请后续使用分段生成。'
    : '文案不能超过 3000 字';
}

function App() {
  const [activeView, setActiveView] = useState('workbench');
  const [avatars, setAvatars] = useState([]);
  const [voices, setVoices] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [systemConfig, setSystemConfig] = useState({ provider: 'mock' });
  const [script, setScript] = useState(defaultScript);
  const [selectedAvatarId, setSelectedAvatarId] = useState('');
  const [selectedVoiceId, setSelectedVoiceId] = useState('');
  const [subtitleStyle, setSubtitleStyle] = useState('关键词高亮');
  const [backgroundConfig, setBackgroundConfig] = useState('简约直播间');
  const [backgroundImageUrl, setBackgroundImageUrl] = useState('');
  const [introOutroConfig, setIntroOutroConfig] = useState('品牌片头 + 福利片尾');
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [confirmGeneration, setConfirmGeneration] = useState(null);

  async function refreshAll({ silent = false } = {}) {
    if (!silent) setLoading(true);
    try {
      const [healthData, avatarData, voiceData, templateData, jobData, projectData] = await Promise.all([
        apiFetch('/api/health'),
        apiFetch('/api/avatars'),
        apiFetch('/api/voices'),
        apiFetch('/api/templates'),
        apiFetch('/api/jobs'),
        apiFetch('/api/projects'),
      ]);
      setSystemConfig(healthData);
      setAvatars(avatarData);
      setVoices(voiceData);
      setTemplates(templateData);
      setJobs(jobData);
      setProjects(projectData);
      setError('');

      const defaultAvatar = avatarData.find((item) => item.isDefault) || avatarData[0];
      const defaultVoice = voiceData.find((item) => item.isDefault) || voiceData[0];
      setSelectedAvatarId((current) => (avatarData.some((item) => item.id === current) ? current : defaultAvatar?.id || ''));
      setSelectedVoiceId((current) => (voiceData.some((item) => item.id === current) ? current : defaultVoice?.id || ''));
    } catch (apiError) {
      setError(apiError.message);
      setToast(apiError.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    refreshAll();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (hasActiveJobs(jobs) || jobs.length === 0) {
        refreshAll({ silent: true });
      } else {
        apiFetch('/api/voices')
          .then(setVoices)
          .catch(() => {});
      }
    }, 2500);
    return () => window.clearInterval(timer);
  }, [jobs]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const handler = (event) => setToast(event.detail);
    window.addEventListener('app-toast', handler);
    return () => window.removeEventListener('app-toast', handler);
  }, []);

  const selectedAvatar = avatars.find((item) => item.id === selectedAvatarId);
  const selectedVoice = voices.find((item) => item.id === selectedVoiceId);
  const costEstimate = useMemo(() => buildCostEstimate(script, systemConfig), [script, systemConfig]);
  const currentScriptLimit = getScriptLimit(systemConfig);
  const currentScriptLimitMessage = getScriptLimitMessage(systemConfig);

  async function handleRewrite() {
    if (!script.trim()) {
      setToast('请先输入文案');
      return;
    }
    setBusy('rewrite');
    try {
      const data = await apiFetch('/api/ai/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script }),
      });
      setScript(data.script);
      setSubtitleStyle('关键词高亮');
      setToast('AI 已完成文案改写');
    } catch (apiError) {
      setToast(apiError.message);
    } finally {
      setBusy('');
    }
  }

  function validateGeneration(text) {
    if (!text) {
      setToast('请输入视频文案');
      return false;
    }
    if (text.length > currentScriptLimit) {
      setToast(currentScriptLimitMessage);
      return false;
    }
    if (!selectedAvatarId) {
      setToast('请选择数字人');
      return false;
    }
    if (!selectedVoiceId) {
      setToast('请选择声音');
      return false;
    }
    if (selectedVoice?.status !== 'ready') {
      setToast('当前声音还在克隆处理中，请稍后再试');
      return false;
    }
    if (systemConfig.provider === 'aliyun' && !systemConfig.aliyun?.configured) {
      setToast('未配置阿里 API Key，请设置 ALIYUN_DASHSCOPE_API_KEY');
      return false;
    }
    if (systemConfig.provider === 'heygen' && !systemConfig.heygen?.configured) {
      setToast('请先配置 HEYGEN_API_KEY。');
      return false;
    }
    if (isHeyGenImageAvatar(systemConfig, selectedAvatar) && !systemConfig.heygen?.publicBaseUrlConfigured) {
      setToast('本地图片驱动 HeyGen 需要 PUBLIC_BASE_URL 公网地址，请使用 Cloudflare Tunnel/ngrok 或部署到服务器。');
      return false;
    }
    if (systemConfig.provider === 'aliyun' && systemConfig.aliyun?.videoMode === 'videoretalk' && !selectedAvatar?.sourceVideo) {
      setToast('VideoRetalk 模式需要先给数字人上传基础视频');
      setActiveView('avatars');
      return false;
    }
    return true;
  }

  async function createGenerationJob(text) {
    setBusy('generate');
    try {
      const job = await apiFetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: text,
          avatarId: selectedAvatarId,
          voiceId: selectedVoiceId,
          subtitleStyle: isHeyGenMode(systemConfig) ? '暂未启用字幕样式' : subtitleStyle,
          backgroundConfig,
          backgroundImageUrl,
          introOutroConfig: isHeyGenMode(systemConfig) ? '无片头片尾' : introOutroConfig,
        }),
      });
      setJobs((items) => [job, ...items]);
      setActiveView('tasks');
      setToast('生成任务已创建，任务中心会自动刷新进度');
      refreshAll({ silent: true });
    } catch (apiError) {
      setToast(apiError.message);
    } finally {
      setBusy('');
    }
  }

  async function handleGenerate() {
    const text = script.trim();
    if (!validateGeneration(text)) return;

    if (isHeyGenMode(systemConfig)) {
      setConfirmGeneration({
        text,
        estimate: buildCostEstimate(text, systemConfig),
      });
      return;
    }

    await createGenerationJob(text);
  }

  async function confirmGenerate() {
    const text = confirmGeneration?.text || script.trim();
    setConfirmGeneration(null);
    await createGenerationJob(text);
  }

  function applyTemplate(template) {
    setScript(`请按以下结构生成口播文案：${template.scriptPrompt}\n\n开场：一句话抓住注意力。\n卖点：列出 2-3 个核心价值。\n场景：说明适合谁、什么时候使用。\n结尾：给出明确行动号召。`);
    setSubtitleStyle(template.subtitleStyle);
    setBackgroundConfig(template.backgroundConfig);
    setIntroOutroConfig(template.introOutroConfig);
    setActiveView('create');
    setToast(`已套用模板「${template.name}」`);
  }

  function reuseProject(project) {
    setScript(project.script);
    setSelectedAvatarId(project.avatarId);
    setSelectedVoiceId(project.voiceId);
    setSubtitleStyle(project.job?.subtitleStyle || '关键词高亮');
    setBackgroundConfig(project.job?.backgroundConfig || '简约直播间');
    setBackgroundImageUrl(project.job?.backgroundImageUrl || '');
    setIntroOutroConfig(project.job?.introOutroConfig || '品牌片头 + 福利片尾');
    setActiveView('create');
    setToast(`已复用作品「${project.title}」配置`);
  }

  const page = useMemo(() => {
    const shared = {
      avatars,
      voices,
      templates,
      jobs,
      projects,
      refreshAll,
      setToast,
      setActiveView,
      systemConfig,
    };

    if (activeView === 'workbench' || activeView === 'create') {
      return (
        <CreateVideoPage
          {...shared}
          isWorkbench={activeView === 'workbench'}
          script={script}
          setScript={setScript}
          selectedAvatarId={selectedAvatarId}
          setSelectedAvatarId={setSelectedAvatarId}
          selectedVoiceId={selectedVoiceId}
          setSelectedVoiceId={setSelectedVoiceId}
          selectedAvatar={selectedAvatar}
          selectedVoice={selectedVoice}
          subtitleStyle={subtitleStyle}
          setSubtitleStyle={setSubtitleStyle}
          backgroundConfig={backgroundConfig}
          setBackgroundConfig={setBackgroundConfig}
          backgroundImageUrl={backgroundImageUrl}
          setBackgroundImageUrl={setBackgroundImageUrl}
          introOutroConfig={introOutroConfig}
          setIntroOutroConfig={setIntroOutroConfig}
          busy={busy}
          handleRewrite={handleRewrite}
          handleGenerate={handleGenerate}
          costEstimate={costEstimate}
          scriptLimit={currentScriptLimit}
          scriptLimitMessage={currentScriptLimitMessage}
        />
      );
    }

    if (activeView === 'avatars' || activeView === 'voices') {
      return (
        <LibraryPage
          {...shared}
          initialTab={activeView === 'avatars' ? 'avatars' : 'voices'}
          selectedAvatarId={selectedAvatarId}
          setSelectedAvatarId={setSelectedAvatarId}
          selectedVoiceId={selectedVoiceId}
          setSelectedVoiceId={setSelectedVoiceId}
        />
      );
    }

    if (activeView === 'tasks') {
      return <TaskCenterPage {...shared} />;
    }

    if (activeView === 'works' || activeView === 'templates') {
      return (
        <WorksTemplatesPage
          {...shared}
          initialTab={activeView === 'works' ? 'works' : 'templates'}
          applyTemplate={applyTemplate}
          reuseProject={reuseProject}
        />
      );
    }

    if (activeView === 'api') return <ApiPage />;
    return <SettingsPage setToast={setToast} systemConfig={systemConfig} refreshAll={refreshAll} />;
  }, [
    activeView,
    avatars,
    backgroundConfig,
    backgroundImageUrl,
    busy,
    introOutroConfig,
    jobs,
    projects,
    script,
    selectedAvatar,
    selectedAvatarId,
    selectedVoice,
    selectedVoiceId,
    subtitleStyle,
    systemConfig,
    templates,
    voices,
    costEstimate,
    currentScriptLimit,
    currentScriptLimitMessage,
  ]);

  return (
    <div className="min-h-screen bg-[#f3f6fb] text-ink">
      <div className="flex min-h-screen">
        <Sidebar activeView={activeView} setActiveView={setActiveView} setToast={setToast} />
        <main className="min-w-0 flex-1 px-4 py-4 sm:px-6 lg:px-8">
          <Topbar setToast={setToast} />
          {error ? (
            <div className="mb-4 flex items-center gap-2 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          ) : null}
          {loading ? <LoadingState /> : page}
        </main>
      </div>
      {toast ? (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full border border-blue-100 bg-white px-5 py-3 text-sm font-medium text-slate-700 shadow-panel">
          {toast}
        </div>
      ) : null}
      {confirmGeneration ? (
        <GenerationConfirmModal
          estimate={confirmGeneration.estimate}
          script={confirmGeneration.text}
          avatar={selectedAvatar}
          voice={selectedVoice}
          systemConfig={systemConfig}
          backgroundConfig={backgroundConfig}
          busy={busy === 'generate'}
          onConfirm={confirmGenerate}
          onClose={() => setConfirmGeneration(null)}
        />
      ) : null}
    </div>
  );
}

function Sidebar({ activeView, setActiveView, setToast }) {
  return (
    <aside className="sticky top-0 block h-screen w-[76px] shrink-0 border-r border-slate-200/80 bg-white/95 px-3 py-5 shadow-[8px_0_30px_rgba(30,50,100,0.04)] lg:w-60 lg:px-4">
      <button className="mb-7 flex w-full items-center justify-center gap-3 text-left lg:justify-start" type="button" onClick={() => setActiveView('workbench')}>
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
        <button className="mt-3 w-full rounded-lg border border-blue-200 bg-white py-2 text-xs font-bold text-blue-700 shadow-sm" type="button" onClick={() => setToast('充值入口已预留，可接入支付/积分系统')}>
          去充值
        </button>
      </div>
    </aside>
  );
}

function Topbar({ setToast }) {
  return (
    <header className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-white bg-white/80 px-4 py-3 shadow-soft backdrop-blur">
      <div className="min-w-0">
        <div className="text-xs font-semibold text-slate-400">AI Digital Human Studio</div>
        <h1 className="truncate text-lg font-black text-slate-950">数字人口播 Web 工作台</h1>
      </div>
      <div className="flex items-center gap-2">
        <button className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 md:flex" type="button" onClick={() => setToast('新手教程已预留，可接入帮助文档')}>
          <HelpCircle className="h-4 w-4" />
          帮助中心
        </button>
        <button className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 md:flex" type="button" onClick={() => setToast('教程入口已记录')}>
          <FileText className="h-4 w-4" />
          新手教程
        </button>
        <button className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500" type="button" onClick={() => setToast('暂无新通知')}>
          <Bell className="h-4 w-4" />
        </button>
        <button className="flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white" type="button" onClick={() => setToast('当前账号：运营小助手')}>
          <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-orange-300 to-blue-300 text-xs text-slate-900">N</span>
          <span className="hidden sm:inline">运营小助手</span>
          <ChevronDown className="hidden h-4 w-4 sm:block" />
        </button>
      </div>
    </header>
  );
}

function CreateVideoPage({
  isWorkbench,
  avatars,
  voices,
  jobs,
  projects,
  script,
  setScript,
  selectedAvatarId,
  setSelectedAvatarId,
  selectedVoiceId,
  setSelectedVoiceId,
  selectedAvatar,
  selectedVoice,
  subtitleStyle,
  setSubtitleStyle,
  backgroundConfig,
  setBackgroundConfig,
  backgroundImageUrl,
  setBackgroundImageUrl,
  introOutroConfig,
  setIntroOutroConfig,
  busy,
  handleRewrite,
  handleGenerate,
  costEstimate,
  scriptLimit,
  scriptLimitMessage,
  systemConfig,
  setToast,
  setActiveView,
}) {
  const fileRef = useRef(null);
  const activeJobs = jobs.filter((job) => ['pending', 'running'].includes(job.status));
  const completedJobs = jobs.filter((job) => job.status === 'success');
  const failedJobs = jobs.filter((job) => job.status === 'failed');

  async function importTextFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setScript(text.slice(0, 3000));
    setToast(text.length > scriptLimit ? scriptLimitMessage : `已导入「${file.name}」`);
    event.target.value = '';
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        setToast('剪贴板没有可导入文本');
        return;
      }
      setScript(text.slice(0, 3000));
      setToast(text.length > scriptLimit ? scriptLimitMessage : '已从剪贴板导入文案');
    } catch {
      setToast('浏览器未授权读取剪贴板');
    }
  }

  return (
    <div className="space-y-4">
      {isWorkbench ? (
        <section className="grid gap-3 md:grid-cols-4">
          <MetricCard icon={Clapperboard} label="今日生成" value={jobs.length} hint="API 实时读取" tone="blue" />
          <MetricCard icon={Clock3} label="进行中" value={activeJobs.length} hint="自动轮询进度" tone="cyan" />
          <MetricCard icon={CheckCircle2} label="已完成" value={completedJobs.length} hint="可下载分享" tone="green" />
          <MetricCard icon={XCircle} label="失败任务" value={failedJobs.length} hint="支持重试" tone="rose" />
        </section>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-panel">
        <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h2 className="text-xl font-black text-slate-950">视频生成</h2>
            <p className="mt-1 text-sm text-slate-500">输入中文文案，选择数字人和声音，创建真实 generation job，完成后进入作品管理。</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileRef} className="hidden" type="file" accept=".txt,.md,.csv" onChange={importTextFile} />
            <button className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600" type="button" onClick={() => fileRef.current?.click()}>
              导入文档
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-soft shadow-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={handleRewrite}
              disabled={busy === 'rewrite'}
            >
              {busy === 'rewrite' ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
              AI 改写文案
            </button>
          </div>
        </div>

        <GenerationReadiness
          script={script}
          selectedAvatar={selectedAvatar}
          selectedVoice={selectedVoice}
          systemConfig={systemConfig}
          scriptLimit={scriptLimit}
          setActiveView={setActiveView}
          setToast={setToast}
        />

        <div className="grid gap-4 xl:grid-cols-[minmax(320px,1.08fr)_360px_340px]">
          <ScriptPanel script={script} setScript={setScript} handleRewrite={handleRewrite} pasteFromClipboard={pasteFromClipboard} busy={busy} scriptLimit={scriptLimit} />
          <PreviewPanel selectedAvatar={selectedAvatar} selectedVoice={selectedVoice} script={script} subtitleStyle={subtitleStyle} backgroundConfig={backgroundConfig} />
          <SettingsPanel
            avatars={avatars}
            voices={voices}
            selectedAvatarId={selectedAvatarId}
            setSelectedAvatarId={setSelectedAvatarId}
            selectedVoiceId={selectedVoiceId}
            setSelectedVoiceId={setSelectedVoiceId}
            selectedAvatar={selectedAvatar}
            selectedVoice={selectedVoice}
            subtitleStyle={subtitleStyle}
            setSubtitleStyle={setSubtitleStyle}
            backgroundConfig={backgroundConfig}
            setBackgroundConfig={setBackgroundConfig}
            backgroundImageUrl={backgroundImageUrl}
            setBackgroundImageUrl={setBackgroundImageUrl}
            introOutroConfig={introOutroConfig}
            setIntroOutroConfig={setIntroOutroConfig}
            handleGenerate={handleGenerate}
            busy={busy}
            setActiveView={setActiveView}
            setToast={setToast}
            costEstimate={costEstimate}
            systemConfig={systemConfig}
          />
        </div>
      </section>

      {isWorkbench ? (
        <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <RecentTasks tasks={jobs.slice(0, 4)} setActiveView={setActiveView} />
          <QuickWorks projects={projects.slice(0, 3)} setActiveView={setActiveView} />
        </section>
      ) : null}
    </div>
  );
}

function ScriptPanel({ script, setScript, handleRewrite, pasteFromClipboard, busy, scriptLimit }) {
  const overLimit = script.length > scriptLimit;
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-black text-slate-900">脚本输入</h3>
        <div className="flex gap-2">
          <button className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-500" type="button" onClick={pasteFromClipboard}>
            粘贴文案
          </button>
          <button className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 disabled:opacity-60" type="button" onClick={handleRewrite} disabled={busy === 'rewrite'}>
            AI 优化
          </button>
        </div>
      </div>
      <textarea
        className={`h-[330px] w-full resize-none rounded-2xl border bg-white p-4 text-sm leading-7 text-slate-700 outline-none transition focus:ring-4 ${
          overLimit ? 'border-rose-300 focus:ring-rose-100' : 'border-slate-200 focus:border-blue-300 focus:ring-blue-100'
        }`}
        value={script}
        maxLength={3000}
        onChange={(event) => setScript(event.target.value)}
        placeholder={scriptLimit <= 120 ? '请输入 120 字以内的短口播文案。' : '请输入 500 字以内的短口播文案，最多支持 3000 字。'}
      />
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className={overLimit ? 'font-bold text-rose-600' : script.length > Math.min(500, scriptLimit) ? 'text-amber-600' : 'text-slate-400'}>
          字数统计：{script.length}/{scriptLimit} {script.length > scriptLimit ? '，当前文案过长' : script.length > 500 ? '，长文案会生成更长视频' : ''}
        </span>
        <button className="font-bold text-blue-600" type="button" onClick={() => setScript('')}>
          清空
        </button>
      </div>
    </div>
  );
}

function GenerationReadiness({ script, selectedAvatar, selectedVoice, systemConfig, scriptLimit, setActiveView, setToast }) {
  const videoRetalk = isVideoRetalkMode(systemConfig);
  const heygen = isHeyGenMode(systemConfig);
  const heygenImage = isHeyGenImageAvatar(systemConfig, selectedAvatar);
  const scriptReady = Boolean(script.trim()) && script.length <= scriptLimit;
  const avatarReady = Boolean(selectedAvatar) && (!videoRetalk || Boolean(selectedAvatar.sourceVideo));
  const voiceReady = Boolean(selectedVoice) && selectedVoice.status === 'ready';
  const steps = [
    {
      label: '文案',
      ok: scriptReady,
      value: script.trim() ? `${script.trim().length}/${scriptLimit} 字` : '待输入',
      action: () => setToast('请在左侧输入口播文案'),
    },
    {
      label: videoRetalk ? '数字人基础视频' : '数字人',
      ok: avatarReady,
      value: selectedAvatar ? (videoRetalk && !selectedAvatar.sourceVideo ? `${selectedAvatar.name} 缺基础视频` : selectedAvatar.name) : '待选择',
      action: () => setActiveView('avatars'),
    },
    {
      label: '声音',
      ok: voiceReady,
      value: selectedVoice ? (selectedVoice.status === 'ready' ? selectedVoice.name : '克隆中') : '待选择',
      action: () => setActiveView('voices'),
    },
  ];

  return (
    <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-3">
      <div className="mb-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <div className="text-sm font-black text-slate-900">生成准备</div>
          <div className="mt-0.5 text-xs text-slate-500">
            当前引擎：{providerDisplayName(systemConfig)}。{videoRetalk ? 'VideoRetalk 模式需要基础视频，生成后会自动进入任务中心。' : heygenImage ? '当前数字人没有 HeyGen ID，将使用上传图片做 HeyGen 图片驱动。' : '素材准备完成后即可创建生成任务。'}
          </div>
        </div>
        <button className="self-start rounded-lg bg-white px-3 py-1.5 text-xs font-black text-blue-700 shadow-sm sm:self-auto" type="button" onClick={() => setActiveView(videoRetalk && !selectedAvatar?.sourceVideo ? 'avatars' : 'tasks')}>
          {videoRetalk && !selectedAvatar?.sourceVideo ? '去补基础视频' : heygen ? '查看 HeyGen 任务' : '查看任务'}
        </button>
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        {steps.map((step) => {
          const Icon = step.ok ? CheckCircle2 : AlertCircle;
          return (
            <button
              key={step.label}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${
                step.ok ? 'border-emerald-100 bg-white text-emerald-700' : 'border-amber-100 bg-white text-amber-700 hover:border-amber-200'
              }`}
              type="button"
              onClick={step.ok ? undefined : step.action}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="min-w-0">
                <span className="block text-xs font-black">{step.label}</span>
                <span className="block truncate text-xs text-slate-500">{step.value}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PreviewPanel({ selectedAvatar, selectedVoice, script, subtitleStyle, backgroundConfig }) {
  const subtitle = script.slice(0, 26) || '输入文案后生成字幕预览';
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-black text-slate-900">视频预览</h3>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">1080×1920</span>
      </div>
      <div className="mx-auto w-full max-w-[285px]">
        <div className="relative aspect-[9/16] overflow-hidden rounded-[28px] border-[8px] border-slate-950 bg-slate-900 shadow-2xl">
          {selectedAvatar?.previewImage ? (
            <img className="h-full w-full object-cover opacity-95" src={selectedAvatar.previewImage} alt={`${selectedAvatar.name} 预览`} />
          ) : (
            <div className="grid h-full place-items-center text-sm font-bold text-white/70">请选择数字人</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/55" />
          <div className="absolute left-3 top-3 rounded-full bg-black/35 px-2.5 py-1 text-xs font-bold text-white backdrop-blur">{backgroundConfig}</div>
          <div className="absolute bottom-20 left-4 right-4 text-center">
            <p className="rounded-lg bg-black/45 px-2 py-1 text-lg font-black leading-tight text-white shadow-lg">{subtitle}</p>
            <p className="mt-1 inline-block rounded bg-yellow-300 px-1.5 py-0.5 text-base font-black text-slate-950">{subtitleStyle}</p>
          </div>
          <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3 text-white">
            <button className="grid h-8 w-8 place-items-center rounded-full bg-white/18 backdrop-blur" type="button" aria-label="播放预览" onClick={() => window.dispatchEvent(new CustomEvent('app-toast', { detail: '当前为静态预览，生成后可播放真实视频' }))}>
              <Play className="h-4 w-4 fill-white" />
            </button>
            <div className="h-1 flex-1 rounded-full bg-white/25">
              <div className="h-full w-2/5 rounded-full bg-white" />
            </div>
            <span className="text-xs font-semibold">00:05 / 00:15</span>
          </div>
        </div>
      </div>
      <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
        当前声音：<span className="font-bold text-slate-800">{selectedVoice?.name || '未选择'}</span>
      </div>
    </div>
  );
}

function SettingsPanel({
  avatars,
  voices,
  selectedAvatarId,
  setSelectedAvatarId,
  selectedVoiceId,
  setSelectedVoiceId,
  selectedAvatar,
  selectedVoice,
  subtitleStyle,
  setSubtitleStyle,
  backgroundConfig,
  setBackgroundConfig,
  backgroundImageUrl,
  setBackgroundImageUrl,
  introOutroConfig,
  setIntroOutroConfig,
  handleGenerate,
  busy,
  setActiveView,
  setToast,
  costEstimate,
  systemConfig,
}) {
  const videoRetalk = isVideoRetalkMode(systemConfig);
  const heygen = isHeyGenMode(systemConfig);
  const heygenImage = isHeyGenImageAvatar(systemConfig, selectedAvatar);
  const backgroundInputRef = useRef(null);

  async function uploadBackground(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('background', file);
    try {
      const result = await apiFetch('/api/uploads/background', { method: 'POST', body: form });
      setBackgroundImageUrl(result.url);
      setBackgroundConfig('自定义背景');
      setToast('自定义背景已上传，生成时会传给 HeyGen');
    } catch (error) {
      setToast(error.message);
    } finally {
      event.target.value = '';
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-black text-slate-900">数字人设置</h3>
          <button className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700" type="button" onClick={() => setActiveView('avatars')}>
            管理形象
          </button>
        </div>
        <select className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 outline-none" value={selectedAvatarId} onChange={(event) => setSelectedAvatarId(event.target.value)}>
          <option value="">请选择数字人</option>
          {avatars.map((avatar) => (
            <option key={avatar.id} value={avatar.id}>
              {avatar.name} · {avatar.gender} · {avatar.style}{videoRetalk && !avatar.sourceVideo ? ' · 缺基础视频' : ''}{isHeyGenMode(systemConfig) && avatar.providerAvatarId ? ' · HeyGen ID' : ''}
            </option>
          ))}
        </select>
        {selectedAvatar ? (
          <div className="mt-3 flex items-center gap-3">
            <img className="h-14 w-14 rounded-2xl object-cover" src={selectedAvatar.previewImage} alt={selectedAvatar.name} />
            <div className="min-w-0">
              <div className="font-black text-slate-900">{selectedAvatar.name}</div>
              <div className="text-xs text-slate-500">
                {selectedAvatar.gender} | {selectedAvatar.style} | {selectedAvatar.status}
              </div>
              {selectedAvatar.sourceVideo ? <div className="mt-0.5 text-xs font-bold text-blue-600">VideoRetalk 基础视频已就绪</div> : null}
              {selectedAvatar.providerAvatarId ? <div className="mt-0.5 text-xs font-bold text-violet-600">HeyGen Avatar ID 已配置，会使用官方数字人</div> : null}
              {heygenImage ? <div className="mt-0.5 text-xs font-bold text-emerald-600">HeyGen 图片驱动，会让这张形象图动起来</div> : null}
            </div>
          </div>
        ) : null}
        {videoRetalk && selectedAvatar && !selectedAvatar.sourceVideo ? (
          <button className="mt-3 w-full rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-left text-xs font-bold text-amber-700" type="button" onClick={() => setActiveView('avatars')}>
            当前数字人缺少基础视频，上传后才能使用 VideoRetalk 生成。
          </button>
        ) : null}
        {heygenImage ? (
          <button className="mt-3 w-full rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-left text-xs font-bold text-emerald-700" type="button" onClick={() => setActiveView('avatars')}>
            当前选择的是本地图片数字人。生成时会调用 HeyGen image-to-video；如需更稳定效果，可在编辑里填 HeyGen Avatar ID。
          </button>
        ) : null}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {avatars.slice(0, 3).map((avatar) => (
            <button
              key={avatar.id}
              type="button"
              onClick={() => setSelectedAvatarId(avatar.id)}
              className={`overflow-hidden rounded-xl border ${selectedAvatarId === avatar.id ? 'border-blue-500 ring-4 ring-blue-100' : 'border-slate-200'}`}
            >
              <img className="h-16 w-full object-cover" src={avatar.previewImage} alt={avatar.name} />
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-black text-slate-900">声音设置</h3>
          <button className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600" type="button" onClick={() => setActiveView('voices')}>
            声音库
          </button>
        </div>
        <select
          className="mb-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 outline-none"
          value={selectedVoiceId}
          onChange={(event) => setSelectedVoiceId(event.target.value)}
        >
          <option value="">请选择声音</option>
          {voices.map((voice) => (
            <option key={voice.id} value={voice.id} disabled={voice.status !== 'ready'}>
              {voice.name} · {voice.language} · {voice.status === 'ready' ? '可用' : '克隆中'}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-3 rounded-xl bg-blue-50 p-3">
          <button className="grid h-8 w-8 place-items-center rounded-full bg-blue-600 text-white" type="button" onClick={() => setToast(selectedVoice ? `试听：${selectedVoice.name}` : '请先选择声音')}>
            <Play className="h-4 w-4 fill-white" />
          </button>
          <Waveform seed={selectedVoice?.name?.length || 4} />
        </div>
        {selectedVoice?.sampleUrl ? <audio className="mt-3 w-full" src={selectedVoice.sampleUrl} controls /> : null}
        {selectedVoice?.providerVoiceId ? <div className="mt-2 text-xs font-bold text-blue-600">{isHeyGenMode(systemConfig) ? 'HeyGen Voice ID 已配置' : '克隆音色已启用'}</div> : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 font-black text-slate-900">视频设置</h3>
        <SelectInput
          label={heygen ? '字幕样式（HeyGen 暂未接入）' : '字幕样式'}
          value={subtitleStyle}
          options={subtitleOptions}
          onChange={setSubtitleStyle}
          disabled={heygen}
          helper={heygen ? '当前不会传入字幕样式；后续需要用 FFmpeg 后处理统一烧录字幕。' : ''}
        />
        <SelectInput label="背景设置" value={backgroundConfig} options={backgroundOptions} onChange={(value) => {
          setBackgroundConfig(value);
          if (value !== '自定义背景') setBackgroundImageUrl('');
        }} />
        {heygen ? (
          <div className="mb-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-3">
            <input ref={backgroundInputRef} className="hidden" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={uploadBackground} />
            <div className="flex items-center gap-3">
              {backgroundImageUrl ? (
                <img className="h-16 w-11 rounded-xl object-cover" src={backgroundImageUrl} alt="自定义背景" />
              ) : (
                <div className="grid h-16 w-11 place-items-center rounded-xl bg-white text-slate-400">
                  <Upload className="h-4 w-4" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-xs font-black text-slate-700">自定义背景图</div>
                <div className="mt-1 truncate text-xs text-slate-400">{backgroundImageUrl || '可上传 jpg/png/webp，建议 1080x1920 竖图。'}</div>
              </div>
              <button className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700" type="button" onClick={() => backgroundInputRef.current?.click()}>
                上传
              </button>
              {backgroundImageUrl ? (
                <button className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-500" type="button" onClick={() => {
                  setBackgroundImageUrl('');
                  setBackgroundConfig('简约直播间');
                }}>
                  移除
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        {heygen ? (
          <div className="mb-3 rounded-xl bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-800">
            选择「保留原图背景」时不会抠图换背景；其他背景会传给 HeyGen，并尝试抠除原背景。上传自定义背景后会优先使用你的背景图。
          </div>
        ) : null}
        <SelectInput
          label={heygen ? '片头片尾（HeyGen 暂未接入）' : '片头片尾'}
          value={introOutroConfig}
          options={introOutroOptions}
          onChange={setIntroOutroConfig}
          disabled={heygen}
          helper={heygen ? '当前 HeyGen 直接输出口播正片，不会合成片头片尾；后续需要加本地 FFmpeg 合成。' : ''}
        />
        <CostEstimateCard estimate={costEstimate} />
        <button
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          onClick={handleGenerate}
          disabled={busy === 'generate'}
        >
          {busy === 'generate' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
          生成视频
        </button>
        <p className="mt-2 text-center text-xs text-slate-400">创建任务后进入任务中心，完成后自动生成作品</p>
      </div>
    </div>
  );
}

function CostEstimateCard({ estimate }) {
  if (!estimate) return null;
  if (!estimate.enabled) {
    return (
      <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
        当前为 {estimate.provider} 模式，不会调用付费生成接口。
      </div>
    );
  }

  const hasScript = estimate.seconds > 0;
  const costBreakdown = estimate.provider === 'heygen'
    ? `约 ${estimate.seconds}s · ${estimate.videoModel} ${estimate.videoResolution} 渲染 ${formatMoney(estimate.videoCost)}`
    : `约 ${estimate.seconds}s · ${estimate.videoModel} ${estimate.videoResolution} 视频 ${formatMoney(estimate.videoCost)} + TTS ${formatMoney(estimate.ttsCost)} + 图片检测 ${formatMoney(estimate.detectCost)}`;
  return (
    <div className="mt-3 rounded-2xl border border-amber-100 bg-amber-50/80 p-3">
      <div className="flex items-start gap-2">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white text-amber-600 shadow-sm">
          <Calculator className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-black text-amber-900">生成费用预估</span>
            <span className="text-sm font-black text-amber-900">{hasScript ? formatMoney(estimate.total) : '待输入'}</span>
          </div>
          {hasScript ? (
            <div className="mt-1 text-[11px] leading-5 text-amber-800/80">
              {costBreakdown}
            </div>
          ) : (
            <div className="mt-1 text-[11px] leading-5 text-amber-800/80">输入文案后按预计视频时长自动估算。</div>
          )}
          <div className="mt-1 text-[11px] leading-5 text-amber-700/80">{estimate.note}</div>
        </div>
      </div>
    </div>
  );
}

function GenerationConfirmModal({ estimate, script, avatar, voice, systemConfig, backgroundConfig, busy, onConfirm, onClose }) {
  const hasChineseScript = /[\u3400-\u9fff]/.test(script);
  const likelyEnglishVoice = /english|en[-_]?/i.test(voice?.language || '');
  const avatarSource = avatar?.providerAvatarId ? '库内 HeyGen Avatar ID' : '上传图片驱动';
  const voiceSource = voice?.providerVoiceId ? '库内 HeyGen Voice ID' : '环境变量默认 Voice ID';

  return (
    <Modal title="确认提交 HeyGen 生成" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-amber-600 shadow-sm">
              <Calculator className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-black text-amber-950">预计费用 {formatMoney(estimate.total)}</div>
              <div className="mt-1 text-xs leading-5 text-amber-800">
                约 {estimate.seconds}s · {estimate.videoModel} · {estimate.videoResolution}。提交后会调用 HeyGen 官方 API，可能产生真实扣费。
              </div>
              <div className="mt-1 text-xs leading-5 text-amber-700">{estimate.note}</div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <InfoTile label="数字人" value={avatar?.name || '未选择'} helper={avatarSource} />
          <InfoTile label="声音" value={voice?.name || '未选择'} helper={voiceSource} />
          <InfoTile label="分辨率" value={systemConfig.heygen?.resolution || '1080p'} helper={`画幅 ${systemConfig.heygen?.aspectRatio || '9:16'}`} />
          <InfoTile label="文案长度" value={`${Array.from(script).length} 字`} helper={`预计 ${estimate.seconds}s`} />
          <InfoTile
            label="背景"
            value={backgroundConfig || '简约直播间'}
            helper={backgroundConfig === '保留原图背景' ? '不抠图换背景' : backgroundConfig === '简约直播间' ? '使用内置场景背景' : '会传给 HeyGen 背景设置'}
          />
        </div>

        {hasChineseScript && likelyEnglishVoice ? (
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-800">
            当前文案是中文，但所选 HeyGen 声音看起来是英文音色。建议同步并选择中文 Voice ID，口播自然度会更好。
          </div>
        ) : null}

        <div className="rounded-2xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
          HeyGen 的真实流程是：选择 Avatar 和 Voice，提交脚本文案，等待云端渲染，完成后下载视频。本系统会把结果保存到本地作品管理。
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-600" type="button" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white disabled:opacity-60" type="button" onClick={onConfirm} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            确认生成
          </button>
        </div>
      </div>
    </Modal>
  );
}

function InfoTile({ label, value, helper }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="text-xs font-bold text-slate-400">{label}</div>
      <div className="mt-1 truncate text-sm font-black text-slate-900">{value}</div>
      <div className="mt-1 truncate text-xs text-slate-500">{helper}</div>
    </div>
  );
}

function FileDropzone({ label, accept, helper, file, onFile, onInvalid, previewUrl, mediaType = 'file' }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  function chooseFile(nextFile) {
    if (!nextFile) return;
    if (!fileMatchesAccept(nextFile, accept)) {
      onInvalid?.();
      return;
    }
    onFile(nextFile);
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    chooseFile(event.dataTransfer.files?.[0]);
  }

  return (
    <div>
      <div className="mb-1 block text-xs font-bold text-slate-500">{label}</div>
      <button
        className={`group w-full rounded-2xl border border-dashed px-4 py-4 text-left transition ${
          dragging ? 'border-blue-500 bg-blue-50 ring-4 ring-blue-100' : 'border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/60'
        }`}
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragging(false);
        }}
        onDrop={handleDrop}
      >
        <input ref={inputRef} className="hidden" type="file" accept={accept} onChange={(event) => chooseFile(event.target.files?.[0])} />
        <div className="flex items-center gap-3">
          {mediaType === 'image' && previewUrl ? (
            <img className="h-16 w-16 rounded-2xl object-cover" src={previewUrl} alt="上传预览" />
          ) : (
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-blue-600 shadow-sm">
              <Upload className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0">
            <div className="text-sm font-black text-slate-800">{file ? file.name : '拖拽文件到这里，或点击选择文件'}</div>
            <div className="mt-1 text-xs leading-5 text-slate-500">
              {file ? `${formatBytes(file.size)} · 已选择` : helper}
            </div>
          </div>
        </div>
      </button>
      {mediaType === 'audio' && previewUrl ? <audio className="mt-2 w-full" src={previewUrl} controls /> : null}
    </div>
  );
}

function LibraryPage({ initialTab, avatars, voices, refreshAll, selectedAvatarId, setSelectedAvatarId, selectedVoiceId, setSelectedVoiceId, setToast, systemConfig }) {
  const [tab, setTab] = useState(initialTab);
  const [query, setQuery] = useState('');
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const filteredAvatars = avatars.filter((avatar) => [avatar.name, avatar.gender, avatar.style].join(' ').includes(query));
  const filteredVoices = voices.filter((voice) => [voice.name, voice.gender, voice.language, voice.style].join(' ').includes(query));

  async function syncHeyGenResources() {
    setSyncing(true);
    try {
      const result = await apiFetch('/api/heygen/sync', { method: 'POST' });
      setToast(`已同步 HeyGen 资源：${result.avatarsImported} 个数字人，${result.voicesImported} 个声音`);
      refreshAll({ silent: true });
    } catch (error) {
      setToast(error.message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-panel">
      <div className="mb-4 flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
        <div>
          <h2 className="text-xl font-black text-slate-950">数字人形象与声音库</h2>
          <p className="mt-1 text-sm text-slate-500">数据来自 SQLite API，支持新增、编辑、删除、默认选择和上传。</p>
        </div>
        {isHeyGenMode(systemConfig) ? (
          <button className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-black text-blue-700 disabled:opacity-60" type="button" onClick={syncHeyGenResources} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            同步 HeyGen 资源
          </button>
        ) : null}
      </div>

      <div className="mb-4 flex border-b border-slate-200">
        <TabButton active={tab === 'avatars'} onClick={() => setTab('avatars')}>数字人形象</TabButton>
        <TabButton active={tab === 'voices'} onClick={() => setTab('voices')}>声音库</TabButton>
      </div>

      <div className="mb-4 flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
        <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap">
          <FilterButton label="状态" value="全部" onClick={() => setToast('当前显示全部状态')} />
          <FilterButton label="来源" value="数据库" onClick={() => setToast('当前列表来自后端 API')} />
        </div>
        <div className="relative min-w-0 xl:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索数字人或声音" />
        </div>
      </div>

      {tab === 'voices' ? (
        <VoiceLibrary voices={filteredVoices} refreshAll={refreshAll} selectedVoiceId={selectedVoiceId} setSelectedVoiceId={setSelectedVoiceId} setToast={setToast} systemConfig={systemConfig} />
      ) : (
        <AvatarLibrary avatars={filteredAvatars} refreshAll={refreshAll} selectedAvatarId={selectedAvatarId} setSelectedAvatarId={setSelectedAvatarId} setToast={setToast} />
      )}
    </section>
  );
}

function AvatarLibrary({ avatars, refreshAll, selectedAvatarId, setSelectedAvatarId, setToast }) {
  const [modal, setModal] = useState(null);
  const [preview, setPreview] = useState(null);

  async function deleteAvatar(avatar) {
    if (!window.confirm(`确认删除数字人「${avatar.name}」？已被任务引用的形象会被归档。`)) return;
    try {
      await apiFetch(`/api/avatars/${avatar.id}`, { method: 'DELETE' });
      setToast('数字人已删除');
      refreshAll({ silent: true });
    } catch (error) {
      setToast(error.message);
    }
  }

  async function setDefault(avatar) {
    try {
      const updated = await apiFetch(`/api/avatars/${avatar.id}/default`, { method: 'POST' });
      setSelectedAvatarId(updated.id);
      setToast(`已设置默认数字人：${updated.name}`);
      refreshAll({ silent: true });
    } catch (error) {
      setToast(error.message);
    }
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-soft" type="button" onClick={() => setModal({ mode: 'create' })}>
          <Plus className="h-4 w-4" />
          创建数字人
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {avatars.map((avatar) => (
          <article key={avatar.id} className={`overflow-hidden rounded-2xl border bg-white text-left transition hover:-translate-y-0.5 hover:shadow-soft ${selectedAvatarId === avatar.id ? 'border-blue-500 ring-4 ring-blue-100' : 'border-slate-200'}`}>
            <button className="relative h-52 w-full bg-slate-100" type="button" onClick={() => setSelectedAvatarId(avatar.id)}>
              <img className="h-full w-full object-cover" src={avatar.previewImage} alt={avatar.name} />
              {avatar.isDefault ? <span className="absolute right-3 top-3 rounded-full bg-blue-600 px-2 py-1 text-xs font-black text-white">默认</span> : null}
            </button>
            <div className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-black text-slate-950">{avatar.name}</div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">{avatar.status}</span>
              </div>
              <div className="mt-1 text-xs text-slate-500">{avatar.gender} | {avatar.style}</div>
              {avatar.sourceVideo ? <div className="mt-1 text-xs font-bold text-blue-600">已上传基础视频</div> : null}
              {avatar.providerAvatarId ? <div className="mt-1 truncate text-xs font-bold text-violet-600">HeyGen Avatar ID：{avatar.providerAvatarId}</div> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <IconButton icon={Eye} label="预览" onClick={() => setPreview(avatar)} />
                <IconButton icon={Edit3} label="编辑" onClick={() => setModal({ mode: 'edit', avatar })} />
                <IconButton icon={CheckCircle2} label="设为默认" onClick={() => setDefault(avatar)} />
                <IconButton icon={Trash2} label="删除" danger onClick={() => deleteAvatar(avatar)} />
              </div>
            </div>
          </article>
        ))}
      </div>
      {modal ? <AvatarModal modal={modal} onClose={() => setModal(null)} refreshAll={refreshAll} setToast={setToast} setSelectedAvatarId={setSelectedAvatarId} /> : null}
      {preview ? <PreviewImageModal title={preview.name} image={preview.previewImage} onClose={() => setPreview(null)} /> : null}
    </>
  );
}

function AvatarModal({ modal, onClose, refreshAll, setToast, setSelectedAvatarId }) {
  const avatar = modal.avatar;
  const [name, setName] = useState(avatar?.name || '');
  const [gender, setGender] = useState(avatar?.gender || '女性');
  const [style, setStyle] = useState(avatar?.style || '电商口播');
  const [providerAvatarId, setProviderAvatarId] = useState(avatar?.providerAvatarId || '');
  const [isDefault, setIsDefault] = useState(Boolean(avatar?.isDefault));
  const [file, setFile] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [filePreview, setFilePreview] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!file) {
      setFilePreview('');
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function submit(event) {
    event.preventDefault();
    if (!name.trim() || !style.trim()) {
      setToast('请填写名称和风格');
      return;
    }
    if (!avatar && !file) {
      setToast('请上传数字人形象图');
      return;
    }
    const form = new FormData();
    form.append('name', name);
    form.append('gender', gender);
    form.append('style', style);
    form.append('provider', providerAvatarId.trim() ? 'heygen' : (avatar?.provider || 'mock'));
    form.append('providerAvatarId', providerAvatarId.trim());
    form.append('isDefault', String(isDefault));
    if (file) form.append('image', file);
    if (videoFile) form.append('sourceVideo', videoFile);
    setBusy(true);
    try {
      const saved = await apiFetch(avatar ? `/api/avatars/${avatar.id}` : '/api/avatars', {
        method: avatar ? 'PUT' : 'POST',
        body: form,
      });
      setSelectedAvatarId(saved.id);
      setToast(avatar ? '数字人已更新' : '数字人已创建');
      onClose();
      refreshAll({ silent: true });
    } catch (error) {
      setToast(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={avatar ? '编辑数字人' : '新增数字人'} onClose={onClose}>
      <form className="space-y-3" onSubmit={submit}>
        <TextField label="名称" value={name} onChange={setName} />
        <SelectInput label="性别" value={gender} options={['女性', '男性', '中性']} onChange={setGender} />
        <TextField label="风格" value={style} onChange={setStyle} placeholder="电商口播 / 企业宣传 / 课程讲解" />
        <TextField label="HeyGen Avatar ID（可选）" value={providerAvatarId} onChange={setProviderAvatarId} placeholder="例如 avatar_xxx；留空则使用 .env 默认值" />
        <FileDropzone
          label="形象图"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          helper="支持 jpg / png / webp，建议正脸清晰、无遮挡、光线均匀。"
          file={file}
          onFile={setFile}
          onInvalid={() => setToast('数字人图片只支持 jpg/png/webp')}
          previewUrl={filePreview || avatar?.previewImage}
          mediaType="image"
        />
        <FileDropzone
          label="基础视频（VideoRetalk 使用）"
          accept="video/mp4,video/webm,.mp4,.webm"
          helper={avatar?.sourceVideo ? '已上传基础视频；重新拖入可替换。建议 10-30 秒、正脸、光线清楚。' : '可选但推荐上传。VideoRetalk 必须使用基础视频，支持 mp4/webm。'}
          file={videoFile}
          onFile={setVideoFile}
          onInvalid={() => setToast('基础视频只支持 mp4/webm')}
          mediaType="video"
        />
        <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600">
          <input type="checkbox" checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} />
          设为默认数字人
        </label>
        <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-black text-white disabled:opacity-60" type="submit" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          保存
        </button>
      </form>
    </Modal>
  );
}

function VoiceLibrary({ voices, refreshAll, selectedVoiceId, setSelectedVoiceId, setToast, systemConfig }) {
  const [modal, setModal] = useState(null);

  async function deleteVoice(voice) {
    if (!window.confirm(`确认删除声音「${voice.name}」？已被任务引用的声音会被归档。`)) return;
    try {
      await apiFetch(`/api/voices/${voice.id}`, { method: 'DELETE' });
      setToast('声音已删除');
      refreshAll({ silent: true });
    } catch (error) {
      setToast(error.message);
    }
  }

  async function setDefault(voice) {
    try {
      const updated = await apiFetch(`/api/voices/${voice.id}/default`, { method: 'POST' });
      setSelectedVoiceId(updated.id);
      setToast(`已设置默认声音：${updated.name}`);
      refreshAll({ silent: true });
    } catch (error) {
      setToast(error.message);
    }
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-soft" type="button" onClick={() => setModal({ mode: 'create' })}>
          <Upload className="h-4 w-4" />
          上传/克隆声音
        </button>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">声音名称</th>
              <th className="px-4 py-3">语言</th>
              <th className="px-4 py-3">风格</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3">试听</th>
              <th className="px-4 py-3">创建时间</th>
              <th className="px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {voices.map((voice) => (
              <tr key={voice.id} className={selectedVoiceId === voice.id ? 'bg-blue-50/60' : 'bg-white'}>
                <td className="px-4 py-3">
                  <div className="font-black text-slate-800">{voice.name}</div>
                  <div className="text-xs text-slate-400">
                    {voice.gender} {voice.isDefault ? '· 默认' : ''} {voice.providerVoiceId ? `· 音色ID ${voice.providerVoiceId}` : ''}
                  </div>
                  {voice.status === 'pending' && voice.providerStatus ? <div className="mt-1 text-xs font-semibold text-amber-600">Provider 状态：{voice.providerStatus}</div> : null}
                  {voice.providerError ? <div className="mt-1 max-w-xs truncate text-xs font-semibold text-rose-500" title={voice.providerError}>{voice.providerError}</div> : null}
                </td>
                <td className="px-4 py-3 text-slate-500">{voice.language}</td>
                <td className="px-4 py-3 text-slate-500">{voice.style}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-black ${(voiceStatusMap[voice.status] || voiceStatusMap.pending).className}`}>
                    {(voiceStatusMap[voice.status] || voiceStatusMap.pending).label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {voice.sampleUrl ? <audio className="w-44" src={voice.sampleUrl} controls /> : <span className="text-xs text-slate-400">使用 Provider Voice ID</span>}
                </td>
                <td className="px-4 py-3 text-slate-500">{formatDate(voice.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-black text-white disabled:bg-slate-300" type="button" disabled={voice.status !== 'ready'} onClick={() => setSelectedVoiceId(voice.id)}>
                      使用
                    </button>
                    <button className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600 disabled:bg-slate-50 disabled:text-slate-300" type="button" disabled={voice.status !== 'ready'} onClick={() => setDefault(voice)}>
                      默认
                    </button>
                    <button className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600" type="button" onClick={() => setModal({ mode: 'edit', voice })}>
                      编辑
                    </button>
                    <button className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-600" type="button" onClick={() => deleteVoice(voice)}>
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal ? <VoiceModal modal={modal} onClose={() => setModal(null)} refreshAll={refreshAll} setToast={setToast} setSelectedVoiceId={setSelectedVoiceId} systemConfig={systemConfig} /> : null}
    </>
  );
}

function VoiceModal({ modal, onClose, refreshAll, setToast, setSelectedVoiceId, systemConfig }) {
  const voice = modal.voice;
  const heygen = isHeyGenMode(systemConfig);
  const [name, setName] = useState(voice?.name || '');
  const [gender, setGender] = useState(voice?.gender || '女性');
  const [language, setLanguage] = useState(voice?.language || '普通话');
  const [style, setStyle] = useState(voice?.style || '活力亲切');
  const [providerVoiceId, setProviderVoiceId] = useState(voice?.providerVoiceId || '');
  const [clone, setClone] = useState(voice ? voice.status === 'pending' : true);
  const [isDefault, setIsDefault] = useState(Boolean(voice?.isDefault));
  const [file, setFile] = useState(null);
  const [audioPreview, setAudioPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const cloneHelper = heygen
    ? '勾选后会调用 HeyGen Voice Clone。建议上传 30-120 秒干净人声，完成后系统会自动保存 HeyGen Voice ID，后续生成就使用你的声音。'
    : '勾选后会调用当前 provider 的音色复刻接口，成功后保存音色 ID；后续选择这个声音生成视频时，会优先使用你的克隆音色。';
  const resolvedProvider = resolveVoiceProvider({ voice, systemConfig, providerVoiceId, clone });
  const providerName = providerIdDisplayName(resolvedProvider);
  const providerIdLabel = resolvedProvider === 'heygen'
    ? 'HeyGen Voice ID（可选）'
    : `${providerName}音色 ID（可选）`;
  const providerIdPlaceholder = resolvedProvider === 'heygen'
    ? '例如 voice_xxx；已有 HeyGen 音色才填写'
    : '已有音色 ID 可填写；留空并上传样本则提交克隆';
  const providerIdSavedMessage = resolvedProvider === 'heygen'
    ? 'HeyGen Voice ID 已保存'
    : `${providerName}音色 ID 已保存`;

  useEffect(() => {
    if (!file) {
      setAudioPreview('');
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setAudioPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function submit(event) {
    event.preventDefault();
    if (!name.trim() || !style.trim()) {
      setToast('请填写声音名称和风格');
      return;
    }
    if (!file && !voice && !providerVoiceId.trim()) {
      setToast(`请上传 wav/mp3/m4a 声音样本，或填写${providerName}音色 ID`);
      return;
    }
    const form = new FormData();
    form.append('name', name);
    form.append('gender', gender);
    form.append('language', language);
    form.append('style', style);
    form.append('provider', resolvedProvider);
    form.append('providerVoiceId', providerVoiceId.trim());
    form.append('clone', String(clone && !providerVoiceId.trim()));
    form.append('isDefault', String(isDefault));
    if (file) form.append('sample', file);
    setBusy(true);
    try {
      const savedVoice = await apiFetch(voice ? `/api/voices/${voice.id}` : '/api/voices', { method: voice ? 'PUT' : 'POST', body: form });
      if (savedVoice.status === 'ready') setSelectedVoiceId(savedVoice.id);
      const message = providerVoiceId.trim()
        ? providerIdSavedMessage
        : clone && savedVoice.status === 'pending'
          ? (heygen ? 'HeyGen 声音克隆已提交，完成后会自动变为可用' : '声音样本已上传，当前进入克隆队列')
          : clone
            ? '声音克隆已完成'
            : '声音样本已上传';
      setToast(message);
      onClose();
      refreshAll({ silent: true });
    } catch (error) {
      setToast(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={voice ? '编辑声音' : '上传/克隆声音'} onClose={onClose}>
      <form className="space-y-3" onSubmit={submit}>
        <TextField label="声音名称" value={name} onChange={setName} />
        <SelectInput label="性别" value={gender} options={['女性', '男性', '中性']} onChange={setGender} />
        <TextField label="语言" value={language} onChange={setLanguage} />
        <TextField label="风格" value={style} onChange={setStyle} />
        <TextField label={providerIdLabel} value={providerVoiceId} onChange={setProviderVoiceId} placeholder={providerIdPlaceholder} />
        <FileDropzone
          label="声音样本 wav/mp3/m4a"
          accept="audio/mp3,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,.mp3,.wav,.m4a"
          helper={voice ? '可选。重新拖入可替换声音样本。' : `支持拖拽上传。若只使用${providerName}音色 ID，可以不上传样本；要克隆自己的声音必须上传样本。`}
          file={file}
          onFile={setFile}
          onInvalid={() => setToast('声音样本只支持 wav/mp3/m4a')}
          previewUrl={audioPreview}
          mediaType="audio"
        />
        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-800">
          {providerVoiceId.trim() ? `已填写${providerName}音色 ID，系统会直接使用这个音色，不再提交克隆任务。` : cloneHelper}
        </div>
        <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600">
          <input type="checkbox" checked={clone} onChange={(event) => setClone(event.target.checked)} disabled={Boolean(providerVoiceId.trim())} />
          进入声音克隆流程
        </label>
        <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600">
          <input type="checkbox" checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} />
          设为默认声音
        </label>
        <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-black text-white disabled:opacity-60" type="submit" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {busy && clone && !providerVoiceId.trim() ? '提交克隆中' : '保存声音'}
        </button>
      </form>
    </Modal>
  );
}

function TaskCenterPage({ jobs, refreshAll, setToast, systemConfig }) {
  const [detail, setDetail] = useState(null);
  const flowStages = isHeyGenMode(systemConfig)
    ? [
        ['提交 HeyGen', 20, Video],
        ['云端渲染', 50, Clock3],
        ['下载视频', 80, Download],
        ['完成入库', 100, CheckCircle2],
      ]
    : [
        ['TTS 生成', 20, Mic2],
        ['数字人驱动', 45, UserRound],
        ['字幕生成', 70, FileText],
        ['视频合成', 90, Video],
        ['完成入库', 100, CheckCircle2],
      ];
  const stats = [
    { label: '全部任务', value: jobs.length, icon: FileText, tone: 'blue', hint: '数据库记录' },
    { label: '进行中', value: jobs.filter((job) => ['pending', 'running'].includes(job.status)).length, icon: Clock3, tone: 'cyan', hint: '轮询刷新' },
    { label: '已完成', value: jobs.filter((job) => job.status === 'success').length, icon: CheckCircle2, tone: 'green', hint: '自动成片' },
    { label: '失败任务', value: jobs.filter((job) => job.status === 'failed').length, icon: XCircle, tone: 'rose', hint: '支持重试' },
    { label: '已取消', value: jobs.filter((job) => job.status === 'cancelled').length, icon: Gauge, tone: 'violet', hint: '可重试' },
  ];

  async function cancelJob(job) {
    try {
      await apiFetch(`/api/jobs/${job.id}/cancel`, { method: 'POST' });
      setToast('任务已取消');
      refreshAll({ silent: true });
    } catch (error) {
      setToast(error.message);
    }
  }

  async function retryJob(job) {
    try {
      await apiFetch(`/api/jobs/${job.id}/retry`, { method: 'POST' });
      setToast('任务已重新进入队列');
      refreshAll({ silent: true });
    } catch (error) {
      setToast(error.message);
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-panel">
        <div className="mb-4">
          <h2 className="text-xl font-black text-slate-950">任务中心</h2>
          <p className="mt-1 text-sm text-slate-500">任务来自 generation_jobs 表，状态由当前 provider 推进。</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {stats.map((item) => <MetricCard key={item.label} {...item} />)}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-panel">
        <h3 className="mb-4 font-black text-slate-950">任务流程</h3>
        <div className={`grid gap-3 ${isHeyGenMode(systemConfig) ? 'md:grid-cols-4' : 'md:grid-cols-5'}`}>
          {flowStages.map(([label, value, Icon]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600"><Icon className="h-5 w-5" /></div>
                <span className="text-xl font-black text-slate-950">{value}%</span>
              </div>
              <div className="mt-3 text-sm font-black text-slate-700">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-panel">
        <div className="mb-4 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div className="flex gap-2">
            {['全部任务', 'pending', 'running', 'success', 'failed', 'cancelled'].map((item, index) => (
              <button key={item} className={`rounded-xl px-3 py-2 text-sm font-black ${index === 0 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`} type="button" onClick={() => setToast(index === 0 ? '当前显示全部任务' : `筛选状态：${statusMap[item]?.label}`)}>
                {statusMap[item]?.label || item}
              </button>
            ))}
          </div>
          <button className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-black text-slate-600" type="button" onClick={() => refreshAll({ silent: true })}>
            <RefreshCw className="h-4 w-4" />
            刷新任务
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">任务名称</th>
                <th className="px-4 py-3">数字人</th>
                <th className="px-4 py-3">声音</th>
                <th className="px-4 py-3">阶段</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">进度</th>
                <th className="px-4 py-3">创建时间</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs.map((job) => {
                const status = statusMap[job.status] || statusMap.pending;
                return (
                  <tr key={job.id} className="bg-white">
                    <td className="px-4 py-3 font-black text-slate-800">{job.title}</td>
                    <td className="px-4 py-3 text-slate-500">{job.avatar?.name || '-'}</td>
                    <td className="px-4 py-3 text-slate-500">{job.voice?.name || '-'}</td>
                    <td className="px-4 py-3 text-slate-500">{job.stage}</td>
                    <td className={`px-4 py-3 font-black ${status.color}`}>{status.label}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 rounded-full bg-slate-100"><div className={`h-full rounded-full ${status.bar}`} style={{ width: `${job.progress}%` }} /></div>
                        <span className="w-9 text-xs text-slate-400">{job.progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(job.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button className="font-black text-blue-600" type="button" onClick={() => setDetail(job)}>详情</button>
                        {['pending', 'running'].includes(job.status) ? <button className="font-black text-amber-600" type="button" onClick={() => cancelJob(job)}>取消</button> : null}
                        {['failed', 'cancelled'].includes(job.status) ? <button className="font-black text-blue-600" type="button" onClick={() => retryJob(job)}>重试</button> : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {detail ? <JobDetailModal job={detail} onClose={() => setDetail(null)} /> : null}
    </section>
  );
}

function WorksTemplatesPage({ initialTab, projects, templates, avatars, voices, refreshAll, setToast, applyTemplate, reuseProject }) {
  const [tab, setTab] = useState(initialTab);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('全部');
  const [preview, setPreview] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const shownProjects = projects.filter((project) => [project.title, project.avatar?.name, project.voice?.name].join(' ').includes(query));
  const shownTemplates = templates.filter((template) => category === '全部' || template.category === category);

  async function deleteProject(project) {
    if (!window.confirm(`确认删除作品「${project.title}」？`)) return;
    try {
      await apiFetch(`/api/projects/${project.id}`, { method: 'DELETE' });
      setToast('作品已删除');
      refreshAll({ silent: true });
    } catch (error) {
      setToast(error.message);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-panel">
      <div className="mb-4 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div>
          <h2 className="text-xl font-black text-slate-950">作品管理 / 模板中心</h2>
          <p className="mt-1 text-sm text-slate-500">作品和模板均从 API 读取，支持预览、下载、删除、复用配置和上传视频。</p>
        </div>
        <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-soft" type="button" onClick={() => setUploadOpen(true)}>
          <Upload className="h-4 w-4" />
          上传作品
        </button>
      </div>

      <div className="mb-4 flex border-b border-slate-200">
        <TabButton active={tab === 'works'} onClick={() => setTab('works')}>我的作品</TabButton>
        <TabButton active={tab === 'templates'} onClick={() => setTab('templates')}>模板中心</TabButton>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
        <div>
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid grid-cols-2 gap-2 sm:flex">
              {tab === 'templates' ? (
                <select className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600" value={category} onChange={(event) => setCategory(event.target.value)}>
                  {templateCategories.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              ) : (
                <>
                  <FilterButton label="全部状态" value="ready" onClick={() => setToast('当前显示 ready 作品')} />
                  <FilterButton label="全部时间" value="最近" onClick={() => setToast('当前按创建时间倒序展示')} />
                </>
              )}
            </div>
            <div className="flex gap-2">
              <div className="relative min-w-0">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100 lg:w-64" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索作品名称" />
              </div>
              <button className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white" type="button" onClick={() => setToast('当前为网格视图')}>
                <Grid3X3 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {tab === 'templates' ? (
            <TemplateGrid templates={shownTemplates} applyTemplate={applyTemplate} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {shownProjects.map((project) => (
                <WorkCard key={project.id} project={project} onPreview={setPreview} onDelete={deleteProject} onReuse={reuseProject} />
              ))}
              <button className="grid min-h-[300px] place-items-center rounded-2xl border border-dashed border-blue-200 bg-blue-50/40 text-center text-blue-600" type="button" onClick={() => setUploadOpen(true)}>
                <div>
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white shadow-soft"><Upload className="h-6 w-6" /></div>
                  <div className="mt-3 text-sm font-black">导入本地视频</div>
                </div>
              </button>
            </div>
          )}
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="font-black text-slate-950">模板中心</h3>
          <div className="mt-4 space-y-2 text-sm font-semibold text-slate-600">
            {templateCategories.map((item) => (
              <button key={item} className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left ${category === item ? 'bg-white text-blue-700 shadow-sm' : 'hover:bg-white'}`} type="button" onClick={() => { setTab('templates'); setCategory(item); }}>
                <span>{item}</span>
              </button>
            ))}
          </div>
          <div className="mt-5">
            <h4 className="mb-3 text-sm font-black text-slate-950">热门模板</h4>
            {templates.slice(0, 2).map((template) => (
              <button key={template.id} type="button" onClick={() => applyTemplate(template)} className="mb-3 w-full overflow-hidden rounded-2xl bg-white text-left shadow-sm">
                <img className="h-20 w-full object-cover" src={template.coverUrl} alt={template.name} />
                <div className="p-3">
                  <div className="font-black text-slate-900">{template.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{template.category} · 竖屏模板</div>
                  <div className="mt-2 text-xs font-black text-blue-600">使用模板</div>
                </div>
              </button>
            ))}
          </div>
        </aside>
      </div>
      {preview ? <VideoPreviewModal project={preview} onClose={() => setPreview(null)} /> : null}
      {uploadOpen ? <UploadProjectModal avatars={avatars} voices={voices} refreshAll={refreshAll} setToast={setToast} onClose={() => setUploadOpen(false)} /> : null}
    </section>
  );
}

function TemplateGrid({ templates, applyTemplate }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {templates.map((template) => (
        <button key={template.id} type="button" onClick={() => applyTemplate(template)} className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-left transition hover:-translate-y-0.5 hover:shadow-soft">
          <div className="relative h-44 bg-slate-100">
            <img className="h-full w-full object-cover" src={template.coverUrl} alt={template.name} />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/55" />
            <div className="absolute bottom-4 left-4 right-4 text-white">
              <div className="text-sm font-semibold opacity-90">{template.category}</div>
              <div className="mt-1 text-xl font-black">{template.name}</div>
            </div>
          </div>
          <div className="p-4">
            <div className="text-sm text-slate-500">{template.scriptPrompt}</div>
            <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm font-black text-blue-700"><Sparkles className="h-4 w-4" />快速生成</div>
          </div>
        </button>
      ))}
    </div>
  );
}

function WorkCard({ project, onPreview, onDelete, onReuse }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button className="relative aspect-[9/12] w-full bg-slate-100" type="button" onClick={() => onPreview(project)}>
        <img className="h-full w-full object-cover" src={project.coverUrl} alt={project.title} />
        <span className="absolute bottom-3 right-3 rounded-full bg-black/55 px-2 py-1 text-xs font-bold text-white">{project.duration}</span>
      </button>
      <div className="p-3">
        <div className="truncate font-black text-slate-950">{project.title}</div>
        <div className="mt-1 text-xs text-slate-500">{project.avatar?.name || '-'} | {project.voice?.name || '-'} | {project.status}</div>
        <div className="mt-1 text-xs text-slate-400">{formatDate(project.createdAt)}</div>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-1.5">
            <IconButton icon={Play} label="预览" onClick={() => onPreview(project)} />
            <a className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600" href={project.videoUrl} download title="下载">
              <Download className="h-4 w-4" />
            </a>
            <IconButton icon={Copy} label="复用配置" onClick={() => onReuse(project)} />
            <IconButton icon={Share2} label="复制链接" onClick={() => navigator.clipboard?.writeText(project.videoUrl)} />
          </div>
          <button className="rounded-lg px-2 py-1 text-xs font-black text-slate-400 hover:bg-rose-50 hover:text-rose-600" type="button" onClick={() => onDelete(project)}>
            删除
          </button>
        </div>
      </div>
    </article>
  );
}

function UploadProjectModal({ avatars, voices, refreshAll, setToast, onClose }) {
  const [title, setTitle] = useState('');
  const [script, setScript] = useState('');
  const [avatarId, setAvatarId] = useState(avatars[0]?.id || '');
  const [voiceId, setVoiceId] = useState(voices.find((voice) => voice.status === 'ready')?.id || '');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!title.trim() || !script.trim() || !avatarId || !voiceId || !file) {
      setToast('请完整填写作品信息并上传视频');
      return;
    }
    const form = new FormData();
    form.append('title', title);
    form.append('script', script);
    form.append('avatarId', avatarId);
    form.append('voiceId', voiceId);
    form.append('video', file);
    setBusy(true);
    try {
      await apiFetch('/api/projects/upload', { method: 'POST', body: form });
      setToast('作品已上传');
      onClose();
      refreshAll({ silent: true });
    } catch (error) {
      setToast(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="上传作品视频" onClose={onClose}>
      <form className="space-y-3" onSubmit={submit}>
        <TextField label="作品标题" value={title} onChange={setTitle} />
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-slate-500">文案</span>
          <textarea className="h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none" value={script} onChange={(event) => setScript(event.target.value)} />
        </label>
        <SelectInput label="数字人" value={avatarId} options={avatars.map((item) => ({ value: item.id, label: item.name }))} onChange={setAvatarId} />
        <SelectInput label="声音" value={voiceId} options={voices.filter((item) => item.status === 'ready').map((item) => ({ value: item.id, label: item.name }))} onChange={setVoiceId} />
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-slate-500">视频文件</span>
          <input className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" type="file" accept="video/*" onChange={(event) => setFile(event.target.files?.[0] || null)} />
        </label>
        <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-black text-white disabled:opacity-60" type="submit" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          上传
        </button>
      </form>
    </Modal>
  );
}

function ApiPage() {
  const endpoints = [
    'GET /api/avatars', 'POST /api/avatars', 'PUT /api/avatars/:id', 'DELETE /api/avatars/:id',
    'GET /api/voices', 'POST /api/voices', 'DELETE /api/voices/:id',
    'GET /api/templates', 'POST /api/templates',
    'GET /api/jobs', 'POST /api/jobs', 'GET /api/jobs/:id', 'POST /api/jobs/:id/cancel', 'POST /api/jobs/:id/retry',
    'GET /api/projects', 'GET /api/projects/:id', 'DELETE /api/projects/:id',
  ];
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-panel">
      <h2 className="text-xl font-black text-slate-950">API</h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">当前 MVP 已接入 Express + Prisma SQLite，前端所有列表和操作均通过 API 完成。</p>
      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        {endpoints.map((endpoint) => <div key={endpoint} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm text-slate-700">{endpoint}</div>)}
      </div>
    </section>
  );
}

function SettingsPage({ setToast, systemConfig, refreshAll }) {
  const [switching, setSwitching] = useState('');
  const providerLabel = systemConfig.provider === 'aliyun'
    ? `aliyun · ${systemConfig.aliyun?.configured ? 'API Key 已配置' : '缺少 API Key'}`
    : systemConfig.provider === 'heygen'
      ? `heygen · ${systemConfig.heygen?.configured ? 'API Key 已配置' : '缺少 API Key'} · ${systemConfig.heygen?.aspectRatio || '9:16'}`
    : systemConfig.provider;
  const providerOptions = systemConfig.providers || [
    { id: 'mock', name: 'Mock 本地模拟', configured: true, description: '不调用付费接口，适合测试流程。' },
    { id: 'aliyun', name: '阿里百炼', configured: Boolean(systemConfig.aliyun?.configured), description: '阿里 TTS + 数字人生成。' },
    { id: 'heygen', name: 'HeyGen 高质量数字人', configured: Boolean(systemConfig.heygen?.configured), description: 'HeyGen 官方 Avatar API。' },
    { id: 'did', name: 'D-ID 数字人口播', configured: false, description: 'D-ID Talks API。' },
  ];

  async function switchProvider(nextProvider) {
    if (nextProvider === systemConfig.provider) {
      setToast('当前已经是这个模式');
      return;
    }
    setSwitching(nextProvider);
    try {
      const result = await apiFetch('/api/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: nextProvider }),
      });
      setToast(`已切换到 ${providerOptions.find((item) => item.id === result.provider)?.name || result.provider}`);
      refreshAll({ silent: true });
    } catch (error) {
      setToast(error.message);
    } finally {
      setSwitching('');
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-panel">
      <h2 className="text-xl font-black text-slate-950">设置</h2>
      <p className="mt-1 text-sm text-slate-500">默认输出竖屏视频；mock 为离线兜底，aliyun / heygen / did 可接真实口播生成。</p>

      <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h3 className="font-black text-slate-950">生成引擎</h3>
            <p className="mt-1 text-xs text-slate-500">切换会保存到本地 .env；有任务运行时不能切换。</p>
          </div>
          <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-black text-white">当前：{providerDisplayName(systemConfig)}</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {providerOptions.map((item) => {
            const active = item.id === systemConfig.provider;
            return (
              <button
                key={item.id}
                className={`rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-70 ${
                  active
                    ? 'border-blue-500 bg-white shadow-soft ring-4 ring-blue-100'
                    : 'border-slate-200 bg-white hover:border-blue-200 hover:shadow-sm'
                }`}
                type="button"
                onClick={() => switchProvider(item.id)}
                disabled={Boolean(switching)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-black text-slate-900">{item.name}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-500">{item.description}</div>
                  </div>
                  {switching === item.id ? <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> : active ? <CheckCircle2 className="h-4 w-4 text-blue-600" /> : null}
                </div>
                <div className={`mt-3 inline-flex rounded-full px-2 py-1 text-xs font-black ${item.configured ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  {item.configured ? '已配置' : '缺少 Key'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {[
          ['默认输出比例', '9:16 竖屏视频'],
          ['字幕样式', '从工作台表单保存到任务'],
          ['任务通知', '前端轮询 / 可扩展 WebSocket'],
          ['模型 Provider', providerLabel],
        ].map(([label, value]) => (
          <button key={label} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left" type="button" onClick={() => setToast(`${label}：${value}`)}>
            <div className="font-black text-slate-800">{label}</div>
            <div className="text-sm text-slate-500">{value}</div>
          </button>
        ))}
      </div>
    </section>
  );
}

function RecentTasks({ tasks, setActiveView }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-panel">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-black text-slate-950">最近任务</h3>
        <button className="text-xs font-black text-blue-600" type="button" onClick={() => setActiveView('tasks')}>查看全部</button>
      </div>
      <div className="space-y-3">
        {tasks.map((task) => {
          const status = statusMap[task.status] || statusMap.pending;
          return (
            <div key={task.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-white text-blue-600"><Video className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-black text-slate-800">{task.title}</div>
                <div className="mt-1 h-1.5 rounded-full bg-white"><div className={`h-full rounded-full ${status.bar}`} style={{ width: `${task.progress}%` }} /></div>
              </div>
              <div className={`text-xs font-black ${status.color}`}>{status.label}</div>
            </div>
          );
        })}
        {!tasks.length ? <EmptyNote text="暂无任务，创建视频后会出现在这里。" /> : null}
      </div>
    </div>
  );
}

function QuickWorks({ projects, setActiveView }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-panel">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-black text-slate-950">作品快捷入口</h3>
        <button className="text-xs font-black text-blue-600" type="button" onClick={() => setActiveView('works')}>作品管理</button>
      </div>
      <div className="space-y-3">
        {projects.map((project) => (
          <div key={project.id} className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-2">
            <img className="h-16 w-12 rounded-xl object-cover" src={project.coverUrl} alt={project.title} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-black text-slate-800">{project.title}</div>
              <div className="mt-1 text-xs text-slate-500">{project.duration} · {cnDate(project.createdAt)}</div>
              <button className="mt-2 text-xs font-black text-blue-600" type="button" onClick={() => setActiveView('works')}>查看作品</button>
            </div>
          </div>
        ))}
        {!projects.length ? <EmptyNote text="任务完成后会自动创建作品。" /> : null}
      </div>
    </div>
  );
}

function JobDetailModal({ job, onClose }) {
  const status = statusMap[job.status] || statusMap.pending;
  return (
    <Modal title="任务详情" onClose={onClose}>
      <div className="space-y-3 text-sm">
        <InfoRow label="任务 ID" value={job.id} />
        <InfoRow label="任务名称" value={job.title} />
        <InfoRow label="状态" value={status.label} />
        <InfoRow label="阶段" value={job.stage} />
        <InfoRow label="进度" value={`${job.progress}%`} />
        <InfoRow label="Provider" value={job.provider || 'mock'} />
        {job.providerTaskId ? <InfoRow label="Provider Task ID" value={job.providerTaskId} /> : null}
        {job.audioUrl ? <InfoRow label="音频 URL" value={job.audioUrl} /> : null}
        <InfoRow label="数字人" value={job.avatar?.name || '-'} />
        <InfoRow label="声音" value={job.voice?.name || '-'} />
        <InfoRow label="字幕样式" value={job.subtitleStyle} />
        <InfoRow label="背景设置" value={job.backgroundConfig} />
        {job.backgroundImageUrl ? <InfoRow label="自定义背景" value={job.backgroundImageUrl} /> : null}
        <InfoRow label="片头片尾" value={job.introOutroConfig} />
        {job.errorMessage ? (
          <div className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-rose-700">
            {job.errorMessage}
          </div>
        ) : null}
        {job.logs?.length ? (
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-2 text-xs font-black text-slate-500">任务步骤日志</div>
            <div className="space-y-2">
              {job.logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs">
                  <span className="font-black text-slate-700">{log.step}</span>
                  <span className="text-slate-500">{log.progress}% · {log.status}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <div className="rounded-xl bg-slate-50 p-3 leading-6 text-slate-600">{job.script}</div>
      </div>
    </Modal>
  );
}

function VideoPreviewModal({ project, onClose }) {
  return (
    <Modal title={project.title} onClose={onClose} wide>
      <div className="mx-auto max-h-[72vh] w-full max-w-[420px] overflow-hidden rounded-2xl bg-black">
        <video className="aspect-[9/16] h-full w-full object-contain" src={project.videoUrl} controls poster={project.coverUrl} />
      </div>
      <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
        <span>{project.duration} · {project.avatar?.name}</span>
        <a className="rounded-xl bg-blue-600 px-4 py-2 font-black text-white" href={project.videoUrl} download>下载视频</a>
      </div>
    </Modal>
  );
}

function PreviewImageModal({ title, image, onClose }) {
  return (
    <Modal title={title} onClose={onClose}>
      <img className="max-h-[70vh] w-full rounded-2xl object-cover" src={image} alt={title} />
    </Modal>
  );
}

function Modal({ title, onClose, children, wide = false }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4">
      <div className={`max-h-[90vh] w-full overflow-auto rounded-3xl bg-white p-5 shadow-2xl ${wide ? 'max-w-4xl' : 'max-w-xl'}`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-black text-slate-950">{title}</h3>
          <button className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-500" type="button" onClick={onClose}>
            <XCircle className="h-4 w-4" />
          </button>
        </div>
        {children}
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
        <div className={`grid h-10 w-10 place-items-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" /></div>
        <span className="text-xs font-bold text-emerald-600">{hint}</span>
      </div>
      <div className="mt-3 text-sm font-semibold text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-black text-slate-950">{value}</div>
    </div>
  );
}

function SelectInput({ label, value, options, onChange, disabled = false, helper = '' }) {
  const normalized = options.map((option) => (typeof option === 'string' ? { value: option, label: option } : option));
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-slate-500">{label}</span>
      <select
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none disabled:bg-slate-100 disabled:text-slate-400"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        {normalized.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      {helper ? <span className="mt-1 block text-xs leading-5 text-slate-400">{helper}</span> : null}
    </label>
  );
}

function TextField({ label, value, onChange, placeholder = '' }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-slate-500">{label}</span>
      <input className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

function FilterButton({ label, value, onClick }) {
  return (
    <button className="inline-flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600" type="button" onClick={onClick}>
      <span>{label}</span>
      <span className="text-slate-400">{value}</span>
      <ChevronDown className="h-4 w-4 text-slate-400" />
    </button>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button className={`-mb-px border-b-2 px-4 py-3 text-sm font-black transition ${active ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-900'}`} type="button" onClick={onClick}>
      {children}
    </button>
  );
}

function IconButton({ icon: Icon, label, onClick, danger = false }) {
  return (
    <button className={`grid h-8 w-8 place-items-center rounded-lg ${danger ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' : 'bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600'}`} type="button" aria-label={label} title={label} onClick={onClick}>
      <Icon className="h-4 w-4" />
    </button>
  );
}

function Waveform({ seed = 3 }) {
  const bars = Array.from({ length: 28 }, (_, index) => 8 + ((index * 7 + seed * 5) % 28));
  return (
    <div className="flex h-9 flex-1 items-center gap-1">
      {bars.map((height, index) => <span key={`${height}-${index}`} className="w-1 rounded-full bg-blue-500/80" style={{ height }} />)}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
      <span className="font-bold text-slate-500">{label}</span>
      <span className="text-right font-black text-slate-800">{value}</span>
    </div>
  );
}

function EmptyNote({ text }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm font-semibold text-slate-400">{text}</div>;
}

function LoadingState() {
  return (
    <div className="grid min-h-[420px] place-items-center rounded-3xl border border-slate-200 bg-white shadow-panel">
      <div className="flex items-center gap-3 text-sm font-bold text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
        正在读取 API 数据
      </div>
    </div>
  );
}

export default App;
