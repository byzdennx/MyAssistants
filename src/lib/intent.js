// Penjaga mode: Chat tidak boleh bikin code, Coder tidak untuk ngobrol santai.

const CODE_NOUN =
  /\b(code|kode|kodingan|coding|ngoding|script|skrip|program|website|web ?app|webapp|web|situs|aplikasi|app|html|css|javascript|typescript|js|ts|jsx|tsx|react|vue|svelte|next\.?js|tailwind|python|php|java|kotlin|swift|golang|rust|node\.?js|express|api|endpoint|function|fungsi|komponen|component|landing ?page|query|sql|database|regex|algoritma|algorithm|bot (?:discord|telegram|wa|whatsapp))\b/i;

const REQUEST_VERB =
  /\b(buat(?:kan|in)?|bikin(?:in|kan)?|tulis(?:kan)?|generate|kodein|ngodein|codein|create|write|make|build|implement(?:asi)?|coding(?:kan)?|ajarin|ajari|tolong (?:buat|bikin)|bantu(?:in)? (?:buat|bikin|coding)|minta (?:code|kode|script))\b/i;

const TUTORIAL = /\b(tutorial|belajar|cara|how to|gimana (?:cara )?(?:bikin|buat|coding))\b.*\b(coding|ngoding|programming|html|css|javascript|react|python|php|website|web|api|tailwind)\b/i;

const DEBUG = /\b(error|bug|debug|fix|perbaiki|benerin|betulin|kenapa .* error)\b/i;

export function wantsCode(text) {
  const t = String(text || '');
  if (/```/.test(t)) return true;
  if (REQUEST_VERB.test(t) && CODE_NOUN.test(t)) return true;
  if (TUTORIAL.test(t)) return true;
  if (DEBUG.test(t) && CODE_NOUN.test(t)) return true;
  return false;
}

// Sapaan & ucapan terima kasih: hanya dialihkan kalau belum ada percakapan.
const GREETING =
  /^\W*(halo|hai|hi|hello|hey|hei|pagi|siang|sore|malam|selamat (?:pagi|siang|sore|malam)|makasih|terima kasih|thanks|thank you|good morning|good night)\b/i;

// Obrolan jelas non-coding: dialihkan kapan pun.
const CHITCHAT =
  /\b(apa kabar|lagi apa|lagi ngapain|curhat|capek banget|bosan|bosen|sedih|galau|kangen|cerita(?:in)? (?:dong|aja)|ngobrol|lucu|joke|candaan|tebak-tebakan|siapa kamu|kamu siapa|nama kamu|how are you|what's up|wassup|bete)\b/i;

const CODE_SIGNS = /[{}();<>=\[\]]|=>|\bnpm\b|\bgit\b|\bdocker\b|\bvite\b/;

export function isCasualTalk(text, { inConversation = false } = {}) {
  const t = String(text || '').trim();
  if (!t || t.length > 90) return false;
  if (CODE_NOUN.test(t) || CODE_SIGNS.test(t)) return false;
  if (CHITCHAT.test(t)) return true;
  return !inConversation && GREETING.test(t);
}
