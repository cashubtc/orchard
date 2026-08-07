/**
 * Marks the process as a schema-generation run.
 *
 * Imported for its side effect before anything that pulls in AppModule: ESM evaluates each
 * import fully before the next, so the flag is set by the time the module graph is built.
 * Setting it in the importing module's body would be too late — imports hoist above it.
 */
process.env.SCHEMA_ONLY = 'true';
