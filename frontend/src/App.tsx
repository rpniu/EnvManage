import { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Plus, RefreshCw, Layers, Sun, Moon, Monitor, FolderKanban, ShieldAlert, ShieldCheck, Award, Settings, Shield, Download, Upload, ChevronDown, BookOpen, Copy, CheckCheck, FolderOpen, MapPin, FileJson, User } from 'lucide-react';
import { GetVariables, DeleteVariable, SetVariable, BroadcastChange, IsAdmin } from "../wailsjs/go/backend/EnvManager";
import { SaveFileDialog, OpenFileDialog, WriteFileContent, ReadFileContent, OpenFileLocation } from "../wailsjs/go/main/App";
import { GetConfigPath } from "../wailsjs/go/backend/DataManager";
import { backend } from "../wailsjs/go/models";

import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { VariableList } from './components/VariableList';
import { EditModal } from './components/EditModal';
import { PathEditor } from './components/PathEditor';

// Import New Feature Tabs
import { PathManagerTab } from './components/PathManagerTab';
import { ProfileManagerTab } from './components/ProfileManagerTab';
import { TemplateManagerTab } from './components/TemplateManagerTab';
import { SnapshotManagerTab } from './components/SnapshotManagerTab';

type TabType = "variables" | "path" | "profiles" | "templates" | "snapshots" | "guide";

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>("guide");
  const [isSystem, setIsSystem] = useState(false);
  const [vars, setVars] = useState<backend.EnvVar[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);

  // Modals state
  const [editVar, setEditVar] = useState<{key: string, value: string, isNew: boolean} | null>(null);
  const [pathVar, setPathVar] = useState<{key: string, value: string} | null>(null);

  // Export dropdown
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Config guide
  const [copied, setCopied] = useState(false);
  const [lastExportPath, setLastExportPath] = useState<string>(() => localStorage.getItem('lastExportPath') || '');
  const [configPath, setConfigPath] = useState<string>('');

  // Load fixed config path from backend
  useEffect(() => {
    GetConfigPath().then((path: string) => {
      setConfigPath(path);
      setLastExportPath(path);
      localStorage.setItem('lastExportPath', path);
    }).catch(console.error);
  }, []);
  const exampleJson = `[
  {
    "key": "JAVA_HOME",
    "value": "C:\\Program Files\\Java\\jdk-17",
    "isSystem": false
  },
  {
    "key": "PATH",
    "value": "%JAVA_HOME%\\bin;D:\\tools\\bin",
    "isSystem": false
  },
  {
    "key": "COMSPEC",
    "value": "C:\\Windows\\system32\\cmd.exe",
    "isSystem": true
  }
]`;
  const handleCopyExample = () => {
    navigator.clipboard.writeText(exampleJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) setExportMenuOpen(false);
    };
    if (exportMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [exportMenuOpen]);

  // Theme mode
  type Theme = "light" | "dark" | "system";
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'system');

  useEffect(() => {
    localStorage.setItem('theme', theme);
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      root.classList.add(systemTheme);
      return;
    }
    root.classList.add(theme);
  }, [theme]);

  useEffect(() => {
    if (theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const toggle = (e: MediaQueryListEvent | MediaQueryList) => {
      const root = window.document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(e.matches ? "dark" : "light");
    };
    media.addEventListener('change', toggle);
    return () => media.removeEventListener('change', toggle);
  }, [theme]);

  // Check Administrator Privilege
  const checkPrivilege = async () => {
    try {
      const admin = await IsAdmin();
      setIsAdminUser(admin);
    } catch (e) {
      console.error("Failed to check privilege", e);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await GetVariables(isSystem);
      setVars(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkPrivilege();
  }, []);

  useEffect(() => {
    if (activeTab === "variables") {
      loadData();
    }
  }, [isSystem, activeTab]);

  const handleDelete = async (key: string) => {
    if (isSystem && !isAdminUser) {
      alert("修改系统环境变量需要管理员权限！请以管理员身份重新运行此程序。");
      return;
    }
    if (!window.confirm(`确认要删除环境变量 [ ${key} ] 吗？`)) return;
    await DeleteVariable(isSystem, key);
    await BroadcastChange();
    loadData();
  };

  const handleSave = async (key: string, value: string) => {
    if (isSystem && !isAdminUser) {
      alert("修改系统环境变量需要管理员权限！请以管理员身份重新运行此程序。");
      return;
    }
    await SetVariable(isSystem, key, value);
    await BroadcastChange();
    setEditVar(null);
    setPathVar(null);
    loadData();
  };

  const handleExport = async (scope: 'all' | 'user' | 'system') => {
    try {
      let data: backend.EnvVar[];
      let label: string;
      if (scope === 'all') {
        const [userVars, sysVars] = await Promise.all([GetVariables(false), GetVariables(true)]);
        data = [...(userVars || []), ...(sysVars || [])];
        label = '全部';
      } else if (scope === 'user') {
        data = (await GetVariables(false)) || [];
        label = '用户';
      } else {
        data = (await GetVariables(true)) || [];
        label = '系统';
      }
      const jsonStr = JSON.stringify(data, null, 2);
      const filename = `env_${scope}_${new Date().toISOString().slice(0, 10)}.json`;
      const filePath = await SaveFileDialog(filename, [{ DisplayName: 'JSON 文件', Pattern: '*.json' }]);
      if (!filePath) return;
      await WriteFileContent(filePath, jsonStr);
      setLastExportPath(filePath);
      localStorage.setItem('lastExportPath', filePath);
      alert(`成功导出 ${data.length} 个${label}环境变量！`);
      setExportMenuOpen(false);
    } catch (e) {
      console.error(e);
      alert('导出失败: ' + e);
      setExportMenuOpen(false);
    }
  };

  const handleImport = async () => {
    try {
      const filePath = await OpenFileDialog([{ DisplayName: 'JSON 文件', Pattern: '*.json' }]);
      if (!filePath) return;
      const content = await ReadFileContent(filePath);
      const imported: backend.EnvVar[] = JSON.parse(content);
      if (!Array.isArray(imported) || imported.length === 0) {
        alert('文件中没有可导入的环境变量。');
        return;
      }
      const sysCount = imported.filter(v => v.isSystem).length;
      if (sysCount > 0 && !isAdminUser) {
        alert(`文件包含 ${sysCount} 个系统级变量，导入系统级变量需要管理员权限！`);
        return;
      }
      const desc = sysCount > 0
        ? `${imported.length - sysCount} 个用户级 + ${sysCount} 个系统级`
        : `${imported.length} 个用户级`;
      if (!window.confirm(`即将导入 ${desc} 变量，同名变量将被覆盖。确认继续吗？`)) return;
      for (const v of imported) {
        await SetVariable(v.isSystem, v.key, v.value);
      }
      await BroadcastChange();
      loadData();
      alert(`成功导入 ${imported.length} 个环境变量！`);
    } catch (e) {
      console.error(e);
      alert('导入失败: ' + e);
    }
  };

  const filteredVars = useMemo(() => {
    if (!search) return vars;
    const lower = search.toLowerCase();
    return vars.filter(v => v.key.toLowerCase().includes(lower) || v.value.toLowerCase().includes(lower));
  }, [vars, search]);

  return (
    <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <div className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col gap-5 shrink-0 shadow-sm">
        <h1 className="text-lg font-black flex items-center gap-2 text-slate-800 dark:text-slate-200 select-none pb-2 border-b border-slate-100 dark:border-slate-850">
          <Layers className="h-5 w-5 text-indigo-500 fill-indigo-100 dark:fill-none" />
          EnvManage Pro
        </h1>

        {/* Administrator privilege Badge */}
        <div className="flex items-center gap-2 p-2.5 rounded-lg border text-xs">
          {isAdminUser ? (
            <>
              <ShieldCheck className="h-4 w-4 text-green-500 shrink-0" />
              <span className="font-semibold text-green-600 dark:text-green-400">管理员权限 (Admin)</span>
            </>
          ) : (
            <>
              <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0" />
              <span className="font-semibold text-slate-500 dark:text-slate-400" title="修改系统层环境变量需要管理员权限">普通用户权限 (User)</span>
            </>
          )}
        </div>

        {/* Tab links */}
        <div className="flex flex-col gap-1 flex-1">
          <button
            onClick={() => setActiveTab("variables")}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left ${activeTab === "variables" ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold border-l-2 border-indigo-500' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-900'}`}
          >
            <Layers className="h-4 w-4 shrink-0" />
            环境变量 (Variables)
          </button>
          
          <button
            onClick={() => setActiveTab("path")}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left ${activeTab === "path" ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold border-l-2 border-indigo-500' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-900'}`}
          >
            <FolderKanban className="h-4 w-4 shrink-0" />
            PATH 可视化 (PATH)
          </button>

          <button
            onClick={() => setActiveTab("profiles")}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left ${activeTab === "profiles" ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold border-l-2 border-indigo-500' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-900'}`}
          >
            <Award className="h-4 w-4 shrink-0" />
            环境切换 (Profiles)
          </button>

          <button
            onClick={() => setActiveTab("templates")}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left ${activeTab === "templates" ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold border-l-2 border-indigo-500' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-900'}`}
          >
            <Settings className="h-4 w-4 shrink-0" />
            环境模板 (Templates)
          </button>

          <button
            onClick={() => setActiveTab("snapshots")}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left ${activeTab === "snapshots" ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold border-l-2 border-indigo-500' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-900'}`}
          >
            <Shield className="h-4 w-4 shrink-0" />
            系统快照 (Snapshots)
          </button>

          <button
            onClick={() => setActiveTab("guide")}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left ${activeTab === "guide" ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold border-l-2 border-indigo-500' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-900'}`}
          >
            <BookOpen className="h-4 w-4 shrink-0" />
            配置文件指引 (Guide)
          </button>
        </div>

        {/* Theme Settings at Bottom */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-lg mt-auto">
          <Button variant={theme === 'light' ? 'default' : 'ghost'} size="icon" className="h-8 w-8 flex-1" onClick={() => setTheme('light')} title="浅色">
            <Sun className="h-4 w-4" />
          </Button>
          <Button variant={theme === 'dark' ? 'default' : 'ghost'} size="icon" className="h-8 w-8 flex-1" onClick={() => setTheme('dark')} title="深色">
            <Moon className="h-4 w-4" />
          </Button>
          <Button variant={theme === 'system' ? 'default' : 'ghost'} size="icon" className="h-8 w-8 flex-1" onClick={() => setTheme('system')} title="系统">
            <Monitor className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
        {activeTab === "variables" ? (
          /* ENVIRONMENT VARIABLES VIEW */
          <>
            <header className="h-16 border-b border-slate-200 dark:border-slate-850 flex items-center justify-between px-6 bg-white dark:bg-slate-900 shrink-0">
              <div className="flex rounded-xl border-2 border-slate-200 dark:border-slate-800 p-1 bg-slate-100/50 dark:bg-slate-900/50 shadow-sm">
                <button
                  onClick={() => setIsSystem(false)}
                  title="切换到用户级环境变量"
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                    !isSystem
                      ? 'bg-blue-500 text-white shadow-md scale-[1.02]'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <User className="h-4 w-4" />
                  用户变量
                </button>
                <button
                  onClick={() => setIsSystem(true)}
                  title="切换到系统级环境变量（需管理员权限）"
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                    isSystem
                      ? 'bg-amber-500 text-white shadow-md scale-[1.02]'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <ShieldAlert className="h-4 w-4" />
                  系统变量
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <Input 
                    placeholder="搜索变量名或值..." 
                    className="pl-9 w-64 bg-slate-100/30 dark:bg-slate-950/30"
                    value={search}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                  />
                </div>
                <Button onClick={() => setEditVar({key: '', value: '', isNew: true})} className="gap-1.5 shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white border-0 shadow-md">
                  <Plus className="h-4 w-4" /> 新建变量
                </Button>
                <div className="relative shrink-0" ref={exportMenuRef}>
                  <Button variant="outline" size="sm" onClick={() => setExportMenuOpen(v => !v)} className="gap-1.5" title="导出环境变量为 JSON 文件">
                    <Download className="h-4 w-4" /> 导出 <ChevronDown className="h-3 w-3 opacity-60" />
                  </Button>
                  {exportMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 animate-in fade-in slide-in-from-top-1">
                      <button onClick={() => handleExport('all')} className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2">
                        <Layers className="h-3.5 w-3.5 text-indigo-500" /> 全部变量 (All)
                      </button>
                      <button onClick={() => handleExport('user')} className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2">
                        <Shield className="h-3.5 w-3.5 text-blue-500" /> 用户变量 (User)
                      </button>
                      <button onClick={() => handleExport('system')} className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2">
                        <ShieldCheck className="h-3.5 w-3.5 text-amber-500" /> 系统变量 (System)
                      </button>
                    </div>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={handleImport} className="gap-1.5 shrink-0" title="从 JSON 文件导入变量（根据 isSystem 字段自动分层写入）">
                  <Upload className="h-4 w-4" /> 导入
                </Button>
                <Button variant="outline" size="icon" onClick={loadData} disabled={isLoading}>
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </header>
            
            <main className="flex-1 overflow-auto p-6">
              <VariableList 
                data={filteredVars} 
                searchTerm={search}
                onEdit={(v) => {
                  if (v.key.toLowerCase() === 'path') {
                    setPathVar(v);
                  } else {
                    setEditVar({...v, isNew: false});
                  }
                }} 
                onDelete={handleDelete} 
              />
            </main>
          </>
        ) : activeTab === "path" ? (
          /* PATH VISUAL MANAGER VIEW */
          <div className="flex-1 p-6 overflow-hidden">
            <PathManagerTab />
          </div>
        ) : activeTab === "profiles" ? (
          /* ENVIRONMENT PROFILE SWITCHER VIEW */
          <div className="flex-1 p-6 overflow-hidden">
            <ProfileManagerTab />
          </div>
        ) : activeTab === "templates" ? (
          /* ENVIRONMENT TEMPLATES VIEW */
          <div className="flex-1 p-6 overflow-hidden">
            <TemplateManagerTab />
          </div>
        ) : activeTab === "guide" ? (
          /* CONFIG GUIDE VIEW */
          <div className="flex-1 overflow-auto p-6">
            <div className="max-w-2xl mx-auto space-y-6 text-sm text-slate-700 dark:text-slate-300">
              {/* Section 0: Workflow - First! */}
              <section className="p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-800">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-black">★</span>
                  推荐工作流
                </h3>
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="px-3 py-1.5 bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-200 rounded-full font-bold border border-blue-200 dark:border-blue-800">1. 创建快照备份</span>
                  <span className="text-slate-400 font-bold text-base">&rarr;</span>
                  <span className="px-3 py-1.5 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200 rounded-full font-bold border border-indigo-200 dark:border-indigo-800">2. 导入配置文件</span>
                  <span className="text-slate-400 font-bold text-base">&rarr;</span>
                  <span className="px-3 py-1.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 rounded-full font-bold border border-emerald-200 dark:border-emerald-800">3. 检查变更</span>
                  <span className="text-slate-400 font-bold text-base">&rarr;</span>
                  <span className="px-3 py-1.5 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 rounded-full font-bold border border-amber-200 dark:border-amber-800">4. 如有问题可回滚快照</span>
                </div>
              </section>

              {/* Section 1: Config File Location */}
              <section className="p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 border border-indigo-200 dark:border-indigo-800">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-2">
                  <FileJson className="h-5 w-5 text-indigo-500" />
                  默认存储地址
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">配置文件固定在程序同级目录下，不可更改。</p>
                {configPath ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                      <MapPin className="h-4 w-4 text-indigo-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-0.5">config.json</p>
                        <code className="text-xs font-mono text-slate-800 dark:text-slate-200 break-all leading-relaxed" title={configPath}>{configPath}</code>
                      </div>
                    </div>
                    <button
                      onClick={() => OpenFileLocation(configPath)}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors group shadow-sm"
                      title={`在资源管理器中打开：${configPath}`}
                    >
                      <FolderOpen className="h-4 w-4 group-hover:scale-110 transition-transform" /> 在资源管理器中打开
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                    <RefreshCw className="h-4 w-4 text-slate-400 animate-spin" />
                    <span className="text-xs text-slate-500 dark:text-slate-400">正在获取路径...</span>
                  </div>
                )}
              </section>
              {/* Section 2: Format */}
              <section>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-2">
                  文件格式
                </h3>
                <p>配置文件为 <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono text-indigo-600 dark:text-indigo-400">.json</code> 格式，内容是一个 JSON 数组，每个元素代表一个环境变量。</p>
              </section>

              {/* Section 3: Fields */}
              <section>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-2">
                  字段说明
                </h3>
                <div className="space-y-2">
                  <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <code className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded text-xs font-mono font-bold shrink-0 mt-0.5">key</code>
                    <span>变量名，如 <code className="font-mono">JAVA_HOME</code>、<code className="font-mono">PATH</code>。不能为空。</span>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <code className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded text-xs font-mono font-bold shrink-0 mt-0.5">value</code>
                    <span>变量值，支持 Windows 展开引用（如 <code className="font-mono">%JAVA_HOME%\bin</code>），多路径用 <code className="font-mono">;</code> 分隔。</span>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <code className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded text-xs font-mono font-bold shrink-0 mt-0.5">isSystem</code>
                    <div>
                      <span className="font-semibold">部署层级：</span>
                      <span className="inline-flex items-center gap-1 ml-1">
                        <code className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded text-xs font-mono">false</code> 用户级（HKEY_CURRENT_USER）
                      </span>
                      <span className="mx-1">/</span>
                      <span className="inline-flex items-center gap-1">
                        <code className="px-1.5 py-0.5 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded text-xs font-mono">true</code> 系统级（HKEY_LOCAL_MACHINE，需管理员）
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 4: Example */}
              <section>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-2">
                  示例文件
                </h3>
                <div className="relative">
                  <pre className="bg-slate-900 dark:bg-slate-950 text-slate-100 rounded-xl p-4 text-xs font-mono leading-relaxed overflow-x-auto">{exampleJson}</pre>
                  <button
                    onClick={handleCopyExample}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-600 text-slate-300 transition-colors"
                    title="复制示例"
                  >
                    {copied ? <CheckCheck className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                {lastExportPath && (
                  <button
                    onClick={() => OpenFileLocation(lastExportPath)}
                    className="mt-3 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors group"
                    title={`打开文件所在位置：${lastExportPath}`}
                  >
                    <FolderOpen className="h-4 w-4 group-hover:scale-110 transition-transform" />
                    打开上次导出文件位置
                    <span className="text-indigo-400 dark:text-indigo-500 font-normal truncate max-w-[280px]" title={lastExportPath}>{lastExportPath}</span>
                  </button>
                )}
              </section>

              {/* Section 5: Tips */}
              <section>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-2">
                  导入须知
                </h3>
                <ul className="space-y-1.5 list-none pl-0">
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-500 mt-0.5 shrink-0">&#9679;</span>
                    导入时根据每条变量的 <code className="font-mono text-xs">isSystem</code> 字段<span className="font-semibold">自动分层写入</span>对应注册表位置。
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rose-500 mt-0.5 shrink-0">&#9679;</span>
                    同名的已有变量会被<span className="font-semibold text-rose-600 dark:text-rose-400">覆盖</span>，请提前创建快照备份。
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5 shrink-0">&#9679;</span>
                    写入系统级变量（<code className="font-mono text-xs">isSystem: true</code>）需以<span className="font-semibold">管理员权限</span>运行本程序。
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5 shrink-0">&#9679;</span>
                    导出"全部变量"时会将用户级与系统级变量合并到同一文件，每条保留原始层级标记。
                  </li>
                </ul>
              </section>


            </div>
          </div>
        ) : (
          /* SNAPSHOT SYSTEM VIEW */
          <div className="flex-1 p-6 overflow-hidden">
            <SnapshotManagerTab />
          </div>
        )}
      </div>

      {editVar && (
        <EditModal 
          initData={editVar} 
          searchTerm={search}
          onClose={() => setEditVar(null)} 
          onSave={(k, v) => handleSave(k, v)}
        />
      )}

      {pathVar && (
        <PathEditor 
          initData={pathVar}
          searchTerm={search}
          onClose={() => setPathVar(null)}
          onSave={(v) => handleSave(pathVar.key, v)}
        />
      )}
    </div>
  );
}

