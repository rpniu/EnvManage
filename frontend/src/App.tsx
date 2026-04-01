import { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Trash2, Edit, RefreshCw, Layers, Sun, Moon, Monitor } from 'lucide-react';
import { GetVariables, DeleteVariable, SetVariable, BroadcastChange, CheckPathExists } from "../wailsjs/go/backend/EnvManager";
import { backend } from "../wailsjs/go/models";

import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { VariableList } from './components/VariableList';
import { EditModal } from './components/EditModal';
import { PathEditor } from './components/PathEditor';

export default function App() {
  const [isSystem, setIsSystem] = useState(false);
  const [vars, setVars] = useState<backend.EnvVar[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Modals state
  const [editVar, setEditVar] = useState<{key: string, value: string, isNew: boolean} | null>(null);
  const [pathVar, setPathVar] = useState<{key: string, value: string} | null>(null);

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
    loadData();
  }, [isSystem]);

  const handleDelete = async (key: string) => {
    if (!window.confirm(`确认要删除环境变量 [ ${key} ] 吗？`)) return;
    await DeleteVariable(isSystem, key);
    await BroadcastChange();
    loadData();
  };

  const handleSave = async (key: string, value: string) => {
    await SetVariable(isSystem, key, value);
    await BroadcastChange();
    setEditVar(null);
    setPathVar(null);
    loadData();
  };

  const filteredVars = useMemo(() => {
    if (!search) return vars;
    const lower = search.toLowerCase();
    return vars.filter(v => v.key.toLowerCase().includes(lower) || v.value.toLowerCase().includes(lower));
  }, [vars, search]);

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden font-sans">
      {/* Sidebar */}
      <div className="w-64 border-r border-border bg-card p-4 flex flex-col gap-4 shadow-sm">
        <h1 className="text-xl font-black mb-4 flex items-center gap-2 text-primary">
          <Layers className="text-blue-500" />
          EnvManage
        </h1>
        
        <div className="flex flex-col gap-2">
          <Button 
            variant={!isSystem ? "default" : "ghost"} 
            className="justify-start gap-2"
            onClick={() => setIsSystem(false)}
          >
            <span className="h-2 w-2 rounded-full bg-green-500"></span>
            当前用户变量
          </Button>
          <Button 
            variant={isSystem ? "default" : "ghost"} 
            className="justify-start gap-2"
            onClick={() => setIsSystem(true)}
          >
            <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
            系统层级变量
          </Button>
        </div>

        <div className="mt-auto p-4 bg-muted/40 rounded-lg text-xs leading-relaxed text-muted-foreground">
          所有修改会在保存后立刻触发系统广播，新开终端或程序将即刻生效。
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
        <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-card/50 backdrop-blur">
          <h2 className="text-lg font-semibold tracking-tight">
            {isSystem ? '系统环境变量 (System)' : '用户环境变量 (User)'}
          </h2>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="搜索变量名或值..." 
                className="pl-9 w-64 bg-background"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg">
              <Button variant={theme === 'light' ? 'default' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setTheme('light')} title="浅色">
                <Sun className="h-4 w-4" />
              </Button>
              <Button variant={theme === 'dark' ? 'default' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setTheme('dark')} title="深色">
                <Moon className="h-4 w-4" />
              </Button>
              <Button variant={theme === 'system' ? 'default' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setTheme('system')} title="跟随系统">
                <Monitor className="h-4 w-4" />
              </Button>
            </div>
            <Button onClick={() => setEditVar({key: '', value: '', isNew: true})} className="gap-2 shrink-0 bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="h-4 w-4" /> 新建变量
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
