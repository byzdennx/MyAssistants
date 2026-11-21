// Ikon garis tipis (stroke 1.5) — dibuat sendiri, tanpa emoji.

const PATHS = {
  home: ['M4 11l8-6.5L20 11', 'M6 10v9.5h12V10', 'M10 19.5v-5h4v5'],
  chat: ['M4 5h16v11H9.5L5.5 19.5V16H4z'],
  code: ['M8.5 7L4 12l4.5 5', 'M15.5 7L20 12l-4.5 5', 'M13.5 5l-3 14'],
  user: ['M12 12a3.5 3.5 0 100-7 3.5 3.5 0 000 7z', 'M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5'],
  plus: ['M12 5v14M5 12h14'],
  trash: ['M5 7h14M9.5 7V4.5h5V7', 'M7 7l.8 12.5h8.4L17 7', 'M10.5 10.5v6M13.5 10.5v6'],
  copy: ['M8.5 8.5h10v11h-10z', 'M15.5 8.5v-3h-10v11h3'],
  download: ['M12 4v11M7.5 11L12 15.5 16.5 11M5 19.5h14'],
  upload: ['M12 15.5V4.5M7.5 9L12 4.5 16.5 9M5 19.5h14'],
  search: ['M10.5 17a6.5 6.5 0 100-13 6.5 6.5 0 000 13z', 'M15.5 15.5L20 20'],
  sidebar: ['M4 5h16v14H4z', 'M9.5 5v14'],
  refresh: ['M19 12a7 7 0 11-2.1-5', 'M19 4.5V8h-3.5'],
  send: ['M20 4L10.5 13.5', 'M20 4l-6 16-3.5-6.5L4 10z'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  x: ['M6 6l12 12M18 6L6 18'],
  globe: ['M12 21a9 9 0 100-18 9 9 0 000 18z', 'M3.5 12h17', 'M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.5-3.5-8.5S9.5 6 12 3.5z'],
  sliders: ['M5 7h9M18 7h1M5 17h1M10 17h9', 'M16 5v4M8 15v4'],
  'chevron-down': ['M6 9.5l6 6 6-6'],
  'arrow-right': ['M4 12h15M13.5 6.5L19 12l-5.5 5.5'],
  eye: ['M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z', 'M12 14.8a2.8 2.8 0 100-5.6 2.8 2.8 0 000 5.6z'],
  'eye-off': ['M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z', 'M12 14.8a2.8 2.8 0 100-5.6 2.8 2.8 0 000 5.6z', 'M4 4l16 16'],
  file: ['M6 3.5h8l4 4v13H6z', 'M14 3.5v4h4'],
  folder: ['M3.5 6.5h6l2 2h9v10h-17z'],
  'folder-open': ['M3.5 18.5v-12h6l2 2h7v3', 'M3.5 18.5l2.5-7h15l-2.5 7z'],
  'file-plus': ['M6 3.5h8l4 4v13H6z', 'M14 3.5v4h4', 'M12 11v6M9 14h6'],
  pencil: ['M15 5l4 4L8.5 19.5H4.5v-4z', 'M13 7l4 4'],
  save: ['M5 4.5h11l3 3v12H5z', 'M8 4.5v5h7v-5', 'M8 19.5v-5.5h8v5.5'],
  'chevron-right': ['M9.5 6l6 6-6 6'],
  archive: ['M4 5h16v4H4z', 'M5.5 9v10.5h13V9', 'M10 13h4'],
  'wifi-off': ['M3 9.5C5 7.5 8.3 6 12 6s7 1.5 9 3.5', 'M6 13c1.6-1.4 3.6-2.2 6-2.2s4.4.8 6 2.2', 'M9.5 16.5c.7-.5 1.5-.8 2.5-.8s1.8.3 2.5.8', 'M4 4l16 16'],
};

export function Icon({ name, size = 16, strokeWidth = 1.5, className, ...rest }) {
  const d = PATHS[name] || [];
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...rest}
    >
      {d.map((p, i) => (
        <path key={i} d={p} />
      ))}
    </svg>
  );
}
