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
    <div className="flex flex-col rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md overflow-hidden">
      <div className="grid grid-cols-12 gap-4 border-b-2 border-slate-200 dark:border-slate-800 px-5 py-4 font-bold text-slate-600 dark:text-slate-300 text-sm uppercase tracking-wider bg-slate-100/80 dark:bg-slate-900/80">
        <div className="col-span-3">变量名 (Key)</div>
        <div className="col-span-7">变量值 (Value)</div>
        <div className="col-span-2 text-right">操作</div>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {data.map((item, idx) => {
          const isMatch = searchTerm && (item.key.toLowerCase().includes(searchTerm.toLowerCase()) || item.value.toLowerCase().includes(searchTerm.toLowerCase()));
          return (
            <div key={idx} className={`grid grid-cols-12 gap-4 px-5 py-4 items-center transition-colors group ${isMatch ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/20'}`}>
              <div className="col-span-3 font-bold text-base truncate" title={item.key}>
                <span className={`px-3 py-1.5 rounded-lg text-sm border-2 font-mono font-bold ${isMatch ? 'bg-indigo-100/70 border-indigo-300 text-indigo-800 dark:bg-indigo-900/30 dark:border-indigo-700 dark:text-indigo-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700'}`}>
                  {highlightText(item.key, searchTerm)}
                </span>
              </div>
              <div 
                className="col-span-7 text-sm text-slate-700 dark:text-slate-300 truncate font-mono cursor-pointer px-4 py-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border-2 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition-all" 
                title={item.value}
                onClick={() => onEdit(item)}
              >
                {highlightText(item.value, searchTerm)}
              </div>
              <div className="col-span-2 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30" onClick={() => onEdit(item)} title="编辑此变量">
                  {item.key.toLowerCase() === 'path' ? <FolderEdit className="h-5 w-5" /> : <Edit className="h-5 w-5" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => onDelete(item.key)} title="删除此变量">
                  <Trash2 className="h-5 w-5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

