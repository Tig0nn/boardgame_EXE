// Presentation preference: manages auto-show chapter rules setting across app sessions
export const AUTO_SHOW_RULES_KEY = 'xvtl:mobile:auto_show_rules';

export function isAutoShowRulesEnabled(storage?: Pick<Storage, 'getItem'> | null): boolean {
  try {
    const target = storage === undefined ? window.localStorage : storage;
    const val = target?.getItem(AUTO_SHOW_RULES_KEY);
    // Mặc định là TRUE nếu chưa từng cài đặt
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

export function setAutoShowRulesEnabled(enabled: boolean, storage?: Pick<Storage, 'setItem'> | null): boolean {
  try {
    const target = storage === undefined ? window.localStorage : storage;
    if (!target) return false;
    target.setItem(AUTO_SHOW_RULES_KEY, enabled ? 'true' : 'false');
    return true;
  } catch {
    return false;
  }
}
