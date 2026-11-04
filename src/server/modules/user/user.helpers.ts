/**
 * Throw when an id is missing, before it reaches a TypeORM where object.
 * TypeORM drops undefined values from a where object, which would widen a write to every row of the table.
 * @param {string} id - The id to check
 * @param {string} name - The parameter name, for the error message
 * @returns {void}
 */
export function requireId(id: string, name: string): void {
	if (typeof id !== 'string' || id.length === 0) throw new Error(`User query needs a ${name}`);
}
