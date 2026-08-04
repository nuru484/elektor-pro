// Lightweight inline validation for uncontrolled FormData forms: every form
// carries `noValidate` and surfaces these messages through Field's inline
// error slot - the browser's native bubbles are never shown.
export type FormErrors = Record<string, string>;

export const validateRequired = (
  form: FormData,
  fields: Record<string, string>,
): FormErrors => {
  const errors: FormErrors = {};
  for (const [name, label] of Object.entries(fields)) {
    if (!String(form.get(name) ?? "").trim()) {
      errors[name] = `${label} is required`;
    }
  }
  return errors;
};

export const isValidEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
