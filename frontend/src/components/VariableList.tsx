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
    return <div className="text-center py-20 text-muted-foreground">未找到任何环境变量。</div>;
  }

  return (
    <div className="flex flex-col rounded-xl border border-white/20 dark:border-white/10 bg-white/40 dark:bg-black/40 backdrop-blur-md shadow-lg overflow-hidden">
      <div className="grid grid-cols-12 gap-4 border-b border-white/20 dark:border-white/10 p-4 font-semibold text-foreground/80 text-sm uppercase tracking-wider bg-white/20 dark:bg-black/20">
        <div className="col-span-3">变量名</div>
        <div className="col-span-7">变量值 (单击查看完整内容/编辑)</div>
        <div className="col-span-2 text-right">操作</div>
      </div>
      <div className="divide-y divide-white/20 dark:divide-white/10">
        {data.map((item, idx) => {
          const isMatch = searchTerm && (item.key.toLowerCase().includes(searchTerm.toLowerCase()) || item.value.toLowerCase().includes(searchTerm.toLowerCase()));
          return (
            <div key={idx} className={`grid grid-cols-12 gap-4 p-4 items-center transition-colors group ${isMatch ? 'bg-blue-500/10 dark:bg-blue-400/20' : 'hover:bg-white/10 dark:hover:bg-white/5'}`}>
              <div className="col-span-3 font-medium text-sm truncate" title={item.key}>
                <span className={`px-2 py-0.5 rounded text-xs border ${isMatch ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800' : 'bg-primary/10 text-primary border-primary/20'}`}>
                  {highlightText(item.key, searchTerm)}
                </span>
              </div>
              <div 
                className="col-span-7 text-sm text-foreground/90 truncate font-mono cursor-pointer p-2 rounded-lg bg-white/20 dark:bg-black/20 backdrop-blur-md border border-white/30 dark:border-white/10 shadow-sm hover:bg-white/30 dark:hover:bg-black/30 transition-all" 
                title={item.value}
                onClick={() => onEdit(item)}
              >
                {highlightText(item.value, searchTerm)}
              </div>
              <div className="col-span-2 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/40" onClick={() => onEdit(item)}>
                  {item.key.toLowerCase() === 'path' ? <FolderEdit className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/40" onClick={() => onDelete(item.key)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
