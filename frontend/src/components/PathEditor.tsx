import { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { X, ArrowUp, ArrowDown, Plus, Trash2, FolderSearch, AlertTriangle, GripVertical, CheckSquare, Square, Sparkles } from "lucide-react";
import { CheckPathExists } from "../../wailsjs/go/backend/EnvManager";

export function PathEditor({ 
  initData, 
  searchTerm = "",
  onClose, 
  onSave 
}: { 
  initData: {key: string, value: string}; 
  searchTerm?: string;
  onClose: () => void; 
  onSave: (v: string) => void; 
}) {
  const [paths, setPaths] = useState<string[]>(() => initData.value.split(";").filter(Boolean));
  const [validities, setValidities] = useState<Record<string, boolean>>({});
  const [newPath, setNewPath] = useState("");
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  interface DuplicateInfo {
    index: number;
    originalIndex: number;
    path: string;
  }
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [duplicatesFound, setDuplicatesFound] = useState<DuplicateInfo[] | null>(null);
  const [pendingUniquePaths, setPendingUniquePaths] = useState<string[] | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);

  const checkAllPaths = async (currentPaths: string[]) => {
    try {
      const checks = await Promise.all(
        currentPaths.map(async p => {
          const exists = await CheckPathExists(p);
          return { [p]: exists };
        })
      );
      const merged = checks.reduce((acc, curr) => ({ ...acc, ...curr }), {});
      setValidities(merged);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    checkAllPaths(paths);
  }, [paths]);

  const toggleSelect = (idx: number) => {
    const next = new Set(selectedIndices);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setSelectedIndices(next);
  };

  const selectAll = () => {
    if (selectedIndices.size === paths.length) setSelectedIndices(new Set());
    else setSelectedIndices(new Set(paths.map((_, i) => i)));
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    if (!selectedIndices.has(index)) {
      setSelectedIndices(new Set([index]));
    }
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    // 移除 stopPropagation 让事件冒泡到父容器进行边缘滚动检测
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const performDrop = (targetIndex: number) => {
    const currentSelected = draggedIndex !== null && selectedIndices.size === 0
      ? new Set([draggedIndex])
      : selectedIndices;

    if (currentSelected.size === 0) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const movingItems = paths.filter((_, i) => currentSelected.has(i));
    const nonMovingItems = paths.filter((_, i) => !currentSelected.has(i));
    
    const targetItem = paths[targetIndex];
    let insertAt = nonMovingItems.indexOf(targetItem);
    
    if (insertAt === -1) {
       insertAt = 0;
       for (let i = 0; i < targetIndex; i++) {
         if (!currentSelected.has(i)) insertAt++;
       }
    }

    const newPaths = [...nonMovingItems];
    newPaths.splice(insertAt, 0, ...movingItems);
    
    setPaths(newPaths);
    
    const newSelected = new Set<number>();
    for (let i = 0; i < movingItems.length; i++) {
      newSelected.add(insertAt + i);
    }
    setSelectedIndices(newSelected);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    performDrop(targetIndex);
  };

  // 容器级别的拖放事件，兜底处理及自动滚动
  const handleContainerDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    
    // 自动滚动逻辑
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const rect = container.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const scrollThreshold = 80; // 离边界多远触发滚动
      const maxScrollSpeed = 20;
      
      if (y < scrollThreshold) {
        // 越靠近顶部滚动越快
        const speed = Math.max(2, maxScrollSpeed * (1 - y / scrollThreshold));
        container.scrollTop -= speed;
      } else if (y > rect.height - scrollThreshold) {
        // 越靠近底部滚动越快
        const bottomDist = rect.height - y;
        const speed = Math.max(2, maxScrollSpeed * (1 - bottomDist / scrollThreshold));
        container.scrollTop += speed;
      }
    }

    // 只有直接悬停在容器空白处，才将指示线放置末尾
    if (e.target === scrollContainerRef.current && paths.length > 0) {
      setDragOverIndex(paths.length - 1);
    }
  };

  const handleContainerDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.target === scrollContainerRef.current && paths.length > 0) {
      performDrop(paths.length - 1);
    }
  };

  const removePath = (idx: number) => {
    const newPaths = paths.filter((_, i) => i !== idx);
    setPaths(newPaths);
    
    // Update selection
    const next = new Set<number>();
    selectedIndices.forEach(i => {
      if (i < idx) next.add(i);
      else if (i > idx) next.add(i - 1);
    });
    setSelectedIndices(next);
  };

  const removeSelected = () => {
    if (selectedIndices.size === 0) return;
    if (!window.confirm(`确定要删除选中的 ${selectedIndices.size} 条路径吗？`)) return;
    const newPaths = paths.filter((_, i) => !selectedIndices.has(i));
    setPaths(newPaths);
    setSelectedIndices(new Set());
  };

  const removeDuplicates = () => {
    const uniquePaths: string[] = [];
    const seen = new Map<string, { path: string, index: number }>();
    const dupes: DuplicateInfo[] = [];
    
    for (let i = 0; i < paths.length; i++) {
      const p = paths[i];
      if (!p.trim()) continue;
      
      let normalized = p.trim().toLowerCase();
      if (normalized.endsWith('\\') || normalized.endsWith('/')) {
         normalized = normalized.slice(0, -1);
      }
      
      if (!seen.has(normalized)) {
        seen.set(normalized, { path: p.trim(), index: i });
        uniquePaths.push(p.trim());
      } else {
        const orig = seen.get(normalized)!;
        dupes.push({
          index: i,
          path: p.trim(),
          originalIndex: orig.index
        });
      }
    }
    
    if (dupes.length > 0) {
      setDuplicatesFound(dupes);
      setPendingUniquePaths(uniquePaths);
    } else {
      alert("当前没有发现重复的路径。");
    }
  };

  const confirmDeduplicate = () => {
    if (pendingUniquePaths) {
      setPaths(pendingUniquePaths);
      setSelectedIndices(new Set());
    }
    setDuplicatesFound(null);
    setPendingUniquePaths(null);
    setHighlightedIndex(null);
  };

  const cancelDeduplicate = () => {
    setDuplicatesFound(null);
    setPendingUniquePaths(null);
    setHighlightedIndex(null);
  };

  const scrollToRow = (index: number) => {
    setHighlightedIndex(index);
    const el = document.getElementById(`path-row-${index}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setTimeout(() => {
      setHighlightedIndex(prev => prev === index ? null : prev);
    }, 2000);
  };

  const updatePath = (idx: number, val: string) => {
    const newPaths = [...paths];
    newPaths[idx] = val;
    setPaths(newPaths);
  };

  const insertNew = () => {
    if (newPath.trim()) {
      setPaths([newPath.trim(), ...paths]);
      setNewPath('');
      // Shift selection
      const next = new Set<number>();
      selectedIndices.forEach(i => next.add(i + 1));
      setSelectedIndices(next);
    }
  }

  const handleSave = () => {
    onSave(paths.join(";"));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-4xl relative rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in slide-in-from-bottom-4 duration-300 border border-border">
        {/* 去重悬浮面板 */}
        {duplicatesFound && (
          <div className="absolute right-4 top-24 bottom-24 w-80 bg-background/95 backdrop-blur-xl border border-border shadow-2xl rounded-2xl z-20 flex flex-col overflow-hidden animate-in slide-in-from-right-8 fade-in duration-300">
            <div className="p-4 border-b border-border bg-purple-50/50 dark:bg-purple-900/10 flex justify-between items-center">
              <h4 className="font-bold text-sm text-foreground/90 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-600" />
                发现 {duplicatesFound.length} 条重复项
              </h4>
              <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={cancelDeduplicate}><X className="h-3 w-3" /></Button>
            </div>
            <div className="overflow-y-auto p-2 flex-1 flex flex-col gap-1.5 bg-muted/5">
              {duplicatesFound.map((dup, idx) => (
                <div 
                  key={idx} 
                  className="text-xs p-3 rounded-xl bg-card border border-border hover:border-purple-300/50 hover:bg-purple-50/30 dark:hover:bg-purple-900/20 cursor-pointer transition-all hover:shadow-sm"
                  onClick={() => scrollToRow(dup.index)}
                >
                  <div className="flex justify-between items-center text-muted-foreground mb-1.5 font-medium">
                    <span>重复项 (行 {dup.index + 1})</span>
                    <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground/70">原项: 行 {dup.originalIndex + 1}</span>
                  </div>
                  <div className="font-mono text-[11px] leading-relaxed break-all text-foreground/80" title={dup.path}>
                    {dup.path}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-border bg-muted/20 flex gap-3">
              <Button variant="outline" className="flex-1 h-9 shadow-sm" onClick={cancelDeduplicate}>取消</Button>
              <Button className="flex-1 h-9 bg-purple-600 hover:bg-purple-700 text-white shadow-sm" onClick={confirmDeduplicate}>一键清理</Button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-gradient-to-r from-muted/50 to-background">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 p-2.5 rounded-xl text-primary shadow-sm">
              <FolderSearch className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-black tracking-tight text-foreground/90">编辑 PATH 路径</h3>
              <p className="text-sm text-muted-foreground mt-0.5">支持拖拽排序和批量移动。勾选多条后拖动任一均可批量移动。</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full bg-muted/50 hover:bg-muted"><X className="h-4 w-4"/></Button>
        </div>
        
        <div className="p-4 flex gap-3 border-b border-border bg-muted/10 items-center">
          <div className="flex items-center gap-2 pr-2 border-r border-border mr-1">
             <Button variant="ghost" size="icon" onClick={selectAll} className="h-9 w-9 text-blue-500" title="全选/取消全选">
                {selectedIndices.size === paths.length && paths.length > 0 ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
             </Button>
             {selectedIndices.size > 0 && (
                <Button variant="ghost" size="icon" onClick={removeSelected} className="h-9 w-9 text-red-500 hover:bg-red-50" title="删除选中">
                   <Trash2 className="h-5 w-5" />
                </Button>
             )}
          </div>
          <Input 
            placeholder="输入新路径 (例如 C:\tools) 并回车..." 
            value={newPath} 
            onChange={e => setNewPath(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && insertNew()}
            className="shadow-sm font-mono text-sm h-11"
          />
          <Button variant="secondary" onClick={removeDuplicates} className="gap-2 shrink-0 h-11 px-4 shadow-sm border border-border group" title="移除所有重复的环境变量路径">
            <Sparkles className="h-4 w-4 text-purple-500 group-hover:text-purple-600 transition-colors" /> 一键去重
          </Button>
          <Button onClick={insertNew} disabled={!newPath.trim()} className="gap-2 shrink-0 h-11 px-6 shadow-sm">
            <Plus className="h-4 w-4" /> 添加路径
          </Button>
        </div>

        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-4 flex flex-col gap-0 bg-muted/5"
          onDragOver={handleContainerDragOver}
          onDrop={handleContainerDrop}
        >
          {paths.map((p, i) => {
            const isValid = validities[p];
            const hasEnv = p.includes('%');
            const showWarning = isValid === false && !hasEnv;
            const isSearchMatch = searchTerm && p.toLowerCase().includes(searchTerm.toLowerCase());
            const isSelected = selectedIndices.has(i);
            const isDragging = draggedIndex !== null && selectedIndices.has(i);
            const showDropIndicator = draggedIndex !== null && dragOverIndex === i && !selectedIndices.has(i);
            
            return (
              <div key={`path-${i}`} className="relative">
                {/* 插入位置指示线 */}
                {showDropIndicator && (
                  <div className="absolute -top-[2px] left-0 right-0 z-10 flex items-center pointer-events-none">
                    <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow-md -ml-1.5 shrink-0" />
                    <div className="flex-1 h-[3px] bg-blue-500 rounded-full shadow-sm" />
                    <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow-md -mr-1.5 shrink-0" />
                  </div>
                )}
                <div 
                  id={`path-row-${i}`}
                  draggable 
                  onDragStart={(e) => handleDragStart(e, i)}
                  onDragOver={(e) => handleDragOver(e, i)}
                  onDrop={(e) => handleDrop(e, i)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-2 p-2 my-1 rounded-xl transition-all shadow-sm group ${
                      isDragging ? 'opacity-30 scale-[0.98]' : 'opacity-100'
                  } ${
                      highlightedIndex === i ? 'ring-2 ring-purple-500 bg-purple-100 dark:bg-purple-900/40 shadow-lg' :
                      isSelected && !isDragging ? 'ring-2 ring-blue-500 border-transparent bg-blue-50/30 dark:bg-blue-900/20' : 
                      showWarning ? 'border border-destructive/40 bg-destructive/5' : 
                      isSearchMatch ? 'border border-blue-400 bg-blue-100 dark:bg-blue-900/40' : 
                      'border border-border bg-card'
                  }`}
                >
                  <div className="flex items-center gap-2 pr-3 border-r border-border shrink-0">
                    <div className={`text-sm font-mono w-5 text-right select-none ${showWarning ? 'text-destructive font-semibold' : isSearchMatch ? 'text-blue-950 dark:text-blue-100 font-medium' : 'text-muted-foreground'}`}>
                      {i + 1}
                    </div>
                    <div className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-primary transition-colors">
                      <GripVertical className="h-5 w-5" />
                    </div>
                    <div className="cursor-pointer" onClick={() => toggleSelect(i)}>
                      {isSelected ? <CheckSquare className="h-5 w-5 text-blue-600" /> : <Square className="h-5 w-5 text-muted-foreground/30" />}
                    </div>
                  </div>
                  
                  <div className="flex-1 flex items-center gap-3 pr-2 overflow-hidden">
                    <Input 
                      value={p} 
                      onChange={e => updatePath(i, e.target.value)} 
                      draggable={false}
                      onDragStart={(e) => e.stopPropagation()}
                      className={`h-10 font-mono text-sm border-0 focus-visible:ring-1 bg-transparent shadow-none w-full ${showWarning ? 'text-destructive font-semibold' : isSearchMatch ? 'text-blue-950 dark:text-blue-100 font-medium' : ''}`}
                      title={p}
                    />
                    {showWarning && (
                       <div className="flex items-center text-xs font-semibold text-destructive gap-1 shrink-0 bg-white/50 dark:bg-black/50 px-2 py-1 rounded-md border border-destructive/20 whitespace-nowrap">
                         <AlertTriangle className="h-3.5 w-3.5" />
                         无效
                       </div>
                    )}
                  </div>
                  
                  <div className="pl-3 border-l border-border flex items-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => removePath(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
          {/* 列表末尾的拖放目标区域 */}
          {draggedIndex !== null && (
            <div 
              className="h-16 rounded-xl border-2 border-dashed border-blue-300 dark:border-blue-700 bg-blue-50/30 dark:bg-blue-900/10 flex items-center justify-center text-sm text-blue-500 mt-1 transition-all"
              onDragOver={(e) => { e.preventDefault(); setDragOverIndex(paths.length); }}
              onDrop={(e) => { e.preventDefault(); performDrop(paths.length - 1); }}
            >
              拖放到末尾
            </div>
          )}
          {paths.length === 0 && <div className="text-center p-12 text-muted-foreground font-medium">尚未配置任何环境变量路径。</div>}
        </div>

        <div className="px-6 py-4 border-t border-border bg-muted/30 flex justify-between items-center shrink-0">
          <div className="text-sm text-muted-foreground">
             {selectedIndices.size > 0 && `已选中 ${selectedIndices.size} 个项目`}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="h-11 px-6 bg-background shadow-sm hover:bg-muted">取消</Button>
            <Button onClick={handleSave} className="h-11 px-8 shadow-sm">确认保存</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
