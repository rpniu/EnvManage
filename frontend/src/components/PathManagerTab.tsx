import { useState, useEffect } from 'react';
import { Plus, Trash2, FolderOpen, AlertTriangle, CheckCircle, RefreshCw, Sparkles, Check, ToggleLeft, ToggleRight, GripVertical, User, ShieldAlert } from 'lucide-react';
import { GetVariables, SetVariable, BroadcastChange, CheckPathExists } from "../../wailsjs/go/backend/EnvManager";
import { GetDisabledPaths, SetDisabledPaths } from "../../wailsjs/go/backend/DataManager";
import { SelectDirectory } from "../../wailsjs/go/main/App";
import { Button } from './ui/button';
import { Input } from './ui/input';


interface PathItem {
  id: string;
  path: string;
  isEnabled: boolean;
  isValid?: boolean;
  isDuplicate?: boolean;
}

export function PathManagerTab() {
  const [isSystem, setIsSystem] = useState(false);
  const [paths, setPaths] = useState<PathItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newPath, setNewPath] = useState("");
  const [validating, setValidating] = useState(false);

  // Load PATH variables and combine with disabled paths
  const loadPathData = async () => {
    setIsLoading(true);
    try {
      // 1. Get registry variables
      const vars = await GetVariables(isSystem);
      const pathVar = vars.find(v => v.key.toLowerCase() === 'path');
      const registryPathStr = pathVar ? pathVar.value : "";
      const registryPaths = registryPathStr.split(";").filter(Boolean);

      // 2. Get local disabled paths
      const allDisabled = await GetDisabledPaths() || [];
      const prefix = isSystem ? "system:" : "user:";
      const disabledForLevel = allDisabled
        .filter((p: string) => p.startsWith(prefix))
        .map((p: string) => p.substring(prefix.length));

      // 3. Combine them
      const items: PathItem[] = [];
      
      // Add enabled registry paths
      registryPaths.forEach((p, idx) => {
        items.push({
          id: `enabled-${idx}-${p}`,
          path: p,
          isEnabled: true
        });
      });

      // Add disabled paths
      disabledForLevel.forEach((p, idx) => {
        items.push({
          id: `disabled-${idx}-${p}`,
          path: p,
          isEnabled: false
        });
      });

      setPaths(items);
      validatePaths(items);
    } catch (e) {
      console.error("Failed to load PATH data", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Validate path existence and duplicates
  const validatePaths = async (items: PathItem[]) => {
    setValidating(true);
    try {
      const checked: PathItem[] = [];
      const pathCounts: Record<string, number> = {};
      
      // Count duplicates (case insensitive for Windows paths)
      items.forEach(item => {
        const norm = item.path.trim().toLowerCase().replace(/[\\/]+$/, "");
        pathCounts[norm] = (pathCounts[norm] || 0) + 1;
      });

      for (let item of items) {
        let isValid = true;
        if (item.path.includes('%')) {
          // If it contains environmental expansions, assume valid for now or bypass Stat
          isValid = true;
        } else {
          isValid = await CheckPathExists(item.path);
        }
        
        const norm = item.path.trim().toLowerCase().replace(/[\\/]+$/, "");
        const isDuplicate = pathCounts[norm] > 1;

        checked.push({
          ...item,
          isValid,
          isDuplicate
        });
      }
      setPaths(checked);
    } catch (e) {
      console.error(e);
    } finally {
      setValidating(false);
    }
  };

  useEffect(() => {
    loadPathData();
  }, [isSystem]);

  // Save paths to registry & local config
  const savePaths = async (currentPaths: PathItem[]) => {
    setIsLoading(true);
    try {
      const enabledPaths = currentPaths.filter(p => p.isEnabled).map(p => p.path);
      const disabledPaths = currentPaths.filter(p => !p.isEnabled).map(p => p.path);

      // 1. Save registry PATH
      const pathValue = enabledPaths.join(";");
      await SetVariable(isSystem, "Path", pathValue);

      // 2. Save local disabled paths
      const prefix = isSystem ? "system:" : "user:";
      const allDisabled = await GetDisabledPaths() || [];
      // Remove current level's disabled paths and add the updated list
      const filteredDisabled = allDisabled.filter((p: string) => !p.startsWith(prefix));
      const updatedDisabled = [
        ...filteredDisabled,
        ...disabledPaths.map(p => prefix + p)
      ];
      await SetDisabledPaths(updatedDisabled);

      // 3. Broadcast
      await BroadcastChange();
      
      // Reload
      await loadPathData();
    } catch (e) {
      console.error("Failed to save PATH", e);
      alert("保存 PATH 失败: " + e);
    } finally {
      setIsLoading(false);
    }
  };

  // Add path manually or via picker
  const handleAddPath = (pathToAdd: string) => {
    if (!pathToAdd.trim()) return;
    const isDup = paths.some(p => p.path.toLowerCase() === pathToAdd.trim().toLowerCase());
    if (isDup) {
      alert("此路径已存在于列表中！");
      return;
    }
    const newItems = [
      ...paths,
      {
        id: `new-${Date.now()}-${pathToAdd}`,
        path: pathToAdd.trim(),
        isEnabled: true
      }
    ];
    setPaths(newItems);
    setNewPath("");
    savePaths(newItems);
  };

  const handleBrowseFolder = async () => {
    try {
      const selected = await SelectDirectory();
      if (selected) {
        handleAddPath(selected);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleEnable = (idx: number) => {
    const updated = [...paths];
    updated[idx].isEnabled = !updated[idx].isEnabled;
    setPaths(updated);
    savePaths(updated);
  };

  const handleDelete = (idx: number) => {
    const updated = paths.filter((_, i) => i !== idx);
    setPaths(updated);
    savePaths(updated);
  };

  // HTML5 Drag and Drop handlers
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === index) return;
    
    // Perform swap/reorder in state
    const updated = [...paths];
    const item = updated[draggedIdx];
    updated.splice(draggedIdx, 1);
    updated.splice(index, 0, item);
    
    setDraggedIdx(index);
    setPaths(updated);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    savePaths(paths);
  };

  // One-click deduplicate
  const handleDeduplicate = () => {
    const seen = new Set<string>();
    const deduplicated: PathItem[] = [];
    paths.forEach(item => {
      const norm = item.path.trim().toLowerCase().replace(/[\\/]+$/, "");
      if (!seen.has(norm)) {
        seen.add(norm);
        deduplicated.push(item);
      }
    });
    setPaths(deduplicated);
    savePaths(deduplicated);
  };

  // One-click clean invalid paths
  const handleCleanInvalid = () => {
    const validOnes = paths.filter(p => p.isValid !== false || p.path.includes('%'));
    if (validOnes.length === paths.length) {
      alert("没有检测到无效路径！");
      return;
    }
    if (window.confirm(`确认清除 ${paths.length - validOnes.length} 个无效的文件夹路径吗？`)) {
      setPaths(validOnes);
      savePaths(validOnes);
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full overflow-hidden">
      {/* Top action bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">PATH 可视化管理</h2>
          <p className="text-sm text-slate-500 mt-1">
            直观检查、启用/禁用、拖拽排序系统与用户的 PATH 变量。
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border-2 border-slate-200 dark:border-slate-800 p-1 bg-slate-100/50 dark:bg-slate-900/50 shadow-sm">
            <button
              onClick={() => setIsSystem(false)}
              title="切换到用户级 PATH 变量"
              className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                !isSystem
                  ? 'bg-blue-500 text-white shadow-md scale-[1.02]'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
              }`}
            >
              <User className="h-4 w-4" />
              用户 PATH
            </button>
            <button
              onClick={() => setIsSystem(true)}
              title="切换到系统级 PATH 变量（需管理员权限）"
              className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                isSystem
                  ? 'bg-amber-500 text-white shadow-md scale-[1.02]'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
              }`}
            >
              <ShieldAlert className="h-4 w-4" />
              系统 PATH
            </button>
          </div>

          <Button variant="outline" size="icon" onClick={loadPathData} disabled={isLoading} title="刷新">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Path Input Box */}
      <div className="flex gap-2 items-center bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <Input
          placeholder="输入文件夹路径 (e.g. C:\tools) 或选择本地文件夹..."
          value={newPath}
          onChange={e => setNewPath(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAddPath(newPath)}
          className="font-mono text-sm"
        />
        <Button variant="outline" onClick={handleBrowseFolder} className="gap-2 shrink-0">
          <FolderOpen className="h-4 w-4 text-slate-500" />
          浏览文件夹
        </Button>
        <Button onClick={() => handleAddPath(newPath)} disabled={!newPath.trim()} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          添加路径
        </Button>
      </div>

      {/* Quick Utilities */}
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={handleDeduplicate} className="gap-1.5 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-900 bg-purple-50/20 hover:bg-purple-50 dark:hover:bg-purple-950/20">
          <Sparkles className="h-3.5 w-3.5" />
          一键去重
        </Button>
        <Button variant="outline" size="sm" onClick={handleCleanInvalid} className="gap-1.5 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900 bg-red-50/20 hover:bg-red-50 dark:hover:bg-red-950/20">
          <AlertTriangle className="h-3.5 w-3.5" />
          清除无效路径
        </Button>
      </div>

      {/* Path Items List */}
      <div className="flex-1 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-sm">
        {paths.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
            <FolderOpen className="h-8 w-8 stroke-[1.5]" />
            <span className="text-sm">当前 PATH 列表中无任何文件夹路径</span>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {paths.map((item, idx) => {
              const showWarning = item.isValid === false && !item.path.includes('%');
              const isDup = item.isDuplicate;

              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-3 p-3 transition-colors ${idx === draggedIdx ? 'opacity-40 bg-slate-50 dark:bg-slate-800/40' : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/20'} ${!item.isEnabled ? 'text-slate-400 dark:text-slate-600' : ''}`}
                >
                  {/* Drag handle */}
                  <div className="cursor-grab text-slate-300 dark:text-slate-700 hover:text-slate-500 shrink-0 select-none">
                    <GripVertical className="h-4 w-4" />
                  </div>

                  {/* Index and Checkbox */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-mono w-5 text-right select-none text-slate-400">
                      {idx + 1}
                    </span>
                    <button
                      onClick={() => handleToggleEnable(idx)}
                      className="transition-colors hover:text-slate-700 dark:hover:text-slate-200"
                      title={item.isEnabled ? "点击禁用" : "点击启用"}
                    >
                      {item.isEnabled ? (
                        <ToggleRight className="h-6 w-6 text-green-500 fill-green-100 dark:fill-none" />
                      ) : (
                        <ToggleLeft className="h-6 w-6 text-slate-300 dark:text-slate-700" />
                      )}
                    </button>
                  </div>

                  {/* Path text */}
                  <div className="flex-1 font-mono text-sm truncate select-all" title={item.path}>
                    <span className={!item.isEnabled ? 'line-through text-slate-400 dark:text-slate-600' : ''}>
                      {item.path}
                    </span>
                  </div>

                  {/* Badges / Alerts */}
                  <div className="flex gap-2 shrink-0 items-center">
                    {!item.isEnabled && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 font-semibold uppercase">
                        已禁用
                      </span>
                    )}

                    {item.isEnabled && showWarning && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 font-medium">
                        <AlertTriangle className="h-3 w-3" />
                        失效路径
                      </span>
                    )}

                    {item.isEnabled && isDup && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50 font-medium">
                        <Sparkles className="h-3 w-3" />
                        重复
                      </span>
                    )}

                    {item.isEnabled && !showWarning && !isDup && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-900/50 font-medium">
                        <CheckCircle className="h-3 w-3" />
                        有效
                      </span>
                    )}

                    {/* Delete button */}
                    <button
                      onClick={() => handleDelete(idx)}
                      className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="删除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info notice */}
      <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg border border-slate-200/50 dark:border-slate-800/50 leading-relaxed">
        提示：双击路径文本可快捷复制。拖拽各行调整优先级（排在前面的路径在执行命令时优先解析）。所有改动在操作后会自动即时保存并广播刷新，免除重启系统的烦恼。
      </div>
    </div>
  );
}
