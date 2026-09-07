export function categoryNameKey(name: string) {
  // Match the existing registration hint. PostgreSQL decides locale-sensitive
  // Unicode equality; JS lowercasing must not reject a server-valid name.
  return name
    .replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, '')
    .replace(/[A-Z]/g, (character) => character.toLowerCase());
}
