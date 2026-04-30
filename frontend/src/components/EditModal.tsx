import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { X } from "lucide-react";

export function EditModal({ 
  initData, 
  searchTerm = "",
  onClose, 
  onSave 
}: { 
  initData: {key: string, value: string, isNew: boolean}; 
  searchTerm?: string;
  onClose: () => void; 
  onSave: (k: string, v: string) => void; 
}) {
  const [key, setKey] = useState(initData.key);
  const [value, setValue] = useState(initData.value);

  const keyMatch = searchTerm && key.toLowerCase().includes(searchTerm.toLowerCase());
  const valueMatch = searchTerm && value.toLowerCase().includes(searchTerm.toLowerCase());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4">
      <div className="bg-white/60 dark:bg-black/60 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 border border-white/20 backdrop-blur-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-lg font-semibold tracking-tight">{initData.isNew ? "新建环境变量" : "编辑环境变量"}</h3>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4"/></Button>
        </div>
        <div className="p-6 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-foreground/80">变量名 (Variable Name)</label>
            <Input 
              value={key} 
              onChange={e => setKey(e.target.value)} 
              disabled={!initData.isNew} 
              autoFocus={initData.isNew} 
              placeholder="e.g. JAVA_HOME"
              className={keyMatch ? "ring-2 ring-blue-500/50 border-blue-500/50" : ""}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-foreground/80">变量值 (Variable Value)</label>
            <Input 
              value={value} 
              onChange={e => setValue(e.target.value)} 
              autoFocus={!initData.isNew} 
              placeholder="e.g. C:\Program Files\Java\jdk1.8.0_202"
              className={valueMatch ? "ring-2 ring-blue-500/50 border-blue-500/50" : ""}
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-white/10 bg-white/5 dark:bg-black/5 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} className="bg-background">取消</Button>
          <Button onClick={() => onSave(key, value)} disabled={!key || !value}>保存变更</Button>
        </div>
      </div>
    </div>
  );
}
