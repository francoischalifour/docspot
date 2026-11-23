/**
 * A word's forms by plural category, as `Intl.PluralRules` names them.
 * `other` is required; a category without its own form uses it.
 */
export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & {
  other: string;
};

const rules = new Map<string, Intl.PluralRules>();

/**
 * The form of a word for a count in a language, such as `résultat` for 0 in
 * French, or `wyniki` for 2 and `wyników` for 5 in Polish.
 */
export function pluralize(
  count: number,
  forms: PluralForms,
  language: string
): string {
  let rule = rules.get(language);
  if (!rule) {
    rule = new Intl.PluralRules(language);
    rules.set(language, rule);
  }
  return forms[rule.select(count)] ?? forms.other;
}
