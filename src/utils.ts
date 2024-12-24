

export function toCamelCase(str: string): string {
  return str.replace(/[-_]+(.)?/g, (_, c) => c ? c.toUpperCase() : '');
}

export function toSnakeCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
}

export function toKebabCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

export function toCamelCaseWithFirstLower(str: string): string {
  return str.charAt(0).toLowerCase() + toCamelCase(str).slice(1);
}