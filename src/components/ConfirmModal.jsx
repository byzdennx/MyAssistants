import { createContext, useCallback, useContext, useState } from 'react';
import Modal from './Modal';
import { useT } from '../lib/i18n';
import { cx } from '../lib/utils';

// Konfirmasi bergaya surat: kertas krem, bingkai ganda, segel kecil.
// Untuk aksi berbahaya, user wajib mengetik kata (mis. "DELETE").
// Opsi `input: { label, defaultValue, placeholder, mono }` → modal jadi prompt dan
// resolve ke string yang diketik (atau null kalau batal). Pengganti window.prompt.
const ConfirmContext = createContext(() => Promise.resolve(false));

export function useConfirm() {
  return useContext(ConfirmContext);
}

export function usePrompt() {
  const confirm = useContext(ConfirmContext);
  return (opts) => confirm({ ...opts, input: opts.input || {} });
}

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);

  const confirm = useCallback(
    (opts) =>
      new Promise((resolve) => {
        setState({ opts, resolve });
      }),
    [],
  );

  const finish = (value) => {
    if (state?.opts.input) state.resolve(value === false ? null : value);
    else state?.resolve(value);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && <Letter key={state.opts.title} opts={state.opts} onResult={finish} />}
    </ConfirmContext.Provider>
  );
}

function Letter({ opts, onResult }) {
  const t = useT();
  const { title, body, confirmLabel, cancelLabel, requireText, input, tone = 'default' } = opts;
  const [typed, setTyped] = useState('');
  const [value, setValue] = useState(input?.defaultValue || '');
  const canConfirm = input ? value.trim().length > 0 : !requireText || typed === requireText;
  const submit = () => {
    if (canConfirm) onResult(input ? value.trim() : true);
  };
  const danger = tone === 'danger';
  const date = new Date().toLocaleDateString(t.lang === 'en' ? 'en-US' : 'id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <Modal open onClose={() => onResult(false)} labelledBy="letter-title" maxWidth="max-w-lg">
      <div className="letter px-8 pb-8 pt-9 sm:px-11">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">{t('letter.heading')}</p>
            <p className="mt-2 font-serif text-xs italic text-ink-faint">{date}</p>
          </div>
          <span
            aria-hidden="true"
            className={cx(
              'grid h-11 w-11 shrink-0 place-items-center rounded-full font-serif text-lg leading-none text-[#fff8ee] shadow-[0_0_0_3px_var(--letter),0_0_0_4px_var(--rule-strong)]',
              danger ? 'bg-[#a8532f]' : 'bg-sage-ink',
            )}
          >
            ✦
          </span>
        </div>

        <h2 id="letter-title" className="mt-7 font-display text-[2rem] italic leading-[1.1] letterpress">
          {title}
        </h2>
        {body && <p className="mt-3 text-sm leading-relaxed text-ink-soft">{body}</p>}

        {requireText && (
          <div className="mt-7">
            <label htmlFor="letter-input" className="eyebrow block">
              {t('danger.confirm.type', { word: requireText })}
            </label>
            <input
              id="letter-input"
              data-autofocus
              className="ruled-input mt-3"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault(); // cegah Enter yang sama mengaktifkan tombol pemicu setelah fokus kembali
                  submit();
                }
              }}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder={requireText}
            />
          </div>
        )}

        {input && (
          <div className="mt-7">
            <label htmlFor="letter-prompt" className="eyebrow block">
              {input.label}
            </label>
            <input
              id="letter-prompt"
              data-autofocus
              className="ruled-input mt-3 !tracking-normal"
              style={input.mono ? undefined : { fontFamily: 'Fraunces, Georgia, serif', fontSize: '1.15rem' }}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onFocus={(e) => {
                // pilih nama file tanpa ekstensi, seperti di file manager desktop
                const v = e.target.value;
                const dot = v.lastIndexOf('.');
                const slash = v.lastIndexOf('/');
                if (input.mono && dot > slash + 1) e.target.setSelectionRange(slash + 1, dot);
                else e.target.select();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault(); // cegah Enter yang sama mengaktifkan tombol pemicu setelah fokus kembali
                  submit();
                }
              }}
              autoComplete="off"
              spellCheck={false}
              placeholder={input.placeholder}
            />
          </div>
        )}

        {danger && <p className="mt-6 font-serif text-xs italic text-ink-faint">{t('letter.irreversible')}</p>}

        <div className="mt-8 flex flex-wrap justify-end gap-4">
          <button type="button" className="btn btn-line" onClick={() => onResult(false)}>
            {cancelLabel || t('common.cancel')}
          </button>
          <button
            type="button"
            data-autofocus={requireText || input ? undefined : ''}
            className={cx('btn', danger ? 'btn-terra' : 'btn-ink')}
            disabled={!canConfirm}
            onClick={submit}
          >
            {confirmLabel || t('common.ok')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
