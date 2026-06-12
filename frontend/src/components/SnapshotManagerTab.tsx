import { useState, useEffect } from 'react';
import { Shield, Plus, Trash2, ArrowLeftRight, CheckCircle, RefreshCw, Undo, AlertCircle } from 'lucide-react';
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
    setIsLoading(true);
    try {
      const currUser = await GetVariables(false) || [];
      const currSys = await GetVariables(true) || [];

      const items: DiffItem[] = [];

      const compareRegistry = (currVars: backend.EnvVar[], snapVars: backend.EnvVar[], isSystem: boolean) => {
        const currMap = new Map(currVars.map(v => [v.key.toLowerCase(), v]));
        const snapMap = new Map(snapVars.map(v => [v.key.toLowerCase(), v]));
        const allKeys = new Set([...currMap.keys(), ...snapMap.keys()]);

        allKeys.forEach(k => {
          const c = currMap.get(k);
          const s = snapMap.get(k);

          if (c && !s) {
            // Variable is added in current system, not in snapshot
            items.push({
              key: c.key,
              type: 'added',
              isSystem,
              currVal: c.value,
              snapVal: '(无)'
            });
          } else if (!c && s) {
            // Variable was in snapshot, removed in current system
            items.push({
              key: s.key,
              type: 'removed',
              isSystem,
              currVal: '(无)',
              snapVal: s.value
            });
          } else if (c && s) {
            if (c.value !== s.value) {
              items.push({
                key: s.key,
                type: 'modified',
                isSystem,
                currVal: c.value,
                snapVal: s.value
              });
            } else {
              items.push({
                key: s.key,
                type: 'unchanged',
                isSystem,
                currVal: c.value,
                snapVal: s.value
              });
            }
          }
        });
      };

      compareRegistry(currUser, snap.userVars || [], false);
      compareRegistry(currSys, snap.sysVars || [], true);

      setDiffItems(items.sort((a, b) => a.key.localeCompare(b.key)));
      setDiffingSnapshot(snap);
    } catch (e) {
      console.error(e);
      alert("对比失败: " + e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full overflow-hidden">
      {/* Diff comparison overlay */}
      {diffingSnapshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-7xl relative rounded-2xl shadow-2xl flex flex-col max-h-[93vh] overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
              <div>
                <h4 className="font-bold text-lg flex items-center gap-2">
                  <ArrowLeftRight className="h-5 w-5 text-indigo-500" />
                  快照对比差异: {diffingSnapshot.name}
                </h4>
                <p className="text-sm text-slate-500 mt-1">
                  对比项：当前系统变量 vs 快照配置。恢复此快照会将配置完全还原成右侧数据。
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setDiffingSnapshot(null)}>关闭</Button>
            </div>

            {/* Diff content list */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <div className="grid grid-cols-12 gap-3 bg-slate-50 dark:bg-slate-900/80 p-3.5 border-b border-slate-200 dark:border-slate-800 font-semibold text-sm text-slate-700 dark:text-slate-200">
                  <div className="col-span-1">层级</div>
                  <div className="col-span-3">变量名</div>
                  <div className="col-span-4">当前系统值 (Registry)</div>
                  <div className="col-span-4">快照备份值 (Snapshot)</div>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {diffItems.filter(item => item.type !== 'unchanged').map((item, idx) => {
                    const isAdded = item.type === 'added';
                    const isRemoved = item.type === 'removed';
                    const isMod = item.type === 'modified';
                    
                    return (
                      <div key={idx} className={`grid grid-cols-12 gap-3 p-3.5 text-sm font-mono items-start ${
                        isAdded ? 'bg-red-50/30 dark:bg-red-950/10' : 
                        isRemoved ? 'bg-green-50/30 dark:bg-green-950/10' : 
                        'bg-amber-50/30 dark:bg-amber-950/10'
                      }`}>
                        <div className="col-span-1">
                          <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${item.isSystem ? 'bg-indigo-50 text-indigo-600' : 'bg-green-50 text-green-600'}`}>
                            {item.isSystem ? "系统" : "用户"}
                          </span>
                        </div>
                        <div className="col-span-3 font-bold break-all flex items-center gap-1.5">
                          {item.key}
                          {isAdded && <span className="text-[11px] px-1.5 bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400 rounded font-semibold">将删除</span>}
                          {isRemoved && <span className="text-[11px] px-1.5 bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 rounded font-semibold">将恢复</span>}
                          {isMod && <span className="text-[11px] px-1.5 bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 rounded font-semibold">将更改</span>}
                        </div>
                        <div className={`col-span-4 break-all ${isAdded ? 'text-red-700 dark:text-red-400 font-semibold' : 'text-slate-900 dark:text-slate-100'}`}>
                          <DiffValue
                            value={item.currVal}
                            compareValue={isMod ? item.snapVal : undefined}
                            colorClass={isAdded ? 'text-red-700 dark:text-red-400 font-semibold' : 'text-slate-900 dark:text-slate-100'}
                          />
                        </div>
                        <div className={`col-span-4 break-all ${isRemoved ? 'text-green-700 dark:text-green-400 font-semibold' : 'text-slate-900 dark:text-slate-100'}`}>
                          <DiffValue
                            value={item.snapVal}
                            compareValue={isMod ? item.currVal : undefined}
                            colorClass={isRemoved ? 'text-green-700 dark:text-green-400 font-semibold' : 'text-slate-900 dark:text-slate-100'}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {diffItems.filter(item => item.type !== 'unchanged').length === 0 && (
                    <div className="p-8 text-center text-slate-400 text-xs">当前配置与快照备份完全一致，无任何变化。</div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 flex justify-between items-center shrink-0">
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <AlertCircle className="h-4 w-4 text-slate-400" />
                点击“确认回滚”将重写注册表以恢复此快照的状态。
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setDiffingSnapshot(null)}>取消</Button>
                <Button onClick={() => handleRestore(diffingSnapshot.id)} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white border-0 shadow-md">
                  <Undo className="h-4 w-4" />
                  确认回滚恢复
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header section */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">系统快照备份与还原</h2>
          <p className="text-sm text-slate-500 mt-1">
            在进行软件安装、环境切换前备份环境配置，方便随时一键回滚。
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {showCreateForm ? (
            <div className="flex gap-2 items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 rounded-lg">
              <Input
                placeholder="快照备注名称..."
                value={newSnapName}
                onChange={e => setNewSnapName(e.target.value)}
                className="h-8 text-xs font-medium w-48"
              />
              <Button size="sm" onClick={handleCreateSnapshot}>保存</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowCreateForm(false)}>取消</Button>
            </div>
          ) : (
            <Button onClick={() => setShowCreateForm(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              创建快照
            </Button>
          )}

          <Button variant="outline" size="sm" onClick={loadSnapshots} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Snapshots List Cards */}
      <div className="flex-1 overflow-y-auto">
        {snapshots.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 gap-3 text-slate-400">
            <Shield className="h-8 w-8 stroke-[1.5]" />
            <div className="text-center">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">暂无备份快照</h4>
              <p className="text-xs text-slate-500 mt-1">建议在配置新开发环境前点击“创建快照”进行安全备份。</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {snapshots.map(snap => (
              <div 
                key={snap.id}
                className="flex flex-col gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm hover:shadow-md transition-shadow relative group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate pr-6">{snap.name}</span>
                  <button
                    onClick={() => handleDelete(snap.id)}
                    className="p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="删除此备份"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="text-xs text-slate-400">
                  备份时间: {snap.timestamp}
                </div>
                
                <div className="text-xs text-slate-500 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-850 mt-1">
                  <span>用户层 {snap.userVars?.length || 0} 个 | 系统层 {snap.sysVars?.length || 0} 个</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleCompareDiff(snap)} className="h-7 text-[10px] gap-1 px-2.5">
                      <ArrowLeftRight className="h-3 w-3" />
                      对比差异
                    </Button>
                    <Button size="sm" onClick={() => handleRestore(snap.id)} className="h-7 text-[10px] gap-1 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white border-0">
                      <Undo className="h-3 w-3" />
                      一键回滚
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
