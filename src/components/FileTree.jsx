import { useMemo, useState } from 'react';
import { Icon } from './icons';
import { buildTree } from '../lib/files';
import { cx } from '../lib/utils';
import { useT } from '../lib/i18n';

// Tree view dari path file ("src/components/Button.jsx" → folder bertingkat).
// Folder bisa dilipat; garis panduan tipis menandai kedalaman.
export default function FileTree({ files, activePath, onSelect, onRename, onDelete, readOnly = false }) {
  const tree = useMemo(() => buildTree(files), [files]);
  const [closed, setClosed] = useState(() => new Set());

  const toggle = (path) =>
    setClosed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  return (
    <ul role="tree" className="py-1 text-[0.82rem]">
      {tree.children.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          depth={0}
          readOnly={readOnly}
          closed={closed}
          onToggle={toggle}
          activePath={activePath}
          onSelect={onSelect}
          onRename={onRename}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}

function TreeNode({ node, depth, closed, onToggle, activePath, onSelect, onRename, onDelete, readOnly }) {
  const t = useT();
  const indent = { paddingLeft: `${0.6 + depth * 0.95}rem` };

  if (node.type === 'folder') {
    const open = !closed.has(node.path);
    return (
      <li role="treeitem" aria-expanded={open}>
        <button
          type="button"
          onClick={() => onToggle(node.path)}
          className="flex w-full items-center gap-1.5 rounded-sm py-1 pr-2 text-left text-ink-soft transition-colors duration-200 hover:bg-ink/[0.05] hover:text-ink"
          style={indent}
        >
          <Icon name="chevron-right" size={12} className={cx('shrink-0 transition-transform duration-200', open && 'rotate-90')} />
          <Icon name={open ? 'folder-open' : 'folder'} size={14} className="shrink-0 text-gold-ink" />
          <span className="truncate font-mono text-[0.76rem]">{node.name}/</span>
        </button>
        {open && (
          <ul role="group" className="relative">
            <span
              aria-hidden="true"
              className="absolute bottom-1 top-0 border-l border-dotted border-rule-strong"
              style={{ left: `${1.05 + depth * 0.95}rem` }}
            />
            {node.children.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                readOnly={readOnly}
                closed={closed}
                onToggle={onToggle}
                activePath={activePath}
                onSelect={onSelect}
                onRename={onRename}
                onDelete={onDelete}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  const active = node.path === activePath;
  return (
    <li role="treeitem" aria-selected={active} className="group relative">
      <button
        type="button"
        onClick={() => onSelect(node.path)}
        title={node.path}
        className={cx(
          'flex w-full items-center gap-1.5 rounded-sm border-l-2 py-1 pr-14 text-left transition-colors duration-200',
          active ? 'border-terracotta bg-ink/[0.08] text-ink' : 'border-transparent text-ink-soft hover:bg-ink/[0.05] hover:text-ink',
        )}
        style={{ paddingLeft: `${0.6 + depth * 0.95 + 0.95}rem` }}
      >
        <Icon name="file" size={13} className="shrink-0 opacity-70" />
        <span className="truncate font-mono text-[0.76rem]">{node.name}</span>
      </button>
      {!readOnly && (
      <span className="absolute right-1 top-1/2 flex -translate-y-1/2 gap-0.5 opacity-100 md:opacity-0 md:focus-within:opacity-100 md:group-hover:opacity-100">
        <button type="button" className="icon-btn h-6 w-6" onClick={() => onRename(node.path)} aria-label={`${t('files.rename')}: ${node.path}`}>
          <Icon name="pencil" size={12} />
        </button>
        <button type="button" className="icon-btn h-6 w-6" onClick={() => onDelete(node.path)} aria-label={`${t('files.deleteFile')}: ${node.path}`}>
          <Icon name="trash" size={12} />
        </button>
      </span>
      )}
    </li>
  );
}
