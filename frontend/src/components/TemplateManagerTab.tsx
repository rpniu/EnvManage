import { useState, useEffect } from 'react';
import { Sparkles, Plus, Trash2, Check, HelpCircle, FolderOpen, Play, Save, ShieldAlert, User, ArrowRightLeft } from 'lucide-react';
import { GetTemplates, SaveTemplate, DeleteTemplate } from "../../wailsjs/go/backend/DataManager";
import { GetVariables, SetVariable, BroadcastChange } from "../../wailsjs/go/backend/EnvManager";
import { SelectDirectory } from "../../wailsjs/go/main/App";
import { backend } from "../../wailsjs/go/models";
import { Button } from './ui/button';
import { Input } from './ui/input';

export function TemplateManagerTab() {
  const [templates, setTemplates] = useState<backend.Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Form state for custom template variable configuration
  const [configuredVars, setConfiguredVars] = useState<backend.EnvVar[]>([]);
  const [enabledFlags, setEnabledFlags] = useState<boolean[]>([]);
  const [applyAsSystem, setApplyAsSystem] = useState(false);

  // Custom template creator state
  const [creatorTemplate, setCreatorTemplate] = useState<{name: string, desc: string} | null>(null);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const data = await GetTemplates() || [];
      setTemplates(data);
      if (data.length > 0 && !selectedTemplateId) {
        setSelectedTemplateId(data[0].id);
        setConfiguredVars(data[0].variables || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleSelectTemplate = (id: string) => {
    setSelectedTemplateId(id);
    const tmpl = templates.find(t => t.id === id);
    if (tmpl) {
      const vars = tmpl.variables || [];
      setConfiguredVars(vars);
      setEnabledFlags(vars.map(() => true));
    }
  };

  const handleBrowseFolder = async (idx: number) => {
    try {
      const selected = await SelectDirectory();
      if (selected) {
        const updated = [...configuredVars];
        updated[idx].value = selected;
        setConfiguredVars(updated);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleVarValueChange = (idx: number, val: string) => {
    const updated = [...configuredVars];
    updated[idx].value = val;
    setConfiguredVars(updated);
  };

  const handleVarKeyChange = (idx: number, val: string) => {
    const updated = [...configuredVars];
    updated[idx].key = val;
    setConfiguredVars(updated);
  };

  const handleAddVar = () => {
    setConfiguredVars([...configuredVars, { key: '', value: '', isSystem: false }]);
    setEnabledFlags([...enabledFlags, true]);
  };

  const handleRemoveVar = (idx: number) => {
    setConfiguredVars(configuredVars.filter((_, i) => i !== idx));
    setEnabledFlags(enabledFlags.filter((_, i) => i !== idx));
  };

  // Safe apply template: merges PATH variables to prevent breaking current PATH
  const handleApplyTemplate = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch current variables for the target layer
      const currentVars = await GetVariables(applyAsSystem) || [];
      const currentPathVar = currentVars.find(v => v.key.toLowerCase() === 'path');
      const currentPathStr = currentPathVar ? currentPathVar.value : "";
      const currentPaths = currentPathStr.split(";").filter(Boolean);

      // 2. Separate standard variables and PATH variables in configured template
      const standardVarsToSet: backend.EnvVar[] = [];
      const pathsToAppend: string[] = [];

      configuredVars.forEach((v, idx) => {
        if (!enabledFlags[idx]) return; // skip unchecked items
        if (v.key.toUpperCase() === 'PATH') {
          // Add paths to append (could be multiple separated by semicolon)
          const parts = v.value.split(";").filter(Boolean);
          pathsToAppend.push(...parts);
        } else {
          standardVarsToSet.push(v);
        }
      });

      // 3. Write standard variables to registry
      for (const v of standardVarsToSet) {
        await SetVariable(applyAsSystem, v.key, v.value);
      }

      // 4. Merge and write PATH variable if needed
      if (pathsToAppend.length > 0) {
        // Filter out paths already in the registry PATH (case-insensitive Windows check)
        const currentPathsLower = new Set(currentPaths.map(p => p.trim().toLowerCase().replace(/[\\/]+$/, "")));
        
        const uniqueAppends = pathsToAppend.filter(p => {
          const norm = p.trim().toLowerCase().replace(/[\\/]+$/, "");
          return !currentPathsLower.has(norm);
        });

        if (uniqueAppends.length > 0) {
          const newPathStr = [...currentPaths, ...uniqueAppends].join(";");
          await SetVariable(applyAsSystem, "Path", newPathStr);
        }
      }

      // 5. Broadcast changes
      await BroadcastChange();
      alert("环境变量模板应用成功！新开终端或程序将即刻生效。");
    } catch (e) {
      console.error(e);
      alert("应用模板失败: " + e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!window.confirm("确定删除这个自定义模板吗？")) return;
    setIsLoading(true);
    try {
      await DeleteTemplate(id);
      if (selectedTemplateId === id) {
        setSelectedTemplateId(null);
        setConfiguredVars([]);
      }
      await loadTemplates();
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  // Custom template creator functions
  const startCustomTemplate = () => {
    setCreatorTemplate({
      name: "",
      desc: ""
    });
  };

  const handleSaveCustomTemplate = async () => {
    if (!creatorTemplate || !creatorTemplate.name.trim()) {
      alert("请输入模板名称！");
      return;
    }

    setIsLoading(true);
    try {
      // Fetch current user variables to save as template
      const currentVars = await GetVariables(false) || [];
      // Select standard variables (skip PATH or simplify PATH to a default)
      const variables = currentVars.map(v => ({
        key: v.key,
        value: v.value,
        isSystem: false
      }));

      const newTmpl = {
        id: "",
        name: creatorTemplate.name.trim(),
        desc: creatorTemplate.desc.trim(),
        variables,
        isPreset: false
      };

      await SaveTemplate(newTmpl as any);
      setCreatorTemplate(null);
      await loadTemplates();
      alert("成功将当前环境保存为自定义模板！");
    } catch (e) {
      console.error(e);
      alert("保存模板失败: " + e);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  return (
    <div className="flex gap-6 h-full overflow-hidden">
      {/* Templates list sidebar */}
      <div className="w-80 flex flex-col gap-4 border-r border-slate-200 dark:border-slate-800 pr-6 shrink-0 h-full overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">开发环境模板</h3>
          <Button size="sm" variant="outline" onClick={startCustomTemplate} className="gap-1 text-xs">
            <Plus className="h-3.5 w-3.5" />
            保存当前环境
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          {/* Preset templates section */}
          <div className="text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-wider mb-1">
            内置开发预设
          </div>
          {templates.filter(t => t.isPreset).map(t => (
            <div
              key={t.id}
              onClick={() => handleSelectTemplate(t.id)}
              className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col gap-1 ${
                t.id === selectedTemplateId
                  ? 'border-slate-900 dark:border-slate-100 bg-slate-50 dark:bg-slate-900/60 shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50/50 dark:hover:bg-slate-900/20'
              }`}
            >
              <span className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">{t.name}</span>
              <p className="text-xs text-slate-400 truncate">{t.desc}</p>
            </div>
          ))}

          {/* User custom templates section */}
          <div className="text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-wider mt-4 mb-1">
            自定义模板
          </div>
          {templates.filter(t => !t.isPreset).map(t => (
            <div
              key={t.id}
              onClick={() => handleSelectTemplate(t.id)}
              className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col gap-1 group relative ${
                t.id === selectedTemplateId
                  ? 'border-slate-900 dark:border-slate-100 bg-slate-50 dark:bg-slate-900/60 shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50/50 dark:hover:bg-slate-900/20'
              }`}
            >
              <span className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate pr-6">{t.name}</span>
              <p className="text-xs text-slate-400 truncate pr-6">{t.desc || "无描述"}</p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteTemplate(t.id);
                }}
                className="absolute right-2 top-3 p-1 rounded text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                title="删除模板"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {templates.filter(t => !t.isPreset).length === 0 && (
            <div className="text-center p-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-xs">
              无自定义模板。可点击右上角将当前变量保存为模板。
            </div>
          )}
        </div>
      </div>

      {/* Main Template Work Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {creatorTemplate ? (
          /* Create Custom Template Modal-like layout */
          <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 justify-center max-w-lg mx-auto gap-4">
            <h4 className="font-bold text-lg text-slate-900 dark:text-slate-100">保存当前环境为模板</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              这会捕获您当前配置的所有环境变量（包括 PATH 中的内容），保存为一个模板包，方便随时给他人分享或在新电脑上一键部署。
            </p>
            
            <div className="flex flex-col gap-1.5 mt-2">
              <label className="text-xs font-semibold text-slate-500">模板名称</label>
              <Input
                placeholder="例如: My Go+Node Dev Settings"
                value={creatorTemplate.name}
                onChange={e => setCreatorTemplate({ ...creatorTemplate, name: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500">描述信息</label>
              <Input
                placeholder="模板的描述/简介"
                value={creatorTemplate.desc}
                onChange={e => setCreatorTemplate({ ...creatorTemplate, desc: e.target.value })}
              />
            </div>

            <div className="flex gap-3 mt-4">
              <Button variant="outline" className="flex-1" onClick={() => setCreatorTemplate(null)}>
                取消
              </Button>
              <Button className="flex-1" onClick={handleSaveCustomTemplate}>
                保存模板
              </Button>
            </div>
          </div>
        ) : selectedTemplate ? (
          /* Configure Preset Template View */
          <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-lg">{selectedTemplate.name}</h4>
                  <p className="text-sm text-slate-500 mt-1">{selectedTemplate.desc}</p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {/* Scope toggle badge */}
                  <button
                    type="button"
                    title="点击切换部署层级：用户级 / 系统级"
                    onClick={() => setApplyAsSystem(v => !v)}
                    className={`group flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all select-none cursor-pointer hover:scale-105 active:scale-95 hover:shadow-md ${
                      applyAsSystem
                        ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-400 dark:border-amber-600 text-amber-700 dark:text-amber-300 shadow-sm hover:border-amber-500'
                        : 'bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 shadow-sm hover:border-blue-400'
                    }`}
                  >
                    {applyAsSystem ? (
                      <>
                        <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                        <span>系统级 System</span>
                        <span className="text-[10px] font-medium opacity-70">(需管理员)</span>
                      </>
                    ) : (
                      <>
                        <User className="h-3.5 w-3.5 shrink-0" />
                        <span>用户级 User</span>
                      </>
                    )}
                    <span className="w-px h-3 bg-current opacity-25 shrink-0" />
                    <ArrowRightLeft className="h-3 w-3 shrink-0 opacity-40 group-hover:opacity-80 transition-opacity" />
                  </button>
                  <Button onClick={handleApplyTemplate} className="gap-1.5">
                    <Play className="h-4 w-4 fill-white" />
                    应用此模板
                  </Button>
                </div>
              </div>
            </div>

            {/* Variables and paths customizer */}
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  参数配置 (配置后自动合并)
                </h5>
                <Button size="sm" variant="outline" onClick={handleAddVar} className="gap-1 text-xs h-7">
                  <Plus className="h-3.5 w-3.5" />
                  添加变量
                </Button>
              </div>

              <div className="flex flex-col gap-4">
                {configuredVars.map((v, idx) => {
                  const isPath = v.key.toUpperCase() === 'PATH';
                  const isEnabled = enabledFlags[idx] !== false;
                  
                  return (
                    <div
                      key={idx}
                      className={`flex flex-col gap-1.5 p-3 rounded-xl border transition-opacity ${
                        isEnabled
                          ? 'border-slate-100 dark:border-slate-800/60 bg-slate-50/20 dark:bg-slate-900/10 opacity-100'
                          : 'border-slate-100 dark:border-slate-800/40 bg-slate-50/10 dark:bg-slate-900/5 opacity-50'
                      }`}
                    >
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={e => {
                              const next = [...enabledFlags];
                              next[idx] = e.target.checked;
                              setEnabledFlags(next);
                            }}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 shrink-0"
                          />
                          <Input
                            value={v.key}
                            onChange={e => handleVarKeyChange(idx, e.target.value)}
                            className={`font-mono font-bold text-xs h-7 px-2 ${isEnabled ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-600 line-through'}`}
                            disabled={!isEnabled}
                            placeholder="变量名 (如 JAVA_HOME)"
                          />
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {!isEnabled && (
                            <span className="text-[10px] text-slate-400 dark:text-slate-600 font-medium">跳过部署</span>
                          )}
                          {isPath && (
                            <span className="text-[10px] bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400 px-2 py-0.5 rounded font-semibold">
                              PATH 附项
                            </span>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveVar(idx)}
                            className="h-7 w-7 text-slate-400 hover:text-red-500 shrink-0"
                            title="删除此项"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex gap-2 mt-1">
                        <Input
                          value={v.value}
                          onChange={e => handleVarValueChange(idx, e.target.value)}
                          className="font-mono text-sm"
                          disabled={!isEnabled}
                          placeholder={isPath ? "例如: %GOROOT%\\bin" : "键入对应的具体路径"}
                        />
                        {/* Only show folder selection dialog button for absolute-like folder paths in templates */}
                        {!v.value.startsWith('%') && (
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleBrowseFolder(idx)}
                            className="shrink-0"
                            disabled={!isEnabled}
                            title="选择本地目录"
                          >
                            <FolderOpen className="h-4 w-4 text-slate-500" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer tips */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 text-xs text-slate-500 flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-slate-400 shrink-0" />
              <span>智能合并算法：应用模板时，模板里的 PATH 路径会合并追随于您系统现有的 PATH 变量后，而不会覆盖替换，确保已有的软件环境配置不会丢失。</span>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-sm text-slate-400 gap-2">
            <Sparkles className="h-8 w-8 stroke-[1.5]" />
            <span className="text-sm">选择左侧模板以配置变量</span>
          </div>
        )}
      </div>
    </div>
  );
}
