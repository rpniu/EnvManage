import { backend } from "../../wailsjs/go/models";
import { Edit, Trash2, FolderEdit } from "lucide-react";
import { Button } from "./ui/button";

export function VariableList({ 
  data, 
  searchTerm,
  onEdit, 
  onDelete 
}: { 
  data: backend.EnvVar[], 
  searchTerm: string,
  onEdit: (v: backend.EnvVar) => void, 
  onDelete: (k: string) => void 
}) {
  const highlightText = (text: string, highlight: string) => {
    if (!highlight.trim()) {
      return <span>{text}</span>;
    }
    const regex = new RegExp(`(${highlight})`, "gi");
    const parts = text.split(regex);
    return (
      <span>
        {parts.map((part, i) => 
          regex.test(part) ? (
            <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-100 px-0.5 rounded shadow-sm">
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  };

  if (!data || data.length === 0) {
    return <div className="text-center py-20 text-slate-400">未找到任何环境变量。</div>;
  }

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      <div className="grid grid-cols-12 gap-4 border-b border-slate-200 dark:border-slate-800 p-4 font-semibold text-slate-500 text-xs uppercase tracking-wider bg-slate-50/80 dark:bg-slate-900/80">
        <div className="col-span-3">变量名 (Key)</div>
        <div className="col-span-7">变量值 (Value)</div>
        <div className="col-span-2 text-right">操作</div>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {data.map((item, idx) => {
          const isMatch = searchTerm && (item.key.toLowerCase().includes(searchTerm.toLowerCase()) || item.value.toLowerCase().includes(searchTerm.toLowerCase()));
          return (
            <div key={idx} className={`grid grid-cols-12 gap-4 p-3.5 items-center transition-colors group ${isMatch ? 'bg-indigo-50/30 dark:bg-indigo-950/10' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/10'}`}>
              <div className="col-span-3 font-semibold text-sm truncate" title={item.key}>
                <span className={`px-2 py-0.5 rounded text-xs border font-mono ${isMatch ? 'bg-indigo-100/50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/20 dark:border-indigo-900 dark:text-indigo-400' : 'bg-slate-100 dark:bg-slate-850 text-slate-700 dark:text-slate-350 border-slate-200 dark:border-slate-800'}`}>
                  {highlightText(item.key, searchTerm)}
                </span>
              </div>
              <div 
                className="col-span-7 text-xs text-slate-600 dark:text-slate-400 truncate font-mono cursor-pointer p-2 rounded-lg bg-slate-50/50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850 shadow-none hover:bg-slate-100 dark:hover:bg-slate-850 transition-colors" 
                title={item.value}
                onClick={() => onEdit(item)}
              >
                {highlightText(item.value, searchTerm)}
              </div>
              <div className="col-span-2 flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400" onClick={() => onEdit(item)}>
                  {item.key.toLowerCase() === 'path' ? <FolderEdit className="h-4.5 w-4.5" /> : <Edit className="h-4.5 w-4.5" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-red-500" onClick={() => onDelete(item.key)}>
                  <Trash2 className="h-4.5 w-4.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

