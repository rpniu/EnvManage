import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Shield, Plus, Trash2, ArrowLeftRight, CheckCircle, RefreshCw, Undo, AlertCircle, Camera, Clock, Database, ChevronRight, Loader2 } from 'lucide-react';
import { GetSnapshots, CreateSnapshot, DeleteSnapshot, RestoreSnapshot } from "../../wailsjs/go/backend/DataManager";
import { GetVariables } from "../../wailsjs/go/backend/EnvManager";
import { backend } from "../../wailsjs/go/models";
import { Button } from './ui/button';
import { Input } from './ui/input';

interface DiffItem {
  key: string;
  type: 'added' | 'removed' | 'modified' | 'unchanged';
  isSystem: boolean;
  currVal: string;
  snapVal: string;
}

// Render semicolon-separated values as individual segments with diff highlighting
function DiffValue({ value, compareValue, colorClass }: {
  value: string;
  compareValue?: string;
  colorClass?: string;
}) {
  const segments = value.split(';').filter(Boolean);
  const isMulti = segments.length > 1;

  // Compute which segments are unique to this value (not in compareValue)
  const compareSegs = new Set(
    (compareValue || '').split(';')
      .filter(Boolean)
      .map(s => s.trim().toLowerCase())
  );

  if (!isMulti) {
    return <span className={colorClass || 'text-slate-900 dark:text-slate-100'}>{value}</span>;
  }

  return (
    <div className="flex flex-col gap-0.5 w-full">
      {segments.map((seg, i) => {
        const inCompare = compareSegs.has(seg.trim().toLowerCase());
        const isDiffSeg = compareValue !== undefined && !inCompare;
        return (
          <div
            key={i}
            className={`px-1.5 py-0.5 rounded text-sm leading-tight truncate ${
              isDiffSeg
                ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold'
                : 'bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200'
            }`}
            title={seg.trim()}
          >
            {i > 0 && <span className="opacity-40 mr-0.5">;</span>}
            {seg.trim()}
          </div>
        );
      })}
    </div>
  );
}

export function SnapshotManagerTab() {
  const [snapshots, setSnapshots] = useState<backend.Snapshot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newSnapName, setNewSnapName] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Diff comparison state
  const [diffingSnapshot, setDiffingSnapshot] = useState<backend.Snapshot | null>(null);
  const [diffItems, setDiffItems] = useState<DiffItem[]>([]);
  const [isDiffLoading, setIsDiffLoading] = useState(false);

  const loadSnapshots = async () => {
    setIsLoading(true);
    try {
      const data = await GetSnapshots() || [];
      setSnapshots(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSnapshots();
  }, []);

  const handleCreateSnapshot = async () => {
    if (!newSnapName.trim()) {
      alert("请输入快照名称！");
      return;
    }
    setIsLoading(true);
    try {
      await CreateSnapshot(newSnapName.trim());
      setNewSnapName("");
      setShowCreateForm(false);
      await loadSnapshots();
    } catch (e) {
      console.error(e);
      alert("创建快照失败: " + e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("确定删除此快照吗？")) return;
    setIsLoading(true);
    try {
      await DeleteSnapshot(id);
      await loadSnapshots();
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (id: string) => {
    if (!window.confirm("警告：恢复快照将彻底回滚当前系统的环境变量配置！确定继续吗？")) return;
    setIsLoading(true);
    try {
      await RestoreSnapshot(id);
      alert("快照恢复成功！环境变量已回滚至备份状态并广播生效。");
      setDiffingSnapshot(null);
      await loadSnapshots();
    } catch (e) {
      console.error(e);
      alert("快照恢复失败: " + e);
    } finally {
      setIsLoading(false);
    }
  };

  // Compare snapshot variables against current system variables
  const handleCompareDiff = async (snap: backend.Snapshot) => {
    setIsDiffLoading(true);
    // Show overlay immediately with loading state so user gets instant feedback
    setDiffItems([]);
    setDiffingSnapshot(snap);

    try {
      // 1. Refresh snapshot list from backend to get latest data
      let freshSnap = snap;
      try {
        const freshList = await GetSnapshots() || [];
        setSnapshots(freshList);
        const matched = freshList.find(s => s.id === snap.id);
        if (matched) freshSnap = matched;
      } catch (e) {
        console.warn('刷新快照列表失败，使用本地缓存:', e);
      }

      // 2. Fetch user and system variables independently so one failure doesn't block the other
      let currUser: backend.EnvVar[] = [];
      let currSys: backend.EnvVar[] = [];
      try {
        currUser = await GetVariables(false) || [];
      } catch (e) {
        console.warn('读取用户变量失败:', e);
      }
      try {
        currSys = await GetVariables(true) || [];
      } catch (e) {
        console.warn('读取系统变量失败（可能非管理员权限）:', e);
      }

      const items: DiffItem[] = [];

      const compareRegistry = (currVars: backend.EnvVar[], snapVars: backend.EnvVar[], isSystem: boolean) => {
        const currMap = new Map(currVars.map(v => [v.key.toLowerCase(), v]));
        const snapMap = new Map(snapVars.map(v => [v.key.toLowerCase(), v]));
        const allKeys = new Set([...currMap.keys(), ...snapMap.keys()]);

        allKeys.forEach(k => {
          const c = currMap.get(k);
          const s = snapMap.get(k);

          if (c && !s) {
            items.push({ key: c.key, type: 'added', isSystem, currVal: c.value, snapVal: '(无)' });
          } else if (!c && s) {
            items.push({ key: s.key, type: 'removed', isSystem, currVal: '(无)', snapVal: s.value });
          } else if (c && s) {
            if (c.value !== s.value) {
              items.push({ key: s.key, type: 'modified', isSystem, currVal: c.value, snapVal: s.value });
            } else {
              items.push({ key: s.key, type: 'unchanged', isSystem, currVal: c.value, snapVal: s.value });
            }
          }
        });
      };

      compareRegistry(currUser, freshSnap.userVars || [], false);
      compareRegistry(currSys, freshSnap.sysVars || [], true);

      setDiffItems(items.sort((a, b) => a.key.localeCompare(b.key)));
      setDiffingSnapshot(freshSnap);
    } catch (e) {
      console.error('对比差异出错:', e);
      alert('对比失败: ' + e);
      setDiffingSnapshot(null);
    } finally {
      setIsDiffLoading(false);
    }
  };

  // Render diff overlay via Portal to avoid any CSS stacking context issues
  const renderDiffOverlay = () => {
    if (!diffingSnapshot) return null;
    return createPortal(
      <div
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}
        className="flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      >
        <div className="bg-white dark:bg-slate-900 w-full max-w-7xl relative rounded-2xl shadow-2xl flex flex-col max-h-[93vh] overflow-hidden border-2 border-indigo-300 dark:border-indigo-700">
          <div className="flex items-center justify-between px-6 py-5 border-b-2 border-indigo-200 dark:border-indigo-800 bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/40 dark:to-violet-950/40">
            <div>
              <h4 className="font-black text-xl flex items-center gap-3">
                <div className="p-2 bg-indigo-500 rounded-lg shadow-md">
                  <ArrowLeftRight className="h-5 w-5 text-white" />
                </div>
                <span>快照对比差异</span>
                <span className="text-indigo-500 dark:text-indigo-400">—</span>
                <span className="text-indigo-600 dark:text-indigo-300">{diffingSnapshot.name}</span>
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 ml-12">
                当前系统变量 vs 快照备份值 · 恢复将完全还原为右侧数据
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setDiffingSnapshot(null)} className="text-slate-500 hover:text-slate-900 hover:bg-slate-200 dark:hover:bg-slate-700 px-4 py-2 text-sm font-semibold">✕ 关闭</Button>
          </div>

          {/* Loading indicator */}
          {isDiffLoading && (
            <div className="flex items-center justify-center gap-3 py-4 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-800">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">正在读取当前系统环境变量并计算差异...</span>
            </div>
          )}

          {/* Legend bar */}
          <div className="flex items-center gap-5 px-6 py-2.5 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-200 dark:bg-red-900/40 border border-red-300 dark:border-red-800"></span> 新增（将删除）</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-200 dark:bg-green-900/40 border border-green-300 dark:border-green-800"></span> 移除（将恢复）</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-200 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-800"></span> 修改（将更改）</span>
          </div>

          {/* Diff content list */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="border-2 border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-md">
              <div className="grid grid-cols-12 gap-3 bg-slate-800 dark:bg-slate-950 p-4 border-b-2 border-slate-300 dark:border-slate-700 font-bold text-sm text-white">
                <div className="col-span-1">层级</div>
                <div className="col-span-3">变量名</div>
                <div className="col-span-4 flex items-center gap-1.5">📍 当前系统值</div>
                <div className="col-span-4 flex items-center gap-1.5">📦 快照备份值</div>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {diffItems.filter(item => item.type !== 'unchanged').map((item, idx) => {
                  const isAdded = item.type === 'added';
                  const isRemoved = item.type === 'removed';
                  const isMod = item.type === 'modified';
                  
                  return (
                    <div key={idx} className={`grid grid-cols-12 gap-3 p-4 text-sm font-mono items-start transition-colors ${
                      isAdded ? 'bg-red-50/60 dark:bg-red-950/20 hover:bg-red-100/80 dark:hover:bg-red-950/30' : 
                      isRemoved ? 'bg-green-50/60 dark:bg-green-950/20 hover:bg-green-100/80 dark:hover:bg-green-950/30' : 
                      'bg-amber-50/60 dark:bg-amber-950/20 hover:bg-amber-100/80 dark:hover:bg-amber-950/30'
                    }`}>
                      <div className="col-span-1">
                        <span className={`px-2 py-1 rounded-md text-[11px] font-black uppercase tracking-wide ${item.isSystem ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'}`}>
                          {item.isSystem ? "系统" : "用户"}
                        </span>
                      </div>
                      <div className="col-span-3 font-black text-sm break-all flex items-center gap-2">
                        <span className="text-slate-900 dark:text-slate-100">{item.key}</span>
                        {isAdded && <span className="text-[10px] px-2 py-0.5 bg-red-200 text-red-800 dark:bg-red-900/40 dark:text-red-300 rounded-md font-black uppercase tracking-wide border border-red-300 dark:border-red-800">将删除</span>}
                        {isRemoved && <span className="text-[10px] px-2 py-0.5 bg-green-200 text-green-800 dark:bg-green-900/40 dark:text-green-300 rounded-md font-black uppercase tracking-wide border border-green-300 dark:border-green-800">将恢复</span>}
                        {isMod && <span className="text-[10px] px-2 py-0.5 bg-amber-200 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 rounded-md font-black uppercase tracking-wide border border-amber-300 dark:border-amber-800">将更改</span>}
                      </div>
                      <div className={`col-span-4 break-all ${isAdded ? 'text-red-700 dark:text-red-400 font-bold' : 'text-slate-900 dark:text-slate-100'}`}>
                        <DiffValue
                          value={item.currVal}
                          compareValue={isMod ? item.snapVal : undefined}
                          colorClass={isAdded ? 'text-red-700 dark:text-red-400 font-bold' : 'text-slate-900 dark:text-slate-100'}
                        />
                      </div>
                      <div className={`col-span-4 break-all ${isRemoved ? 'text-green-700 dark:text-green-400 font-bold' : 'text-slate-900 dark:text-slate-100'}`}>
                        <DiffValue
                          value={item.snapVal}
                          compareValue={isMod ? item.currVal : undefined}
                          colorClass={isRemoved ? 'text-green-700 dark:text-green-400 font-bold' : 'text-slate-900 dark:text-slate-100'}
                        />
                      </div>
                    </div>
                  );
                })}
                {!isDiffLoading && diffItems.filter(item => item.type !== 'unchanged').length === 0 && (
                  <div className="p-12 text-center">
                    <CheckCircle className="h-10 w-10 text-green-400 mx-auto mb-3" />
                    <p className="text-slate-600 dark:text-slate-300 font-bold text-sm">当前配置与快照备份完全一致</p>
                    <p className="text-slate-400 text-xs mt-1">无任何变化</p>
                  </div>
                )}
                {isDiffLoading && diffItems.length === 0 && (
                  <div className="p-12 text-center">
                    <Loader2 className="h-8 w-8 text-indigo-400 animate-spin mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">正在加载差异数据...</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t-2 border-indigo-200 dark:border-indigo-800 bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/40 dark:to-violet-950/40 flex justify-between items-center shrink-0">
            <span className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2 font-medium">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              点击「确认回滚」将重写注册表以恢复此快照的状态
            </span>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setDiffingSnapshot(null)} className="px-5 py-2 font-semibold">取消</Button>
              <Button onClick={() => handleRestore(diffingSnapshot.id)} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white border-0 shadow-lg px-6 py-2.5 font-bold text-sm">
                <Undo className="h-4 w-4" />
                确认回滚恢复
              </Button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  return (
    <div className="flex flex-col gap-5 h-full overflow-hidden">
      {/* Diff comparison overlay - rendered via Portal at document.body */}
      {renderDiffOverlay()}

      {/* Header section */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b-2 border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl shadow-lg">
            <Camera className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-50">系统快照备份与还原</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
              在进行软件安装、环境切换前备份环境配置，随时一键回滚到任意时间点
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {showCreateForm ? (
            <div className="flex gap-2 items-center bg-white dark:bg-slate-900 border-2 border-indigo-300 dark:border-indigo-700 p-2 rounded-xl shadow-lg">
              <Input
                placeholder="输入快照备注名称..."
                value={newSnapName}
                onChange={e => setNewSnapName(e.target.value)}
                className="h-9 text-sm font-medium w-52 border-slate-300 dark:border-slate-700"
                onKeyDown={e => e.key === 'Enter' && handleCreateSnapshot()}
              />
              <Button size="sm" onClick={handleCreateSnapshot} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4">保存</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowCreateForm(false)} className="text-slate-500 font-semibold">取消</Button>
            </div>
          ) : (
            <Button onClick={() => setShowCreateForm(true)} className="gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white border-0 shadow-lg px-5 py-2.5 font-bold text-sm transition-all hover:shadow-xl hover:scale-[1.02]">
              <Plus className="h-5 w-5" />
              创建新快照
            </Button>
          )}

          <Button variant="outline" size="sm" onClick={loadSnapshots} disabled={isLoading} className="h-10 w-10 p-0 border-2 hover:bg-slate-100 dark:hover:bg-slate-800" title="刷新快照列表">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Snapshots List Cards */}
      <div className="flex-1 overflow-y-auto">
        {snapshots.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-20 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 gap-4">
            <div className="p-5 bg-slate-100 dark:bg-slate-800 rounded-full">
              <Shield className="h-12 w-12 text-slate-400 dark:text-slate-500 stroke-[1.5]" />
            </div>
            <div className="text-center">
              <h4 className="font-black text-slate-900 dark:text-slate-100 text-lg">暂无备份快照</h4>
              <p className="text-sm text-slate-500 mt-2 max-w-sm font-medium">建议在配置新开发环境或安装软件前，点击「创建新快照」进行安全备份</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {snapshots.map((snap, index) => (
              <div 
                key={snap.id}
                className="flex flex-col gap-4 p-5 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl shadow-md hover:shadow-xl hover:border-indigo-300 dark:hover:border-indigo-700 transition-all relative group"
              >
                {/* Top: Name + Delete */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg border border-indigo-200 dark:border-indigo-800 shrink-0">
                      <Database className="h-5 w-5 text-indigo-500" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-black text-base text-slate-900 dark:text-slate-50 truncate block">{snap.name}</span>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 mt-1 font-medium">
                        <Clock className="h-3.5 w-3.5" />
                        {snap.timestamp}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(snap.id)}
                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg opacity-0 group-hover:opacity-100 transition-all shrink-0"
                    title="删除此备份"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Stats bar */}
                <div className="flex items-center gap-3 text-xs font-bold">
                  <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    <Shield className="h-3.5 w-3.5" />
                    用户层 {snap.userVars?.length || 0} 个
                  </span>
                  <span className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 rounded-lg border border-indigo-200 dark:border-indigo-800">
                    <Shield className="h-3.5 w-3.5" />
                    系统层 {snap.sysVars?.length || 0} 个
                  </span>
                </div>
                
                {/* Action buttons */}
                <div className="flex gap-3 pt-3 border-t-2 border-slate-100 dark:border-slate-800">
                  <Button
                    variant="outline"
                    onClick={() => handleCompareDiff(snap)}
                    className="flex-1 h-10 text-sm gap-2 font-bold border-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-700 dark:hover:text-indigo-300 transition-all"
                    title="对比当前系统与快照的差异"
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                    对比差异
                  </Button>
                  <Button
                    onClick={() => handleRestore(snap.id)}
                    className="flex-1 h-10 text-sm gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white border-0 font-bold shadow-md hover:shadow-lg transition-all hover:scale-[1.02]"
                    title="一键回滚到此快照的状态"
                  >
                    <Undo className="h-4 w-4" />
                    一键回滚
                    <ChevronRight className="h-3.5 w-3.5 opacity-70" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
