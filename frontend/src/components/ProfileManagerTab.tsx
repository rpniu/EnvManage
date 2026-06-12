import { useState, useEffect } from 'react';
import { Layers, Plus, Trash2, Edit, Save, X, ToggleLeft, ToggleRight, Sparkles, Check, Play, AlertCircle } from 'lucide-react';
import { GetProfiles, SaveProfile, DeleteProfile, ApplyProfile, DeactivateProfile } from "../../wailsjs/go/backend/DataManager";
import { GetVariables } from "../../wailsjs/go/backend/EnvManager";
import { backend } from "../../wailsjs/go/models";
import { Button } from './ui/button';
import { Input } from './ui/input';

export function ProfileManagerTab() {
  const [profiles, setProfiles] = useState<backend.Profile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingProfile, setEditingProfile] = useState<any | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  const loadProfiles = async () => {
    setIsLoading(true);
    try {
      const data = await GetProfiles() || [];
      setProfiles(data);
      if (data.length > 0 && !selectedProfileId) {
        setSelectedProfileId(data[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const handleApply = async (id: string) => {
    setIsLoading(true);
    try {
      await ApplyProfile(id);
      await loadProfiles();
      alert("环境切换成功！系统环境变量已更新并刷新。");
    } catch (e) {
      console.error(e);
      alert("切换环境失败: " + e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    setIsLoading(true);
    try {
      await DeactivateProfile(id);
      await loadProfiles();
      alert("开发环境已禁用，相关变量已清理。");
    } catch (e) {
      console.error(e);
      alert("禁用环境失败: " + e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("确认删除该开发环境配置吗？")) return;
    setIsLoading(true);
    try {
      await DeleteProfile(id);
      if (selectedProfileId === id) {
        setSelectedProfileId(null);
      }
      await loadProfiles();
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editingProfile) return;
    if (!editingProfile.name.trim()) {
      alert("环境名称不能为空！");
      return;
    }
    
    // Filter empty keys
    const validVars = (editingProfile.variables || []).filter((v: any) => v.key.trim() && v.value.trim());
    const finalProfile = {
      ...editingProfile,
      variables: validVars
    };

    setIsLoading(true);
    try {
      await SaveProfile(finalProfile as any);
      setEditingProfile(null);
      await loadProfiles();
    } catch (e) {
      console.error(e);
      alert("保存失败: " + e);
    } finally {
      setIsLoading(false);
    }
  };

  const startNewProfile = () => {
    setEditingProfile({
      id: "",
      name: "",
      desc: "",
      variables: [{ key: "", value: "", isSystem: false }],
      isActive: false
    });
  };

  const importCurrentEnv = async () => {
    if (!editingProfile) return;
    if (!window.confirm("这会加载当前电脑已配置的所有环境变量。确定导入吗？")) return;
    
    setIsLoading(true);
    try {
      const userVars = await GetVariables(false) || [];
      const sysVars = await GetVariables(true) || [];
      
      const combinedVars: backend.EnvVar[] = [
        ...userVars.map(v => ({ key: v.key, value: v.value, isSystem: false })),
        ...sysVars.map(v => ({ key: v.key, value: v.value, isSystem: true }))
      ] as any;

      setEditingProfile({
        ...editingProfile,
        variables: combinedVars
      });
    } catch (e) {
      console.error(e);
      alert("导入失败: " + e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddVarRow = () => {
    if (!editingProfile) return;
    setEditingProfile({
      ...editingProfile,
      variables: [
        ...(editingProfile.variables || []),
        { key: "", value: "", isSystem: false }
      ]
    });
  };

  const handleRemoveVarRow = (idx: number) => {
    if (!editingProfile) return;
    const vars = [...(editingProfile.variables || [])];
    vars.splice(idx, 1);
    setEditingProfile({
      ...editingProfile,
      variables: vars
    });
  };

  const handleVarChange = (idx: number, field: string, val: any) => {
    if (!editingProfile) return;
    const vars = [...(editingProfile.variables || [])];
    vars[idx] = {
      ...vars[idx],
      [field]: val
    };
    setEditingProfile({
      ...editingProfile,
      variables: vars
    });
  };

  const selectedProfile = profiles.find(p => p.id === selectedProfileId);

  return (
    <div className="flex gap-6 h-full overflow-hidden">
      {/* Profiles List Sidebar */}
      <div className="w-80 flex flex-col gap-4 border-r border-slate-200 dark:border-slate-800 pr-6 shrink-0 h-full overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">开发环境列表</h3>
          <Button size="sm" variant="outline" onClick={startNewProfile} className="gap-1 text-xs">
            <Plus className="h-3.5 w-3.5" />
            新建环境
          </Button>
        </div>

        {profiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 gap-2">
            <Layers className="h-6 w-6 stroke-[1.5]" />
            <span className="text-xs">暂无配置环境</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {profiles.map(p => (
              <div
                key={p.id}
                onClick={() => setSelectedProfileId(p.id)}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col gap-1.5 ${
                  p.id === selectedProfileId
                    ? 'border-slate-900 dark:border-slate-100 bg-slate-50 dark:bg-slate-900/60 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50/50 dark:hover:bg-slate-900/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm truncate max-w-[150px]">{p.name}</span>
                  {p.isActive && (
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-green-500 text-white font-bold animate-pulse">
                      已激活
                    </span>
                  )}
                </div>
                {p.desc && <p className="text-xs text-slate-400 truncate">{p.desc}</p>}
                <div className="text-[10px] text-slate-500 flex items-center justify-between mt-1 pt-1 border-t border-slate-100 dark:border-slate-900">
                  <span>共 {p.variables?.length || 0} 个变量</span>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingProfile(p);
                      }}
                      className="hover:text-blue-500 transition-colors"
                    >
                      编辑
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(p.id);
                      }}
                      className="hover:text-red-500 transition-colors"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Profile Detail/Edit Panel */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {editingProfile ? (
          /* Profile Editor View */
          <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/40">
              <h4 className="font-bold text-sm">
                {editingProfile.id ? "编辑开发环境" : "新建开发环境"}
              </h4>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={importCurrentEnv} className="gap-1 text-xs text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-900">
                  <Sparkles className="h-3.5 w-3.5" />
                  导入当前环境变量
                </Button>
                <Button variant="outline" size="sm" onClick={() => setEditingProfile(null)}>
                  取消
                </Button>
                <Button size="sm" onClick={handleSave}>
                  保存
                </Button>
              </div>
            </div>

            <div className="p-4 flex flex-col gap-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-500">环境名称</label>
                  <Input
                    placeholder="例如: Java 17 Backend, Go Dev"
                    value={editingProfile.name}
                    onChange={e => setEditingProfile({ ...editingProfile, name: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-500">描述信息</label>
                  <Input
                    placeholder="环境简介/描述"
                    value={editingProfile.desc}
                    onChange={e => setEditingProfile({ ...editingProfile, desc: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex-1 flex flex-col gap-2 min-h-[250px]">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-semibold text-slate-500">变量配置 (键值对)</span>
                  <Button size="sm" variant="ghost" onClick={handleAddVarRow} className="text-xs gap-1 text-blue-500">
                    <Plus className="h-3.5 w-3.5" />
                    添加变量行
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto flex flex-col gap-2">
                  {(editingProfile.variables || []).map((v: any, idx: number) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <Input
                        placeholder="变量名 (Key)"
                        value={v.key}
                        onChange={e => handleVarChange(idx, "key", e.target.value)}
                        className="font-mono text-sm w-1/3 shrink-0"
                      />
                      <Input
                        placeholder="变量值 (Value)"
                        value={v.value}
                        onChange={e => handleVarChange(idx, "value", e.target.value)}
                        className="font-mono text-sm flex-1"
                      />
                      <button
                        onClick={() => handleVarChange(idx, "isSystem", !v.isSystem)}
                        className={`px-2 py-1.5 rounded text-[10px] font-semibold transition-all shrink-0 border ${
                          v.isSystem
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-950/20 dark:border-indigo-900 dark:text-indigo-400'
                            : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800/20 dark:border-slate-800 dark:text-slate-400'
                        }`}
                        title={v.isSystem ? "切换为用户变量" : "切换为系统变量"}
                      >
                        {v.isSystem ? "系统变量" : "用户变量"}
                      </button>
                      <button
                        onClick={() => handleRemoveVarRow(idx)}
                        className="p-2 rounded text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  {(editingProfile.variables || []).length === 0 && (
                    <div className="text-center p-8 text-slate-400 text-xs">点击右上角“添加变量行”开始配置。</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : selectedProfile ? (
          /* Profile Detail View */
          <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-lg">{selectedProfile.name}</h4>
                {selectedProfile.desc && <p className="text-sm text-slate-500 mt-1">{selectedProfile.desc}</p>}
              </div>

              <div className="flex items-center gap-2">
                {selectedProfile.isActive ? (
                  <Button variant="outline" onClick={() => handleDeactivate(selectedProfile.id)} className="gap-1.5 text-amber-600 border-amber-200 hover:bg-amber-50">
                    <X className="h-4 w-4" />
                    禁用该环境
                  </Button>
                ) : (
                  <Button onClick={() => handleApply(selectedProfile.id)} className="gap-1.5">
                    <Play className="h-4 w-4 fill-white" />
                    切换为此环境
                  </Button>
                )}
                <Button variant="outline" onClick={() => setEditingProfile(selectedProfile)}>
                  编辑配置
                </Button>
              </div>
            </div>

            {/* Profile Variables List */}
            <div className="flex-1 overflow-y-auto p-5">
              <h5 className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wider">该环境包含的环境变量</h5>
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <div className="grid grid-cols-12 gap-4 bg-slate-50 dark:bg-slate-900/80 p-3 border-b border-slate-200 dark:border-slate-800 font-semibold text-xs text-slate-600 dark:text-slate-400 uppercase">
                  <div className="col-span-4">变量名 (Key)</div>
                  <div className="col-span-6">变量值 (Value)</div>
                  <div className="col-span-2 text-right">层级</div>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(selectedProfile.variables || []).map((v, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-4 p-3 text-sm items-center font-mono">
                      <div className="col-span-4 font-bold text-slate-900 dark:text-slate-100 truncate">{v.key}</div>
                      <div className="col-span-6 text-slate-600 dark:text-slate-400 break-all">{v.value}</div>
                      <div className="col-span-2 text-right">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${v.isSystem ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400' : 'bg-green-50 text-green-600 dark:bg-green-950/20 dark:text-green-400'}`}>
                          {v.isSystem ? "System" : "User"}
                        </span>
                      </div>
                    </div>
                  ))}
                  {(selectedProfile.variables || []).length === 0 && (
                    <div className="p-8 text-center text-slate-400 text-xs">该环境无任何变量配置。</div>
                  )}
                </div>
              </div>
            </div>

            {/* Safety switch warning */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 text-xs text-slate-500 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-slate-400 shrink-0" />
              <span>切换环境时，系统会自动在本地创建一份当前配置的快照备份。如果发生配置重合或缺失，可随时在“快照系统”中一键回滚。</span>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-sm text-slate-400 gap-2">
            <Layers className="h-8 w-8 stroke-[1.5]" />
            <span className="text-sm">选择左侧开发环境以查看详情</span>
          </div>
        )}
      </div>
    </div>
  );
}
